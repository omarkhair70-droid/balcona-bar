import { OrderEventActorType, OrderEventType, OrderSource, OrderStatus, PreparationTaskStatus } from '@prisma/client';
import { OrdersService } from './orders.service';

const now = new Date('2026-01-01T00:00:00.000Z');

function orderResponse(status: OrderStatus) {
  return {
    id: 'order-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableSessionId: 'session-1',
    cartId: 'cart-1',
    orderNumber: 'B0001',
    status,
    source: OrderSource.customer_qr,
    currency: 'EGP',
    subtotalMinor: 1000,
    totalQuantity: 1,
    itemCount: 1,
    customerNote: null,
    idempotencyKey: null,
    submittedAt: now,
    cashierAcceptedAt: null,
    cashierRejectedAt: null,
    rejectionReason: null,
    preparingAt: null,
    readyAt: null,
    servedAt: null,
    completedAt: null,
    servedByStaffUserId: null,
    completedByStaffUserId: null,
    completionNote: null,
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
        displayName: 'T01',
        capacity: 2,
        qrToken: 'balcona-main-t01',
        status: 'active',
        floor: { id: 'floor-1', name: 'Main', sortOrder: 1 },
      },
    },
    items: [],
    events: [],
    preparationTasks: [],
  };
}

function lifecycleErrorCode(error: unknown) {
  const response =
    typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
      ? (error as { getResponse: () => unknown }).getResponse()
      : undefined;

  return (response as { code?: string } | undefined)?.code;
}

async function expectLifecycleCode(
  promise: Promise<unknown>,
  expectedCode: string,
) {
  try {
    await promise;
  } catch (error) {
    expect(lifecycleErrorCode(error)).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected lifecycle error ${expectedCode}`);
}

function buildService(input: {
  transitionOrder: {
    status: OrderStatus;
    preparationTasks?: { id: string; status: PreparationTaskStatus }[];
  } | null;
  responseStatus?: OrderStatus;
}) {
  const tx = {
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    order: {
      findUnique: jest.fn(({ include }: { include?: unknown }) =>
        Promise.resolve(
          include
            ? orderResponse(input.responseStatus ?? input.transitionOrder?.status ?? OrderStatus.submitted)
            : input.transitionOrder
              ? {
                  id: 'order-1',
                  tableSessionId: 'session-1',
                  status: input.transitionOrder.status,
                  preparationTasks: input.transitionOrder.preparationTasks ?? [],
                }
              : null,
        ),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const preparationTasksService = {
    createTasksForAcceptedOrder: jest.fn().mockResolvedValue(undefined),
    cancelActiveTasksForOrderCancellation: jest.fn().mockResolvedValue(['task-1']),
  };
  const presenceNotificationsService = {
    createOrderAcceptedNotification: jest.fn().mockResolvedValue({}),
    createOrderRejectedNotification: jest.fn().mockResolvedValue({}),
    createOrderServedNotification: jest.fn().mockResolvedValue({}),
  };
  const realtimeEventsService = {
    recordOrderAccepted: jest.fn().mockResolvedValue({}),
    recordOrderRejected: jest.fn().mockResolvedValue({}),
    recordOrderServed: jest.fn().mockResolvedValue({}),
    recordOrderCompleted: jest.fn().mockResolvedValue({}),
    recordOrderCancelled: jest.fn().mockResolvedValue({}),
  };
  const kitchenTicketsService = {
    syncTicketsForOrderServed: jest.fn().mockResolvedValue(1),
    syncTicketsForOrderCancelled: jest.fn().mockResolvedValue(1),
  };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    preparationTasksService as never,
    presenceNotificationsService as never,
    realtimeEventsService as never,
    {} as never,
    { recalculateForTableSession: jest.fn().mockResolvedValue({}) } as never,
    kitchenTicketsService as never,
  );

  return {
    service,
    tx,
    preparationTasksService,
    realtimeEventsService,
    kitchenTicketsService,
  };
}

describe('OrdersService lifecycle hardening', () => {
  it('denies completion before the order is served', async () => {
    const { service } = buildService({
      transitionOrder: { status: OrderStatus.ready },
    });

    await expectLifecycleCode(
      service.complete('order-1', {}, 'staff-1'),
      'order_not_served',
    );
  });

  it('denies serving while active preparation tasks are pending', async () => {
    const { service } = buildService({
      transitionOrder: {
        status: OrderStatus.preparing,
        preparationTasks: [{ id: 'task-1', status: PreparationTaskStatus.pending }],
      },
    });

    await expectLifecycleCode(
      service.serve('order-1', {}, 'staff-1'),
      'order_has_pending_preparation_tasks',
    );
  });

  it('serves ready orders and records transition metadata', async () => {
    const { service, tx, realtimeEventsService } = buildService({
      transitionOrder: {
        status: OrderStatus.ready,
        preparationTasks: [{ id: 'task-1', status: PreparationTaskStatus.ready }],
      },
      responseStatus: OrderStatus.served,
    });

    await service.serve('order-1', { note: 'Delivered' }, 'staff-1');

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.served,
          servedByStaffUserId: 'staff-1',
        }),
      }),
    );
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: OrderEventType.served,
        actorType: OrderEventActorType.staff,
        actorStaffUserId: 'staff-1',
        metadata: expect.objectContaining({
          previousStatus: OrderStatus.ready,
          nextStatus: OrderStatus.served,
          action: 'serve',
          source: 'waiter',
          note: 'Delivered',
        }),
      }),
    });
    expect(realtimeEventsService.recordOrderServed).toHaveBeenCalledWith(
      'order-1',
      tx,
    );
  });

  it('requires a cancellation reason', async () => {
    const { service } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
    });

    await expectLifecycleCode(
      service.cancel('order-1', {}, 'staff-1'),
      'cancellation_requires_reason',
    );
  });

  it('cancels active preparation tasks and records a cancellation event', async () => {
    const {
      service,
      tx,
      preparationTasksService,
      realtimeEventsService,
    } = buildService({
      transitionOrder: {
        status: OrderStatus.preparing,
        preparationTasks: [
          { id: 'task-1', status: PreparationTaskStatus.preparing },
        ],
      },
      responseStatus: OrderStatus.cancelled,
    });

    await service.cancel(
      'order-1',
      { reason: 'Customer changed plans' },
      'staff-1',
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: OrderStatus.cancelled },
      }),
    );
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: OrderEventType.cancelled,
        metadata: expect.objectContaining({
          previousStatus: OrderStatus.preparing,
          nextStatus: OrderStatus.cancelled,
          action: 'cancel',
          reason: 'Customer changed plans',
        }),
      }),
    });
    expect(
      preparationTasksService.cancelActiveTasksForOrderCancellation,
    ).toHaveBeenCalledWith(
      'order-1',
      'staff-1',
      'Customer changed plans',
      tx,
    );
    expect(realtimeEventsService.recordOrderCancelled).toHaveBeenCalledWith(
      'order-1',
      tx,
    );
  });
});
