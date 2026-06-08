import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  updateCount?: number;
  inventoryRejects?: boolean;
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
      updateMany: jest.fn().mockResolvedValue({ count: input.updateCount ?? 1 }),
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
  const inventoryService = {
    consumeStockForAcceptedOrder: input.inventoryRejects
      ? jest.fn().mockRejectedValue(new Error('Item is out of stock'))
      : jest.fn().mockResolvedValue({ consumed: true, movements: [] }),
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
    inventoryService as never,
  );

  return {
    service,
    tx,
    preparationTasksService,
    realtimeEventsService,
    kitchenTicketsService,
    inventoryService,
  };
}

const submitSession = {
  id: 'session-1',
  companyId: 'company-1',
  branchId: 'branch-1',
};

const submitCart = {
  id: 'cart-1',
  currency: 'EGP',
  items: [
    {
      id: 'cart-item-1',
      menuItemId: 'spanish-latte',
      quantity: 1,
      notes: null,
      itemNameSnapshot: 'Spanish Latte',
      itemSlugSnapshot: 'spanish-latte',
      basePriceMinorSnapshot: 11500,
      effectiveBasePriceMinorSnapshot: 11500,
      modifiersTotalMinorSnapshot: 0,
      unitPriceMinorSnapshot: 11500,
      lineTotalMinorSnapshot: 11500,
      currency: 'EGP',
      modifierOptions: [
        {
          modifierGroupId: 'size',
          modifierOptionId: 'small',
          modifierGroupNameSnapshot: 'Size',
          modifierGroupSlugSnapshot: 'size',
          modifierOptionNameSnapshot: 'Small',
          modifierOptionSlugSnapshot: 'small',
          priceDeltaMinorSnapshot: 0,
        },
        {
          modifierGroupId: 'temperature',
          modifierOptionId: 'iced',
          modifierGroupNameSnapshot: 'Temperature',
          modifierGroupSlugSnapshot: 'temperature',
          modifierOptionNameSnapshot: 'Iced',
          modifierOptionSlugSnapshot: 'iced',
          priceDeltaMinorSnapshot: 0,
        },
      ],
    },
  ],
};

function buildSubmitService(input: {
  existingOrder?: ReturnType<typeof orderResponse> | null;
  cartValidationError?: Error;
  smartCashierRejects?: boolean;
  responseStatus?: OrderStatus;
} = {}) {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(0),
    order: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn((args: any) => {
        if (args.where?.tableSessionId_idempotencyKey) {
          return Promise.resolve(input.existingOrder ?? null);
        }

        return Promise.resolve(null);
      }),
      create: jest.fn().mockResolvedValue({ id: 'order-1' }),
    },
    cart: {
      update: jest.fn().mockResolvedValue({ id: 'cart-1' }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    order: {
      findUnique: jest.fn().mockResolvedValue(
        orderResponse(input.responseStatus ?? OrderStatus.submitted),
      ),
    },
  };
  const cartService = {
    getValidatedDraftCartForSubmit: input.cartValidationError
      ? jest.fn().mockRejectedValue(input.cartValidationError)
      : jest.fn().mockResolvedValue({
          session: submitSession,
          cart: submitCart,
          totals: {
            subtotalMinor: 11500,
            totalQuantity: 1,
            itemCount: 1,
          },
        }),
  };
  const preparationTasksService = {
    createTasksForAcceptedOrder: jest.fn().mockResolvedValue(undefined),
    cancelActiveTasksForOrderCancellation: jest.fn().mockResolvedValue([]),
  };
  const presenceNotificationsService = {
    createOrderSubmittedNotification: jest.fn().mockResolvedValue({}),
    createOrderAcceptedNotification: jest.fn().mockResolvedValue({}),
    createOrderRejectedNotification: jest.fn().mockResolvedValue({}),
    createOrderServedNotification: jest.fn().mockResolvedValue({}),
  };
  const realtimeEventsService = {
    recordOrderSubmitted: jest.fn().mockResolvedValue({}),
    recordOrderAccepted: jest.fn().mockResolvedValue({}),
    recordOrderRejected: jest.fn().mockResolvedValue({}),
    recordOrderServed: jest.fn().mockResolvedValue({}),
    recordOrderCompleted: jest.fn().mockResolvedValue({}),
    recordOrderCancelled: jest.fn().mockResolvedValue({}),
  };
  const smartCashierService = {
    attemptAutoAcceptOrder: input.smartCashierRejects
      ? jest.fn().mockRejectedValue(new Error('Printer timeout token=secret'))
      : jest.fn().mockResolvedValue({ autoAccepted: false, stored: true }),
  };
  const tableAttentionService = {
    recalculateForTableSession: jest.fn().mockResolvedValue({}),
  };
  const kitchenTicketsService = {
    syncTicketsForOrderServed: jest.fn().mockResolvedValue(1),
    syncTicketsForOrderCancelled: jest.fn().mockResolvedValue(1),
  };
  const inventoryService = {
    consumeStockForAcceptedOrder: jest.fn().mockResolvedValue({
      consumed: true,
      movements: [],
    }),
  };
  const service = new OrdersService(
    prisma as never,
    cartService as never,
    preparationTasksService as never,
    presenceNotificationsService as never,
    realtimeEventsService as never,
    smartCashierService as never,
    tableAttentionService as never,
    kitchenTicketsService as never,
    inventoryService as never,
  );

  return {
    service,
    tx,
    prisma,
    cartService,
    presenceNotificationsService,
    realtimeEventsService,
    smartCashierService,
    tableAttentionService,
  };
}

describe('OrdersService submit cart', () => {
  it('submits a cart with modifiers and customer note', async () => {
    const {
      service,
      tx,
      presenceNotificationsService,
      realtimeEventsService,
      smartCashierService,
    } = buildSubmitService();

    const result = await service.submitCart(
      'session-1',
      { customerNote: '  Please make it iced  ' },
      'submit-key-1',
      'request-1',
    );

    expect(result.order.status).toBe(OrderStatus.submitted);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerNote: 'Please make it iced',
          idempotencyKey: 'submit-key-1',
          items: {
            create: [
              expect.objectContaining({
                menuItemId: 'spanish-latte',
                quantity: 1,
                modifierOptions: {
                  create: [
                    expect.objectContaining({
                      modifierGroupId: 'size',
                      modifierOptionId: 'small',
                    }),
                    expect.objectContaining({
                      modifierGroupId: 'temperature',
                      modifierOptionId: 'iced',
                    }),
                  ],
                },
              }),
            ],
          },
        }),
      }),
    );
    expect(presenceNotificationsService.createOrderSubmittedNotification).toHaveBeenCalledWith(
      'order-1',
    );
    expect(realtimeEventsService.recordOrderSubmitted).toHaveBeenCalledWith(
      'order-1',
    );
    expect(smartCashierService.attemptAutoAcceptOrder).toHaveBeenCalledWith(
      'order-1',
    );
  });

  it('returns success and leaves manual review available when auto-accept throws', async () => {
    const { service, smartCashierService, prisma } = buildSubmitService({
      smartCashierRejects: true,
      responseStatus: OrderStatus.submitted,
    });

    const result = await service.submitCart('session-1', {}, 'submit-key-2');

    expect(smartCashierService.attemptAutoAcceptOrder).toHaveBeenCalledWith(
      'order-1',
    );
    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1' } }),
    );
    expect(result.order.status).toBe(OrderStatus.submitted);
    expect(result.lifecycle.allowedActions).toContain('accept');
  });

  it('returns readable bad request for invalid carts', async () => {
    const { service, tx } = buildSubmitService({
      cartValidationError: new BadRequestException('Cart is empty'),
    });

    await expect(service.submitCart('session-1')).rejects.toThrow(
      'Cart is empty',
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('returns readable bad request for invalid table sessions', async () => {
    const { service, tx } = buildSubmitService({
      cartValidationError: new NotFoundException('Table session not found'),
    });

    await expect(service.submitCart('missing-session')).rejects.toThrow(
      'Table session is invalid or unavailable',
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('replays idempotent submissions without rerunning automation', async () => {
    const existingOrder = orderResponse(OrderStatus.submitted);
    const { service, tx, cartService, smartCashierService } = buildSubmitService({
      existingOrder,
    });

    const result = await service.submitCart(
      'session-1',
      {},
      ' submit-key-3 ',
    );

    expect(result.idempotency).toEqual({
      replayed: true,
      key: 'submit-key-3',
    });
    expect(cartService.getValidatedDraftCartForSubmit).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(smartCashierService.attemptAutoAcceptOrder).not.toHaveBeenCalled();
  });
});

describe('OrdersService lifecycle hardening', () => {
  it('accepts a submitted order and consumes stock after the guarded update', async () => {
    const { service, tx, inventoryService, preparationTasksService } =
      buildService({
        transitionOrder: { status: OrderStatus.submitted },
        responseStatus: OrderStatus.cashier_accepted,
      });

    await service.accept('order-1', {}, 'staff-1');

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', status: OrderStatus.submitted },
      }),
    );
    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalledWith(
      'order-1',
      'staff-1',
      tx,
    );
    expect(preparationTasksService.createTasksForAcceptedOrder).toHaveBeenCalledWith(
      'order-1',
      'staff-1',
      tx,
    );
  });

  it('does not consume stock when a duplicate accept sees stale order state', async () => {
    const { service, inventoryService } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
      updateCount: 0,
    });

    await expectLifecycleCode(
      service.accept('order-1', {}, 'staff-1'),
      'stale_order_state',
    );
    expect(inventoryService.consumeStockForAcceptedOrder).not.toHaveBeenCalled();
  });

  it('stops accepted-order side effects when stock consumption rejects', async () => {
    const { service, inventoryService, preparationTasksService } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
      inventoryRejects: true,
    });

    await expect(service.accept('order-1', {}, 'staff-1')).rejects.toThrow(
      'Item is out of stock',
    );
    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalled();
    expect(preparationTasksService.createTasksForAcceptedOrder).not.toHaveBeenCalled();
  });

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
