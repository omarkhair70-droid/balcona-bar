import { Injectable, MessageEvent, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
} from "@prisma/client";
import { interval, merge, Observable, of, Subject } from "rxjs";
import { filter, map } from "rxjs/operators";
import { PrismaService } from "../prisma/prisma.service";
import { BranchRealtimeEventsQueryDto } from "./dto/branch-realtime-events-query.dto";
import { BranchRealtimeQueryDto } from "./dto/branch-realtime-query.dto";
import { SessionRealtimeEventsQueryDto } from "./dto/session-realtime-events-query.dto";
import { SessionRealtimeQueryDto } from "./dto/session-realtime-query.dto";

const HEARTBEAT_MS = 25_000;
const DEFAULT_EVENT_LIMIT = 50;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const realtimeEventSelect = {
  id: true,
  companyId: true,
  branchId: true,
  tableSessionId: true,
  orderId: true,
  preparationTaskId: true,
  waiterCallId: true,
  billRequestId: true,
  notificationId: true,
  type: true,
  channel: true,
  payload: true,
  createdAt: true,
} satisfies Prisma.RealtimeEventSelect;

type RealtimeEventRecord = Prisma.RealtimeEventGetPayload<{
  select: typeof realtimeEventSelect;
}>;

export interface CreateRealtimeEventInput {
  companyId: string;
  branchId?: string | null;
  tableSessionId?: string | null;
  orderId?: string | null;
  preparationTaskId?: string | null;
  waiterCallId?: string | null;
  billRequestId?: string | null;
  notificationId?: string | null;
  type: RealtimeEventType;
  channel: RealtimeEventChannel;
  payload?: unknown;
}

export interface RealtimeEventEnvelope {
  id: string;
  type: RealtimeEventType;
  channel: RealtimeEventChannel;
  scope: {
    companyId: string;
    branchId?: string;
    tableSessionId?: string;
  };
  orderId?: string;
  preparationTaskId?: string;
  waiterCallId?: string;
  billRequestId?: string;
  notificationId?: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

@Injectable()
export class RealtimeEventsService {
  private readonly events$ = new Subject<RealtimeEventEnvelope>();

  constructor(private readonly prisma: PrismaService) {}

  async createRealtimeEvent(
    input: CreateRealtimeEventInput,
    tx: PrismaExecutor = this.prisma,
  ) {
    const event = await tx.realtimeEvent.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? undefined,
        tableSessionId: input.tableSessionId ?? undefined,
        orderId: input.orderId ?? undefined,
        preparationTaskId: input.preparationTaskId ?? undefined,
        waiterCallId: input.waiterCallId ?? undefined,
        billRequestId: input.billRequestId ?? undefined,
        notificationId: input.notificationId ?? undefined,
        type: input.type,
        channel: input.channel,
        payload: this.toJsonPayload(input.payload),
      },
      select: realtimeEventSelect,
    });
    const envelope = this.toEnvelope(event);

    this.events$.next(envelope);

    return envelope;
  }

  async streamBranch(branchId: string, query: BranchRealtimeQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const requestedChannel = query.channel ?? "all";
    const channelFilter = this.branchChannelsFor(requestedChannel);
    const connection = await this.createRealtimeEvent({
      companyId: branch.companyId,
      branchId: branch.id,
      type: RealtimeEventType.connection_opened,
      channel: RealtimeEventChannel.system,
      payload: {
        scope: "branch",
        branchId: branch.id,
        requestedChannel,
      },
    });

    return merge(
      of(this.toSseMessage(connection)),
      this.events$.pipe(
        filter((event) => event.scope.branchId === branch.id),
        filter((event) => this.matchesChannel(event.channel, channelFilter)),
        map((event) => this.toSseMessage(event)),
      ),
      interval(HEARTBEAT_MS).pipe(
        map(() =>
          this.toSseMessage(
            this.createHeartbeatEnvelope({
              companyId: branch.companyId,
              branchId: branch.id,
              stream: "branch",
              requestedChannel,
            }),
          ),
        ),
      ),
    );
  }

  async streamTableSession(
    sessionId: string,
    query: SessionRealtimeQueryDto = {},
  ) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: { id: true, companyId: true, branchId: true },
    });

    if (!session) {
      throw new NotFoundException("Table session not found");
    }

    const requestedChannel = query.channel ?? "all";
    const channelFilter = this.sessionChannelsFor(requestedChannel);
    const connection = await this.createRealtimeEvent({
      companyId: session.companyId,
      branchId: session.branchId,
      tableSessionId: session.id,
      type: RealtimeEventType.connection_opened,
      channel: RealtimeEventChannel.system,
      payload: {
        scope: "table_session",
        tableSessionId: session.id,
        requestedChannel,
      },
    });

    return merge(
      of(this.toSseMessage(connection)),
      this.events$.pipe(
        filter((event) => event.scope.tableSessionId === session.id),
        filter((event) => this.matchesChannel(event.channel, channelFilter)),
        map((event) => this.toSseMessage(event)),
      ),
      interval(HEARTBEAT_MS).pipe(
        map(() =>
          this.toSseMessage(
            this.createHeartbeatEnvelope({
              companyId: session.companyId,
              branchId: session.branchId,
              tableSessionId: session.id,
              stream: "table_session",
              requestedChannel,
            }),
          ),
        ),
      ),
    );
  }

  async findBranchEvents(
    branchId: string,
    query: BranchRealtimeEventsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const channels = this.branchChannelsFor(query.channel ?? "all");
    const events = await this.prisma.realtimeEvent.findMany({
      where: {
        branchId,
        ...(channels ? { channel: { in: channels } } : {}),
        ...(query.type ? { type: query.type as RealtimeEventType } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: this.normalizeLimit(query.limit),
      select: realtimeEventSelect,
    });

    return {
      branch,
      filters: {
        channel: query.channel ?? "all",
        type: query.type ?? "all",
        limit: this.normalizeLimit(query.limit),
      },
      events: events.map((event) => this.toEnvelope(event)),
    };
  }

  async findTableSessionEvents(
    sessionId: string,
    query: SessionRealtimeEventsQueryDto = {},
  ) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: { id: true, companyId: true, branchId: true },
    });

    if (!session) {
      throw new NotFoundException("Table session not found");
    }

    const channels = this.sessionChannelsFor(query.channel ?? "all");
    const events = await this.prisma.realtimeEvent.findMany({
      where: {
        tableSessionId: sessionId,
        ...(channels ? { channel: { in: channels } } : {}),
        ...(query.type ? { type: query.type as RealtimeEventType } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: this.normalizeLimit(query.limit),
      select: realtimeEventSelect,
    });

    return {
      tableSession: session,
      filters: {
        channel: query.channel ?? "all",
        type: query.type ?? "all",
        limit: this.normalizeLimit(query.limit),
      },
      events: events.map((event) => this.toEnvelope(event)),
    };
  }

  async recordTableSessionStarted(
    session: TableSessionRealtimeContext,
    tx: PrismaExecutor,
  ) {
    return this.createRealtimeEvent(
      {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        type: RealtimeEventType.table_session_started,
        channel: RealtimeEventChannel.session_status,
        payload: this.tableSessionPayload(session),
      },
      tx,
    );
  }

  async recordTableSessionResumed(
    session: TableSessionRealtimeContext,
    tx: PrismaExecutor,
  ) {
    return this.createRealtimeEvent(
      {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        type: RealtimeEventType.table_session_resumed,
        channel: RealtimeEventChannel.session_status,
        payload: this.tableSessionPayload(session),
      },
      tx,
    );
  }

  async recordNotificationCreated(
    notification: NotificationRealtimeContext,
    tx: PrismaExecutor,
  ) {
    const payload = this.notificationPayload(notification);
    const events: RealtimeEventEnvelope[] = [];

    events.push(
      await this.createRealtimeEvent(
        {
          companyId: notification.companyId,
          branchId: notification.branchId,
          tableSessionId: notification.tableSessionId,
          orderId: notification.orderId,
          preparationTaskId: notification.preparationTaskId,
          notificationId: notification.id,
          type: RealtimeEventType.notification_created,
          channel: RealtimeEventChannel.branch_notifications,
          payload,
        },
        tx,
      ),
    );

    if (notification.tableSessionId) {
      events.push(
        await this.createRealtimeEvent(
          {
            companyId: notification.companyId,
            branchId: notification.branchId,
            tableSessionId: notification.tableSessionId,
            orderId: notification.orderId,
            preparationTaskId: notification.preparationTaskId,
            notificationId: notification.id,
            type: RealtimeEventType.notification_created,
            channel: RealtimeEventChannel.session_notifications,
            payload,
          },
          tx,
        ),
      );
    }

    return events;
  }

  async recordNotificationRead(
    notification: NotificationRealtimeContext,
    tx: PrismaExecutor = this.prisma,
  ) {
    return this.recordNotificationStateChange(
      notification,
      RealtimeEventType.notification_read,
      tx,
    );
  }

  async recordNotificationDismissed(
    notification: NotificationRealtimeContext,
    tx: PrismaExecutor = this.prisma,
  ) {
    return this.recordNotificationStateChange(
      notification,
      RealtimeEventType.notification_dismissed,
      tx,
    );
  }

  async recordOrderSubmitted(orderId: string, tx: PrismaExecutor = this.prisma) {
    return this.recordOrderEvent(
      orderId,
      RealtimeEventType.order_submitted,
      tx,
    );
  }

  async recordOrderAccepted(orderId: string, tx: PrismaExecutor = this.prisma) {
    return this.recordOrderEvent(orderId, RealtimeEventType.order_accepted, tx);
  }

  async recordOrderRejected(orderId: string, tx: PrismaExecutor = this.prisma) {
    return this.recordOrderEvent(orderId, RealtimeEventType.order_rejected, tx);
  }

  async recordOrderCancelled(orderId: string, tx: PrismaExecutor = this.prisma) {
    return this.recordOrderEvent(
      orderId,
      RealtimeEventType.order_cancelled,
      tx,
    );
  }

  async recordOrderPreparationStarted(orderId: string, tx: PrismaExecutor) {
    return this.recordOrderEvent(
      orderId,
      RealtimeEventType.order_preparation_started,
      tx,
    );
  }

  async recordOrderPreparationReady(orderId: string, tx: PrismaExecutor) {
    return this.recordOrderEvent(
      orderId,
      RealtimeEventType.order_preparation_ready,
      tx,
    );
  }

  async recordOrderServed(orderId: string, tx: PrismaExecutor) {
    return this.recordOrderEvent(orderId, RealtimeEventType.order_served, tx);
  }

  async recordOrderCompleted(orderId: string, tx: PrismaExecutor = this.prisma) {
    return this.recordOrderEvent(
      orderId,
      RealtimeEventType.order_completed,
      tx,
    );
  }

  async recordSmartCashierEvaluated(
    orderId: string,
    payload: unknown,
    tx: PrismaExecutor,
  ) {
    return this.recordSmartCashierEvent(
      orderId,
      RealtimeEventType.smart_cashier_evaluated,
      payload,
      tx,
    );
  }

  async recordSmartCashierAutoAccepted(
    orderId: string,
    payload: unknown,
    tx: PrismaExecutor,
  ) {
    return this.recordSmartCashierEvent(
      orderId,
      RealtimeEventType.smart_cashier_auto_accepted,
      payload,
      tx,
    );
  }

  async recordSmartCashierManualReviewRequired(
    orderId: string,
    payload: unknown,
    tx: PrismaExecutor,
  ) {
    return this.recordSmartCashierEvent(
      orderId,
      RealtimeEventType.smart_cashier_manual_review_required,
      payload,
      tx,
    );
  }

  async recordPreparationTaskCreated(taskId: string, tx: PrismaExecutor) {
    return this.recordPreparationTaskEvent(
      taskId,
      RealtimeEventType.preparation_task_created,
      false,
      tx,
    );
  }

  async recordPreparationTaskStarted(taskId: string, tx: PrismaExecutor) {
    return this.recordPreparationTaskEvent(
      taskId,
      RealtimeEventType.preparation_task_started,
      true,
      tx,
    );
  }

  async recordPreparationTaskReady(taskId: string, tx: PrismaExecutor) {
    return this.recordPreparationTaskEvent(
      taskId,
      RealtimeEventType.preparation_task_ready,
      true,
      tx,
    );
  }

  async recordPreparationTaskCancelled(taskId: string, tx: PrismaExecutor) {
    return this.recordPreparationTaskEvent(
      taskId,
      RealtimeEventType.preparation_task_cancelled,
      true,
      tx,
    );
  }

  async recordKitchenTicketCreated(ticketId: string, tx: PrismaExecutor) {
    return this.recordKitchenTicketEvent(
      ticketId,
      RealtimeEventType.kitchen_ticket_created,
      tx,
    );
  }

  async recordKitchenTicketUpdated(ticketId: string, tx: PrismaExecutor) {
    return this.recordKitchenTicketEvent(
      ticketId,
      RealtimeEventType.kitchen_ticket_updated,
      tx,
    );
  }

  async recordKitchenTicketReady(ticketId: string, tx: PrismaExecutor) {
    return this.recordKitchenTicketEvent(
      ticketId,
      RealtimeEventType.kitchen_ticket_ready,
      tx,
    );
  }

  async recordKitchenTicketCancelled(ticketId: string, tx: PrismaExecutor) {
    return this.recordKitchenTicketEvent(
      ticketId,
      RealtimeEventType.kitchen_ticket_cancelled,
      tx,
    );
  }

  async recordPrintJobCreated(printJobId: string, tx: PrismaExecutor) {
    return this.recordPrintJobEvent(
      printJobId,
      RealtimeEventType.print_job_created,
      tx,
    );
  }

  async recordPrintJobPrinted(printJobId: string, tx: PrismaExecutor) {
    return this.recordPrintJobEvent(
      printJobId,
      RealtimeEventType.print_job_printed,
      tx,
    );
  }

  async recordPrintJobFailed(printJobId: string, tx: PrismaExecutor) {
    return this.recordPrintJobEvent(
      printJobId,
      RealtimeEventType.print_job_failed,
      tx,
    );
  }

  async recordPrintJobReprintRequested(printJobId: string, tx: PrismaExecutor) {
    return this.recordPrintJobEvent(
      printJobId,
      RealtimeEventType.print_job_reprint_requested,
      tx,
    );
  }

  async recordPrinterStationUpdated(
    printerStationId: string,
    tx: PrismaExecutor,
  ) {
    const printerStation = await tx.printerStation.findUnique({
      where: { id: printerStationId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        station: true,
        status: true,
      },
    });

    if (!printerStation) {
      return undefined;
    }

    return this.createRealtimeEvent(
      {
        companyId: printerStation.companyId,
        branchId: printerStation.branchId,
        type: RealtimeEventType.printer_station_updated,
        channel: RealtimeEventChannel.branch_preparation,
        payload: {
          printerStationId: printerStation.id,
          station: printerStation.station,
          status: printerStation.status,
        },
      },
      tx,
    );
  }

  async recordWaiterCallCreated(waiterCallId: string, tx: PrismaExecutor) {
    return this.recordWaiterCallEvent(
      waiterCallId,
      RealtimeEventType.waiter_call_created,
      tx,
    );
  }

  async recordWaiterCallAcknowledged(waiterCallId: string, tx: PrismaExecutor) {
    return this.recordWaiterCallEvent(
      waiterCallId,
      RealtimeEventType.waiter_call_acknowledged,
      tx,
    );
  }

  async recordWaiterCallResolved(waiterCallId: string, tx: PrismaExecutor) {
    return this.recordWaiterCallEvent(
      waiterCallId,
      RealtimeEventType.waiter_call_resolved,
      tx,
    );
  }

  async recordWaiterCallCancelled(waiterCallId: string, tx: PrismaExecutor) {
    return this.recordWaiterCallEvent(
      waiterCallId,
      RealtimeEventType.waiter_call_cancelled,
      tx,
    );
  }

  async recordBillRequested(billRequestId: string, tx: PrismaExecutor) {
    return this.recordBillRequestEvent(
      billRequestId,
      RealtimeEventType.bill_requested,
      tx,
    );
  }

  async recordBillAcknowledged(billRequestId: string, tx: PrismaExecutor) {
    return this.recordBillRequestEvent(
      billRequestId,
      RealtimeEventType.bill_acknowledged,
      tx,
    );
  }

  async recordBillPresented(billRequestId: string, tx: PrismaExecutor) {
    return this.recordBillRequestEvent(
      billRequestId,
      RealtimeEventType.bill_presented,
      tx,
    );
  }

  async recordBillClosed(billRequestId: string, tx: PrismaExecutor) {
    return this.recordBillRequestEvent(
      billRequestId,
      RealtimeEventType.bill_closed,
      tx,
    );
  }

  async recordBillCancelled(billRequestId: string, tx: PrismaExecutor) {
    return this.recordBillRequestEvent(
      billRequestId,
      RealtimeEventType.bill_cancelled,
      tx,
    );
  }

  async recordBillCreated(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(billId, RealtimeEventType.bill_created, tx);
  }

  async recordBillPresentedForBill(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(billId, RealtimeEventType.bill_presented, tx);
  }

  async recordBillPaymentRecorded(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(
      billId,
      RealtimeEventType.bill_payment_recorded,
      tx,
    );
  }

  async recordBillPaid(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(billId, RealtimeEventType.bill_paid, tx);
  }

  async recordBillClosedForBill(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(billId, RealtimeEventType.bill_closed, tx);
  }

  async recordBillCancelledForBill(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(billId, RealtimeEventType.bill_cancelled, tx);
  }

  async recordReceiptGenerated(billId: string, tx: PrismaExecutor) {
    return this.recordBillEvent(
      billId,
      RealtimeEventType.receipt_generated,
      tx,
    );
  }

  async recordOnlinePaymentIntentCreated(
    onlinePaymentIntentId: string,
    tx: PrismaExecutor,
  ) {
    return this.recordOnlinePaymentEvent(
      onlinePaymentIntentId,
      RealtimeEventType.online_payment_intent_created,
      tx,
    );
  }

  async recordOnlinePaymentSucceeded(
    onlinePaymentIntentId: string,
    tx: PrismaExecutor,
  ) {
    return this.recordOnlinePaymentEvent(
      onlinePaymentIntentId,
      RealtimeEventType.online_payment_succeeded,
      tx,
    );
  }

  async recordOnlinePaymentFailed(
    onlinePaymentIntentId: string,
    tx: PrismaExecutor,
  ) {
    return this.recordOnlinePaymentEvent(
      onlinePaymentIntentId,
      RealtimeEventType.online_payment_failed,
      tx,
    );
  }

  private async recordNotificationStateChange(
    notification: NotificationRealtimeContext,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    if (!notification.tableSessionId) {
      return null;
    }

    return this.createRealtimeEvent(
      {
        companyId: notification.companyId,
        branchId: notification.branchId,
        tableSessionId: notification.tableSessionId,
        orderId: notification.orderId,
        preparationTaskId: notification.preparationTaskId,
        notificationId: notification.id,
        type,
        channel: RealtimeEventChannel.session_notifications,
        payload: this.notificationPayload(notification),
      },
      tx,
    );
  }

  private async recordOrderEvent(
    orderId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        orderNumber: true,
        status: true,
        subtotalMinor: true,
        totalQuantity: true,
        itemCount: true,
        currency: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      subtotalMinor: order.subtotalMinor,
      totalQuantity: order.totalQuantity,
      itemCount: order.itemCount,
      currency: order.currency,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        orderId: order.id,
        type,
        channel: RealtimeEventChannel.branch_orders,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        orderId: order.id,
        type,
        channel: RealtimeEventChannel.session_status,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private async recordSmartCashierEvent(
    orderId: string,
    type: RealtimeEventType,
    smartCashierPayload: unknown,
    tx: PrismaExecutor,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        orderNumber: true,
        status: true,
        autoAcceptDecision: true,
        autoAcceptedAt: true,
        autoAcceptEvaluatedAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      autoAcceptDecision: order.autoAcceptDecision,
      autoAcceptedAt: order.autoAcceptedAt,
      autoAcceptEvaluatedAt: order.autoAcceptEvaluatedAt,
      smartCashier: smartCashierPayload,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        orderId: order.id,
        type,
        channel: RealtimeEventChannel.branch_orders,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        orderId: order.id,
        type,
        channel: RealtimeEventChannel.session_status,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private async recordPreparationTaskEvent(
    taskId: string,
    type: RealtimeEventType,
    includeSessionStatus: boolean,
    tx: PrismaExecutor,
  ) {
    const task = await tx.preparationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        orderId: true,
        station: true,
        status: true,
        quantity: true,
        itemNameSnapshot: true,
        order: {
          select: {
            orderNumber: true,
            tableSessionId: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException("Preparation task not found");
    }

    const payload = {
      preparationTaskId: task.id,
      orderId: task.orderId,
      orderNumber: task.order.orderNumber,
      station: task.station,
      status: task.status,
      quantity: task.quantity,
      itemNameSnapshot: task.itemNameSnapshot,
    };
    const events = [
      await this.createRealtimeEvent(
        {
          companyId: task.companyId,
          branchId: task.branchId,
          tableSessionId: task.order.tableSessionId,
          orderId: task.orderId,
          preparationTaskId: task.id,
          type,
          channel: RealtimeEventChannel.branch_preparation,
          payload,
        },
        tx,
      ),
    ];

    if (includeSessionStatus) {
      events.push(
        await this.createRealtimeEvent(
          {
            companyId: task.companyId,
            branchId: task.branchId,
            tableSessionId: task.order.tableSessionId,
            orderId: task.orderId,
            preparationTaskId: task.id,
            type,
            channel: RealtimeEventChannel.session_status,
            payload,
          },
          tx,
        ),
      );
    }

    return events;
  }

  private async recordKitchenTicketEvent(
    ticketId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        orderId: true,
        tableSessionId: true,
        station: true,
        status: true,
        type: true,
        displayCode: true,
      },
    });

    if (!ticket) {
      return undefined;
    }

    return this.createRealtimeEvent(
      {
        companyId: ticket.companyId,
        branchId: ticket.branchId,
        tableSessionId: ticket.tableSessionId,
        orderId: ticket.orderId,
        type,
        channel: RealtimeEventChannel.branch_preparation,
        payload: {
          kitchenTicketId: ticket.id,
          displayCode: ticket.displayCode,
          ticketType: ticket.type,
          station: ticket.station,
          status: ticket.status,
        },
      },
      tx,
    );
  }

  private async recordPrintJobEvent(
    printJobId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const printJob = await tx.printJob.findUnique({
      where: { id: printJobId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        kitchenTicketId: true,
        orderId: true,
        kind: true,
        status: true,
      },
    });

    if (!printJob) {
      return undefined;
    }

    return this.createRealtimeEvent(
      {
        companyId: printJob.companyId,
        branchId: printJob.branchId,
        orderId: printJob.orderId,
        type,
        channel: RealtimeEventChannel.branch_preparation,
        payload: {
          printJobId: printJob.id,
          kitchenTicketId: printJob.kitchenTicketId,
          kind: printJob.kind,
          status: printJob.status,
        },
      },
      tx,
    );
  }

  private async recordWaiterCallEvent(
    waiterCallId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const waiterCall = await tx.waiterCall.findUnique({
      where: { id: waiterCallId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        orderId: true,
        type: true,
        status: true,
        priority: true,
      },
    });

    if (!waiterCall) {
      throw new NotFoundException("Waiter call not found");
    }

    const payload = {
      waiterCallId: waiterCall.id,
      orderId: waiterCall.orderId,
      type: waiterCall.type,
      status: waiterCall.status,
      priority: waiterCall.priority,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: waiterCall.companyId,
        branchId: waiterCall.branchId,
        tableSessionId: waiterCall.tableSessionId,
        orderId: waiterCall.orderId,
        waiterCallId: waiterCall.id,
        type,
        channel: RealtimeEventChannel.branch_waiter_calls,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: waiterCall.companyId,
        branchId: waiterCall.branchId,
        tableSessionId: waiterCall.tableSessionId,
        orderId: waiterCall.orderId,
        waiterCallId: waiterCall.id,
        type,
        channel: RealtimeEventChannel.session_waiter_calls,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private async recordBillRequestEvent(
    billRequestId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const billRequest = await tx.billRequest.findUnique({
      where: { id: billRequestId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        status: true,
        subtotalMinor: true,
        orderCount: true,
        currency: true,
        requestedAt: true,
        acknowledgedAt: true,
        presentedAt: true,
        closedAt: true,
        cancelledAt: true,
      },
    });

    if (!billRequest) {
      throw new NotFoundException("Bill request not found");
    }

    const payload = {
      billRequestId: billRequest.id,
      status: billRequest.status,
      subtotalMinor: billRequest.subtotalMinor,
      orderCount: billRequest.orderCount,
      currency: billRequest.currency,
      requestedAt: billRequest.requestedAt,
      acknowledgedAt: billRequest.acknowledgedAt,
      presentedAt: billRequest.presentedAt,
      closedAt: billRequest.closedAt,
      cancelledAt: billRequest.cancelledAt,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        billRequestId: billRequest.id,
        type,
        channel: RealtimeEventChannel.branch_orders,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        billRequestId: billRequest.id,
        type,
        channel: RealtimeEventChannel.session_status,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private async recordBillEvent(
    billId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const bill = await tx.bill.findUnique({
      where: { id: billId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        billRequestId: true,
        status: true,
        billNumber: true,
        currency: true,
        subtotalMinor: true,
        totalMinor: true,
        paidMinor: true,
        balanceDueMinor: true,
        orderCount: true,
        lineCount: true,
        requestedAt: true,
        presentedAt: true,
        paidAt: true,
        closedAt: true,
        cancelledAt: true,
      },
    });

    if (!bill) {
      throw new NotFoundException("Bill not found");
    }

    const payload = {
      billId: bill.id,
      billRequestId: bill.billRequestId,
      billNumber: bill.billNumber,
      status: bill.status,
      subtotalMinor: bill.subtotalMinor,
      totalMinor: bill.totalMinor,
      paidMinor: bill.paidMinor,
      balanceDueMinor: bill.balanceDueMinor,
      orderCount: bill.orderCount,
      lineCount: bill.lineCount,
      currency: bill.currency,
      requestedAt: bill.requestedAt,
      presentedAt: bill.presentedAt,
      paidAt: bill.paidAt,
      closedAt: bill.closedAt,
      cancelledAt: bill.cancelledAt,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: bill.companyId,
        branchId: bill.branchId,
        tableSessionId: bill.tableSessionId,
        billRequestId: bill.billRequestId,
        type,
        channel: RealtimeEventChannel.branch_orders,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: bill.companyId,
        branchId: bill.branchId,
        tableSessionId: bill.tableSessionId,
        billRequestId: bill.billRequestId,
        type,
        channel: RealtimeEventChannel.session_status,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private async recordOnlinePaymentEvent(
    onlinePaymentIntentId: string,
    type: RealtimeEventType,
    tx: PrismaExecutor,
  ) {
    const intent = await tx.onlinePaymentIntent.findUnique({
      where: { id: onlinePaymentIntentId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        billId: true,
        provider: true,
        providerIntentId: true,
        status: true,
        amountMinor: true,
        currency: true,
        succeededAt: true,
        failedAt: true,
        cancelledAt: true,
        expiredAt: true,
        bill: {
          select: {
            id: true,
            billRequestId: true,
            billNumber: true,
            status: true,
            totalMinor: true,
            paidMinor: true,
            balanceDueMinor: true,
          },
        },
      },
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    const payload = {
      onlinePaymentIntentId: intent.id,
      provider: intent.provider,
      providerIntentId: intent.providerIntentId,
      status: intent.status,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
      succeededAt: intent.succeededAt,
      failedAt: intent.failedAt,
      cancelledAt: intent.cancelledAt,
      expiredAt: intent.expiredAt,
      billId: intent.billId,
      billRequestId: intent.bill.billRequestId,
      billNumber: intent.bill.billNumber,
      billStatus: intent.bill.status,
      totalMinor: intent.bill.totalMinor,
      paidMinor: intent.bill.paidMinor,
      balanceDueMinor: intent.bill.balanceDueMinor,
    };
    const branchEvent = await this.createRealtimeEvent(
      {
        companyId: intent.companyId,
        branchId: intent.branchId,
        tableSessionId: intent.tableSessionId,
        billRequestId: intent.bill.billRequestId,
        type,
        channel: RealtimeEventChannel.branch_orders,
        payload,
      },
      tx,
    );
    const sessionEvent = await this.createRealtimeEvent(
      {
        companyId: intent.companyId,
        branchId: intent.branchId,
        tableSessionId: intent.tableSessionId,
        billRequestId: intent.bill.billRequestId,
        type,
        channel: RealtimeEventChannel.session_status,
        payload,
      },
      tx,
    );

    return [branchEvent, sessionEvent];
  }

  private branchChannelsFor(channel: BranchRealtimeQueryDto["channel"]) {
    switch (channel) {
      case "orders":
        return [RealtimeEventChannel.branch_orders];
      case "preparation":
        return [RealtimeEventChannel.branch_preparation];
      case "waiter_calls":
        return [RealtimeEventChannel.branch_waiter_calls];
      case "notifications":
        return [RealtimeEventChannel.branch_notifications];
      default:
        return undefined;
    }
  }

  private sessionChannelsFor(channel: SessionRealtimeQueryDto["channel"]) {
    switch (channel) {
      case "status":
        return [RealtimeEventChannel.session_status];
      case "notifications":
        return [RealtimeEventChannel.session_notifications];
      case "waiter_calls":
        return [RealtimeEventChannel.session_waiter_calls];
      default:
        return undefined;
    }
  }

  private matchesChannel(
    channel: RealtimeEventChannel,
    channelFilter: RealtimeEventChannel[] | undefined,
  ) {
    return !channelFilter || channelFilter.includes(channel);
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_EVENT_LIMIT, 1), 100);
  }

  private tableSessionPayload(session: TableSessionRealtimeContext) {
    return {
      tableSessionId: session.id,
      branchId: session.branchId,
      tableId: session.tableId,
      status: session.status,
      guestLabel: session.guestLabel,
      partySize: session.partySize,
    };
  }

  private notificationPayload(notification: NotificationRealtimeContext) {
    return {
      notificationId: notification.id,
      kind: notification.kind,
      status: notification.status,
      title: notification.title,
      body: notification.body,
      orderId: notification.orderId,
      preparationTaskId: notification.preparationTaskId,
      presenceEventId: notification.presenceEventId,
    };
  }

  private createHeartbeatEnvelope(input: {
    companyId: string;
    branchId?: string;
    tableSessionId?: string;
    stream: "branch" | "table_session";
    requestedChannel: string;
  }): RealtimeEventEnvelope {
    const now = new Date();

    return {
      id: `heartbeat:${input.stream}:${input.branchId ?? input.tableSessionId}:${now.getTime()}`,
      type: RealtimeEventType.system,
      channel: RealtimeEventChannel.system,
      scope: {
        companyId: input.companyId,
        branchId: input.branchId,
        tableSessionId: input.tableSessionId,
      },
      payload: {
        kind: "heartbeat",
        stream: input.stream,
        requestedChannel: input.requestedChannel,
      },
      createdAt: now,
    };
  }

  private toSseMessage(event: RealtimeEventEnvelope): MessageEvent {
    return {
      id: event.id,
      type: event.type,
      data: event,
    };
  }

  private toEnvelope(event: RealtimeEventRecord): RealtimeEventEnvelope {
    return {
      id: event.id,
      type: event.type,
      channel: event.channel,
      scope: {
        companyId: event.companyId,
        branchId: event.branchId ?? undefined,
        tableSessionId: event.tableSessionId ?? undefined,
      },
      orderId: event.orderId ?? undefined,
      preparationTaskId: event.preparationTaskId ?? undefined,
      waiterCallId: event.waiterCallId ?? undefined,
      billRequestId: event.billRequestId ?? undefined,
      notificationId: event.notificationId ?? undefined,
      payload: event.payload,
      createdAt: event.createdAt,
    };
  }

  private toJsonPayload(payload: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(payload ?? {})) as Prisma.InputJsonValue;
  }
}

interface TableSessionRealtimeContext {
  id: string;
  companyId: string;
  branchId: string;
  tableId: string;
  status: string;
  guestLabel?: string | null;
  partySize?: number | null;
}

interface NotificationRealtimeContext {
  id: string;
  companyId: string;
  branchId: string;
  tableSessionId?: string | null;
  orderId?: string | null;
  preparationTaskId?: string | null;
  presenceEventId?: string | null;
  kind: string;
  status: string;
  title: string;
  body: string;
}
