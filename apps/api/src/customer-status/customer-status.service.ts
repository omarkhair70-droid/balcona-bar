import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BillRequestEventType,
  BillRequestStatus,
  CartStatus,
  NotificationKind,
  NotificationStatus,
  OrderStatus,
  PreparationStation,
  PreparationTaskStatus,
  Prisma,
  TableSessionEventType,
  WaiterCallEventType,
  WaiterCallType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const CUSTOMER_ORDER_STATUSES = [
  'draft_cart',
  'submitted',
  'cashier_review',
  'accepted',
  'queued_for_preparation',
  'preparing',
  'partially_ready',
  'ready',
  'served',
  'completed',
  'rejected',
  'cancelled',
  'unknown',
] as const;

type CustomerOrderStatus = (typeof CUSTOMER_ORDER_STATUSES)[number];

type TimelineEvent = {
  type: string;
  label: string;
  occurredAt: Date;
  orderId?: string;
  preparationTaskId?: string;
  waiterCallId?: string;
  billRequestId?: string;
  notificationId?: string;
  station?: PreparationStation;
};

const CUSTOMER_ORDER_STATUSES_FOR_SESSION = [
  OrderStatus.submitted,
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.served,
  OrderStatus.completed,
  OrderStatus.cashier_rejected,
  OrderStatus.cancelled,
];

const PREPARATION_STATIONS = [
  PreparationStation.barista,
  PreparationStation.kitchen,
  PreparationStation.dessert,
];

const VISIBLE_NOTIFICATION_STATUSES = [
  NotificationStatus.pending,
  NotificationStatus.sent,
  NotificationStatus.read,
  NotificationStatus.dismissed,
];

@Injectable()
export class CustomerStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderCustomerStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: { select: this.branchSelect() },
        tableSession: {
          select: this.tableSessionWithTableSelect(),
        },
        preparationTasks: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: this.preparationTaskSelect(),
        },
        notifications: {
          where: { status: { in: VISIBLE_NOTIFICATION_STATUSES } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 5,
          select: this.notificationSelect(),
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const summary = this.toOrderStatusSummary(order);
    const { table, ...tableSession } = order.tableSession;
    const { floor, ...tableFields } = table;

    return {
      order: summary.order,
      branch: order.branch,
      tableSession,
      floor,
      table: tableFields,
      customerStatus: summary.customerStatus,
      progress: summary.progress,
      timeline: summary.timeline,
      preparationSummary: summary.preparationSummary,
      latestNotifications: summary.latestNotifications,
    };
  }

  async findTableSessionCustomerStatus(sessionId: string) {
    const tableSession = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: {
        ...this.tableSessionWithTableSelect(),
        branch: { select: this.branchSelect() },
        carts: {
          where: { status: CartStatus.draft },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
          take: 1,
          include: this.cartInclude(),
        },
        orders: {
          where: { status: { in: CUSTOMER_ORDER_STATUSES_FOR_SESSION } },
          orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
          include: {
            preparationTasks: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: this.preparationTaskSelect(),
            },
            notifications: {
              where: { status: { in: VISIBLE_NOTIFICATION_STATUSES } },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 5,
              select: this.notificationSelect(),
            },
          },
        },
        notifications: {
          where: { status: { in: VISIBLE_NOTIFICATION_STATUSES } },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 10,
          select: this.notificationSelect(),
        },
        billRequests: {
          orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
          take: 5,
          select: this.billRequestSummarySelect(),
        },
      },
    });

    if (!tableSession) {
      throw new NotFoundException('Table session not found');
    }

    const {
      branch,
      table,
      carts,
      orders,
      notifications,
      billRequests,
      ...sessionFields
    } = tableSession;
    const { floor, ...tableFields } = table;
    const draftCartSummary = carts[0]
      ? this.toDraftCartSummary(carts[0])
      : null;
    const orderSummaries = orders.map((order) =>
      this.toOrderStatusSummary(order),
    );

    return {
      tableSession: sessionFields,
      branch,
      floor,
      table: tableFields,
      customerStatus: this.getTableSessionCustomerStatus(
        orderSummaries,
        draftCartSummary,
      ),
      draftCartSummary,
      orders: orderSummaries,
      billSummary: this.toBillSummary(billRequests),
      notificationsSummary: this.toNotificationsSummary(notifications),
    };
  }

  async findTableSessionCustomerTimeline(sessionId: string) {
    const tableSession = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: {
        ...this.tableSessionWithTableSelect(),
        branch: { select: this.branchSelect() },
        events: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            type: true,
            createdAt: true,
          },
        },
        orders: {
          where: { status: { in: CUSTOMER_ORDER_STATUSES_FOR_SESSION } },
          orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
          include: {
            preparationTasks: {
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              select: this.preparationTaskSelect(),
            },
            notifications: {
              where: { status: { in: VISIBLE_NOTIFICATION_STATUSES } },
              orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
              take: 5,
              select: this.notificationSelect(),
            },
          },
        },
        notifications: {
          where: { status: { in: VISIBLE_NOTIFICATION_STATUSES } },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: this.notificationSelect(),
        },
        waiterCalls: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          select: this.waiterCallTimelineSelect(),
        },
        billRequests: {
          orderBy: [{ requestedAt: 'asc' }, { createdAt: 'asc' }],
          select: this.billRequestTimelineSelect(),
        },
      },
    });

    if (!tableSession) {
      throw new NotFoundException('Table session not found');
    }

    const {
      branch,
      table,
      events,
      orders,
      notifications,
      waiterCalls,
      billRequests,
      ...sessionFields
    } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      tableSession: sessionFields,
      branch,
      floor,
      table: tableFields,
      timeline: this.sortTimeline([
        ...this.toSessionTimelineEvents(events),
        ...orders.flatMap((order) => this.toOrderTimelineEvents(order)),
        ...waiterCalls.flatMap((waiterCall) =>
          this.toWaiterCallTimelineEvents(waiterCall),
        ),
        ...billRequests.flatMap((billRequest) =>
          this.toBillRequestTimelineEvents(billRequest),
        ),
        ...this.toNotificationTimelineEvents(notifications),
      ]),
    };
  }

  private toOrderStatusSummary(order: any) {
    const progress = this.toProgress(order.preparationTasks ?? []);
    const preparationSummary = this.toPreparationSummary(
      order.preparationTasks ?? [],
    );

    return {
      order: this.toCustomerOrder(order),
      customerStatus: this.toCustomerOrderStatus(order, progress),
      progress,
      preparationSummary,
      timeline: this.toOrderTimelineEvents(order),
      latestNotifications: (order.notifications ?? []).map((notification) =>
        this.toCustomerNotification(notification),
      ),
    };
  }

  private toCustomerOrderStatus(
    order: any,
    progress: ReturnType<CustomerStatusService['toProgress']>,
  ): CustomerOrderStatus {
    if (order.status === OrderStatus.submitted) {
      return 'cashier_review';
    }

    if (order.status === OrderStatus.cashier_rejected) {
      return 'rejected';
    }

    if (order.status === OrderStatus.cancelled) {
      return 'cancelled';
    }

    if (order.status === OrderStatus.preparing) {
      return 'preparing';
    }

    if (order.status === OrderStatus.ready) {
      return 'ready';
    }

    if (order.status === OrderStatus.served) {
      return 'served';
    }

    if (order.status === OrderStatus.completed) {
      return 'completed';
    }

    if (order.status === OrderStatus.cashier_accepted) {
      if (progress.totalPreparationTasks === 0) {
        return 'accepted';
      }

      if (progress.readyTasks === progress.totalPreparationTasks) {
        return 'ready';
      }

      if (progress.readyTasks > 0) {
        return 'partially_ready';
      }

      if (progress.preparingTasks > 0) {
        return 'preparing';
      }

      return 'queued_for_preparation';
    }

    return 'unknown';
  }

  private getTableSessionCustomerStatus(
    orderSummaries: Array<{ customerStatus: CustomerOrderStatus }>,
    draftCartSummary: ReturnType<
      CustomerStatusService['toDraftCartSummary']
    > | null,
  ): CustomerOrderStatus {
    if (orderSummaries.length === 0) {
      return draftCartSummary && draftCartSummary.totals.itemCount > 0
        ? 'draft_cart'
        : 'unknown';
    }

    return orderSummaries[0].customerStatus;
  }

  private toProgress(tasks: any[]) {
    const pendingTasks = this.countTasks(tasks, PreparationTaskStatus.pending);
    const preparingTasks = this.countTasks(
      tasks,
      PreparationTaskStatus.preparing,
    );
    const readyTasks = this.countTasks(tasks, PreparationTaskStatus.ready);
    const cancelledTasks = this.countTasks(
      tasks,
      PreparationTaskStatus.cancelled,
    );
    const totalPreparationTasks = tasks.length;

    return {
      totalPreparationTasks,
      pendingTasks,
      preparingTasks,
      readyTasks,
      cancelledTasks,
      readyRatio:
        totalPreparationTasks > 0
          ? Number((readyTasks / totalPreparationTasks).toFixed(2))
          : null,
    };
  }

  private toPreparationSummary(tasks: any[]) {
    return PREPARATION_STATIONS.reduce(
      (summary, station) => {
        const stationTasks = tasks.filter((task) => task.station === station);

        summary[station] = {
          total: stationTasks.length,
          pending: this.countTasks(stationTasks, PreparationTaskStatus.pending),
          preparing: this.countTasks(
            stationTasks,
            PreparationTaskStatus.preparing,
          ),
          ready: this.countTasks(stationTasks, PreparationTaskStatus.ready),
          cancelled: this.countTasks(
            stationTasks,
            PreparationTaskStatus.cancelled,
          ),
        };

        return summary;
      },
      {} as Record<
        PreparationStation,
        {
          total: number;
          pending: number;
          preparing: number;
          ready: number;
          cancelled: number;
        }
      >,
    );
  }

  private countTasks(tasks: any[], status: PreparationTaskStatus) {
    return tasks.filter((task) => task.status === status).length;
  }

  private toOrderTimelineEvents(order: any): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    if (order.submittedAt) {
      events.push({
        type: 'order-submitted',
        label: `Order ${order.orderNumber} was sent to the cashier.`,
        occurredAt: order.submittedAt,
        orderId: order.id,
      });
    }

    if (order.cashierAcceptedAt) {
      events.push({
        type: 'cashier-accepted',
        label: `Order ${order.orderNumber} was accepted.`,
        occurredAt: order.cashierAcceptedAt,
        orderId: order.id,
      });
    }

    if (order.cashierRejectedAt) {
      events.push({
        type: 'cashier-rejected',
        label: `Order ${order.orderNumber} could not be accepted.`,
        occurredAt: order.cashierRejectedAt,
        orderId: order.id,
      });
    }

    if (order.preparingAt) {
      events.push({
        type: 'order-preparing',
        label: `Order ${order.orderNumber} preparation started.`,
        occurredAt: order.preparingAt,
        orderId: order.id,
      });
    }

    if (order.readyAt) {
      events.push({
        type: 'order-ready',
        label: `Order ${order.orderNumber} is ready.`,
        occurredAt: order.readyAt,
        orderId: order.id,
      });
    }

    if (order.servedAt) {
      events.push({
        type: 'order-served',
        label: `Order ${order.orderNumber} was served to the table.`,
        occurredAt: order.servedAt,
        orderId: order.id,
      });
    }

    if (order.completedAt) {
      events.push({
        type: 'order-completed',
        label: `Order ${order.orderNumber} was completed.`,
        occurredAt: order.completedAt,
        orderId: order.id,
      });
    }

    for (const task of order.preparationTasks ?? []) {
      events.push({
        type: 'preparation-queued',
        label: `${task.itemNameSnapshot} was queued for ${this.stationLabel(task.station)}.`,
        occurredAt: task.createdAt,
        orderId: order.id,
        preparationTaskId: task.id,
        station: task.station,
      });

      if (task.startedAt) {
        events.push({
          type: 'preparation-started',
          label: `${task.itemNameSnapshot} preparation started.`,
          occurredAt: task.startedAt,
          orderId: order.id,
          preparationTaskId: task.id,
          station: task.station,
        });
      }

      if (task.readyAt) {
        events.push({
          type: 'preparation-ready',
          label: `${task.itemNameSnapshot} is ready.`,
          occurredAt: task.readyAt,
          orderId: order.id,
          preparationTaskId: task.id,
          station: task.station,
        });
      }

      if (task.cancelledAt) {
        events.push({
          type: 'preparation-cancelled',
          label: `${task.itemNameSnapshot} preparation was cancelled.`,
          occurredAt: task.cancelledAt,
          orderId: order.id,
          preparationTaskId: task.id,
          station: task.station,
        });
      }
    }

    return this.sortTimeline(events);
  }

  private toSessionTimelineEvents(events: any[]): TimelineEvent[] {
    return events
      .filter((event) =>
        [
          TableSessionEventType.created,
          TableSessionEventType.resumed,
          TableSessionEventType.closed,
        ].includes(event.type),
      )
      .map((event) => ({
        type:
          event.type === TableSessionEventType.created
            ? 'session-started'
            : event.type === TableSessionEventType.resumed
              ? 'session-resumed'
              : 'session-closed',
        label:
          event.type === TableSessionEventType.created
            ? 'Table session started.'
            : event.type === TableSessionEventType.resumed
              ? 'Table session resumed.'
              : 'Table session closed.',
        occurredAt: event.createdAt,
      }));
  }

  private toNotificationTimelineEvents(notifications: any[]): TimelineEvent[] {
    return notifications.flatMap((notification) => {
      const events: TimelineEvent[] = [];

      events.push({
        type: 'notification-sent',
        label: `${this.notificationKindLabel(notification.kind)} notification sent.`,
        occurredAt: notification.sentAt ?? notification.createdAt,
        notificationId: notification.id,
      });

      if (notification.readAt) {
        events.push({
          type: 'notification-read',
          label: `${this.notificationKindLabel(notification.kind)} notification read.`,
          occurredAt: notification.readAt,
          notificationId: notification.id,
        });
      }

      if (notification.dismissedAt) {
        events.push({
          type: 'notification-dismissed',
          label: `${this.notificationKindLabel(notification.kind)} notification dismissed.`,
          occurredAt: notification.dismissedAt,
          notificationId: notification.id,
        });
      }

      return events;
    });
  }

  private toWaiterCallTimelineEvents(waiterCall: any): TimelineEvent[] {
    return waiterCall.events.map((event: any) => ({
      type: this.waiterCallTimelineType(event.type),
      label: this.waiterCallTimelineLabel(event.type, waiterCall.type),
      occurredAt: event.createdAt,
      waiterCallId: waiterCall.id,
      orderId: waiterCall.orderId ?? undefined,
    }));
  }

  private toBillRequestTimelineEvents(billRequest: any): TimelineEvent[] {
    return billRequest.events.map((event: any) => ({
      type: this.billRequestTimelineType(event.type),
      label: this.billRequestTimelineLabel(event.type),
      occurredAt: event.createdAt,
      billRequestId: billRequest.id,
    }));
  }

  private billRequestTimelineType(type: BillRequestEventType) {
    switch (type) {
      case BillRequestEventType.created:
        return 'bill-requested';
      case BillRequestEventType.acknowledged:
        return 'bill-acknowledged';
      case BillRequestEventType.presented:
        return 'bill-presented';
      case BillRequestEventType.closed:
        return 'bill-closed';
      case BillRequestEventType.cancelled:
        return 'bill-cancelled';
      default:
        return 'bill-updated';
    }
  }

  private billRequestTimelineLabel(type: BillRequestEventType) {
    switch (type) {
      case BillRequestEventType.created:
        return 'Bill request was sent to staff.';
      case BillRequestEventType.acknowledged:
        return 'Bill request was acknowledged.';
      case BillRequestEventType.presented:
        return 'Bill was presented operationally.';
      case BillRequestEventType.closed:
        return 'Bill request was closed operationally.';
      case BillRequestEventType.cancelled:
        return 'Bill request was cancelled.';
      default:
        return 'Bill request was updated.';
    }
  }

  private waiterCallTimelineType(type: WaiterCallEventType) {
    switch (type) {
      case WaiterCallEventType.created:
        return 'waiter-call-created';
      case WaiterCallEventType.acknowledged:
        return 'waiter-call-acknowledged';
      case WaiterCallEventType.resolved:
        return 'waiter-call-resolved';
      case WaiterCallEventType.cancelled:
        return 'waiter-call-cancelled';
      default:
        return 'waiter-call-updated';
    }
  }

  private waiterCallTimelineLabel(
    eventType: WaiterCallEventType,
    callType: WaiterCallType,
  ) {
    const requestLabel = this.waiterCallTypeLabel(callType);

    switch (eventType) {
      case WaiterCallEventType.created:
        return `${requestLabel} request was sent to staff.`;
      case WaiterCallEventType.acknowledged:
        return `${requestLabel} request was acknowledged.`;
      case WaiterCallEventType.resolved:
        return `${requestLabel} request was handled.`;
      case WaiterCallEventType.cancelled:
        return `${requestLabel} request was cancelled.`;
      default:
        return `${requestLabel} request was updated.`;
    }
  }

  private sortTimeline(events: TimelineEvent[]) {
    return events.sort(
      (left, right) => left.occurredAt.getTime() - right.occurredAt.getTime(),
    );
  }

  private toCustomerOrder(order: any) {
    return {
      id: order.id,
      companyId: order.companyId,
      branchId: order.branchId,
      tableSessionId: order.tableSessionId,
      orderNumber: order.orderNumber,
      status: order.status,
      currency: order.currency,
      subtotalMinor: order.subtotalMinor,
      totalQuantity: order.totalQuantity,
      itemCount: order.itemCount,
      customerNote: order.customerNote,
      submittedAt: order.submittedAt,
      cashierAcceptedAt: order.cashierAcceptedAt,
      cashierRejectedAt: order.cashierRejectedAt,
      rejectionReason: order.rejectionReason,
      preparingAt: order.preparingAt,
      readyAt: order.readyAt,
      servedAt: order.servedAt,
      completedAt: order.completedAt,
      servedByStaffUserId: order.servedByStaffUserId,
      completedByStaffUserId: order.completedByStaffUserId,
      completionNote: order.completionNote,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private toDraftCartSummary(cart: any) {
    const subtotalMinor = cart.items.reduce(
      (sum: number, item: any) => sum + item.lineTotalMinorSnapshot,
      0,
    );
    const totalQuantity = cart.items.reduce(
      (sum: number, item: any) => sum + item.quantity,
      0,
    );

    return {
      cart: {
        id: cart.id,
        tableSessionId: cart.tableSessionId,
        status: cart.status,
        currency: cart.currency,
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt,
      },
      items: cart.items.map((item: any) => ({
        id: item.id,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        itemNameSnapshot: item.itemNameSnapshot,
        lineTotalMinorSnapshot: item.lineTotalMinorSnapshot,
        currency: item.currency,
      })),
      totals: {
        subtotalMinor,
        totalQuantity,
        itemCount: cart.items.length,
        currency: cart.currency,
      },
    };
  }

  private toNotificationsSummary(notifications: any[]) {
    return {
      total: notifications.length,
      pending: this.countNotifications(
        notifications,
        NotificationStatus.pending,
      ),
      sent: this.countNotifications(notifications, NotificationStatus.sent),
      read: this.countNotifications(notifications, NotificationStatus.read),
      dismissed: this.countNotifications(
        notifications,
        NotificationStatus.dismissed,
      ),
      unreadOrSent: notifications.filter((notification) =>
        [NotificationStatus.pending, NotificationStatus.sent].includes(
          notification.status,
        ),
      ).length,
      latest: notifications
        .slice(0, 5)
        .map((notification) => this.toCustomerNotification(notification)),
    };
  }

  private toBillSummary(billRequests: any[]) {
    const activeBillRequest = billRequests.find((billRequest) =>
      [
        BillRequestStatus.open,
        BillRequestStatus.acknowledged,
        BillRequestStatus.presented,
      ].includes(billRequest.status),
    );

    return {
      activeBillRequest: activeBillRequest
        ? this.toCustomerBillRequest(activeBillRequest)
        : null,
      latestBillRequests: billRequests.map((billRequest) =>
        this.toCustomerBillRequest(billRequest),
      ),
    };
  }

  private toCustomerBillRequest(billRequest: any) {
    return {
      id: billRequest.id,
      tableSessionId: billRequest.tableSessionId,
      status: billRequest.status,
      currency: billRequest.currency,
      subtotalMinor: billRequest.subtotalMinor,
      orderCount: billRequest.orderCount,
      requestedAt: billRequest.requestedAt,
      acknowledgedAt: billRequest.acknowledgedAt,
      presentedAt: billRequest.presentedAt,
      closedAt: billRequest.closedAt,
      cancelledAt: billRequest.cancelledAt,
      note: billRequest.note,
      cancellationReason: billRequest.cancellationReason,
      createdAt: billRequest.createdAt,
      updatedAt: billRequest.updatedAt,
    };
  }

  private countNotifications(notifications: any[], status: NotificationStatus) {
    return notifications.filter(
      (notification) => notification.status === status,
    ).length;
  }

  private toCustomerNotification(notification: any) {
    return {
      id: notification.id,
      kind: notification.kind,
      channel: notification.channel,
      status: notification.status,
      title: notification.title,
      body: notification.body,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      dismissedAt: notification.dismissedAt,
      createdAt: notification.createdAt,
    };
  }

  private stationLabel(station: PreparationStation) {
    switch (station) {
      case PreparationStation.barista:
        return 'barista';
      case PreparationStation.kitchen:
        return 'kitchen';
      case PreparationStation.dessert:
        return 'dessert station';
      default:
        return 'the team';
    }
  }

  private notificationKindLabel(kind: NotificationKind) {
    switch (kind) {
      case NotificationKind.welcome:
        return 'Welcome';
      case NotificationKind.order_submitted:
        return 'Order submitted';
      case NotificationKind.order_accepted:
        return 'Order accepted';
      case NotificationKind.order_rejected:
        return 'Order rejected';
      case NotificationKind.preparation_started:
        return 'Preparation started';
      case NotificationKind.preparation_ready:
        return 'Preparation ready';
      case NotificationKind.order_served:
        return 'Order served';
      case NotificationKind.bill_requested:
        return 'Bill requested';
      case NotificationKind.bill_presented:
        return 'Bill presented';
      case NotificationKind.bill_closed:
        return 'Bill closed';
      case NotificationKind.waiter_call:
        return 'Waiter call';
      default:
        return 'System';
    }
  }

  private waiterCallTypeLabel(type: WaiterCallType) {
    switch (type) {
      case WaiterCallType.need_bill:
        return 'Bill';
      case WaiterCallType.need_water:
        return 'Water';
      case WaiterCallType.need_help:
        return 'Help';
      case WaiterCallType.order_problem:
        return 'Order help';
      case WaiterCallType.clean_table:
        return 'Table cleaning';
      case WaiterCallType.other:
        return 'Waiter';
      case WaiterCallType.call_waiter:
      default:
        return 'Waiter';
    }
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

  private tableSessionWithTableSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
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

  private preparationTaskSelect() {
    return {
      id: true,
      orderId: true,
      orderItemId: true,
      station: true,
      status: true,
      quantity: true,
      itemNameSnapshot: true,
      itemSlugSnapshot: true,
      startedAt: true,
      readyAt: true,
      cancelledAt: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.PreparationTaskSelect;
  }

  private notificationSelect() {
    return {
      id: true,
      kind: true,
      channel: true,
      status: true,
      title: true,
      body: true,
      sentAt: true,
      readAt: true,
      dismissedAt: true,
      createdAt: true,
    } satisfies Prisma.NotificationSelect;
  }

  private waiterCallTimelineSelect() {
    return {
      id: true,
      orderId: true,
      type: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      resolvedAt: true,
      cancelledAt: true,
      events: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          type: true,
          actorType: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.WaiterCallSelect;
  }

  private billRequestSummarySelect() {
    return {
      id: true,
      tableSessionId: true,
      status: true,
      currency: true,
      subtotalMinor: true,
      orderCount: true,
      requestedAt: true,
      acknowledgedAt: true,
      presentedAt: true,
      closedAt: true,
      cancelledAt: true,
      note: true,
      cancellationReason: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.BillRequestSelect;
  }

  private billRequestTimelineSelect() {
    return {
      id: true,
      status: true,
      events: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          type: true,
          actorType: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.BillRequestSelect;
  }

  private cartInclude() {
    return {
      items: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
    } satisfies Prisma.CartInclude;
  }
}
