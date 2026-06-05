import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiWaiterCartProposalStatus,
  BillPaymentMethod,
  CashDrawerTransactionType,
  CashierShiftReportType,
  CashierShiftStatus,
  ManualPaymentStatus,
  OrderStatus,
  Prisma,
  TableAttentionStatus,
  WaiterCallStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  OwnerAnalyticsPreset,
  OwnerAnalyticsQueryDto,
} from './dto/owner-analytics-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOP_RECORD_LIMIT = 10;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  address: true,
  status: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
    },
  },
} satisfies Prisma.BranchSelect;

const cashierShiftSelect = {
  id: true,
  companyId: true,
  branchId: true,
  openedByStaffUserId: true,
  closedByStaffUserId: true,
  status: true,
  currency: true,
  openingFloatMinor: true,
  expectedCashMinor: true,
  countedCashMinor: true,
  cashOverShortMinor: true,
  cashSalesMinor: true,
  cardSalesMinor: true,
  walletSalesMinor: true,
  otherSalesMinor: true,
  paymentCount: true,
  billCount: true,
  openedAt: true,
  closedAt: true,
  openingNote: true,
  closingNote: true,
  zReportNumber: true,
  zReportSnapshot: true,
} satisfies Prisma.CashierShiftSelect;

const cashierShiftReportSelect = {
  id: true,
  cashierShiftId: true,
  type: true,
  reportNumber: true,
  snapshot: true,
  generatedAt: true,
} satisfies Prisma.CashierShiftReportSelect;

const manualPaymentSelect = {
  id: true,
  billId: true,
  cashierShiftId: true,
  method: true,
  status: true,
  amountMinor: true,
  currency: true,
  reference: true,
  note: true,
  recordedAt: true,
  bill: {
    select: {
      id: true,
      billNumber: true,
      status: true,
      currency: true,
      totalMinor: true,
      paidMinor: true,
      balanceDueMinor: true,
      orderCount: true,
      lineCount: true,
      requestedAt: true,
      presentedAt: true,
      paidAt: true,
      closedAt: true,
    },
  },
} satisfies Prisma.ManualPaymentSelect;

const billLineSelect = {
  id: true,
  billId: true,
  orderId: true,
  orderItemId: true,
  menuItemId: true,
  itemNameSnapshot: true,
  quantity: true,
  unitPriceMinor: true,
  modifiersTotalMinor: true,
  lineTotalMinor: true,
  currency: true,
  modifiersSnapshot: true,
  orderItem: {
    select: {
      itemSlugSnapshot: true,
      modifierOptions: {
        select: {
          modifierGroupId: true,
          modifierOptionId: true,
          modifierGroupNameSnapshot: true,
          modifierOptionNameSnapshot: true,
          priceDeltaMinorSnapshot: true,
        },
      },
    },
  },
  menuItem: {
    select: {
      id: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.BillLineSelect;

type AnalyticsRange = {
  from: Date;
  to: Date;
  preset: OwnerAnalyticsPreset | 'custom';
};
type BranchRecord = Prisma.BranchGetPayload<{ select: typeof branchSelect }>;
type CashierShiftRecord = Prisma.CashierShiftGetPayload<{
  select: typeof cashierShiftSelect;
}>;
type CashierShiftReportRecord = Prisma.CashierShiftReportGetPayload<{
  select: typeof cashierShiftReportSelect;
}>;
type ManualPaymentRecord = Prisma.ManualPaymentGetPayload<{
  select: typeof manualPaymentSelect;
}>;
type CountRow = { key: string; count: number };
type MoneyCountRow = CountRow & { amountMinor: number };

@Injectable()
export class OwnerAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [
      payments,
      orderStatusCounts,
      activeBillRequestCount,
      openWaiterCallCount,
      activeCashierShift,
      latestClosedShift,
      latestZReport,
    ] = await Promise.all([
      this.getRecordedPayments(branchId, range),
      this.prisma.order.groupBy({
        by: ['status'],
        where: this.orderRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.billRequest.count({
        where: {
          branchId,
          status: { in: ['open', 'acknowledged', 'presented'] },
        },
      }),
      this.prisma.waiterCall.count({
        where: {
          branchId,
          status: {
            in: [WaiterCallStatus.open, WaiterCallStatus.acknowledged],
          },
        },
      }),
      this.prisma.cashierShift.findFirst({
        where: { branchId, status: CashierShiftStatus.open },
        select: cashierShiftSelect,
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.cashierShift.findFirst({
        where: {
          branchId,
          status: CashierShiftStatus.closed,
          closedAt: { gte: range.from, lte: range.to },
        },
        select: cashierShiftSelect,
        orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.cashierShiftReport.findFirst({
        where: {
          branchId,
          type: CashierShiftReportType.z_report,
          generatedAt: { gte: range.from, lte: range.to },
        },
        select: cashierShiftReportSelect,
        orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);
    const paymentStats = this.summarizePayments(payments);
    const orderCounts = this.orderCountsFromGroupBy(orderStatusCounts);

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      paidRevenueMinor: paymentStats.collectedMinor,
      collectedMinor: paymentStats.collectedMinor,
      cashCollectedMinor: paymentStats.byMethod.cash.amountMinor,
      cardCollectedMinor: paymentStats.byMethod.card_pos.amountMinor,
      walletCollectedMinor: paymentStats.byMethod.wallet_manual.amountMinor,
      otherCollectedMinor: paymentStats.byMethod.other.amountMinor,
      paidBillCount: paymentStats.paidBillCount,
      averageTicketMinor: paymentStats.averageTicketMinor,
      submittedOrderCount: orderCounts.get(OrderStatus.submitted) ?? 0,
      acceptedOrderCount: orderCounts.get(OrderStatus.cashier_accepted) ?? 0,
      servedOrderCount: orderCounts.get(OrderStatus.served) ?? 0,
      completedOrderCount: orderCounts.get(OrderStatus.completed) ?? 0,
      cancelledOrderCount: orderCounts.get(OrderStatus.cancelled) ?? 0,
      rejectedOrderCount: orderCounts.get(OrderStatus.cashier_rejected) ?? 0,
      activeBillRequestCount,
      openWaiterCallCount,
      activeCashierShift: this.summarizeShift(activeCashierShift),
      latestClosedShift: this.summarizeShift(latestClosedShift),
      latestZReport: this.summarizeReport(latestZReport),
      revenueSource: 'recorded_manual_payments',
    };
  }

  async getSales(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [payments, billStatusCounts, shifts] = await Promise.all([
      this.getRecordedPayments(branchId, range),
      this.prisma.bill.groupBy({
        by: ['status'],
        where: {
          branchId,
          createdAt: { gte: range.from, lte: range.to },
        },
        _count: { _all: true },
      }),
      this.prisma.cashierShift.findMany({
        where: {
          branchId,
          OR: [
            { openedAt: { gte: range.from, lte: range.to } },
            { closedAt: { gte: range.from, lte: range.to } },
          ],
        },
        select: cashierShiftSelect,
        orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        take: 25,
      }),
    ]);
    const paymentStats = this.summarizePayments(payments);

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      tenderBreakdown: Object.values(paymentStats.byMethod),
      revenueByDay: this.moneyRowsByBucket(payments, 'day'),
      revenueByHour: this.moneyRowsByBucket(payments, 'hour'),
      billCountByStatus: billStatusCounts.map((record) => ({
        key: record.status,
        count: record._count._all,
      })),
      paymentCountByMethod: Object.values(paymentStats.byMethod).map(
        (record) => ({
          key: record.method,
          count: record.count,
          amountMinor: record.amountMinor,
        }),
      ),
      topPaidBills: this.topPaidBills(payments),
      recentPayments: payments.slice(0, TOP_RECORD_LIMIT).map((payment) => ({
        id: payment.id,
        billId: payment.billId,
        billNumber: payment.bill.billNumber,
        method: payment.method,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        recordedAt: payment.recordedAt,
      })),
      cashDrawerOverview: shifts.map((shift) => this.summarizeShift(shift)),
      revenueSource: 'recorded_manual_payments',
    };
  }

  async getOrders(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [orders, payments] = await Promise.all([
      this.prisma.order.findMany({
        where: this.orderRangeWhere(branchId, range),
        select: {
          id: true,
          status: true,
          currency: true,
          subtotalMinor: true,
          totalQuantity: true,
          itemCount: true,
          submittedAt: true,
          cashierAcceptedAt: true,
          preparingAt: true,
          readyAt: true,
          servedAt: true,
          completedAt: true,
        },
      }),
      this.getRecordedPayments(branchId, range),
    ]);
    const statusCounts = new Map<string, number>();
    const quantity = orders.reduce((sum, order) => sum + order.totalQuantity, 0);
    const itemCount = orders.reduce((sum, order) => sum + order.itemCount, 0);
    const orderValueMinor = orders.reduce(
      (sum, order) => sum + order.subtotalMinor,
      0,
    );

    for (const order of orders) {
      this.increment(statusCounts, order.status);
    }

    const paymentStats = this.summarizePayments(payments);

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      orderCountByStatus: this.mapToCountRows(statusCounts),
      orderCountByHour: this.countRowsByDate(
        orders.map((order) => order.submittedAt),
        'hour',
      ),
      totalQuantity: quantity,
      itemCount,
      submittedOrderCount: orders.length,
      grossSubmittedOrderValueMinor: orderValueMinor,
      averageSubmittedOrderValueMinor: this.safeAverageMinor(
        orderValueMinor,
        orders.length,
      ),
      averageOrderValueMinor: paymentStats.averageTicketMinor,
      lifecycleAverages: {
        submittedToAcceptedSeconds: this.avgSeconds(
          orders.map((order) => ({
            start: order.submittedAt,
            end: order.cashierAcceptedAt,
          })),
        ),
        acceptedToPreparingSeconds: this.avgSeconds(
          orders.map((order) => ({
            start: order.cashierAcceptedAt,
            end: order.preparingAt,
          })),
        ),
        preparingToReadySeconds: this.avgSeconds(
          orders.map((order) => ({
            start: order.preparingAt,
            end: order.readyAt,
          })),
        ),
        readyToServedSeconds: this.avgSeconds(
          orders.map((order) => ({
            start: order.readyAt,
            end: order.servedAt,
          })),
        ),
        submittedToServedSeconds: this.avgSeconds(
          orders.map((order) => ({
            start: order.submittedAt,
            end: order.servedAt,
          })),
        ),
      },
    };
  }

  async getItems(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const lines = await this.prisma.billLine.findMany({
      where: {
        bill: {
          branchId,
          manualPayments: {
            some: this.manualPaymentRangeWhere(branchId, range),
          },
        },
      },
      select: billLineSelect,
    });
    const itemMap = new Map<
      string,
      {
        menuItemId: string | null;
        name: string;
        slug: string | null;
        quantity: number;
        revenueMinor: number;
        lineCount: number;
        currency: string;
      }
    >();
    const modifierMap = new Map<
      string,
      {
        modifierGroupId: string;
        modifierOptionId: string;
        groupName: string;
        optionName: string;
        quantity: number;
        revenueMinor: number;
      }
    >();
    const categoryMap = new Map<
      string,
      {
        categoryId: string | null;
        name: string;
        quantity: number;
        revenueMinor: number;
      }
    >();

    for (const line of lines) {
      const itemKey = line.menuItemId ?? line.itemNameSnapshot;
      const item = itemMap.get(itemKey) ?? {
        menuItemId: line.menuItemId,
        name: line.itemNameSnapshot,
        slug: line.orderItem?.itemSlugSnapshot ?? null,
        quantity: 0,
        revenueMinor: 0,
        lineCount: 0,
        currency: line.currency,
      };

      item.quantity += line.quantity;
      item.revenueMinor += line.lineTotalMinor;
      item.lineCount += 1;
      itemMap.set(itemKey, item);

      const category = line.menuItem?.category;
      const categoryKey = category?.id ?? 'uncategorized';
      const categoryRow = categoryMap.get(categoryKey) ?? {
        categoryId: category?.id ?? null,
        name: category?.name ?? 'Uncategorized',
        quantity: 0,
        revenueMinor: 0,
      };
      categoryRow.quantity += line.quantity;
      categoryRow.revenueMinor += line.lineTotalMinor;
      categoryMap.set(categoryKey, categoryRow);

      for (const modifier of line.orderItem?.modifierOptions ?? []) {
        const modifierKey = `${modifier.modifierGroupId}:${modifier.modifierOptionId}`;
        const row = modifierMap.get(modifierKey) ?? {
          modifierGroupId: modifier.modifierGroupId,
          modifierOptionId: modifier.modifierOptionId,
          groupName: modifier.modifierGroupNameSnapshot,
          optionName: modifier.modifierOptionNameSnapshot,
          quantity: 0,
          revenueMinor: 0,
        };

        row.quantity += line.quantity;
        row.revenueMinor += modifier.priceDeltaMinorSnapshot * line.quantity;
        modifierMap.set(modifierKey, row);
      }
    }

    const byQuantity = Array.from(itemMap.values()).sort(
      (left, right) =>
        right.quantity - left.quantity || right.revenueMinor - left.revenueMinor,
    );
    const byRevenue = Array.from(itemMap.values()).sort(
      (left, right) =>
        right.revenueMinor - left.revenueMinor || right.quantity - left.quantity,
    );

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      itemCount: itemMap.size,
      quantity: lines.reduce((sum, line) => sum + line.quantity, 0),
      revenueMinor: lines.reduce((sum, line) => sum + line.lineTotalMinor, 0),
      modifierRevenueMinor: lines.reduce(
        (sum, line) => sum + line.modifiersTotalMinor * line.quantity,
        0,
      ),
      topItemsByQuantity: byQuantity.slice(0, TOP_RECORD_LIMIT),
      topItemsByRevenue: byRevenue.slice(0, TOP_RECORD_LIMIT),
      topModifiers: Array.from(modifierMap.values())
        .sort(
          (left, right) =>
            right.revenueMinor - left.revenueMinor ||
            right.quantity - left.quantity,
        )
        .slice(0, TOP_RECORD_LIMIT),
      categoryBreakdown: Array.from(categoryMap.values()).sort(
        (left, right) =>
          right.revenueMinor - left.revenueMinor ||
          right.quantity - left.quantity,
      ),
      revenueSource: 'paid_bill_line_snapshots',
    };
  }

  async getOperations(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [
      prepStatusCounts,
      prepStationCounts,
      ticketStatusCounts,
      ticketStationCounts,
      printStatusCounts,
      printKindCounts,
      failedPrintJobCount,
      waiterStatusCounts,
      waiterTypeCounts,
      waiterCallsForResolution,
      activeAttentionCount,
      urgentAttentionCount,
    ] = await Promise.all([
      this.prisma.preparationTask.groupBy({
        by: ['status'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.preparationTask.groupBy({
        by: ['station'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.kitchenTicket.groupBy({
        by: ['status'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.kitchenTicket.groupBy({
        by: ['station'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.printJob.groupBy({
        by: ['status'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.printJob.groupBy({
        by: ['kind'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.printJob.count({
        where: {
          ...this.createdAtRangeWhere(branchId, range),
          status: 'failed',
        },
      }),
      this.prisma.waiterCall.groupBy({
        by: ['status'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.waiterCall.groupBy({
        by: ['type'],
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
      }),
      this.prisma.waiterCall.findMany({
        where: {
          branchId,
          createdAt: { gte: range.from, lte: range.to },
          resolvedAt: { not: null },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
        },
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
        where: {
          branchId,
          status: TableAttentionStatus.urgent,
        },
      }),
    ]);

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      preparationTaskCountsByStatus: prepStatusCounts.map((record) => ({
        key: record.status,
        count: record._count._all,
      })),
      preparationTaskCountsByStation: prepStationCounts.map((record) => ({
        key: record.station,
        count: record._count._all,
      })),
      kitchenTicketCountsByStatus: ticketStatusCounts.map((record) => ({
        key: record.status,
        count: record._count._all,
      })),
      kitchenTicketCountsByStation: ticketStationCounts.map((record) => ({
        key: record.station,
        count: record._count._all,
      })),
      printJobCountsByStatus: printStatusCounts.map((record) => ({
        key: record.status,
        count: record._count._all,
      })),
      printJobCountsByKind: printKindCounts.map((record) => ({
        key: record.kind,
        count: record._count._all,
      })),
      failedPrintJobCount,
      waiterCallCountsByStatus: waiterStatusCounts.map((record) => ({
        key: record.status,
        count: record._count._all,
      })),
      waiterCallCountsByType: waiterTypeCounts.map((record) => ({
        key: record.type,
        count: record._count._all,
      })),
      averageWaiterCallResolutionSeconds: this.avgSeconds(
        waiterCallsForResolution.map((call) => ({
          start: call.createdAt,
          end: call.resolvedAt,
        })),
      ),
      activeAttentionCount,
      urgentAttentionCount,
    };
  }

  async getCashierShifts(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [currentOpenShift, recentClosedShifts, zReports, drawerTransactions] =
      await Promise.all([
        this.prisma.cashierShift.findFirst({
          where: { branchId, status: CashierShiftStatus.open },
          select: cashierShiftSelect,
          orderBy: [{ openedAt: 'desc' }, { id: 'desc' }],
        }),
        this.prisma.cashierShift.findMany({
          where: {
            branchId,
            status: CashierShiftStatus.closed,
            closedAt: { gte: range.from, lte: range.to },
          },
          select: cashierShiftSelect,
          orderBy: [{ closedAt: 'desc' }, { id: 'desc' }],
          take: 20,
        }),
        this.prisma.cashierShiftReport.findMany({
          where: {
            branchId,
            type: CashierShiftReportType.z_report,
            generatedAt: { gte: range.from, lte: range.to },
          },
          select: cashierShiftReportSelect,
          orderBy: [{ generatedAt: 'desc' }, { id: 'desc' }],
          take: 20,
        }),
        this.prisma.cashDrawerTransaction.findMany({
          where: this.createdAtRangeWhere(branchId, range),
          select: {
            type: true,
            signedAmountMinor: true,
            currency: true,
            createdAt: true,
          },
        }),
      ]);
    const transactionTotals = this.cashDrawerTransactionTotals(
      drawerTransactions,
    );

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      currentOpenShift: this.summarizeShift(currentOpenShift),
      recentClosedShifts: recentClosedShifts.map((shift) =>
        this.summarizeShift(shift),
      ),
      totalOverShortMinor: recentClosedShifts.reduce(
        (sum, shift) => sum + (shift.cashOverShortMinor ?? 0),
        0,
      ),
      shiftCount: recentClosedShifts.length,
      zReports: zReports.map((report) => this.summarizeReport(report)),
      cashDrawerTransactions: {
        cashInMinor:
          transactionTotals.get(CashDrawerTransactionType.cash_in) ?? 0,
        cashOutMinor:
          transactionTotals.get(CashDrawerTransactionType.cash_out) ?? 0,
        correctionMinor:
          transactionTotals.get(CashDrawerTransactionType.correction) ?? 0,
        openingFloatMinor:
          transactionTotals.get(CashDrawerTransactionType.opening_float) ?? 0,
        cashPaymentMinor:
          transactionTotals.get(CashDrawerTransactionType.cash_payment) ?? 0,
      },
      latestZReport: this.summarizeReport(zReports[0] ?? null),
    };
  }

  async getAiWaiter(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const branch = await this.findBranchOrThrow(branchId);
    const range = this.resolveRange(query);
    const [
      sessionStats,
      messageCount,
      proposalCount,
      appliedProposalCount,
      usageStats,
      escalations,
    ] = await Promise.all([
      this.prisma.aiWaiterSession.aggregate({
        where: this.createdAtRangeWhere(branchId, range),
        _count: { _all: true },
        _sum: {
          totalInputTokens: true,
          totalOutputTokens: true,
          estimatedCostMicros: true,
          messageCount: true,
        },
      }),
      this.prisma.aiWaiterMessage.count({
        where: this.createdAtRangeWhere(branchId, range),
      }),
      this.prisma.aiWaiterCartProposal.count({
        where: this.createdAtRangeWhere(branchId, range),
      }),
      this.prisma.aiWaiterCartProposal.count({
        where: {
          branchId,
          status: AiWaiterCartProposalStatus.applied,
          appliedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.aiWaiterUsageEvent.aggregate({
        where: this.createdAtRangeWhere(branchId, range),
        _sum: {
          inputTokens: true,
          outputTokens: true,
          estimatedCostMicros: true,
        },
      }),
      this.prisma.aiWaiterSession.findMany({
        where: {
          branchId,
          escalatedAt: { gte: range.from, lte: range.to },
          escalationReason: { not: null },
        },
        select: { escalationReason: true },
      }),
    ]);
    const usageInputTokens = usageStats._sum.inputTokens ?? 0;
    const usageOutputTokens = usageStats._sum.outputTokens ?? 0;
    const usageCostMicros = usageStats._sum.estimatedCostMicros ?? 0;
    const sessionInputTokens = sessionStats._sum.totalInputTokens ?? 0;
    const sessionOutputTokens = sessionStats._sum.totalOutputTokens ?? 0;
    const sessionCostMicros = sessionStats._sum.estimatedCostMicros ?? 0;
    const topEscalationReasons = new Map<string, number>();

    for (const escalation of escalations) {
      if (escalation.escalationReason) {
        this.increment(topEscalationReasons, escalation.escalationReason);
      }
    }

    return {
      range: this.serializeRange(range),
      branch: this.toBranchSummary(branch),
      company: branch.company,
      aiSessionCount: sessionStats._count._all,
      aiMessageCount: messageCount || sessionStats._sum.messageCount || 0,
      escalatedCount: escalations.length,
      proposalCount,
      appliedProposalCount,
      estimatedCostMicros:
        usageCostMicros > 0 ? usageCostMicros : sessionCostMicros,
      inputTokens: usageInputTokens > 0 ? usageInputTokens : sessionInputTokens,
      outputTokens:
        usageOutputTokens > 0 ? usageOutputTokens : sessionOutputTokens,
      topEscalationReasons: this.mapToCountRows(topEscalationReasons),
    };
  }

  async getDashboard(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const [
      summary,
      sales,
      orders,
      items,
      operations,
      cashierShifts,
      aiWaiter,
    ] = await Promise.all([
      this.getSummary(branchId, query),
      this.getSales(branchId, query),
      this.getOrders(branchId, query),
      this.getItems(branchId, query),
      this.getOperations(branchId, query),
      this.getCashierShifts(branchId, query),
      this.getAiWaiter(branchId, query),
    ]);

    return {
      range: summary.range,
      branch: summary.branch,
      company: summary.company,
      summary,
      sales,
      orders,
      items,
      operations,
      cashierShifts,
      aiWaiter,
      generatedAt: new Date(),
    };
  }

  async getDailyReport(branchId: string, query: OwnerAnalyticsQueryDto = {}) {
    const dashboard = await this.getDashboard(branchId, query);

    return {
      reportType: 'owner_daily_report',
      range: dashboard.range,
      branch: dashboard.branch,
      company: dashboard.company,
      summary: dashboard.summary,
      sales: dashboard.sales,
      orders: dashboard.orders,
      items: dashboard.items,
      operations: dashboard.operations,
      cashierShifts: dashboard.cashierShifts,
      aiWaiter: dashboard.aiWaiter,
      generatedAt: new Date(),
    };
  }

  private async findBranchOrThrow(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async getRecordedPayments(
    branchId: string,
    range: AnalyticsRange,
  ) {
    return this.prisma.manualPayment.findMany({
      where: this.manualPaymentRangeWhere(branchId, range),
      select: manualPaymentSelect,
      orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
    });
  }

  private resolveRange(query: OwnerAnalyticsQueryDto = {}): AnalyticsRange {
    if (query.from || query.to) {
      if (!query.from || !query.to) {
        throw new BadRequestException(
          'Both from and to are required for a custom owner analytics range',
        );
      }

      return this.ensureValidRange(
        new Date(query.from),
        new Date(query.to),
        'custom',
      );
    }

    const to = new Date();
    const preset = query.preset ?? 'today';
    const from = new Date(to);

    if (preset === 'today') {
      from.setHours(0, 0, 0, 0);
    } else if (preset === 'last_7_days') {
      from.setTime(to.getTime() - 7 * DAY_MS);
    } else {
      from.setTime(to.getTime() - 30 * DAY_MS);
    }

    return this.ensureValidRange(from, to, preset);
  }

  private ensureValidRange(
    from: Date,
    to: Date,
    preset: AnalyticsRange['preset'],
  ): AnalyticsRange {
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from > to
    ) {
      throw new BadRequestException('Invalid owner analytics date range');
    }

    return { from, to, preset };
  }

  private serializeRange(range: AnalyticsRange) {
    return {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      preset: range.preset,
    };
  }

  private toBranchSummary(branch: BranchRecord) {
    return {
      id: branch.id,
      companyId: branch.companyId,
      name: branch.name,
      slug: branch.slug,
      address: branch.address,
      status: branch.status,
    };
  }

  private manualPaymentRangeWhere(
    branchId: string,
    range: AnalyticsRange,
  ): Prisma.ManualPaymentWhereInput {
    return {
      branchId,
      status: ManualPaymentStatus.recorded,
      recordedAt: { gte: range.from, lte: range.to },
    };
  }

  private orderRangeWhere(
    branchId: string,
    range: AnalyticsRange,
  ): Prisma.OrderWhereInput {
    return {
      branchId,
      submittedAt: { gte: range.from, lte: range.to },
    };
  }

  private createdAtRangeWhere(
    branchId: string,
    range: AnalyticsRange,
  ): { branchId: string; createdAt: { gte: Date; lte: Date } } {
    return {
      branchId,
      createdAt: { gte: range.from, lte: range.to },
    };
  }

  private summarizePayments(payments: ManualPaymentRecord[]) {
    const byMethod = this.emptyPaymentMethodTotals();
    const paidBillIds = new Set<string>();
    let collectedMinor = 0;

    for (const payment of payments) {
      collectedMinor += payment.amountMinor;
      paidBillIds.add(payment.billId);
      byMethod[payment.method].amountMinor += payment.amountMinor;
      byMethod[payment.method].count += 1;
    }

    return {
      collectedMinor,
      paidBillCount: paidBillIds.size,
      averageTicketMinor: this.safeAverageMinor(
        collectedMinor,
        paidBillIds.size,
      ),
      byMethod,
    };
  }

  private emptyPaymentMethodTotals() {
    return {
      cash: { method: BillPaymentMethod.cash, count: 0, amountMinor: 0 },
      card_pos: {
        method: BillPaymentMethod.card_pos,
        count: 0,
        amountMinor: 0,
      },
      wallet_manual: {
        method: BillPaymentMethod.wallet_manual,
        count: 0,
        amountMinor: 0,
      },
      other: { method: BillPaymentMethod.other, count: 0, amountMinor: 0 },
    } satisfies Record<
      BillPaymentMethod,
      { method: BillPaymentMethod; count: number; amountMinor: number }
    >;
  }

  private orderCountsFromGroupBy(
    records: Array<{ status: OrderStatus; _count: { _all: number } }>,
  ) {
    const counts = new Map<OrderStatus, number>();

    for (const record of records) {
      counts.set(record.status, record._count._all);
    }

    return counts;
  }

  private topPaidBills(payments: ManualPaymentRecord[]) {
    const bills = new Map<string, ManualPaymentRecord['bill']>();

    for (const payment of payments) {
      bills.set(payment.billId, payment.bill);
    }

    return Array.from(bills.values())
      .sort((left, right) => right.totalMinor - left.totalMinor)
      .slice(0, TOP_RECORD_LIMIT)
      .map((bill) => ({
        id: bill.id,
        billNumber: bill.billNumber,
        status: bill.status,
        totalMinor: bill.totalMinor,
        paidMinor: bill.paidMinor,
        balanceDueMinor: bill.balanceDueMinor,
        currency: bill.currency,
        orderCount: bill.orderCount,
        lineCount: bill.lineCount,
        paidAt: bill.paidAt,
        closedAt: bill.closedAt,
      }));
  }

  private moneyRowsByBucket(
    payments: ManualPaymentRecord[],
    unit: 'day' | 'hour',
  ): MoneyCountRow[] {
    const rows = new Map<string, { count: number; amountMinor: number }>();

    for (const payment of payments) {
      const key = this.dateBucket(payment.recordedAt, unit);
      const row = rows.get(key) ?? { count: 0, amountMinor: 0 };
      row.count += 1;
      row.amountMinor += payment.amountMinor;
      rows.set(key, row);
    }

    return Array.from(rows.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => ({ key, ...value }));
  }

  private countRowsByDate(dates: Date[], unit: 'day' | 'hour'): CountRow[] {
    const counts = new Map<string, number>();

    for (const date of dates) {
      this.increment(counts, this.dateBucket(date, unit));
    }

    return this.mapToCountRows(counts).sort((left, right) =>
      left.key.localeCompare(right.key),
    );
  }

  private dateBucket(date: Date, unit: 'day' | 'hour') {
    const iso = date.toISOString();

    if (unit === 'day') {
      return iso.slice(0, 10);
    }

    return `${iso.slice(0, 13)}:00:00.000Z`;
  }

  private avgSeconds(
    pairs: Array<{ start: Date | null; end: Date | null }>,
  ): number | null {
    const durations = pairs
      .filter((pair): pair is { start: Date; end: Date } =>
        Boolean(pair.start && pair.end),
      )
      .map((pair) =>
        Math.max(
          0,
          Math.round((pair.end.getTime() - pair.start.getTime()) / 1000),
        ),
      );

    if (durations.length === 0) {
      return null;
    }

    return Math.round(
      durations.reduce((sum, duration) => sum + duration, 0) /
        durations.length,
    );
  }

  private safeAverageMinor(totalMinor: number, count: number) {
    if (count <= 0) {
      return 0;
    }

    return Math.round(totalMinor / count);
  }

  private summarizeShift(shift?: CashierShiftRecord | null) {
    if (!shift) {
      return null;
    }

    return {
      id: shift.id,
      status: shift.status,
      currency: shift.currency,
      openingFloatMinor: shift.openingFloatMinor,
      expectedCashMinor: shift.expectedCashMinor,
      countedCashMinor: shift.countedCashMinor,
      cashOverShortMinor: shift.cashOverShortMinor,
      cashSalesMinor: shift.cashSalesMinor,
      cardSalesMinor: shift.cardSalesMinor,
      walletSalesMinor: shift.walletSalesMinor,
      otherSalesMinor: shift.otherSalesMinor,
      paymentCount: shift.paymentCount,
      billCount: shift.billCount,
      openedAt: shift.openedAt,
      closedAt: shift.closedAt,
      zReportNumber: shift.zReportNumber,
      zReportSnapshot: shift.zReportSnapshot,
    };
  }

  private summarizeReport(report?: CashierShiftReportRecord | null) {
    if (!report) {
      return null;
    }

    return {
      id: report.id,
      cashierShiftId: report.cashierShiftId,
      type: report.type,
      reportNumber: report.reportNumber,
      generatedAt: report.generatedAt,
      snapshot: report.snapshot,
    };
  }

  private cashDrawerTransactionTotals(
    transactions: Array<{
      type: CashDrawerTransactionType;
      signedAmountMinor: number;
    }>,
  ) {
    const totals = new Map<CashDrawerTransactionType, number>();

    for (const transaction of transactions) {
      this.increment(totals, transaction.type, transaction.signedAmountMinor);
    }

    return totals;
  }

  private increment<T extends string>(
    map: Map<T, number>,
    key: T,
    amount = 1,
  ) {
    map.set(key, (map.get(key) ?? 0) + amount);
  }

  private mapToCountRows<T extends string>(map: Map<T, number>): CountRow[] {
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort(
        (left, right) =>
          right.count - left.count || left.key.localeCompare(right.key),
      );
  }
}
