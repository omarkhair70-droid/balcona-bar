import {
  BillPaymentMethod,
  CashDrawerTransactionType,
  CashierShiftReportType,
  CashierShiftStatus,
  OrderStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerAnalyticsService } from './owner-analytics.service';

const range = {
  from: '2026-06-05T00:00:00.000Z',
  to: '2026-06-05T23:59:59.000Z',
};
const branch = {
  id: 'branch-1',
  companyId: 'company-1',
  name: 'Balcona Main',
  slug: 'balcona-main',
  address: 'Cairo',
  status: 'active',
  company: {
    id: 'company-1',
    name: 'Balcona',
    slug: 'balcona',
    status: 'active',
  },
};

function bill(id: string, totalMinor: number) {
  return {
    id,
    billNumber: id.toUpperCase(),
    status: 'paid',
    currency: 'EGP',
    totalMinor,
    paidMinor: totalMinor,
    balanceDueMinor: 0,
    orderCount: 1,
    lineCount: 1,
    requestedAt: null,
    presentedAt: new Date('2026-06-05T12:00:00.000Z'),
    paidAt: new Date('2026-06-05T12:05:00.000Z'),
    closedAt: null,
  };
}

function payment(
  id: string,
  method: BillPaymentMethod,
  amountMinor: number,
  billId = id,
) {
  return {
    id,
    billId,
    cashierShiftId: 'shift-1',
    method,
    status: 'recorded',
    amountMinor,
    currency: 'EGP',
    reference: null,
    note: null,
    recordedAt: new Date('2026-06-05T12:10:00.000Z'),
    bill: bill(billId, amountMinor),
  };
}

function shift(
  id: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    companyId: 'company-1',
    branchId: 'branch-1',
    openedByStaffUserId: 'staff-1',
    closedByStaffUserId: null,
    status: CashierShiftStatus.closed,
    currency: 'EGP',
    openingFloatMinor: 10000,
    expectedCashMinor: 25000,
    countedCashMinor: 25100,
    cashOverShortMinor: 100,
    cashSalesMinor: 15000,
    cardSalesMinor: 8000,
    walletSalesMinor: 0,
    otherSalesMinor: 0,
    paymentCount: 2,
    billCount: 2,
    openedAt: new Date('2026-06-05T08:00:00.000Z'),
    closedAt: new Date('2026-06-05T18:00:00.000Z'),
    openingNote: null,
    closingNote: null,
    zReportNumber: 'Z-00001',
    zReportSnapshot: { tenderTotals: { cashMinor: 15000 } },
    ...overrides,
  };
}

function createPrisma(overrides: Record<string, unknown> = {}) {
  const base = {
    branch: { findUnique: jest.fn().mockResolvedValue(branch) },
    manualPayment: { findMany: jest.fn().mockResolvedValue([]) },
    onlinePaymentIntent: { findMany: jest.fn().mockResolvedValue([]) },
    order: {
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    billRequest: { count: jest.fn().mockResolvedValue(0) },
    waiterCall: {
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cashierShift: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    cashierShiftReport: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    bill: { groupBy: jest.fn().mockResolvedValue([]) },
    billLine: { findMany: jest.fn().mockResolvedValue([]) },
    preparationTask: { groupBy: jest.fn().mockResolvedValue([]) },
    kitchenTicket: { groupBy: jest.fn().mockResolvedValue([]) },
    printJob: {
      groupBy: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    tableAttentionSnapshot: { count: jest.fn().mockResolvedValue(0) },
    cashDrawerTransaction: { findMany: jest.fn().mockResolvedValue([]) },
    aiWaiterSession: {
      aggregate: jest.fn().mockResolvedValue({
        _count: { _all: 0 },
        _sum: {
          totalInputTokens: null,
          totalOutputTokens: null,
          estimatedCostMicros: null,
          messageCount: null,
        },
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiWaiterMessage: { count: jest.fn().mockResolvedValue(0) },
    aiWaiterCartProposal: { count: jest.fn().mockResolvedValue(0) },
    aiWaiterUsageEvent: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          inputTokens: null,
          outputTokens: null,
          estimatedCostMicros: null,
        },
      }),
    },
  };

  return Object.assign(base, overrides) as unknown as PrismaService;
}

function createService(prismaOverrides: Record<string, unknown> = {}) {
  return new OwnerAnalyticsService(
    createPrisma(prismaOverrides),
    {
      getBranchInventoryAlerts: jest.fn().mockResolvedValue({
        summary: {
          lowStockCount: 0,
          outOfStockCount: 0,
          stockBlockedMenuItemCount: 0,
        },
        recentMovements: [],
      }),
    } as never,
  );
}

describe('OwnerAnalyticsService', () => {
  it('returns zero-safe summary for an empty range', async () => {
    const service = createService();

    const result = await service.getSummary('branch-1', range);

    expect(result.collectedMinor).toBe(0);
    expect(result.paidBillCount).toBe(0);
    expect(result.averageTicketMinor).toBe(0);
    expect(result.cashCollectedMinor).toBe(0);
    expect(result.submittedOrderCount).toBe(0);
    expect(result.activeCashierShift).toBeNull();
    expect(result.lowStockCount).toBe(0);
  });

  it('computes collected totals by manual payment method and safe average ticket', async () => {
    const service = createService({
      manualPayment: {
        findMany: jest.fn().mockResolvedValue([
          payment('p1', BillPaymentMethod.cash, 5000, 'b1'),
          payment('p2', BillPaymentMethod.card_pos, 3000, 'b2'),
          payment('p3', BillPaymentMethod.wallet_manual, 1500, 'b3'),
          payment('p4', BillPaymentMethod.other, 500, 'b4'),
        ]),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([
          { status: OrderStatus.submitted, _count: { _all: 2 } },
          { status: OrderStatus.cashier_accepted, _count: { _all: 1 } },
          { status: OrderStatus.served, _count: { _all: 1 } },
        ]),
      },
    });

    const result = await service.getSummary('branch-1', range);

    expect(result.collectedMinor).toBe(10000);
    expect(result.cashCollectedMinor).toBe(5000);
    expect(result.cardCollectedMinor).toBe(3000);
    expect(result.walletCollectedMinor).toBe(1500);
    expect(result.otherCollectedMinor).toBe(500);
    expect(result.paidBillCount).toBe(4);
    expect(result.averageTicketMinor).toBe(2500);
    expect(result.submittedOrderCount).toBe(2);
    expect(result.acceptedOrderCount).toBe(1);
    expect(result.servedOrderCount).toBe(1);
  });

  it('computes order status counts and lifecycle averages while skipping missing timestamps', async () => {
    const submittedAt = new Date('2026-06-05T10:00:00.000Z');
    const service = createService({
      manualPayment: {
        findMany: jest
          .fn()
          .mockResolvedValue([payment('p1', BillPaymentMethod.cash, 12000)]),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            status: OrderStatus.served,
            currency: 'EGP',
            subtotalMinor: 12000,
            totalQuantity: 3,
            itemCount: 2,
            submittedAt,
            cashierAcceptedAt: new Date('2026-06-05T10:05:00.000Z'),
            preparingAt: new Date('2026-06-05T10:07:00.000Z'),
            readyAt: new Date('2026-06-05T10:17:00.000Z'),
            servedAt: new Date('2026-06-05T10:20:00.000Z'),
            completedAt: null,
          },
          {
            id: 'order-2',
            status: OrderStatus.submitted,
            currency: 'EGP',
            subtotalMinor: 6000,
            totalQuantity: 1,
            itemCount: 1,
            submittedAt: new Date('2026-06-05T11:00:00.000Z'),
            cashierAcceptedAt: null,
            preparingAt: null,
            readyAt: null,
            servedAt: null,
            completedAt: null,
          },
        ]),
      },
    });

    const result = await service.getOrders('branch-1', range);

    expect(result.orderCountByStatus).toEqual([
      { key: OrderStatus.served, count: 1 },
      { key: OrderStatus.submitted, count: 1 },
    ]);
    expect(result.totalQuantity).toBe(4);
    expect(result.itemCount).toBe(3);
    expect(result.averageOrderValueMinor).toBe(12000);
    expect(result.lifecycleAverages.submittedToAcceptedSeconds).toBe(300);
    expect(result.lifecycleAverages.acceptedToPreparingSeconds).toBe(120);
    expect(result.lifecycleAverages.preparingToReadySeconds).toBe(600);
    expect(result.lifecycleAverages.readyToServedSeconds).toBe(180);
    expect(result.lifecycleAverages.submittedToServedSeconds).toBe(1200);
  });

  it('computes top items and modifiers from paid bill line snapshots', async () => {
    const service = createService({
      billLine: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'line-1',
            billId: 'bill-1',
            orderId: 'order-1',
            orderItemId: 'item-1',
            menuItemId: 'menu-1',
            itemNameSnapshot: 'Spanish Latte',
            quantity: 2,
            unitPriceMinor: 5000,
            modifiersTotalMinor: 500,
            lineTotalMinor: 11000,
            currency: 'EGP',
            modifiersSnapshot: null,
            orderItem: {
              itemSlugSnapshot: 'spanish-latte',
              modifierOptions: [
                {
                  modifierGroupId: 'milk',
                  modifierOptionId: 'oat',
                  modifierGroupNameSnapshot: 'Milk',
                  modifierOptionNameSnapshot: 'Oat milk',
                  priceDeltaMinorSnapshot: 500,
                },
              ],
            },
            menuItem: {
              id: 'menu-1',
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Coffee', slug: 'coffee' },
            },
          },
          {
            id: 'line-2',
            billId: 'bill-1',
            orderId: 'order-1',
            orderItemId: 'item-2',
            menuItemId: 'menu-1',
            itemNameSnapshot: 'Spanish Latte',
            quantity: 1,
            unitPriceMinor: 5000,
            modifiersTotalMinor: 0,
            lineTotalMinor: 5000,
            currency: 'EGP',
            modifiersSnapshot: null,
            orderItem: {
              itemSlugSnapshot: 'spanish-latte',
              modifierOptions: [],
            },
            menuItem: {
              id: 'menu-1',
              categoryId: 'cat-1',
              category: { id: 'cat-1', name: 'Coffee', slug: 'coffee' },
            },
          },
        ]),
      },
    });

    const result = await service.getItems('branch-1', range);

    expect(result.quantity).toBe(3);
    expect(result.revenueMinor).toBe(16000);
    expect(result.modifierRevenueMinor).toBe(1000);
    expect(result.topItemsByQuantity[0]).toMatchObject({
      menuItemId: 'menu-1',
      name: 'Spanish Latte',
      quantity: 3,
      revenueMinor: 16000,
    });
    expect(result.topModifiers[0]).toMatchObject({
      modifierGroupId: 'milk',
      modifierOptionId: 'oat',
      quantity: 2,
      revenueMinor: 1000,
    });
    expect(result.categoryBreakdown[0]).toMatchObject({
      categoryId: 'cat-1',
      name: 'Coffee',
      quantity: 3,
      revenueMinor: 16000,
    });
  });

  it('computes cashier shift over-short, Z report, and drawer movement totals', async () => {
    const service = createService({
      cashierShift: {
        findFirst: jest.fn().mockResolvedValue(shift('open-shift', {
          status: CashierShiftStatus.open,
          closedAt: null,
          cashOverShortMinor: null,
        })),
        findMany: jest
          .fn()
          .mockResolvedValue([
            shift('shift-1', { cashOverShortMinor: 100 }),
            shift('shift-2', { cashOverShortMinor: -50 }),
          ]),
      },
      cashierShiftReport: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'report-1',
            cashierShiftId: 'shift-1',
            type: CashierShiftReportType.z_report,
            reportNumber: 'Z-00001',
            snapshot: { totals: { collectedMinor: 23000 } },
            generatedAt: new Date('2026-06-05T18:00:00.000Z'),
          },
        ]),
      },
      cashDrawerTransaction: {
        findMany: jest.fn().mockResolvedValue([
          {
            type: CashDrawerTransactionType.opening_float,
            signedAmountMinor: 10000,
            currency: 'EGP',
            createdAt: new Date('2026-06-05T08:00:00.000Z'),
          },
          {
            type: CashDrawerTransactionType.cash_in,
            signedAmountMinor: 2000,
            currency: 'EGP',
            createdAt: new Date('2026-06-05T12:00:00.000Z'),
          },
          {
            type: CashDrawerTransactionType.cash_out,
            signedAmountMinor: -500,
            currency: 'EGP',
            createdAt: new Date('2026-06-05T13:00:00.000Z'),
          },
        ]),
      },
    });

    const result = await service.getCashierShifts('branch-1', range);

    expect(result.currentOpenShift?.id).toBe('open-shift');
    expect(result.shiftCount).toBe(2);
    expect(result.totalOverShortMinor).toBe(50);
    expect(result.latestZReport?.reportNumber).toBe('Z-00001');
    expect(result.cashDrawerTransactions.openingFloatMinor).toBe(10000);
    expect(result.cashDrawerTransactions.cashInMinor).toBe(2000);
    expect(result.cashDrawerTransactions.cashOutMinor).toBe(-500);
  });

  it('returns zero AI usage cleanly when AI tables are empty', async () => {
    const service = createService();

    const result = await service.getAiWaiter('branch-1', range);

    expect(result.aiSessionCount).toBe(0);
    expect(result.aiMessageCount).toBe(0);
    expect(result.estimatedCostMicros).toBe(0);
    expect(result.topEscalationReasons).toEqual([]);
  });

  it('computes non-zero AI usage from usage events and proposals', async () => {
    const service = createService({
      aiWaiterSession: {
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 2 },
          _sum: {
            totalInputTokens: 100,
            totalOutputTokens: 50,
            estimatedCostMicros: 25,
            messageCount: 4,
          },
        }),
        findMany: jest.fn().mockResolvedValue([
          { escalationReason: 'customer_requested_human' },
          { escalationReason: 'customer_requested_human' },
          { escalationReason: 'system_error' },
        ]),
      },
      aiWaiterMessage: { count: jest.fn().mockResolvedValue(6) },
      aiWaiterCartProposal: {
        count: jest
          .fn()
          .mockResolvedValueOnce(5)
          .mockResolvedValueOnce(3),
      },
      aiWaiterUsageEvent: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            inputTokens: 800,
            outputTokens: 320,
            estimatedCostMicros: 240,
          },
        }),
      },
    });

    const result = await service.getAiWaiter('branch-1', range);

    expect(result.aiSessionCount).toBe(2);
    expect(result.aiMessageCount).toBe(6);
    expect(result.proposalCount).toBe(5);
    expect(result.appliedProposalCount).toBe(3);
    expect(result.inputTokens).toBe(800);
    expect(result.outputTokens).toBe(320);
    expect(result.estimatedCostMicros).toBe(240);
    expect(result.topEscalationReasons[0]).toEqual({
      key: 'customer_requested_human',
      count: 2,
    });
  });

  it('rejects invalid date ranges', async () => {
    const service = createService();

    await expect(
      service.getSummary('branch-1', {
        from: '2026-06-06T00:00:00.000Z',
        to: '2026-06-05T00:00:00.000Z',
      }),
    ).rejects.toThrow('Invalid owner analytics date range');
  });

  it('throws NotFound when the branch does not exist', async () => {
    const service = createService({
      branch: { findUnique: jest.fn().mockResolvedValue(null) },
    });

    await expect(service.getSummary('missing-branch', range)).rejects.toThrow(
      'Branch not found',
    );
  });
});
