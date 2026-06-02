import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  BillRequestStatus,
  OrderStatus,
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
  TableAttentionStatus,
  WaiterCallStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

const DEFAULT_RANGE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async getBranchOverview(branchId: string, query: AnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const orderWhere = {
      branchId,
      submittedAt: {
        gte: range.from,
        lte: range.to,
      },
    };
    const [
      orderStats,
      ordersForAverages,
      waiterCallsCount,
      openWaiterCallsCount,
      billRequestsCount,
      openBillRequestsCount,
      aiWaiterSessionsCount,
      aiWaiterEscalationsCount,
      cartProposalsCreated,
      cartProposalsApplied,
      attentionOpenCount,
      attentionUrgentCount,
    ] = await Promise.all([
      this.prisma.order.aggregate({
        where: orderWhere,
        _count: { _all: true },
        _sum: {
          subtotalMinor: true,
          totalQuantity: true,
          itemCount: true,
        },
      }),
      this.prisma.order.findMany({
        where: orderWhere,
        select: {
          submittedAt: true,
          cashierAcceptedAt: true,
          cashierRejectedAt: true,
          preparingAt: true,
          readyAt: true,
          servedAt: true,
          completedAt: true,
        },
      }),
      this.prisma.waiterCall.count({
        where: { branchId, createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.waiterCall.count({
        where: {
          branchId,
          status: {
            in: [WaiterCallStatus.open, WaiterCallStatus.acknowledged],
          },
        },
      }),
      this.prisma.billRequest.count({
        where: { branchId, requestedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.billRequest.count({
        where: {
          branchId,
          status: {
            in: [
              BillRequestStatus.open,
              BillRequestStatus.acknowledged,
              BillRequestStatus.presented,
            ],
          },
        },
      }),
      this.prisma.aiWaiterSession.count({
        where: { branchId, createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.aiWaiterSession.count({
        where: {
          branchId,
          escalatedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.aiWaiterCartProposal.count({
        where: { branchId, createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.aiWaiterCartProposal.count({
        where: { branchId, appliedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.tableAttentionSnapshot.count({
        where: {
          branchId,
          status: {
            in: [
              TableAttentionStatus.needs_attention,
              TableAttentionStatus.urgent,
              TableAttentionStatus.muted,
            ],
          },
        },
      }),
      this.prisma.tableAttentionSnapshot.count({
        where: { branchId, status: TableAttentionStatus.urgent },
      }),
    ]);
    const overview = {
      ordersCount: orderStats._count._all,
      grossSubtotalMinor: orderStats._sum.subtotalMinor ?? 0,
      totalQuantity: orderStats._sum.totalQuantity ?? 0,
      itemCount: orderStats._sum.itemCount ?? 0,
      avgCashierReviewSeconds: this.avgSeconds(
        ordersForAverages
          .map((order) =>
            this.firstDate(order.cashierAcceptedAt, order.cashierRejectedAt)
              ? {
                  start: order.submittedAt,
                  end: this.firstDate(
                    order.cashierAcceptedAt,
                    order.cashierRejectedAt,
                  ),
                }
              : null,
          )
          .filter(this.notNull),
      ),
      avgPreparationSeconds: this.avgSeconds(
        ordersForAverages
          .map((order) =>
            order.preparingAt && order.readyAt
              ? { start: order.preparingAt, end: order.readyAt }
              : null,
          )
          .filter(this.notNull),
      ),
      avgReadyToServedSeconds: this.avgSeconds(
        ordersForAverages
          .map((order) =>
            order.readyAt && order.servedAt
              ? { start: order.readyAt, end: order.servedAt }
              : null,
          )
          .filter(this.notNull),
      ),
      waiterCallsCount,
      openWaiterCallsCount,
      billRequestsCount,
      openBillRequestsCount,
      aiWaiterSessionsCount,
      aiWaiterEscalationsCount,
      cartProposalsCreated,
      cartProposalsApplied,
      attentionOpenCount,
      attentionUrgentCount,
    };

    await this.recordAnalyticsSnapshot(branch, {
      scope: 'branch',
      report: 'overview',
      range,
      overview,
    });

    return {
      branch,
      range,
      overview,
    };
  }

  async getBranchMenuAnalytics(
    branchId: string,
    query: AnalyticsQueryDto = {},
  ) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [orderItems, branchOverrides] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: {
          order: {
            branchId,
            submittedAt: { gte: range.from, lte: range.to },
            status: {
              notIn: [OrderStatus.cashier_rejected, OrderStatus.cancelled],
            },
          },
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              submittedAt: true,
              status: true,
            },
          },
          modifierOptions: true,
        },
      }),
      this.prisma.branchMenuItemOverride.findMany({
        where: {
          branchId,
          OR: [{ isAvailable: false }, { isVisible: false }],
        },
      }),
    ]);
    const itemMap = new Map<
      string,
      {
        menuItemId: string;
        name: string;
        slug: string;
        quantity: number;
        lineTotalMinor: number;
        orderCount: number;
      }
    >();
    const modifierMap = new Map<
      string,
      {
        modifierOptionId: string;
        modifierGroupId: string;
        groupName: string;
        optionName: string;
        quantity: number;
        priceDeltaMinor: number;
      }
    >();

    for (const item of orderItems) {
      const existing = itemMap.get(item.menuItemId) ?? {
        menuItemId: item.menuItemId,
        name: item.itemNameSnapshot,
        slug: item.itemSlugSnapshot,
        quantity: 0,
        lineTotalMinor: 0,
        orderCount: 0,
      };

      existing.quantity += item.quantity;
      existing.lineTotalMinor += item.lineTotalMinorSnapshot;
      existing.orderCount += 1;
      itemMap.set(item.menuItemId, existing);

      for (const modifier of item.modifierOptions) {
        const existingModifier = modifierMap.get(modifier.modifierOptionId) ?? {
          modifierOptionId: modifier.modifierOptionId,
          modifierGroupId: modifier.modifierGroupId,
          groupName: modifier.modifierGroupNameSnapshot,
          optionName: modifier.modifierOptionNameSnapshot,
          quantity: 0,
          priceDeltaMinor: 0,
        };

        existingModifier.quantity += item.quantity;
        existingModifier.priceDeltaMinor +=
          modifier.priceDeltaMinorSnapshot * item.quantity;
        modifierMap.set(modifier.modifierOptionId, existingModifier);
      }
    }

    return {
      branch,
      range,
      summary: {
        orderedItemCount: orderItems.length,
        unavailableOverrideCount: branchOverrides.filter(
          (override) => !override.isAvailable,
        ).length,
        hiddenOverrideCount: branchOverrides.filter(
          (override) => !override.isVisible,
        ).length,
      },
      popularItems: Array.from(itemMap.values()).sort(
        (left, right) =>
          right.quantity - left.quantity ||
          right.lineTotalMinor - left.lineTotalMinor,
      ),
      topModifiers: Array.from(modifierMap.values()).sort(
        (left, right) =>
          right.quantity - left.quantity ||
          right.priceDeltaMinor - left.priceDeltaMinor,
      ),
    };
  }

  async getBranchStaffActions(
    branchId: string,
    query: AnalyticsQueryDto = {},
  ) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const where = {
      branchId,
      createdAt: { gte: range.from, lte: range.to },
    };
    const [actionCounts, actorCounts, recentAuditLogs] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { _all: true },
      }),
      this.prisma.auditLog.groupBy({
        by: ['actorType'],
        where,
        _count: { _all: true },
      }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 25,
        include: {
          actorStaffUser: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
            },
          },
        },
      }),
    ]);

    return {
      branch,
      range,
      actionCounts: actionCounts.map((record) => ({
        action: record.action,
        count: record._count._all,
      })),
      actorCounts: actorCounts.map((record) => ({
        actorType: record.actorType,
        count: record._count._all,
      })),
      recentAuditLogs,
    };
  }

  async getCompanyOverview(companyId: string, query: AnalyticsQueryDto = {}) {
    const company = await this.findCompanyOrThrow(companyId);
    const range = this.resolveRange(query);
    const [branches, orderStats, branchOrderStats, urgentAttentionCount] =
      await Promise.all([
        this.prisma.branch.findMany({
          where: { companyId },
          select: this.branchSelect(),
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        this.prisma.order.aggregate({
          where: {
            companyId,
            submittedAt: { gte: range.from, lte: range.to },
          },
          _count: { _all: true },
          _sum: {
            subtotalMinor: true,
            totalQuantity: true,
            itemCount: true,
          },
        }),
        this.prisma.order.groupBy({
          by: ['branchId'],
          where: {
            companyId,
            submittedAt: { gte: range.from, lte: range.to },
          },
          _count: { _all: true },
          _sum: { subtotalMinor: true },
        }),
        this.prisma.tableAttentionSnapshot.count({
          where: {
            companyId,
            status: TableAttentionStatus.urgent,
          },
        }),
      ]);
    const branchById = new Map(branches.map((branch) => [branch.id, branch]));
    const overview = {
      branchesCount: branches.length,
      ordersCount: orderStats._count._all,
      grossSubtotalMinor: orderStats._sum.subtotalMinor ?? 0,
      totalQuantity: orderStats._sum.totalQuantity ?? 0,
      itemCount: orderStats._sum.itemCount ?? 0,
      urgentAttentionCount,
      branchRollups: branchOrderStats.map((record) => ({
        branch: branchById.get(record.branchId) ?? null,
        ordersCount: record._count._all,
        grossSubtotalMinor: record._sum.subtotalMinor ?? 0,
      })),
    };

    await this.recordAnalyticsSnapshot(
      { companyId: company.id, id: undefined },
      {
        scope: 'company',
        report: 'overview',
        range,
        overview,
      },
    );

    return {
      company,
      range,
      overview,
    };
  }

  private async recordAnalyticsSnapshot(
    scope: { companyId: string; id?: string },
    payload: Record<string, unknown>,
  ) {
    try {
      await this.realtimeEventsService.createRealtimeEvent({
        companyId: scope.companyId,
        branchId: scope.id,
        type: RealtimeEventType.analytics_snapshot_generated,
        channel: RealtimeEventChannel.system,
        payload,
      });
    } catch {
      return undefined;
    }
  }

  private resolveRange(query: AnalyticsQueryDto) {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from
      ? new Date(query.from)
      : new Date(to.getTime() - DEFAULT_RANGE_MS);

    return { from, to };
  }

  private avgSeconds(pairs: { start: Date; end: Date | null }[]) {
    const durations = pairs
      .filter((pair): pair is { start: Date; end: Date } => !!pair.end)
      .map((pair) =>
        Math.max(0, Math.round((pair.end.getTime() - pair.start.getTime()) / 1000)),
      );

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce((sum, duration) => sum + duration, 0) /
        durations.length,
    );
  }

  private firstDate(...values: (Date | null)[]) {
    return values.find((value) => value !== null) ?? null;
  }

  private notNull<T>(value: T | null): value is T {
    return value !== null;
  }

  private async findBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findCompanyOrThrow(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: this.companySelect(),
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
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
    } satisfies Prisma.BranchSelect;
  }
}

