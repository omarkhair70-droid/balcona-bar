import {
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
} from "@prisma/client";
import { BadRequestException } from "@nestjs/common";
import { PaymentReconciliationService } from "./payment-reconciliation.service";

const periodStart = "2026-08-27T00:00:00.000Z";
const periodEnd = "2026-08-28T00:00:00.000Z";

function sale() {
  return {
    id: "intent-1",
    amountMinor: 12500,
    currency: "EGP",
    succeededAt: new Date("2026-08-27T10:00:00.000Z"),
    metadata: { paymobTransactionId: "555001" },
  };
}

function providerState(overrides: Record<string, unknown> = {}) {
  return {
    provider: OnlinePaymentProvider.paymob,
    providerEventId: "paymob_inquiry_555001_state",
    providerTransactionId: "555001",
    providerOrderId: "12345",
    merchantReference: "intent-1",
    integrationId: 101,
    status: OnlinePaymentIntentStatus.succeeded,
    amountMinor: 12500,
    currency: "EGP",
    actionable: true,
    hasParentTransaction: false,
    isLive: false,
    providerSettled: true,
    providerReportedFeeMinor: 250,
    providerSettlementDate: "2026-08-28",
    providerSettlementReference: "20260828",
    safeMetadata: {
      pending: false,
      success: true,
      isVoided: false,
    },
    ...overrides,
  };
}

function createHarness(
  options: {
    payments?: any[];
    operations?: any[];
    providerState?: Record<string, unknown>;
    settlementBatch?: any;
  } = {},
) {
  const entries: any[] = [];
  const issues: any[] = [];
  let currentRun: any = null;
  let currentIssue: any = null;
  const payments = options.payments ?? [sale()];
  const operations = options.operations ?? [];

  const reconciliationRun = {
    findUnique: jest.fn(async ({ where }: any) => {
      if (where.idempotencyKey && !currentRun) {
        return null;
      }

      if (
        where.idempotencyKey &&
        currentRun?.idempotencyKey !== where.idempotencyKey
      ) {
        return null;
      }

      return currentRun
        ? {
            ...currentRun,
            settlementBatch: null,
            entries,
            issues,
          }
        : null;
    }),
    create: jest.fn(async ({ data }: any) => {
      currentRun = {
        id: "run-1",
        ...data,
        matchedCount: data.matchedCount ?? 0,
        pendingCount: data.pendingCount ?? 0,
        mismatchCount: data.mismatchCount ?? 0,
        startedAt: new Date(),
        completedAt: null,
        failureCode: null,
        failureMessage: null,
        metadata: data.metadata ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return currentRun;
    }),
    update: jest.fn(async ({ data }: any) => {
      currentRun = { ...currentRun, ...data, updatedAt: new Date() };
      return currentRun;
    }),
    updateMany: jest.fn(async ({ data }: any) => {
      currentRun = { ...currentRun, ...data, updatedAt: new Date() };
      return { count: 1 };
    }),
    findMany: jest.fn(async () => (currentRun ? [currentRun] : [])),
  };

  const settlementBatch = {
    findFirst: jest.fn().mockResolvedValue(null),
    findUnique: jest.fn(async () => options.settlementBatch ?? null),
    create: jest.fn(),
  };

  const prisma = {
    branch: {
      findUnique: jest.fn().mockResolvedValue({
        id: "branch-1",
        companyId: "company-1",
      }),
    },
    onlinePaymentIntent: {
      findMany: jest.fn().mockResolvedValue(payments),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    onlinePaymentOperation: {
      findMany: jest.fn().mockResolvedValue(operations),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    onlinePaymentReconciliationRun: reconciliationRun,
    onlinePaymentReconciliationEntry: {
      deleteMany: jest.fn(async () => {
        entries.splice(0, entries.length);
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }: any) => {
        const entry = {
          id: `entry-${entries.length + 1}`,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        entries.push(entry);
        return entry;
      }),
    },
    onlinePaymentReconciliationIssue: {
      deleteMany: jest.fn(async () => {
        issues.splice(0, issues.length);
        return { count: 1 };
      }),
      create: jest.fn(async ({ data }: any) => {
        const issue = {
          id: `issue-${issues.length + 1}`,
          ...data,
          detectedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        issues.push(issue);
        currentIssue = issue;
        return issue;
      }),
      findMany: jest.fn(async () => issues),
      findUnique: jest.fn(async () => currentIssue),
      update: jest.fn(async ({ data }: any) => {
        currentIssue = { ...currentIssue, ...data, updatedAt: new Date() };
        return currentIssue;
      }),
    },
    onlinePaymentSettlementBatch: settlementBatch,
    $transaction: jest.fn(async (callback: any) => callback(prisma)),
  };

  const configService = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "onlinePayments.settlementReconciliation.maxEntriesPerRun") {
        return 500;
      }

      if (key === "onlinePayments.settlementReconciliation.maxScopesPerTick") {
        return 50;
      }

      return fallback;
    }),
  };
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };
  const paymobPaymentProviderService = {
    inquireTransactionById: jest
      .fn()
      .mockResolvedValue(providerState(options.providerState)),
  };
  const service = new PaymentReconciliationService(
    prisma as never,
    configService as never,
    auditService as never,
    paymobPaymentProviderService as never,
  );

  return {
    service,
    prisma,
    auditService,
    paymobPaymentProviderService,
    entries,
    issues,
    getRun: () => currentRun,
    setIssue: (issue: any) => {
      currentIssue = issue;
    },
  };
}

describe("PaymentReconciliationService", () => {
  it("marks a settled Paymob sale matched and records provider fees", async () => {
    const { service, getRun, entries, issues } = createHarness();

    const result = await service.runPaymobProviderReconciliation(
      "branch-1",
      "staff-1",
      {
        periodStart,
        periodEnd,
        currency: "egp",
        idempotencyKey: "reconcile-1",
      },
    );

    expect(getRun()).toMatchObject({
      status: OnlinePaymentReconciliationRunStatus.matched,
      localGrossMinor: 12500,
      localAdjustmentMinor: 0,
      localNetBeforeFeesMinor: 12500,
      providerGrossMinor: 12500,
      providerAdjustmentMinor: 0,
      providerFeeMinor: 250,
      providerNetMinor: 12250,
      matchedCount: 1,
      pendingCount: 0,
      mismatchCount: 0,
    });
    expect(entries[0]).toMatchObject({
      movementType: OnlinePaymentReconciliationMovementType.sale,
      matchStatus: OnlinePaymentReconciliationMatchStatus.matched,
      providerSettled: true,
      providerFeeMinor: 250,
    });
    expect(issues).toHaveLength(0);
    expect(result.status).toBe(OnlinePaymentReconciliationRunStatus.matched);
  });

  it("keeps a correct provider transaction pending until Paymob reports it settled", async () => {
    const { service, getRun, issues } = createHarness({
      providerState: { providerSettled: false },
    });

    await service.runPaymobProviderReconciliation("branch-1", undefined, {
      periodStart,
      periodEnd,
      currency: "EGP",
      idempotencyKey: "reconcile-pending",
    });

    expect(getRun()).toMatchObject({
      status: OnlinePaymentReconciliationRunStatus.pending,
      matchedCount: 0,
      pendingCount: 1,
      mismatchCount: 0,
    });
    expect(issues).toHaveLength(0);
  });

  it("re-runs the same pending daily reconciliation until provider settlement becomes matched", async () => {
    const { service, getRun, entries, paymobPaymentProviderService, prisma } =
      createHarness();

    paymobPaymentProviderService.inquireTransactionById
      .mockReset()
      .mockResolvedValueOnce(providerState({ providerSettled: false }))
      .mockResolvedValueOnce(providerState({ providerSettled: true }));

    await service.runPaymobProviderReconciliation("branch-1", undefined, {
      periodStart,
      periodEnd,
      currency: "EGP",
      idempotencyKey: "daily-paymob-settlement:2026-08-27:branch-1:EGP",
    });

    expect(getRun().status).toBe(OnlinePaymentReconciliationRunStatus.pending);

    const second = await service.runPaymobProviderReconciliation(
      "branch-1",
      undefined,
      {
        periodStart,
        periodEnd,
        currency: "EGP",
        idempotencyKey: "daily-paymob-settlement:2026-08-27:branch-1:EGP",
      },
    );

    expect(
      prisma.onlinePaymentReconciliationEntry.deleteMany,
    ).toHaveBeenCalledWith({
      where: { reconciliationRunId: "run-1" },
    });
    expect(entries).toHaveLength(1);
    expect(getRun()).toMatchObject({
      status: OnlinePaymentReconciliationRunStatus.matched,
      matchedCount: 1,
      pendingCount: 0,
      mismatchCount: 0,
    });
    expect(second.status).toBe(OnlinePaymentReconciliationRunStatus.matched);
  });

  it("opens a mismatch issue when provider amount differs from Balcona", async () => {
    const { service, getRun, issues } = createHarness({
      providerState: { amountMinor: 9900 },
    });

    await service.runPaymobProviderReconciliation("branch-1", "staff-1", {
      periodStart,
      periodEnd,
      currency: "EGP",
      idempotencyKey: "reconcile-mismatch",
    });

    expect(getRun()).toMatchObject({
      status: OnlinePaymentReconciliationRunStatus.mismatch,
      mismatchCount: 1,
    });
    expect(issues[0]).toMatchObject({
      type: OnlinePaymentReconciliationIssueType.amount_mismatch,
      status: OnlinePaymentReconciliationIssueStatus.open,
    });
  });

  it("rejects a settlement import whose declared totals do not match its lines", async () => {
    const { service, prisma } = createHarness();

    await expect(
      service.importSettlementBatch("branch-1", "staff-1", {
        externalReference: "SET-2026-08-27",
        periodStart,
        periodEnd,
        currency: "EGP",
        grossMinor: 12500,
        adjustmentMinor: 0,
        feeMinor: 100,
        netMinor: 12400,
        lines: [
          {
            providerTransactionId: "555001",
            movementType: OnlinePaymentReconciliationMovementType.sale,
            amountMinor: 12500,
            feeMinor: 250,
            netMinor: 12250,
            currency: "EGP",
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.onlinePaymentSettlementBatch.create).not.toHaveBeenCalled();
  });

  it("matches a normalized settlement statement including fee and net totals", async () => {
    const batch = {
      id: "batch-1",
      companyId: "company-1",
      branchId: "branch-1",
      provider: OnlinePaymentProvider.paymob,
      externalReference: "SET-1",
      payoutReference: "BANK-1",
      currency: "EGP",
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      settledAt: new Date("2026-08-28T09:00:00.000Z"),
      grossMinor: 12500,
      adjustmentMinor: 0,
      feeMinor: 250,
      netMinor: 12250,
      sourceHash: "source-hash",
      importedByStaffUserId: "staff-1",
      lines: [
        {
          id: "line-1",
          settlementBatchId: "batch-1",
          providerTransactionId: "555001",
          movementType: OnlinePaymentReconciliationMovementType.sale,
          amountMinor: 12500,
          feeMinor: 250,
          netMinor: 12250,
          currency: "EGP",
          settlementReference: "20260828",
          settledAt: new Date("2026-08-28T09:00:00.000Z"),
          metadata: null,
          createdAt: new Date(),
        },
      ],
    };
    const { service, getRun, issues } = createHarness({
      settlementBatch: batch,
    });

    await service.reconcileSettlementBatch("batch-1", "staff-1");

    expect(getRun()).toMatchObject({
      source: OnlinePaymentReconciliationSource.settlement_statement,
      status: OnlinePaymentReconciliationRunStatus.matched,
      providerGrossMinor: 12500,
      providerFeeMinor: 250,
      providerNetMinor: 12250,
      matchedCount: 1,
      mismatchCount: 0,
    });
    expect(issues).toHaveLength(0);
  });

  it("matches Fawry sale and refund statement lines that share the same Fawry reference", async () => {
    const fawrySale = {
      id: "intent-fawry-1",
      amountMinor: 12500,
      currency: "EGP",
      succeededAt: new Date("2026-08-27T10:00:00.000Z"),
      metadata: { fawryRefNumber: "987654321" },
    };
    const fawryRefund = {
      id: "operation-fawry-refund-1",
      onlinePaymentIntentId: "intent-fawry-1",
      type: OnlinePaymentOperationType.refund,
      amountMinor: 5000,
      currency: "EGP",
      parentProviderTransactionId: "987654321",
      providerTransactionId: null,
      completedAt: new Date("2026-08-27T14:00:00.000Z"),
      onlinePaymentIntent: {
        succeededAt: fawrySale.succeededAt,
      },
    };
    const batch = {
      id: "batch-fawry-1",
      companyId: "company-1",
      branchId: "branch-1",
      provider: OnlinePaymentProvider.fawry,
      externalReference: "FAWRY-SET-1",
      payoutReference: "BANK-FAWRY-1",
      currency: "EGP",
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      settledAt: new Date("2026-08-28T09:00:00.000Z"),
      grossMinor: 12500,
      adjustmentMinor: 5000,
      feeMinor: 250,
      netMinor: 7250,
      sourceHash: "fawry-source-hash",
      importedByStaffUserId: "staff-1",
      lines: [
        {
          id: "fawry-sale-line",
          settlementBatchId: "batch-fawry-1",
          providerTransactionId: "987654321",
          movementType: OnlinePaymentReconciliationMovementType.sale,
          amountMinor: 12500,
          feeMinor: 250,
          netMinor: 12250,
          currency: "EGP",
          settlementReference: "FAWRY-BATCH-1",
          settledAt: new Date("2026-08-28T09:00:00.000Z"),
          metadata: null,
          createdAt: new Date(),
        },
        {
          id: "fawry-refund-line",
          settlementBatchId: "batch-fawry-1",
          providerTransactionId: "987654321",
          movementType: OnlinePaymentReconciliationMovementType.refund,
          amountMinor: 5000,
          feeMinor: 0,
          netMinor: -5000,
          currency: "EGP",
          settlementReference: "FAWRY-BATCH-1",
          settledAt: new Date("2026-08-28T09:00:00.000Z"),
          metadata: null,
          createdAt: new Date(),
        },
      ],
    };
    const { service, getRun, entries, issues } = createHarness({
      payments: [fawrySale],
      operations: [fawryRefund],
      settlementBatch: batch,
    });

    await service.reconcileSettlementBatch("batch-fawry-1", "staff-1");

    expect(getRun()).toMatchObject({
      provider: OnlinePaymentProvider.fawry,
      source: OnlinePaymentReconciliationSource.settlement_statement,
      status: OnlinePaymentReconciliationRunStatus.matched,
      localGrossMinor: 12500,
      localAdjustmentMinor: 5000,
      localNetBeforeFeesMinor: 7500,
      providerGrossMinor: 12500,
      providerAdjustmentMinor: 5000,
      providerFeeMinor: 250,
      providerNetMinor: 7250,
      matchedCount: 2,
      mismatchCount: 0,
    });
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: OnlinePaymentProvider.fawry,
          providerTransactionId: "987654321",
          movementType: OnlinePaymentReconciliationMovementType.sale,
          matchStatus: OnlinePaymentReconciliationMatchStatus.matched,
        }),
        expect.objectContaining({
          provider: OnlinePaymentProvider.fawry,
          providerTransactionId: "987654321",
          movementType: OnlinePaymentReconciliationMovementType.refund,
          matchStatus: OnlinePaymentReconciliationMatchStatus.matched,
        }),
      ]),
    );
    expect(issues).toHaveLength(0);
  });

  it("audits acknowledgement and resolution of a reconciliation issue", async () => {
    const { service, auditService, setIssue } = createHarness();
    setIssue({
      id: "issue-1",
      reconciliationRunId: "run-1",
      reconciliationEntryId: null,
      companyId: "company-1",
      branchId: "branch-1",
      provider: OnlinePaymentProvider.paymob,
      type: OnlinePaymentReconciliationIssueType.statement_total_mismatch,
      status: OnlinePaymentReconciliationIssueStatus.open,
      message: "Mismatch",
      details: null,
      resolutionNote: null,
    });

    const acknowledged = await service.acknowledgeIssue("issue-1", "staff-1", {
      note: "checking statement",
    });
    const resolved = await service.resolveIssue("issue-1", "staff-1", {
      note: "provider statement corrected",
    });

    expect(acknowledged.status).toBe(
      OnlinePaymentReconciliationIssueStatus.acknowledged,
    );
    expect(resolved.status).toBe(
      OnlinePaymentReconciliationIssueStatus.resolved,
    );
    expect(auditService.recordAuditLog).toHaveBeenCalledTimes(2);
  });
});
