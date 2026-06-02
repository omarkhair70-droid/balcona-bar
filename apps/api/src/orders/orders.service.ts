import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  Prisma,
} from '@prisma/client';
import { CartService } from '../cart/cart.service';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PreparationTasksService } from '../preparation-tasks/preparation-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { SmartCashierService } from '../smart-cashier/smart-cashier.service';
import { CashierAcceptOrderDto } from './dto/cashier-accept-order.dto';
import { CashierOrdersQueryDto } from './dto/cashier-orders-query.dto';
import { CashierRejectOrderDto } from './dto/cashier-reject-order.dto';
import { SubmitCartDto } from './dto/submit-cart.dto';

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const ORDER_NUMBER_PREFIX = 'B';
const SUBMITTED_SESSION_ORDER_STATUSES = [
  OrderStatus.submitted,
  OrderStatus.cashier_accepted,
  OrderStatus.cashier_rejected,
];

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type IdempotencyReplay = {
  replayed: boolean;
  key: string | null;
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly preparationTasksService: PreparationTasksService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly smartCashierService: SmartCashierService,
  ) {}

  async submitCart(
    sessionId: string,
    body: SubmitCartDto = {},
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    const customerNote = this.normalizeOptionalText(body.customerNote);

    return this.prisma.$transaction(async (tx) => {
      await this.lockSubmitForSession(sessionId, tx);

      if (idempotencyKey) {
        const existingOrder = await this.findByIdempotencyKey(
          sessionId,
          idempotencyKey,
          tx,
        );

        if (existingOrder) {
          return this.toOrderResponse(existingOrder, {
            replayed: true,
            key: idempotencyKey,
          });
        }
      }

      const { session, cart, totals } =
        await this.cartService.getValidatedDraftCartForSubmit(sessionId, tx);
      const orderNumber = await this.generateOrderNumber(session.branchId, tx);
      const submittedAt = new Date();
      const submittedMetadata: Record<string, string> = { cartId: cart.id };

      if (idempotencyKey) {
        submittedMetadata.idempotencyKey = idempotencyKey;
      }

      const order = await tx.order.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          cartId: cart.id,
          orderNumber,
          status: OrderStatus.submitted,
          source: OrderSource.customer_qr,
          currency: cart.currency,
          subtotalMinor: totals.subtotalMinor,
          totalQuantity: totals.totalQuantity,
          itemCount: totals.itemCount,
          customerNote,
          idempotencyKey,
          submittedAt,
          items: {
            create: cart.items.map((item: any) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              notes: item.notes,
              itemNameSnapshot: item.itemNameSnapshot,
              itemSlugSnapshot: item.itemSlugSnapshot,
              basePriceMinorSnapshot: item.basePriceMinorSnapshot,
              effectiveBasePriceMinorSnapshot:
                item.effectiveBasePriceMinorSnapshot,
              modifiersTotalMinorSnapshot: item.modifiersTotalMinorSnapshot,
              unitPriceMinorSnapshot: item.unitPriceMinorSnapshot,
              lineTotalMinorSnapshot: item.lineTotalMinorSnapshot,
              currency: item.currency,
              modifierOptions: {
                create: item.modifierOptions.map((option: any) => ({
                  modifierGroupId: option.modifierGroupId,
                  modifierOptionId: option.modifierOptionId,
                  modifierGroupNameSnapshot: option.modifierGroupNameSnapshot,
                  modifierGroupSlugSnapshot: option.modifierGroupSlugSnapshot,
                  modifierOptionNameSnapshot: option.modifierOptionNameSnapshot,
                  modifierOptionSlugSnapshot: option.modifierOptionSlugSnapshot,
                  priceDeltaMinorSnapshot: option.priceDeltaMinorSnapshot,
                })),
              },
            })),
          },
          events: {
            create: {
              type: OrderEventType.submitted,
              actorType: OrderEventActorType.customer,
              metadata: submittedMetadata,
            },
          },
        },
        select: { id: true },
      });

      await tx.cart.update({
        where: { id: cart.id },
        data: { status: CartStatus.converted },
      });

      await this.presenceNotificationsService.createOrderSubmittedNotification(
        order.id,
        tx,
      );
      await this.realtimeEventsService.recordOrderSubmitted(order.id, tx);
      await this.smartCashierService.attemptAutoAcceptOrder(order.id, tx);

      return this.getOrderResponse(order.id, tx, {
        replayed: false,
        key: idempotencyKey,
      });
    });
  }

  async findCashierOrders(branchId: string, query: CashierOrdersQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const status = query.status ?? OrderStatus.submitted;
    const statusFilter = status === 'all' ? undefined : (status as OrderStatus);
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ submittedAt: 'asc' }, { createdAt: 'asc' }],
      include: this.orderInclude(),
    });

    return {
      branch,
      status,
      orders: orders.map((order) => this.toOrderResponse(order)),
    };
  }

  async findOne(orderId: string) {
    return this.getOrderResponse(orderId, this.prisma);
  }

  async accept(orderId: string, body: CashierAcceptOrderDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.submitted) {
        throw new BadRequestException('Only submitted orders can be accepted');
      }

      const now = new Date();

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.cashier_accepted,
          cashierAcceptedAt: now,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.cashier_accepted,
          actorType: OrderEventActorType.staff,
          actorStaffUserId: body.staffUserId,
        },
      });

      await this.preparationTasksService.createTasksForAcceptedOrder(
        order.id,
        body.staffUserId,
        tx,
      );

      await this.presenceNotificationsService.createOrderAcceptedNotification(
        order.id,
        tx,
      );
      await this.realtimeEventsService.recordOrderAccepted(order.id, tx);

      return this.getOrderResponse(order.id, tx);
    });
  }

  async reject(orderId: string, body: CashierRejectOrderDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { id: true, status: true },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.status !== OrderStatus.submitted) {
        throw new BadRequestException('Only submitted orders can be rejected');
      }

      const rejectionReason = this.normalizeOptionalText(body.reason);
      const now = new Date();

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.cashier_rejected,
          cashierRejectedAt: now,
          rejectionReason,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.cashier_rejected,
          actorType: OrderEventActorType.staff,
          actorStaffUserId: body.staffUserId,
          metadata: rejectionReason ? { reason: rejectionReason } : undefined,
        },
      });

      await this.presenceNotificationsService.createOrderRejectedNotification(
        order.id,
        rejectionReason,
        tx,
      );
      await this.realtimeEventsService.recordOrderRejected(order.id, tx);

      return this.getOrderResponse(order.id, tx);
    });
  }

  async findForTableSession(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionContextSelect(),
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tableSessionId: sessionId,
        status: { in: SUBMITTED_SESSION_ORDER_STATUSES },
      },
      orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
      include: this.orderInclude(),
    });

    return {
      ...this.toSessionContextResponse(session),
      orders: orders.map((order) => this.toOrderResponse(order)),
    };
  }

  private async lockSubmitForSession(
    sessionId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`submit:${sessionId}`})::bigint)`;
  }

  private async generateOrderNumber(
    branchId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-number:${branchId}`})::bigint)`;

    let sequence = (await tx.order.count({ where: { branchId } })) + 1;

    while (true) {
      const orderNumber = `${ORDER_NUMBER_PREFIX}${String(sequence).padStart(4, '0')}`;
      const existing = await tx.order.findUnique({
        where: {
          branchId_orderNumber: {
            branchId,
            orderNumber,
          },
        },
        select: { id: true },
      });

      if (!existing) {
        return orderNumber;
      }

      sequence += 1;
    }
  }

  private async findByIdempotencyKey(
    sessionId: string,
    idempotencyKey: string,
    tx: PrismaExecutor,
  ) {
    return tx.order.findUnique({
      where: {
        tableSessionId_idempotencyKey: {
          tableSessionId: sessionId,
          idempotencyKey,
        },
      },
      include: this.orderInclude(),
    });
  }

  private async getOrderResponse(
    orderId: string,
    tx: PrismaExecutor,
    idempotency?: IdempotencyReplay,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: this.orderInclude(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.toOrderResponse(order, idempotency);
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
      throw new NotFoundException('Staff user not found');
    }
  }

  private normalizeIdempotencyKey(idempotencyKey?: string) {
    if (!idempotencyKey) {
      return null;
    }

    const normalizedKey = idempotencyKey.trim();

    if (normalizedKey.length === 0) {
      return null;
    }

    if (normalizedKey.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key must be ${IDEMPOTENCY_KEY_MAX_LENGTH} characters or fewer`,
      );
    }

    return normalizedKey;
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toOrderResponse(order: any, idempotency?: IdempotencyReplay) {
    const {
      company,
      branch,
      tableSession,
      items,
      events,
      preparationTasks,
      ...orderFields
    } = order;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      order: orderFields,
      company,
      branch,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
      items: items.map((item: any) => ({
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        itemNameSnapshot: item.itemNameSnapshot,
        itemSlugSnapshot: item.itemSlugSnapshot,
        basePriceMinorSnapshot: item.basePriceMinorSnapshot,
        effectiveBasePriceMinorSnapshot: item.effectiveBasePriceMinorSnapshot,
        modifiersTotalMinorSnapshot: item.modifiersTotalMinorSnapshot,
        unitPriceMinorSnapshot: item.unitPriceMinorSnapshot,
        lineTotalMinorSnapshot: item.lineTotalMinorSnapshot,
        currency: item.currency,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        modifierOptions: item.modifierOptions.map((option: any) => ({
          id: option.id,
          orderItemId: option.orderItemId,
          modifierGroupId: option.modifierGroupId,
          modifierOptionId: option.modifierOptionId,
          modifierGroupNameSnapshot: option.modifierGroupNameSnapshot,
          modifierGroupSlugSnapshot: option.modifierGroupSlugSnapshot,
          modifierOptionNameSnapshot: option.modifierOptionNameSnapshot,
          modifierOptionSlugSnapshot: option.modifierOptionSlugSnapshot,
          priceDeltaMinorSnapshot: option.priceDeltaMinorSnapshot,
          createdAt: option.createdAt,
        })),
      })),
      events: events.map((event: any) => ({
        id: event.id,
        orderId: event.orderId,
        type: event.type,
        actorType: event.actorType,
        actorStaffUserId: event.actorStaffUserId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
      preparationTasks: (preparationTasks ?? []).map((task: any) => ({
        id: task.id,
        companyId: task.companyId,
        branchId: task.branchId,
        orderId: task.orderId,
        orderItemId: task.orderItemId,
        station: task.station,
        status: task.status,
        quantity: task.quantity,
        itemNameSnapshot: task.itemNameSnapshot,
        itemSlugSnapshot: task.itemSlugSnapshot,
        notes: task.notes,
        startedAt: task.startedAt,
        readyAt: task.readyAt,
        cancelledAt: task.cancelledAt,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        events: task.events.map((event: any) => ({
          id: event.id,
          preparationTaskId: event.preparationTaskId,
          type: event.type,
          actorStaffUserId: event.actorStaffUserId,
          metadata: event.metadata,
          createdAt: event.createdAt,
        })),
      })),
      totals: {
        subtotalMinor: order.subtotalMinor,
        totalQuantity: order.totalQuantity,
        itemCount: order.itemCount,
        currency: order.currency,
      },
      ...(idempotency ? { idempotency } : {}),
    };
  }

  private toSessionContextResponse(session: any) {
    const { company, branch, table, ...sessionFields } = session;
    const { floor, ...tableFields } = table;

    return {
      session: sessionFields,
      company,
      branch,
      floor,
      table: tableFields,
    };
  }

  private orderInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      items: {
        orderBy: [{ createdAt: 'asc' as const }],
        include: {
          modifierOptions: {
            orderBy: [{ createdAt: 'asc' as const }],
          },
        },
      },
      events: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
      preparationTasks: {
        orderBy: [{ createdAt: 'asc' as const }],
        include: {
          events: {
            orderBy: [{ createdAt: 'asc' as const }],
          },
        },
      },
    } satisfies Prisma.OrderInclude;
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
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
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
