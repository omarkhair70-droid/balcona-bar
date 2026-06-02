import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PreparationStation,
  PreparationTaskEventType,
  PreparationTaskStatus,
  Prisma,
} from '@prisma/client';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BranchPreparationTasksQueryDto } from './dto/branch-preparation-tasks-query.dto';
import { CancelPreparationTaskDto } from './dto/cancel-preparation-task.dto';
import { PreparationTaskActionDto } from './dto/preparation-task-action.dto';

const ACTIONABLE_STATIONS: PreparationStation[] = [
  PreparationStation.barista,
  PreparationStation.kitchen,
  PreparationStation.dessert,
];

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PreparationTasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
  ) {}

  async createTasksForAcceptedOrder(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
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

    for (const item of order.items) {
      if (!ACTIONABLE_STATIONS.includes(item.menuItem.station)) {
        continue;
      }

      const existingTask = await tx.preparationTask.findUnique({
        where: { orderItemId: item.id },
        select: { id: true },
      });

      if (existingTask) {
        continue;
      }

      await tx.preparationTask.create({
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
      });
    }
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

      if (task.status !== PreparationTaskStatus.pending) {
        throw new BadRequestException(
          'Only pending preparation tasks can be started',
        );
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

      return this.getTaskResponse(task.id, tx);
    });
  }

  async markReady(taskId: string, body: PreparationTaskActionDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const task = await this.findTaskStatus(taskId, tx);

      if (
        task.status !== PreparationTaskStatus.pending &&
        task.status !== PreparationTaskStatus.preparing
      ) {
        throw new BadRequestException(
          'Only pending or preparing preparation tasks can be marked ready',
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

      return this.getTaskResponse(task.id, tx);
    });
  }

  async cancel(taskId: string, body: CancelPreparationTaskDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const task = await this.findTaskStatus(taskId, tx);

      if (
        task.status === PreparationTaskStatus.ready ||
        task.status === PreparationTaskStatus.cancelled
      ) {
        throw new BadRequestException(
          'Ready or cancelled preparation tasks cannot be cancelled',
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

      return this.getTaskResponse(task.id, tx);
    });
  }

  private async findTaskStatus(taskId: string, tx: PrismaExecutor) {
    const task = await tx.preparationTask.findUnique({
      where: { id: taskId },
      select: { id: true, status: true },
    });

    if (!task) {
      throw new NotFoundException('Preparation task not found');
    }

    return task;
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
