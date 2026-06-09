import { BadRequestException, Logger } from '@nestjs/common';
import {
  BillRequestActorType,
  BillRequestStatus,
  BillStatus,
  OrderStatus,
  TableSessionStatus,
} from '@prisma/client';
import { BillRequestsService } from './bill-requests.service';

const now = new Date('2026-06-05T09:30:00.000Z');

afterEach(() => {
  jest.restoreAllMocks();
});

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

function tableSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableId: 'table-1',
    status: TableSessionStatus.active,
    source: 'qr',
    guestLabel: null,
    partySize: 2,
    startedAt: now,
    lastSeenAt: now,
    expiresAt: null,
    closedAt: null,
    closeReason: null,
    createdAt: now,
    updatedAt: now,
    table: {
      id: 'table-1',
      code: 'T01',
      displayName: 'Table 1',
      capacity: 4,
      qrToken: 'balcona-main-t01',
      status: 'active',
      floor: { id: 'floor-1', name: 'Ground Floor', sortOrder: 1 },
    },
    ...overrides,
  };
}

function billableOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    orderNumber: 'B0001',
    status: OrderStatus.served,
    currency: 'EGP',
    subtotalMinor: 12500,
    totalQuantity: 1,
    itemCount: 1,
    submittedAt: now,
    cashierAcceptedAt: now,
    preparingAt: now,
    readyAt: now,
    servedAt: now,
    completedAt: null,
    ...overrides,
  };
}

function billSummary(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableSessionId: 'session-1',
    billRequestId: 'bill-request-1',
    status: BillStatus.requested,
    billNumber: 'BILL-00001',
    currency: 'EGP',
    subtotalMinor: 12500,
    serviceChargeMinor: 0,
    taxMinor: 0,
    discountMinor: 0,
    totalMinor: 12500,
    paidMinor: 0,
    balanceDueMinor: 12500,
    orderCount: 1,
    lineCount: 1,
    requestedAt: now,
    presentedAt: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    createdByActorType: 'customer',
    presentedByStaffUserId: null,
    paidByStaffUserId: null,
    closedByStaffUserId: null,
    cancelledByStaffUserId: null,
    cancellationReason: null,
    metadata: {},
    createdAt: now,
    updatedAt: now,
    lines: [
      {
        id: 'line-1',
        billId: 'bill-1',
        orderId: 'order-1',
        orderItemId: 'order-item-1',
        menuItemId: 'menu-item-1',
        itemNameSnapshot: 'Spanish Latte',
        quantity: 1,
        unitPriceMinor: 12500,
        modifiersTotalMinor: 1000,
        lineTotalMinor: 12500,
        currency: 'EGP',
        modifiersSnapshot: [
          {
            modifierGroupSlugSnapshot: 'size',
            modifierOptionSlugSnapshot: 'medium',
          },
        ],
      },
    ],
    manualPayments: [],
    receipt: null,
    ...overrides,
  };
}

function billRequestRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bill-request-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableSessionId: 'session-1',
    status: BillRequestStatus.open,
    currency: 'EGP',
    subtotalMinor: 12500,
    orderCount: 1,
    requestedAt: now,
    acknowledgedAt: null,
    presentedAt: null,
    closedAt: null,
    cancelledAt: null,
    requestedByActorType: BillRequestActorType.customer,
    acknowledgedByStaffUserId: null,
    presentedByStaffUserId: null,
    closedByStaffUserId: null,
    cancelledByStaffUserId: null,
    note: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    company: { id: 'company-1', name: 'Balkona', slug: 'balkona', status: 'active' },
    branch: {
      id: 'branch-1',
      companyId: 'company-1',
      name: 'Main',
      slug: 'main',
      address: null,
      status: 'active',
    },
    tableSession: tableSession(),
    bill: billSummary(),
    events: [
      {
        id: 'event-1',
        billRequestId: 'bill-request-1',
        type: 'created',
        actorType: BillRequestActorType.customer,
        actorStaffUserId: null,
        metadata: { subtotalMinor: 12500, orderCount: 1, currency: 'EGP' },
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

function buildService(tx: any, overrides: Record<string, any> = {}) {
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    ...tx,
  };
  const presenceNotificationsService = {
    createBillRequestedNotification: jest.fn().mockResolvedValue(undefined),
    createBillPresentedNotification: jest.fn().mockResolvedValue(undefined),
    ...overrides.presenceNotificationsService,
  };
  const realtimeEventsService = {
    recordBillRequested: jest.fn().mockResolvedValue(undefined),
    recordBillPresented: jest.fn().mockResolvedValue(undefined),
    ...overrides.realtimeEventsService,
  };
  const tableAttentionService = {
    recalculateForTableSession: jest.fn().mockResolvedValue(undefined),
    ...overrides.tableAttentionService,
  };
  const billsService = {
    createOrGetBillForBillRequest: jest
      .fn()
      .mockResolvedValue({ bill: billSummary() }),
    findForTableSession: jest.fn().mockResolvedValue({
      activeBill: { bill: billSummary() },
      latestBills: [{ bill: billSummary() }],
      receipt: null,
    }),
    presentBillForBillRequest: jest
      .fn()
      .mockResolvedValue({ bill: billSummary({ status: BillStatus.presented }) }),
    ...overrides.billsService,
  };

  return {
    service: new BillRequestsService(
      prisma as never,
      presenceNotificationsService as never,
      realtimeEventsService as never,
      tableAttentionService as never,
      billsService as never,
    ),
    prisma,
    presenceNotificationsService,
    realtimeEventsService,
    tableAttentionService,
    billsService,
  };
}

describe('BillRequestsService', () => {
  it('lets a served table session request a bill and returns the linked bill snapshot', async () => {
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
        findUnique: jest.fn().mockResolvedValue(billRequestRecord()),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([billableOrder()]),
      },
      orderEvent: {
        create: jest.fn().mockResolvedValue({ id: 'order-event-1' }),
      },
    };
    const {
      service,
      billsService,
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = buildService(tx);

    const result = await service.requestBill('session-1');
    await flushAsyncWork();

    expect(tx.billRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tableSessionId: 'session-1',
          subtotalMinor: 12500,
          orderCount: 1,
          currency: 'EGP',
        }),
      }),
    );
    expect(billsService.createOrGetBillForBillRequest).toHaveBeenCalledWith(
      'bill-request-1',
      { actorType: 'customer' },
      tx,
    );
    expect(presenceNotificationsService.createBillRequestedNotification).toHaveBeenCalledWith(
      'bill-request-1',
      prisma,
    );
    expect(realtimeEventsService.recordBillRequested).toHaveBeenCalledWith(
      'bill-request-1',
      prisma,
    );
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalledWith(
      'session-1',
      prisma,
      {
        source: 'bill_requested',
        metadata: { billRequestId: 'bill-request-1' },
      },
    );
    expect(result.billRequest.id).toBe('bill-request-1');
    if (!result.bill) {
      throw new Error('Expected bill request response to include a bill');
    }
    expect(result.bill.id).toBe('bill-1');
    expect(result.bill.totalMinor).toBe(12500);
    expect(result.bill.balanceDueMinor).toBe(12500);
    expect(result.bill.orderCount).toBe(1);
    expect(result.bill.lineCount).toBe(1);
    expect(result.bill.lines[0].modifiersSnapshot).toEqual([
      {
        modifierGroupSlugSnapshot: 'size',
        modifierOptionSlugSnapshot: 'medium',
      },
    ]);
  });

  it('keeps bill request creation successful when post-commit side effects fail', async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
        findUnique: jest.fn().mockResolvedValue(billRequestRecord()),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([billableOrder()]),
      },
      orderEvent: {
        create: jest.fn().mockResolvedValue({ id: 'order-event-1' }),
      },
    };
    const {
      service,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = buildService(tx, {
      presenceNotificationsService: {
        createBillRequestedNotification: jest
          .fn()
          .mockRejectedValue(new Error('notification token=secret failed')),
      },
      realtimeEventsService: {
        recordBillRequested: jest
          .fn()
          .mockRejectedValue(new Error('realtime token=secret failed')),
      },
      tableAttentionService: {
        recalculateForTableSession: jest
          .fn()
          .mockRejectedValue(new Error('attention token=secret failed')),
      },
    });

    const result = await service.requestBill('session-1');
    await flushAsyncWork();

    expect(result.billRequest.id).toBe('bill-request-1');
    expect(presenceNotificationsService.createBillRequestedNotification).toHaveBeenCalled();
    expect(realtimeEventsService.recordBillRequested).toHaveBeenCalled();
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalled();

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls);

    expect(loggedPayload).toContain('presence_notification');
    expect(loggedPayload).toContain('realtime_event');
    expect(loggedPayload).toContain('table_attention');
    expect(loggedPayload).toContain('token=[redacted]');
    expect(loggedPayload).not.toContain('token=secret');
  });

  it('returns activeBillRequest and activeBill for a table session with an open bill', async () => {
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(billRequestRecord()),
        findMany: jest.fn().mockResolvedValue([billRequestRecord()]),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([billableOrder()]),
      },
    };
    const { service } = buildService(tx);

    const result = await service.findForTableSession('session-1');

    expect(result.activeBillRequest?.billRequest.id).toBe('bill-request-1');
    expect(result.activeBill?.bill.id).toBe('bill-1');
    expect(result.latestBillRequests).toHaveLength(1);
    expect(result.latestBills).toHaveLength(1);
  });

  it('presents an open bill request and asks the bills service to present the linked bill', async () => {
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      billRequest: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'bill-request-1',
            tableSessionId: 'session-1',
            status: BillRequestStatus.open,
          })
          .mockResolvedValueOnce(
            billRequestRecord({
              status: BillRequestStatus.presented,
              presentedAt: now,
              presentedByStaffUserId: 'staff-1',
              bill: billSummary({ status: BillStatus.presented }),
            }),
          ),
        update: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      billRequestEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-2' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([billableOrder()]),
      },
    };
    const { service, billsService, realtimeEventsService } = buildService(tx);

    const result = await service.present('bill-request-1', {
      staffUserId: 'staff-1',
    });

    expect(tx.billRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bill-request-1' },
        data: expect.objectContaining({
          status: BillRequestStatus.presented,
          presentedByStaffUserId: 'staff-1',
        }),
      }),
    );
    expect(billsService.presentBillForBillRequest).toHaveBeenCalledWith(
      'bill-request-1',
      'staff-1',
      null,
      tx,
    );
    expect(realtimeEventsService.recordBillPresented).toHaveBeenCalledWith(
      'bill-request-1',
      tx,
    );
    if (!result.bill) {
      throw new Error('Expected presented bill request response to include a bill');
    }
    expect(result.bill.status).toBe(BillStatus.presented);
  });

  it('rejects bill request creation with a clear BadRequest when no billable orders exist', async () => {
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const { service } = buildService(tx);

    await expect(service.requestBill('session-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.billRequest.create).not.toHaveBeenCalled();
  });
});
