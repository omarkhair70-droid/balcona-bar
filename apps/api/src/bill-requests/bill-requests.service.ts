import {
  BadRequestException,
  Injectable,
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
import { BillsService } from "../bills/bills.service";
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

@Injectable()
export class BillRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly tableAttentionService: TableAttentionService,
    private readonly billsService: BillsService,
  ) {}

  async requestBill(sessionId: string, body: RequestBillDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      const tableSession = await this.findTableSessionOrThrow(sessionId, tx);

      this.assertBillRequestableSession(tableSession.status);

      const activeBillRequest = await this.findActiveBillRequest(sessionId, tx);

      if (activeBillRequest) {
        await this.billsService.createOrGetBillForBillRequest(
          activeBillRequest.id,
          {
            actorType: "customer",
            metadata: { source: "active_bill_request" },
          },
          tx,
        );

        return this.getBillRequestResponse(activeBillRequest.id, tx);
      }

      const billableOrders = await this.findBillableOrders(sessionId, tx);
      const totals = this.getBillableTotals(billableOrders);

      if (totals.orderCount === 0) {
        throw new BadRequestException(
          "Table session has no accepted, preparing, ready, served, or completed orders to bill",
        );
      }

      const note = this.normalizeOptionalText(body.note);
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

      for (const order of billableOrders) {
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.bill_requested,
            actorType: OrderEventActorType.customer,
            metadata: {
              billRequestId: billRequest.id,
              tableSessionId: tableSession.id,
            },
          },
        });
      }

      await this.presenceNotificationsService.createBillRequestedNotification(
        billRequest.id,
        tx,
      );
      await this.realtimeEventsService.recordBillRequested(billRequest.id, tx);
      await this.billsService.createOrGetBillForBillRequest(
        billRequest.id,
        { actorType: "customer" },
        tx,
      );
      await this.recalculateAttention(tableSession.id, tx, "bill_requested", {
        billRequestId: billRequest.id,
      });

      return this.getBillRequestResponse(billRequest.id, tx);
    });
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
    return this.prisma.$transaction(async (tx) => {
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
      await this.realtimeEventsService.recordBillAcknowledged(
        billRequest.id,
        tx,
      );
      await this.recalculateAttention(
        billRequest.tableSessionId,
        tx,
        "bill_acknowledged",
        { billRequestId: billRequest.id },
      );

      return this.getBillRequestResponse(billRequest.id, tx);
    });
  }

  async present(billRequestId: string, body: BillStaffActionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const billRequest = await this.findBillRequestStatusOrThrow(
        billRequestId,
        tx,
      );

      if (
        billRequest.status !== BillRequestStatus.open &&
        billRequest.status !== BillRequestStatus.acknowledged
      ) {
        throw new BadRequestException(
          "Only open or acknowledged bill requests can be presented",
        );
      }

      const note = this.normalizeOptionalText(body.note);
      const now = new Date();

      await tx.billRequest.update({
        where: { id: billRequest.id },
        data: {
          status: BillRequestStatus.presented,
          presentedAt: now,
          presentedByStaffUserId: body.staffUserId,
        },
      });
      await this.createBillRequestEvent(
        billRequest.id,
        BillRequestEventType.presented,
        body.staffUserId,
        note ? { note } : undefined,
        tx,
      );
      await this.presenceNotificationsService.createBillPresentedNotification(
        billRequest.id,
        tx,
      );
      await this.realtimeEventsService.recordBillPresented(billRequest.id, tx);
      await this.billsService.presentBillForBillRequest(
        billRequest.id,
        body.staffUserId,
        note,
        tx,
      );
      await this.recalculateAttention(
        billRequest.tableSessionId,
        tx,
        "bill_presented",
        { billRequestId: billRequest.id },
      );

      return this.getBillRequestResponse(billRequest.id, tx);
    });
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
