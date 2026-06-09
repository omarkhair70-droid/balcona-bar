import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderEventActorType,
  OrderEventType,
  OrderStatus,
  PreparationStation,
  PreparationTaskEventType,
  PreparationTaskStatus,
  Prisma,
} from '@prisma/client';
import { TableAttentionService } from '../autopilot/table-attention.service';
import {
  KitchenTicketRoutingResult,
  KitchenTicketsService,
} from '../kitchen-tickets/kitchen-tickets.service';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import {
  explainDeniedTransition,
  isTerminalOrderStatus,
} from '../orders/order-lifecycle.policy';
import { BranchPreparationTasksQueryDto } from './dto/branch-preparation-tasks-query.dto';
import { CancelPreparationTaskDto } from './dto/cancel-preparation-task.dto';
import { PreparationTaskActionDto } from './dto/preparation-task-action.dto';

const ACTIONABLE_STATIONS: PreparationStation[] = [
  PreparationStation.barista,
  PreparationStation.kitchen,
  PreparationStation.dessert,
];

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export type KdsRoutingResult = {
  orderId: string;
  branchId: string;
  itemCount: number;
  actionableItemCount: number;
  stationsDetected: PreparationStation[];
  skippedItems: {
    orderItemId: string;
    station: PreparationStation;
    reason: 'non_actionable_station';
  }[];
  createdTaskCount: number;
  existingTaskCount: number;
  activeTaskCount: number;
  ticketRouting: KitchenTicketRoutingResult;
};

type CreateTasksForAcceptedOrderOptions = {
  createPrintJobs?: boolean;
};

@Injectable()
export class PreparationTasksService {
  private readonly logger = new Logger(PreparationTasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly tableAttentionService: TableAttentionService,
    private readonly kitchenTicketsService: KitchenTicketsService,
  ) {}

  async createTasksForAcceptedOrder(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
    options: CreateTasksForAcceptedOrderOptions = {},
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        status: true,
        tableSessionId: true,
        items: {
          select: {
            id: true,
            quantity: true,
            notes: true,
            itemNameSnapshot: true,
            itemSlugSnapshot: true,
            menuItem: {
              select: {
                station: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (isTerminalOrderStatus(order.status)) {
      throw this.preparationBadRequest('parent_order_terminal');
    }

    if (order.status !== OrderStatus.cashier_accepted) {
      throw this.preparationBadRequest('parent_order_not_accepted');
    }

    let activeTaskCount = 0;
    let createdTaskCount = 0;
    let existingTaskCount = 0;
    const skippedItems: KdsRoutingResult['skippedItems'] = [];
    const actionableStations = new Set<PreparationStation>();
    let actionableItemCount = 0;

    for (const item of order.items) {
      if (!ACTIONABLE_STATIONS.includes(item.menuItem.station)) {
        skippedItems.push({
          orderItemId: item.id,
          station: item.menuItem.station,
          reason: 'non_actionable_station',
        });
        continue;
      }

      actionableItemCount += 1;
      actionableStations.add(item.menuItem.station);

      const existingTask = await tx.preparationTask.findUnique({
        where: { orderItemId: item.id },
        select: { id: true },
      });

      if (existingTask) {
        activeTaskCount += 1;
        existingTaskCount += 1;
        continue;
      }

      const task = await tx.preparationTask.create({
        data: {
          companyId: order.companyId,
          branchId: order.branchId,
          orderId: order.id,
          orderItemId: item.id,
          station: item.menuItem.station,
          status: PreparationTaskStatus.pending,
          quantity: item.quantity,
          itemNameSnapshot: item.itemNameSnapshot,
          itemSlugSnapshot: item.itemSlugSnapshot,
          notes: item.notes,
          events: {
            create: {
              type: PreparationTaskEventType.created,
              actorStaffUserId: staffUserId,
              metadata: {
                orderId: order.id,
                orderItemId: item.id,
              },
            },
          },
        },
        select: { id: true },
      });

      await this.realtimeEventsService.recordPreparationTaskCreated(
        task.id,
        tx,
      );
      activeTaskCount += 1;
      createdTaskCount += 1;
    }

    const ticketRouting =
      await this.kitchenTicketsService.createTicketsForAcceptedOrder(
        order.id,
        staffUserId,
        tx,
        { createPrintJobs: options.createPrintJobs },
      );

    const result: KdsRoutingResult = {
      orderId: order.id,
      branchId: order.branchId,
      itemCount: order.items.length,
      actionableItemCount,
      stationsDetected: [...actionableStations],
      skippedItems,
      createdTaskCount,
      existingTaskCount,
      activeTaskCount,
      ticketRouting,
    };

    this.logger.log({
      message: 'kds.create_tasks_for_order',
      orderId: order.id,
      branchId: order.branchId,
      itemCount: result.itemCount,
      actionableItemCount,
      stationsDetected: result.stationsDetected,
      createdTaskCount,
      existingTaskCount,
      activeTaskCount,
      createdTicketCount: ticketRouting.createdTicketCount,
      existingTicketCount: ticketRouting.existingTicketCount,
      ticketCount: ticketRouting.ticketIds.length,
      skippedItemCount: skippedItems.length,
      zeroTicketReason:
        actionableItemCount > 0 && ticketRouting.ticketIds.length === 0
          ? 'actionable_items_without_tickets'
          : undefined,
    });

    if (actionableItemCount > 0 && activeTaskCount === 0) {
      throw this.kdsRoutingBadRequest(order.id, order.branchId, {
        reason: 'actionable_items_without_tasks',
        actionableItemCount,
        stationsDetected: [...actionableStations],
      });
    }

    if (actionableItemCount > 0 && ticketRouting.ticketIds.length === 0) {
      throw this.kdsRoutingBadRequest(order.id, order.branchId, {
        reason: 'actionable_items_without_tickets',
        actionableItemCount,
        stationsDetected: [...actionableStations],
      });
    }

    if (activeTaskCount === 0) {
      await this.syncOrderPreparationReady(
        order.id,
        staffUserId,
        tx,
        'no_active_preparation_tasks',
      );
    }

    return result;
  }

  async findForBranch(
    branchId: string,
    query: BranchPreparationTasksQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const station = query.station ?? 'all';
    const status = query.status ?? PreparationTaskStatus.pending;
    const stationFilter =
      station === 'all' ? undefined : (station as PreparationStation);
    const statusFilter =
      status === 'all' ? undefined : (status as PreparationTaskStatus);
    const tasks = await this.prisma.preparationTask.findMany({
      where: {
        branchId,
        ...(stationFilter ? { station: stationFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: this.taskInclude(),
    });

    return {
      branch,
      station,
      status,
      tasks: tasks.map((task) => this.toTaskResponse(task)),
    };
  }

  async findForOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: this.orderContextSelect(),
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const tasks = await this.prisma.preparationTask.findMany({
      where: { orderId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: this.taskInclude(),
    });

    return {
      ...this.toOrderContextResponse(order),
      tasks: tasks.map((task) => this.toTaskResponse(task)),
    };
  }

  async findOne(taskId: string) {
    return this.getTaskResponse(taskId, this.prisma);
  }

  async start(taskId: string, body: PreparationTaskActionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const task = await this.findTaskStatus(taskId, tx);

      this.assertParentOrderActionable(task.order.status, 'start');

      if (task.status !== PreparationTaskStatus.pending) {
        throw this.preparationBadRequest('task_not_actionable');
      }

      await tx.preparationTask.update({
        where: { id: task.id },
        data: {
          status: PreparationTaskStatus.preparing,
          startedAt: new Date(),
        },
      });

      await tx.preparationTaskEvent.create({
        data: {
          preparationTaskId: task.id,
          type: PreparationTaskEventType.started,
          actorStaffUserId: body.staffUserId,
        },
      });

      await this.presenceNotificationsService.createPreparationStartedNotification(
        task.id,
        tx,
      );
      await this.realtimeEventsService.recordPreparationTaskStarted(
        task.id,
        tx,
      );
      await this.syncOrderPreparationStarted(
        task.orderId,
        body.staffUserId,
        tx,
      );
      await this.kitchenTicketsService.syncTicketsForTaskStarted(task.id, tx);
      await this.recalculateAttention(
        task.order.tableSessionId,
        tx,
        'preparation_task_started',
        { preparationTaskId: task.id, orderId: task.orderId },
      );

      return this.getTaskResponse(task.id, tx);
    });
  }

  async markReady(taskId: string, body: PreparationTaskActionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const task = await this.findTaskStatus(taskId, tx);

      this.assertParentOrderActionable(task.order.status, 'ready');

      if (
        task.status !== PreparationTaskStatus.pending &&
        task.status !== PreparationTaskStatus.preparing
      ) {
        throw this.preparationBadRequest(
          task.status === PreparationTaskStatus.ready
            ? 'task_already_ready'
            : task.status === PreparationTaskStatus.cancelled
              ? 'task_already_cancelled'
              : 'task_not_actionable',
        );
      }

      await tx.preparationTask.update({
        where: { id: task.id },
        data: {
          status: PreparationTaskStatus.ready,
          readyAt: new Date(),
        },
      });

      await tx.preparationTaskEvent.create({
        data: {
          preparationTaskId: task.id,
          type: PreparationTaskEventType.marked_ready,
          actorStaffUserId: body.staffUserId,
        },
      });

      await this.presenceNotificationsService.createPreparationReadyNotification(
        task.id,
        tx,
      );
      await this.realtimeEventsService.recordPreparationTaskReady(task.id, tx);
      await this.syncOrderPreparationReady(task.orderId, body.staffUserId, tx);
      await this.kitchenTicketsService.syncTicketsForTaskReady(task.id, tx);
      await this.recalculateAttention(
        task.order.tableSessionId,
        tx,
        'preparation_task_ready',
        { preparationTaskId: task.id, orderId: task.orderId },
      );

      return this.getTaskResponse(task.id, tx);
    });
  }

  async cancel(taskId: string, body: CancelPreparationTaskDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const task = await this.findTaskStatus(taskId, tx);

      this.assertParentOrderActionable(task.order.status, 'cancel');

      if (
        task.status === PreparationTaskStatus.ready ||
        task.status === PreparationTaskStatus.cancelled
      ) {
        throw this.preparationBadRequest(
          task.status === PreparationTaskStatus.cancelled
            ? 'task_already_cancelled'
            : 'task_not_actionable',
        );
      }

      const reason = this.normalizeOptionalText(body.reason);

      await tx.preparationTask.update({
        where: { id: task.id },
        data: {
          status: PreparationTaskStatus.cancelled,
          cancelledAt: new Date(),
        },
      });

      await tx.preparationTaskEvent.create({
        data: {
          preparationTaskId: task.id,
          type: PreparationTaskEventType.cancelled,
          actorStaffUserId: body.staffUserId,
          metadata: reason ? { reason } : undefined,
        },
      });

      await this.realtimeEventsService.recordPreparationTaskCancelled(
        task.id,
        tx,
      );
      await this.kitchenTicketsService.syncTicketsForTaskCancelled(
        task.id,
        reason,
        body.staffUserId,
        tx,
      );
      await this.recalculateAttention(
        task.order.tableSessionId,
        tx,
        'preparation_task_cancelled',
        { preparationTaskId: task.id, orderId: task.orderId },
      );

      return this.getTaskResponse(task.id, tx);
    });
  }

  async cancelActiveTasksForOrderCancellation(
    orderId: string,
    staffUserId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ) {
    const tasks = await tx.preparationTask.findMany({
      where: {
        orderId,
        status: {
          in: [PreparationTaskStatus.pending, PreparationTaskStatus.preparing],
        },
      },
      select: { id: true },
    });

    if (tasks.length === 0) {
      return [];
    }

    const now = new Date();
    const cancelledTaskIds: string[] = [];

    for (const task of tasks) {
      const updatedTask = await tx.preparationTask.updateMany({
        where: {
          id: task.id,
          status: {
            in: [
              PreparationTaskStatus.pending,
              PreparationTaskStatus.preparing,
            ],
          },
        },
        data: {
          status: PreparationTaskStatus.cancelled,
          cancelledAt: now,
        },
      });

      if (updatedTask.count === 0) {
        continue;
      }

      await tx.preparationTaskEvent.create({
        data: {
          preparationTaskId: task.id,
          type: PreparationTaskEventType.cancelled,
          actorStaffUserId: staffUserId,
          metadata: {
            reason,
            source: 'order_cancellation',
            orderId,
          },
        },
      });
      await this.realtimeEventsService.recordPreparationTaskCancelled(
        task.id,
        tx,
      );
      await this.kitchenTicketsService.syncTicketsForTaskCancelled(
        task.id,
        reason,
        staffUserId,
        tx,
      );
      cancelledTaskIds.push(task.id);
    }

    return cancelledTaskIds;
  }

  private async findTaskStatus(taskId: string, tx: PrismaExecutor) {
    const task = await tx.preparationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        orderId: true,
        status: true,
        order: {
          select: {
            tableSessionId: true,
            status: true,
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Preparation task not found');
    }

    return task;
  }

  private async syncOrderPreparationStarted(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const now = new Date();
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: OrderStatus.cashier_accepted,
      },
      data: {
        status: OrderStatus.preparing,
        preparingAt: now,
      },
    });

    if (updatedOrder.count === 0) {
      return;
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        type: OrderEventType.preparation_started,
        actorType: staffUserId
          ? OrderEventActorType.staff
          : OrderEventActorType.system,
        actorStaffUserId: staffUserId,
        metadata: {
          previousStatus: OrderStatus.cashier_accepted,
          nextStatus: OrderStatus.preparing,
          action: 'start_preparation',
          source: staffUserId ? 'kitchen' : 'system',
        },
      },
    });
    await this.realtimeEventsService.recordOrderPreparationStarted(orderId, tx);
  }

  private async syncOrderPreparationReady(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
    reason?: string,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        preparationTasks: {
          where: { status: { not: PreparationTaskStatus.cancelled } },
          select: { id: true, status: true },
        },
      },
    });

    if (!order) {
      return;
    }

    if (!reason) {
      if (order.preparationTasks.length === 0) {
        return;
      }

      if (
        !order.preparationTasks.every(
          (task) => task.status === PreparationTaskStatus.ready,
        )
      ) {
        return;
      }
    }

    const deniedReason = explainDeniedTransition(
      {
        status: order.status,
        preparationTasks: reason
          ? []
          : order.preparationTasks.map((task) => ({ status: task.status })),
      },
      'system_preparation_ready',
    );

    if (deniedReason) {
      return;
    }

    const now = new Date();
    const updatedOrder = await tx.order.updateMany({
      where: {
        id: orderId,
        status: {
          in: [OrderStatus.cashier_accepted, OrderStatus.preparing],
        },
      },
      data: {
        status: OrderStatus.ready,
        readyAt: now,
      },
    });

    if (updatedOrder.count === 0) {
      return;
    }

    await tx.orderEvent.create({
      data: {
        orderId,
        type: OrderEventType.preparation_ready,
        actorType: staffUserId
          ? OrderEventActorType.staff
          : OrderEventActorType.system,
        actorStaffUserId: staffUserId,
        metadata: {
          previousStatus: order.status,
          nextStatus: OrderStatus.ready,
          action: 'system_preparation_ready',
          source: 'system',
          ...(reason ? { reason } : {}),
        },
      },
    });
    await this.realtimeEventsService.recordOrderPreparationReady(orderId, tx);
  }

  private async getTaskResponse(taskId: string, tx: PrismaExecutor) {
    const task = await tx.preparationTask.findUnique({
      where: { id: taskId },
      include: this.taskInclude(),
    });

    if (!task) {
      throw new NotFoundException('Preparation task not found');
    }

    return this.toTaskResponse(task);
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

  private assertParentOrderActionable(
    orderStatus: OrderStatus,
    action: 'start' | 'ready' | 'cancel',
  ) {
    if (orderStatus === OrderStatus.cancelled) {
      throw this.preparationBadRequest('order_cancelled');
    }

    if (
      orderStatus === OrderStatus.cashier_rejected ||
      orderStatus === OrderStatus.completed ||
      orderStatus === OrderStatus.served ||
      isTerminalOrderStatus(orderStatus)
    ) {
      throw this.preparationBadRequest('parent_order_terminal');
    }

    if (action === 'cancel') {
      return;
    }

    if (
      orderStatus !== OrderStatus.cashier_accepted &&
      orderStatus !== OrderStatus.preparing
    ) {
      throw this.preparationBadRequest('parent_order_not_accepted');
    }
  }

  private preparationBadRequest(code: string) {
    return new BadRequestException({
      code,
      message: code,
    });
  }

  private kdsRoutingBadRequest(
    orderId: string,
    branchId: string,
    details: Record<string, unknown>,
  ) {
    this.logger.error({
      message: 'kds.routing_failed_for_order',
      orderId,
      branchId,
      ...details,
    });

    return new BadRequestException({
      message: 'Kitchen routing failed for accepted order',
      code: 'kds_routing_failed',
      details: {
        orderId,
        branchId,
        ...details,
      },
    });
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

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toTaskResponse(task: any) {
    const { company, branch, order, orderItem, events, ...taskFields } = task;
    const { tableSession, ...orderFields } = order;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;
    const { modifierOptions, ...orderItemFields } = orderItem;

    return {
      task: taskFields,
      company,
      branch,
      order: orderFields,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
      orderItem: orderItemFields,
      modifierOptions: modifierOptions.map((option: any) => ({
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
      events: events.map((event: any) => ({
        id: event.id,
        preparationTaskId: event.preparationTaskId,
        type: event.type,
        actorStaffUserId: event.actorStaffUserId,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
    };
  }

  private toOrderContextResponse(order: any) {
    const { company, branch, tableSession, ...orderFields } = order;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      order: orderFields,
      company,
      branch,
      tableSession: tableSessionFields,
      floor,
      table: tableFields,
    };
  }

  private taskInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      order: {
        select: this.orderContextSelect(),
      },
      orderItem: {
        include: {
          modifierOptions: {
            orderBy: [{ createdAt: 'asc' as const }],
          },
        },
      },
      events: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
    } satisfies Prisma.PreparationTaskInclude;
  }

  private orderContextSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableSessionId: true,
      cartId: true,
      orderNumber: true,
      status: true,
      source: true,
      currency: true,
      subtotalMinor: true,
      totalQuantity: true,
      itemCount: true,
      customerNote: true,
      idempotencyKey: true,
      submittedAt: true,
      cashierAcceptedAt: true,
      cashierRejectedAt: true,
      rejectionReason: true,
      preparingAt: true,
      readyAt: true,
      servedAt: true,
      completedAt: true,
      servedByStaffUserId: true,
      completedByStaffUserId: true,
      completionNote: true,
      createdAt: true,
      updatedAt: true,
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: {
        select: this.tableSessionContextSelect(),
      },
    } satisfies Prisma.OrderSelect;
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
