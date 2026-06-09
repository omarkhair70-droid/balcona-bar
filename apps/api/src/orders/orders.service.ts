import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PreparationTaskStatus,
  Prisma,
} from '@prisma/client';
import { TableAttentionService } from '../autopilot/table-attention.service';
import { CartService } from '../cart/cart.service';
import { InventoryService } from '../inventory/inventory.service';
import { KitchenTicketsService } from '../kitchen-tickets/kitchen-tickets.service';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PreparationTasksService } from '../preparation-tasks/preparation-tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { SmartCashierService } from '../smart-cashier/smart-cashier.service';
import { CashierAcceptOrderDto } from './dto/cashier-accept-order.dto';
import { CashierOrdersQueryDto } from './dto/cashier-orders-query.dto';
import { CashierRejectOrderDto } from './dto/cashier-reject-order.dto';
import { OrderLifecycleActionDto } from './dto/order-lifecycle-action.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import {
  explainDeniedTransition,
  getOrderLifecycleState,
  OrderLifecycleAction,
  OrderLifecycleDeniedReason,
} from './order-lifecycle.policy';
import { SubmitCartDto } from './dto/submit-cart.dto';

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const ORDER_NUMBER_PREFIX = 'B';
const SUBMITTED_SESSION_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.submitted,
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
  OrderStatus.ready,
  OrderStatus.served,
  OrderStatus.completed,
  OrderStatus.cashier_rejected,
  OrderStatus.cancelled,
];

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type IdempotencyReplay = {
  replayed: boolean;
  key: string | null;
};

type SubmitCartLogContext = {
  requestId?: string;
  sessionId: string;
  orderId?: string;
};

type SubmitCartTransactionResult =
  | {
      replayed: true;
      response: any;
    }
  | {
      replayed: false;
      orderId: string;
      sessionId: string;
      idempotency: IdempotencyReplay;
    };

type OrderActionFailureStage =
  | 'validation'
  | 'status_update'
  | 'inventory_consumption'
  | 'preparation_tasks'
  | 'preparation_realtime'
  | 'kds_realtime'
  | 'print_jobs'
  | 'notification'
  | 'realtime'
  | 'response_mapping'
  | 'table_attention_recalculate';

type OrderActionLogContext = {
  requestId?: string;
  action: OrderLifecycleAction;
  orderId: string;
  sessionId?: string;
  previousStatus?: OrderStatus;
  targetStatus?: OrderStatus;
  failureStage?: OrderActionFailureStage;
};

type OrderActionTransactionResult = {
  orderId: string;
  sessionId: string;
  actorStaffUserId: string;
  previousStatus: OrderStatus;
  targetStatus: OrderStatus;
  kdsTicketIds?: string[];
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cartService: CartService,
    private readonly preparationTasksService: PreparationTasksService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly smartCashierService: SmartCashierService,
    private readonly tableAttentionService: TableAttentionService,
    private readonly kitchenTicketsService: KitchenTicketsService,
    private readonly inventoryService: InventoryService,
  ) {}

  async submitCart(
    sessionId: string,
    body: SubmitCartDto = {},
    rawIdempotencyKey?: string,
    requestId?: string,
  ) {
    const idempotencyKey = this.normalizeIdempotencyKey(rawIdempotencyKey);
    const customerNote = this.normalizeOptionalText(body.customerNote);
    const logContext = { requestId, sessionId };

    let transactionResult: SubmitCartTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        await this.lockSubmitForSession(sessionId, tx);

        if (idempotencyKey) {
          const existingOrder = await this.findByIdempotencyKey(
            sessionId,
            idempotencyKey,
            tx,
          );

          if (existingOrder) {
            return {
              replayed: true,
              response: this.toOrderResponse(existingOrder, {
                replayed: true,
                key: idempotencyKey,
              }),
            };
          }
        }

        const { session, cart, totals } =
          await this.cartService.getValidatedDraftCartForSubmit(sessionId, tx);
        const orderNumber = await this.generateOrderNumber(session.branchId, tx);
        const submittedAt = new Date();
        const submittedMetadata: Record<string, string> = {
          cartId: cart.id,
          action: 'submit',
          nextStatus: OrderStatus.submitted,
          source: 'customer',
        };

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

        return {
          replayed: false,
          orderId: order.id,
          sessionId: session.id,
          idempotency: {
            replayed: false,
            key: idempotencyKey,
          },
        };
      });
    } catch (error) {
      throw this.toSubmitCartError(error, logContext);
    }

    if (transactionResult.replayed) {
      return transactionResult.response;
    }

    await this.runPostSubmitAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      orderId: transactionResult.orderId,
    });

    return this.getOrderResponse(
      transactionResult.orderId,
      this.prisma,
      transactionResult.idempotency,
    );
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

  async findReadyToServeOrders(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: OrderStatus.ready,
      },
      orderBy: [{ readyAt: 'asc' }, { submittedAt: 'asc' }],
      include: this.orderInclude(),
    });

    return {
      branch,
      status: OrderStatus.ready,
      orders: orders.map((order) => this.toOrderResponse(order)),
    };
  }

  async findOne(orderId: string) {
    return this.getOrderResponse(orderId, this.prisma);
  }

  async accept(
    orderId: string,
    body: CashierAcceptOrderDto = {},
    authenticatedStaffUserId?: string,
    requestId?: string,
  ) {
    const logContext: OrderActionLogContext = {
      requestId,
      action: 'accept',
      orderId,
      targetStatus: OrderStatus.cashier_accepted,
    };
    let stage: OrderActionFailureStage = 'validation';
    let transactionResult: OrderActionTransactionResult;
    const timings = {
      statusUpdateMs: 0,
      stockConsumptionMs: 0,
      preparationTasksMs: 0,
      orderEventMs: 0,
    };
    const startedAt = Date.now();

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = 'validation';
        const actorStaffUserId = await this.resolveStaffActor(
          authenticatedStaffUserId,
          body.staffUserId,
          tx,
        );

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            branchId: true,
            tableSessionId: true,
            status: true,
          },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, 'accept');

        const now = new Date();

        stage = 'status_update';
        let stageStartedAt = Date.now();
        const updatedOrder = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: OrderStatus.cashier_accepted,
            cashierAcceptedAt: now,
          },
        });
        timings.statusUpdateMs += Date.now() - stageStartedAt;

        this.assertFreshTransition(updatedOrder.count);

        stage = 'inventory_consumption';
        stageStartedAt = Date.now();
        await this.inventoryService.consumeStockForAcceptedOrder(
          order.id,
          actorStaffUserId,
          tx,
        );
        timings.stockConsumptionMs += Date.now() - stageStartedAt;

        stage = 'preparation_tasks';
        stageStartedAt = Date.now();
        const kdsRouting =
          await this.preparationTasksService.createTasksForAcceptedOrder(
            order.id,
            actorStaffUserId,
            tx,
            { createPrintJobs: false, recordRealtimeEvents: false },
          );
        timings.preparationTasksMs += Date.now() - stageStartedAt;
        this.logger.log({
          message: 'accept.preparation_tasks',
          requestId,
          orderId: order.id,
          branchId: order.branchId,
          itemCount: kdsRouting.itemCount,
          actionableItemCount: kdsRouting.actionableItemCount,
          stationsDetected: kdsRouting.stationsDetected,
          createdTaskCount: kdsRouting.createdTaskCount,
          existingTaskCount: kdsRouting.existingTaskCount,
          createdTicketCount: kdsRouting.ticketRouting.createdTicketCount,
          existingTicketCount: kdsRouting.ticketRouting.existingTicketCount,
          ticketCount: kdsRouting.ticketRouting.ticketIds.length,
          skippedItemCount: kdsRouting.skippedItems.length,
          durationMs: timings.preparationTasksMs,
        });

        stage = 'status_update';
        stageStartedAt = Date.now();
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.cashier_accepted,
            actorType: OrderEventActorType.staff,
            actorStaffUserId,
            metadata: this.transitionMetadata(
              order.status,
              OrderStatus.cashier_accepted,
              'accept',
              'cashier',
            ),
          },
        });
        timings.orderEventMs += Date.now() - stageStartedAt;

        this.logger.log({
          message: 'accept.critical_transaction',
          requestId,
          orderId: order.id,
          branchId: order.branchId,
          durationMs: Date.now() - startedAt,
          timings,
        });

        return {
          orderId: order.id,
          sessionId: order.tableSessionId,
          actorStaffUserId,
          previousStatus: order.status,
          targetStatus: OrderStatus.cashier_accepted,
          kdsTicketIds: kdsRouting.ticketRouting.ticketIds,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    await this.runPostOrderActionAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      previousStatus: transactionResult.previousStatus,
      targetStatus: transactionResult.targetStatus,
    }, [
      {
        stage: 'preparation_realtime',
        run: () =>
          this.preparationTasksService.recordCreatedRealtimeEventsForOrder(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'kds_realtime',
        run: () =>
          this.kitchenTicketsService.recordCreatedRealtimeEventsForTickets(
            transactionResult.kdsTicketIds ?? [],
          ),
      },
      {
        stage: 'print_jobs',
        run: () =>
          this.kitchenTicketsService.createPrintJobsForTickets(
            transactionResult.kdsTicketIds ?? [],
            transactionResult.actorStaffUserId,
          ),
      },
      {
        stage: 'notification',
        run: () =>
          this.presenceNotificationsService.createOrderAcceptedNotification(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'realtime',
        run: () =>
          this.realtimeEventsService.recordOrderAccepted(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'table_attention_recalculate',
        run: () =>
          this.recalculateAttention(
            transactionResult.sessionId,
            this.prisma,
            'order_accepted',
            { orderId: transactionResult.orderId },
          ),
      },
    ]);

    try {
      return await this.getOrderResponse(transactionResult.orderId, this.prisma);
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: 'response_mapping',
      });
    }
  }

  async reject(
    orderId: string,
    body: CashierRejectOrderDto = {},
    authenticatedStaffUserId?: string,
    requestId?: string,
  ) {
    const rejectionReason = this.normalizeOptionalText(body.reason);
    const logContext: OrderActionLogContext = {
      requestId,
      action: 'reject',
      orderId,
      targetStatus: OrderStatus.cashier_rejected,
    };
    let stage: OrderActionFailureStage = 'validation';
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = 'validation';
        const actorStaffUserId = await this.resolveStaffActor(
          authenticatedStaffUserId,
          body.staffUserId,
          tx,
        );

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, tableSessionId: true, status: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, 'reject');

        const now = new Date();

        stage = 'status_update';
        const updatedOrder = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: OrderStatus.cashier_rejected,
            cashierRejectedAt: now,
            rejectionReason,
          },
        });

        this.assertFreshTransition(updatedOrder.count);

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.cashier_rejected,
            actorType: OrderEventActorType.staff,
            actorStaffUserId,
            metadata: this.transitionMetadata(
              order.status,
              OrderStatus.cashier_rejected,
              'reject',
              'cashier',
              rejectionReason ? { reason: rejectionReason } : undefined,
            ),
          },
        });

        return {
          orderId: order.id,
          sessionId: order.tableSessionId,
          actorStaffUserId,
          previousStatus: order.status,
          targetStatus: OrderStatus.cashier_rejected,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    await this.runPostOrderActionAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      previousStatus: transactionResult.previousStatus,
      targetStatus: transactionResult.targetStatus,
    }, [
      {
        stage: 'notification',
        run: () =>
          this.presenceNotificationsService.createOrderRejectedNotification(
            transactionResult.orderId,
            rejectionReason,
          ),
      },
      {
        stage: 'realtime',
        run: () =>
          this.realtimeEventsService.recordOrderRejected(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'table_attention_recalculate',
        run: () =>
          this.recalculateAttention(
            transactionResult.sessionId,
            this.prisma,
            'order_rejected',
            { orderId: transactionResult.orderId },
          ),
      },
    ]);

    try {
      return await this.getOrderResponse(transactionResult.orderId, this.prisma);
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: 'response_mapping',
      });
    }
  }

  async serve(
    orderId: string,
    body: OrderLifecycleActionDto = {},
    authenticatedStaffUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const actorStaffUserId = await this.resolveStaffActor(
        authenticatedStaffUserId,
        body.staffUserId,
        tx,
      );

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          tableSessionId: true,
          status: true,
          preparationTasks: {
            where: { status: { not: PreparationTaskStatus.cancelled } },
            select: { id: true, status: true },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      this.assertLifecycleTransition(order, 'serve');

      const note = this.normalizeOptionalText(body.note);
      const now = new Date();

      const updatedOrder = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: OrderStatus.served,
          servedAt: now,
          servedByStaffUserId: actorStaffUserId,
        },
      });

      this.assertFreshTransition(updatedOrder.count);

      await tx.orderEvent.create({
        data: {
          orderId: order.id,
          type: OrderEventType.served,
          actorType: OrderEventActorType.staff,
          actorStaffUserId,
          metadata: this.transitionMetadata(
            order.status,
            OrderStatus.served,
            'serve',
            'waiter',
            note ? { note } : undefined,
          ),
        },
      });

      await this.presenceNotificationsService.createOrderServedNotification(
        order.id,
        tx,
      );
      await this.kitchenTicketsService.syncTicketsForOrderServed(order.id, tx);
      await this.realtimeEventsService.recordOrderServed(order.id, tx);
      await this.recalculateAttention(order.tableSessionId, tx, 'order_served', {
        orderId: order.id,
      });

      return this.getOrderResponse(order.id, tx);
    });
  }

  async complete(
    orderId: string,
    body: OrderLifecycleActionDto = {},
    authenticatedStaffUserId?: string,
    requestId?: string,
  ) {
    const note = this.normalizeOptionalText(body.note);
    const logContext: OrderActionLogContext = {
      requestId,
      action: 'complete',
      orderId,
      targetStatus: OrderStatus.completed,
    };
    let stage: OrderActionFailureStage = 'validation';
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = 'validation';
        const actorStaffUserId = await this.resolveStaffActor(
          authenticatedStaffUserId,
          body.staffUserId,
          tx,
        );

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, tableSessionId: true, status: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, 'complete');

        const now = new Date();

        stage = 'status_update';
        const updatedOrder = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: OrderStatus.completed,
            completedAt: now,
            completedByStaffUserId: actorStaffUserId,
            completionNote: note,
          },
        });

        this.assertFreshTransition(updatedOrder.count);

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.completed,
            actorType: OrderEventActorType.staff,
            actorStaffUserId,
            metadata: this.transitionMetadata(
              order.status,
              OrderStatus.completed,
              'complete',
              'cashier',
              note ? { note } : undefined,
            ),
          },
        });

        return {
          orderId: order.id,
          sessionId: order.tableSessionId,
          actorStaffUserId,
          previousStatus: order.status,
          targetStatus: OrderStatus.completed,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    await this.runPostOrderActionAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      previousStatus: transactionResult.previousStatus,
      targetStatus: transactionResult.targetStatus,
    }, [
      {
        stage: 'realtime',
        run: () =>
          this.realtimeEventsService.recordOrderCompleted(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'table_attention_recalculate',
        run: () =>
          this.recalculateAttention(
            transactionResult.sessionId,
            this.prisma,
            'order_completed',
            { orderId: transactionResult.orderId },
          ),
      },
    ]);

    try {
      return await this.getOrderResponse(transactionResult.orderId, this.prisma);
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: 'response_mapping',
      });
    }
  }

  async cancel(
    orderId: string,
    body: CancelOrderDto = {},
    authenticatedStaffUserId?: string,
    requestId?: string,
  ) {
    const reason = this.normalizeOptionalText(body.reason);
    const logContext: OrderActionLogContext = {
      requestId,
      action: 'cancel',
      orderId,
      targetStatus: OrderStatus.cancelled,
    };
    let stage: OrderActionFailureStage = 'validation';
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = 'validation';
        const actorStaffUserId = await this.resolveStaffActor(
          authenticatedStaffUserId,
          body.staffUserId,
          tx,
        );

        if (!reason) {
          throw this.lifecycleBadRequest(
            'cancellation_requires_reason',
            'Cancellation requires a reason',
          );
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            tableSessionId: true,
            status: true,
            preparationTasks: {
              where: { status: { not: PreparationTaskStatus.cancelled } },
              select: { id: true, status: true },
            },
          },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, 'cancel');

        stage = 'status_update';
        const updatedOrder = await tx.order.updateMany({
          where: { id: order.id, status: order.status },
          data: {
            status: OrderStatus.cancelled,
          },
        });

        this.assertFreshTransition(updatedOrder.count);

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: OrderEventType.cancelled,
            actorType: OrderEventActorType.staff,
            actorStaffUserId,
            metadata: this.transitionMetadata(
              order.status,
              OrderStatus.cancelled,
              'cancel',
              'cashier',
              { reason },
            ),
          },
        });

        stage = 'preparation_tasks';
        await this.preparationTasksService.cancelActiveTasksForOrderCancellation(
          order.id,
          actorStaffUserId,
          reason,
          tx,
        );
        await this.kitchenTicketsService.syncTicketsForOrderCancelled(
          order.id,
          actorStaffUserId,
          reason,
          tx,
        );

        return {
          orderId: order.id,
          sessionId: order.tableSessionId,
          actorStaffUserId,
          previousStatus: order.status,
          targetStatus: OrderStatus.cancelled,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    await this.runPostOrderActionAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      previousStatus: transactionResult.previousStatus,
      targetStatus: transactionResult.targetStatus,
    }, [
      {
        stage: 'realtime',
        run: () =>
          this.realtimeEventsService.recordOrderCancelled(
            transactionResult.orderId,
          ),
      },
      {
        stage: 'table_attention_recalculate',
        run: () =>
          this.recalculateAttention(
            transactionResult.sessionId,
            this.prisma,
            'order_cancelled',
            { orderId: transactionResult.orderId, reason },
          ),
      },
    ]);

    try {
      return await this.getOrderResponse(transactionResult.orderId, this.prisma);
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: 'response_mapping',
      });
    }
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

  private async resolveStaffActor(
    authenticatedStaffUserId: string | undefined,
    bodyStaffUserId: string | undefined,
    tx: PrismaExecutor,
  ) {
    const staffUserId = authenticatedStaffUserId ?? bodyStaffUserId;

    if (!staffUserId) {
      throw this.lifecycleBadRequest(
        'missing_staff_actor',
        'Staff actor is required for this order transition',
      );
    }

    await this.assertStaffUserExists(staffUserId, tx);

    return staffUserId;
  }

  private assertLifecycleTransition(
    order: { status: OrderStatus; preparationTasks?: { status: PreparationTaskStatus }[] },
    action: OrderLifecycleAction,
  ) {
    const reason = explainDeniedTransition(order, action);

    if (reason) {
      throw this.lifecycleBadRequest(reason);
    }
  }

  private assertFreshTransition(updatedCount: number) {
    if (updatedCount === 0) {
      throw this.lifecycleBadRequest(
        'stale_order_state',
        'Order state changed before the transition could be saved',
      );
    }
  }

  private lifecycleBadRequest(
    code: OrderLifecycleDeniedReason,
    message: string = code,
  ) {
    return new BadRequestException({
      code,
      message,
    });
  }

  private transitionMetadata(
    previousStatus: OrderStatus,
    nextStatus: OrderStatus,
    action: OrderLifecycleAction,
    source: 'cashier' | 'kitchen' | 'waiter' | 'system' | 'customer',
    extra?: Record<string, unknown>,
  ) {
    return {
      previousStatus,
      nextStatus,
      action,
      source,
      ...extra,
    };
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

  private async runPostSubmitAutomation(context: SubmitCartLogContext) {
    const { orderId, sessionId } = context;

    if (!orderId) {
      return;
    }

    await this.runPostSubmitAutomationStep(
      'order_submitted_notification',
      context,
      () =>
        this.presenceNotificationsService.createOrderSubmittedNotification(
          orderId,
        ),
    );
    await this.runPostSubmitAutomationStep(
      'order_submitted_realtime',
      context,
      () => this.realtimeEventsService.recordOrderSubmitted(orderId),
    );
    await this.runPostSubmitAutomationStep(
      'smart_cashier_auto_accept',
      context,
      () => this.smartCashierService.attemptAutoAcceptOrder(orderId),
    );
    await this.runPostSubmitAutomationStep(
      'table_attention_recalculate',
      context,
      () =>
        this.recalculateAttention(sessionId, this.prisma, 'order_submitted', {
          orderId,
        }),
    );
  }

  private async runPostSubmitAutomationStep(
    stage: string,
    context: SubmitCartLogContext,
    operation: () => Promise<unknown>,
  ) {
    try {
      await operation();
    } catch (error) {
      this.logger.warn({
        message:
          'Post-submit automation failed; order remains submitted for manual review',
        stage,
        ...context,
        exception: this.safeExceptionSummary(error),
      });
    }
  }

  private async runPostOrderActionAutomation(
    context: OrderActionLogContext,
    steps: Array<{
      stage: OrderActionFailureStage;
      run: () => Promise<unknown>;
    }>,
  ) {
    for (const step of steps) {
      try {
        await step.run();
      } catch (error) {
        this.logger.warn({
          message:
            'Post-order action automation failed; committed order status remains source of truth',
          ...context,
          failureStage: step.stage,
          exception: this.safeExceptionSummary(error),
        });
      }
    }
  }

  private toSubmitCartError(error: unknown, context: SubmitCartLogContext) {
    if (error instanceof NotFoundException) {
      this.logger.warn({
        message: 'Cart submit rejected because table session is invalid',
        ...context,
        exception: this.safeExceptionSummary(error),
      });

      return new BadRequestException('Table session is invalid or unavailable');
    }

    if (!(error instanceof HttpException)) {
      this.logger.error({
        message: 'Cart submit failed before order creation completed',
        ...context,
        exception: this.safeExceptionSummary(error),
      });
    }

    return error;
  }

  private toOrderActionError(
    error: unknown,
    context: OrderActionLogContext,
  ) {
    const statusCode =
      error instanceof HttpException ? error.getStatus() : undefined;
    const payload = {
      message: 'Order action failed',
      ...context,
      statusCode,
      exception: this.safeExceptionSummary(error),
    };

    if (error instanceof HttpException && statusCode && statusCode < 500) {
      this.logger.warn(payload);
    } else {
      this.logger.error(payload);
    }

    if (
      context.failureStage === 'preparation_tasks' &&
      !(error instanceof HttpException)
    ) {
      return new BadRequestException({
        message: 'Kitchen routing failed for accepted order',
        code: 'kds_routing_failed',
        details: {
          reason: 'routing_exception',
          orderId: context.orderId,
          sessionId: context.sessionId,
          action: context.action,
          failureStage: context.failureStage,
        },
      });
    }

    return error;
  }

  private safeExceptionSummary(error: unknown) {
    if (error instanceof Error) {
      const message = error.message.trim() || error.name || 'Unexpected error';

      return {
        name: error.name,
        message: this.redactSensitiveText(message),
        code: this.stringProperty(error, 'code'),
        stackFirstLine: this.stackFirstLine(error.stack),
      };
    }

    if (typeof error === 'string') {
      return {
        message: this.redactSensitiveText(
          error.trim() || 'Non-error exception',
        ),
      };
    }

    if (error && typeof error === 'object') {
      const record = error as Record<string, unknown>;
      const message =
        this.stringProperty(record, 'message') ??
        this.stringProperty(record, 'error') ??
        'Non-error exception';

      return {
        type: record.constructor?.name ?? 'object',
        message,
        code: this.stringProperty(record, 'code'),
      };
    }

    return {
      type: typeof error,
      message: 'Non-error exception',
    };
  }

  private stackFirstLine(stack: string | undefined) {
    if (!stack) {
      return undefined;
    }

    return this.redactSensitiveText(stack.split('\n')[0]?.trim() ?? '');
  }

  private stringProperty(value: object, key: string) {
    const property = (value as Record<string, unknown>)[key];

    return typeof property === 'string'
      ? this.redactSensitiveText(property)
      : undefined;
  }

  private redactSensitiveText(value: string) {
    const redacted = value
      .replace(
        /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
        '$1$2[redacted]',
      )
      .replace(
        /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
        '$1[redacted]$3',
      );

    return redacted.length > 1_000
      ? `${redacted.slice(0, 1_000)}...`
      : redacted;
  }

  private toOrderResponse(order: any, idempotency?: IdempotencyReplay) {
    const {
      company,
      branch,
      tableSession,
      items,
      events,
      preparationTasks,
      kitchenTickets,
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
        station: item.menuItem?.station,
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
      kitchenTickets: (kitchenTickets ?? []).map((ticket: any) => ({
        id: ticket.id,
        companyId: ticket.companyId,
        branchId: ticket.branchId,
        orderId: ticket.orderId,
        tableSessionId: ticket.tableSessionId,
        station: ticket.station,
        type: ticket.type,
        status: ticket.status,
        displayCode: ticket.displayCode,
        sequence: ticket.sequence,
        orderNumberSnapshot: ticket.orderNumberSnapshot,
        tableCodeSnapshot: ticket.tableCodeSnapshot,
        floorNameSnapshot: ticket.floorNameSnapshot,
        customerNoteSnapshot: ticket.customerNoteSnapshot,
        printedAt: ticket.printedAt,
        readyAt: ticket.readyAt,
        cancelledAt: ticket.cancelledAt,
        servedAt: ticket.servedAt,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        items: ticket.items.map((item: any) => ({
          id: item.id,
          ticketId: item.ticketId,
          orderItemId: item.orderItemId,
          preparationTaskId: item.preparationTaskId,
          menuItemId: item.menuItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          itemSlugSnapshot: item.itemSlugSnapshot,
          quantity: item.quantity,
          notes: item.notes,
          modifiersSnapshot: item.modifiersSnapshot,
          station: item.station,
          status: item.status,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        })),
        printJobs: ticket.printJobs.map((printJob: any) => ({
          id: printJob.id,
          printerStationId: printJob.printerStationId,
          kitchenTicketId: printJob.kitchenTicketId,
          orderId: printJob.orderId,
          kind: printJob.kind,
          status: printJob.status,
          errorMessage: printJob.errorMessage,
          attemptCount: printJob.attemptCount,
          printedAt: printJob.printedAt,
          failedAt: printJob.failedAt,
          createdAt: printJob.createdAt,
          updatedAt: printJob.updatedAt,
        })),
      })),
      totals: {
        subtotalMinor: order.subtotalMinor,
        totalQuantity: order.totalQuantity,
        itemCount: order.itemCount,
        currency: order.currency,
      },
      lifecycle: getOrderLifecycleState({
        status: order.status,
        preparationTasks: preparationTasks ?? [],
      }),
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
          menuItem: {
            select: {
              station: true,
            },
          },
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
      kitchenTickets: {
        orderBy: [{ createdAt: 'asc' as const }],
        include: {
          items: {
            orderBy: [{ createdAt: 'asc' as const }],
          },
          printJobs: {
            orderBy: [{ createdAt: 'desc' as const }],
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
