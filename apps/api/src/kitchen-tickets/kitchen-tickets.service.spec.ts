import {
  KitchenTicketStatus,
  KitchenTicketType,
  OrderStatus,
  PreparationStation,
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

describe('KitchenTicketsService', () => {
  it('creates one idempotent ticket per actionable station', async () => {
    const createdTickets: any[] = [];
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(undefined),
      order: {
        findUnique: jest.fn().mockResolvedValue(buildOrder()),
      },
      kitchenTicket: {
        count: jest.fn().mockImplementation(() => createdTickets.length),
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

    await service.createTicketsForAcceptedOrder('order-1', 'staff-1', tx as never);
    await service.createTicketsForAcceptedOrder('order-1', 'staff-1', tx as never);

    expect(tx.kitchenTicket.create).toHaveBeenCalledTimes(2);
    expect(printJobsService.createForKitchenTicket).toHaveBeenCalledTimes(2);
    expect(createdTickets.map((entry) => entry.data.station).sort()).toEqual([
      PreparationStation.barista,
      PreparationStation.kitchen,
    ]);
    expect(createdTickets[0].data.items.create[0].modifiersSnapshot).toEqual([
      expect.objectContaining({
        groupName: 'Size',
        optionName: 'Medium',
      }),
    ]);
    expect(
      createdTickets.some(
        (entry) => entry.data.type === KitchenTicketType.dessert_order,
      ),
    ).toBe(false);
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
