import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TableSessionStatus,
  WaiterCallActorType,
  WaiterCallEventType,
  WaiterCallStatus,
  WaiterCallType,
} from '@prisma/client';
import { PresenceNotificationsService } from '../presence-notifications/presence-notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CancelWaiterCallDto } from './dto/cancel-waiter-call.dto';
import { CreateWaiterCallDto } from './dto/create-waiter-call.dto';
import { ResolveWaiterCallDto } from './dto/resolve-waiter-call.dto';
import { WaiterCallStaffActionDto } from './dto/waiter-call-staff-action.dto';
import { WaiterCallsQueryDto } from './dto/waiter-calls-query.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class WaiterCallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenceNotificationsService: PresenceNotificationsService,
  ) {}

  async createForTableSession(
    sessionId: string,
    body: CreateWaiterCallDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.findOpenTableSession(sessionId, tx);
      const order = await this.findOwnedOrder(body.orderId, session.id, tx);
      const message = this.normalizeOptionalText(body.message);
      const priority = body.priority ?? 0;

      const waiterCall = await tx.waiterCall.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.id,
          tableId: session.tableId,
          orderId: order?.id,
          type: body.type as WaiterCallType,
          status: WaiterCallStatus.open,
          message,
          priority,
          events: {
            create: {
              type: WaiterCallEventType.created,
              actorType: WaiterCallActorType.customer,
              metadata: {
                ...(order ? { orderId: order.id } : {}),
                ...(message ? { message } : {}),
                priority,
              },
            },
          },
        },
        select: { id: true },
      });

      await this.presenceNotificationsService.createWaiterCallCreatedNotification(
        waiterCall.id,
        tx,
      );

      return this.getWaiterCallResponse(waiterCall.id, tx);
    });
  }

  async findForTableSession(
    sessionId: string,
    query: WaiterCallsQueryDto = {},
  ) {
    const session = await this.prisma.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    const waiterCalls = await this.prisma.waiterCall.findMany({
      where: {
        tableSessionId: sessionId,
        ...this.statusFilter(query.status, [
          WaiterCallStatus.open,
          WaiterCallStatus.acknowledged,
        ]),
        ...this.typeFilter(query.type),
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      include: this.waiterCallInclude(),
    });

    return {
      tableSession: session,
      filters: {
        status: query.status ?? 'active',
        type: query.type ?? 'all',
      },
      waiterCalls: waiterCalls.map((waiterCall) =>
        this.toWaiterCallResponse(waiterCall),
      ),
    };
  }

  async findForBranch(branchId: string, query: WaiterCallsQueryDto = {}) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const waiterCalls = await this.prisma.waiterCall.findMany({
      where: {
        branchId,
        ...this.statusFilter(query.status ?? WaiterCallStatus.open),
        ...this.typeFilter(query.type),
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      include: this.waiterCallInclude(),
    });

    return {
      branch,
      filters: {
        status: query.status ?? WaiterCallStatus.open,
        type: query.type ?? 'all',
      },
      waiterCalls: waiterCalls.map((waiterCall) =>
        this.toWaiterCallResponse(waiterCall),
      ),
    };
  }

  async findOne(waiterCallId: string) {
    return this.getWaiterCallResponse(waiterCallId, this.prisma);
  }

  async acknowledge(
    waiterCallId: string,
    body: WaiterCallStaffActionDto = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const waiterCall = await this.findWaiterCallStatus(waiterCallId, tx);

      if (waiterCall.status !== WaiterCallStatus.open) {
        throw new BadRequestException(
          'Only open waiter calls can be acknowledged',
        );
      }

      const now = new Date();

      await tx.waiterCall.update({
        where: { id: waiterCall.id },
        data: {
          status: WaiterCallStatus.acknowledged,
          acknowledgedAt: now,
        },
      });

      await tx.waiterCallEvent.create({
        data: {
          waiterCallId: waiterCall.id,
          type: WaiterCallEventType.acknowledged,
          actorType: WaiterCallActorType.staff,
          actorStaffUserId: body.staffUserId,
        },
      });

      await this.presenceNotificationsService.createWaiterCallAcknowledgedNotification(
        waiterCall.id,
        tx,
      );

      return this.getWaiterCallResponse(waiterCall.id, tx);
    });
  }

  async resolve(waiterCallId: string, body: ResolveWaiterCallDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertStaffUserExists(body.staffUserId, tx);

      const waiterCall = await this.findWaiterCallStatus(waiterCallId, tx);

      if (
        waiterCall.status === WaiterCallStatus.resolved ||
        waiterCall.status === WaiterCallStatus.cancelled
      ) {
        throw new BadRequestException(
          'Resolved or cancelled waiter calls cannot be resolved',
        );
      }

      const resolutionNote = this.normalizeOptionalText(body.resolutionNote);
      const now = new Date();

      await tx.waiterCall.update({
        where: { id: waiterCall.id },
        data: {
          status: WaiterCallStatus.resolved,
          resolvedAt: now,
        },
      });

      await tx.waiterCallEvent.create({
        data: {
          waiterCallId: waiterCall.id,
          type: WaiterCallEventType.resolved,
          actorType: WaiterCallActorType.staff,
          actorStaffUserId: body.staffUserId,
          metadata: resolutionNote ? { resolutionNote } : undefined,
        },
      });

      await this.presenceNotificationsService.createWaiterCallResolvedNotification(
        waiterCall.id,
        tx,
      );

      return this.getWaiterCallResponse(waiterCall.id, tx);
    });
  }

  async cancel(waiterCallId: string, body: CancelWaiterCallDto = {}) {
    return this.prisma.$transaction(async (tx) => {
      const waiterCall = await this.findWaiterCallStatus(waiterCallId, tx);

      if (
        waiterCall.status === WaiterCallStatus.resolved ||
        waiterCall.status === WaiterCallStatus.cancelled
      ) {
        throw new BadRequestException(
          'Resolved or cancelled waiter calls cannot be cancelled',
        );
      }

      const reason = this.normalizeOptionalText(body.reason);
      const now = new Date();

      await tx.waiterCall.update({
        where: { id: waiterCall.id },
        data: {
          status: WaiterCallStatus.cancelled,
          cancelledAt: now,
        },
      });

      await tx.waiterCallEvent.create({
        data: {
          waiterCallId: waiterCall.id,
          type: WaiterCallEventType.cancelled,
          actorType: WaiterCallActorType.customer,
          metadata: reason ? { reason } : undefined,
        },
      });

      return this.getWaiterCallResponse(waiterCall.id, tx);
    });
  }

  private async findOpenTableSession(sessionId: string, tx: PrismaExecutor) {
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
      select: this.tableSessionSelect(),
    });

    if (!session) {
      throw new NotFoundException('Table session not found');
    }

    if (
      session.status === TableSessionStatus.closed ||
      session.status === TableSessionStatus.expired ||
      (session.expiresAt && session.expiresAt <= new Date())
    ) {
      throw new BadRequestException(
        'Waiter calls cannot be created for closed or expired sessions',
      );
    }

    return session;
  }

  private async findOwnedOrder(
    orderId: string | undefined,
    sessionId: string,
    tx: PrismaExecutor,
  ) {
    if (!orderId) {
      return null;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        tableSessionId: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.tableSessionId !== sessionId) {
      throw new BadRequestException(
        'Order does not belong to this table session',
      );
    }

    return order;
  }

  private async findWaiterCallStatus(
    waiterCallId: string,
    tx: PrismaExecutor,
  ) {
    const waiterCall = await tx.waiterCall.findUnique({
      where: { id: waiterCallId },
      select: { id: true, status: true },
    });

    if (!waiterCall) {
      throw new NotFoundException('Waiter call not found');
    }

    return waiterCall;
  }

  private async getWaiterCallResponse(
    waiterCallId: string,
    tx: PrismaExecutor,
  ) {
    const waiterCall = await tx.waiterCall.findUnique({
      where: { id: waiterCallId },
      include: this.waiterCallInclude(),
    });

    if (!waiterCall) {
      throw new NotFoundException('Waiter call not found');
    }

    return this.toWaiterCallResponse(waiterCall);
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

  private statusFilter(
    status: WaiterCallsQueryDto['status'] | WaiterCallStatus | undefined,
    defaultStatuses?: WaiterCallStatus[],
  ) {
    if (!status && defaultStatuses) {
      return { status: { in: defaultStatuses } };
    }

    if (!status || status === 'all') {
      return {};
    }

    return { status: status as WaiterCallStatus };
  }

  private typeFilter(type: WaiterCallsQueryDto['type'] | undefined) {
    if (!type || type === 'all') {
      return {};
    }

    return { type: type as WaiterCallType };
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toWaiterCallResponse(waiterCall: any) {
    const { company, branch, tableSession, table, order, events, ...call } =
      waiterCall;
    const { floor, ...tableFields } = table;

    return {
      waiterCall: call,
      company,
      branch,
      tableSession,
      floor,
      table: tableFields,
      order,
      events: events.map((event: any) => ({
        id: event.id,
        waiterCallId: event.waiterCallId,
        type: event.type,
        actorType: event.actorType,
        actorStaffUserId: event.actorStaffUserId,
        actorStaffUser: event.actorStaffUser,
        metadata: event.metadata,
        createdAt: event.createdAt,
      })),
    };
  }

  private waiterCallInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      tableSession: { select: this.tableSessionSelect() },
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
      events: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        include: {
          actorStaffUser: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    } satisfies Prisma.WaiterCallInclude;
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

  private tableSessionSelect() {
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
    };
  }
}
