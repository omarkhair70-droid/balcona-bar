import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  BillEventType,
  BillPaymentMethod,
  BillRequestActorType,
  BillRequestEventType,
  BillRequestStatus,
  BillStatus,
  ManualPaymentStatus,
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  Prisma,
  TableSessionStatus,
} from "@prisma/client";
import { TableAttentionService } from "../autopilot/table-attention.service";
import { CashierShiftsService } from "../cashier-shifts/cashier-shifts.service";
import { PresenceNotificationsService } from "../presence-notifications/presence-notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { BillActionDto } from "./dto/bill-action.dto";
import { BranchBillsQueryDto } from "./dto/branch-bills-query.dto";
import { CancelBillDto } from "./dto/cancel-bill.dto";
import { RecordManualPaymentDto } from "./dto/record-manual-payment.dto";

const ACTIVE_BILL_STATUSES: BillStatus[] = [
  BillStatus.draft,
  BillStatus.requested,
  BillStatus.presented,
  BillStatus.payment_pending,
];
const PAYABLE_BILL_STATUSES: BillStatus[] = [
  BillStatus.presented,
  BillStatus.payment_pending,
];
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
const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.completed,
  OrderStatus.cashier_rejected,
  OrderStatus.cancelled,
];
const DEFAULT_BRANCH_BILL_LIMIT = 50;
const BILL_NUMBER_PREFIX = "BILL-";
const RECEIPT_NUMBER_PREFIX = "RCPT-";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export interface OnlinePaymentSettlementInput {
  billId: string;
  onlinePaymentIntentId: string;
  provider: OnlinePaymentProvider;
  amountMinor: number;
  providerIntentId?: string | null;
  providerEventId?: string | null;
}

export interface OnlinePaymentSettlementResult {
  settled: boolean;
  reason?: string;
  message?: string;
  billResponse?: unknown;
}

export type BillRequestBillMutationResult = {
  billId: string;
  billRequestId: string;
  tableSessionId: string;
  created: boolean;
};
export type BillRequestBillPresentMutationResult =
  BillRequestBillMutationResult & {
    status: BillStatus;
    presented: boolean;
  };

@Injectable()
export class BillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly tableAttentionService: TableAttentionService,
    private readonly cashierShiftsService: CashierShiftsService,
  ) {}

  async createOrGetBillForBillRequest(
    billRequestId: string,
    options: { actorType?: string; metadata?: Record<string, unknown> } = {},
    tx?: Prisma.TransactionClient,
  ): Promise<any> {
    const run = (client: Prisma.TransactionClient) =>
      this.createOrGetBillForBillRequestInternal(
        billRequestId,
        options,
        client,
      );

    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  async createOrGetBillForBillRequestCompact(
    billRequestId: string,
    options: { actorType?: string; metadata?: Record<string, unknown> } = {},
    tx: Prisma.TransactionClient,
  ): Promise<BillRequestBillMutationResult> {
    return this.createOrGetBillForBillRequestInternal(
      billRequestId,
      options,
      tx,
      { hydrateResponse: false, recordRealtimeEvents: false },
    ) as Promise<BillRequestBillMutationResult>;
  }

  async findForBranch(branchId: string, query: BranchBillsQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const status = query.status ?? "active";
    const bills = await this.prisma.bill.findMany({
      where: {
        branchId,
        ...this.billStatusWhere(status),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: this.normalizeLimit(query.limit),
      include: this.billListInclude(),
    });

    return {
      branch,
      filters: {
        status,
        limit: this.normalizeLimit(query.limit),
      },
      bills: bills.map((bill) => this.toBillListItemFromRecord(bill)),
    };
  }

  async findOne(billId: string) {
    return this.getBillResponse(billId, this.prisma);
  }

  async findReceipt(billId: string) {
    const response = await this.getBillResponse(billId, this.prisma);

    if (!response.receipt) {
      throw new NotFoundException("Bill receipt not found");
    }

    return {
      bill: response.bill,
      company: response.company,
      branch: response.branch,
      tableSession: response.tableSession,
      floor: response.floor,
      table: response.table,
      receipt: response.receipt,
      printableText: response.receipt.printableText,
    };
  }

  async findForTableSession(
    sessionId: string,
    tx: PrismaExecutor = this.prisma,
  ) {
    const bills = await tx.bill.findMany({
      where: { tableSessionId: sessionId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      include: this.billListInclude(),
    });
    const activeBill =
      bills.find((bill) => ACTIVE_BILL_STATUSES.includes(bill.status)) ?? null;
    const latestPaidBill =
      bills.find((bill) => bill.status === BillStatus.paid) ?? null;

    return {
      activeBill: activeBill ? this.toBillListItemFromRecord(activeBill) : null,
      latestBills: bills.map((bill) => this.toBillListItemFromRecord(bill)),
      receipt: latestPaidBill?.receipt ?? activeBill?.receipt ?? null,
    };
  }

  async present(billId: string, body: BillActionDto = {}) {
    return this.prisma.$transaction((tx) =>
      this.presentInternal(billId, body, tx),
    );
  }

  async presentBillForBillRequest(
    billRequestId: string,
    staffUserId: string | undefined,
    note: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const response = await this.createOrGetBillForBillRequest(
      billRequestId,
      { actorType: "staff" },
      tx,
    );

    return this.presentInternal(
      response.bill.id,
      { staffUserId, note: note ?? undefined },
      tx,
    );
  }

  async presentBillForBillRequestCompact(
    billRequestId: string,
    staffUserId: string | undefined,
    note: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<BillRequestBillPresentMutationResult> {
    const bill = await this.createOrGetBillForBillRequestCompact(
      billRequestId,
      { actorType: "staff" },
      tx,
    );

    return this.presentBillCompact(
      bill.billId,
      {
        staffUserId,
        note: note ?? undefined,
        billCreated: bill.created,
        billRequestId: bill.billRequestId,
      },
      tx,
    );
  }

  async recordManualPayment(
    billId: string,
    body: RecordManualPaymentDto,
    staffUserId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);

      const bill = await tx.bill.findUnique({
        where: { id: billId },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          tableSessionId: true,
          billRequestId: true,
          status: true,
          currency: true,
          totalMinor: true,
          paidMinor: true,
          balanceDueMinor: true,
        },
      });

      if (!bill) {
        throw new NotFoundException("Bill not found");
      }

      if (!PAYABLE_BILL_STATUSES.includes(bill.status)) {
        if (
          bill.status === BillStatus.paid ||
          bill.status === BillStatus.closed
        ) {
          throw new BadRequestException("Bill is already paid");
        }

        throw new BadRequestException(
          "Only presented bills can receive manual payments",
        );
      }

      if (body.amountMinor !== bill.balanceDueMinor) {
        throw new BadRequestException(
          "Manual payment amount must match the bill balance due",
        );
      }

      const cashierShift =
        await this.cashierShiftsService.getOpenShiftForPayment(
          bill.branchId,
          bill.currency,
          tx,
        );
      const note = this.normalizeOptionalText(body.note);
      const reference = this.normalizeOptionalText(body.reference);
      const now = new Date();
      const settledBill = await tx.bill.updateMany({
        where: {
          id: bill.id,
          status: { in: PAYABLE_BILL_STATUSES },
          balanceDueMinor: body.amountMinor,
        },
        data: {
          status: BillStatus.paid,
          paidMinor: bill.totalMinor,
          balanceDueMinor: 0,
          paidAt: now,
          paidByStaffUserId: staffUserId,
        },
      });

      if (settledBill.count === 0) {
        const currentBill = await tx.bill.findUnique({
          where: { id: bill.id },
          select: {
            status: true,
            balanceDueMinor: true,
          },
        });

        if (
          currentBill?.status === BillStatus.paid ||
          currentBill?.status === BillStatus.closed
        ) {
          throw new BadRequestException("Bill is already paid");
        }

        throw new BadRequestException(
          "Bill is no longer payable or the balance changed. Refresh the bill and try again.",
        );
      }

      const manualPayment = await tx.manualPayment.create({
        data: {
          companyId: bill.companyId,
          branchId: bill.branchId,
          billId: bill.id,
          cashierShiftId: cashierShift.id,
          method: body.method as BillPaymentMethod,
          status: ManualPaymentStatus.recorded,
          amountMinor: body.amountMinor,
          currency: bill.currency,
          reference,
          note,
          recordedByStaffUserId: staffUserId,
          recordedAt: now,
        },
        select: { id: true },
      });
      await this.cashierShiftsService.recordManualPaymentOnShift(
        {
          shift: cashierShift,
          paymentId: manualPayment.id,
          method: body.method as BillPaymentMethod,
          amountMinor: body.amountMinor,
          currency: bill.currency,
          staffUserId,
          note,
        },
        tx,
      );
      await this.createBillEvent(
        bill.id,
        BillEventType.payment_recorded,
        staffUserId,
        {
          method: body.method,
          amountMinor: body.amountMinor,
          ...(reference ? { reference } : {}),
          ...(note ? { note } : {}),
        },
        tx,
      );
      await this.createBillEvent(
        bill.id,
        BillEventType.paid,
        staffUserId,
        { paidMinor: bill.totalMinor, balanceDueMinor: 0 },
        tx,
      );
      await this.closeLinkedBillRequestAfterPayment(
        bill.billRequestId,
        staffUserId,
        note,
        tx,
      );
      await this.completeServedOrdersForPaidBill(
        bill.tableSessionId,
        bill.id,
        bill.billRequestId,
        staffUserId,
        note,
        tx,
      );
      await this.closeTableSessionIfSettled(
        bill.tableSessionId,
        staffUserId,
        tx,
      );
      await this.ensureReceiptForBill(bill.id, staffUserId, tx);
      await this.realtimeEventsService.recordBillPaymentRecorded(bill.id, tx);
      await this.realtimeEventsService.recordBillPaid(bill.id, tx);
      await this.realtimeEventsService.recordReceiptGenerated(bill.id, tx);
      await this.recalculateAttention(bill.tableSessionId, tx, "bill_paid", {
        billId: bill.id,
        billRequestId: bill.billRequestId,
      });

      return this.getBillResponse(bill.id, tx);
    });
  }

  async settleBillWithOnlinePayment(
    input: OnlinePaymentSettlementInput,
    tx: Prisma.TransactionClient,
  ): Promise<OnlinePaymentSettlementResult> {
    const bill = await tx.bill.findUnique({
      where: { id: input.billId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        billRequestId: true,
        status: true,
        currency: true,
        totalMinor: true,
        paidMinor: true,
        balanceDueMinor: true,
      },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    if (!PAYABLE_BILL_STATUSES.includes(bill.status)) {
      if (
        bill.status === BillStatus.paid ||
        bill.status === BillStatus.closed
      ) {
        return {
          settled: false,
          reason: "bill_already_paid",
          message: "Bill is already paid",
          billResponse: await this.getBillResponse(bill.id, tx),
        };
      }

      return {
        settled: false,
        reason: "bill_not_payable",
        message: "Bill is not payable. Present the bill before online payment.",
        billResponse: await this.getBillResponse(bill.id, tx),
      };
    }

    if (input.amountMinor !== bill.balanceDueMinor) {
      return {
        settled: false,
        reason: "bill_balance_changed",
        message:
          "Bill is no longer payable or the balance changed. Refresh the bill and try again.",
        billResponse: await this.getBillResponse(bill.id, tx),
      };
    }

    const now = new Date();
    const settledBill = await tx.bill.updateMany({
      where: {
        id: bill.id,
        status: { in: PAYABLE_BILL_STATUSES },
        balanceDueMinor: input.amountMinor,
      },
      data: {
        status: BillStatus.paid,
        paidMinor: bill.totalMinor,
        balanceDueMinor: 0,
        paidAt: now,
      },
    });

    if (settledBill.count === 0) {
      const currentBill = await tx.bill.findUnique({
        where: { id: bill.id },
        select: { status: true, balanceDueMinor: true },
      });

      if (
        currentBill?.status === BillStatus.paid ||
        currentBill?.status === BillStatus.closed
      ) {
        return {
          settled: false,
          reason: "bill_already_paid",
          message: "Bill is already paid",
          billResponse: await this.getBillResponse(bill.id, tx),
        };
      }

      return {
        settled: false,
        reason: "bill_stale",
        message:
          "Bill is no longer payable or the balance changed. Refresh the bill and try again.",
        billResponse: await this.getBillResponse(bill.id, tx),
      };
    }

    await this.createBillEvent(
      bill.id,
      BillEventType.payment_recorded,
      undefined,
      {
        method:
          input.provider === OnlinePaymentProvider.mock
            ? "online_mock"
            : "online_external",
        provider: input.provider,
        onlinePaymentIntentId: input.onlinePaymentIntentId,
        providerIntentId: input.providerIntentId,
        providerEventId: input.providerEventId,
        amountMinor: input.amountMinor,
      },
      tx,
    );
    await this.createBillEvent(
      bill.id,
      BillEventType.paid,
      undefined,
      {
        paidMinor: bill.totalMinor,
        balanceDueMinor: 0,
        source: "online_payment",
        onlinePaymentIntentId: input.onlinePaymentIntentId,
      },
      tx,
    );
    await this.closeLinkedBillRequestAfterPayment(
      bill.billRequestId,
      undefined,
      null,
      tx,
      "online_payment_succeeded",
    );
    await this.completeServedOrdersForPaidBill(
      bill.tableSessionId,
      bill.id,
      bill.billRequestId,
      undefined,
      null,
      tx,
      "online_payment_succeeded",
    );
    await this.closeTableSessionIfSettled(bill.tableSessionId, undefined, tx);
    await this.ensureReceiptForBill(bill.id, undefined, tx);
    await this.realtimeEventsService.recordBillPaymentRecorded(bill.id, tx);
    await this.realtimeEventsService.recordBillPaid(bill.id, tx);
    await this.realtimeEventsService.recordReceiptGenerated(bill.id, tx);
    await this.recalculateAttention(bill.tableSessionId, tx, "bill_paid", {
      billId: bill.id,
      billRequestId: bill.billRequestId,
      source: "online_payment",
    });

    return {
      settled: true,
      reason: "settled",
      billResponse: await this.getBillResponse(bill.id, tx),
    };
  }

  async cancel(billId: string, body: CancelBillDto = {}) {
    return this.prisma.$transaction((tx) =>
      this.cancelInternal(billId, body, tx),
    );
  }

  async generateReceipt(billId: string, staffUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(staffUserId, tx);
      await this.ensureReceiptForBill(billId, staffUserId, tx);
      await this.realtimeEventsService.recordReceiptGenerated(billId, tx);

      return this.getBillResponse(billId, tx);
    });
  }

  async closePaidBillForBillRequest(
    billRequestId: string,
    staffUserId: string | undefined,
    note: string | null,
    tx: Prisma.TransactionClient,
  ) {
    await this.assertStaffUserExists(staffUserId, tx);

    const bill = await tx.bill.findUnique({
      where: { billRequestId },
      select: {
        id: true,
        status: true,
        tableSessionId: true,
        billRequestId: true,
      },
    });

    if (!bill) {
      throw new BadRequestException("Bill has not been generated yet");
    }

    if (bill.status !== BillStatus.paid && bill.status !== BillStatus.closed) {
      throw new BadRequestException(
        "Bill must be paid before it can be closed",
      );
    }

    if (bill.status === BillStatus.paid) {
      const now = new Date();

      await tx.bill.update({
        where: { id: bill.id },
        data: {
          status: BillStatus.closed,
          closedAt: now,
          closedByStaffUserId: staffUserId,
        },
      });
      await this.createBillEvent(
        bill.id,
        BillEventType.closed,
        staffUserId,
        note ? { note } : undefined,
        tx,
      );
      await this.realtimeEventsService.recordBillClosedForBill(bill.id, tx);
    }

    await this.closeLinkedBillRequestAfterPayment(
      billRequestId,
      staffUserId,
      note,
      tx,
    );

    return this.getBillResponse(bill.id, tx);
  }

  async cancelLinkedUnpaidBillForBillRequest(
    billRequestId: string,
    staffUserId: string | undefined,
    reason: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const bill = await tx.bill.findUnique({
      where: { billRequestId },
      select: { id: true, status: true },
    });

    if (!bill) {
      return null;
    }

    if (bill.status === BillStatus.paid || bill.status === BillStatus.closed) {
      throw new BadRequestException("Paid bills cannot be cancelled");
    }

    await this.cancelInternal(
      bill.id,
      { staffUserId, reason: reason ?? "Bill request cancelled" },
      tx,
    );

    return bill.id;
  }

  private async createOrGetBillForBillRequestInternal(
    billRequestId: string,
    options: { actorType?: string; metadata?: Record<string, unknown> },
    tx: Prisma.TransactionClient,
    behavior: { hydrateResponse?: boolean; recordRealtimeEvents?: boolean } = {},
  ): Promise<any> {
    const hydrateResponse = behavior.hydrateResponse ?? true;
    const recordRealtimeEvents = behavior.recordRealtimeEvents ?? true;
    const existingBill = hydrateResponse
      ? await tx.bill.findUnique({
          where: { billRequestId },
          include: this.billDetailInclude(),
        })
      : await tx.bill.findUnique({
          where: { billRequestId },
          select: {
            id: true,
            billRequestId: true,
            tableSessionId: true,
          },
        });

    if (existingBill) {
      return hydrateResponse
        ? this.toBillResponse(existingBill)
        : {
            billId: existingBill.id,
            billRequestId: existingBill.billRequestId ?? billRequestId,
            tableSessionId: existingBill.tableSessionId,
            created: false,
          };
    }

    const billRequest = await tx.billRequest.findUnique({
      where: { id: billRequestId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        status: true,
        currency: true,
        subtotalMinor: true,
        orderCount: true,
        requestedAt: true,
        requestedByActorType: true,
        note: true,
      },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request not found");
    }

    if (billRequest.status === BillRequestStatus.closed) {
      throw new BadRequestException("Closed bill requests cannot create bills");
    }

    if (billRequest.status === BillRequestStatus.cancelled) {
      throw new BadRequestException(
        "Cancelled bill requests cannot create bills",
      );
    }

    const billableOrders = await this.findBillableOrders(
      billRequest.tableSessionId,
      tx,
    );
    const totals = this.getBillableTotals(billableOrders);

    if (totals.orderCount === 0) {
      throw new BadRequestException(
        "Table session has no accepted, preparing, ready, served, or completed orders to bill",
      );
    }

    const billNumber = await this.generateBillNumber(billRequest.branchId, tx);
    const lines = this.toBillLineCreates(billableOrders);
    const actorType =
      options.actorType ??
      (billRequest.requestedByActorType === BillRequestActorType.customer
        ? "customer"
        : "system");
    const bill = await tx.bill.create({
      data: {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        billRequestId: billRequest.id,
        status: BillStatus.requested,
        billNumber,
        currency: totals.currency,
        subtotalMinor: totals.subtotalMinor,
        totalMinor: totals.subtotalMinor,
        paidMinor: 0,
        balanceDueMinor: totals.subtotalMinor,
        orderCount: totals.orderCount,
        lineCount: lines.length,
        requestedAt: billRequest.requestedAt,
        createdByActorType: actorType,
        metadata: this.toJsonValue({
          source: "bill_request",
          billRequestId: billRequest.id,
          billRequestSubtotalMinor: billRequest.subtotalMinor,
          billRequestOrderCount: billRequest.orderCount,
          ...(billRequest.note ? { billRequestNote: billRequest.note } : {}),
          ...(options.metadata ?? {}),
        }),
        lines: {
          create: lines,
        },
        events: {
          create: [
            {
              type: BillEventType.created,
              actorType,
              metadata: this.toJsonValue({
                subtotalMinor: totals.subtotalMinor,
                orderCount: totals.orderCount,
                lineCount: lines.length,
                currency: totals.currency,
              }),
            },
            {
              type: BillEventType.linked_to_request,
              actorType,
              metadata: this.toJsonValue({ billRequestId: billRequest.id }),
            },
          ],
        },
      },
      select: { id: true },
    });

    if (recordRealtimeEvents) {
      await this.realtimeEventsService.recordBillCreated(bill.id, tx);
    }

    return hydrateResponse
      ? this.getBillResponse(bill.id, tx)
      : {
          billId: bill.id,
          billRequestId: billRequest.id,
          tableSessionId: billRequest.tableSessionId,
          created: true,
        };
  }

  private async presentInternal(
    billId: string,
    body: BillActionDto,
    tx: Prisma.TransactionClient,
  ) {
    await this.assertStaffUserExists(body.staffUserId, tx);

    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        tableSessionId: true,
        billRequestId: true,
        status: true,
        presentedAt: true,
      },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    if (bill.status === BillStatus.cancelled) {
      throw new BadRequestException("Cancelled bills cannot be presented");
    }

    if (bill.status === BillStatus.paid || bill.status === BillStatus.closed) {
      return this.getBillResponse(bill.id, tx);
    }

    const note = this.normalizeOptionalText(body.note);
    const now = new Date();

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status:
          bill.status === BillStatus.payment_pending
            ? BillStatus.payment_pending
            : BillStatus.presented,
        presentedAt: bill.presentedAt ?? now,
        presentedByStaffUserId: body.staffUserId,
      },
    });
    await this.createBillEvent(
      bill.id,
      BillEventType.presented,
      body.staffUserId,
      note ? { note } : undefined,
      tx,
    );
    await this.realtimeEventsService.recordBillPresentedForBill(bill.id, tx);
    await this.recalculateAttention(bill.tableSessionId, tx, "bill_presented", {
      billId: bill.id,
      billRequestId: bill.billRequestId,
    });

    return this.getBillResponse(bill.id, tx);
  }

  private async presentBillCompact(
    billId: string,
    body: BillActionDto & { billCreated?: boolean; billRequestId?: string },
    tx: Prisma.TransactionClient,
  ): Promise<BillRequestBillPresentMutationResult> {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        tableSessionId: true,
        billRequestId: true,
        status: true,
        presentedAt: true,
      },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    if (bill.status === BillStatus.cancelled) {
      throw new BadRequestException("Cancelled bills cannot be presented");
    }

    if (bill.status === BillStatus.paid || bill.status === BillStatus.closed) {
      return {
        billId: bill.id,
        billRequestId: body.billRequestId ?? bill.billRequestId ?? "",
        tableSessionId: bill.tableSessionId,
        created: body.billCreated ?? false,
        status: bill.status,
        presented: false,
      };
    }

    const note = this.normalizeOptionalText(body.note);
    const now = new Date();
    const status =
      bill.status === BillStatus.payment_pending
        ? BillStatus.payment_pending
        : BillStatus.presented;

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status,
        presentedAt: bill.presentedAt ?? now,
        presentedByStaffUserId: body.staffUserId,
      },
    });
    await this.createBillEvent(
      bill.id,
      BillEventType.presented,
      body.staffUserId,
      note ? { note } : undefined,
      tx,
    );

    return {
      billId: bill.id,
      billRequestId: body.billRequestId ?? bill.billRequestId ?? "",
      tableSessionId: bill.tableSessionId,
      created: body.billCreated ?? false,
      status,
      presented: true,
    };
  }

  private async cancelInternal(
    billId: string,
    body: CancelBillDto,
    tx: Prisma.TransactionClient,
  ) {
    await this.assertStaffUserExists(body.staffUserId, tx);

    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        tableSessionId: true,
        billRequestId: true,
        status: true,
      },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    if (bill.status === BillStatus.paid || bill.status === BillStatus.closed) {
      throw new BadRequestException("Paid bills cannot be cancelled");
    }

    if (bill.status === BillStatus.cancelled) {
      return this.getBillResponse(bill.id, tx);
    }

    const reason = this.normalizeOptionalText(body.reason);

    if (!reason) {
      throw new BadRequestException("Bill cancellation reason is required");
    }

    const now = new Date();

    await tx.bill.update({
      where: { id: bill.id },
      data: {
        status: BillStatus.cancelled,
        cancelledAt: now,
        cancelledByStaffUserId: body.staffUserId,
        cancellationReason: reason,
      },
    });
    await this.createBillEvent(
      bill.id,
      BillEventType.cancelled,
      body.staffUserId,
      { reason },
      tx,
    );
    await this.realtimeEventsService.recordBillCancelledForBill(bill.id, tx);
    await this.recalculateAttention(bill.tableSessionId, tx, "bill_cancelled", {
      billId: bill.id,
      billRequestId: bill.billRequestId,
      reason,
    });

    return this.getBillResponse(bill.id, tx);
  }

  private async closeLinkedBillRequestAfterPayment(
    billRequestId: string | null,
    staffUserId: string | undefined,
    note: string | null,
    tx: Prisma.TransactionClient,
    source = "manual_payment_recorded",
  ) {
    if (!billRequestId) {
      return;
    }

    const billRequest = await tx.billRequest.findUnique({
      where: { id: billRequestId },
      select: {
        id: true,
        status: true,
        tableSessionId: true,
      },
    });

    if (
      !billRequest ||
      !ACTIVE_BILL_REQUEST_STATUSES.includes(billRequest.status)
    ) {
      return;
    }

    const now = new Date();

    await tx.billRequest.update({
      where: { id: billRequest.id },
      data: {
        status: BillRequestStatus.closed,
        closedAt: now,
        closedByStaffUserId: staffUserId,
      },
    });
    await tx.billRequestEvent.create({
      data: {
        billRequestId: billRequest.id,
        type: BillRequestEventType.closed,
        actorType: staffUserId
          ? BillRequestActorType.staff
          : BillRequestActorType.system,
        actorStaffUserId: staffUserId,
        metadata: this.toJsonValue({
          source,
          ...(note ? { note } : {}),
        }),
      },
    });
    await this.presenceNotificationsService.createBillClosedNotification(
      billRequest.id,
      tx,
    );
    await this.realtimeEventsService.recordBillClosed(billRequest.id, tx);
    await this.recalculateAttention(
      billRequest.tableSessionId,
      tx,
      "bill_request_closed_after_payment",
      { billRequestId: billRequest.id },
    );
  }

  private async completeServedOrdersForPaidBill(
    tableSessionId: string,
    billId: string,
    billRequestId: string | null,
    staffUserId: string | undefined,
    note: string | null,
    tx: Prisma.TransactionClient,
    source = "manual_payment_recorded",
  ) {
    const servedOrders = await tx.order.findMany({
      where: {
        tableSessionId,
        status: OrderStatus.served,
      },
      select: { id: true },
    });
    const now = new Date();

    for (const order of servedOrders) {
      const updatedOrder = await tx.order.updateMany({
        where: {
          id: order.id,
          status: OrderStatus.served,
        },
        data: {
          status: OrderStatus.completed,
          completedAt: now,
          completedByStaffUserId: staffUserId,
          completionNote: note,
        },
      });

      if (updatedOrder.count === 0) {
        continue;
      }

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.completed,
          actorType: staffUserId
            ? OrderEventActorType.staff
            : OrderEventActorType.system,
          actorStaffUserId: staffUserId,
          metadata: this.toJsonValue({
            source,
            billId,
            billRequestId,
            ...(note ? { note } : {}),
          }),
        },
      });
      await this.realtimeEventsService.recordOrderCompleted(order.id, tx);
      await this.recalculateAttention(
        tableSessionId,
        tx,
        "bill_order_completed_after_payment",
        { orderId: order.id, billId, billRequestId },
      );
    }
  }

  private async closeTableSessionIfSettled(
    tableSessionId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const openOrderCount = await tx.order.count({
      where: {
        tableSessionId,
        status: { notIn: TERMINAL_ORDER_STATUSES },
      },
    });

    if (openOrderCount > 0) {
      return;
    }

    await tx.tableSession.updateMany({
      where: {
        id: tableSessionId,
        status: { in: [TableSessionStatus.active, TableSessionStatus.idle] },
      },
      data: {
        status: TableSessionStatus.closed,
        closedAt: new Date(),
        closeReason: `bill_paid:${staffUserId ?? "system"}`,
      },
    });
  }

  private async ensureReceiptForBill(
    billId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const existingReceipt = await tx.billReceipt.findUnique({
      where: { billId },
      select: { id: true },
    });

    if (existingReceipt) {
      return existingReceipt.id;
    }

    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: this.billDetailInclude(),
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    if (bill.status !== BillStatus.paid && bill.status !== BillStatus.closed) {
      throw new BadRequestException(
        "Receipt can only be generated for paid bills",
      );
    }

    const receiptNumber = await this.generateReceiptNumber(
      bill.branchId,
      bill.billNumber,
      tx,
    );
    const payload = this.toReceiptPayload(bill, receiptNumber);

    const receipt = await tx.billReceipt.create({
      data: {
        companyId: bill.companyId,
        branchId: bill.branchId,
        billId: bill.id,
        receiptNumber,
        payload: this.toJsonValue(payload),
        printableText: this.toPrintableReceiptText(payload),
      },
      select: { id: true },
    });

    await this.createBillEvent(
      bill.id,
      BillEventType.receipt_generated,
      staffUserId,
      { receiptId: receipt.id, receiptNumber },
      tx,
    );

    return receipt.id;
  }

  private async generateBillNumber(
    branchId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bill-number:${branchId}`})::bigint)`;

    let sequence = (await tx.bill.count({ where: { branchId } })) + 1;

    while (true) {
      const billNumber = `${BILL_NUMBER_PREFIX}${String(sequence).padStart(
        5,
        "0",
      )}`;
      const existing = await tx.bill.findUnique({
        where: {
          branchId_billNumber: {
            branchId,
            billNumber,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        return billNumber;
      }

      sequence += 1;
    }
  }

  private async generateReceiptNumber(
    branchId: string,
    billNumber: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`receipt-number:${branchId}`})::bigint)`;

    const baseReceiptNumber = billNumber.replace(
      BILL_NUMBER_PREFIX,
      RECEIPT_NUMBER_PREFIX,
    );
    let receiptNumber = baseReceiptNumber;
    let suffix = 2;

    while (true) {
      const existing = await tx.billReceipt.findUnique({
        where: {
          branchId_receiptNumber: {
            branchId,
            receiptNumber,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        return receiptNumber;
      }

      receiptNumber = `${baseReceiptNumber}-${suffix}`;
      suffix += 1;
    }
  }

  private async findBillableOrders(tableSessionId: string, tx: PrismaExecutor) {
    return tx.order.findMany({
      where: {
        tableSessionId,
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
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            itemNameSnapshot: true,
            unitPriceMinorSnapshot: true,
            modifiersTotalMinorSnapshot: true,
            lineTotalMinorSnapshot: true,
            currency: true,
            modifierOptions: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                modifierGroupId: true,
                modifierOptionId: true,
                modifierGroupNameSnapshot: true,
                modifierGroupSlugSnapshot: true,
                modifierOptionNameSnapshot: true,
                modifierOptionSlugSnapshot: true,
                priceDeltaMinorSnapshot: true,
              },
            },
          },
        },
      },
    });
  }

  private getBillableTotals(orders: any[], enforceSingleCurrency = true) {
    if (orders.length === 0) {
      return {
        subtotalMinor: 0,
        orderCount: 0,
        lineCount: 0,
        currency: "EGP",
      };
    }

    const currencies = orders.flatMap((order) => [
      order.currency,
      ...order.items.map((item: any) => item.currency),
    ]);
    const currency = currencies[0] ?? "EGP";

    if (
      enforceSingleCurrency &&
      currencies.some((candidate) => candidate !== currency)
    ) {
      throw new BadRequestException(
        "Billable orders must use the same currency",
      );
    }

    return {
      subtotalMinor: orders.reduce(
        (sum, order) =>
          sum +
          order.items.reduce(
            (itemSum: number, item: any) =>
              itemSum + item.lineTotalMinorSnapshot,
            0,
          ),
        0,
      ),
      orderCount: orders.length,
      lineCount: orders.reduce((sum, order) => sum + order.items.length, 0),
      currency,
    };
  }

  private toBillLineCreates(orders: any[]) {
    return orders.flatMap((order) =>
      order.items.map((item: any) => ({
        orderId: order.id,
        orderItemId: item.id,
        menuItemId: item.menuItemId,
        itemNameSnapshot: item.itemNameSnapshot,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinorSnapshot,
        modifiersTotalMinor: item.modifiersTotalMinorSnapshot,
        lineTotalMinor: item.lineTotalMinorSnapshot,
        currency: item.currency,
        modifiersSnapshot: this.toJsonValue(
          item.modifierOptions.map((option: any) => ({
            id: option.id,
            modifierGroupId: option.modifierGroupId,
            modifierOptionId: option.modifierOptionId,
            modifierGroupNameSnapshot: option.modifierGroupNameSnapshot,
            modifierGroupSlugSnapshot: option.modifierGroupSlugSnapshot,
            modifierOptionNameSnapshot: option.modifierOptionNameSnapshot,
            modifierOptionSlugSnapshot: option.modifierOptionSlugSnapshot,
            priceDeltaMinorSnapshot: option.priceDeltaMinorSnapshot,
          })),
        ),
      })),
    );
  }

  private async createBillEvent(
    billId: string,
    type: BillEventType,
    staffUserId: string | undefined,
    metadata: Record<string, unknown> | undefined,
    tx: Prisma.TransactionClient,
  ) {
    await tx.billEvent.create({
      data: {
        billId,
        type,
        actorType: staffUserId ? "staff" : "system",
        actorStaffUserId: staffUserId,
        metadata: this.toJsonValue(metadata ?? {}),
      },
    });
  }

  private toReceiptPayload(bill: any, receiptNumber: string) {
    const tableSession = bill.tableSession;
    const table = tableSession?.table;
    const floor = table?.floor;

    return {
      receiptNumber,
      generatedAt: new Date().toISOString(),
      company: bill.company,
      branch: bill.branch,
      table: table
        ? {
            id: table.id,
            code: table.code,
            displayName: table.displayName,
            floorName: floor?.name ?? null,
          }
        : null,
      bill: {
        id: bill.id,
        billNumber: bill.billNumber,
        status: bill.status,
        currency: bill.currency,
        subtotalMinor: bill.subtotalMinor,
        serviceChargeMinor: bill.serviceChargeMinor,
        taxMinor: bill.taxMinor,
        discountMinor: bill.discountMinor,
        totalMinor: bill.totalMinor,
        paidMinor: bill.paidMinor,
        balanceDueMinor: bill.balanceDueMinor,
        presentedAt: bill.presentedAt,
        paidAt: bill.paidAt,
        orderCount: bill.orderCount,
        lineCount: bill.lineCount,
      },
      lines: bill.lines.map((line: any) => ({
        id: line.id,
        itemNameSnapshot: line.itemNameSnapshot,
        quantity: line.quantity,
        unitPriceMinor: line.unitPriceMinor,
        modifiersTotalMinor: line.modifiersTotalMinor,
        lineTotalMinor: line.lineTotalMinor,
        currency: line.currency,
        modifiersSnapshot: line.modifiersSnapshot,
      })),
      payments: [
        ...bill.manualPayments
          .filter(
            (payment: any) => payment.status === ManualPaymentStatus.recorded,
          )
          .map((payment: any) => ({
            id: payment.id,
            method: payment.method,
            provider: null,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            reference: payment.reference,
            note: payment.note,
            recordedAt: payment.recordedAt,
          })),
        ...(bill.onlinePaymentIntents ?? [])
          .filter(
            (payment: any) =>
              payment.status === OnlinePaymentIntentStatus.succeeded,
          )
          .map((payment: any) => ({
            id: payment.id,
            method:
              payment.provider === OnlinePaymentProvider.mock
                ? "online_mock"
                : "online_external",
            provider: payment.provider,
            amountMinor: payment.amountMinor,
            currency: payment.currency,
            reference: payment.providerIntentId,
            note: null,
            recordedAt: payment.succeededAt ?? payment.updatedAt,
          })),
      ].sort(
        (left: any, right: any) =>
          new Date(left.recordedAt).getTime() -
          new Date(right.recordedAt).getTime(),
      ),
    };
  }

  private toPrintableReceiptText(payload: any) {
    const lines = [
      payload.company?.name ?? "Cafe",
      payload.branch?.name ?? "Branch",
      `Receipt ${payload.receiptNumber}`,
      `Bill ${payload.bill.billNumber}`,
      payload.table
        ? `Table ${payload.table.displayName ?? payload.table.code}`
        : null,
      "",
      ...payload.lines.map(
        (line: any) =>
          `${line.quantity} x ${line.itemNameSnapshot} ${this.formatMinor(
            line.lineTotalMinor,
            line.currency,
          )}`,
      ),
      "",
      `Subtotal ${this.formatMinor(
        payload.bill.subtotalMinor,
        payload.bill.currency,
      )}`,
      `Total ${this.formatMinor(payload.bill.totalMinor, payload.bill.currency)}`,
      `Paid ${this.formatMinor(payload.bill.paidMinor, payload.bill.currency)}`,
      payload.payments.some((payment: any) =>
        String(payment.method).startsWith("online_"),
      )
        ? "Online payment confirmed."
        : "Manual payment recorded by cashier.",
    ].filter((line) => line !== null);

    return lines.join("\n");
  }

  private async getBillResponse(billId: string, tx: PrismaExecutor) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      include: this.billDetailInclude(),
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    return this.toBillResponse(bill);
  }

  private toBillResponse(record: any) {
    const {
      company,
      branch,
      tableSession,
      billRequest,
      lines,
      manualPayments,
      onlinePaymentIntents,
      onlinePaymentEvents,
      receipt,
      events,
      ...billFields
    } = record;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      bill: billFields,
      company,
      branch,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
      billRequest,
      lines,
      manualPayments,
      onlinePaymentIntents,
      onlinePaymentEvents,
      receipt,
      events,
      totals: this.toBillTotals(record),
    };
  }

  private toBillListItemFromRecord(record: any) {
    const {
      tableSession,
      billRequest,
      lines,
      manualPayments,
      onlinePaymentIntents,
      receipt,
      ...billFields
    } = record;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      bill: billFields,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
      billRequest,
      lines,
      manualPayments,
      onlinePaymentIntents,
      receipt,
      totals: this.toBillTotals(record),
    };
  }

  private toBillTotals(record: any) {
    return {
      currency: record.currency,
      subtotalMinor: record.subtotalMinor,
      serviceChargeMinor: record.serviceChargeMinor,
      taxMinor: record.taxMinor,
      discountMinor: record.discountMinor,
      totalMinor: record.totalMinor,
      paidMinor: record.paidMinor,
      balanceDueMinor: record.balanceDueMinor,
      orderCount: record.orderCount,
      lineCount: record.lineCount,
    };
  }

  private billStatusWhere(
    status: NonNullable<BranchBillsQueryDto["status"]>,
  ): Prisma.BillWhereInput {
    if (status === "all") {
      return {};
    }

    if (status === "active") {
      return { status: { in: ACTIVE_BILL_STATUSES } };
    }

    return { status: status as BillStatus };
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
    tx: Prisma.TransactionClient,
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

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_BRANCH_BILL_LIMIT, 1), 100);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private formatMinor(amountMinor: number, currency: string) {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private billListInclude() {
    return {
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      billRequest: true,
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

  private billDetailInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      billRequest: true,
      lines: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      manualPayments: {
        orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
      },
      onlinePaymentIntents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      onlinePaymentEvents: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
      receipt: true,
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
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
      status: true,
    };
  }
}
