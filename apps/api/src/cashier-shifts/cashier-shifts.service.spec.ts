import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BillPaymentMethod,
  CashDrawerTransactionSourceType,
  CashDrawerTransactionType,
  CashierShiftReportType,
  CashierShiftStatus,
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
} from '@prisma/client';
import { CashierShiftsService } from './cashier-shifts.service';

const now = new Date('2026-06-05T11:30:00.000Z');
const company = {
  id: 'company-1',
  name: 'Balcona',
  slug: 'balcona',
  status: 'active',
};
const branch = {
  id: 'branch-1',
  companyId: 'company-1',
  name: 'Main',
  slug: 'main',
  status: 'active',
};
const staff = {
  id: 'staff-1',
  email: 'cashier@balcona.local',
  name: 'Cashier',
  status: 'active',
};

function shiftRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'shift-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    openedByStaffUserId: 'staff-1',
    closedByStaffUserId: null,
    status: CashierShiftStatus.open,
    currency: 'EGP',
    openingFloatMinor: 10000,
    expectedCashMinor: 10000,
    countedCashMinor: null,
    cashOverShortMinor: null,
    cashSalesMinor: 0,
    cardSalesMinor: 0,
    walletSalesMinor: 0,
    otherSalesMinor: 0,
    paymentCount: 0,
    billCount: 0,
    openedAt: now,
    closedAt: null,
    openingNote: null,
    closingNote: null,
    zReportNumber: null,
    zReportSnapshot: null,
    createdAt: now,
    updatedAt: now,
    company,
    branch,
    openedByStaffUser: staff,
    closedByStaffUser: null,
    ...overrides,
  };
}

function drawerTransaction(
  type: CashDrawerTransactionType,
  signedAmountMinor: number,
) {
  return {
    id: `${type}-1`,
    companyId: 'company-1',
    branchId: 'branch-1',
    cashierShiftId: 'shift-1',
    staffUserId: 'staff-1',
    type,
    signedAmountMinor,
    currency: 'EGP',
    sourceType:
      type === CashDrawerTransactionType.opening_float
        ? CashDrawerTransactionSourceType.opening_float
        : CashDrawerTransactionSourceType.adjustment,
    sourceId: 'shift-1',
    note: null,
    createdAt: now,
  };
}

function buildService(tx: any) {
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    branch: tx.branch,
    cashierShift: tx.cashierShift,
    cashDrawerTransaction: tx.cashDrawerTransaction,
    cashierShiftReport: tx.cashierShiftReport,
    manualPayment: tx.manualPayment,
    onlinePaymentIntent: tx.onlinePaymentIntent,
    onlinePaymentOperation: tx.onlinePaymentOperation,
    staffUser: tx.staffUser,
  };

  return {
    service: new CashierShiftsService(prisma as never),
    prisma,
  };
}

function buildTx(overrides: Record<string, unknown> = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(undefined),
    branch: {
      findUnique: jest.fn().mockResolvedValue(branch),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    cashierShift: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(shiftRecord()),
      create: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      update: jest.fn().mockResolvedValue(shiftRecord()),
    },
    cashDrawerTransaction: {
      create: jest.fn().mockResolvedValue({ id: 'drawer-1' }),
      findMany: jest
        .fn()
        .mockResolvedValue([
          drawerTransaction(CashDrawerTransactionType.opening_float, 10000),
        ]),
    },
    manualPayment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    onlinePaymentIntent: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    onlinePaymentOperation: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    cashierShiftReport: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          id: 'report-1',
          ...args.data,
          createdAt: now,
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  return Object.assign(tx, overrides);
}

describe('CashierShiftsService', () => {
  it('opens a shift with opening float and an opening drawer transaction', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    const result = await service.open(
      'branch-1',
      { openingFloatMinor: 10000, note: 'Morning float' },
      'staff-1',
    );

    expect(tx.cashierShift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: 'branch-1',
          openedByStaffUserId: 'staff-1',
          openingFloatMinor: 10000,
          expectedCashMinor: 10000,
          openingNote: 'Morning float',
        }),
      }),
    );
    expect(tx.cashDrawerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashDrawerTransactionType.opening_float,
          signedAmountMinor: 10000,
        }),
      }),
    );
    expect(result.shift.id).toBe('shift-1');
  });

  it('rejects opening a second open shift for the same branch', async () => {
    const tx = buildTx({
      cashierShift: {
        ...buildTx().cashierShift,
        findFirst: jest.fn().mockResolvedValue({ id: 'existing-shift' }),
      },
    });
    const { service } = buildService(tx);

    await expect(
      service.open('branch-1', { openingFloatMinor: 10000 }, 'staff-1'),
    ).rejects.toThrow('A cashier shift is already open for this branch');
    expect(tx.cashierShift.create).not.toHaveBeenCalled();
  });

  it('returns the current open shift summary', async () => {
    const tx = buildTx({
      cashierShift: {
        ...buildTx().cashierShift,
        findFirst: jest.fn().mockResolvedValue({ id: 'shift-1' }),
      },
    });
    const { service } = buildService(tx);

    const result = await service.getCurrent('branch-1');

    expect(result.shift?.id).toBe('shift-1');
    expect((result.summary as any)?.cashDrawer.expectedCashMinor).toBe(10000);
  });

  it('creates cash out adjustments as negative drawer movements', async () => {
    const tx = buildTx({
      cashDrawerTransaction: {
        ...buildTx().cashDrawerTransaction,
        findMany: jest
          .fn()
          .mockResolvedValue([
            drawerTransaction(CashDrawerTransactionType.opening_float, 10000),
            drawerTransaction(CashDrawerTransactionType.cash_out, -1500),
          ]),
      },
    });
    const { service } = buildService(tx);

    const result = await service.createCashAdjustment(
      'shift-1',
      { type: 'cash_out', amountMinor: 1500, note: 'Petty cash' },
      'staff-1',
    );

    expect(tx.cashDrawerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashDrawerTransactionType.cash_out,
          signedAmountMinor: -1500,
          sourceType: CashDrawerTransactionSourceType.adjustment,
        }),
      }),
    );
    expect((result.summary as any).cashDrawer.expectedCashMinor).toBe(8500);
  });

  it('generates and persists an X report without closing the shift', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    const result = await service.generateXReport('shift-1', 'staff-1');

    expect(tx.cashierShiftReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashierShiftReportType.x_report,
          reportNumber: 'X-00001',
        }),
      }),
    );
    expect(tx.cashierShift.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CashierShiftStatus.closed }),
      }),
    );
    expect(result.report.reportNumber).toBe('X-00001');
  });

  it('nets Paymob refund adjustments from online shift tender totals', async () => {
    const tx = buildTx({
      onlinePaymentIntent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'intent-1',
            billId: 'bill-1',
            provider: OnlinePaymentProvider.paymob,
            status: OnlinePaymentIntentStatus.succeeded,
            amountMinor: 12500,
            currency: 'EGP',
            succeededAt: now,
            bill: {
              id: 'bill-1',
              billNumber: 'BILL-00001',
              status: 'paid',
              totalMinor: 12500,
              paidMinor: 12500,
              balanceDueMinor: 0,
              paidAt: now,
            },
          },
        ]),
      },
      onlinePaymentOperation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'refund-1',
            onlinePaymentIntentId: 'intent-1',
            provider: OnlinePaymentProvider.paymob,
            type: OnlinePaymentOperationType.refund,
            status: OnlinePaymentOperationStatus.succeeded,
            amountMinor: 5000,
            currency: 'EGP',
            providerTransactionId: '555010',
            parentProviderTransactionId: '555001',
            completedAt: now,
            onlinePaymentIntent: { billId: 'bill-1' },
          },
        ]),
      },
    });
    const { service } = buildService(tx);

    const result = await service.generateXReport('shift-1', 'staff-1');
    const tenderTotals = (result.report.snapshot as any).tenderTotals;

    expect(tenderTotals.onlineGrossMinor).toBe(12500);
    expect(tenderTotals.onlineAdjustmentMinor).toBe(5000);
    expect(tenderTotals.onlineRefundedMinor).toBe(5000);
    expect(tenderTotals.onlineExternalMinor).toBe(7500);
    expect(tenderTotals.onlineTotalMinor).toBe(7500);
    expect(tenderTotals.totalCollectedMinor).toBe(7500);
  });

  it('closes a shift and stores a Z report snapshot with over-short', async () => {
    const tx = buildTx({
      manualPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'payment-1',
            billId: 'bill-1',
            method: BillPaymentMethod.cash,
            amountMinor: 6500,
            currency: 'EGP',
            reference: null,
            note: null,
            recordedAt: now,
            bill: {
              id: 'bill-1',
              billNumber: 'BILL-00001',
              status: 'paid',
              totalMinor: 6500,
              paidMinor: 6500,
              balanceDueMinor: 0,
              paidAt: now,
            },
            recordedByStaffUser: staff,
          },
        ]),
      },
      cashDrawerTransaction: {
        ...buildTx().cashDrawerTransaction,
        findMany: jest
          .fn()
          .mockResolvedValue([
            drawerTransaction(CashDrawerTransactionType.opening_float, 10000),
            drawerTransaction(CashDrawerTransactionType.cash_payment, 6500),
          ]),
      },
    });
    const { service } = buildService(tx);

    await service.close(
      'shift-1',
      { countedCashMinor: 17000, note: 'Close day' },
      'staff-1',
    );

    expect(tx.cashierShiftReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashierShiftReportType.z_report,
          reportNumber: 'Z-00001',
        }),
      }),
    );
    expect(tx.cashierShift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CashierShiftStatus.closed,
          countedCashMinor: 17000,
          cashOverShortMinor: 500,
          zReportNumber: 'Z-00001',
        }),
      }),
    );
  });

  it('rejects double close', async () => {
    const tx = buildTx({
      cashierShift: {
        ...buildTx().cashierShift,
        findUnique: jest
          .fn()
          .mockResolvedValue(
            shiftRecord({ status: CashierShiftStatus.closed }),
          ),
      },
    });
    const { service } = buildService(tx);

    await expect(
      service.close('shift-1', { countedCashMinor: 10000 }, 'staff-1'),
    ).rejects.toThrow('Cashier shift is already closed');
  });

  it('rejects payment attachment when no open shift exists', async () => {
    const tx = buildTx({
      cashierShift: {
        ...buildTx().cashierShift,
        findFirst: jest.fn().mockResolvedValue(null),
      },
    });
    const { service } = buildService(tx);

    await expect(
      service.getOpenShiftForPayment('branch-1', 'EGP', tx as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates drawer movement for cash payment attachment', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);
    const shift = {
      id: 'shift-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      currency: 'EGP',
    };

    await service.recordManualPaymentOnShift(
      {
        shift,
        paymentId: 'payment-1',
        method: BillPaymentMethod.cash,
        amountMinor: 6500,
        currency: 'EGP',
        staffUserId: 'staff-1',
      },
      tx as never,
    );

    expect(tx.cashDrawerTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashDrawerTransactionType.cash_payment,
          signedAmountMinor: 6500,
          sourceType: CashDrawerTransactionSourceType.manual_payment,
          sourceId: 'payment-1',
        }),
      }),
    );
    expect(tx.cashierShift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cashSalesMinor: { increment: 6500 },
          expectedCashMinor: { increment: 6500 },
        }),
      }),
    );
  });

  it('does not create drawer movement for card POS payment attachment', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);
    const shift = {
      id: 'shift-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      currency: 'EGP',
    };

    await service.recordManualPaymentOnShift(
      {
        shift,
        paymentId: 'payment-1',
        method: BillPaymentMethod.card_pos,
        amountMinor: 6500,
        currency: 'EGP',
        staffUserId: 'staff-1',
      },
      tx as never,
    );

    expect(tx.cashDrawerTransaction.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: CashDrawerTransactionType.cash_payment,
        }),
      }),
    );
    expect(tx.cashierShift.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cardSalesMinor: { increment: 6500 },
        }),
      }),
    );
  });

  it('throws NotFound for missing branches', async () => {
    const tx = buildTx({
      branch: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });
    const { service } = buildService(tx);

    await expect(service.getCurrent('missing-branch')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
