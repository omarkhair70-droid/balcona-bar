import {
  BillPaymentMethod,
  BillRequestActorType,
  BillRequestStatus,
  BillStatus,
  ManualPaymentStatus,
  OrderStatus,
} from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { BillsService } from './bills.service';

const now = new Date('2026-06-05T09:30:00.000Z');

function billDetail(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableSessionId: 'session-1',
    billRequestId: 'bill-request-1',
    status: BillStatus.presented,
    billNumber: 'BILL-00001',
    currency: 'EGP',
    subtotalMinor: 18500,
    serviceChargeMinor: 0,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 18500,
    paidMinor: 0,
    balanceDueMinor: 18500,
    orderCount: 1,
    lineCount: 1,
    requestedAt: now,
    presentedAt: now,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    createdByActorType: 'customer',
    presentedByStaffUserId: 'staff-1',
    paidByStaffUserId: null,
    closedByStaffUserId: null,
    cancelledByStaffUserId: null,
    cancellationReason: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    company: {
      id: 'company-1',
      name: 'Balkona',
      slug: 'balkona',
      status: 'active',
    },
    branch: {
      id: 'branch-1',
      companyId: 'company-1',
      name: 'Main',
      slug: 'main',
      status: 'active',
    },
    tableSession: {
      id: 'session-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      tableId: 'table-1',
      status: 'active',
      source: 'qr',
      guestLabel: null,
      partySize: null,
      startedAt: now,
      lastSeenAt: now,
      expiresAt: now,
      closedAt: null,
      closeReason: null,
      createdAt: now,
      updatedAt: now,
      table: {
        id: 'table-1',
        code: 'T01',
        displayName: 'Table 1',
        capacity: 2,
        qrToken: 'balcona-main-t01',
        status: 'active',
        floor: { id: 'floor-1', name: 'Main Floor', sortOrder: 1 },
      },
    },
    billRequest: null,
    lines: [
      {
        id: 'line-1',
        billId: 'bill-1',
        orderId: 'order-1',
        orderItemId: 'order-item-1',
        menuItemId: 'menu-item-1',
        lineType: 'item',
        itemNameSnapshot: 'Spanish Latte',
        quantity: 1,
        unitPriceMinor: 16000,
        modifiersTotalMinor: 2500,
        lineTotalMinor: 18500,
        currency: 'EGP',
        modifiersSnapshot: [],
        createdAt: now,
        updatedAt: now,
      },
    ],
    manualPayments: [],
    receipt: null,
    events: [],
    ...overrides,
  };
}

function buildService(tx: any) {
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
  };
  const cashierShiftsService = {
    getOpenShiftForPayment: jest.fn().mockResolvedValue({
      id: 'shift-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      currency: 'EGP',
    }),
    recordManualPaymentOnShift: jest.fn().mockResolvedValue(undefined),
  };
  const realtimeEventsService = {
    recordBillCreated: jest.fn().mockResolvedValue(undefined),
    recordBillPaymentRecorded: jest.fn().mockResolvedValue(undefined),
    recordBillPresentedForBill: jest.fn().mockResolvedValue(undefined),
    recordBillPaid: jest.fn().mockResolvedValue(undefined),
    recordReceiptGenerated: jest.fn().mockResolvedValue(undefined),
    recordBillClosed: jest.fn().mockResolvedValue(undefined),
    recordOrderCompleted: jest.fn().mockResolvedValue(undefined),
  };
  const presenceNotificationsService = {
    createBillClosedNotification: jest.fn().mockResolvedValue(undefined),
  };
  const tableAttentionService = {
    recalculateForTableSession: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new BillsService(
      prisma as never,
      presenceNotificationsService as never,
      realtimeEventsService as never,
      tableAttentionService as never,
      cashierShiftsService as never,
    ),
    prisma,
    cashierShiftsService,
    realtimeEventsService,
    tableAttentionService,
  };
}

describe('BillsService', () => {
  it('creates a stable bill snapshot from billable order item snapshots', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      billRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-request-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          tableSessionId: 'session-1',
          status: BillRequestStatus.open,
          currency: 'EGP',
          subtotalMinor: 18500,
          orderCount: 1,
          requestedAt: now,
          requestedByActorType: BillRequestActorType.customer,
          note: null,
        }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 'B0001',
            status: OrderStatus.served,
            currency: 'EGP',
            subtotalMinor: 18500,
            totalQuantity: 1,
            itemCount: 1,
            submittedAt: now,
            cashierAcceptedAt: now,
            preparingAt: now,
            readyAt: now,
            servedAt: now,
            completedAt: null,
            items: [
              {
                id: 'order-item-1',
                menuItemId: 'menu-item-1',
                quantity: 1,
                itemNameSnapshot: 'Spanish Latte',
                unitPriceMinorSnapshot: 16000,
                modifiersTotalMinorSnapshot: 2500,
                lineTotalMinorSnapshot: 18500,
                currency: 'EGP',
                modifierOptions: [
                  {
                    id: 'modifier-line-1',
                    modifierGroupId: 'group-1',
                    modifierOptionId: 'option-1',
                    modifierGroupNameSnapshot: 'Milk',
                    modifierGroupSlugSnapshot: 'milk',
                    modifierOptionNameSnapshot: 'Oat milk',
                    modifierOptionSlugSnapshot: 'oat-milk',
                    priceDeltaMinorSnapshot: 2500,
                  },
                ],
              },
            ],
          },
        ]),
      },
      bill: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn((args) => {
          if (args.where.billRequestId || args.where.branchId_billNumber) {
            return null;
          }

          return billDetail();
        }),
        create: jest.fn().mockResolvedValue({ id: 'bill-1' }),
      },
    };
    const { service, realtimeEventsService } = buildService(tx);

    const result = await service.createOrGetBillForBillRequest(
      'bill-request-1',
      { actorType: 'customer' },
    );

    expect(tx.bill.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          billNumber: 'BILL-00001',
          subtotalMinor: 18500,
          totalMinor: 18500,
          balanceDueMinor: 18500,
          orderCount: 1,
          lineCount: 1,
          lines: {
            create: [
              expect.objectContaining({
                itemNameSnapshot: 'Spanish Latte',
                unitPriceMinor: 16000,
                modifiersTotalMinor: 2500,
                lineTotalMinor: 18500,
                modifiersSnapshot: [
                  {
                    id: 'modifier-line-1',
                    modifierGroupId: 'group-1',
                    modifierOptionId: 'option-1',
                    modifierGroupNameSnapshot: 'Milk',
                    modifierGroupSlugSnapshot: 'milk',
                    modifierOptionNameSnapshot: 'Oat milk',
                    modifierOptionSlugSnapshot: 'oat-milk',
                    priceDeltaMinorSnapshot: 2500,
                  },
                ],
              }),
            ],
          },
        }),
      }),
    );
    expect(tx.bill.findUnique.mock.calls[0][0].include.branch.select).toEqual({
      id: true,
      companyId: true,
      name: true,
      slug: true,
      status: true,
    });
    expect(result.bill.billNumber).toBe('BILL-00001');
    expect(realtimeEventsService.recordBillCreated).toHaveBeenCalledWith(
      'bill-1',
      tx,
    );
  });

  it('rejects manual payment amounts that do not match the balance due', async () => {
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      bill: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          tableSessionId: 'session-1',
          billRequestId: 'bill-request-1',
          status: BillStatus.presented,
          currency: 'EGP',
          totalMinor: 18500,
          paidMinor: 0,
          balanceDueMinor: 18500,
        }),
      },
      manualPayment: {
        create: jest.fn(),
      },
    };
    const { service } = buildService(tx);

    await expect(
      service.recordManualPayment(
        'bill-1',
        {
          method: BillPaymentMethod.cash,
          amountMinor: 18000,
        },
        'staff-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.manualPayment.create).not.toHaveBeenCalled();
  });

  it('presents a bill request through the compact path without hydration or side effects', async () => {
    const tx = {
      bill: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'bill-1',
            billRequestId: 'bill-request-1',
            tableSessionId: 'session-1',
          })
          .mockResolvedValueOnce({
            id: 'bill-1',
            tableSessionId: 'session-1',
            billRequestId: 'bill-request-1',
            status: BillStatus.requested,
            presentedAt: null,
          }),
        update: jest.fn().mockResolvedValue({ id: 'bill-1' }),
      },
      billEvent: {
        create: jest.fn().mockResolvedValue({ id: 'bill-event-1' }),
      },
    };
    const { service, realtimeEventsService, tableAttentionService } =
      buildService(tx);

    const result = await service.presentBillForBillRequestCompact(
      'bill-request-1',
      'staff-1',
      'Presented at table',
      tx as never,
    );

    expect(result).toEqual({
      billId: 'bill-1',
      billRequestId: 'bill-request-1',
      tableSessionId: 'session-1',
      created: false,
      status: BillStatus.presented,
      presented: true,
    });
    expect(tx.bill.update).toHaveBeenCalledWith({
      where: { id: 'bill-1' },
      data: expect.objectContaining({
        status: BillStatus.presented,
        presentedByStaffUserId: 'staff-1',
      }),
    });
    expect(tx.billEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        billId: 'bill-1',
        type: 'presented',
        actorStaffUserId: 'staff-1',
      }),
    });
    expect(
      tx.bill.findUnique.mock.calls.some(([call]) => Boolean(call.include)),
    ).toBe(false);
    expect(realtimeEventsService.recordBillPresentedForBill).not.toHaveBeenCalled();
    expect(tableAttentionService.recalculateForTableSession).not.toHaveBeenCalled();
  });

  it('rejects manual payment when no cashier shift is open', async () => {
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      bill: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          tableSessionId: 'session-1',
          billRequestId: 'bill-request-1',
          status: BillStatus.presented,
          currency: 'EGP',
          totalMinor: 18500,
          paidMinor: 0,
          balanceDueMinor: 18500,
        }),
        updateMany: jest.fn(),
      },
      manualPayment: {
        create: jest.fn(),
      },
    };
    const { service, cashierShiftsService } = buildService(tx);
    cashierShiftsService.getOpenShiftForPayment.mockRejectedValue(
      new BadRequestException('Open a cashier shift before recording payments'),
    );

    await expect(
      service.recordManualPayment(
        'bill-1',
        {
          method: BillPaymentMethod.cash,
          amountMinor: 18500,
        },
        'staff-1',
      ),
    ).rejects.toThrow('Open a cashier shift before recording payments');

    expect(tx.bill.updateMany).not.toHaveBeenCalled();
    expect(tx.manualPayment.create).not.toHaveBeenCalled();
    expect(
      cashierShiftsService.recordManualPaymentOnShift,
    ).not.toHaveBeenCalled();
  });

  it('records an exact manual payment and generates a receipt', async () => {
    const paidBill = billDetail({
      status: BillStatus.paid,
      paidMinor: 18500,
      balanceDueMinor: 0,
      paidAt: now,
    });
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      bill: {
        findUnique: jest.fn((args) => {
          if (args.where.id) {
            return args.include
              ? paidBill
              : {
                  id: 'bill-1',
                  companyId: 'company-1',
                  branchId: 'branch-1',
                  tableSessionId: 'session-1',
                  billRequestId: 'bill-request-1',
                  status: BillStatus.presented,
                  currency: 'EGP',
                  totalMinor: 18500,
                  paidMinor: 0,
                  balanceDueMinor: 18500,
                };
          }

          return null;
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      manualPayment: {
        create: jest.fn().mockResolvedValue({ id: 'payment-1' }),
      },
      billEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      },
      billRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-request-1',
          status: BillRequestStatus.presented,
          tableSessionId: 'session-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      billRequestEvent: {
        create: jest.fn().mockResolvedValue({ id: 'bill-request-event-1' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      orderEvent: {
        create: jest.fn().mockResolvedValue({ id: 'order-event-1' }),
      },
      tableSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      billReceipt: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
      },
      $executeRaw: jest.fn().mockResolvedValue(undefined),
    };
    const { service, realtimeEventsService, cashierShiftsService } =
      buildService(tx);

    const result = await service.recordManualPayment(
      'bill-1',
      {
        method: BillPaymentMethod.card_pos,
        amountMinor: 18500,
        reference: 'POS-123',
      },
      'staff-1',
    );

    expect(tx.manualPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          method: BillPaymentMethod.card_pos,
          cashierShiftId: 'shift-1',
          amountMinor: 18500,
          status: ManualPaymentStatus.recorded,
          reference: 'POS-123',
        }),
      }),
    );
    expect(tx.bill.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'bill-1',
          balanceDueMinor: 18500,
          status: { in: [BillStatus.presented, BillStatus.payment_pending] },
        }),
        data: expect.objectContaining({
          status: BillStatus.paid,
          paidMinor: 18500,
          balanceDueMinor: 0,
        }),
      }),
    );
    expect(tx.billReceipt.create).toHaveBeenCalled();
    expect(
      cashierShiftsService.recordManualPaymentOnShift,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        shift: expect.objectContaining({ id: 'shift-1' }),
        paymentId: 'payment-1',
        method: BillPaymentMethod.card_pos,
        amountMinor: 18500,
        currency: 'EGP',
      }),
      tx,
    );
    expect(result.bill.status).toBe(BillStatus.paid);
    expect(realtimeEventsService.recordBillPaid).toHaveBeenCalledWith(
      'bill-1',
      tx,
    );
  });

  it('rejects a duplicate double-submit after another cashier settles the bill', async () => {
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'bill-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        tableSessionId: 'session-1',
        billRequestId: 'bill-request-1',
        status: BillStatus.presented,
        currency: 'EGP',
        totalMinor: 18500,
        paidMinor: 0,
        balanceDueMinor: 18500,
      })
      .mockResolvedValueOnce({
        status: BillStatus.paid,
        balanceDueMinor: 0,
      });
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-2' }),
      },
      bill: {
        findUnique,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      manualPayment: {
        create: jest.fn(),
      },
    };
    const { service, cashierShiftsService } = buildService(tx);

    await expect(
      service.recordManualPayment(
        'bill-1',
        {
          method: BillPaymentMethod.cash,
          amountMinor: 18500,
        },
        'staff-2',
      ),
    ).rejects.toThrow('Bill is already paid');

    expect(tx.bill.updateMany).toHaveBeenCalled();
    expect(tx.manualPayment.create).not.toHaveBeenCalled();
    expect(
      cashierShiftsService.recordManualPaymentOnShift,
    ).not.toHaveBeenCalled();
  });

  it('rejects already paid bills before creating another manual payment', async () => {
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      bill: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-1',
          companyId: 'company-1',
          branchId: 'branch-1',
          tableSessionId: 'session-1',
          billRequestId: 'bill-request-1',
          status: BillStatus.paid,
          currency: 'EGP',
          totalMinor: 18500,
          paidMinor: 18500,
          balanceDueMinor: 0,
        }),
        updateMany: jest.fn(),
      },
      manualPayment: {
        create: jest.fn(),
      },
    };
    const { service } = buildService(tx);

    await expect(
      service.recordManualPayment(
        'bill-1',
        {
          method: BillPaymentMethod.card_pos,
          amountMinor: 18500,
        },
        'staff-1',
      ),
    ).rejects.toThrow('Bill is already paid');

    expect(tx.bill.updateMany).not.toHaveBeenCalled();
    expect(tx.manualPayment.create).not.toHaveBeenCalled();
  });
});
