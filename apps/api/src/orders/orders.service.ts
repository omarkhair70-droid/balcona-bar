import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  CartStatus,
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PreparationTaskStatus,
  Prisma,
} from "@prisma/client";
import { TableAttentionService } from "../autopilot/table-attention.service";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { KitchenTicketsService } from "../kitchen-tickets/kitchen-tickets.service";
import { PresenceNotificationsService } from "../presence-notifications/presence-notifications.service";
import {
  PreparationTaskActionResult,
  PreparationTasksService,
} from "../preparation-tasks/preparation-tasks.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { SmartCashierService } from "../smart-cashier/smart-cashier.service";
import { CashierAcceptOrderDto } from "./dto/cashier-accept-order.dto";
import { CashierOrdersQueryDto } from "./dto/cashier-orders-query.dto";
import { CashierRejectOrderDto } from "./dto/cashier-reject-order.dto";
import { OrderLifecycleActionDto } from "./dto/order-lifecycle-action.dto";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import {
  explainDeniedTransition,
  getOrderLifecycleState,
  OrderLifecycleAction,
  OrderLifecycleDeniedReason,
} from "./order-lifecycle.policy";
import { SubmitCartDto } from "./dto/submit-cart.dto";

const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
const ORDER_NUMBER_PREFIX = "B";
const SUBMIT_CART_TRANSACTION_TIMEOUT_MS = 10_000;
const CASHIER_ACCEPT_TRANSACTION_TIMEOUT_MS = 15_000;
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
  failureStage?: SubmitCartFailureStage;
  slowStage?: string;
  durationMs?: number;
  timings?: SubmitCartTimings;
};

type SubmitCartFailureStage =
  | "submit_lock"
  | "idempotency_lookup"
  | "cart_validation"
  | "order_number"
  | "order_create"
  | "cart_conversion"
  | "response_mapping";

type SubmitCartTimings = {
  submitLockMs: number;
  idempotencyLookupMs: number;
  cartValidationMs: number;
  orderNumberMs: number;
  orderCreateMs: number;
  cartConversionMs: number;
  transactionMs: number;
  responseMappingMs: number;
};

type OrderActionTimings = {
  staffResolveMs?: number;
  orderLookupMs?: number;
  statusUpdateMs?: number;
  stockConsumptionMs?: number;
  preparationTasksMs?: number;
  orderEventMs?: number;
  transactionMs?: number;
  responseMappingMs?: number;
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
  | "validation"
  | "status_update"
  | "inventory_consumption"
  | "preparation_tasks"
  | "kds_ticket_sync"
  | "order_event"
  | "preparation_realtime"
  | "kds_realtime"
  | "print_jobs"
  | "notification"
  | "realtime"
  | "response_mapping"
  | "table_attention_recalculate";

type OrderActionLogContext = {
  requestId?: string;
  action: OrderLifecycleAction;
  orderId: string;
  branchId?: string;
  sessionId?: string;
  previousStatus?: OrderStatus;
  targetStatus?: OrderStatus;
  failureStage?: OrderActionFailureStage;
  slowStage?: string;
  durationMs?: number;
  timings?: OrderActionTimings;
};

type OrderActionTransactionResult = {
  orderId: string;
  branchId?: string;
  sessionId: string;
  actorStaffUserId: string;
  previousStatus: OrderStatus;
  targetStatus: OrderStatus;
  kdsTicketIds?: string[];
  cancelledPreparationTasks?: PreparationTaskActionResult[];
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
    const startedAt = Date.now();
    const timings: SubmitCartTimings = {
      submitLockMs: 0,
      idempotencyLookupMs: 0,
      cartValidationMs: 0,
      orderNumberMs: 0,
      orderCreateMs: 0,
      cartConversionMs: 0,
      transactionMs: 0,
      responseMappingMs: 0,
    };

    let transactionResult: SubmitCartTransactionResult;
    let stage: SubmitCartFailureStage = "submit_lock";

    try {
      const transactionStartedAt = Date.now();
      transactionResult = await this.prisma.$transaction(
        async (tx) => {
          stage = "submit_lock";
          let stageStartedAt = Date.now();
          await this.lockSubmitForSession(sessionId, tx);
          timings.submitLockMs += Date.now() - stageStartedAt;

          if (idempotencyKey) {
            stage = "idempotency_lookup";
            stageStartedAt = Date.now();
            const existingOrder = await this.findByIdempotencyKey(
              sessionId,
              idempotencyKey,
              tx,
            );
            timings.idempotencyLookupMs += Date.now() - stageStartedAt;

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

          stage = "cart_validation";
          stageStartedAt = Date.now();
          const { session, cart, totals } =
            await this.cartService.getValidatedDraftCartForSubmit(
              sessionId,
              tx,
            );
          timings.cartValidationMs += Date.now() - stageStartedAt;

          stage = "order_number";
          stageStartedAt = Date.now();
          const orderNumber = await this.generateOrderNumber(
            session.branchId,
            tx,
          );
          timings.orderNumberMs += Date.now() - stageStartedAt;
          const submittedAt = new Date();
          const submittedMetadata: Record<string, string> = {
            cartId: cart.id,
            action: "submit",
            nextStatus: OrderStatus.submitted,
            source: "customer",
          };

          if (idempotencyKey) {
            submittedMetadata.idempotencyKey = idempotencyKey;
          }

          stage = "order_create";
          stageStartedAt = Date.now();
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
                  modifiersTotalMinorSnapshot:
                    item.modifiersTotalMinorSnapshot,
                  unitPriceMinorSnapshot: item.unitPriceMinorSnapshot,
                  lineTotalMinorSnapshot: item.lineTotalMinorSnapshot,
                  currency: item.currency,
                  modifierOptions: {
                    create: item.modifierOptions.map((option: any) => ({
                      modifierGroupId: option.modifierGroupId,
                      modifierOptionId: option.modifierOptionId,
                      modifierGroupNameSnapshot:
                        option.modifierGroupNameSnapshot,
                      modifierGroupSlugSnapshot:
                        option.modifierGroupSlugSnapshot,
                      modifierOptionNameSnapshot:
                        option.modifierOptionNameSnapshot,
                      modifierOptionSlugSnapshot:
                        option.modifierOptionSlugSnapshot,
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
          timings.orderCreateMs += Date.now() - stageStartedAt;

          stage = "cart_conversion";
          stageStartedAt = Date.now();
          await tx.cart.update({
            where: { id: cart.id },
            data: { status: CartStatus.converted },
          });
          timings.cartConversionMs += Date.now() - stageStartedAt;

          return {
            replayed: false,
            orderId: order.id,
            sessionId: session.id,
            idempotency: {
              replayed: false,
              key: idempotencyKey,
            },
          };
        },
        { timeout: SUBMIT_CART_TRANSACTION_TIMEOUT_MS },
      );
      timings.transactionMs = Date.now() - transactionStartedAt;
    } catch (error) {
      throw this.toSubmitCartError(error, {
        ...logContext,
        failureStage: stage,
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }

    if (transactionResult.replayed) {
      this.logger.log({
        message: "cart_submit.idempotency_replay",
        ...logContext,
        durationMs: Date.now() - startedAt,
        timings,
      });
      return transactionResult.response;
    }

    let response: any;

    try {
      stage = "response_mapping";
      const responseStartedAt = Date.now();
      response = await this.getSubmittedOrderResponse(
        transactionResult.orderId,
        this.prisma,
        transactionResult.idempotency,
      );
      timings.responseMappingMs = Date.now() - responseStartedAt;
    } catch (error) {
      throw this.toSubmitCartError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        orderId: transactionResult.orderId,
        failureStage: "response_mapping",
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }

    this.logger.log({
      message: "cart_submit.response_ready",
      ...logContext,
      sessionId: transactionResult.sessionId,
      orderId: transactionResult.orderId,
      durationMs: Date.now() - startedAt,
      slowStage: this.slowestTimingStage(timings),
      timings,
    });

    this.schedulePostSubmitAutomation({
      ...logContext,
      sessionId: transactionResult.sessionId,
      orderId: transactionResult.orderId,
    });

    return response;
  }

  async findCashierOrders(branchId: string, query: CashierOrdersQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const status = query.status ?? OrderStatus.submitted;
    const statusFilter = status === "all" ? undefined : (status as OrderStatus);
    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
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
      throw new NotFoundException("Branch not found");
    }

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        status: OrderStatus.ready,
      },
      orderBy: [{ readyAt: "asc" }, { submittedAt: "asc" }],
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
      action: "accept",
      orderId,
      targetStatus: OrderStatus.cashier_accepted,
    };
    let stage: OrderActionFailureStage = "validation";
    let transactionResult: OrderActionTransactionResult;
    const timings: OrderActionTimings = {
      staffResolveMs: 0,
      orderLookupMs: 0,
      statusUpdateMs: 0,
      stockConsumptionMs: 0,
      preparationTasksMs: 0,
      orderEventMs: 0,
      transactionMs: 0,
      responseMappingMs: 0,
    };
    const startedAt = Date.now();

    try {
      const transactionStartedAt = Date.now();
      transactionResult = await this.prisma.$transaction(
        async (tx) => {
          stage = "validation";
          let stageStartedAt = Date.now();
          const actorStaffUserId = await this.resolveStaffActor(
            authenticatedStaffUserId,
            body.staffUserId,
            tx,
          );
          timings.staffResolveMs =
            (timings.staffResolveMs ?? 0) + Date.now() - stageStartedAt;

          stageStartedAt = Date.now();
          const order = await tx.order.findUnique({
            where: { id: orderId },
            select: {
              id: true,
              branchId: true,
              tableSessionId: true,
              status: true,
            },
          });
          timings.orderLookupMs =
            (timings.orderLookupMs ?? 0) + Date.now() - stageStartedAt;

          if (!order) {
            throw new NotFoundException("Order not found");
          }

          logContext.sessionId = order.tableSessionId;
          logContext.branchId = order.branchId;
          logContext.previousStatus = order.status;
          this.assertLifecycleTransition(order, "accept");

          const now = new Date();

          stage = "status_update";
          stageStartedAt = Date.now();
          const updatedOrder = await tx.order.updateMany({
            where: { id: order.id, status: order.status },
            data: {
              status: OrderStatus.cashier_accepted,
              cashierAcceptedAt: now,
            },
          });
          timings.statusUpdateMs =
            (timings.statusUpdateMs ?? 0) + Date.now() - stageStartedAt;

          this.assertFreshTransition(updatedOrder.count);

          stage = "inventory_consumption";
          stageStartedAt = Date.now();
          await this.inventoryService.consumeStockForAcceptedOrder(
            order.id,
            actorStaffUserId,
            tx,
          );
          timings.stockConsumptionMs =
            (timings.stockConsumptionMs ?? 0) + Date.now() - stageStartedAt;

          stage = "preparation_tasks";
          stageStartedAt = Date.now();
          const kdsRouting =
            await this.preparationTasksService.createTasksForAcceptedOrder(
              order.id,
              actorStaffUserId,
              tx,
              { createPrintJobs: false, recordRealtimeEvents: false },
            );
          timings.preparationTasksMs =
            (timings.preparationTasksMs ?? 0) + Date.now() - stageStartedAt;
          this.logger.log({
            message: "accept.preparation_tasks",
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

          stage = "order_event";
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
                "accept",
                "cashier",
              ),
            },
          });
          timings.orderEventMs =
            (timings.orderEventMs ?? 0) + Date.now() - stageStartedAt;

          this.logger.log({
            message: "accept.critical_transaction",
            requestId,
            orderId: order.id,
            branchId: order.branchId,
            durationMs: Date.now() - startedAt,
            slowStage: this.slowestTimingStage(timings),
            timings,
          });

          return {
            orderId: order.id,
            branchId: order.branchId,
            sessionId: order.tableSessionId,
            actorStaffUserId,
            previousStatus: order.status,
            targetStatus: OrderStatus.cashier_accepted,
            kdsTicketIds: kdsRouting.ticketRouting.ticketIds,
          };
        },
        { timeout: CASHIER_ACCEPT_TRANSACTION_TIMEOUT_MS },
      );
      timings.transactionMs = Date.now() - transactionStartedAt;
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
      });
    }

    this.schedulePostOrderActionAutomation(
      {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
      },
      [
        {
          stage: "preparation_realtime",
          run: () =>
            this.preparationTasksService.recordCreatedRealtimeEventsForOrder(
              transactionResult.orderId,
            ),
        },
        {
          stage: "kds_realtime",
          run: () =>
            this.kitchenTicketsService.recordCreatedRealtimeEventsForTickets(
              transactionResult.kdsTicketIds ?? [],
            ),
        },
        {
          stage: "print_jobs",
          run: () =>
            this.kitchenTicketsService.createPrintJobsForTickets(
              transactionResult.kdsTicketIds ?? [],
              transactionResult.actorStaffUserId,
            ),
        },
        {
          stage: "notification",
          run: () =>
            this.presenceNotificationsService.createOrderAcceptedNotification(
              transactionResult.orderId,
            ),
        },
        {
          stage: "realtime",
          run: () =>
            this.realtimeEventsService.recordOrderAccepted(
              transactionResult.orderId,
            ),
        },
        {
          stage: "table_attention_recalculate",
          run: () =>
            this.recalculateAttention(
              transactionResult.sessionId,
              this.prisma,
              "order_accepted",
              { orderId: transactionResult.orderId },
            ),
        },
      ],
    );

    try {
      const responseStartedAt = Date.now();
      const response = await this.getAcceptedOrderResponse(
        transactionResult.orderId,
        this.prisma,
      );
      timings.responseMappingMs = Date.now() - responseStartedAt;

      this.logger.log({
        message: "accept.response_ready",
        requestId,
        orderId: transactionResult.orderId,
        branchId: transactionResult.branchId,
        sessionId: transactionResult.sessionId,
        durationMs: Date.now() - startedAt,
        slowStage: this.slowestTimingStage(timings),
        timings,
      });

      return response;
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: "response_mapping",
        slowStage: this.slowestTimingStage(timings),
        durationMs: Date.now() - startedAt,
        timings,
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
      action: "reject",
      orderId,
      targetStatus: OrderStatus.cashier_rejected,
    };
    let stage: OrderActionFailureStage = "validation";
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
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
          throw new NotFoundException("Order not found");
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, "reject");

        const now = new Date();

        stage = "status_update";
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
              "reject",
              "cashier",
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

    await this.runPostOrderActionAutomation(
      {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
      },
      [
        {
          stage: "notification",
          run: () =>
            this.presenceNotificationsService.createOrderRejectedNotification(
              transactionResult.orderId,
              rejectionReason,
            ),
        },
        {
          stage: "realtime",
          run: () =>
            this.realtimeEventsService.recordOrderRejected(
              transactionResult.orderId,
            ),
        },
        {
          stage: "table_attention_recalculate",
          run: () =>
            this.recalculateAttention(
              transactionResult.sessionId,
              this.prisma,
              "order_rejected",
              { orderId: transactionResult.orderId },
            ),
        },
      ],
    );

    try {
      return await this.getOrderResponse(
        transactionResult.orderId,
        this.prisma,
      );
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: "response_mapping",
      });
    }
  }

  async serve(
    orderId: string,
    body: OrderLifecycleActionDto = {},
    authenticatedStaffUserId?: string,
    requestId?: string,
  ) {
    const note = this.normalizeOptionalText(body.note);
    const logContext: OrderActionLogContext = {
      requestId,
      action: "serve",
      orderId,
      targetStatus: OrderStatus.served,
    };
    let stage: OrderActionFailureStage = "validation";
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
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
            preparationTasks: {
              where: { status: { not: PreparationTaskStatus.cancelled } },
              select: { id: true, status: true },
            },
          },
        });

        if (!order) {
          throw new NotFoundException("Order not found");
        }

        logContext.branchId = order.branchId;
        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, "serve");

        const now = new Date();

        stage = "status_update";
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
              "serve",
              "waiter",
              note ? { note } : undefined,
            ),
          },
        });

        stage = "kds_ticket_sync";
        const kdsSync = await this.kitchenTicketsService.syncTicketsForOrderServed(
          order.id,
          tx,
          { recordRealtimeEvents: false },
        );

        return {
          orderId: order.id,
          branchId: order.branchId,
          sessionId: order.tableSessionId,
          actorStaffUserId,
          previousStatus: order.status,
          targetStatus: OrderStatus.served,
          kdsTicketIds: kdsSync.ticketIds,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    this.schedulePostOrderActionAutomation(
      {
        ...logContext,
        branchId: transactionResult.branchId,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
      },
      [
        {
          stage: "notification",
          run: () =>
            this.presenceNotificationsService.createOrderServedNotification(
              transactionResult.orderId,
            ),
        },
        {
          stage: "kds_realtime",
          run: () =>
            this.kitchenTicketsService.recordUpdatedRealtimeEventsForTickets(
              transactionResult.kdsTicketIds ?? [],
            ),
        },
        {
          stage: "realtime",
          run: () =>
            this.realtimeEventsService.recordOrderServed(
              transactionResult.orderId,
              this.prisma,
            ),
        },
        {
          stage: "table_attention_recalculate",
          run: () =>
            this.recalculateAttention(
              transactionResult.sessionId,
              this.prisma,
              "order_served",
              {
                orderId: transactionResult.orderId,
              },
            ),
        },
      ],
    );

    try {
      return await this.getOrderResponse(
        transactionResult.orderId,
        this.prisma,
      );
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        branchId: transactionResult.branchId,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: "response_mapping",
      });
    }
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
      action: "complete",
      orderId,
      targetStatus: OrderStatus.completed,
    };
    let stage: OrderActionFailureStage = "validation";
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
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
          throw new NotFoundException("Order not found");
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, "complete");

        const now = new Date();

        stage = "status_update";
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
              "complete",
              "cashier",
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

    await this.runPostOrderActionAutomation(
      {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
      },
      [
        {
          stage: "realtime",
          run: () =>
            this.realtimeEventsService.recordOrderCompleted(
              transactionResult.orderId,
            ),
        },
        {
          stage: "table_attention_recalculate",
          run: () =>
            this.recalculateAttention(
              transactionResult.sessionId,
              this.prisma,
              "order_completed",
              { orderId: transactionResult.orderId },
            ),
        },
      ],
    );

    try {
      return await this.getOrderResponse(
        transactionResult.orderId,
        this.prisma,
      );
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: "response_mapping",
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
      action: "cancel",
      orderId,
      targetStatus: OrderStatus.cancelled,
    };
    let stage: OrderActionFailureStage = "validation";
    let transactionResult: OrderActionTransactionResult;

    try {
      transactionResult = await this.prisma.$transaction(async (tx) => {
        stage = "validation";
        const actorStaffUserId = await this.resolveStaffActor(
          authenticatedStaffUserId,
          body.staffUserId,
          tx,
        );

        if (!reason) {
          throw this.lifecycleBadRequest(
            "cancellation_requires_reason",
            "Cancellation requires a reason",
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
          throw new NotFoundException("Order not found");
        }

        logContext.sessionId = order.tableSessionId;
        logContext.previousStatus = order.status;
        this.assertLifecycleTransition(order, "cancel");

        stage = "status_update";
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
              "cancel",
              "cashier",
              { reason },
            ),
          },
        });

        stage = "preparation_tasks";
        const cancelledPreparationTasks =
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
          cancelledPreparationTasks,
        };
      });
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        failureStage: stage,
      });
    }

    this.preparationTasksService.scheduleOrderCancellationTaskPostCommit(
      transactionResult.cancelledPreparationTasks ?? [],
    );

    await this.runPostOrderActionAutomation(
      {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
      },
      [
        {
          stage: "realtime",
          run: () =>
            this.realtimeEventsService.recordOrderCancelled(
              transactionResult.orderId,
            ),
        },
        {
          stage: "table_attention_recalculate",
          run: () =>
            this.recalculateAttention(
              transactionResult.sessionId,
              this.prisma,
              "order_cancelled",
              { orderId: transactionResult.orderId, reason },
            ),
        },
      ],
    );

    try {
      return await this.getOrderResponse(
        transactionResult.orderId,
        this.prisma,
      );
    } catch (error) {
      throw this.toOrderActionError(error, {
        ...logContext,
        sessionId: transactionResult.sessionId,
        previousStatus: transactionResult.previousStatus,
        targetStatus: transactionResult.targetStatus,
        failureStage: "response_mapping",
      });
    }
  }

  async findForTableSession(sessionId: string) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionContextSelect(),
    });

    if (!session) {
      throw new NotFoundException("Table session not found");
    }

    const orders = await this.prisma.order.findMany({
      where: {
        tableSessionId: sessionId,
        status: { in: SUBMITTED_SESSION_ORDER_STATUSES },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
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

    const latestOrder = await tx.order.findFirst({
      where: {
        branchId,
        orderNumber: { startsWith: ORDER_NUMBER_PREFIX },
      },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { orderNumber: true },
    });
    let sequence = this.sequenceFromOrderNumber(latestOrder?.orderNumber) + 1;

    while (true) {
      const orderNumber = `${ORDER_NUMBER_PREFIX}${String(sequence).padStart(4, "0")}`;
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

  private sequenceFromOrderNumber(orderNumber: string | null | undefined) {
    const match = orderNumber?.match(/^B(\d+)$/);

    return match ? Number.parseInt(match[1], 10) : 0;
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
      throw new NotFoundException("Order not found");
    }

    return this.toOrderResponse(order, idempotency);
  }

  private async getSubmittedOrderResponse(
    orderId: string,
    tx: PrismaExecutor,
    idempotency?: IdempotencyReplay,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: this.submittedOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.toOrderResponse(order, idempotency);
  }

  private async getAcceptedOrderResponse(orderId: string, tx: PrismaExecutor) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: this.acceptedOrderInclude(),
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    return this.toOrderResponse(order);
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

  private async resolveStaffActor(
    authenticatedStaffUserId: string | undefined,
    bodyStaffUserId: string | undefined,
    tx: PrismaExecutor,
  ) {
    const staffUserId = authenticatedStaffUserId ?? bodyStaffUserId;

    if (!staffUserId) {
      throw this.lifecycleBadRequest(
        "missing_staff_actor",
        "Staff actor is required for this order transition",
      );
    }

    await this.assertStaffUserExists(staffUserId, tx);

    return staffUserId;
  }

  private assertLifecycleTransition(
    order: {
      status: OrderStatus;
      preparationTasks?: { status: PreparationTaskStatus }[];
    },
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
        "stale_order_state",
        "Order state changed before the transition could be saved",
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
    source: "cashier" | "kitchen" | "waiter" | "system" | "customer",
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
      "order_submitted_notification",
      context,
      () =>
        this.presenceNotificationsService.createOrderSubmittedNotification(
          orderId,
        ),
    );
    await this.runPostSubmitAutomationStep(
      "order_submitted_realtime",
      context,
      () => this.realtimeEventsService.recordOrderSubmitted(orderId),
    );
    await this.runPostSubmitAutomationStep(
      "smart_cashier_auto_accept",
      context,
      () => this.smartCashierService.attemptAutoAcceptOrder(orderId),
    );
    await this.runPostSubmitAutomationStep(
      "table_attention_recalculate",
      context,
      () =>
        this.recalculateAttention(sessionId, this.prisma, "order_submitted", {
          orderId,
        }),
    );
  }

  private schedulePostSubmitAutomation(context: SubmitCartLogContext) {
    void this.runPostSubmitAutomation(context).catch((error) => {
      this.logger.warn({
        message:
          "Post-submit automation scheduler failed; order remains submitted for manual review",
        ...context,
        exception: this.safeExceptionSummary(error),
      });
    });
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
          "Post-submit automation failed; order remains submitted for manual review",
        stage,
        ...context,
        exception: this.safeExceptionSummary(error),
      });
    }
  }

  private schedulePostOrderActionAutomation(
    context: OrderActionLogContext,
    steps: Array<{
      stage: OrderActionFailureStage;
      run: () => Promise<unknown>;
    }>,
  ) {
    void this.runPostOrderActionAutomation(context, steps).catch((error) => {
      this.logger.warn({
        message:
          "Post-order action automation scheduler failed; committed order status remains source of truth",
        ...context,
        exception: this.safeExceptionSummary(error),
      });
    });
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
            "Post-order action automation failed; committed order status remains source of truth",
          ...context,
          failureStage: step.stage,
          exception: this.safeExceptionSummary(error),
        });
      }
    }
  }

  private toSubmitCartError(error: unknown, context: SubmitCartLogContext) {
    const exception = this.safeExceptionSummary(error);

    if (error instanceof NotFoundException) {
      this.logger.warn({
        message: "Cart submit rejected because table session is invalid",
        ...context,
        exception,
      });

      return new BadRequestException("Table session is invalid or unavailable");
    }

    if (!(error instanceof HttpException)) {
      this.logger.error({
        message: "Cart submit failed before order creation completed",
        ...context,
        exception,
      });

      if (this.isTransactionTimeout(exception)) {
        return new InternalServerErrorException({
          message: "The operation timed out while saving. Please retry.",
          code: "DB_TRANSACTION_TIMEOUT",
          details: {
            flow: "customer_submit_cart",
            action: "cart_submit",
            requestId: context.requestId,
            sessionId: context.sessionId,
            orderId: context.orderId,
            failureStage: context.failureStage,
            slowStage: context.slowStage ?? context.failureStage,
            durationMs: context.durationMs,
            timings: context.timings,
            exception,
          },
        });
      }
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

  private toOrderActionError(error: unknown, context: OrderActionLogContext) {
    const statusCode =
      error instanceof HttpException ? error.getStatus() : undefined;
    const exception = this.safeExceptionSummary(error);
    const payload = {
      message: "Order action failed",
      ...context,
      statusCode,
      exception,
    };

    if (error instanceof HttpException && statusCode && statusCode < 500) {
      this.logger.warn(payload);
    } else {
      this.logger.error(payload);
    }

    if (
      context.failureStage === "preparation_tasks" &&
      !(error instanceof HttpException)
    ) {
      return new BadRequestException({
        message: "Kitchen routing failed for accepted order",
        code: "kds_routing_failed",
        details: {
          reason: "routing_exception",
          orderId: context.orderId,
          branchId: context.branchId,
          sessionId: context.sessionId,
          action: context.action,
          failureStage: context.failureStage,
          stationsDetected: [],
          createdTaskCount: 0,
          createdTicketCount: 0,
          skippedItems: { count: 0, reasons: [] },
          exception,
        },
      });
    }

    if (
      context.action === "accept" &&
      !(error instanceof HttpException) &&
      this.isTransactionTimeout(exception)
    ) {
      return new InternalServerErrorException({
        message: "The operation timed out while saving. Please retry.",
        code: "DB_TRANSACTION_TIMEOUT",
        details: {
          flow: "cashier_accept",
          action: context.action,
          requestId: context.requestId,
          orderId: context.orderId,
          branchId: context.branchId,
          sessionId: context.sessionId,
          previousStatus: context.previousStatus,
          targetStatus: context.targetStatus,
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

  private isTransactionTimeout(exception: { code?: string; message?: string }) {
    return (
      exception.code === "P2028" ||
      /transaction already closed|timeout|timed out/i.test(
        exception.message ?? "",
      )
    );
  }

  private safeExceptionSummary(error: unknown) {
    if (error instanceof Error) {
      const message = error.message.trim() || error.name || "Unexpected error";

      return {
        name: error.name,
        message: this.redactSensitiveText(message),
        code: this.stringProperty(error, "code"),
        stackFirstLine: this.stackFirstLine(error.stack),
      };
    }

    if (typeof error === "string") {
      return {
        message: this.redactSensitiveText(
          error.trim() || "Non-error exception",
        ),
      };
    }

    if (error && typeof error === "object") {
      const record = error as Record<string, unknown>;
      const message =
        this.stringProperty(record, "message") ??
        this.stringProperty(record, "error") ??
        "Non-error exception";

      return {
        type: record.constructor?.name ?? "object",
        message,
        code: this.stringProperty(record, "code"),
      };
    }

    return {
      type: typeof error,
      message: "Non-error exception",
    };
  }

  private stackFirstLine(stack: string | undefined) {
    if (!stack) {
      return undefined;
    }

    return this.redactSensitiveText(stack.split("\n")[0]?.trim() ?? "");
  }

  private stringProperty(value: object, key: string) {
    const property = (value as Record<string, unknown>)[key];

    return typeof property === "string"
      ? this.redactSensitiveText(property)
      : undefined;
  }

  private redactSensitiveText(value: string) {
    const redacted = value
      .replace(
        /(password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
        "$1$2[redacted]",
      )
      .replace(
        /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
        "$1[redacted]$3",
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
        events: (task.events ?? []).map((event: any) => ({
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
        printJobs: (ticket.printJobs ?? []).map((printJob: any) => ({
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
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          menuItem: {
            select: {
              station: true,
            },
          },
          modifierOptions: {
            orderBy: [{ createdAt: "asc" as const }],
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" as const }],
      },
      preparationTasks: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          events: {
            orderBy: [{ createdAt: "asc" as const }],
          },
        },
      },
      kitchenTickets: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          items: {
            orderBy: [{ createdAt: "asc" as const }],
          },
          printJobs: {
            orderBy: [{ createdAt: "desc" as const }],
          },
        },
      },
    } satisfies Prisma.OrderInclude;
  }

  private submittedOrderInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      items: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          menuItem: {
            select: {
              station: true,
            },
          },
          modifierOptions: {
            orderBy: [{ createdAt: "asc" as const }],
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" as const }],
      },
    } satisfies Prisma.OrderInclude;
  }

  private acceptedOrderInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
      items: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          menuItem: {
            select: {
              station: true,
            },
          },
          modifierOptions: {
            orderBy: [{ createdAt: "asc" as const }],
          },
        },
      },
      events: {
        orderBy: [{ createdAt: "asc" as const }],
      },
      preparationTasks: {
        orderBy: [{ createdAt: "asc" as const }],
      },
      kitchenTickets: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          items: {
            orderBy: [{ createdAt: "asc" as const }],
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
