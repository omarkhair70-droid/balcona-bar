import { BadRequestException, Logger, NotFoundException } from "@nestjs/common";
import {
  KitchenTicketStatus,
  KitchenTicketType,
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PreparationStation,
  PreparationTaskStatus,
} from "@prisma/client";
import { KitchenTicketsService } from "../kitchen-tickets/kitchen-tickets.service";
import { PreparationTasksService } from "../preparation-tasks/preparation-tasks.service";
import { OrdersService } from "./orders.service";

const now = new Date("2026-01-01T00:00:00.000Z");

afterEach(() => {
  jest.restoreAllMocks();
});

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

function orderResponse(status: OrderStatus) {
  return {
    id: "order-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableSessionId: "session-1",
    cartId: "cart-1",
    orderNumber: "B0001",
    status,
    source: OrderSource.customer_qr,
    currency: "EGP",
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
    company: {
      id: "company-1",
      name: "Balkona",
      slug: "balkona",
      status: "active",
    },
    branch: {
      id: "branch-1",
      companyId: "company-1",
      name: "Main",
      slug: "main",
      address: null,
      status: "active",
    },
    tableSession: {
      id: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableId: "table-1",
      status: "active",
      source: "qr",
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
        id: "table-1",
        code: "T01",
        displayName: "T01",
        capacity: 2,
        qrToken: "balcona-main-t01",
        status: "active",
        floor: { id: "floor-1", name: "Main", sortOrder: 1 },
      },
    },
    items: [],
    events: [],
    preparationTasks: [],
  };
}

function spanishLatteAcceptedOrderResponse() {
  return {
    ...orderResponse(OrderStatus.cashier_accepted),
    items: [
      {
        id: "order-item-1",
        orderId: "order-1",
        menuItemId: "spanish-latte",
        quantity: 1,
        notes: null,
        itemNameSnapshot: "Spanish Latte",
        itemSlugSnapshot: "spanish-latte",
        basePriceMinorSnapshot: 11500,
        effectiveBasePriceMinorSnapshot: 11500,
        modifiersTotalMinorSnapshot: 0,
        unitPriceMinorSnapshot: 11500,
        lineTotalMinorSnapshot: 11500,
        currency: "EGP",
        createdAt: now,
        updatedAt: now,
        menuItem: { station: PreparationStation.barista },
        modifierOptions: [],
      },
    ],
    preparationTasks: [
      {
        id: "task-1",
        companyId: "company-1",
        branchId: "branch-1",
        orderId: "order-1",
        orderItemId: "order-item-1",
        station: PreparationStation.barista,
        status: PreparationTaskStatus.pending,
        quantity: 1,
        itemNameSnapshot: "Spanish Latte",
        itemSlugSnapshot: "spanish-latte",
        notes: null,
        startedAt: null,
        readyAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
        events: [],
      },
    ],
    kitchenTickets: [
      {
        id: "ticket-1",
        companyId: "company-1",
        branchId: "branch-1",
        orderId: "order-1",
        tableSessionId: "session-1",
        station: PreparationStation.barista,
        type: "barista_order",
        status: "queued",
        displayCode: "B0001",
        sequence: 1,
        orderNumberSnapshot: "B0001",
        tableCodeSnapshot: "T01",
        floorNameSnapshot: "Main",
        customerNoteSnapshot: null,
        printedAt: null,
        readyAt: null,
        cancelledAt: null,
        servedAt: null,
        createdAt: now,
        updatedAt: now,
        items: [
          {
            id: "ticket-item-1",
            ticketId: "ticket-1",
            orderItemId: "order-item-1",
            preparationTaskId: "task-1",
            menuItemId: "spanish-latte",
            itemNameSnapshot: "Spanish Latte",
            itemSlugSnapshot: "spanish-latte",
            quantity: 1,
            notes: null,
            modifiersSnapshot: [],
            station: PreparationStation.barista,
            status: "queued",
            createdAt: now,
            updatedAt: now,
          },
        ],
        printJobs: [],
      },
    ],
  };
}

const kdsRoutingResult = {
  orderId: "order-1",
  branchId: "branch-1",
  itemCount: 1,
  actionableItemCount: 1,
  stationsDetected: ["barista"],
  skippedItems: [],
  createdTaskCount: 1,
  existingTaskCount: 0,
  activeTaskCount: 1,
  ticketRouting: {
    ticketIds: ["ticket-1"],
    itemCount: 1,
    actionableItemCount: 1,
    stationsDetected: ["barista"],
    skippedItems: [],
    createdTicketCount: 1,
    existingTicketCount: 0,
  },
};

function lifecycleErrorCode(error: unknown) {
  const response =
    typeof (error as { getResponse?: () => unknown }).getResponse === "function"
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
  responseOrder?: any;
  updateCount?: number;
  inventoryRejects?: boolean;
  preparationRejects?: boolean;
}) {
  const tx = {
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: "staff-1" }),
    },
    order: {
      findUnique: jest.fn(({ include }: { include?: unknown }) =>
        Promise.resolve(
          include
            ? orderResponse(
                input.responseStatus ??
                  input.transitionOrder?.status ??
                  OrderStatus.submitted,
              )
            : input.transitionOrder
              ? {
                  id: "order-1",
                  branchId: "branch-1",
                  tableSessionId: "session-1",
                  status: input.transitionOrder.status,
                  preparationTasks:
                    input.transitionOrder.preparationTasks ?? [],
                }
              : null,
        ),
      ),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: input.updateCount ?? 1 }),
    },
    orderEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    order: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          input.responseOrder ??
            orderResponse(
              input.responseStatus ??
                input.transitionOrder?.status ??
                OrderStatus.submitted,
            ),
        ),
    },
  };
  const preparationTasksService = {
    createTasksForAcceptedOrder: input.preparationRejects
      ? jest
          .fn()
          .mockRejectedValue(new Error("Ticket printer token=secret failed"))
      : jest.fn().mockResolvedValue(kdsRoutingResult),
    recordCreatedRealtimeEventsForOrder: jest.fn().mockResolvedValue(1),
    cancelActiveTasksForOrderCancellation: jest
      .fn()
      .mockResolvedValue(["task-1"]),
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
    createPrintJobsForTickets: jest.fn().mockResolvedValue(1),
    recordCreatedRealtimeEventsForTickets: jest.fn().mockResolvedValue(1),
    syncTicketsForOrderServed: jest.fn().mockResolvedValue(1),
    syncTicketsForOrderCancelled: jest.fn().mockResolvedValue(1),
  };
  const inventoryService = {
    consumeStockForAcceptedOrder: input.inventoryRejects
      ? jest.fn().mockRejectedValue(
          new BadRequestException({
            message: "Item is out of stock",
            details: {
              menuItemNames: ["Spanish Latte"],
              inventoryItemName: "Milk",
              requiredQuantity: 150,
              availableQuantity: 0,
            },
          }),
        )
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

function buildAcceptKdsFlowService() {
  const orderItem = {
    id: "order-item-1",
    orderId: "order-1",
    menuItemId: "spanish-latte",
    quantity: 1,
    notes: "Iced",
    itemNameSnapshot: "Spanish Latte",
    itemSlugSnapshot: "spanish-latte",
    basePriceMinorSnapshot: 11500,
    effectiveBasePriceMinorSnapshot: 11500,
    modifiersTotalMinorSnapshot: 0,
    unitPriceMinorSnapshot: 11500,
    lineTotalMinorSnapshot: 11500,
    currency: "EGP",
    createdAt: now,
    updatedAt: now,
    menuItem: { station: PreparationStation.barista },
    modifierOptions: [],
  };
  const state: {
    orderStatus: OrderStatus;
    preparationTasks: any[];
    kitchenTickets: any[];
  } = {
    orderStatus: OrderStatus.submitted,
    preparationTasks: [],
    kitchenTickets: [],
  };

  const tableSession = {
    id: "session-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableId: "table-1",
    status: "active",
    source: "qr",
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
      id: "table-1",
      code: "T01",
      displayName: "T01",
      capacity: 2,
      qrToken: "balcona-main-t01",
      status: "active",
      floor: { id: "floor-1", name: "Main", sortOrder: 1 },
    },
  };

  const orderContext = () => ({
    id: "order-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableSessionId: "session-1",
    cartId: "cart-1",
    orderNumber: "B0001",
    status: state.orderStatus,
    source: OrderSource.customer_qr,
    currency: "EGP",
    subtotalMinor: 11500,
    totalQuantity: 1,
    itemCount: 1,
    customerNote: null,
    idempotencyKey: null,
    submittedAt: now,
    cashierAcceptedAt:
      state.orderStatus === OrderStatus.cashier_accepted ? now : null,
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
    company: {
      id: "company-1",
      name: "Balkona",
      slug: "balkona",
      status: "active",
    },
    branch: {
      id: "branch-1",
      companyId: "company-1",
      name: "Main",
      slug: "main",
      address: null,
      status: "active",
    },
    tableSession,
    items: [orderItem],
    events: [],
    preparationTasks: state.preparationTasks,
    kitchenTickets: state.kitchenTickets,
  });

  const kitchenOrderContext = () => ({
    id: "order-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableSessionId: "session-1",
    orderNumber: "B0001",
    status: state.orderStatus,
    customerNote: null,
    tableSession: {
      table: {
        code: tableSession.table.code,
        displayName: tableSession.table.displayName,
        floor: { name: tableSession.table.floor.name },
      },
    },
    items: [
      {
        ...orderItem,
        preparationTask:
          state.preparationTasks.find(
            (task) => task.orderItemId === orderItem.id,
          ) ?? null,
      },
    ],
  });

  const ticketResponse = (ticket: any) => ({
    ...ticket,
    company: { id: "company-1", name: "Balkona", slug: "balkona" },
    branch: {
      id: "branch-1",
      companyId: "company-1",
      name: "Main",
      slug: "main",
    },
    order: {
      id: "order-1",
      orderNumber: "B0001",
      status: state.orderStatus,
      customerNote: null,
      readyAt: null,
      servedAt: null,
      createdAt: now,
    },
    tableSession: {
      ...tableSession,
      table: tableSession.table,
    },
  });

  const tx = {
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: "staff-1" }),
    },
    order: {
      findUnique: jest.fn((args: any) => {
        if (args.include) {
          return Promise.resolve(orderContext());
        }

        if (args.select?.items && args.select?.tableSession) {
          return Promise.resolve(kitchenOrderContext());
        }

        if (args.select?.items) {
          return Promise.resolve({
            id: "order-1",
            companyId: "company-1",
            branchId: "branch-1",
            status: state.orderStatus,
            tableSessionId: "session-1",
            items: [orderItem],
          });
        }

        return Promise.resolve({
          id: "order-1",
          branchId: "branch-1",
          tableSessionId: "session-1",
          status: state.orderStatus,
          preparationTasks: [],
        });
      }),
      updateMany: jest.fn((args: any) => {
        if (args.where.id !== "order-1") {
          return Promise.resolve({ count: 0 });
        }

        if (args.where.status && args.where.status !== state.orderStatus) {
          return Promise.resolve({ count: 0 });
        }

        if (args.data.status) {
          state.orderStatus = args.data.status;
        }

        return Promise.resolve({ count: 1 });
      }),
    },
    orderEvent: {
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
    preparationTask: {
      findUnique: jest.fn((args: any) =>
        Promise.resolve(
          state.preparationTasks.find(
            (task) => task.orderItemId === args.where.orderItemId,
          ) ?? null,
        ),
      ),
      findMany: jest.fn((args: any) =>
        Promise.resolve(
          state.preparationTasks.filter((task) => {
            if (args.where.orderId && task.orderId !== args.where.orderId) {
              return false;
            }

            const itemIds = args.where.orderItemId?.in;

            return Array.isArray(itemIds)
              ? itemIds.includes(task.orderItemId)
              : true;
          }),
        ),
      ),
      create: jest.fn((args: any) => {
        const task = {
          id: `task-${state.preparationTasks.length + 1}`,
          companyId: args.data.companyId,
          branchId: args.data.branchId,
          orderId: args.data.orderId,
          orderItemId: args.data.orderItemId,
          station: args.data.station,
          status: args.data.status,
          quantity: args.data.quantity,
          itemNameSnapshot: args.data.itemNameSnapshot,
          itemSlugSnapshot: args.data.itemSlugSnapshot,
          notes: args.data.notes,
          startedAt: null,
          readyAt: null,
          cancelledAt: null,
          createdAt: now,
          updatedAt: now,
          events: [
            {
              id: "task-event-1",
              preparationTaskId: `task-${state.preparationTasks.length + 1}`,
              type: args.data.events.create.type,
              actorStaffUserId: args.data.events.create.actorStaffUserId,
              metadata: args.data.events.create.metadata,
              createdAt: now,
            },
          ],
        };

        state.preparationTasks.push(task);

        return Promise.resolve({ id: task.id });
      }),
    },
    kitchenTicket: {
      aggregate: jest.fn(() => {
        const maxSequence = state.kitchenTickets.reduce(
          (max, ticket) => Math.max(max, ticket.sequence),
          0,
        );

        return Promise.resolve({
          _max: { sequence: maxSequence === 0 ? null : maxSequence },
        });
      }),
      findUnique: jest.fn((args: any) => {
        if (args.where.id) {
          const ticket = state.kitchenTickets.find(
            (entry) => entry.id === args.where.id,
          );

          return Promise.resolve(ticket ? ticketResponse(ticket) : null);
        }

        const key = args.where.orderId_station_type;

        return Promise.resolve(
          state.kitchenTickets.find(
            (entry) =>
              entry.orderId === key.orderId &&
              entry.station === key.station &&
              entry.type === key.type,
          ) ?? null,
        );
      }),
      create: jest.fn((args: any) => {
        const ticketId = `ticket-${state.kitchenTickets.length + 1}`;
        const { items: _nestedItems, ...ticketData } = args.data;
        const ticketItems = args.data.items.create.map(
          (item: any, index: number) => ({
            id: `ticket-item-${index + 1}`,
            ticketId,
            ...item,
            createdAt: now,
            updatedAt: now,
          }),
        );
        const ticket = {
          id: ticketId,
          ...ticketData,
          items: ticketItems,
          printJobs: [],
          printedAt: null,
          readyAt: null,
          cancelledAt: null,
          servedAt: null,
          createdAt: now,
          updatedAt: now,
        };

        state.kitchenTickets.push(ticket);

        return Promise.resolve({ id: ticketId });
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    order: {
      findUnique: jest.fn().mockImplementation(() => orderContext()),
    },
    preparationTask: {
      findMany: jest
        .fn()
        .mockImplementation(() =>
          state.preparationTasks.map((task) => ({ id: task.id })),
        ),
    },
    kitchenTicket: tx.kitchenTicket,
  };
  const realtimeEventsService = {
    recordPreparationTaskCreated: jest.fn().mockResolvedValue({}),
    recordPreparationTaskStarted: jest.fn().mockResolvedValue({}),
    recordPreparationTaskReady: jest.fn().mockResolvedValue({}),
    recordPreparationTaskCancelled: jest.fn().mockResolvedValue({}),
    recordOrderPreparationStarted: jest.fn().mockResolvedValue({}),
    recordOrderPreparationReady: jest.fn().mockResolvedValue({}),
    recordKitchenTicketCreated: jest.fn().mockResolvedValue({}),
    recordKitchenTicketUpdated: jest.fn().mockResolvedValue({}),
    recordKitchenTicketReady: jest.fn().mockResolvedValue({}),
    recordKitchenTicketCancelled: jest.fn().mockResolvedValue({}),
    recordOrderAccepted: jest.fn().mockResolvedValue({}),
    recordOrderRejected: jest.fn().mockResolvedValue({}),
    recordOrderServed: jest.fn().mockResolvedValue({}),
    recordOrderCompleted: jest.fn().mockResolvedValue({}),
    recordOrderCancelled: jest.fn().mockResolvedValue({}),
  };
  const printJobsService = {
    createForKitchenTicket: jest.fn().mockResolvedValue({ id: "print-job-1" }),
  };
  const kitchenTicketsService = new KitchenTicketsService(
    prisma as never,
    printJobsService as never,
    realtimeEventsService as never,
  );
  const preparationTasksService = new PreparationTasksService(
    prisma as never,
    {} as never,
    realtimeEventsService as never,
    { recalculateForTableSession: jest.fn().mockResolvedValue({}) } as never,
    kitchenTicketsService,
  );
  const inventoryService = {
    consumeStockForAcceptedOrder: jest.fn().mockResolvedValue({
      consumed: true,
      movements: [],
    }),
  };
  const service = new OrdersService(
    prisma as never,
    {} as never,
    preparationTasksService,
    {
      createOrderAcceptedNotification: jest.fn().mockResolvedValue({}),
      createOrderRejectedNotification: jest.fn().mockResolvedValue({}),
      createOrderServedNotification: jest.fn().mockResolvedValue({}),
    } as never,
    realtimeEventsService as never,
    {} as never,
    { recalculateForTableSession: jest.fn().mockResolvedValue({}) } as never,
    kitchenTicketsService,
    inventoryService as never,
  );

  return {
    service,
    tx,
    state,
    inventoryService,
    printJobsService,
    realtimeEventsService,
  };
}

const submitSession = {
  id: "session-1",
  companyId: "company-1",
  branchId: "branch-1",
};

const submitCart = {
  id: "cart-1",
  currency: "EGP",
  items: [
    {
      id: "cart-item-1",
      menuItemId: "spanish-latte",
      quantity: 1,
      notes: null,
      itemNameSnapshot: "Spanish Latte",
      itemSlugSnapshot: "spanish-latte",
      basePriceMinorSnapshot: 11500,
      effectiveBasePriceMinorSnapshot: 11500,
      modifiersTotalMinorSnapshot: 0,
      unitPriceMinorSnapshot: 11500,
      lineTotalMinorSnapshot: 11500,
      currency: "EGP",
      modifierOptions: [
        {
          modifierGroupId: "size",
          modifierOptionId: "small",
          modifierGroupNameSnapshot: "Size",
          modifierGroupSlugSnapshot: "size",
          modifierOptionNameSnapshot: "Small",
          modifierOptionSlugSnapshot: "small",
          priceDeltaMinorSnapshot: 0,
        },
        {
          modifierGroupId: "temperature",
          modifierOptionId: "iced",
          modifierGroupNameSnapshot: "Temperature",
          modifierGroupSlugSnapshot: "temperature",
          modifierOptionNameSnapshot: "Iced",
          modifierOptionSlugSnapshot: "iced",
          priceDeltaMinorSnapshot: 0,
        },
      ],
    },
  ],
};

function buildSubmitService(
  input: {
    existingOrder?: ReturnType<typeof orderResponse> | null;
    cartValidationError?: Error;
    smartCashierRejects?: boolean;
    responseStatus?: OrderStatus;
    submittedNotificationNeverResolves?: boolean;
  } = {},
) {
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
      create: jest.fn().mockResolvedValue({ id: "order-1" }),
    },
    cart: {
      update: jest.fn().mockResolvedValue({ id: "cart-1" }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
    order: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
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
    createOrderSubmittedNotification: input.submittedNotificationNeverResolves
      ? jest.fn().mockReturnValue(new Promise(() => undefined))
      : jest.fn().mockResolvedValue({}),
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
      ? jest.fn().mockRejectedValue(new Error("Printer timeout token=secret"))
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

describe("OrdersService submit cart", () => {
  it("submits a cart with modifiers and customer note", async () => {
    const {
      service,
      tx,
      presenceNotificationsService,
      realtimeEventsService,
      smartCashierService,
    } = buildSubmitService();

    const result = await service.submitCart(
      "session-1",
      { customerNote: "  Please make it iced  " },
      "submit-key-1",
      "request-1",
    );
    await flushAsyncWork();

    expect(result.order.status).toBe(OrderStatus.submitted);
    expect(tx.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerNote: "Please make it iced",
          idempotencyKey: "submit-key-1",
          items: {
            create: [
              expect.objectContaining({
                menuItemId: "spanish-latte",
                quantity: 1,
                modifierOptions: {
                  create: [
                    expect.objectContaining({
                      modifierGroupId: "size",
                      modifierOptionId: "small",
                    }),
                    expect.objectContaining({
                      modifierGroupId: "temperature",
                      modifierOptionId: "iced",
                    }),
                  ],
                },
              }),
            ],
          },
        }),
      }),
    );
    expect(
      presenceNotificationsService.createOrderSubmittedNotification,
    ).toHaveBeenCalledWith("order-1");
    expect(realtimeEventsService.recordOrderSubmitted).toHaveBeenCalledWith(
      "order-1",
    );
    expect(smartCashierService.attemptAutoAcceptOrder).toHaveBeenCalledWith(
      "order-1",
    );
  });

  it("returns success and leaves manual review available when auto-accept throws", async () => {
    const { service, smartCashierService, prisma } = buildSubmitService({
      smartCashierRejects: true,
      responseStatus: OrderStatus.submitted,
    });

    const result = await service.submitCart("session-1", {}, "submit-key-2");
    await flushAsyncWork();

    expect(smartCashierService.attemptAutoAcceptOrder).toHaveBeenCalledWith(
      "order-1",
    );
    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "order-1" } }),
    );
    expect(result.order.status).toBe(OrderStatus.submitted);
    expect(result.lifecycle.allowedActions).toContain("accept");
  });

  it("returns before post-submit automation settles", async () => {
    const { service, presenceNotificationsService, smartCashierService } =
      buildSubmitService({
        submittedNotificationNeverResolves: true,
        responseStatus: OrderStatus.submitted,
      });

    const result = await service.submitCart("session-1", {}, "submit-key-fast");

    expect(result.order.status).toBe(OrderStatus.submitted);
    expect(
      presenceNotificationsService.createOrderSubmittedNotification,
    ).toHaveBeenCalledWith("order-1");
    expect(smartCashierService.attemptAutoAcceptOrder).not.toHaveBeenCalled();
  });

  it("returns readable bad request for invalid carts", async () => {
    const { service, tx } = buildSubmitService({
      cartValidationError: new BadRequestException("Cart is empty"),
    });

    await expect(service.submitCart("session-1")).rejects.toThrow(
      "Cart is empty",
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("returns readable bad request for invalid table sessions", async () => {
    const { service, tx } = buildSubmitService({
      cartValidationError: new NotFoundException("Table session not found"),
    });

    await expect(service.submitCart("missing-session")).rejects.toThrow(
      "Table session is invalid or unavailable",
    );
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it("replays idempotent submissions without rerunning automation", async () => {
    const existingOrder = orderResponse(OrderStatus.submitted);
    const { service, tx, cartService, smartCashierService } =
      buildSubmitService({
        existingOrder,
      });

    const result = await service.submitCart("session-1", {}, " submit-key-3 ");

    expect(result.idempotency).toEqual({
      replayed: true,
      key: "submit-key-3",
    });
    expect(cartService.getValidatedDraftCartForSubmit).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
    expect(smartCashierService.attemptAutoAcceptOrder).not.toHaveBeenCalled();
  });
});

describe("OrdersService lifecycle hardening", () => {
  it("accepts a submitted order and consumes stock after the guarded update", async () => {
    const { service, tx, inventoryService, preparationTasksService } =
      buildService({
        transitionOrder: { status: OrderStatus.submitted },
        responseStatus: OrderStatus.cashier_accepted,
      });

    await service.accept("order-1", {}, "staff-1");

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-1", status: OrderStatus.submitted },
      }),
    );
    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalledWith(
      "order-1",
      "staff-1",
      tx,
    );
    expect(
      preparationTasksService.createTasksForAcceptedOrder,
    ).toHaveBeenCalledWith("order-1", "staff-1", tx, {
      createPrintJobs: false,
      recordRealtimeEvents: false,
    });
  });

  it("accepts a Spanish Latte barista order with task and ticket linkage", async () => {
    const { service, preparationTasksService, kitchenTicketsService } =
      buildService({
        transitionOrder: { status: OrderStatus.submitted },
        responseOrder: spanishLatteAcceptedOrderResponse(),
      });

    const result = await service.accept("order-1", {}, "staff-1");
    await flushAsyncWork();

    expect(result.order.status).toBe(OrderStatus.cashier_accepted);
    expect(result.items).toEqual([
      expect.objectContaining({
        itemNameSnapshot: "Spanish Latte",
        station: PreparationStation.barista,
      }),
    ]);
    expect(result.preparationTasks).toEqual([
      expect.objectContaining({
        id: "task-1",
        orderItemId: "order-item-1",
        station: PreparationStation.barista,
      }),
    ]);
    expect(result.kitchenTickets).toEqual([
      expect.objectContaining({
        id: "ticket-1",
        station: PreparationStation.barista,
        items: [
          expect.objectContaining({
            orderItemId: "order-item-1",
            preparationTaskId: "task-1",
          }),
        ],
      }),
    ]);
    expect(
      preparationTasksService.createTasksForAcceptedOrder,
    ).toHaveBeenCalledWith("order-1", "staff-1", expect.anything(), {
      createPrintJobs: false,
      recordRealtimeEvents: false,
    });
    expect(
      kitchenTicketsService.createPrintJobsForTickets,
    ).toHaveBeenCalledWith(["ticket-1"], "staff-1");
  });

  it("accepts a Spanish Latte through real preparation task and KDS ticket routing", async () => {
    const {
      service,
      tx,
      state,
      inventoryService,
      printJobsService,
      realtimeEventsService,
    } = buildAcceptKdsFlowService();

    const result = await service.accept("order-1", {}, "staff-1");
    await flushAsyncWork();

    expect(result.order.status).toBe(OrderStatus.cashier_accepted);
    expect(state.orderStatus).toBe(OrderStatus.cashier_accepted);
    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalledWith(
      "order-1",
      "staff-1",
      tx,
    );
    expect(tx.preparationTask.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        orderItemId: "order-item-1",
        station: PreparationStation.barista,
        itemNameSnapshot: "Spanish Latte",
      }),
      select: { id: true },
    });
    expect(tx.kitchenTicket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order-1",
          station: PreparationStation.barista,
          type: KitchenTicketType.barista_order,
          status: KitchenTicketStatus.queued,
          displayCode: "B0001",
          items: {
            create: [
              expect.objectContaining({
                orderItemId: "order-item-1",
                preparationTaskId: "task-1",
                station: PreparationStation.barista,
              }),
            ],
          },
        }),
      }),
    );
    expect(result.preparationTasks).toEqual([
      expect.objectContaining({
        id: "task-1",
        orderItemId: "order-item-1",
        station: PreparationStation.barista,
      }),
    ]);
    expect(result.kitchenTickets).toEqual([
      expect.objectContaining({
        id: "ticket-1",
        station: PreparationStation.barista,
        items: [
          expect.objectContaining({
            orderItemId: "order-item-1",
            preparationTaskId: "task-1",
          }),
        ],
      }),
    ]);
    expect(printJobsService.createForKitchenTicket).toHaveBeenCalledWith(
      "ticket-1",
      tx,
      { requestedByStaffUserId: "staff-1" },
    );
    expect(
      realtimeEventsService.recordKitchenTicketCreated,
    ).toHaveBeenCalledWith("ticket-1", expect.anything());
  });

  it("keeps accept successful when post-commit KDS print jobs fail", async () => {
    const loggerSpy = jest.spyOn(Logger.prototype, "warn").mockImplementation();
    const { service, kitchenTicketsService } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
      responseOrder: spanishLatteAcceptedOrderResponse(),
    });
    kitchenTicketsService.createPrintJobsForTickets.mockRejectedValueOnce(
      new Error("Printer token=secret failed"),
    );

    const result = await service.accept("order-1", {}, "staff-1", "req-print");
    await flushAsyncWork();

    expect(result.order.status).toBe(OrderStatus.cashier_accepted);
    expect(result.kitchenTickets).toHaveLength(1);

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls[0][0]);

    expect(loggedPayload).toContain("print_jobs");
    expect(loggedPayload).toContain("req-print");
    expect(loggedPayload).toContain("token=[redacted]");
    expect(loggedPayload).not.toContain("token=secret");
  });

  it("does not consume stock when a duplicate accept sees stale order state", async () => {
    const { service, inventoryService } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
      updateCount: 0,
    });

    await expectLifecycleCode(
      service.accept("order-1", {}, "staff-1"),
      "stale_order_state",
    );
    expect(
      inventoryService.consumeStockForAcceptedOrder,
    ).not.toHaveBeenCalled();
  });

  it("stops accepted-order side effects when stock consumption rejects", async () => {
    const { service, inventoryService, preparationTasksService } = buildService(
      {
        transitionOrder: { status: OrderStatus.submitted },
        inventoryRejects: true,
      },
    );

    try {
      await service.accept("order-1", {}, "staff-1");
      throw new Error("Expected accept to reject");
    } catch (error) {
      expect((error as BadRequestException).getStatus()).toBe(400);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        message: "Item is out of stock",
        details: expect.objectContaining({
          menuItemNames: ["Spanish Latte"],
          inventoryItemName: "Milk",
          requiredQuantity: 150,
          availableQuantity: 0,
        }),
      });
    }

    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalled();
    expect(
      preparationTasksService.createTasksForAcceptedOrder,
    ).not.toHaveBeenCalled();
  });

  it("rejects accept with a readable KDS routing error when task creation fails", async () => {
    const loggerSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation();
    const { service, tx, preparationTasksService, inventoryService } =
      buildService({
        transitionOrder: { status: OrderStatus.submitted },
        responseStatus: OrderStatus.cashier_accepted,
        preparationRejects: true,
      });

    await expect(
      service.accept("order-1", {}, "staff-1", "req-accept"),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        message: "Kitchen routing failed for accepted order",
        code: "kds_routing_failed",
      }),
    });

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.cashier_accepted,
        }),
      }),
    );
    expect(inventoryService.consumeStockForAcceptedOrder).toHaveBeenCalled();
    expect(
      preparationTasksService.createTasksForAcceptedOrder,
    ).toHaveBeenCalled();

    const loggedPayload = JSON.stringify(loggerSpy.mock.calls[0][0]);

    expect(loggedPayload).toContain("preparation_tasks");
    expect(loggedPayload).toContain("req-accept");
    expect(loggedPayload).toContain("token=[redacted]");
    expect(loggedPayload).not.toContain("token=secret");
  });

  it("denies completion before the order is served", async () => {
    const { service } = buildService({
      transitionOrder: { status: OrderStatus.ready },
    });

    await expectLifecycleCode(
      service.complete("order-1", {}, "staff-1"),
      "order_not_served",
    );
  });

  it("denies serving while active preparation tasks are pending", async () => {
    const { service } = buildService({
      transitionOrder: {
        status: OrderStatus.preparing,
        preparationTasks: [
          { id: "task-1", status: PreparationTaskStatus.pending },
        ],
      },
    });

    await expectLifecycleCode(
      service.serve("order-1", {}, "staff-1"),
      "order_has_pending_preparation_tasks",
    );
  });

  it("serves ready orders and records transition metadata", async () => {
    const { service, tx, realtimeEventsService } = buildService({
      transitionOrder: {
        status: OrderStatus.ready,
        preparationTasks: [
          { id: "task-1", status: PreparationTaskStatus.ready },
        ],
      },
      responseStatus: OrderStatus.served,
    });

    await service.serve("order-1", { note: "Delivered" }, "staff-1");

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OrderStatus.served,
          servedByStaffUserId: "staff-1",
        }),
      }),
    );
    expect(tx.orderEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: OrderEventType.served,
        actorType: OrderEventActorType.staff,
        actorStaffUserId: "staff-1",
        metadata: expect.objectContaining({
          previousStatus: OrderStatus.ready,
          nextStatus: OrderStatus.served,
          action: "serve",
          source: "waiter",
          note: "Delivered",
        }),
      }),
    });
    expect(realtimeEventsService.recordOrderServed).toHaveBeenCalledWith(
      "order-1",
      tx,
    );
  });

  it("requires a cancellation reason", async () => {
    const { service } = buildService({
      transitionOrder: { status: OrderStatus.submitted },
    });

    await expectLifecycleCode(
      service.cancel("order-1", {}, "staff-1"),
      "cancellation_requires_reason",
    );
  });

  it("cancels active preparation tasks and records a cancellation event", async () => {
    const { service, tx, preparationTasksService, realtimeEventsService } =
      buildService({
        transitionOrder: {
          status: OrderStatus.preparing,
          preparationTasks: [
            { id: "task-1", status: PreparationTaskStatus.preparing },
          ],
        },
        responseStatus: OrderStatus.cancelled,
      });

    await service.cancel(
      "order-1",
      { reason: "Customer changed plans" },
      "staff-1",
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
          action: "cancel",
          reason: "Customer changed plans",
        }),
      }),
    });
    expect(
      preparationTasksService.cancelActiveTasksForOrderCancellation,
    ).toHaveBeenCalledWith("order-1", "staff-1", "Customer changed plans", tx);
    expect(realtimeEventsService.recordOrderCancelled).toHaveBeenCalledWith(
      "order-1",
    );
  });
});
