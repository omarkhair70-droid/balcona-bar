import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationKind,
  NotificationStatus,
  PreparationStation,
  PresenceTriggerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { BranchNotificationsQueryDto } from './dto/branch-notifications-query.dto';
import { BranchPresenceEventsQueryDto } from './dto/branch-presence-events-query.dto';
import { CreatePresenceEventDto } from './dto/create-presence-event.dto';

const WELCOME_TITLE = 'أهلاً بيك في Balcona Bar';
const WELCOME_BODY =
  'أهلاً بيك في Balcona Bar 👋 الويتر الذكي جاهز يخدمك. تقدر تطلب، تسأل، أو تنادي ويتر في أي وقت.';

const API_WELCOME_TRIGGER_TYPES: PresenceTriggerType[] = [
  PresenceTriggerType.wifi_portal_entered,
  PresenceTriggerType.beacon_detected,
  PresenceTriggerType.geofence_entered,
  PresenceTriggerType.app_opened_near_venue,
  PresenceTriggerType.manual_staff_trigger,
];

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type TableSessionForNotification = {
  id: string;
  companyId: string;
  branchId: string;
  guestLabel?: string | null;
};

type BranchContext = {
  id: string;
  companyId: string;
};

type NotificationCreateInput = {
  companyId: string;
  branchId: string;
  tableSessionId?: string;
  customerSessionIdentityId?: string;
  orderId?: string;
  preparationTaskId?: string;
  presenceEventId?: string;
  kind: NotificationKind;
  title: string;
  body: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
};

type WaiterCallNotificationCopy = {
  title: string;
  body: string;
  dedupeKey: string;
};

@Injectable()
export class PresenceNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async recordQrTableSessionPresence(
    session: TableSessionForNotification,
    triggerType: PresenceTriggerType,
    tx: Prisma.TransactionClient,
  ) {
    const customerIdentity =
      await this.ensureCustomerSessionIdentityForTableSession(session, tx);
    const presenceEvent = await tx.presenceEvent.create({
      data: {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        customerSessionIdentityId: customerIdentity.id,
        triggerType,
        metadata: { source: 'table_session_qr_flow' },
      },
      include: this.presenceEventInclude(),
    });
    const notification = await this.ensureWelcomeNotification(
      session,
      customerIdentity.id,
      presenceEvent.id,
      tx,
    );

    return {
      presenceEvent,
      notification,
    };
  }

  async createPresenceEvent(body: CreatePresenceEventDto) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(body.branchId, tx);
      const tableSession = await this.findOwnedTableSession(
        body.tableSessionId,
        branch,
        tx,
      );

      await this.assertOwnedVenueZone(body.venueZoneId, branch, tx);
      const providedCustomerIdentity = await this.findOwnedCustomerIdentity(
        body.customerSessionIdentityId,
        branch,
        tableSession?.id,
        tx,
      );
      await this.assertOwnedDeviceSubscription(
        body.deviceSubscriptionId,
        branch,
        tableSession?.id,
        providedCustomerIdentity?.id,
        tx,
      );

      const customerIdentity =
        providedCustomerIdentity ??
        (tableSession
          ? await this.ensureCustomerSessionIdentityForTableSession(
              tableSession,
              tx,
            )
          : null);
      const triggerType = body.triggerType as PresenceTriggerType;
      const presenceEvent = await tx.presenceEvent.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          tableSessionId: tableSession?.id,
          venueZoneId: body.venueZoneId,
          customerSessionIdentityId: customerIdentity?.id,
          deviceSubscriptionId: body.deviceSubscriptionId,
          triggerType,
          sourceChannel: body.sourceChannel as NotificationChannel | undefined,
          metadata: body.metadata as Prisma.InputJsonValue | undefined,
        },
        include: this.presenceEventInclude(),
      });

      const createdNotification =
        tableSession && API_WELCOME_TRIGGER_TYPES.includes(triggerType)
          ? await this.ensureWelcomeNotification(
              tableSession,
              customerIdentity?.id,
              presenceEvent.id,
              tx,
            )
          : null;

      return {
        presenceEvent,
        ...(createdNotification
          ? {
              createdNotification:
                this.toNotificationResponse(createdNotification),
            }
          : {}),
        ...(!tableSession
          ? {
              note: 'Presence event recorded without a table session; no notification was created.',
            }
          : {}),
      };
    });
  }

  async createOrderSubmittedNotification(
    orderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const order = await this.findOrderNotificationContext(orderId, tx);

    return this.createInAppNotification(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          order.tableSessionId,
          tx,
        ),
        orderId: order.id,
        kind: NotificationKind.order_submitted,
        title: 'تم إرسال طلبك',
        body: `استلمنا طلبك ${order.orderNumber}. الكاشير بيراجعه دلوقتي.`,
        dedupeKey: `order-submitted:${order.id}`,
        metadata: { orderNumber: order.orderNumber },
      },
      tx,
    );
  }

  async createOrderAcceptedNotification(
    orderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const order = await this.findOrderNotificationContext(orderId, tx);

    return this.createInAppNotification(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          order.tableSessionId,
          tx,
        ),
        orderId: order.id,
        kind: NotificationKind.order_accepted,
        title: 'تم قبول طلبك',
        body: `تم قبول طلبك ${order.orderNumber}. الفريق بدأ يجهزه.`,
        dedupeKey: `order-accepted:${order.id}`,
        metadata: { orderNumber: order.orderNumber },
      },
      tx,
    );
  }

  async createOrderRejectedNotification(
    orderId: string,
    reason: string | null,
    tx: Prisma.TransactionClient,
  ) {
    const order = await this.findOrderNotificationContext(orderId, tx);
    const reasonText = reason ? ` السبب: ${reason}` : '';

    return this.createInAppNotification(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          order.tableSessionId,
          tx,
        ),
        orderId: order.id,
        kind: NotificationKind.order_rejected,
        title: 'تعذر قبول طلبك',
        body: `الكاشير لم يقبل طلبك ${order.orderNumber}.${reasonText}`,
        dedupeKey: `order-rejected:${order.id}`,
        metadata: {
          orderNumber: order.orderNumber,
          ...(reason ? { reason } : {}),
        },
      },
      tx,
    );
  }

  async createOrderServedNotification(
    orderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const order = await this.findOrderNotificationContext(orderId, tx);

    return this.createInAppNotification(
      {
        companyId: order.companyId,
        branchId: order.branchId,
        tableSessionId: order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          order.tableSessionId,
          tx,
        ),
        orderId: order.id,
        kind: NotificationKind.order_served,
        title: 'طلبك وصل للترابيزة',
        body: `طلبك ${order.orderNumber} وصل للترابيزة.`,
        dedupeKey: `order-served:${order.id}`,
        metadata: { orderNumber: order.orderNumber },
      },
      tx,
    );
  }

  async createBillRequestedNotification(
    billRequestId: string,
    tx: Prisma.TransactionClient,
  ) {
    const billRequest = await this.findBillRequestNotificationContext(
      billRequestId,
      tx,
    );

    return this.createInAppNotification(
      {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          billRequest.tableSessionId,
          tx,
        ),
        kind: NotificationKind.bill_requested,
        title: 'طلب الحساب اتسجل',
        body: `طلب الحساب اتسجل بإجمالي ${billRequest.subtotalMinor} ${billRequest.currency}.`,
        dedupeKey: `bill-requested:${billRequest.id}`,
        metadata: this.billRequestNotificationMetadata(billRequest),
      },
      tx,
    );
  }

  async createBillPresentedNotification(
    billRequestId: string,
    tx: Prisma.TransactionClient,
  ) {
    const billRequest = await this.findBillRequestNotificationContext(
      billRequestId,
      tx,
    );

    return this.createInAppNotification(
      {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          billRequest.tableSessionId,
          tx,
        ),
        kind: NotificationKind.bill_presented,
        title: 'الحساب في الطريق',
        body: 'تم تقديم الحساب تشغيلياً للفريق.',
        dedupeKey: `bill-presented:${billRequest.id}`,
        metadata: this.billRequestNotificationMetadata(billRequest),
      },
      tx,
    );
  }

  async createBillClosedNotification(
    billRequestId: string,
    tx: Prisma.TransactionClient,
  ) {
    const billRequest = await this.findBillRequestNotificationContext(
      billRequestId,
      tx,
    );

    return this.createInAppNotification(
      {
        companyId: billRequest.companyId,
        branchId: billRequest.branchId,
        tableSessionId: billRequest.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          billRequest.tableSessionId,
          tx,
        ),
        kind: NotificationKind.bill_closed,
        title: 'تم إغلاق الحساب تشغيلياً',
        body: 'تم إغلاق طلب الحساب تشغيلياً بدون معالجة دفع.',
        dedupeKey: `bill-closed:${billRequest.id}`,
        metadata: this.billRequestNotificationMetadata(billRequest),
      },
      tx,
    );
  }

  async createPreparationReadyNotification(
    preparationTaskId: string,
    tx: Prisma.TransactionClient,
  ) {
    const task = await tx.preparationTask.findUnique({
      where: { id: preparationTaskId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        orderId: true,
        station: true,
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
      throw new NotFoundException('Preparation task not found');
    }

    return this.createInAppNotification(
      {
        companyId: task.companyId,
        branchId: task.branchId,
        tableSessionId: task.order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          task.order.tableSessionId,
          tx,
        ),
        orderId: task.orderId,
        preparationTaskId: task.id,
        kind: NotificationKind.preparation_ready,
        title: 'جزء من طلبك جاهز',
        body: `${task.itemNameSnapshot} جاهز من ${this.stationLabel(task.station)}.`,
        dedupeKey: `preparation-ready:${task.id}`,
        metadata: {
          orderNumber: task.order.orderNumber,
          station: task.station,
        },
      },
      tx,
    );
  }

  async createPreparationStartedNotification(
    preparationTaskId: string,
    tx: Prisma.TransactionClient,
  ) {
    const task = await tx.preparationTask.findUnique({
      where: { id: preparationTaskId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        orderId: true,
        station: true,
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
      throw new NotFoundException('Preparation task not found');
    }

    return this.createInAppNotification(
      {
        companyId: task.companyId,
        branchId: task.branchId,
        tableSessionId: task.order.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          task.order.tableSessionId,
          tx,
        ),
        orderId: task.orderId,
        preparationTaskId: task.id,
        kind: NotificationKind.preparation_started,
        title: 'بدأ تجهيز طلبك',
        body: `${task.itemNameSnapshot} بدأ تجهيزه في ${this.stationLabel(task.station)}.`,
        dedupeKey: `preparation-started:${task.id}`,
        metadata: {
          orderNumber: task.order.orderNumber,
          station: task.station,
        },
      },
      tx,
    );
  }

  async createWaiterCallCreatedNotification(
    waiterCallId: string,
    tx: Prisma.TransactionClient,
  ) {
    return this.createWaiterCallNotification(
      waiterCallId,
      {
        title: 'طلبك وصل للويتر',
        body: 'استلمنا طلبك. الويتر هيجيلك في أقرب وقت.',
        dedupeKey: `waiter-call-created:${waiterCallId}`,
      },
      tx,
    );
  }

  async createWaiterCallAcknowledgedNotification(
    waiterCallId: string,
    tx: Prisma.TransactionClient,
  ) {
    return this.createWaiterCallNotification(
      waiterCallId,
      {
        title: 'الويتر في الطريق',
        body: 'تم تأكيد طلبك. الويتر جاي يساعدك.',
        dedupeKey: `waiter-call-acknowledged:${waiterCallId}`,
      },
      tx,
    );
  }

  async createWaiterCallResolvedNotification(
    waiterCallId: string,
    tx: Prisma.TransactionClient,
  ) {
    return this.createWaiterCallNotification(
      waiterCallId,
      {
        title: 'تم التعامل مع طلبك',
        body: 'طلب المساعدة اتسجل إنه اتعامل. شكراً ليك.',
        dedupeKey: `waiter-call-resolved:${waiterCallId}`,
      },
      tx,
    );
  }

  async findForTableSession(sessionId: string) {
    const tableSession = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!tableSession) {
      throw new NotFoundException('Table session not found');
    }

    const notifications = await this.prisma.notification.findMany({
      where: { tableSessionId: sessionId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.notificationInclude(),
    });

    return {
      tableSession,
      notifications: notifications.map((notification) =>
        this.toNotificationResponse(notification),
      ),
    };
  }

  async markRead(notificationId: string) {
    await this.assertNotificationExists(notificationId);

    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.read,
        readAt: new Date(),
      },
      include: this.notificationInclude(),
    });

    await this.realtimeEventsService.recordNotificationRead(notification);

    return this.toNotificationResponse(notification);
  }

  async dismiss(notificationId: string) {
    await this.assertNotificationExists(notificationId);

    const notification = await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.dismissed,
        dismissedAt: new Date(),
      },
      include: this.notificationInclude(),
    });

    await this.realtimeEventsService.recordNotificationDismissed(notification);

    return this.toNotificationResponse(notification);
  }

  async findPresenceEventsForBranch(
    branchId: string,
    query: BranchPresenceEventsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const events = await this.prisma.presenceEvent.findMany({
      where: {
        branchId,
        ...(query.triggerType
          ? { triggerType: query.triggerType as PresenceTriggerType }
          : {}),
        ...(query.tableSessionId
          ? { tableSessionId: query.tableSessionId }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      include: this.presenceEventInclude(),
    });

    return {
      branch,
      filters: {
        triggerType: query.triggerType ?? 'all',
        tableSessionId: query.tableSessionId ?? null,
      },
      events,
    };
  }

  async findNotificationsForBranch(
    branchId: string,
    query: BranchNotificationsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const status = query.status ?? 'all';
    const kind = query.kind ?? 'all';
    const notifications = await this.prisma.notification.findMany({
      where: {
        branchId,
        ...(status === 'all' ? {} : { status: status as NotificationStatus }),
        ...(kind === 'all' ? {} : { kind: kind as NotificationKind }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: this.notificationInclude(),
    });

    return {
      branch,
      filters: {
        status,
        kind,
      },
      notifications: notifications.map((notification) =>
        this.toNotificationResponse(notification),
      ),
    };
  }

  private async ensureCustomerSessionIdentityForTableSession(
    session: TableSessionForNotification,
    tx: PrismaExecutor,
  ) {
    const existingIdentity = await tx.customerSessionIdentity.findFirst({
      where: { tableSessionId: session.id },
      select: { id: true },
    });

    if (existingIdentity) {
      return existingIdentity;
    }

    return tx.customerSessionIdentity.create({
      data: {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        displayName: session.guestLabel ?? undefined,
        locale: 'ar-EG',
      },
      select: { id: true },
    });
  }

  private async ensureWelcomeNotification(
    session: TableSessionForNotification,
    customerSessionIdentityId: string | undefined,
    presenceEventId: string | undefined,
    tx: PrismaExecutor,
  ) {
    return this.createInAppNotification(
      {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.id,
        customerSessionIdentityId,
        presenceEventId,
        kind: NotificationKind.welcome,
        title: WELCOME_TITLE,
        body: WELCOME_BODY,
        dedupeKey: `welcome:table-session:${session.id}`,
        metadata: { source: 'presence_trigger' },
      },
      tx,
    );
  }

  private async createInAppNotification(
    input: NotificationCreateInput,
    tx: PrismaExecutor,
  ) {
    if (input.dedupeKey) {
      const existingNotification = await tx.notification.findUnique({
        where: { dedupeKey: input.dedupeKey },
        include: this.notificationInclude(),
      });

      if (existingNotification) {
        return existingNotification;
      }
    }

    const now = new Date();

    const notification = await tx.notification.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId,
        tableSessionId: input.tableSessionId,
        customerSessionIdentityId: input.customerSessionIdentityId,
        orderId: input.orderId,
        preparationTaskId: input.preparationTaskId,
        presenceEventId: input.presenceEventId,
        kind: input.kind,
        channel: NotificationChannel.in_app,
        status: NotificationStatus.sent,
        title: input.title,
        body: input.body,
        dedupeKey: input.dedupeKey,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
        sentAt: now,
        deliveries: {
          create: {
            channel: NotificationChannel.in_app,
            status: NotificationDeliveryStatus.sent,
            sentAt: now,
          },
        },
      },
      include: this.notificationInclude(),
    });

    await this.realtimeEventsService.recordNotificationCreated(
      notification,
      tx,
    );

    return notification;
  }

  private async createWaiterCallNotification(
    waiterCallId: string,
    copy: WaiterCallNotificationCopy,
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
      },
    });

    if (!waiterCall) {
      throw new NotFoundException('Waiter call not found');
    }

    return this.createInAppNotification(
      {
        companyId: waiterCall.companyId,
        branchId: waiterCall.branchId,
        tableSessionId: waiterCall.tableSessionId,
        customerSessionIdentityId: await this.findCustomerIdentityId(
          waiterCall.tableSessionId,
          tx,
        ),
        orderId: waiterCall.orderId ?? undefined,
        kind: NotificationKind.waiter_call,
        title: copy.title,
        body: copy.body,
        dedupeKey: copy.dedupeKey,
        metadata: {
          waiterCallId: waiterCall.id,
          type: waiterCall.type,
          status: waiterCall.status,
        },
      },
      tx,
    );
  }

  private async findBranchOrThrow(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: { id: true, companyId: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findOwnedTableSession(
    tableSessionId: string | undefined,
    branch: BranchContext,
    tx: PrismaExecutor,
  ) {
    if (!tableSessionId) {
      return null;
    }

    const tableSession = await tx.tableSession.findUnique({
      where: { id: tableSessionId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        guestLabel: true,
      },
    });

    if (!tableSession) {
      throw new NotFoundException('Table session not found');
    }

    if (
      tableSession.branchId !== branch.id ||
      tableSession.companyId !== branch.companyId
    ) {
      throw new BadRequestException('Table session does not belong to branch');
    }

    return tableSession;
  }

  private async assertOwnedVenueZone(
    venueZoneId: string | undefined,
    branch: BranchContext,
    tx: PrismaExecutor,
  ) {
    if (!venueZoneId) {
      return;
    }

    const venueZone = await tx.venueZone.findUnique({
      where: { id: venueZoneId },
      select: { id: true, companyId: true, branchId: true },
    });

    if (!venueZone) {
      throw new NotFoundException('Venue zone not found');
    }

    if (
      venueZone.branchId !== branch.id ||
      venueZone.companyId !== branch.companyId
    ) {
      throw new BadRequestException('Venue zone does not belong to branch');
    }
  }

  private async findOwnedCustomerIdentity(
    customerSessionIdentityId: string | undefined,
    branch: BranchContext,
    tableSessionId: string | undefined,
    tx: PrismaExecutor,
  ) {
    if (!customerSessionIdentityId) {
      return null;
    }

    const customerIdentity = await tx.customerSessionIdentity.findUnique({
      where: { id: customerSessionIdentityId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
      },
    });

    if (!customerIdentity) {
      throw new NotFoundException('Customer session identity not found');
    }

    if (
      customerIdentity.branchId !== branch.id ||
      customerIdentity.companyId !== branch.companyId
    ) {
      throw new BadRequestException(
        'Customer session identity does not belong to branch',
      );
    }

    if (
      tableSessionId &&
      customerIdentity.tableSessionId &&
      customerIdentity.tableSessionId !== tableSessionId
    ) {
      throw new BadRequestException(
        'Customer session identity does not belong to table session',
      );
    }

    return customerIdentity;
  }

  private async assertOwnedDeviceSubscription(
    deviceSubscriptionId: string | undefined,
    branch: BranchContext,
    tableSessionId: string | undefined,
    customerSessionIdentityId: string | undefined,
    tx: PrismaExecutor,
  ) {
    if (!deviceSubscriptionId) {
      return;
    }

    const subscription = await tx.deviceSubscription.findUnique({
      where: { id: deviceSubscriptionId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        customerSessionIdentityId: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('Device subscription not found');
    }

    if (subscription.companyId !== branch.companyId) {
      throw new BadRequestException(
        'Device subscription does not belong to branch company',
      );
    }

    if (subscription.branchId && subscription.branchId !== branch.id) {
      throw new BadRequestException(
        'Device subscription does not belong to branch',
      );
    }

    if (
      tableSessionId &&
      subscription.tableSessionId &&
      subscription.tableSessionId !== tableSessionId
    ) {
      throw new BadRequestException(
        'Device subscription does not belong to table session',
      );
    }

    if (
      customerSessionIdentityId &&
      subscription.customerSessionIdentityId &&
      subscription.customerSessionIdentityId !== customerSessionIdentityId
    ) {
      throw new BadRequestException(
        'Device subscription does not belong to customer session identity',
      );
    }
  }

  private async findOrderNotificationContext(
    orderId: string,
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
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  private async findBillRequestNotificationContext(
    billRequestId: string,
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
      },
    });

    if (!billRequest) {
      throw new NotFoundException('Bill request not found');
    }

    return billRequest;
  }

  private billRequestNotificationMetadata(billRequest: {
    id: string;
    status: string;
    subtotalMinor: number;
    orderCount: number;
    currency: string;
  }) {
    return {
      billRequestId: billRequest.id,
      status: billRequest.status,
      subtotalMinor: billRequest.subtotalMinor,
      orderCount: billRequest.orderCount,
      currency: billRequest.currency,
    };
  }

  private async findCustomerIdentityId(
    tableSessionId: string,
    tx: PrismaExecutor,
  ) {
    const identity = await tx.customerSessionIdentity.findFirst({
      where: { tableSessionId },
      select: { id: true },
    });

    return identity?.id;
  }

  private async assertNotificationExists(notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { id: true },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
  }

  private toNotificationResponse(notification: any) {
    const {
      deliveries,
      tableSession,
      customerSessionIdentity,
      order,
      preparationTask,
      presenceEvent,
      ...notificationFields
    } = notification;

    return {
      notification: notificationFields,
      deliveries: deliveries.map((delivery: any) => ({
        id: delivery.id,
        notificationId: delivery.notificationId,
        deviceSubscriptionId: delivery.deviceSubscriptionId,
        channel: delivery.channel,
        status: delivery.status,
        externalMessageId: delivery.externalMessageId,
        errorMessage: delivery.errorMessage,
        sentAt: delivery.sentAt,
        failedAt: delivery.failedAt,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      })),
      tableSession,
      customerSessionIdentity,
      order,
      preparationTask,
      presenceEvent,
    };
  }

  private stationLabel(station: PreparationStation) {
    switch (station) {
      case PreparationStation.barista:
        return 'البارستا';
      case PreparationStation.dessert:
        return 'الديسرت';
      case PreparationStation.kitchen:
        return 'المطبخ';
      case PreparationStation.cashier:
        return 'الكاشير';
      default:
        return 'الفريق';
    }
  }

  private notificationInclude() {
    return {
      deliveries: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
      tableSession: {
        select: this.tableSessionSelect(),
      },
      customerSessionIdentity: {
        select: {
          id: true,
          tableSessionId: true,
          displayName: true,
          phone: true,
          locale: true,
          marketingOptIn: true,
          notificationsOptIn: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          tableSessionId: true,
          submittedAt: true,
          cashierAcceptedAt: true,
          cashierRejectedAt: true,
        },
      },
      preparationTask: {
        select: {
          id: true,
          orderId: true,
          orderItemId: true,
          station: true,
          status: true,
          itemNameSnapshot: true,
          readyAt: true,
        },
      },
      presenceEvent: {
        select: {
          id: true,
          tableSessionId: true,
          venueZoneId: true,
          triggerType: true,
          sourceChannel: true,
          occurredAt: true,
          createdAt: true,
        },
      },
    } satisfies Prisma.NotificationInclude;
  }

  private presenceEventInclude() {
    return {
      tableSession: {
        select: this.tableSessionSelect(),
      },
      venueZone: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
        },
      },
      customerSessionIdentity: {
        select: {
          id: true,
          tableSessionId: true,
          displayName: true,
          phone: true,
          locale: true,
        },
      },
      deviceSubscription: {
        select: {
          id: true,
          channel: true,
          status: true,
          lastSeenAt: true,
        },
      },
    } satisfies Prisma.PresenceEventInclude;
  }

  private tableSessionSelect() {
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
    } satisfies Prisma.TableSessionSelect;
  }
}
