import {
  OrderEventType,
  OrderStatus,
  PreparationStation,
  PreparationTaskEventType,
  PreparationTaskStatus,
} from '@prisma/client';
import { PreparationTasksService } from './preparation-tasks.service';

const now = new Date('2026-01-01T00:00:00.000Z');

function taskEnvelope(status: PreparationTaskStatus, orderStatus: OrderStatus) {
  return {
    id: 'task-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    orderId: 'order-1',
    orderItemId: 'order-item-1',
    station: PreparationStation.kitchen,
    status,
    quantity: 1,
    itemNameSnapshot: 'Latte',
    itemSlugSnapshot: 'latte',
    notes: null,
    startedAt: null,
    readyAt: null,
    cancelledAt: null,
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
    order: {
      id: 'order-1',
      companyId: 'company-1',
      branchId: 'branch-1',
      tableSessionId: 'session-1',
      cartId: 'cart-1',
      orderNumber: 'B0001',
      status: orderStatus,
      source: 'customer_qr',
      currency: 'EGP',
      subtotalMinor: 1000,
      totalQuantity: 1,
      itemCount: 1,
      customerNote: null,
      idempotencyKey: null,
      submittedAt: now,
      cashierAcceptedAt: now,
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
    },
    orderItem: {
      id: 'order-item-1',
      orderId: 'order-1',
      menuItemId: 'item-1',
      quantity: 1,
      notes: null,
      itemNameSnapshot: 'Latte',
      itemSlugSnapshot: 'latte',
      basePriceMinorSnapshot: 1000,
      effectiveBasePriceMinorSnapshot: 1000,
      modifiersTotalMinorSnapshot: 0,
      unitPriceMinorSnapshot: 1000,
      lineTotalMinorSnapshot: 1000,
      currency: 'EGP',
      createdAt: now,
      updatedAt: now,
      modifierOptions: [],
    },
    events: [],
  };
}

function taskStatus(
  status: PreparationTaskStatus,
  orderStatus: OrderStatus,
) {
  return {
    id: 'task-1',
    orderId: 'order-1',
    status,
    order: {
      tableSessionId: 'session-1',
      status: orderStatus,
    },
  };
}

function preparationErrorCode(error: unknown) {
  const response =
    typeof (error as { getResponse?: () => unknown }).getResponse === 'function'
      ? (error as { getResponse: () => unknown }).getResponse()
      : undefined;

  return (response as { code?: string } | undefined)?.code;
}

async function expectPreparationCode(
  promise: Promise<unknown>,
  expectedCode: string,
) {
  try {
    await promise;
  } catch (error) {
    expect(preparationErrorCode(error)).toBe(expectedCode);
    return;
  }

  throw new Error(`Expected preparation error ${expectedCode}`);
}

function buildService(input: {
  taskStatusRecord?: ReturnType<typeof taskStatus>;
  taskEnvelopeRecord?: ReturnType<typeof taskEnvelope>;
  orderForReadySync?: Record<string, unknown> | null;
  tasksForOrderCancellation?: { id: string }[];
}) {
  const tx = {
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
    preparationTask: {
      findUnique: jest.fn(({ include }: { include?: unknown }) =>
        Promise.resolve(
          include
            ? input.taskEnvelopeRecord ??
                taskEnvelope(PreparationTaskStatus.preparing, OrderStatus.preparing)
            : input.taskStatusRecord,
        ),
      ),
      findMany: jest
        .fn()
        .mockResolvedValue(input.tasksForOrderCancellation ?? []),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    preparationTaskEvent: {
      create: jest.fn().mockResolvedValue({ id: 'task-event-1' }),
    },
    order: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(input.orderForReadySync ?? null),
    },
    orderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'order-event-1' }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const realtimeEventsService = {
    recordPreparationTaskStarted: jest.fn().mockResolvedValue({}),
    recordPreparationTaskReady: jest.fn().mockResolvedValue({}),
    recordPreparationTaskCancelled: jest.fn().mockResolvedValue({}),
    recordOrderPreparationStarted: jest.fn().mockResolvedValue({}),
    recordOrderPreparationReady: jest.fn().mockResolvedValue({}),
  };
  const kitchenTicketsService = {
    createTicketsForAcceptedOrder: jest.fn().mockResolvedValue([]),
    syncTicketsForTaskStarted: jest.fn().mockResolvedValue(undefined),
    syncTicketsForTaskReady: jest.fn().mockResolvedValue(undefined),
    syncTicketsForTaskCancelled: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PreparationTasksService(
    prisma as never,
    {
      createPreparationStartedNotification: jest.fn().mockResolvedValue({}),
      createPreparationReadyNotification: jest.fn().mockResolvedValue({}),
    } as never,
    realtimeEventsService as never,
    { recalculateForTableSession: jest.fn().mockResolvedValue({}) } as never,
    kitchenTicketsService as never,
  );

  return { service, tx, realtimeEventsService, kitchenTicketsService };
}

function acceptedOrderForCreate(
  station: PreparationStation,
  itemNameSnapshot = 'Espresso',
) {
  return {
    id: 'order-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    status: OrderStatus.cashier_accepted,
    tableSessionId: 'session-1',
    items: [
      {
        id: 'order-item-1',
        quantity: 1,
        notes: null,
        itemNameSnapshot,
        itemSlugSnapshot: itemNameSnapshot.toLowerCase().replace(/\s+/g, '-'),
        menuItem: { station },
      },
    ],
  };
}

function ticketRoutingForCreate(
  station: PreparationStation,
  ticketIds = ['ticket-1'],
) {
  return {
    ticketIds,
    itemCount: 1,
    actionableItemCount: ticketIds.length > 0 ? 1 : 0,
    stationsDetected: ticketIds.length > 0 ? [station] : [],
    skippedItems: [],
    createdTicketCount: ticketIds.length,
    existingTicketCount: 0,
  };
}

function buildCreateTasksService(input: {
  station: PreparationStation;
  itemNameSnapshot?: string;
  existingTask?: boolean;
  ticketIds?: string[];
  ticketRejects?: boolean;
}) {
  const order = acceptedOrderForCreate(
    input.station,
    input.itemNameSnapshot,
  );
  const tx = {
    order: {
      findUnique: jest.fn().mockResolvedValue(order),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    preparationTask: {
      findUnique: jest
        .fn()
        .mockResolvedValue(input.existingTask ? { id: 'task-existing' } : null),
      create: jest.fn().mockResolvedValue({ id: 'task-1' }),
    },
    orderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'order-event-1' }),
    },
  };
  const realtimeEventsService = {
    recordPreparationTaskCreated: jest.fn().mockResolvedValue({}),
    recordPreparationTaskStarted: jest.fn().mockResolvedValue({}),
    recordPreparationTaskReady: jest.fn().mockResolvedValue({}),
    recordPreparationTaskCancelled: jest.fn().mockResolvedValue({}),
    recordOrderPreparationStarted: jest.fn().mockResolvedValue({}),
    recordOrderPreparationReady: jest.fn().mockResolvedValue({}),
  };
  const ticketRouting = ticketRoutingForCreate(
    input.station,
    input.ticketIds,
  );
  const kitchenTicketsService = {
    createTicketsForAcceptedOrder: input.ticketRejects
      ? jest
          .fn()
          .mockRejectedValue(new Error('database token=secret failed'))
      : jest.fn().mockResolvedValue(ticketRouting),
    syncTicketsForTaskStarted: jest.fn().mockResolvedValue(undefined),
    syncTicketsForTaskReady: jest.fn().mockResolvedValue(undefined),
    syncTicketsForTaskCancelled: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PreparationTasksService(
    {} as never,
    {
      createPreparationStartedNotification: jest.fn().mockResolvedValue({}),
      createPreparationReadyNotification: jest.fn().mockResolvedValue({}),
    } as never,
    realtimeEventsService as never,
    { recalculateForTableSession: jest.fn().mockResolvedValue({}) } as never,
    kitchenTicketsService as never,
  );

  return { service, tx, realtimeEventsService, kitchenTicketsService };
}

describe('PreparationTasksService accepted-order KDS routing', () => {
  it.each([
    ['Espresso', PreparationStation.barista],
    ['Spanish Latte', PreparationStation.barista],
    ['Avocado Toast', PreparationStation.kitchen],
    ['Chocolate Cake', PreparationStation.dessert],
  ])('routes accepted %s items to %s KDS tasks and tickets', async (name, station) => {
    const { service, tx, realtimeEventsService, kitchenTicketsService } =
      buildCreateTasksService({
        station,
        itemNameSnapshot: name,
      });

    const result = await service.createTasksForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
    );

    expect(tx.preparationTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderItemId: 'order-item-1',
        station,
        itemNameSnapshot: name,
      }),
      select: { id: true },
    });
    expect(
      realtimeEventsService.recordPreparationTaskCreated,
    ).toHaveBeenCalledWith('task-1', tx);
    expect(
      kitchenTicketsService.createTicketsForAcceptedOrder,
    ).toHaveBeenCalledWith('order-1', 'staff-1', tx, {
      createPrintJobs: undefined,
      recordRealtimeEvents: undefined,
    });
    expect(result).toMatchObject({
      actionableItemCount: 1,
      stationsDetected: [station],
      createdTaskCount: 1,
      activeTaskCount: 1,
      ticketRouting: expect.objectContaining({
        ticketIds: ['ticket-1'],
        createdTicketCount: 1,
      }),
    });
  });

  it('does not duplicate preparation tasks when repairing an accepted order', async () => {
    const { service, tx } = buildCreateTasksService({
      station: PreparationStation.barista,
      existingTask: true,
    });

    const result = await service.createTasksForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
    );

    expect(tx.preparationTask.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      existingTaskCount: 1,
      activeTaskCount: 1,
    });
  });

  it('rejects accepted actionable orders that would create zero KDS tickets', async () => {
    const { service, tx } = buildCreateTasksService({
      station: PreparationStation.barista,
      ticketIds: [],
    });

    await expect(
      service.createTasksForAcceptedOrder('order-1', 'staff-1', tx as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Kitchen routing failed for accepted order',
        code: 'kds_routing_failed',
      }),
    });
  });

  it('returns safe stage details when ticket creation throws unexpectedly', async () => {
    const { service, tx } = buildCreateTasksService({
      station: PreparationStation.barista,
      ticketRejects: true,
    });

    await expect(
      service.createTasksForAcceptedOrder('order-1', 'staff-1', tx as never),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: 'Kitchen routing failed for accepted order',
        code: 'kds_routing_failed',
        details: expect.objectContaining({
          reason: 'ticket_creation_exception',
          actionableItemCount: 1,
          createdTaskCount: 1,
          activeTaskCount: 1,
          ticketCount: 0,
          exception: expect.objectContaining({
            message: 'database token=[redacted] failed',
          }),
        }),
      }),
    });
  });
});

describe('PreparationTasksService lifecycle hardening', () => {
  it('cannot start a task when the parent order is cancelled', async () => {
    const { service } = buildService({
      taskStatusRecord: taskStatus(
        PreparationTaskStatus.pending,
        OrderStatus.cancelled,
      ),
    });

    await expectPreparationCode(
      service.start('task-1', { staffUserId: 'staff-1' }),
      'order_cancelled',
    );
  });

  it('starting the first task syncs an accepted order to preparing', async () => {
    const { service, tx, realtimeEventsService } = buildService({
      taskStatusRecord: taskStatus(
        PreparationTaskStatus.pending,
        OrderStatus.cashier_accepted,
      ),
      taskEnvelopeRecord: taskEnvelope(
        PreparationTaskStatus.preparing,
        OrderStatus.preparing,
      ),
    });

    await service.start('task-1', { staffUserId: 'staff-1' });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: { id: 'order-1', status: OrderStatus.cashier_accepted },
      data: expect.objectContaining({ status: OrderStatus.preparing }),
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: OrderEventType.preparation_started,
        metadata: expect.objectContaining({
          previousStatus: OrderStatus.cashier_accepted,
          nextStatus: OrderStatus.preparing,
          action: 'start_preparation',
        }),
      }),
    });
    expect(
      realtimeEventsService.recordOrderPreparationStarted,
    ).toHaveBeenCalledWith('order-1', tx);
  });

  it('marking the last active task ready syncs the order to ready', async () => {
    const { service, tx, realtimeEventsService } = buildService({
      taskStatusRecord: taskStatus(
        PreparationTaskStatus.preparing,
        OrderStatus.preparing,
      ),
      taskEnvelopeRecord: taskEnvelope(
        PreparationTaskStatus.ready,
        OrderStatus.ready,
      ),
      orderForReadySync: {
        id: 'order-1',
        status: OrderStatus.preparing,
        preparationTasks: [{ id: 'task-1', status: PreparationTaskStatus.ready }],
      },
    });

    await service.markReady('task-1', { staffUserId: 'staff-1' });

    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        status: { in: [OrderStatus.cashier_accepted, OrderStatus.preparing] },
      },
      data: expect.objectContaining({ status: OrderStatus.ready }),
    });
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: OrderEventType.preparation_ready,
        metadata: expect.objectContaining({
          previousStatus: OrderStatus.preparing,
          nextStatus: OrderStatus.ready,
          action: 'system_preparation_ready',
        }),
      }),
    });
    expect(realtimeEventsService.recordOrderPreparationReady).toHaveBeenCalledWith(
      'order-1',
      tx,
    );
  });

  it('order cancellation cancels only pending and preparing tasks', async () => {
    const { service, tx, realtimeEventsService } = buildService({
      tasksForOrderCancellation: [{ id: 'task-1' }, { id: 'task-2' }],
    });

    await service.cancelActiveTasksForOrderCancellation(
      'order-1',
      'staff-1',
      'Customer left',
      tx as never,
    );

    expect(tx.preparationTask.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.preparationTaskEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        preparationTaskId: 'task-1',
        type: PreparationTaskEventType.cancelled,
        actorStaffUserId: 'staff-1',
        metadata: expect.objectContaining({
          source: 'order_cancellation',
          reason: 'Customer left',
        }),
      }),
    });
    expect(
      realtimeEventsService.recordPreparationTaskCancelled,
    ).toHaveBeenCalledWith('task-1', tx);
  });
});
