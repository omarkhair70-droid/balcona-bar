import { BadRequestException, Logger } from '@nestjs/common';
import {
  BillRequestActorType,
  BillRequestStatus,
  BillStatus,
  OrderEventActorType,
  OrderEventType,
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
    ...overrides.prisma,
  };
  const presenceNotificationsService = {
    createBillRequestedNotification: jest.fn().mockResolvedValue(undefined),
    createBillPresentedNotification: jest.fn().mockResolvedValue(undefined),
    ...overrides.presenceNotificationsService,
  };
  const realtimeEventsService = {
    recordBillCreated: jest.fn().mockResolvedValue(undefined),
    recordBillRequested: jest.fn().mockResolvedValue(undefined),
    recordBillAcknowledged: jest.fn().mockResolvedValue(undefined),
    recordBillPresented: jest.fn().mockResolvedValue(undefined),
    recordBillPresentedForBill: jest.fn().mockResolvedValue(undefined),
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
    createOrGetBillForBillRequestCompact: jest.fn().mockResolvedValue({
      billId: 'bill-1',
      billRequestId: 'bill-request-1',
      tableSessionId: 'session-1',
      created: true,
    }),
    findForTableSession: jest.fn().mockResolvedValue({
      activeBill: { bill: billSummary() },
      latestBills: [{ bill: billSummary() }],
      receipt: null,
    }),
    presentBillForBillRequest: jest
      .fn()
      .mockResolvedValue({ bill: billSummary({ status: BillStatus.presented }) }),
    presentBillForBillRequestCompact: jest.fn().mockResolvedValue({
      billId: 'bill-1',
      billRequestId: 'bill-request-1',
      tableSessionId: 'session-1',
      created: false,
      status: BillStatus.presented,
      presented: true,
    }),
    ensureBillForBillRequestCompact: jest.fn().mockResolvedValue({
      billId: 'bill-1',
      billRequestId: 'bill-request-1',
      tableSessionId: 'session-1',
      created: true,
    }),
    presentExistingBillCompact: jest.fn().mockResolvedValue({
      billId: 'bill-1',
      billRequestId: 'bill-request-1',
      tableSessionId: 'session-1',
      created: true,
      status: BillStatus.presented,
      presented: true,
    }),
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
  it('lets a served table session request a bill without creating the bill in the customer transaction', async () => {
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
        findUnique: jest.fn().mockResolvedValue(billRequestRecord({ bill: null })),
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
    expect(billsService.createOrGetBillForBillRequestCompact).not.toHaveBeenCalled();
    expect(billsService.createOrGetBillForBillRequest).not.toHaveBeenCalled();
    expect(realtimeEventsService.recordBillCreated).not.toHaveBeenCalled();
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        type: OrderEventType.bill_requested,
        actorType: OrderEventActorType.customer,
        metadata: {
          billRequestId: 'bill-request-1',
          tableSessionId: 'session-1',
        },
      },
    });
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
    expect(result.bill).toBeNull();
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
        findUnique: jest.fn().mockResolvedValue(billRequestRecord({ bill: null })),
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
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = buildService(tx, {
      prisma: {
        orderEvent: {
          create: jest
            .fn()
            .mockRejectedValue(new Error('order event token=secret failed')),
        },
      },
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
    expect(prisma.orderEvent.create).toHaveBeenCalled();
    expect(presenceNotificationsService.createBillRequestedNotification).toHaveBeenCalled();
    expect(realtimeEventsService.recordBillRequested).toHaveBeenCalled();
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalled();

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls);

    expect(loggedPayload).toContain('order_events');
    expect(loggedPayload).toContain('presence_notification');
    expect(loggedPayload).toContain('realtime_event');
    expect(loggedPayload).toContain('table_attention');
    expect(loggedPayload).toContain('token=[redacted]');
    expect(loggedPayload).not.toContain('token=secret');
  });

  it('hydrates request bill response after commit and does not create a bill inside the transaction', async () => {
    let inTransaction = false;
    const createOrGetBillForBillRequestCompact = jest.fn();
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([billableOrder()]),
      },
      orderEvent: {
        create: jest.fn(() => {
          throw new Error('order events should run after commit');
        }),
      },
    };
    const responseFindUnique = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return billRequestRecord({ bill: null });
    });
    const responseFindMany = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return [billableOrder()];
    });
    const postCommitOrderEventCreate = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return { id: 'order-event-1' };
    });
    const { service } = buildService(tx, {
      prisma: {
        $transaction: jest.fn(async (callback) => {
          inTransaction = true;

          try {
            return await callback(tx);
          } finally {
            inTransaction = false;
          }
        }),
        billRequest: {
          findUnique: responseFindUnique,
        },
        order: {
          findMany: responseFindMany,
        },
        orderEvent: {
          create: postCommitOrderEventCreate,
        },
      },
      billsService: {
        createOrGetBillForBillRequestCompact,
      },
    });

    const result = await service.requestBill('session-1');
    await flushAsyncWork();

    expect(result.billRequest.id).toBe('bill-request-1');
    expect(result.bill).toBeNull();
    expect(createOrGetBillForBillRequestCompact).not.toHaveBeenCalled();
    expect(responseFindUnique).toHaveBeenCalled();
    expect(responseFindMany).toHaveBeenCalled();
    expect(postCommitOrderEventCreate).toHaveBeenCalled();
    expect(tx.orderEvent.create).not.toHaveBeenCalled();
  });

  it('maps request bill transaction timeouts with safe stage details', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const tx = {
      tableSession: {
        findUnique: jest.fn().mockResolvedValue(tableSession()),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      order: {
        findMany: jest.fn().mockRejectedValue(
          Object.assign(new Error('Transaction already closed token=secret'), {
            code: 'P2028',
          }),
        ),
      },
    };
    const { service } = buildService(tx);
    let caught: { getResponse?: () => unknown } | undefined;

    try {
      await service.requestBill('session-1');
    } catch (error) {
      caught = error as { getResponse?: () => unknown };
    }

    if (!caught?.getResponse) {
      throw new Error('Expected request bill timeout to return an HttpException');
    }

    expect(caught.getResponse()).toMatchObject({
      code: 'DB_TRANSACTION_TIMEOUT',
      details: {
        flow: 'bill_request',
        action: 'request_bill',
        sessionId: 'session-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        failureStage: 'billable_orders_lookup',
        exception: {
          code: 'P2028',
          message: 'Transaction already closed token=[redacted]',
        },
      },
    });
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

  it('keeps bill acknowledge successful when post-commit side effects fail', async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
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
              status: BillRequestStatus.acknowledged,
              acknowledgedAt: now,
              acknowledgedByStaffUserId: 'staff-1',
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
    const { service, realtimeEventsService, tableAttentionService } =
      buildService(tx, {
        realtimeEventsService: {
          recordBillAcknowledged: jest
            .fn()
            .mockRejectedValue(new Error('realtime token=secret failed')),
        },
        tableAttentionService: {
          recalculateForTableSession: jest
            .fn()
            .mockRejectedValue(new Error('attention token=secret failed')),
        },
      });

    const result = await service.acknowledge('bill-request-1', {
      staffUserId: 'staff-1',
    });
    await flushAsyncWork();

    expect(result.billRequest.status).toBe(BillRequestStatus.acknowledged);
    expect(realtimeEventsService.recordBillAcknowledged).toHaveBeenCalled();
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalled();

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls);

    expect(loggedPayload).toContain('realtime_event');
    expect(loggedPayload).toContain('table_attention');
    expect(loggedPayload).toContain('token=[redacted]');
    expect(loggedPayload).not.toContain('token=secret');
  });

  it('hydrates bill acknowledge response after the transaction commits', async () => {
    let inTransaction = false;
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      billRequest: {
        findUnique: jest.fn(async () => {
          expect(inTransaction).toBe(true);

          return {
            id: 'bill-request-1',
            tableSessionId: 'session-1',
            status: BillRequestStatus.open,
          };
        }),
        update: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      billRequestEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-2' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const responseFindUnique = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return billRequestRecord({
        status: BillRequestStatus.acknowledged,
        acknowledgedAt: now,
        acknowledgedByStaffUserId: 'staff-1',
      });
    });
    const responseFindMany = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return [billableOrder()];
    });
    const { service } = buildService(tx, {
      prisma: {
        $transaction: jest.fn(async (callback) => {
          inTransaction = true;

          try {
            return await callback(tx);
          } finally {
            inTransaction = false;
          }
        }),
        billRequest: {
          findUnique: responseFindUnique,
        },
        order: {
          findMany: responseFindMany,
        },
      },
    });

    const result = await service.acknowledge('bill-request-1', {
      staffUserId: 'staff-1',
    });
    await flushAsyncWork();

    expect(responseFindUnique).toHaveBeenCalled();
    expect(responseFindMany).toHaveBeenCalled();
    expect(result.billRequest.status).toBe(BillRequestStatus.acknowledged);
  });

  it('presents an open bill request after ensuring a missing bill first', async () => {
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
    const {
      service,
      billsService,
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = buildService(tx);

    const result = await service.present('bill-request-1', {
      staffUserId: 'staff-1',
    });
    await flushAsyncWork();

    expect(tx.billRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bill-request-1' },
        data: expect.objectContaining({
          status: BillRequestStatus.presented,
          presentedByStaffUserId: 'staff-1',
        }),
      }),
    );
    expect(billsService.ensureBillForBillRequestCompact).toHaveBeenCalledWith(
      'bill-request-1',
      { actorType: 'staff' },
    );
    expect(billsService.presentExistingBillCompact).toHaveBeenCalledWith(
      'bill-1',
      {
        staffUserId: 'staff-1',
        note: undefined,
        billCreated: true,
        billRequestId: 'bill-request-1',
      },
      tx,
    );
    expect(billsService.presentBillForBillRequestCompact).not.toHaveBeenCalled();
    expect(billsService.presentBillForBillRequest).not.toHaveBeenCalled();
    expect(realtimeEventsService.recordBillCreated).toHaveBeenCalledWith(
      'bill-1',
      prisma,
    );
    expect(realtimeEventsService.recordBillPresentedForBill).toHaveBeenCalledWith(
      'bill-1',
      prisma,
    );
    expect(presenceNotificationsService.createBillPresentedNotification).toHaveBeenCalledWith(
      'bill-request-1',
      prisma,
    );
    expect(realtimeEventsService.recordBillPresented).toHaveBeenCalledWith(
      'bill-request-1',
      prisma,
    );
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalledWith(
      'session-1',
      prisma,
      {
        source: 'bill_presented',
        metadata: { billRequestId: 'bill-request-1' },
      },
    );
    if (!result.bill) {
      throw new Error('Expected presented bill request response to include a bill');
    }
    expect(result.bill.status).toBe(BillStatus.presented);
  });

  it('reuses an existing bill when presenting a bill request', async () => {
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
            status: BillRequestStatus.acknowledged,
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
    const { service, billsService, realtimeEventsService } = buildService(tx, {
      billsService: {
        ensureBillForBillRequestCompact: jest.fn().mockResolvedValue({
          billId: 'bill-existing',
          billRequestId: 'bill-request-1',
          tableSessionId: 'session-1',
          created: false,
        }),
        presentExistingBillCompact: jest.fn().mockResolvedValue({
          billId: 'bill-existing',
          billRequestId: 'bill-request-1',
          tableSessionId: 'session-1',
          created: false,
          status: BillStatus.presented,
          presented: true,
        }),
      },
    });

    const result = await service.present('bill-request-1', {
      staffUserId: 'staff-1',
      note: 'At the table',
    });
    await flushAsyncWork();

    expect(billsService.ensureBillForBillRequestCompact).toHaveBeenCalledWith(
      'bill-request-1',
      { actorType: 'staff' },
    );
    expect(billsService.presentExistingBillCompact).toHaveBeenCalledWith(
      'bill-existing',
      {
        staffUserId: 'staff-1',
        note: 'At the table',
        billCreated: false,
        billRequestId: 'bill-request-1',
      },
      tx,
    );
    expect(realtimeEventsService.recordBillCreated).not.toHaveBeenCalled();
    expect(result.bill?.status).toBe(BillStatus.presented);
  });

  it('keeps bill present successful when post-commit side effects fail', async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
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
            status: BillRequestStatus.acknowledged,
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
    const {
      service,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = buildService(tx, {
      presenceNotificationsService: {
        createBillPresentedNotification: jest
          .fn()
          .mockRejectedValue(new Error('notification token=secret failed')),
      },
      realtimeEventsService: {
        recordBillCreated: jest
          .fn()
          .mockRejectedValue(new Error('bill created realtime token=secret failed')),
        recordBillPresentedForBill: jest
          .fn()
          .mockRejectedValue(new Error('bill realtime token=secret failed')),
        recordBillPresented: jest
          .fn()
          .mockRejectedValue(new Error('realtime token=secret failed')),
      },
      tableAttentionService: {
        recalculateForTableSession: jest
          .fn()
          .mockRejectedValue(new Error('attention token=secret failed')),
      },
    });

    const result = await service.present('bill-request-1', {
      staffUserId: 'staff-1',
    });
    await flushAsyncWork();

    expect(result.billRequest.status).toBe(BillRequestStatus.presented);
    expect(presenceNotificationsService.createBillPresentedNotification).toHaveBeenCalled();
    expect(realtimeEventsService.recordBillCreated).toHaveBeenCalled();
    expect(realtimeEventsService.recordBillPresentedForBill).toHaveBeenCalled();
    expect(realtimeEventsService.recordBillPresented).toHaveBeenCalled();
    expect(tableAttentionService.recalculateForTableSession).toHaveBeenCalled();

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls);

    expect(loggedPayload).toContain('bill_created_realtime');
    expect(loggedPayload).toContain('bill_realtime_event');
    expect(loggedPayload).toContain('presence_notification');
    expect(loggedPayload).toContain('realtime_event');
    expect(loggedPayload).toContain('table_attention');
    expect(loggedPayload).toContain('token=[redacted]');
    expect(loggedPayload).not.toContain('token=secret');
  });

  it('hydrates bill present response after the transaction commits', async () => {
    let inTransaction = false;
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      billRequest: {
        findUnique: jest.fn(async () => {
          expect(inTransaction).toBe(true);

          return {
            id: 'bill-request-1',
            tableSessionId: 'session-1',
            status: BillRequestStatus.acknowledged,
          };
        }),
        update: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      billRequestEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-2' }),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const responseFindUnique = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return billRequestRecord({
        status: BillRequestStatus.presented,
        presentedAt: now,
        presentedByStaffUserId: 'staff-1',
        bill: billSummary({ status: BillStatus.presented }),
      });
    });
    const responseFindMany = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return [billableOrder()];
    });
    const ensureBillForBillRequestCompact = jest.fn(async () => {
      expect(inTransaction).toBe(false);

      return {
        billId: 'bill-1',
        billRequestId: 'bill-request-1',
        tableSessionId: 'session-1',
        created: false,
      };
    });
    const presentExistingBillCompact = jest.fn(async () => {
      expect(inTransaction).toBe(true);

      return {
        billId: 'bill-1',
        billRequestId: 'bill-request-1',
        tableSessionId: 'session-1',
        created: false,
        status: BillStatus.presented,
        presented: true,
      };
    });
    const { service } = buildService(tx, {
      prisma: {
        $transaction: jest.fn(async (callback) => {
          inTransaction = true;

          try {
            return await callback(tx);
          } finally {
            inTransaction = false;
          }
        }),
        billRequest: {
          findUnique: responseFindUnique,
        },
        order: {
          findMany: responseFindMany,
        },
      },
      billsService: {
        ensureBillForBillRequestCompact,
        presentExistingBillCompact,
      },
    });

    const result = await service.present('bill-request-1', {
      staffUserId: 'staff-1',
    });
    await flushAsyncWork();

    expect(responseFindUnique).toHaveBeenCalled();
    expect(responseFindMany).toHaveBeenCalled();
    expect(ensureBillForBillRequestCompact).toHaveBeenCalled();
    expect(presentExistingBillCompact).toHaveBeenCalled();
    expect(result.bill?.status).toBe(BillStatus.presented);
  });

  it('maps staff bill present transaction timeouts with safe stage details', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const tx = {
      staffUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      billRequest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'bill-request-1',
          tableSessionId: 'session-1',
          status: BillRequestStatus.acknowledged,
        }),
        update: jest.fn().mockResolvedValue({ id: 'bill-request-1' }),
      },
      billRequestEvent: {
        create: jest.fn().mockResolvedValue({ id: 'event-2' }),
      },
    };
    const { service } = buildService(tx, {
      billsService: {
        ensureBillForBillRequestCompact: jest.fn().mockResolvedValue({
          billId: 'bill-1',
          billRequestId: 'bill-request-1',
          tableSessionId: 'session-1',
          created: false,
        }),
        presentExistingBillCompact: jest.fn().mockRejectedValue(
          Object.assign(new Error('Transaction already closed token=secret'), {
            code: 'P2028',
          }),
        ),
      },
    });
    let caught: { getResponse?: () => unknown } | undefined;

    try {
      await service.present('bill-request-1', { staffUserId: 'staff-1' });
    } catch (error) {
      caught = error as { getResponse?: () => unknown };
    }

    if (!caught?.getResponse) {
      throw new Error('Expected bill present timeout to return an HttpException');
    }

    expect(caught.getResponse()).toMatchObject({
      code: 'DB_TRANSACTION_TIMEOUT',
      details: {
        flow: 'bill_request_present',
        action: 'present',
        billRequestId: 'bill-request-1',
        billId: 'bill-1',
        tableSessionId: 'session-1',
        failureStage: 'bill_present',
        exception: {
          code: 'P2028',
          message: 'Transaction already closed token=[redacted]',
        },
      },
    });
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
