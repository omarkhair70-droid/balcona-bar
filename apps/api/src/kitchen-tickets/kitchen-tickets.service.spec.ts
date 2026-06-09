import {
  KitchenTicketStatus,
  KitchenTicketType,
  OrderStatus,
  PreparationStation,
  Prisma,
} from '@prisma/client';
import { KitchenTicketsService } from './kitchen-tickets.service';

function buildOrder() {
  return {
    id: 'order-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    tableSessionId: 'session-1',
    orderNumber: 'B0007',
    status: OrderStatus.cashier_accepted,
    customerNote: 'No ice please',
    tableSession: {
      table: {
        code: 'T01',
        displayName: 'Table 1',
        floor: { name: 'Ground Floor' },
      },
    },
    items: [
      {
        id: 'item-1',
        menuItemId: 'menu-1',
        quantity: 2,
        notes: 'extra cold',
        itemNameSnapshot: 'Spanish Latte',
        itemSlugSnapshot: 'spanish-latte',
        menuItem: { station: PreparationStation.barista },
        modifierOptions: [
          {
            modifierGroupId: 'group-1',
            modifierOptionId: 'option-1',
            modifierGroupNameSnapshot: 'Size',
            modifierGroupSlugSnapshot: 'size',
            modifierOptionNameSnapshot: 'Medium',
            modifierOptionSlugSnapshot: 'medium',
            priceDeltaMinorSnapshot: 1000,
          },
        ],
        preparationTask: { id: 'task-1' },
      },
      {
        id: 'item-2',
        menuItemId: 'menu-2',
        quantity: 1,
        notes: null,
        itemNameSnapshot: 'Croissant',
        itemSlugSnapshot: 'croissant',
        menuItem: { station: PreparationStation.kitchen },
        modifierOptions: [],
        preparationTask: { id: 'task-2' },
      },
      {
        id: 'item-4',
        menuItemId: 'menu-4',
        quantity: 1,
        notes: null,
        itemNameSnapshot: 'Chocolate Cake',
        itemSlugSnapshot: 'chocolate-cake',
        menuItem: { station: PreparationStation.dessert },
        modifierOptions: [],
        preparationTask: { id: 'task-4' },
      },
      {
        id: 'item-3',
        menuItemId: 'menu-3',
        quantity: 1,
        notes: null,
        itemNameSnapshot: 'Cashier Bag',
        itemSlugSnapshot: 'cashier-bag',
        menuItem: { station: PreparationStation.cashier },
        modifierOptions: [],
        preparationTask: null,
      },
    ],
  };
}

function ticketResponse(id: string, data: any) {
  return {
    id,
    ...data,
    company: { id: 'company-1', name: 'Balcona', slug: 'balcona' },
    branch: { id: 'branch-1', companyId: 'company-1', name: 'Main', slug: 'main' },
    order: {
      id: 'order-1',
      orderNumber: 'B0007',
      status: OrderStatus.cashier_accepted,
      customerNote: 'No ice please',
      readyAt: null,
      servedAt: null,
      createdAt: new Date('2026-06-04T10:00:00Z'),
    },
    tableSession: {
      id: 'session-1',
      status: 'active',
      guestLabel: null,
      table: {
        id: 'table-1',
        code: 'T01',
        displayName: 'Table 1',
        floor: { id: 'floor-1', name: 'Ground Floor', sortOrder: 1 },
      },
    },
    items: data.items?.create ?? data.items ?? [],
    printJobs: [],
  };
}

function nextSequenceAggregate(createdTickets: any[]) {
  return jest.fn().mockImplementation(() => {
    const maxSequence = createdTickets.reduce(
      (max, entry) => Math.max(max, entry.data.sequence),
      0,
    );

    return { _max: { sequence: maxSequence === 0 ? null : maxSequence } };
  });
}

describe('KitchenTicketsService', () => {
  it('creates one idempotent ticket per actionable station', async () => {
    const createdTickets: any[] = [];
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(buildOrder()),
      },
      kitchenTicket: {
        aggregate: nextSequenceAggregate(createdTickets),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            const ticket = createdTickets.find((entry) => entry.id === args.where.id);

            return ticket ? ticketResponse(ticket.id, ticket.data) : null;
          }

          const key = args.where.orderId_station_type;

          return (
            createdTickets.find(
              (entry) =>
                entry.data.orderId === key.orderId &&
                entry.data.station === key.station &&
                entry.data.type === key.type,
            ) ?? null
          );
        }),
        create: jest.fn().mockImplementation((args) => {
          const id = `ticket-${createdTickets.length + 1}`;

          createdTickets.push({ id, data: args.data });

          return { id };
        }),
      },
    };
    const printJobsService = {
      createForKitchenTicket: jest.fn().mockResolvedValue({}),
    };
    const realtimeEventsService = {
      recordKitchenTicketCreated: jest.fn().mockResolvedValue({}),
    };
    const service = new KitchenTicketsService(
      {} as never,
      printJobsService as never,
      realtimeEventsService as never,
    );
    const findOneSpy = jest.spyOn(service, 'findOne');

    const firstResult = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
    );
    const secondResult = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
    );

    expect(tx.kitchenTicket.create).toHaveBeenCalledTimes(3);
    expect(printJobsService.createForKitchenTicket).toHaveBeenCalledTimes(3);
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(firstResult).toMatchObject({
      ticketIds: ['ticket-1', 'ticket-2', 'ticket-3'],
      createdTicketCount: 3,
      existingTicketCount: 0,
      actionableItemCount: 3,
    });
    expect(secondResult).toMatchObject({
      ticketIds: ['ticket-1', 'ticket-2', 'ticket-3'],
      createdTicketCount: 0,
      existingTicketCount: 3,
      actionableItemCount: 3,
    });
    expect(createdTickets.map((entry) => entry.data.station).sort()).toEqual([
      PreparationStation.barista,
      PreparationStation.dessert,
      PreparationStation.kitchen,
    ]);
    expect(createdTickets[0].data.items.create[0].modifiersSnapshot).toEqual([
      expect.objectContaining({
        groupName: 'Size',
        optionName: 'Medium',
      }),
    ]);
    expect(createdTickets[0].data.items.create[0].preparationTaskId).toBe(
      'task-1',
    );
    expect(
      createdTickets.some(
        (entry) => entry.data.type === KitchenTicketType.receipt,
      ),
    ).toBe(false);
  });

  it('links ticket items to preparation tasks found after task creation', async () => {
    const createdTickets: any[] = [];
    const order: any = buildOrder();
    order.items = [
      {
        ...order.items[0],
        preparationTask: null,
      },
    ];
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      preparationTask: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'task-refetched', orderItemId: 'item-1' }]),
      },
      kitchenTicket: {
        aggregate: nextSequenceAggregate(createdTickets),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            const ticket = createdTickets.find((entry) => entry.id === args.where.id);

            return ticket ? ticketResponse(ticket.id, ticket.data) : null;
          }

          return null;
        }),
        create: jest.fn().mockImplementation((args) => {
          const id = `ticket-${createdTickets.length + 1}`;

          createdTickets.push({ id, data: args.data });

          return { id };
        }),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );

    await service.createTicketsForAcceptedOrder('order-1', 'staff-1', tx as never);

    expect(tx.preparationTask.findMany).toHaveBeenCalledWith({
      where: {
        orderId: 'order-1',
        orderItemId: { in: ['item-1'] },
      },
      select: { id: true, orderItemId: true },
    });
    expect(createdTickets[0].data.items.create[0].preparationTaskId).toBe(
      'task-refetched',
    );
  });

  it('creates visible KDS tickets without critical print or realtime side effects', async () => {
    const createdTickets: any[] = [];
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      kitchenTicket: {
        aggregate: nextSequenceAggregate(createdTickets),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            const ticket = createdTickets.find((entry) => entry.id === args.where.id);

            return ticket ? ticketResponse(ticket.id, ticket.data) : null;
          }

          return null;
        }),
        create: jest.fn().mockImplementation((args) => {
          const id = `ticket-${createdTickets.length + 1}`;

          createdTickets.push({ id, data: args.data });

          return { id };
        }),
      },
    };
    const printJobsService = {
      createForKitchenTicket: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const realtimeEventsService = {
      recordKitchenTicketCreated: jest.fn().mockRejectedValue(new Error('offline')),
    };
    const service = new KitchenTicketsService(
      {} as never,
      printJobsService as never,
      realtimeEventsService as never,
    );

    const result = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(result.ticketIds).toEqual(['ticket-1']);
    expect(tx.kitchenTicket.create).toHaveBeenCalledTimes(1);
    expect(printJobsService.createForKitchenTicket).not.toHaveBeenCalled();
    expect(realtimeEventsService.recordKitchenTicketCreated).not.toHaveBeenCalled();
  });

  it('does not hydrate newly created tickets inside critical routing', async () => {
    const createdTickets: any[] = [];
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const hydrationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction already closed. Timeout 5000ms, 5149ms passed.',
      {
        code: 'P2028',
        clientVersion: 'test',
      },
    );
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      kitchenTicket: {
        aggregate: nextSequenceAggregate(createdTickets),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            throw hydrationError;
          }

          return null;
        }),
        create: jest.fn().mockImplementation((args) => {
          const id = `ticket-${createdTickets.length + 1}`;

          createdTickets.push({ id, data: args.data });

          return { id };
        }),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );
    const findOneSpy = jest.spyOn(service, 'findOne');

    const result = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(result).toMatchObject({
      ticketIds: ['ticket-1'],
      createdTicketCount: 1,
      existingTicketCount: 0,
      actionableItemCount: 1,
      stationsDetected: [PreparationStation.barista],
    });
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(tx.kitchenTicket.findUnique).toHaveBeenCalledWith({
      where: {
        orderId_station_type: {
          orderId: 'order-1',
          station: PreparationStation.barista,
          type: KitchenTicketType.barista_order,
        },
      },
      select: { id: true },
    });
  });

  it('routes from a prepared order snapshot without reloading the order', async () => {
    const createdTickets: any[] = [];
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const tx = {
      order: {
        findUnique: jest.fn(() => {
          throw new Error('snapshot routing must not reload the order');
        }),
      },
      kitchenTicket: {
        aggregate: nextSequenceAggregate(createdTickets),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => {
          const id = `ticket-${createdTickets.length + 1}`;

          createdTickets.push({ id, data: args.data });

          return { id };
        }),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );

    const result = await service.createTicketsForAcceptedOrderSnapshot(
      order,
      new Map([['item-1', 'task-1']]),
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(tx.order.findUnique).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ticketIds: ['ticket-1'],
      createdTicketCount: 1,
      existingTicketCount: 0,
      actionableItemCount: 1,
    });
    expect(createdTickets[0].data.items.create[0].preparationTaskId).toBe(
      'task-1',
    );
  });

  it('does not hydrate existing tickets inside critical routing', async () => {
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const hydrationError = new Prisma.PrismaClientKnownRequestError(
      'Transaction already closed. Timeout 5000ms, 5149ms passed.',
      {
        code: 'P2028',
        clientVersion: 'test',
      },
    );
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      kitchenTicket: {
        aggregate: jest.fn(),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            throw hydrationError;
          }

          return { id: 'ticket-existing' };
        }),
        create: jest.fn(),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );
    const findOneSpy = jest.spyOn(service, 'findOne');

    const result = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(result).toMatchObject({
      ticketIds: ['ticket-existing'],
      createdTicketCount: 0,
      existingTicketCount: 1,
      actionableItemCount: 1,
      stationsDetected: [PreparationStation.barista],
    });
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(tx.kitchenTicket.create).not.toHaveBeenCalled();
    expect(tx.kitchenTicket.aggregate).not.toHaveBeenCalled();
  });

  it('returns existing snapshot tickets without order reload or full hydration', async () => {
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const tx = {
      order: {
        findUnique: jest.fn(() => {
          throw new Error('snapshot routing must not reload the order');
        }),
      },
      kitchenTicket: {
        aggregate: jest.fn(),
        findUnique: jest.fn().mockResolvedValue({ id: 'ticket-existing' }),
        create: jest.fn(),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );
    const findOneSpy = jest.spyOn(service, 'findOne');

    const result = await service.createTicketsForAcceptedOrderSnapshot(
      order,
      new Map([['item-1', 'task-1']]),
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(tx.order.findUnique).not.toHaveBeenCalled();
    expect(findOneSpy).not.toHaveBeenCalled();
    expect(tx.kitchenTicket.create).not.toHaveBeenCalled();
    expect(tx.kitchenTicket.aggregate).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ticketIds: ['ticket-existing'],
      createdTicketCount: 0,
      existingTicketCount: 1,
      actionableItemCount: 1,
    });
  });

  it('retries ticket display code collisions without raw SQL advisory locks', async () => {
    const createdTickets: any[] = [];
    const order: any = buildOrder();
    order.items = [order.items[0]];
    const collision = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on displayCode',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['branchId', 'displayCode'] },
      },
    );
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
      },
      kitchenTicket: {
        aggregate: jest.fn().mockResolvedValue({ _max: { sequence: 7 } }),
        findUnique: jest.fn().mockImplementation((args) => {
          if (args.where.id) {
            const ticket = createdTickets.find((entry) => entry.id === args.where.id);

            return ticket ? ticketResponse(ticket.id, ticket.data) : null;
          }

          return null;
        }),
        create: jest
          .fn()
          .mockRejectedValueOnce(collision)
          .mockImplementationOnce((args) => {
            const id = `ticket-${createdTickets.length + 1}`;

            createdTickets.push({ id, data: args.data });

            return { id };
          }),
      },
    };
    const service = new KitchenTicketsService(
      {} as never,
      { createForKitchenTicket: jest.fn().mockResolvedValue({}) } as never,
      { recordKitchenTicketCreated: jest.fn().mockResolvedValue({}) } as never,
    );

    const result = await service.createTicketsForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
      { createPrintJobs: false, recordRealtimeEvents: false },
    );

    expect(result.ticketIds).toEqual(['ticket-1']);
    expect(tx.kitchenTicket.create).toHaveBeenCalledTimes(2);
    expect(tx.kitchenTicket.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: 8,
          displayCode: 'B0008',
        }),
      }),
    );
    expect(tx.kitchenTicket.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: 9,
          displayCode: 'B0009',
        }),
      }),
    );
    expect(createdTickets[0].data.items.create[0].preparationTaskId).toBe(
      'task-1',
    );
  });

  it('marks a ticket ready when all ticket items are ready', async () => {
    const tx = {
      kitchenTicketItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ticket-item-1',
          ticketId: 'ticket-1',
          ticket: { status: KitchenTicketStatus.in_progress },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      kitchenTicket: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'ticket-1',
            status: KitchenTicketStatus.in_progress,
            items: [{ status: KitchenTicketStatus.ready }],
          })
          .mockResolvedValueOnce(
            ticketResponse('ticket-1', {
              companyId: 'company-1',
              branchId: 'branch-1',
              orderId: 'order-1',
              tableSessionId: 'session-1',
              station: PreparationStation.barista,
              type: KitchenTicketType.barista_order,
              status: KitchenTicketStatus.ready,
              displayCode: 'B0001',
              sequence: 1,
              orderNumberSnapshot: 'B0007',
              tableCodeSnapshot: 'T01',
              floorNameSnapshot: 'Ground Floor',
              customerNoteSnapshot: null,
              items: [],
            }),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const realtimeEventsService = {
      recordKitchenTicketReady: jest.fn().mockResolvedValue({}),
      recordKitchenTicketUpdated: jest.fn().mockResolvedValue({}),
    };
    const service = new KitchenTicketsService(
      {} as never,
      {} as never,
      realtimeEventsService as never,
    );

    await service.syncTicketsForTaskReady('task-1', tx as never);

    expect(tx.kitchenTicketItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: KitchenTicketStatus.ready },
      }),
    );
    expect(tx.kitchenTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: KitchenTicketStatus.ready }),
      }),
    );
    expect(realtimeEventsService.recordKitchenTicketReady).toHaveBeenCalledWith(
      'ticket-1',
      tx,
    );
  });
});
