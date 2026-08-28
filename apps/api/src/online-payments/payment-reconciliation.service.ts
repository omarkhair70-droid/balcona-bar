import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  AuditActorType,
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
  OnlinePaymentReconciliationIssueStatus,
  OnlinePaymentReconciliationIssueType,
  OnlinePaymentReconciliationMatchStatus,
  OnlinePaymentReconciliationMovementType,
  OnlinePaymentReconciliationRunStatus,
  OnlinePaymentReconciliationSource,
  Prisma,
} from "@prisma/client";
import { createHash } from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  ImportOnlinePaymentSettlementDto,
  ReconciliationIssueActionDto,
  ReconciliationIssuesQueryDto,
  StartOnlinePaymentReconciliationDto,
} from "./dto/payment-reconciliation.dto";
import {
  PaymentProviderError,
  ProviderTransactionState,
} from "./providers/payment-provider.types";
import { PaymobPaymentProviderService } from "./providers/paymob-payment-provider.service";

type LocalMovement = {
  movementType: OnlinePaymentReconciliationMovementType;
  onlinePaymentIntentId: string;
  onlinePaymentOperationId?: string;
  providerTransactionId?: string;
  parentProviderTransactionId?: string;
  amountMinor: number;
  currency: string;
  happenedAt: Date;
};

type NormalizedSettlementLine = {
  providerTransactionId: string;
  movementType: OnlinePaymentReconciliationMovementType;
  amountMinor: number;
  feeMinor: number;
  netMinor: number;
  currency: string;
  settlementReference: string | null;
  settledAt: Date | null;
};

type ReconciliationCounters = {
  matched: number;
  pending: number;
  mismatch: number;
  providerGrossMinor: number;
  providerAdjustmentMinor: number;
  providerFeeMinor: number;
  providerFeeComplete: boolean;
};

@Injectable()
export class PaymentReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly paymobPaymentProviderService: PaymobPaymentProviderService,
  ) {}

  async runPaymobProviderReconciliation(
    branchId: string,
    requestedByStaffUserId: string | undefined,
    body: StartOnlinePaymentReconciliationDto,
  ) {
    const period = this.parsePeriod(body.periodStart, body.periodEnd);
    const currency = this.normalizeCurrency(body.currency);
    const branch = await this.loadBranch(branchId);

    const existing = await this.prisma.onlinePaymentReconciliationRun.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
    });

    if (existing) {
      if (
        existing.branchId !== branchId ||
        existing.provider !== OnlinePaymentProvider.paymob ||
        existing.source !== OnlinePaymentReconciliationSource.provider_inquiry ||
        existing.periodStart.getTime() !== period.start.getTime() ||
        existing.periodEnd.getTime() !== period.end.getTime() ||
        existing.currency !== currency
      ) {
        throw new ConflictException(
          "Reconciliation idempotency key is already used for another run",
        );
      }

      if (!this.shouldResumeRun(existing, true)) {
        return this.findRun(existing.id);
      }
    }

    const movements = await this.collectLocalMovements(
      branchId,
      period.start,
      period.end,
      currency,
    );
    this.assertMovementCountWithinLimit(movements.length);
    const localTotals = this.localTotals(movements);
    const run = existing
      ? await this.resetRunForRetry(existing.id, {
          requestedByStaffUserId,
          localGrossMinor: localTotals.grossMinor,
          localAdjustmentMinor: localTotals.adjustmentMinor,
          localNetBeforeFeesMinor: localTotals.netBeforeFeesMinor,
        })
      : await this.prisma.onlinePaymentReconciliationRun.create({
          data: {
            companyId: branch.companyId,
            branchId,
            provider: OnlinePaymentProvider.paymob,
            source: OnlinePaymentReconciliationSource.provider_inquiry,
            status: OnlinePaymentReconciliationRunStatus.running,
            idempotencyKey: body.idempotencyKey,
            periodStart: period.start,
            periodEnd: period.end,
            currency,
            requestedByStaffUserId,
            localGrossMinor: localTotals.grossMinor,
            localAdjustmentMinor: localTotals.adjustmentMinor,
            localNetBeforeFeesMinor: localTotals.netBeforeFeesMinor,
          },
        });

    const counters: ReconciliationCounters = {
      matched: 0,
      pending: 0,
      mismatch: 0,
      providerGrossMinor: 0,
      providerAdjustmentMinor: 0,
      providerFeeMinor: 0,
      providerFeeComplete: true,
    };

    try {
      for (const movement of movements) {
        await this.reconcileProviderMovement(run.id, branch.companyId, branchId, movement, counters);
      }

      const providerFeeMinor = counters.providerFeeComplete
        ? counters.providerFeeMinor
        : null;
      const providerNetMinor =
        providerFeeMinor === null
          ? null
          : counters.providerGrossMinor -
            counters.providerAdjustmentMinor -
            providerFeeMinor;
      const status =
        counters.mismatch > 0
          ? OnlinePaymentReconciliationRunStatus.mismatch
          : counters.pending > 0
            ? OnlinePaymentReconciliationRunStatus.pending
            : OnlinePaymentReconciliationRunStatus.matched;

      await this.prisma.onlinePaymentReconciliationRun.update({
        where: { id: run.id },
        data: {
          status,
          providerGrossMinor: counters.providerGrossMinor,
          providerAdjustmentMinor: counters.providerAdjustmentMinor,
          providerFeeMinor,
          providerNetMinor,
          matchedCount: counters.matched,
          pendingCount: counters.pending,
          mismatchCount: counters.mismatch,
          completedAt: new Date(),
          metadata: {
            feeCoverage:
              providerFeeMinor === null ? "incomplete" : "complete",
          },
        },
      });

      await this.auditRun(run.id, requestedByStaffUserId);
      return this.findRun(run.id);
    } catch (error) {
      await this.prisma.onlinePaymentReconciliationRun.updateMany({
        where: {
          id: run.id,
          status: OnlinePaymentReconciliationRunStatus.running,
        },
        data: {
          status: OnlinePaymentReconciliationRunStatus.failed,
          completedAt: new Date(),
          failureCode:
            error instanceof PaymentProviderError
              ? error.code
              : error instanceof Error
                ? error.name
                : "unknown_error",
          failureMessage:
            "Provider reconciliation could not be completed safely",
        },
      });

      if (error instanceof PaymentProviderError) {
        throw new ServiceUnavailableException(
          "Paymob reconciliation is temporarily unavailable",
        );
      }

      throw error;
    }
  }

  async importSettlementBatch(
    branchId: string,
    staffUserId: string,
    body: ImportOnlinePaymentSettlementDto,
  ) {
    const branch = await this.loadBranch(branchId);
    const period = this.parsePeriod(body.periodStart, body.periodEnd);
    const currency = this.normalizeCurrency(body.currency);
    const provider =
      body.provider ?? OnlinePaymentProvider.paymob;
    this.assertMovementCountWithinLimit(body.lines.length);
    const lines = this.normalizeSettlementLines(body.lines, currency);
    const totals = this.statementTotals(lines);

    if (
      totals.grossMinor !== body.grossMinor ||
      totals.adjustmentMinor !== body.adjustmentMinor ||
      totals.feeMinor !== body.feeMinor ||
      totals.netMinor !== body.netMinor
    ) {
      throw new BadRequestException(
        "Settlement batch totals do not match the supplied lines",
      );
    }

    const sourceHash = createHash("sha256")
      .update(
        JSON.stringify({
          provider,
          branchId,
          externalReference: body.externalReference.trim(),
          payoutReference: body.payoutReference?.trim() || null,
          currency,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          settledAt: body.settledAt
            ? new Date(body.settledAt).toISOString()
            : null,
          grossMinor: body.grossMinor,
          adjustmentMinor: body.adjustmentMinor,
          feeMinor: body.feeMinor,
          netMinor: body.netMinor,
          lines,
        }),
      )
      .digest("hex");

    const existing =
      await this.prisma.onlinePaymentSettlementBatch.findFirst({
        where: {
          provider,
          branchId,
          OR: [
            { externalReference: body.externalReference.trim() },
            { sourceHash },
          ],
        },
      });

    if (existing) {
      if (existing.sourceHash !== sourceHash) {
        throw new ConflictException(
          "Settlement reference is already imported with different contents",
        );
      }

      await this.reconcileSettlementBatch(existing.id, staffUserId);
      return this.findSettlementBatch(existing.id);
    }

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.onlinePaymentSettlementBatch.create({
        data: {
          companyId: branch.companyId,
          branchId,
          provider,
          externalReference: body.externalReference.trim(),
          payoutReference: body.payoutReference?.trim() || null,
          currency,
          periodStart: period.start,
          periodEnd: period.end,
          settledAt: body.settledAt ? new Date(body.settledAt) : null,
          grossMinor: body.grossMinor,
          adjustmentMinor: body.adjustmentMinor,
          feeMinor: body.feeMinor,
          netMinor: body.netMinor,
          sourceHash,
          importedByStaffUserId: staffUserId,
          lines: {
            create: lines.map((line) => ({
              providerTransactionId: line.providerTransactionId,
              movementType: line.movementType,
              amountMinor: line.amountMinor,
              feeMinor: line.feeMinor,
              netMinor: line.netMinor,
              currency: line.currency,
              settlementReference: line.settlementReference,
              settledAt: line.settledAt,
            })),
          },
        },
      });

      await this.auditService.recordAuditLog(
        {
          companyId: branch.companyId,
          branchId,
          actorType: AuditActorType.staff,
          actorStaffUserId: staffUserId,
          targetType: "online_payment_settlement_batch",
          targetId: created.id,
          action: AuditAction.online_payment_settlement_imported,
          message: `${provider} settlement statement imported`,
          metadata: {
            provider,
            externalReference: body.externalReference.trim(),
            payoutReference: body.payoutReference?.trim() || null,
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            grossMinor: body.grossMinor,
            adjustmentMinor: body.adjustmentMinor,
            feeMinor: body.feeMinor,
            netMinor: body.netMinor,
            lineCount: lines.length,
          },
        },
        tx,
      );

      return created;
    });

    await this.reconcileSettlementBatch(batch.id, staffUserId);
    return this.findSettlementBatch(batch.id);
  }

  async reconcileSettlementBatch(
    batchId: string,
    requestedByStaffUserId?: string,
  ) {
    const batch = await this.prisma.onlinePaymentSettlementBatch.findUnique({
      where: { id: batchId },
      include: { lines: true },
    });

    if (!batch) {
      throw new NotFoundException("Online payment settlement batch not found");
    }

    const idempotencyKey = `settlement:${batch.id}:${batch.sourceHash}`;
    const existing = await this.prisma.onlinePaymentReconciliationRun.findUnique({
      where: { idempotencyKey },
    });

    if (existing && !this.shouldResumeRun(existing, false)) {
      return this.findRun(existing.id);
    }

    const movements = await this.collectLocalMovements(
      batch.branchId,
      batch.periodStart,
      batch.periodEnd,
      batch.currency,
      batch.provider,
    );
    this.assertMovementCountWithinLimit(movements.length);
    const localTotals = this.localTotals(movements);
    const run = existing
      ? await this.resetRunForRetry(existing.id, {
          requestedByStaffUserId,
          localGrossMinor: localTotals.grossMinor,
          localAdjustmentMinor: localTotals.adjustmentMinor,
          localNetBeforeFeesMinor: localTotals.netBeforeFeesMinor,
          providerGrossMinor: batch.grossMinor,
          providerAdjustmentMinor: batch.adjustmentMinor,
          providerFeeMinor: batch.feeMinor,
          providerNetMinor: batch.netMinor,
        })
      : await this.prisma.onlinePaymentReconciliationRun.create({
          data: {
            companyId: batch.companyId,
            branchId: batch.branchId,
            provider: batch.provider,
            source: OnlinePaymentReconciliationSource.settlement_statement,
            status: OnlinePaymentReconciliationRunStatus.running,
            idempotencyKey,
            periodStart: batch.periodStart,
            periodEnd: batch.periodEnd,
            currency: batch.currency,
            settlementBatchId: batch.id,
            requestedByStaffUserId,
            localGrossMinor: localTotals.grossMinor,
            localAdjustmentMinor: localTotals.adjustmentMinor,
            localNetBeforeFeesMinor: localTotals.netBeforeFeesMinor,
            providerGrossMinor: batch.grossMinor,
            providerAdjustmentMinor: batch.adjustmentMinor,
            providerFeeMinor: batch.feeMinor,
            providerNetMinor: batch.netMinor,
          },
        });

    const lineByTransaction = new Map(
      batch.lines.map((line) => [
        this.statementMovementKey(
          line.providerTransactionId,
          line.movementType,
        ),
        line,
      ]),
    );
    const matchedStatementTransactionIds = new Set<string>();
    let matchedCount = 0;
    let mismatchCount = 0;

    for (const movement of movements) {
      if (!movement.providerTransactionId) {
        mismatchCount += 1;
        await this.createIssue(
          run.id,
          undefined,
          batch.companyId,
          batch.branchId,
          OnlinePaymentReconciliationIssueType.provider_transaction_missing,
          "Local payment movement has no provider transaction reference",
          {
            movementType: movement.movementType,
            onlinePaymentIntentId: movement.onlinePaymentIntentId,
            onlinePaymentOperationId: movement.onlinePaymentOperationId,
          },
          batch.provider,
        );
        continue;
      }

      const movementKey = this.statementMovementKey(
        movement.providerTransactionId,
        movement.movementType,
      );
      const line = lineByTransaction.get(movementKey);

      if (!line) {
        const entry = await this.createStatementEntry(
          run.id,
          batch.companyId,
          batch.branchId,
          batch.provider,
          movement,
          undefined,
          OnlinePaymentReconciliationMatchStatus.mismatch,
          "statement_line_missing",
        );
        mismatchCount += 1;
        await this.createIssue(run.id, entry.id, batch.companyId, batch.branchId, OnlinePaymentReconciliationIssueType.statement_line_missing, "Local provider transaction is missing from the imported settlement statement", {
          providerTransactionId: movement.providerTransactionId,
          movementType: movement.movementType,
          localAmountMinor: movement.amountMinor,
        }, batch.provider);
        continue;
      }

      matchedStatementTransactionIds.add(movementKey);
      const mismatch = this.statementLineMismatch(movement, line);
      const entry = await this.createStatementEntry(
        run.id,
        batch.companyId,
        batch.branchId,
        batch.provider,
        movement,
        line,
        mismatch
          ? OnlinePaymentReconciliationMatchStatus.mismatch
          : OnlinePaymentReconciliationMatchStatus.matched,
        mismatch?.code,
      );

      if (mismatch) {
        mismatchCount += 1;
        await this.createIssue(
          run.id,
          entry.id,
          batch.companyId,
          batch.branchId,
          mismatch.type,
          mismatch.message,
          mismatch.details,
          batch.provider,
        );
      } else {
        matchedCount += 1;
      }
    }

    for (const line of batch.lines) {
      if (
        matchedStatementTransactionIds.has(
          this.statementMovementKey(
            line.providerTransactionId,
            line.movementType,
          ),
        )
      ) {
        continue;
      }

      mismatchCount += 1;
      await this.createIssue(
        run.id,
        undefined,
        batch.companyId,
        batch.branchId,
        OnlinePaymentReconciliationIssueType.statement_only_transaction,
        "Settlement statement contains a provider transaction with no matching local Balcona movement",
        {
          providerTransactionId: line.providerTransactionId,
          movementType: line.movementType,
          amountMinor: line.amountMinor,
          currency: line.currency,
        },
        batch.provider,
      );
    }

    if (
      localTotals.grossMinor !== batch.grossMinor ||
      localTotals.adjustmentMinor !== batch.adjustmentMinor
    ) {
      mismatchCount += 1;
      await this.createIssue(
        run.id,
        undefined,
        batch.companyId,
        batch.branchId,
        OnlinePaymentReconciliationIssueType.statement_total_mismatch,
        "Settlement gross or adjustment totals do not match Balcona local movements",
        {
          localGrossMinor: localTotals.grossMinor,
          providerGrossMinor: batch.grossMinor,
          localAdjustmentMinor: localTotals.adjustmentMinor,
          providerAdjustmentMinor: batch.adjustmentMinor,
        },
        batch.provider,
      );
    }

    const expectedProviderNetMinor =
      localTotals.netBeforeFeesMinor - batch.feeMinor;

    if (expectedProviderNetMinor !== batch.netMinor) {
      mismatchCount += 1;
      await this.createIssue(
        run.id,
        undefined,
        batch.companyId,
        batch.branchId,
        OnlinePaymentReconciliationIssueType.statement_net_mismatch,
        "Settlement net does not equal Balcona net-before-fees minus provider fees",
        {
          localNetBeforeFeesMinor: localTotals.netBeforeFeesMinor,
          providerFeeMinor: batch.feeMinor,
          expectedProviderNetMinor,
          providerNetMinor: batch.netMinor,
        },
        batch.provider,
      );
    }

    await this.prisma.onlinePaymentReconciliationRun.update({
      where: { id: run.id },
      data: {
        status:
          mismatchCount > 0
            ? OnlinePaymentReconciliationRunStatus.mismatch
            : OnlinePaymentReconciliationRunStatus.matched,
        matchedCount,
        mismatchCount,
        pendingCount: 0,
        completedAt: new Date(),
      },
    });

    await this.auditRun(run.id, requestedByStaffUserId);
    return this.findRun(run.id);
  }

  async discoverPaymobReconciliationScopes(
    periodStart: Date,
    periodEnd: Date,
    maxScopes?: number,
  ) {
    const limit =
      maxScopes ??
      this.configService.get<number>(
        "onlinePayments.settlementReconciliation.maxScopesPerTick",
        50,
      );
    const [paymentScopes, operationScopes] = await Promise.all([
      this.prisma.onlinePaymentIntent.groupBy({
        by: ["branchId", "currency"],
        where: {
          provider: OnlinePaymentProvider.paymob,
          status: OnlinePaymentIntentStatus.succeeded,
          succeededAt: { gte: periodStart, lt: periodEnd },
        },
      }),
      this.prisma.onlinePaymentOperation.groupBy({
        by: ["branchId", "currency"],
        where: {
          provider: OnlinePaymentProvider.paymob,
          status: OnlinePaymentOperationStatus.succeeded,
          type: {
            in: [
              OnlinePaymentOperationType.refund,
              OnlinePaymentOperationType.void,
            ],
          },
          completedAt: { gte: periodStart, lt: periodEnd },
        },
      }),
    ]);
    const scopes = new Map<string, { branchId: string; currency: string }>();

    for (const scope of [...paymentScopes, ...operationScopes]) {
      const currency = this.normalizeCurrency(scope.currency);
      const key = `${scope.branchId}:${currency}`;
      scopes.set(key, { branchId: scope.branchId, currency });

      if (scopes.size > limit) {
        throw new ConflictException(
          "Settlement reconciliation scope count exceeds the configured per-tick limit",
        );
      }
    }

    return [...scopes.values()].sort(
      (left, right) =>
        left.branchId.localeCompare(right.branchId) ||
        left.currency.localeCompare(right.currency),
    );
  }

  findRunsForBranch(branchId: string, limit = 50) {
    return this.prisma.onlinePaymentReconciliationRun.findMany({
      where: { branchId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.min(Math.max(limit, 1), 100),
      include: {
        settlementBatch: {
          select: {
            id: true,
            externalReference: true,
            payoutReference: true,
            settledAt: true,
          },
        },
      },
    });
  }

  async findRun(runId: string) {
    const run = await this.prisma.onlinePaymentReconciliationRun.findUnique({
      where: { id: runId },
      include: {
        settlementBatch: {
          include: { lines: { orderBy: [{ createdAt: "asc" }] } },
        },
        entries: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        issues: {
          orderBy: [{ detectedAt: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!run) {
      throw new NotFoundException("Online payment reconciliation run not found");
    }

    return run;
  }

  async findSettlementBatch(batchId: string) {
    const batch = await this.prisma.onlinePaymentSettlementBatch.findUnique({
      where: { id: batchId },
      include: {
        lines: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        reconciliationRuns: {
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            status: true,
            matchedCount: true,
            pendingCount: true,
            mismatchCount: true,
            completedAt: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException("Online payment settlement batch not found");
    }

    return batch;
  }

  findIssuesForBranch(
    branchId: string,
    query: ReconciliationIssuesQueryDto = {},
  ) {
    return this.prisma.onlinePaymentReconciliationIssue.findMany({
      where: {
        branchId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ detectedAt: "desc" }, { id: "desc" }],
      take: Math.min(query.limit ?? 100, 200),
      include: {
        reconciliationRun: {
          select: {
            id: true,
            source: true,
            periodStart: true,
            periodEnd: true,
            status: true,
          },
        },
        reconciliationEntry: true,
      },
    });
  }

  async acknowledgeIssue(
    issueId: string,
    staffUserId: string,
    body: ReconciliationIssueActionDto = {},
  ) {
    return this.updateIssueStatus(
      issueId,
      staffUserId,
      OnlinePaymentReconciliationIssueStatus.acknowledged,
      body.note,
    );
  }

  async resolveIssue(
    issueId: string,
    staffUserId: string,
    body: ReconciliationIssueActionDto = {},
  ) {
    return this.updateIssueStatus(
      issueId,
      staffUserId,
      OnlinePaymentReconciliationIssueStatus.resolved,
      body.note,
    );
  }

  private async updateIssueStatus(
    issueId: string,
    staffUserId: string,
    status: OnlinePaymentReconciliationIssueStatus,
    note?: string,
  ) {
    const issue = await this.prisma.onlinePaymentReconciliationIssue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException("Online payment reconciliation issue not found");
    }

    if (issue.status === OnlinePaymentReconciliationIssueStatus.resolved) {
      return issue;
    }

    const now = new Date();
    const action =
      status === OnlinePaymentReconciliationIssueStatus.resolved
        ? AuditAction.online_payment_reconciliation_issue_resolved
        : AuditAction.online_payment_reconciliation_issue_acknowledged;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.onlinePaymentReconciliationIssue.update({
        where: { id: issue.id },
        data:
          status === OnlinePaymentReconciliationIssueStatus.resolved
            ? {
                status,
                resolvedAt: now,
                resolvedByStaffUserId: staffUserId,
                resolutionNote: note?.trim() || null,
              }
            : {
                status,
                acknowledgedAt: now,
                acknowledgedByStaffUserId: staffUserId,
                resolutionNote: note?.trim() || issue.resolutionNote,
              },
      });

      await this.auditService.recordAuditLog(
        {
          companyId: issue.companyId,
          branchId: issue.branchId,
          actorType: AuditActorType.staff,
          actorStaffUserId: staffUserId,
          targetType: "online_payment_reconciliation_issue",
          targetId: issue.id,
          action,
          message:
            status === OnlinePaymentReconciliationIssueStatus.resolved
              ? "Payment reconciliation issue resolved"
              : "Payment reconciliation issue acknowledged",
          metadata: {
            reconciliationRunId: issue.reconciliationRunId,
            issueType: issue.type,
            note: note?.trim() || null,
          },
        },
        tx,
      );

      return updated;
    });
  }

  private async reconcileProviderMovement(
    runId: string,
    companyId: string,
    branchId: string,
    movement: LocalMovement,
    counters: ReconciliationCounters,
  ) {
    if (!movement.providerTransactionId) {
      counters.mismatch += 1;
      await this.createIssue(
        runId,
        undefined,
        companyId,
        branchId,
        OnlinePaymentReconciliationIssueType.provider_transaction_missing,
        "Local payment movement has no Paymob transaction reference",
        {
          movementType: movement.movementType,
          onlinePaymentIntentId: movement.onlinePaymentIntentId,
          onlinePaymentOperationId: movement.onlinePaymentOperationId,
        },
      );
      return;
    }

    let state: ProviderTransactionState;

    try {
      state =
        await this.paymobPaymentProviderService.inquireTransactionById(
          movement.providerTransactionId,
        );
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.code === "transaction_not_found"
      ) {
        const entry = await this.createProviderEntry(
          runId,
          companyId,
          branchId,
          movement,
          undefined,
          OnlinePaymentReconciliationMatchStatus.mismatch,
          "provider_transaction_missing",
        );
        counters.mismatch += 1;
        await this.createIssue(
          runId,
          entry.id,
          companyId,
          branchId,
          OnlinePaymentReconciliationIssueType.provider_transaction_missing,
          "Paymob does not contain the local provider transaction",
          { providerTransactionId: movement.providerTransactionId },
        );
        return;
      }

      throw error;
    }

    const mismatch = this.providerMovementMismatch(movement, state);
    const matchStatus = mismatch
      ? OnlinePaymentReconciliationMatchStatus.mismatch
      : state.providerSettled === false ||
          state.providerSettled === undefined
        ? OnlinePaymentReconciliationMatchStatus.provider_pending
        : OnlinePaymentReconciliationMatchStatus.matched;
    const entry = await this.createProviderEntry(
      runId,
      companyId,
      branchId,
      movement,
      state,
      matchStatus,
      mismatch?.code,
    );

    if (mismatch) {
      counters.mismatch += 1;
      await this.createIssue(
        runId,
        entry.id,
        companyId,
        branchId,
        mismatch.type,
        mismatch.message,
        mismatch.details,
      );
      return;
    }

    if (matchStatus === OnlinePaymentReconciliationMatchStatus.provider_pending) {
      counters.pending += 1;
    } else {
      counters.matched += 1;
    }

    if (movement.movementType === OnlinePaymentReconciliationMovementType.sale) {
      counters.providerGrossMinor += movement.amountMinor;
      if (state.providerReportedFeeMinor === undefined) {
        counters.providerFeeComplete = false;
      } else {
        counters.providerFeeMinor += state.providerReportedFeeMinor;
      }
    } else {
      counters.providerAdjustmentMinor += movement.amountMinor;
      // Refund/void fee effects are statement/acquirer dependent. Do not
      // fabricate provider net from transaction inquiry alone.
      counters.providerFeeComplete = false;
    }
  }

  private providerMovementMismatch(
    movement: LocalMovement,
    state: ProviderTransactionState,
  ) {
    if (state.currency !== movement.currency) {
      return {
        code: "currency_mismatch",
        type: OnlinePaymentReconciliationIssueType.currency_mismatch,
        message: "Paymob transaction currency differs from Balcona",
        details: {
          providerTransactionId: movement.providerTransactionId,
          localCurrency: movement.currency,
          providerCurrency: state.currency,
        },
      };
    }

    if (movement.movementType === OnlinePaymentReconciliationMovementType.sale) {
      if (
        state.amountMinor !== movement.amountMinor
      ) {
        return {
          code: "amount_mismatch",
          type: OnlinePaymentReconciliationIssueType.amount_mismatch,
          message: "Paymob sale amount differs from Balcona",
          details: {
            localAmountMinor: movement.amountMinor,
            providerAmountMinor: state.amountMinor,
          },
        };
      }

      if (state.status !== OnlinePaymentIntentStatus.succeeded) {
        return {
          code: "provider_status_mismatch",
          type: OnlinePaymentReconciliationIssueType.provider_status_mismatch,
          message: "Balcona sale is succeeded but Paymob does not report success",
          details: { providerStatus: state.status },
        };
      }

      return null;
    }

    const parentState =
      movement.parentProviderTransactionId &&
      movement.providerTransactionId === movement.parentProviderTransactionId;

    if (movement.movementType === OnlinePaymentReconciliationMovementType.refund) {
      if (state.status !== OnlinePaymentIntentStatus.succeeded) {
        return {
          code: "provider_status_mismatch",
          type: OnlinePaymentReconciliationIssueType.provider_status_mismatch,
          message: "Balcona refund is succeeded but Paymob does not report success",
          details: { providerStatus: state.status },
        };
      }

      if (!parentState && state.operationType !== OnlinePaymentOperationType.refund) {
        return {
          code: "operation_type_mismatch",
          type: OnlinePaymentReconciliationIssueType.operation_type_mismatch,
          message: "Paymob transaction is not the expected refund operation",
          details: { providerOperationType: state.operationType ?? null },
        };
      }

      if (
        parentState
          ? (state.refundedAmountMinor ?? 0) < movement.amountMinor
          : state.amountMinor !== movement.amountMinor
      ) {
        return {
          code: "amount_mismatch",
          type: OnlinePaymentReconciliationIssueType.amount_mismatch,
          message: "Paymob refund amount differs from Balcona",
          details: {
            localAmountMinor: movement.amountMinor,
            providerAmountMinor: state.amountMinor,
            providerRefundedAmountMinor: state.refundedAmountMinor ?? null,
          },
        };
      }

      return null;
    }

    const providerVoided =
      state.safeMetadata.isVoided === true ||
      state.operationType === OnlinePaymentOperationType.void;

    if (!providerVoided) {
      return {
        code: "operation_type_mismatch",
        type: OnlinePaymentReconciliationIssueType.operation_type_mismatch,
        message: "Paymob transaction is not the expected void operation",
        details: { providerOperationType: state.operationType ?? null },
      };
    }

    return null;
  }

  private async createProviderEntry(
    runId: string,
    companyId: string,
    branchId: string,
    movement: LocalMovement,
    state: ProviderTransactionState | undefined,
    matchStatus: OnlinePaymentReconciliationMatchStatus,
    mismatchCode?: string,
  ) {
    return this.prisma.onlinePaymentReconciliationEntry.create({
      data: {
        reconciliationRunId: runId,
        companyId,
        branchId,
        provider: OnlinePaymentProvider.paymob,
        movementType: movement.movementType,
        onlinePaymentIntentId: movement.onlinePaymentIntentId,
        onlinePaymentOperationId: movement.onlinePaymentOperationId,
        providerTransactionId:
          movement.providerTransactionId ?? "missing",
        parentProviderTransactionId:
          movement.parentProviderTransactionId ?? null,
        localAmountMinor:
          movement.movementType === OnlinePaymentReconciliationMovementType.sale
            ? movement.amountMinor
            : -movement.amountMinor,
        currency: movement.currency,
        providerAmountMinor: state?.amountMinor,
        providerSettled: state?.providerSettled,
        providerFeeMinor: state?.providerReportedFeeMinor,
        providerSettlementDate: state?.providerSettlementDate
          ? this.parseOptionalProviderDate(state.providerSettlementDate)
          : null,
        providerSettlementReference:
          state?.providerSettlementReference ?? null,
        matchStatus,
        mismatchCode: mismatchCode ?? null,
        metadata: state
          ? this.toJsonValue({
              providerStatus: state.status,
              providerOrderId: state.providerOrderId,
              providerOperationType: state.operationType,
              providerSettled: state.providerSettled,
              safeProviderMetadata: state.safeMetadata,
            })
          : undefined,
      },
    });
  }

  private async createStatementEntry(
    runId: string,
    companyId: string,
    branchId: string,
    provider: OnlinePaymentProvider,
    movement: LocalMovement,
    line:
      | {
          id: string;
          providerTransactionId: string;
          movementType: OnlinePaymentReconciliationMovementType;
          amountMinor: number;
          feeMinor: number;
          netMinor: number;
          currency: string;
          settlementReference: string | null;
          settledAt: Date | null;
        }
      | undefined,
    matchStatus: OnlinePaymentReconciliationMatchStatus,
    mismatchCode?: string,
  ) {
    return this.prisma.onlinePaymentReconciliationEntry.create({
      data: {
        reconciliationRunId: runId,
        companyId,
        branchId,
        provider,
        movementType: movement.movementType,
        onlinePaymentIntentId: movement.onlinePaymentIntentId,
        onlinePaymentOperationId: movement.onlinePaymentOperationId,
        providerTransactionId: movement.providerTransactionId!,
        parentProviderTransactionId:
          movement.parentProviderTransactionId ?? null,
        localAmountMinor:
          movement.movementType === OnlinePaymentReconciliationMovementType.sale
            ? movement.amountMinor
            : -movement.amountMinor,
        currency: movement.currency,
        providerAmountMinor: line?.amountMinor,
        providerSettled: line ? true : null,
        providerFeeMinor: line?.feeMinor,
        providerSettlementDate: line?.settledAt,
        providerSettlementReference: line?.settlementReference,
        settlementLineId: line?.id,
        matchStatus,
        mismatchCode: mismatchCode ?? null,
        metadata: line
          ? this.toJsonValue({ providerNetMinor: line.netMinor })
          : undefined,
      },
    });
  }

  private statementLineMismatch(
    movement: LocalMovement,
    line: {
      providerTransactionId: string;
      movementType: OnlinePaymentReconciliationMovementType;
      amountMinor: number;
      currency: string;
    },
  ) {
    if (line.movementType !== movement.movementType) {
      return {
        code: "operation_type_mismatch",
        type: OnlinePaymentReconciliationIssueType.operation_type_mismatch,
        message: "Settlement line movement type differs from Balcona",
        details: {
          localMovementType: movement.movementType,
          providerMovementType: line.movementType,
        },
      };
    }

    if (line.currency !== movement.currency) {
      return {
        code: "currency_mismatch",
        type: OnlinePaymentReconciliationIssueType.currency_mismatch,
        message: "Settlement line currency differs from Balcona",
        details: {
          localCurrency: movement.currency,
          providerCurrency: line.currency,
        },
      };
    }

    if (line.amountMinor !== movement.amountMinor) {
      return {
        code: "amount_mismatch",
        type: OnlinePaymentReconciliationIssueType.amount_mismatch,
        message: "Settlement line amount differs from Balcona",
        details: {
          localAmountMinor: movement.amountMinor,
          providerAmountMinor: line.amountMinor,
        },
      };
    }

    return null;
  }

  private async collectLocalMovements(
    branchId: string,
    periodStart: Date,
    periodEnd: Date,
    currency: string,
    provider: OnlinePaymentProvider = OnlinePaymentProvider.paymob,
  ): Promise<LocalMovement[]> {
    const [payments, operations] = await Promise.all([
      this.prisma.onlinePaymentIntent.findMany({
        where: {
          branchId,
          provider,
          status: OnlinePaymentIntentStatus.succeeded,
          currency,
          succeededAt: { gte: periodStart, lt: periodEnd },
        },
        select: {
          id: true,
          amountMinor: true,
          currency: true,
          succeededAt: true,
          metadata: true,
        },
      }),
      this.prisma.onlinePaymentOperation.findMany({
        where: {
          branchId,
          provider,
          status: OnlinePaymentOperationStatus.succeeded,
          currency,
          type: {
            in: [
              OnlinePaymentOperationType.refund,
              OnlinePaymentOperationType.void,
            ],
          },
          completedAt: { gte: periodStart, lt: periodEnd },
        },
        select: {
          id: true,
          onlinePaymentIntentId: true,
          type: true,
          amountMinor: true,
          currency: true,
          parentProviderTransactionId: true,
          providerTransactionId: true,
          completedAt: true,
          onlinePaymentIntent: {
            select: {
              succeededAt: true,
            },
          },
        },
      }),
    ]);

    const movements: LocalMovement[] = payments.map((payment) => ({
      movementType: OnlinePaymentReconciliationMovementType.sale,
      onlinePaymentIntentId: payment.id,
      providerTransactionId: this.stringMetadata(
        payment.metadata,
        provider === OnlinePaymentProvider.fawry
          ? "fawryRefNumber"
          : "paymobTransactionId",
      ),
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      happenedAt: payment.succeededAt!,
    }));

    for (const operation of operations) {
      if (
        operation.type === OnlinePaymentOperationType.void &&
        !operation.onlinePaymentIntent.succeededAt
      ) {
        continue;
      }

      movements.push({
        movementType:
          operation.type === OnlinePaymentOperationType.refund
            ? OnlinePaymentReconciliationMovementType.refund
            : OnlinePaymentReconciliationMovementType.void,
        onlinePaymentIntentId: operation.onlinePaymentIntentId,
        onlinePaymentOperationId: operation.id,
        providerTransactionId:
          operation.providerTransactionId ??
          operation.parentProviderTransactionId ??
          undefined,
        parentProviderTransactionId:
          operation.parentProviderTransactionId,
        amountMinor: operation.amountMinor,
        currency: operation.currency,
        happenedAt: operation.completedAt!,
      });
    }

    return movements.sort(
      (left, right) =>
        left.happenedAt.getTime() - right.happenedAt.getTime() ||
        (left.providerTransactionId ?? "").localeCompare(
          right.providerTransactionId ?? "",
        ),
    );
  }

  private localTotals(movements: LocalMovement[]) {
    const grossMinor = movements
      .filter(
        (movement) =>
          movement.movementType ===
          OnlinePaymentReconciliationMovementType.sale,
      )
      .reduce((sum, movement) => sum + movement.amountMinor, 0);
    const adjustmentMinor = movements
      .filter(
        (movement) =>
          movement.movementType !==
          OnlinePaymentReconciliationMovementType.sale,
      )
      .reduce((sum, movement) => sum + movement.amountMinor, 0);

    return {
      grossMinor,
      adjustmentMinor,
      netBeforeFeesMinor: grossMinor - adjustmentMinor,
    };
  }

  private normalizeSettlementLines(
    lines: ImportOnlinePaymentSettlementDto["lines"],
    currency: string,
  ): NormalizedSettlementLine[] {
    const seen = new Set<string>();

    return lines
      .map((line) => {
        const providerTransactionId = line.providerTransactionId.trim();

        if (!providerTransactionId) {
          throw new BadRequestException(
            "Settlement provider transaction id is required",
          );
        }

        const statementKey = this.statementMovementKey(
          providerTransactionId,
          line.movementType,
        );

        if (seen.has(statementKey)) {
          throw new BadRequestException(
            "Settlement contains duplicate provider transaction/movement lines",
          );
        }
        seen.add(statementKey);

        const lineCurrency = this.normalizeCurrency(line.currency);

        if (lineCurrency !== currency) {
          throw new BadRequestException(
            "Settlement line currency must match the batch currency",
          );
        }

        return {
          providerTransactionId,
          movementType: line.movementType,
          amountMinor: line.amountMinor,
          feeMinor: line.feeMinor,
          netMinor: line.netMinor,
          currency: lineCurrency,
          settlementReference: line.settlementReference?.trim() || null,
          settledAt: line.settledAt ? new Date(line.settledAt) : null,
        };
      })
      .sort(
        (a, b) =>
          a.providerTransactionId.localeCompare(b.providerTransactionId) ||
          a.movementType.localeCompare(b.movementType),
      );
  }

  private statementMovementKey(
    providerTransactionId: string,
    movementType: OnlinePaymentReconciliationMovementType,
  ) {
    return `${providerTransactionId}:${movementType}`;
  }

  private statementTotals(lines: NormalizedSettlementLine[]) {
    let grossMinor = 0;
    let adjustmentMinor = 0;
    let feeMinor = 0;
    let netMinor = 0;

    for (const line of lines) {
      if (
        line.movementType ===
        OnlinePaymentReconciliationMovementType.sale
      ) {
        grossMinor += line.amountMinor;
      } else {
        adjustmentMinor += line.amountMinor;
      }

      feeMinor += line.feeMinor;
      netMinor += line.netMinor;
    }

    return { grossMinor, adjustmentMinor, feeMinor, netMinor };
  }

  private async createIssue(
    runId: string,
    entryId: string | undefined,
    companyId: string,
    branchId: string,
    type: OnlinePaymentReconciliationIssueType,
    message: string,
    details?: Record<string, unknown>,
    provider: OnlinePaymentProvider = OnlinePaymentProvider.paymob,
  ) {
    return this.prisma.onlinePaymentReconciliationIssue.create({
      data: {
        reconciliationRunId: runId,
        reconciliationEntryId: entryId,
        companyId,
        branchId,
        provider,
        type,
        status: OnlinePaymentReconciliationIssueStatus.open,
        message,
        details: details ? this.toJsonValue(details) : undefined,
      },
    });
  }

  private async auditRun(runId: string, staffUserId?: string) {
    const run = await this.prisma.onlinePaymentReconciliationRun.findUnique({
      where: { id: runId },
    });

    if (!run) {
      return;
    }

    await this.auditService.recordAuditLog({
      companyId: run.companyId,
      branchId: run.branchId,
      actorType: staffUserId
        ? AuditActorType.staff
        : AuditActorType.system,
      actorStaffUserId: staffUserId,
      targetType: "online_payment_reconciliation_run",
      targetId: run.id,
      action: AuditAction.online_payment_reconciliation_run,
      message: "Online payment reconciliation run completed",
      metadata: {
        source: run.source,
        status: run.status,
        periodStart: run.periodStart.toISOString(),
        periodEnd: run.periodEnd.toISOString(),
        matchedCount: run.matchedCount,
        pendingCount: run.pendingCount,
        mismatchCount: run.mismatchCount,
      },
    });
  }

  private shouldResumeRun(
    run: {
      status: OnlinePaymentReconciliationRunStatus;
      updatedAt: Date;
    },
    resumePending: boolean,
  ) {
    if (run.status === OnlinePaymentReconciliationRunStatus.failed) {
      return true;
    }

    if (
      resumePending &&
      run.status === OnlinePaymentReconciliationRunStatus.pending
    ) {
      return true;
    }

    if (run.status === OnlinePaymentReconciliationRunStatus.running) {
      const staleAfterMs = 15 * 60 * 1000;

      if (Date.now() - run.updatedAt.getTime() > staleAfterMs) {
        return true;
      }

      throw new ConflictException(
        "Reconciliation run is already in progress",
      );
    }

    return false;
  }

  private resetRunForRetry(
    runId: string,
    data: {
      requestedByStaffUserId?: string;
      localGrossMinor: number;
      localAdjustmentMinor: number;
      localNetBeforeFeesMinor: number;
      providerGrossMinor?: number | null;
      providerAdjustmentMinor?: number | null;
      providerFeeMinor?: number | null;
      providerNetMinor?: number | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentReconciliationIssue.deleteMany({
        where: { reconciliationRunId: runId },
      });
      await tx.onlinePaymentReconciliationEntry.deleteMany({
        where: { reconciliationRunId: runId },
      });

      return tx.onlinePaymentReconciliationRun.update({
        where: { id: runId },
        data: {
          status: OnlinePaymentReconciliationRunStatus.running,
          requestedByStaffUserId: data.requestedByStaffUserId ?? null,
          localGrossMinor: data.localGrossMinor,
          localAdjustmentMinor: data.localAdjustmentMinor,
          localNetBeforeFeesMinor: data.localNetBeforeFeesMinor,
          providerGrossMinor: data.providerGrossMinor ?? null,
          providerAdjustmentMinor: data.providerAdjustmentMinor ?? null,
          providerFeeMinor: data.providerFeeMinor ?? null,
          providerNetMinor: data.providerNetMinor ?? null,
          matchedCount: 0,
          pendingCount: 0,
          mismatchCount: 0,
          startedAt: new Date(),
          completedAt: null,
          failureCode: null,
          failureMessage: null,
          metadata: Prisma.JsonNull,
        },
      });
    });
  }

  private assertMovementCountWithinLimit(count: number) {
    const maxEntries = this.configService.get<number>(
      "onlinePayments.settlementReconciliation.maxEntriesPerRun",
      500,
    );

    if (count > maxEntries) {
      throw new ConflictException(
        "Reconciliation movement count exceeds the configured per-run limit",
      );
    }
  }

  private async loadBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return branch;
  }

  private parsePeriod(periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      end <= start
    ) {
      throw new BadRequestException(
        "Reconciliation period end must be after period start",
      );
    }

    const maxWindowMs = 31 * 24 * 60 * 60 * 1000;

    if (end.getTime() - start.getTime() > maxWindowMs) {
      throw new BadRequestException(
        "A reconciliation run cannot exceed 31 days",
      );
    }

    return { start, end };
  }

  private normalizeCurrency(value: string) {
    const currency = value.trim().toUpperCase();

    if (!/^[A-Z]{3,12}$/.test(currency)) {
      throw new BadRequestException("Payment currency is invalid");
    }

    return currency;
  }

  private parseOptionalProviderDate(value: string) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }

  private stringMetadata(value: Prisma.JsonValue | null, key: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }

    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === "string" && candidate.trim()
      ? candidate
      : undefined;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
