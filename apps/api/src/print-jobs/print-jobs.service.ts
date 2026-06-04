import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  KitchenTicketType,
  PreparationStation,
  PrinterStationStatus,
  PrintJobKind,
  PrintJobStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeEventsService } from '../realtime-events/realtime-events.service';
import { BranchPrintJobsQueryDto } from './dto/branch-print-jobs-query.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type CreatePrintJobOptions = {
  requestedByStaffUserId?: string;
  reason?: string | null;
  reprint?: boolean;
  voidTicket?: boolean;
};

const DEFAULT_LIMIT = 50;

const TICKET_KIND_BY_TYPE: Record<KitchenTicketType, PrintJobKind> = {
  kitchen_order: PrintJobKind.kitchen_ticket,
  barista_order: PrintJobKind.barista_ticket,
  dessert_order: PrintJobKind.dessert_ticket,
  receipt: PrintJobKind.receipt,
  void: PrintJobKind.void_ticket,
  reprint: PrintJobKind.kitchen_ticket,
};

@Injectable()
export class PrintJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async createForKitchenTicket(
    ticketId: string,
    tx: Prisma.TransactionClient,
    options: CreatePrintJobOptions = {},
  ) {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: this.ticketPrintInclude(),
    });

    if (!ticket) {
      throw new NotFoundException('Kitchen ticket not found');
    }

    const printerStation = await this.findDefaultPrinterStation(
      ticket.branchId,
      ticket.station,
      tx,
    );
    const kind = options.voidTicket
      ? PrintJobKind.void_ticket
      : TICKET_KIND_BY_TYPE[ticket.type];
    const payload = this.renderTicketPayload(ticket, {
      kind,
      reason: options.reason,
      reprint: options.reprint,
      voidTicket: options.voidTicket,
    });
    const printJob = await tx.printJob.create({
      data: {
        companyId: ticket.companyId,
        branchId: ticket.branchId,
        printerStationId: printerStation?.id,
        kitchenTicketId: ticket.id,
        orderId: ticket.orderId,
        kind,
        status: PrintJobStatus.pending,
        payload: payload as Prisma.InputJsonValue,
        printableText: this.renderPrintableText(payload),
        requestedByStaffUserId: options.requestedByStaffUserId,
        events: {
          create: {
            status: options.reprint
              ? PrintJobStatus.reprint_requested
              : PrintJobStatus.pending,
            actorStaffUserId: options.requestedByStaffUserId,
            metadata: {
              source: options.reprint
                ? 'ticket_reprint'
                : options.voidTicket
                  ? 'ticket_void'
                  : 'ticket_created',
              ...(options.reason ? { reason: options.reason } : {}),
            },
          },
        },
      },
      select: { id: true },
    });

    await this.realtimeEventsService.recordPrintJobCreated(printJob.id, tx);

    if (options.reprint) {
      await this.realtimeEventsService.recordPrintJobReprintRequested(
        printJob.id,
        tx,
      );
    }

    return this.findOne(printJob.id, tx);
  }

  async createTestPrintForStation(
    printerStationId: string,
    staffUserId: string,
    tx: PrismaExecutor = this.prisma,
  ) {
    const printerStation = await tx.printerStation.findUnique({
      where: { id: printerStationId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
      },
    });

    if (!printerStation) {
      throw new NotFoundException('Printer station not found');
    }

    const payload = {
      title: 'MOCK TEST PRINT',
      printerStation: {
        id: printerStation.id,
        name: printerStation.name,
        slug: printerStation.slug,
        station: printerStation.station,
        adapterType: printerStation.adapterType,
      },
      branch: printerStation.branch,
      generatedAt: new Date().toISOString(),
    };
    const printJob = await tx.printJob.create({
      data: {
        companyId: printerStation.companyId,
        branchId: printerStation.branchId,
        printerStationId: printerStation.id,
        kind: PrintJobKind.receipt,
        status: PrintJobStatus.pending,
        payload,
        printableText: [
          printerStation.branch.name.toUpperCase(),
          'MOCK TEST PRINT',
          `Printer: ${printerStation.name}`,
          `Station: ${printerStation.station ?? 'generic'}`,
          `Time: ${new Date().toISOString()}`,
        ].join('\n'),
        requestedByStaffUserId: staffUserId,
        events: {
          create: {
            status: PrintJobStatus.pending,
            actorStaffUserId: staffUserId,
            metadata: { source: 'printer_station_test_print' },
          },
        },
      },
      select: { id: true },
    });

    await this.realtimeEventsService.recordPrintJobCreated(printJob.id, tx);

    return this.findOne(printJob.id, tx);
  }

  async findForBranch(
    branchId: string,
    query: BranchPrintJobsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const status = query.status ?? 'all';
    const station = query.station ?? 'all';
    const kind = query.kind ?? 'all';
    const stationFilter =
      station === 'all' ? undefined : (station as PreparationStation);
    const printJobs = await this.prisma.printJob.findMany({
      where: {
        branchId,
        ...(status === 'all' ? {} : { status: status as PrintJobStatus }),
        ...(kind === 'all' ? {} : { kind: kind as PrintJobKind }),
        ...(stationFilter
          ? {
              OR: [
                { printerStation: { station: stationFilter } },
                { kitchenTicket: { station: stationFilter } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: this.normalizeLimit(query.limit),
      include: this.printJobInclude(),
    });

    return {
      branch,
      filters: {
        status,
        station,
        kind,
        limit: this.normalizeLimit(query.limit),
      },
      printJobs: printJobs.map((printJob) => this.toPrintJobResponse(printJob)),
    };
  }

  async findOne(printJobId: string, tx: PrismaExecutor = this.prisma) {
    const printJob = await tx.printJob.findUnique({
      where: { id: printJobId },
      include: this.printJobInclude(),
    });

    if (!printJob) {
      throw new NotFoundException('Print job not found');
    }

    return this.toPrintJobResponse(printJob);
  }

  async markPrinting(printJobId: string, staffUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const printJob = await this.findPrintJobForMutation(printJobId, tx);

      if (
        !([
          PrintJobStatus.pending,
          PrintJobStatus.failed,
          PrintJobStatus.reprint_requested,
        ] as PrintJobStatus[]).includes(printJob.status)
      ) {
        throw this.printJobBadRequest('print_job_not_printable');
      }

      await tx.printJob.update({
        where: { id: printJob.id },
        data: {
          status: PrintJobStatus.printing,
          attemptCount: { increment: 1 },
          errorMessage: null,
          failedAt: null,
          events: {
            create: {
              status: PrintJobStatus.printing,
              actorStaffUserId: staffUserId,
            },
          },
        },
      });

      return this.findOne(printJob.id, tx);
    });
  }

  async markPrinted(printJobId: string, staffUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const printJob = await this.findPrintJobForMutation(printJobId, tx);

      if (
        !([PrintJobStatus.pending, PrintJobStatus.printing] as PrintJobStatus[]).includes(
          printJob.status,
        )
      ) {
        throw this.printJobBadRequest('print_job_not_printable');
      }

      const now = new Date();

      await tx.printJob.update({
        where: { id: printJob.id },
        data: {
          status: PrintJobStatus.printed,
          printedAt: now,
          events: {
            create: {
              status: PrintJobStatus.printed,
              actorStaffUserId: staffUserId,
            },
          },
        },
      });

      if (printJob.kitchenTicketId) {
        await tx.kitchenTicket.update({
          where: { id: printJob.kitchenTicketId },
          data: { printedAt: now },
        });
      }

      await this.realtimeEventsService.recordPrintJobPrinted(printJob.id, tx);

      return this.findOne(printJob.id, tx);
    });
  }

  async markFailed(
    printJobId: string,
    errorMessage?: string | null,
    staffUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const printJob = await this.findPrintJobForMutation(printJobId, tx);

      if (
        !([
          PrintJobStatus.pending,
          PrintJobStatus.printing,
          PrintJobStatus.failed,
        ] as PrintJobStatus[]).includes(printJob.status)
      ) {
        throw this.printJobBadRequest('print_job_not_failable');
      }

      const normalizedError =
        this.normalizeOptionalText(errorMessage) ?? 'Mock print failed';

      await tx.printJob.update({
        where: { id: printJob.id },
        data: {
          status: PrintJobStatus.failed,
          errorMessage: normalizedError,
          failedAt: new Date(),
          attemptCount:
            printJob.status === PrintJobStatus.printing
              ? undefined
              : { increment: 1 },
          events: {
            create: {
              status: PrintJobStatus.failed,
              actorStaffUserId: staffUserId,
              metadata: { errorMessage: normalizedError },
            },
          },
        },
      });

      await this.realtimeEventsService.recordPrintJobFailed(printJob.id, tx);

      return this.findOne(printJob.id, tx);
    });
  }

  async retry(printJobId: string, staffUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const printJob = await this.findPrintJobForMutation(printJobId, tx);

      if (
        !([
          PrintJobStatus.failed,
          PrintJobStatus.cancelled,
          PrintJobStatus.reprint_requested,
        ] as PrintJobStatus[]).includes(printJob.status)
      ) {
        throw this.printJobBadRequest('print_job_retry_not_allowed');
      }

      await tx.printJob.update({
        where: { id: printJob.id },
        data: {
          status: PrintJobStatus.pending,
          errorMessage: null,
          failedAt: null,
          events: {
            create: {
              status: PrintJobStatus.pending,
              actorStaffUserId: staffUserId,
              metadata: { source: 'retry' },
            },
          },
        },
      });

      return this.findOne(printJob.id, tx);
    });
  }

  async requestReprint(
    kitchenTicketId: string,
    staffUserId: string,
    reason?: string | null,
  ) {
    return this.prisma.$transaction((tx) =>
      this.createForKitchenTicket(kitchenTicketId, tx, {
        requestedByStaffUserId: staffUserId,
        reason: this.normalizeOptionalText(reason),
        reprint: true,
      }),
    );
  }

  private async findDefaultPrinterStation(
    branchId: string,
    station: PreparationStation,
    tx: PrismaExecutor,
  ) {
    const exactStation = await tx.printerStation.findFirst({
      where: {
        branchId,
        station,
        status: PrinterStationStatus.active,
        isDefault: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });

    if (exactStation) {
      return exactStation;
    }

    return tx.printerStation.findFirst({
      where: {
        branchId,
        station: null,
        status: PrinterStationStatus.active,
        isDefault: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
  }

  private async findPrintJobForMutation(
    printJobId: string,
    tx: PrismaExecutor,
  ) {
    const printJob = await tx.printJob.findUnique({
      where: { id: printJobId },
      select: {
        id: true,
        status: true,
        kitchenTicketId: true,
        branchId: true,
      },
    });

    if (!printJob) {
      throw new NotFoundException('Print job not found');
    }

    return printJob;
  }

  private renderTicketPayload(
    ticket: any,
    options: {
      kind: PrintJobKind;
      reason?: string | null;
      reprint?: boolean;
      voidTicket?: boolean;
    },
  ) {
    return {
      title: options.voidTicket
        ? 'VOID KITCHEN TICKET'
        : options.reprint
          ? 'REPRINT KITCHEN TICKET'
          : 'KITCHEN TICKET',
      kind: options.kind,
      ticket: {
        id: ticket.id,
        displayCode: ticket.displayCode,
        type: ticket.type,
        status: ticket.status,
        station: ticket.station,
        orderNumber: ticket.orderNumberSnapshot,
        tableCode: ticket.tableCodeSnapshot,
        floorName: ticket.floorNameSnapshot,
        customerNote: ticket.customerNoteSnapshot,
        createdAt: ticket.createdAt,
      },
      branch: ticket.branch,
      items: ticket.items.map((item: any) => ({
        id: item.id,
        orderItemId: item.orderItemId,
        itemName: item.itemNameSnapshot,
        itemSlug: item.itemSlugSnapshot,
        quantity: item.quantity,
        notes: item.notes,
        station: item.station,
        status: item.status,
        modifiers: item.modifiersSnapshot ?? [],
      })),
      reason: options.reason ?? null,
      reprint: options.reprint ?? false,
      voidTicket: options.voidTicket ?? false,
      generatedAt: new Date().toISOString(),
    };
  }

  private renderPrintableText(payload: any) {
    const lines = [
      String(payload.branch?.name ?? 'BALCONA BAR').toUpperCase(),
      payload.title,
      `Order: ${payload.ticket.orderNumber}`,
      `Ticket: ${payload.ticket.displayCode}`,
      `Table: ${payload.ticket.tableCode ?? 'Unassigned'}${
        payload.ticket.floorName ? ` / ${payload.ticket.floorName}` : ''
      }`,
      `Station: ${payload.ticket.station}`,
      `Time: ${new Date(payload.generatedAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      '',
      ...payload.items.flatMap((item: any) => [
        `${item.quantity}x ${item.itemName}`,
        ...(Array.isArray(item.modifiers)
          ? item.modifiers.map(
              (modifier: any) =>
                `  - ${modifier.groupName}: ${modifier.optionName}`,
            )
          : []),
        ...(item.notes ? [`  Note: ${item.notes}`] : []),
      ]),
      ...(payload.ticket.customerNote
        ? ['', 'Customer note:', payload.ticket.customerNote]
        : []),
      ...(payload.reason ? ['', `Reason: ${payload.reason}`] : []),
      '',
      `Ticket ID: ${payload.ticket.id}`,
    ];

    return lines.join('\n');
  }

  private printJobBadRequest(code: string) {
    return new BadRequestException({ code, message: code });
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), 100);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toPrintJobResponse(printJob: any) {
    const {
      company,
      branch,
      printerStation,
      kitchenTicket,
      order,
      events,
      ...printJobFields
    } = printJob;

    return {
      printJob: printJobFields,
      company,
      branch,
      printerStation,
      kitchenTicket,
      order,
      events,
    };
  }

  private printJobInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      printerStation: true,
      kitchenTicket: {
        select: {
          id: true,
          displayCode: true,
          type: true,
          status: true,
          station: true,
          orderNumberSnapshot: true,
          tableCodeSnapshot: true,
          floorNameSnapshot: true,
        },
      },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          tableSessionId: true,
        },
      },
      events: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
    } satisfies Prisma.PrintJobInclude;
  }

  private ticketPrintInclude() {
    return {
      branch: { select: this.branchSelect() },
      items: {
        orderBy: [{ createdAt: 'asc' as const }],
      },
    } satisfies Prisma.KitchenTicketInclude;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
    };
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    };
  }
}
