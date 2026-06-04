import {
  KitchenTicketStatus,
  KitchenTicketType,
  PreparationStation,
  PrintJobKind,
  PrintJobStatus,
} from '@prisma/client';
import { PrintJobsService } from './print-jobs.service';

function ticketRecord() {
  return {
    id: 'ticket-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    orderId: 'order-1',
    tableSessionId: 'session-1',
    station: PreparationStation.barista,
    type: KitchenTicketType.barista_order,
    status: KitchenTicketStatus.queued,
    displayCode: 'B0001',
    orderNumberSnapshot: 'B0007',
    tableCodeSnapshot: 'T01',
    floorNameSnapshot: 'Ground Floor',
    customerNoteSnapshot: 'No ice please',
    createdAt: new Date('2026-06-04T10:00:00Z'),
    branch: { id: 'branch-1', companyId: 'company-1', name: 'Balcona Bar', slug: 'main' },
    items: [
      {
        id: 'ticket-item-1',
        orderItemId: 'order-item-1',
        itemNameSnapshot: 'Spanish Latte',
        itemSlugSnapshot: 'spanish-latte',
        quantity: 2,
        notes: 'extra cold',
        station: PreparationStation.barista,
        status: KitchenTicketStatus.queued,
        modifiersSnapshot: [
          { groupName: 'Size', optionName: 'Medium' },
          { groupName: 'Sugar', optionName: 'Less' },
        ],
      },
    ],
  };
}

function printJobEnvelope(status: PrintJobStatus) {
  return {
    id: 'print-job-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    printerStationId: 'printer-1',
    kitchenTicketId: 'ticket-1',
    orderId: 'order-1',
    kind: PrintJobKind.barista_ticket,
    status,
    payload: {},
    printableText: 'ticket',
    errorMessage: null,
    attemptCount: 0,
    requestedByStaffUserId: null,
    printedAt: null,
    failedAt: null,
    createdAt: new Date('2026-06-04T10:00:00Z'),
    updatedAt: new Date('2026-06-04T10:00:00Z'),
    company: { id: 'company-1', name: 'Balcona', slug: 'balcona' },
    branch: { id: 'branch-1', companyId: 'company-1', name: 'Main', slug: 'main' },
    printerStation: { id: 'printer-1', name: 'Main Barista Printer' },
    kitchenTicket: { id: 'ticket-1', displayCode: 'B0001' },
    order: { id: 'order-1', orderNumber: 'B0007', status: 'ready' },
    events: [],
  };
}

describe('PrintJobsService', () => {
  it('creates a pending mock print job with structured payload and printable text', async () => {
    const createdJobs: any[] = [];
    const tx = {
      kitchenTicket: {
        findUnique: jest.fn().mockResolvedValue(ticketRecord()),
      },
      printerStation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'printer-1' }),
      },
      printJob: {
        create: jest.fn().mockImplementation((args) => {
          createdJobs.push(args.data);

          return { id: 'print-job-1' };
        }),
        findUnique: jest
          .fn()
          .mockImplementation(() => printJobEnvelope(PrintJobStatus.pending)),
      },
    };
    const realtimeEventsService = {
      recordPrintJobCreated: jest.fn().mockResolvedValue({}),
      recordPrintJobReprintRequested: jest.fn().mockResolvedValue({}),
    };
    const service = new PrintJobsService(
      {} as never,
      realtimeEventsService as never,
    );

    await service.createForKitchenTicket('ticket-1', tx as never, {
      requestedByStaffUserId: 'staff-1',
    });

    expect(createdJobs).toHaveLength(1);
    expect(createdJobs[0]).toEqual(
      expect.objectContaining({
        printerStationId: 'printer-1',
        kind: PrintJobKind.barista_ticket,
        status: PrintJobStatus.pending,
        requestedByStaffUserId: 'staff-1',
      }),
    );
    expect(createdJobs[0].payload.items[0].modifiers).toHaveLength(2);
    expect(createdJobs[0].printableText).toContain('Spanish Latte');
    expect(createdJobs[0].printableText).toContain('Size: Medium');
    expect(realtimeEventsService.recordPrintJobCreated).toHaveBeenCalledWith(
      'print-job-1',
      tx,
    );
  });

  it('marks a pending print job printed and stamps the ticket printed time', async () => {
    const tx = {
      printJob: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'print-job-1',
            status: PrintJobStatus.pending,
            kitchenTicketId: 'ticket-1',
            branchId: 'branch-1',
          })
          .mockResolvedValueOnce(printJobEnvelope(PrintJobStatus.printed)),
        update: jest.fn().mockResolvedValue({}),
      },
      kitchenTicket: {
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const realtimeEventsService = {
      recordPrintJobPrinted: jest.fn().mockResolvedValue({}),
    };
    const service = new PrintJobsService(
      prisma as never,
      realtimeEventsService as never,
    );

    await service.markPrinted('print-job-1', 'staff-1');

    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PrintJobStatus.printed }),
      }),
    );
    expect(tx.kitchenTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ticket-1' } }),
    );
    expect(realtimeEventsService.recordPrintJobPrinted).toHaveBeenCalledWith(
      'print-job-1',
      tx,
    );
  });

  it('rejects printing a job that is already printed', async () => {
    const tx = {
      printJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'print-job-1',
          status: PrintJobStatus.printed,
          kitchenTicketId: 'ticket-1',
          branchId: 'branch-1',
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PrintJobsService(prisma as never, {} as never);

    await expect(service.markPrinting('print-job-1', 'staff-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'print_job_not_printable' }),
    });
  });
});
