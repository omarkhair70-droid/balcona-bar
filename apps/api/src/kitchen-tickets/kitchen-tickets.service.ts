import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  KitchenTicketStatus,
  KitchenTicketType,
  OrderStatus,
  PreparationStation,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PrintJobsService } from "../print-jobs/print-jobs.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { BranchKitchenTicketsQueryDto } from "./dto/branch-kitchen-tickets-query.dto";

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

const ACTIONABLE_STATIONS: PreparationStation[] = [
  PreparationStation.barista,
  PreparationStation.kitchen,
  PreparationStation.dessert,
];
const DEFAULT_LIMIT = 50;

const TICKET_TYPE_BY_STATION: Record<PreparationStation, KitchenTicketType> = {
  [PreparationStation.barista]: KitchenTicketType.barista_order,
  [PreparationStation.kitchen]: KitchenTicketType.kitchen_order,
  [PreparationStation.dessert]: KitchenTicketType.dessert_order,
  [PreparationStation.cashier]: KitchenTicketType.receipt,
};

const DISPLAY_PREFIX_BY_STATION: Record<PreparationStation, string> = {
  [PreparationStation.barista]: "B",
  [PreparationStation.kitchen]: "K",
  [PreparationStation.dessert]: "D",
  [PreparationStation.cashier]: "R",
};

export type KitchenTicketRoutingResult = {
  ticketIds: string[];
  itemCount: number;
  actionableItemCount: number;
  stationsDetected: PreparationStation[];
  skippedItems: {
    orderItemId: string;
    station: PreparationStation;
    reason: "non_actionable_station";
  }[];
  createdTicketCount: number;
  existingTicketCount: number;
};

export type KitchenTicketOrderSnapshot = {
  id: string;
  companyId: string;
  branchId: string;
  tableSessionId: string;
  orderNumber: string;
  status: OrderStatus;
  customerNote: string | null;
  tableSession: {
    table: {
      code: string;
      displayName: string | null;
      floor: { name: string } | null;
    };
  };
  items: {
    id: string;
    menuItemId: string;
    quantity: number;
    notes: string | null;
    itemNameSnapshot: string;
    itemSlugSnapshot: string;
    menuItem: { station: PreparationStation };
    modifierOptions: {
      modifierGroupId: string;
      modifierOptionId: string;
      modifierGroupNameSnapshot: string;
      modifierGroupSlugSnapshot: string;
      modifierOptionNameSnapshot: string;
      modifierOptionSlugSnapshot: string;
      priceDeltaMinorSnapshot: number;
    }[];
    preparationTask?: { id: string } | null;
  }[];
};

type CreateTicketsForAcceptedOrderOptions = {
  createPrintJobs?: boolean;
  recordRealtimeEvents?: boolean;
};

type SyncTicketsForTaskOptions = {
  createPrintJobs?: boolean;
  recordRealtimeEvents?: boolean;
};

export type KitchenTicketTaskSyncResult = {
  ticketId: string;
  realtimeEvent: "updated" | "ready" | "cancelled";
  status: KitchenTicketStatus;
  voidTicket?: boolean;
};

@Injectable()
export class KitchenTicketsService {
  private readonly logger = new Logger(KitchenTicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly printJobsService: PrintJobsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async createTicketsForAcceptedOrder(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
    options: CreateTicketsForAcceptedOrderOptions = {},
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        tableSessionId: true,
        orderNumber: true,
        status: true,
        customerNote: true,
        tableSession: {
          select: {
            table: {
              select: {
                code: true,
                displayName: true,
                floor: { select: { name: true } },
              },
            },
          },
        },
        items: {
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            notes: true,
            itemNameSnapshot: true,
            itemSlugSnapshot: true,
            menuItem: { select: { station: true } },
            modifierOptions: {
              orderBy: [{ createdAt: "asc" }],
              select: {
                modifierGroupId: true,
                modifierOptionId: true,
                modifierGroupNameSnapshot: true,
                modifierGroupSlugSnapshot: true,
                modifierOptionNameSnapshot: true,
                modifierOptionSlugSnapshot: true,
                priceDeltaMinorSnapshot: true,
              },
            },
            preparationTask: { select: { id: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const taskIdByOrderItemId = new Map<string, string>();
    const actionableMissingTaskIds = order.items
      .filter((item) => {
        const taskId = item.preparationTask?.id;

        if (taskId) {
          taskIdByOrderItemId.set(item.id, taskId);
          return false;
        }

        return ACTIONABLE_STATIONS.includes(item.menuItem.station);
      })
      .map((item) => item.id);

    if (actionableMissingTaskIds.length > 0) {
      const tasks = await tx.preparationTask.findMany({
        where: {
          orderId: order.id,
          orderItemId: { in: actionableMissingTaskIds },
        },
        select: { id: true, orderItemId: true },
      });

      for (const task of tasks) {
        taskIdByOrderItemId.set(task.orderItemId, task.id);
      }
    }

    return this.createTicketsForAcceptedOrderSnapshot(
      order,
      taskIdByOrderItemId,
      staffUserId,
      tx,
      options,
    );
  }

  async createTicketsForAcceptedOrderSnapshot(
    order: KitchenTicketOrderSnapshot,
    taskIdByOrderItemId: Map<string, string>,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
    options: CreateTicketsForAcceptedOrderOptions = {},
  ) {
    const startedAt = Date.now();
    const timings = {
      existingTicketLookupMs: 0,
      ticketCreateMs: 0,
      criticalSideEffectsMs: 0,
    };

    if (order.status !== OrderStatus.cashier_accepted) {
      return this.emptyRoutingResult(
        order.id,
        order.branchId,
        order.items.length,
      );
    }

    const itemsByStation = new Map<PreparationStation, typeof order.items>();
    const skippedItems: KitchenTicketRoutingResult["skippedItems"] = [];

    for (const item of order.items) {
      const station = item.menuItem.station;

      const taskId = item.preparationTask?.id;

      if (taskId && !taskIdByOrderItemId.has(item.id)) {
        taskIdByOrderItemId.set(item.id, taskId);
      }

      if (!ACTIONABLE_STATIONS.includes(station)) {
        skippedItems.push({
          orderItemId: item.id,
          station,
          reason: "non_actionable_station",
        });
        continue;
      }

      itemsByStation.set(station, [
        ...(itemsByStation.get(station) ?? []),
        item,
      ]);
    }

    const actionableItems = [...itemsByStation.values()].flat();
    const ticketIds: string[] = [];
    let createdTicketCount = 0;
    let existingTicketCount = 0;

    for (const [station, stationItems] of itemsByStation.entries()) {
      const type = TICKET_TYPE_BY_STATION[station];
      let stageStartedAt = Date.now();
      const existingTicket = await tx.kitchenTicket.findUnique({
        where: {
          orderId_station_type: {
            orderId: order.id,
            station,
            type,
          },
        },
        select: { id: true },
      });
      timings.existingTicketLookupMs += Date.now() - stageStartedAt;

      if (existingTicket) {
        ticketIds.push(existingTicket.id);
        existingTicketCount += 1;
        continue;
      }

      stageStartedAt = Date.now();
      const ticket = await this.createTicketWithSequenceRetry({
        order,
        station,
        type,
        stationItems,
        taskIdByOrderItemId,
        tx,
      });
      timings.ticketCreateMs += Date.now() - stageStartedAt;

      stageStartedAt = Date.now();
      if (options.recordRealtimeEvents ?? true) {
        await this.realtimeEventsService.recordKitchenTicketCreated(
          ticket.id,
          tx,
        );
      }
      if (options.createPrintJobs ?? true) {
        await this.printJobsService.createForKitchenTicket(ticket.id, tx, {
          requestedByStaffUserId: staffUserId,
        });
      }
      timings.criticalSideEffectsMs += Date.now() - stageStartedAt;
      ticketIds.push(ticket.id);
      createdTicketCount += 1;
    }

    const result: KitchenTicketRoutingResult = {
      ticketIds,
      itemCount: order.items.length,
      actionableItemCount: actionableItems.length,
      stationsDetected: [...itemsByStation.keys()],
      skippedItems,
      createdTicketCount,
      existingTicketCount,
    };

    this.logger.log({
      message: "kds.create_tickets_for_order",
      orderId: order.id,
      branchId: order.branchId,
      itemCount: result.itemCount,
      actionableItemCount: result.actionableItemCount,
      stationsDetected: result.stationsDetected,
      createdTicketCount,
      existingTicketCount,
      ticketCount: ticketIds.length,
      skippedItemCount: skippedItems.length,
      durationMs: Date.now() - startedAt,
      timings,
      zeroTicketReason:
        result.actionableItemCount > 0 && ticketIds.length === 0
          ? "actionable_items_without_tickets"
          : undefined,
    });

    if (result.actionableItemCount > 0 && ticketIds.length === 0) {
      throw new BadRequestException({
        message: "Kitchen routing failed for accepted order",
        code: "kds_routing_failed",
        details: {
          orderId: order.id,
          branchId: order.branchId,
          actionableItemCount: result.actionableItemCount,
          stationsDetected: result.stationsDetected,
          createdTicketCount,
          existingTicketCount,
          ticketCount: ticketIds.length,
          skippedItems: {
            count: skippedItems.length,
            reasons: [...new Set(skippedItems.map((item) => item.reason))],
          },
        },
      });
    }

    return result;
  }

  private emptyRoutingResult(
    orderId: string,
    branchId: string,
    itemCount: number,
  ): KitchenTicketRoutingResult {
    this.logger.warn({
      message: "kds.create_tickets_for_order_skipped",
      orderId,
      branchId,
      itemCount,
      reason: "order_not_cashier_accepted",
    });

    return {
      ticketIds: [],
      itemCount,
      actionableItemCount: 0,
      stationsDetected: [],
      skippedItems: [],
      createdTicketCount: 0,
      existingTicketCount: 0,
    };
  }

  async createPrintJobsForTickets(
    ticketIds: string[],
    staffUserId: string | undefined,
  ) {
    let createdCount = 0;

    for (const ticketId of ticketIds) {
      await this.prisma.$transaction(async (tx) => {
        await this.printJobsService.createForKitchenTicket(ticketId, tx, {
          requestedByStaffUserId: staffUserId,
        });
      });
      createdCount += 1;
    }

    return createdCount;
  }

  async createVoidPrintJobForTicket(
    ticketId: string,
    staffUserId: string | undefined,
    reason?: string | null,
  ) {
    return this.prisma.$transaction((tx) =>
      this.printJobsService.createForKitchenTicket(ticketId, tx, {
        requestedByStaffUserId: staffUserId,
        reason,
        voidTicket: true,
      }),
    );
  }

  async recordCreatedRealtimeEventsForTickets(
    ticketIds: string[],
    tx: PrismaExecutor = this.prisma,
  ) {
    for (const ticketId of ticketIds) {
      await this.realtimeEventsService.recordKitchenTicketCreated(ticketId, tx);
    }

    return ticketIds.length;
  }

  async findForBranch(
    branchId: string,
    query: BranchKitchenTicketsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: this.branchSelect(),
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const station = query.station ?? "all";
    const status = query.status ?? "all";
    const type = query.type ?? "all";
    const tickets = await this.prisma.kitchenTicket.findMany({
      where: {
        branchId,
        ...(station === "all"
          ? {}
          : { station: station as PreparationStation }),
        ...(status === "all" ? {} : { status: status as KitchenTicketStatus }),
        ...(type === "all" ? {} : { type: type as KitchenTicketType }),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: this.normalizeLimit(query.limit),
      include: this.ticketInclude(),
    });

    return {
      branch,
      filters: {
        station,
        status,
        type,
        limit: this.normalizeLimit(query.limit),
      },
      tickets: tickets.map((ticket) => this.toTicketResponse(ticket)),
    };
  }

  async findOne(ticketId: string, tx: PrismaExecutor = this.prisma) {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: this.ticketInclude(),
    });

    if (!ticket) {
      throw new NotFoundException("Kitchen ticket not found");
    }

    return this.toTicketResponse(ticket);
  }

  async requestReprint(
    ticketId: string,
    staffUserId: string,
    reason?: string | null,
  ) {
    return this.printJobsService.requestReprint(ticketId, staffUserId, reason);
  }

  async syncTicketsForTaskStarted(
    taskId: string,
    tx: Prisma.TransactionClient,
    options: SyncTicketsForTaskOptions = {},
  ) {
    const startedAt = Date.now();
    const timings = {
      ticketItemLookupMs: 0,
      ticketItemUpdateMs: 0,
      ticketUpdateMs: 0,
      realtimeMs: 0,
    };
    let stageStartedAt = Date.now();
    const item = await this.findTicketItemForTask(taskId, tx);
    timings.ticketItemLookupMs += Date.now() - stageStartedAt;

    if (!item) {
      return undefined;
    }

    stageStartedAt = Date.now();
    await tx.kitchenTicketItem.update({
      where: { id: item.id },
      data: { status: KitchenTicketStatus.in_progress },
    });
    timings.ticketItemUpdateMs += Date.now() - stageStartedAt;

    let status = item.ticket.status;
    if (item.ticket.status === KitchenTicketStatus.queued) {
      stageStartedAt = Date.now();
      await tx.kitchenTicket.update({
        where: { id: item.ticketId },
        data: { status: KitchenTicketStatus.in_progress },
      });
      timings.ticketUpdateMs += Date.now() - stageStartedAt;
      status = KitchenTicketStatus.in_progress;
    }

    if (options.recordRealtimeEvents ?? true) {
      stageStartedAt = Date.now();
      await this.realtimeEventsService.recordKitchenTicketUpdated(
        item.ticketId,
        tx,
      );
      timings.realtimeMs += Date.now() - stageStartedAt;
    }

    this.logger.log({
      message: "kds.sync_ticket_for_task_started",
      taskId,
      ticketId: item.ticketId,
      status,
      durationMs: Date.now() - startedAt,
      timings,
    });

    return {
      ticketId: item.ticketId,
      realtimeEvent: "updated" as const,
      status,
    };
  }

  async syncTicketsForTaskReady(
    taskId: string,
    tx: Prisma.TransactionClient,
    options: SyncTicketsForTaskOptions = {},
  ) {
    const startedAt = Date.now();
    const timings = {
      ticketItemLookupMs: 0,
      ticketItemUpdateMs: 0,
      aggregateSyncMs: 0,
    };
    let stageStartedAt = Date.now();
    const item = await this.findTicketItemForTask(taskId, tx);
    timings.ticketItemLookupMs += Date.now() - stageStartedAt;

    if (!item) {
      return undefined;
    }

    stageStartedAt = Date.now();
    await tx.kitchenTicketItem.update({
      where: { id: item.id },
      data: { status: KitchenTicketStatus.ready },
    });
    timings.ticketItemUpdateMs += Date.now() - stageStartedAt;

    stageStartedAt = Date.now();
    const result = await this.syncTicketAggregateStatus(
      item.ticketId,
      tx,
      options,
    );
    timings.aggregateSyncMs += Date.now() - stageStartedAt;

    this.logger.log({
      message: "kds.sync_ticket_for_task_ready",
      taskId,
      ticketId: item.ticketId,
      status: result?.status,
      realtimeEvent: result?.realtimeEvent,
      durationMs: Date.now() - startedAt,
      timings,
    });

    return result;
  }

  async syncTicketsForTaskCancelled(
    taskId: string,
    reason: string | null,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
    options: SyncTicketsForTaskOptions = {},
  ) {
    const startedAt = Date.now();
    const timings = {
      ticketItemLookupMs: 0,
      ticketItemUpdateMs: 0,
      aggregateSyncMs: 0,
      printJobMs: 0,
    };
    let stageStartedAt = Date.now();
    const item = await this.findTicketItemForTask(taskId, tx);
    timings.ticketItemLookupMs += Date.now() - stageStartedAt;

    if (!item) {
      return undefined;
    }

    stageStartedAt = Date.now();
    await tx.kitchenTicketItem.update({
      where: { id: item.id },
      data: { status: KitchenTicketStatus.cancelled },
    });
    timings.ticketItemUpdateMs += Date.now() - stageStartedAt;

    stageStartedAt = Date.now();
    const ticket = await this.syncTicketAggregateStatus(
      item.ticketId,
      tx,
      options,
    );
    timings.aggregateSyncMs += Date.now() - stageStartedAt;

    if (
      ticket?.status === KitchenTicketStatus.cancelled &&
      (options.createPrintJobs ?? true)
    ) {
      stageStartedAt = Date.now();
      await this.printJobsService.createForKitchenTicket(item.ticketId, tx, {
        requestedByStaffUserId: staffUserId,
        reason,
        voidTicket: true,
      });
      timings.printJobMs += Date.now() - stageStartedAt;

      ticket.voidTicket = true;
    }

    this.logger.log({
      message: "kds.sync_ticket_for_task_cancelled",
      taskId,
      ticketId: item.ticketId,
      status: ticket?.status,
      realtimeEvent: ticket?.realtimeEvent,
      voidTicket: ticket?.voidTicket,
      durationMs: Date.now() - startedAt,
      timings,
    });

    return ticket;
  }

  async syncTicketsForOrderCancelled(
    orderId: string,
    staffUserId: string,
    reason: string,
    tx: Prisma.TransactionClient,
  ) {
    const tickets = await tx.kitchenTicket.findMany({
      where: {
        orderId,
        status: {
          notIn: [
            KitchenTicketStatus.cancelled,
            KitchenTicketStatus.voided,
            KitchenTicketStatus.served,
          ],
        },
      },
      select: { id: true },
    });

    for (const ticket of tickets) {
      await tx.kitchenTicket.update({
        where: { id: ticket.id },
        data: {
          status: KitchenTicketStatus.cancelled,
          cancelledAt: new Date(),
        },
      });
      await tx.kitchenTicketItem.updateMany({
        where: { ticketId: ticket.id },
        data: { status: KitchenTicketStatus.cancelled },
      });
      await this.realtimeEventsService.recordKitchenTicketCancelled(
        ticket.id,
        tx,
      );
      await this.printJobsService.createForKitchenTicket(ticket.id, tx, {
        requestedByStaffUserId: staffUserId,
        reason,
        voidTicket: true,
      });
    }

    return tickets.length;
  }

  async syncTicketsForOrderServed(
    orderId: string,
    tx: Prisma.TransactionClient,
  ) {
    const tickets = await tx.kitchenTicket.findMany({
      where: {
        orderId,
        status: KitchenTicketStatus.ready,
      },
      select: { id: true },
    });

    for (const ticket of tickets) {
      await tx.kitchenTicket.update({
        where: { id: ticket.id },
        data: {
          status: KitchenTicketStatus.served,
          servedAt: new Date(),
        },
      });
      await this.realtimeEventsService.recordKitchenTicketUpdated(
        ticket.id,
        tx,
      );
    }

    return tickets.length;
  }

  getTicketLifecycleSummary(ticket: any) {
    const printJobs = ticket.printJobs ?? [];
    const items = ticket.items ?? [];

    return {
      status: ticket.status,
      isTerminal: [
        KitchenTicketStatus.served,
        KitchenTicketStatus.cancelled,
        KitchenTicketStatus.voided,
      ].includes(ticket.status),
      itemCount: items.length,
      readyItemCount: items.filter(
        (item: any) => item.status === KitchenTicketStatus.ready,
      ).length,
      cancelledItemCount: items.filter(
        (item: any) => item.status === KitchenTicketStatus.cancelled,
      ).length,
      printJobsTotal: printJobs.length,
      printJobsPending: printJobs.filter((job: any) => job.status === "pending")
        .length,
      printJobsPrinted: printJobs.filter((job: any) => job.status === "printed")
        .length,
      printJobsFailed: printJobs.filter((job: any) => job.status === "failed")
        .length,
    };
  }

  private async syncTicketAggregateStatus(
    ticketId: string,
    tx: Prisma.TransactionClient,
    options: SyncTicketsForTaskOptions = {},
  ): Promise<KitchenTicketTaskSyncResult | undefined> {
    const ticket = await tx.kitchenTicket.findUnique({
      where: { id: ticketId },
      include: { items: true },
    });

    if (!ticket) {
      return undefined;
    }

    const activeItems = ticket.items.filter(
      (item) => item.status !== KitchenTicketStatus.cancelled,
    );
    const now = new Date();

    if (ticket.items.length > 0 && activeItems.length === 0) {
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status: KitchenTicketStatus.cancelled,
          cancelledAt: now,
        },
      });
      if (options.recordRealtimeEvents ?? true) {
        await this.realtimeEventsService.recordKitchenTicketCancelled(
          ticketId,
          tx,
        );
      }

      return {
        ticketId,
        realtimeEvent: "cancelled",
        status: KitchenTicketStatus.cancelled,
        voidTicket: true,
      };
    }

    if (
      activeItems.length > 0 &&
      activeItems.every((item) => item.status === KitchenTicketStatus.ready)
    ) {
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: {
          status: KitchenTicketStatus.ready,
          readyAt: now,
        },
      });
      if (options.recordRealtimeEvents ?? true) {
        await this.realtimeEventsService.recordKitchenTicketReady(ticketId, tx);
      }

      return {
        ticketId,
        realtimeEvent: "ready",
        status: KitchenTicketStatus.ready,
      };
    }

    let status = ticket.status;
    if (
      ticket.status === KitchenTicketStatus.queued &&
      activeItems.some(
        (item) => item.status === KitchenTicketStatus.in_progress,
      )
    ) {
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: { status: KitchenTicketStatus.in_progress },
      });
      status = KitchenTicketStatus.in_progress;
    }

    if (options.recordRealtimeEvents ?? true) {
      await this.realtimeEventsService.recordKitchenTicketUpdated(ticketId, tx);
    }

    return {
      ticketId,
      realtimeEvent: "updated",
      status,
    };
  }

  private async findTicketItemForTask(
    taskId: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.kitchenTicketItem.findFirst({
      where: { preparationTaskId: taskId },
      select: {
        id: true,
        ticketId: true,
        ticket: {
          select: {
            status: true,
          },
        },
      },
    });
  }

  private async createTicketWithSequenceRetry({
    order,
    station,
    type,
    stationItems,
    taskIdByOrderItemId,
    tx,
  }: {
    order: any;
    station: PreparationStation;
    type: KitchenTicketType;
    stationItems: any[];
    taskIdByOrderItemId: Map<string, string>;
    tx: Prisma.TransactionClient;
  }) {
    const baseSequence = await this.nextTicketSequence(order.branchId, tx);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const sequence = baseSequence + attempt;
      const displayCode = this.formatDisplayCode(station, sequence);

      try {
        return await tx.kitchenTicket.create({
          data: {
            companyId: order.companyId,
            branchId: order.branchId,
            orderId: order.id,
            tableSessionId: order.tableSessionId,
            station,
            type,
            status: KitchenTicketStatus.queued,
            displayCode,
            sequence,
            orderNumberSnapshot: order.orderNumber,
            tableCodeSnapshot:
              order.tableSession.table.displayName ??
              order.tableSession.table.code,
            floorNameSnapshot: order.tableSession.table.floor?.name,
            customerNoteSnapshot: order.customerNote,
            items: {
              create: stationItems.map((item) => ({
                orderItemId: item.id,
                preparationTaskId: taskIdByOrderItemId.get(item.id),
                menuItemId: item.menuItemId,
                itemNameSnapshot: item.itemNameSnapshot,
                itemSlugSnapshot: item.itemSlugSnapshot,
                quantity: item.quantity,
                notes: item.notes,
                modifiersSnapshot: item.modifierOptions.map((modifier) => ({
                  groupId: modifier.modifierGroupId,
                  optionId: modifier.modifierOptionId,
                  groupName: modifier.modifierGroupNameSnapshot,
                  groupSlug: modifier.modifierGroupSlugSnapshot,
                  optionName: modifier.modifierOptionNameSnapshot,
                  optionSlug: modifier.modifierOptionSlugSnapshot,
                  priceDeltaMinor: modifier.priceDeltaMinorSnapshot,
                })),
                station,
                status: KitchenTicketStatus.queued,
              })),
            },
          },
          select: { id: true },
        });
      } catch (error) {
        if (!this.isUniqueDisplayCodeCollision(error) || attempt === 4) {
          throw error;
        }
      }
    }

    throw new BadRequestException({
      message: "Kitchen routing failed for accepted order",
      code: "kds_routing_failed",
      details: {
        reason: "ticket_sequence_collision",
        orderId: order.id,
        branchId: order.branchId,
        station,
        type,
      },
    });
  }

  private async nextTicketSequence(
    branchId: string,
    tx: Prisma.TransactionClient,
  ) {
    const aggregate = await tx.kitchenTicket.aggregate({
      where: { branchId },
      _max: { sequence: true },
    });

    return (aggregate._max.sequence ?? 0) + 1;
  }

  private isUniqueDisplayCodeCollision(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== "P2002") {
      return false;
    }

    const target = error.meta?.target;

    return Array.isArray(target)
      ? target.includes("branchId") && target.includes("displayCode")
      : String(target ?? "").includes("displayCode");
  }

  private formatDisplayCode(station: PreparationStation, sequence: number) {
    return `${DISPLAY_PREFIX_BY_STATION[station]}${String(sequence).padStart(4, "0")}`;
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_LIMIT, 1), 100);
  }

  private toTicketResponse(ticket: any) {
    const {
      company,
      branch,
      order,
      tableSession,
      items,
      printJobs,
      ...ticketFields
    } = ticket;
    const { table, ...tableSessionFields } = tableSession;
    const { floor, ...tableFields } = table;

    return {
      ticket: ticketFields,
      company,
      branch,
      order,
      tableSession: tableSessionFields,
      table: tableFields,
      floor,
      items,
      printJobs,
      lifecycle: this.getTicketLifecycleSummary({
        ...ticketFields,
        items,
        printJobs,
      }),
    };
  }

  private ticketInclude() {
    return {
      company: { select: this.companySelect() },
      branch: { select: this.branchSelect() },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          customerNote: true,
          readyAt: true,
          servedAt: true,
          createdAt: true,
        },
      },
      tableSession: {
        select: {
          id: true,
          status: true,
          guestLabel: true,
          table: {
            select: {
              id: true,
              code: true,
              displayName: true,
              floor: {
                select: {
                  id: true,
                  name: true,
                  sortOrder: true,
                },
              },
            },
          },
        },
      },
      items: {
        orderBy: [{ createdAt: "asc" as const }],
        include: {
          preparationTask: {
            select: {
              id: true,
              status: true,
              startedAt: true,
              readyAt: true,
              cancelledAt: true,
            },
          },
        },
      },
      printJobs: {
        orderBy: [{ createdAt: "desc" as const }],
        include: {
          printerStation: true,
        },
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
