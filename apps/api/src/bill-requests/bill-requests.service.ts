import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  BillRequestActorType,
  BillRequestEventType,
  BillRequestStatus,
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  Prisma,
  TableSessionStatus,
} from "@prisma/client";
import { TableAttentionService } from "../autopilot/table-attention.service";
import {
  BillRequestBillPresentMutationResult,
  BillsService,
} from "../bills/bills.service";
import { PresenceNotificationsService } from "../presence-notifications/presence-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { BillStaffActionDto } from "./dto/bill-staff-action.dto";
import { BranchBillRequestsQueryDto } from "./dto/branch-bill-requests-query.dto";
import { CancelBillRequestDto } from "./dto/cancel-bill-request.dto";
import { RequestBillDto } from "./dto/request-bill.dto";

const ACTIVE_BILL_REQUEST_STATUSES: BillRequestStatus[] = [
  BillRequestStatus.open,
  BillRequestStatus.acknowledged,
  BillRequestStatus.presented,
];
const BILLABLE_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.served,
  OrderStatus.completed,
];
const DEFAULT_BRANCH_BILL_REQUEST_LIMIT = 50;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;
type RequestBillFailureStage =
  | "validation"
  | "billable_orders_lookup"
  | "bill_request_create"
  | "order_events"
  | "bill_compact_create"
  | "post_commit"
  | "response_mapping";
type RequestBillLogContext = {
  action: "request_bill";
  sessionId: string;
  companyId?: string;
  branchId?: string;
  billRequestId?: string;
  failureStage?: RequestBillFailureStage;
};
type RequestBillTransactionResult = {
  billRequestId: string;
  tableSessionId: string;
  companyId: string;
  branchId: string;
  billableOrderIds: string[];
  shouldRunPostCommitSideEffects: boolean;
};
type BillStaffActionPostCommitAction = "acknowledged" | "presented";
type BillStaffActionTransactionResult = {
  billRequestId: string;
  billId?: string;
  billCreated?: boolean;
  billPresented?: boolean;
  tableSessionId: string;
  postCommitAction: BillStaffActionPostCommitAction;
};
type BillPresentFailureStage =
  | "bill_ensure"
  | "validation"
  | "bill_request_present"
  | "bill_present"
  | "post_commit"
  | "response_mapping";
type BillPresentTimings = {
  billEnsureMs: number;
  staffAssertMs: number;
  requestLookupMs: number;
  requestUpdateMs: number;
  requestEventMs: number;
  billPresentMs: number;
  presentTransactionMs: number;
  postCommitScheduledMs: number;
  responseMappingMs: number;
};
type BillPresentLogContext = {
  flow: "bill_request_present";
  action: "present";
  billRequestId: string;
  billId?: string;
  tableSessionId?: string;
  failureStage?: BillPresentFailureStage;
  slowStage?: string;
  durationMs?: number;
  timings?: BillPresentTimings;
};

@Injectable()
export class BillRequestsService {
  private readonly logger = new Logger(BillRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly tableAttentionService: TableAttentionService,
    private readonly billsService: BillsService,
  ) {}

  async requestBill(sessionId: string, body: RequestBillDto = {}) {
    const context: RequestBillLogContext = {
      action: "request_bill",
      sessionId,
    };
    let stage: RequestBillFailureStage = "validation";
    let transactionResult: RequestBillTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
        const tableSession = await this.findTableSessionOrThrow(sessionId, tx);

        context.companyId = tableSession.companyId;
        context.branchId = tableSession.branchId;
        this.assertBillRequestableSession(tableSession.status);

        const activeBillRequest = await this.findActiveBillRequest(
          sessionId,
          tx,
        );

        if (activeBillRequest) {
          context.billRequestId = activeBillRequest.id;

          return {
            billRequestId: activeBillRequest.id,
            tableSessionId: tableSession.id,
            companyId: tableSession.companyId,
            branchId: tableSession.branchId,
            billableOrderIds: [],
            shouldRunPostCommitSideEffects: false,
          } satisfies RequestBillTransactionResult;
        }

        stage = "billable_orders_lookup";
        const billableOrders = await this.findBillableOrders(sessionId, tx);
        const totals = this.getBillableTotals(billableOrders);

        if (totals.orderCount === 0) {
          throw new BadRequestException(
            "Table session has no accepted, preparing, ready, served, or completed orders to bill",
          );
        }

        const note = this.normalizeOptionalText(body.note);
        stage = "bill_request_create";
        const billRequest = await tx.billRequest.create({
          data: {
            companyId: tableSession.companyId,
            branchId: tableSession.branchId,
            tableSessionId: tableSession.id,
            status: BillRequestStatus.open,
            currency: totals.currency,
            subtotalMinor: totals.subtotalMinor,
            orderCount: totals.orderCount,
            requestedByActorType: BillRequestActorType.customer,
            note,
            events: {
              create: {
                type: BillRequestEventType.created,
                actorType: BillRequestActorType.customer,
                metadata: {
                  subtotalMinor: totals.subtotalMinor,
                  orderCount: totals.orderCount,
                  currency: totals.currency,
                  ...(note ? { note } : {}),
                },
              },
            },
          },
          select: { id: true },
        });

        context.billRequestId = billRequest.id;

        return {
          billRequestId: billRequest.id,
          tableSessionId: tableSession.id,
          companyId: tableSession.companyId,
          branchId: tableSession.branchId,
          billableOrderIds: billableOrders.map((order) => order.id),
          shouldRunPostCommitSideEffects: true,
        } satisfies RequestBillTransactionResult;
      });
    } catch (error) {
      throw this.toRequestBillError(error, {
        ...context,
        failureStage: stage,
      });
    }

    if (transactionResult.shouldRunPostCommitSideEffects) {
      this.scheduleBillRequestedPostCommitSideEffects(transactionResult);
    }

    try {
      return await this.getBillRequestResponse(
        transactionResult.billRequestId,
        this.prisma,
      );
    } catch (error) {
      throw this.toRequestBillError(error, {
        ...context,
        billRequestId: transactionResult.billRequestId,
        companyId: transactionResult.companyId,
        branchId: transactionResult.branchId,
        failureStage: "response_mapping",
      });
    }
  }

  private async createOrderBillRequestedEvents(
    input: RequestBillTransactionResult,
  ) {
    for (const orderId of input.billableOrderIds) {
      await this.prisma.orderEvent.create({
        data: {
          orderId,
          type: OrderEventType.bill_requested,
          actorType: OrderEventActorType.customer,
          metadata: {
            billRequestId: input.billRequestId,
            tableSessionId: input.tableSessionId,
          },
        },
      });
    }
  }

  async findForTableSession(sessionId: string) {
    const tableSession = await this.findTableSessionOrThrow(
      sessionId,
      this.prisma,
    );
    const [activeBillRequest, latestBillRequests, billableOrders] =
      await Promise.all([
        this.findActiveBillRequest(sessionId, this.prisma),
        this.prisma.billRequest.findMany({
          where: { tableSessionId: sessionId },
          orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
          take: 5,
          include: this.billRequestListInclude(),
        }),
        this.findBillableOrders(sessionId, this.prisma),
      ]);
    const billState = await this.billsService.findForTableSession(sessionId);

    return {
      tableSession: this.toTableSessionResponse(tableSession),
      activeBillRequest: activeBillRequest
        ? await this.toBillRequestListItem(activeBillRequest, this.prisma)
        : null,
      latestBillRequests: latestBillRequests.map((billRequest) =>
        this.toBillRequestListItemFromRecord(billRequest),
      ),
      billableOrders: billableOrders.map((order) =>
        this.toBillableOrderSummary(order),
      ),
      totals: this.getBillableTotals(billableOrders, false),
      ...billState,
    };
  }

  async findForBranch(
    branchId: string,
    query: BranchBillRequestsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const status = query.status ?? "active";
    const billRequests = await this.prisma.billRequest.findMany({
      where: {
        branchId,
        ...this.billRequestStatusWhere(status),
      },
      orderBy: [{ requestedAt: "asc" }, { createdAt: "asc" }],
      take: this.normalizeLimit(query.limit),
      include: this.billRequestListInclude(),
    });

    return {
      branch,
      filters: {
        status,
        limit: this.normalizeLimit(query.limit),
      },
      billRequests: billRequests.map((billRequest) =>
        this.toBillRequestListItemFromRecord(billRequest),
      ),
    };
  }

  async findOne(billRequestId: string) {
    return this.getBillRequestResponse(billRequestId, this.prisma);
  }

  async acknowledge(billRequestId: string, body: BillStaffActionDto = {}) {
    const transactionResult = await this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const billRequest = await this.findBillRequestStatusOrThrow(
        billRequestId,
        tx,
      );

      if (billRequest.status !== BillRequestStatus.open) {
        throw new BadRequestException(
          "Only open bill requests can be acknowledged",
        );
      }

      const note = this.normalizeOptionalText(body.note);
      const now = new Date();

      await tx.billRequest.update({
        where: { id: billRequest.id },
        data: {
          status: BillRequestStatus.acknowledged,
          acknowledgedAt: now,
          acknowledgedByStaffUserId: body.staffUserId,
        },
      });
      await this.createBillRequestEvent(
        billRequest.id,
        BillRequestEventType.acknowledged,
        body.staffUserId,
        note ? { note } : undefined,
        tx,
      );

      return {
        billRequestId: billRequest.id,
        tableSessionId: billRequest.tableSessionId,
        postCommitAction: "acknowledged",
      } satisfies BillStaffActionTransactionResult;
    });

    this.scheduleBillStaffActionPostCommitSideEffects(transactionResult);

    return this.getBillRequestResponse(
      transactionResult.billRequestId,
      this.prisma,
    );
  }

  async present(billRequestId: string, body: BillStaffActionDto = {}) {
    const startedAt = Date.now();
    const note = this.normalizeOptionalText(body.note);
    const timings: BillPresentTimings = {
      billEnsureMs: 0,
      staffAssertMs: 0,
      requestLookupMs: 0,
      requestUpdateMs: 0,
      requestEventMs: 0,
      billPresentMs: 0,
      presentTransactionMs: 0,
      postCommitScheduledMs: 0,
      responseMappingMs: 0,
    };
    const context: BillPresentLogContext = {
      flow: "bill_request_present",
      action: "present",
      billRequestId,
    };
    let ensuredBill: Awaited<
      ReturnType<BillsService["ensureBillForBillRequestCompact"]>
    >;

    try {
      const billEnsureStartedAt = Date.now();
      ensuredBill = await this.billsService.ensureBillForBillRequestCompact(
        billRequestId,
        { actorType: "staff" },
      );
      timings.billEnsureMs = Date.now() - billEnsureStartedAt;
      context.billId = ensuredBill.billId;
      context.tableSessionId = ensuredBill.tableSessionId;
      this.logger.log({
        message: "bill_request.present.bill_ensure",
        billRequestId,
        billId: ensuredBill.billId,
        tableSessionId: ensuredBill.tableSessionId,
        created: ensuredBill.created,
        durationMs: timings.billEnsureMs,
      });
    } catch (error) {
      throw this.toBillPresentError(error, {
        ...context,
        failureStage: "bill_ensure",
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }

    let stage: BillPresentFailureStage = "validation";
    let transactionResult: BillStaffActionTransactionResult;

    try {
      const transactionStartedAt = Date.now();
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
        let stageStartedAt = Date.now();
        await this.assertStaffUserExists(body.staffUserId, tx);
        timings.staffAssertMs += Date.now() - stageStartedAt;

        stageStartedAt = Date.now();
        const billRequest = await this.findBillRequestStatusOrThrow(
          billRequestId,
          tx,
        );
        timings.requestLookupMs += Date.now() - stageStartedAt;

        context.tableSessionId = billRequest.tableSessionId;

        if (
          billRequest.status !== BillRequestStatus.open &&
          billRequest.status !== BillRequestStatus.acknowledged
        ) {
          throw new BadRequestException(
            "Only open or acknowledged bill requests can be presented",
          );
        }

        const now = new Date();

        stage = "bill_request_present";
        stageStartedAt = Date.now();
        await tx.billRequest.update({
          where: { id: billRequest.id },
          data: {
            status: BillRequestStatus.presented,
            presentedAt: now,
            presentedByStaffUserId: body.staffUserId,
          },
        });
        timings.requestUpdateMs += Date.now() - stageStartedAt;

        stageStartedAt = Date.now();
        await this.createBillRequestEvent(
          billRequest.id,
          BillRequestEventType.presented,
          body.staffUserId,
          note ? { note } : undefined,
          tx,
        );
        timings.requestEventMs += Date.now() - stageStartedAt;

        stage = "bill_present";
        stageStartedAt = Date.now();
        const bill: BillRequestBillPresentMutationResult =
          await this.billsService.presentExistingBillCompact(
            ensuredBill.billId,
            {
              staffUserId: body.staffUserId,
              note: note ?? undefined,
              billCreated: ensuredBill.created,
              billRequestId: ensuredBill.billRequestId,
            },
            tx,
          );
        timings.billPresentMs += Date.now() - stageStartedAt;
        timings.presentTransactionMs = Date.now() - transactionStartedAt;

        return {
          billRequestId: billRequest.id,
          billId: bill.billId,
          billCreated: bill.created,
          billPresented: bill.presented,
          tableSessionId: billRequest.tableSessionId,
          postCommitAction: "presented",
        } satisfies BillStaffActionTransactionResult;
      });
      timings.presentTransactionMs = Date.now() - transactionStartedAt;
    } catch (error) {
      throw this.toBillPresentError(error, {
        ...context,
        billId: ensuredBill.billId,
        failureStage: stage,
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }

    this.logger.log({
      message: "bill_request.present.critical_transaction",
      billRequestId: transactionResult.billRequestId,
      billId: transactionResult.billId,
      tableSessionId: transactionResult.tableSessionId,
      billCreated: transactionResult.billCreated,
      billPresented: transactionResult.billPresented,
      durationMs: timings.presentTransactionMs,
      slowStage: this.slowestTimingStage(timings),
      timings,
    });

    const postCommitStartedAt = Date.now();
    this.scheduleBillStaffActionPostCommitSideEffects(transactionResult);
    timings.postCommitScheduledMs = Date.now() - postCommitStartedAt;

    try {
      const responseStartedAt = Date.now();
      const response = await this.getBillRequestResponse(
        transactionResult.billRequestId,
        this.prisma,
      );
      timings.responseMappingMs = Date.now() - responseStartedAt;
      this.logger.log({
        message: "bill_request.present.response_ready",
        billRequestId: transactionResult.billRequestId,
        billId: transactionResult.billId,
        tableSessionId: transactionResult.tableSessionId,
        durationMs: Date.now() - startedAt,
        slowStage: this.slowestTimingStage(timings),
        timings,
      });

      return response;
    } catch (error) {
      throw this.toBillPresentError(error, {
        ...context,
        billId: transactionResult.billId,
        tableSessionId: transactionResult.tableSessionId,
        failureStage: "response_mapping",
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }
  }

  async close(billRequestId: string, body: BillStaffActionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const billRequest = await this.findBillRequestStatusOrThrow(
        billRequestId,
        tx,
      );

      if (!ACTIVE_BILL_REQUEST_STATUSES.includes(billRequest.status)) {
        throw new BadRequestException(
          "Only open, acknowledged, or presented bill requests can be closed",
        );
      }

      const note = this.normalizeOptionalText(body.note);
      await this.billsService.closePaidBillForBillRequest(
        billRequest.id,
        body.staffUserId,
        note,
        tx,
      );
      await this.recalculateAttention(
        billRequest.tableSessionId,
        tx,
        "bill_closed",
        { billRequestId: billRequest.id },
      );

      return this.getBillRequestResponse(billRequest.id, tx);
    });
  }

  async cancel(billRequestId: string, body: CancelBillRequestDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const billRequest = await this.findBillRequestStatusOrThrow(
        billRequestId,
        tx,
      );

      if (
        billRequest.status === BillRequestStatus.closed ||
        billRequest.status === BillRequestStatus.cancelled
      ) {
        throw new BadRequestException(
          "Closed or cancelled bill requests cannot be cancelled",
        );
      }

      const reason = this.normalizeOptionalText(body.reason);
      const now = new Date();

      await this.billsService.cancelLinkedUnpaidBillForBillRequest(
        billRequest.id,
        body.staffUserId,
        reason,
        tx,
      );
      await tx.billRequest.update({
        where: { id: billRequest.id },
        data: {
          status: BillRequestStatus.cancelled,
          cancelledAt: now,
          cancelledByStaffUserId: body.staffUserId,
          cancellationReason: reason,
        },
      });
      await this.createBillRequestEvent(
        billRequest.id,
        BillRequestEventType.cancelled,
        body.staffUserId,
        reason ? { reason } : undefined,
        tx,
      );
      await this.realtimeEventsService.recordBillCancelled(billRequest.id, tx);
      await this.recalculateAttention(
        billRequest.tableSessionId,
        tx,
        "bill_cancelled",
        { billRequestId: billRequest.id },
      );

      return this.getBillRequestResponse(billRequest.id, tx);
    });
  }

  private scheduleBillRequestedPostCommitSideEffects(
    input: RequestBillTransactionResult,
  ) {
    void this.runBillRequestedPostCommitSideEffects(input).catch((error) => {
      this.logger.warn({
        message:
          "Bill request post-commit side effect scheduler failed; committed bill request remains source of truth",
        billRequestId: input.billRequestId,
        tableSessionId: input.tableSessionId,
        exception: this.safeExceptionSummary(error),
      });
    });
  }

  private async runBillRequestedPostCommitSideEffects(
    input: RequestBillTransactionResult,
  ) {
    const billRequestedSteps: Array<{ stage: string; run: () => Promise<unknown> }> =
      input.shouldRunPostCommitSideEffects
        ? [
            {
              stage: "order_events",
              run: () => this.createOrderBillRequestedEvents(input),
            },
            {
              stage: "presence_notification",
              run: () =>
                this.presenceNotificationsService.createBillRequestedNotification(
                  input.billRequestId,
                  this.prisma,
                ),
            },
            {
              stage: "realtime_event",
              run: () =>
                this.realtimeEventsService.recordBillRequested(
                  input.billRequestId,
                  this.prisma,
                ),
            },
            {
              stage: "table_attention",
              run: () =>
                this.tableAttentionService.recalculateForTableSession(
                  input.tableSessionId,
                  this.prisma,
                  {
                    source: "bill_requested",
                    metadata: { billRequestId: input.billRequestId },
                  },
                ),
            },
          ]
        : [];
    const steps: Array<{ stage: string; run: () => Promise<unknown> }> = [
      ...billRequestedSteps,
    ];

    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        this.logger.warn({
          message:
            "Bill request post-commit side effect failed; committed bill request remains source of truth",
          stage: step.stage,
          billRequestId: input.billRequestId,
          tableSessionId: input.tableSessionId,
          exception: this.safeExceptionSummary(error),
        });
      }
    }
  }

  private toRequestBillError(
    error: unknown,
    context: RequestBillLogContext,
  ) {
    const statusCode =
      error instanceof HttpException ? error.getStatus() : undefined;
    const exception = this.safeExceptionSummary(error);
    const payload = {
      message: "Bill request failed",
      ...context,
      statusCode,
      exception,
    };

    if (error instanceof HttpException && statusCode && statusCode < 500) {
      this.logger.warn(payload);

      return error;
    }

    this.logger.error(payload);

    if (
      exception.code === "P2028" ||
      exception.message?.includes("Transaction already closed")
    ) {
      return new InternalServerErrorException({
        message: "The operation timed out while saving. Please retry.",
        code: "DB_TRANSACTION_TIMEOUT",
        details: {
          flow: "bill_request",
          action: context.action,
          sessionId: context.sessionId,
          companyId: context.companyId,
          branchId: context.branchId,
          billRequestId: context.billRequestId,
          failureStage: context.failureStage,
          exception,
        },
      });
    }

    return error;
  }

  private toBillPresentError(
    error: unknown,
    context: BillPresentLogContext,
  ) {
    const statusCode =
      error instanceof HttpException ? error.getStatus() : undefined;
    const exception = this.safeExceptionSummary(error);
    const payload = {
      message: "Bill request present failed",
      ...context,
      statusCode,
      exception,
    };

    if (error instanceof HttpException && statusCode && statusCode < 500) {
      this.logger.warn(payload);

      return error;
    }

    this.logger.error(payload);

    if (
      exception.code === "P2028" ||
      exception.message?.includes("Transaction already closed")
    ) {
      return new InternalServerErrorException({
        message: "The operation timed out while saving. Please retry.",
        code: "DB_TRANSACTION_TIMEOUT",
        details: {
          flow: context.flow,
          action: context.action,
          billRequestId: context.billRequestId,
          billId: context.billId,
          tableSessionId: context.tableSessionId,
          failureStage: context.failureStage,
          slowStage: context.slowStage ?? context.failureStage,
          durationMs: context.durationMs,
          timings: context.timings,
          exception,
        },
      });
    }

    return error;
  }

  private slowestTimingStage(timings: object) {
    const [stage, durationMs] = Object.entries(timings).reduce<
      [string, number]
    >(
      (slowest, [currentStage, currentDuration]) =>
        (typeof currentDuration === "number" ? currentDuration : 0) >
        slowest[1]
          ? [
              currentStage,
              typeof currentDuration === "number" ? currentDuration : 0,
            ]
          : slowest,
      ["unknown", 0],
    );

    return durationMs > 0 ? stage : undefined;
  }

  private scheduleBillStaffActionPostCommitSideEffects(
    input: BillStaffActionTransactionResult,
  ) {
    void this.runBillStaffActionPostCommitSideEffects(input).catch((error) => {
      this.logger.warn({
        message:
          "Bill request staff post-commit side effect scheduler failed; committed bill request status remains source of truth",
        action: input.postCommitAction,
        billRequestId: input.billRequestId,
        tableSessionId: input.tableSessionId,
        exception: this.safeExceptionSummary(error),
      });
    });
  }

  private async runBillStaffActionPostCommitSideEffects(
    input: BillStaffActionTransactionResult,
  ) {
    const steps = this.billStaffActionPostCommitSteps(input);

    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        this.logger.warn({
          message:
            "Bill request staff post-commit side effect failed; committed bill request status remains source of truth",
          action: input.postCommitAction,
          stage: step.stage,
          billRequestId: input.billRequestId,
          tableSessionId: input.tableSessionId,
          exception: this.safeExceptionSummary(error),
        });
      }
    }
  }

  private billStaffActionPostCommitSteps(
    input: BillStaffActionTransactionResult,
  ): Array<{ stage: string; run: () => Promise<unknown> }> {
    const billRequestId = input.billRequestId;
    const tableSessionId = input.tableSessionId;
    const steps: Array<{ stage: string; run: () => Promise<unknown> }> = [];

    if (input.postCommitAction === "presented") {
      if (input.billCreated && input.billId) {
        steps.push({
          stage: "bill_created_realtime",
          run: () =>
            this.realtimeEventsService.recordBillCreated(
              input.billId as string,
              this.prisma,
            ),
        });
      }

      if (input.billPresented && input.billId) {
        steps.push({
          stage: "bill_realtime_event",
          run: () =>
            this.realtimeEventsService.recordBillPresentedForBill(
              input.billId as string,
              this.prisma,
            ),
        });
      }

      steps.push({
        stage: "presence_notification",
        run: () =>
          this.presenceNotificationsService.createBillPresentedNotification(
            billRequestId,
            this.prisma,
          ),
      });
    }

    steps.push({
      stage: "realtime_event",
      run: () =>
        input.postCommitAction === "acknowledged"
          ? this.realtimeEventsService.recordBillAcknowledged(
              billRequestId,
              this.prisma,
            )
          : this.realtimeEventsService.recordBillPresented(
              billRequestId,
              this.prisma,
            ),
    });
    steps.push({
      stage: "table_attention",
      run: () =>
        this.tableAttentionService.recalculateForTableSession(
          tableSessionId,
          this.prisma,
          {
            source:
              input.postCommitAction === "acknowledged"
                ? "bill_acknowledged"
                : "bill_presented",
            metadata: { billRequestId },
          },
        ),
    });

    return steps;
  }

  private async createBillRequestEvent(
    billRequestId: string,
    type: BillRequestEventType,
    staffUserId: string | undefined,
    metadata: Record<string, unknown> | undefined,
    tx: Prisma.TransactionClient,
  ) {
    await tx.billRequestEvent.create({
      data: {
        billRequestId,
        type,
        actorType: staffUserId
          ? BillRequestActorType.staff
          : BillRequestActorType.system,
        actorStaffUserId: staffUserId,
        metadata: metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async findTableSessionOrThrow(sessionId: string, tx: PrismaExecutor) {
    const tableSession = await tx.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionContextSelect(),
    });

    if (!tableSession) {
      throw new NotFoundException("Table session not found");
    }

    return tableSession;
  }

  private async findBillRequestStatusOrThrow(
    billRequestId: string,
    tx: PrismaExecutor,
  ) {
    const billRequest = await tx.billRequest.findUnique({
      where: { id: billRequestId },
      select: {
        id: true,
        tableSessionId: true,
        status: true,
      },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request not found");
    }

    return billRequest;
  }

  private async findActiveBillRequest(sessionId: string, tx: PrismaExecutor) {
    return tx.billRequest.findFirst({
      where: {
        tableSessionId: sessionId,
        status: { in: ACTIVE_BILL_REQUEST_STATUSES },
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
      include: this.billRequestListInclude(),
    });
  }

  private async findBillableOrders(sessionId: string, tx: PrismaExecutor) {
    return tx.order.findMany({
      where: {
        tableSessionId: sessionId,
        status: { in: BILLABLE_ORDER_STATUSES },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currency: true,
        subtotalMinor: true,
        totalQuantity: true,
        itemCount: true,
        submittedAt: true,
        cashierAcceptedAt: true,
        preparingAt: true,
        readyAt: true,
        servedAt: true,
        completedAt: true,
      },
    });
  }

  private async getBillRequestResponse(
    billRequestId: string,
    tx: PrismaExecutor,
  ) {
    const billRequest = await tx.billRequest.findUnique({
      where: { id: billRequestId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
        tableSession: { select: this.tableSessionContextSelect() },
        bill: {
          include: this.billSummaryInclude(),
        },
        events: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request not found");
    }

    const billableOrders = await this.findBillableOrders(
      billRequest.tableSessionId,
      tx,
    );
    const {
      company,
      branch,
      tableSession,
      bill,
      events,
      ...billRequestFields
    } = billRequest;

    return {
      billRequest: billRequestFields,
      company,
      branch,
      tableSession: this.toTableSessionResponse(tableSession),
      bill,
      events: events.map((event) => ({
        id: event.id,
        billRequestId: event.billRequestId,
        type: event.type,
        actorType: event.actorType,
        actorStaffUserId: event.actorStaffUserId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
      billableOrders: billableOrders.map((order) =>
        this.toBillableOrderSummary(order),
      ),
      totals: this.getBillableTotals(billableOrders, false),
    };
  }

  private getBillableTotals(orders: any[], enforceSingleCurrency = true) {
    if (orders.length === 0) {
      return {
        subtotalMinor: 0,
        orderCount: 0,
        currency: "EGP",
      };
    }

    const currency = orders[0].currency;

    if (
      enforceSingleCurrency &&
      orders.some((order) => order.currency !== currency)
    ) {
      throw new BadRequestException(
        "Billable orders must use the same currency",
      );
    }

    return {
      subtotalMinor: orders.reduce(
        (sum, order) => sum + order.subtotalMinor,
        0,
      ),
      orderCount: orders.length,
      currency,
    };
  }

  private billRequestStatusWhere(
    status: NonNullable<BranchBillRequestsQueryDto["status"]>,
  ) {
    if (status === "all") {
      return {};
    }

    if (status === "active") {
      return { status: { in: ACTIVE_BILL_REQUEST_STATUSES } };
    }

    return { status: status as BillRequestStatus };
  }

  private assertBillRequestableSession(status: TableSessionStatus) {
    if (
      status !== TableSessionStatus.active &&
      status !== TableSessionStatus.idle
    ) {
      throw new BadRequestException(
        "Bill can only be requested for active or idle table sessions",
      );
    }
  }

  private async assertStaffUserExists(
    staffUserId: string | undefined,
    tx: PrismaExecutor,
  ) {
    if (!staffUserId) {
      return;
    }

    const staffUser = await tx.staffUser.findUnique({
      where: { id: staffUserId },
      select: { id: true },
    });

    if (!staffUser) {
      throw new NotFoundException("Staff user not found");
    }
  }

  private async recalculateAttention(
    tableSessionId: string,
    tx: PrismaExecutor,
    source: string,
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.tableAttentionService.recalculateForTableSession(
        tableSessionId,
        tx,
        { source, metadata },
      );
    } catch {
      return undefined;
    }
  }

  private async toBillRequestListItem(record: any, tx: PrismaExecutor) {
    const billRequest =
      "tableSession" in record
        ? record
        : await tx.billRequest.findUnique({
            where: { id: record.id },
            include: this.billRequestListInclude(),
          });

    if (!billRequest) {
      throw new NotFoundException("Bill request not found");
    }

    return this.toBillRequestListItemFromRecord(billRequest);
  }

  private toBillRequestListItemFromRecord(record: any) {
    const { tableSession, bill, ...billRequestFields } = record;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      billRequest: billRequestFields,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
      bill,
    };
  }

  private toTableSessionResponse(tableSession: any) {
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      ...tableSessionFields,
      floor,
      table: tableFields,
    };
  }

  private toBillableOrderSummary(order: any) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      totalQuantity: order.totalQuantity,
      itemCount: order.itemCount,
      submittedAt: order.submittedAt,
      cashierAcceptedAt: order.cashierAcceptedAt,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      servedAt: order.servedAt,
      completedAt: order.completedAt,
    };
  }

  private normalizeLimit(limit?: number) {
    return Math.min(
      Math.max(limit ?? DEFAULT_BRANCH_BILL_REQUEST_LIMIT, 1),
      100,
    );
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private safeExceptionSummary(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: this.redactSensitiveText(error.message),
        code: this.stringProperty(error, "code"),
      };
    }

    if (typeof error === "string") {
      return { message: this.redactSensitiveText(error) };
    }

    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;

      return {
        type: record.constructor?.name ?? "object",
        message: this.redactSensitiveText(
          this.stringProperty(record, "message") ??
            this.stringProperty(record, "error") ??
            "Non-error exception",
        ),
        code: this.stringProperty(record, "code"),
      };
    }

    return { type: typeof error };
  }

  private stringProperty(source: object, key: string) {
    const value = (source as Record<string, unknown>)[key];

    return typeof value === "string" ? value : undefined;
  }

  private redactSensitiveText(value: string) {
    return value
      .replace(/bearer\s+[a-z0-9._-]+/gi, "Bearer [redacted]")
      .replace(
        /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)=([^,\s]+)/gi,
        "$1=[redacted]",
      );
  }

  private billRequestListInclude() {
    return {
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      bill: {
        include: this.billSummaryInclude(),
      },
    } satisfies Prisma.BillRequestInclude;
  }

  private billSummaryInclude() {
    return {
      lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      manualPayments: {
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      },
      onlinePaymentIntents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      receipt: true,
    } satisfies Prisma.BillInclude;
  }

  private tableSessionContextSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
      source: true,
      guestLabel: true,
      partySize: true,
      startedAt: true,
      lastSeenAt: true,
      expiresAt: true,
      closedAt: true,
      closeReason: true,
      createdAt: true,
      updatedAt: true,
      table: {
        select: {
          id: true,
          code: true,
          displayName: true,
          capacity: true,
          qrToken: true,
          status: true,
          floor: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
            },
          },
        },
      },
    } satisfies Prisma.TableSessionSelect;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
    };
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    };
  }
}
