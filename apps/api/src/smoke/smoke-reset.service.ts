import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SMOKE_BOOTSTRAP_IDENTIFIERS } from "./smoke-bootstrap.constants";

type DeleteCounts = Record<string, number>;
type PrismaExecutor = PrismaService | Prisma.TransactionClient;
type SmokeResetTarget = {
  company: { id: string; slug: string } | null;
  branch: { id: string; slug: string } | null;
};
type SmokeResetScope = {
  companyId: string;
  branchId: string;
};
type SmokeResetIds = {
  tableSessionIds: string[];
  cartIds: string[];
  cartItemIds: string[];
  aiWaiterSessionIds: string[];
  aiWaiterMessageIds: string[];
  orderIds: string[];
  orderItemIds: string[];
  preparationTaskIds: string[];
  kitchenTicketIds: string[];
  printJobIds: string[];
  waiterCallIds: string[];
  billRequestIds: string[];
  billIds: string[];
  onlinePaymentIntentIds: string[];
  notificationIds: string[];
  customerSessionIdentityIds: string[];
  tableAttentionSnapshotIds: string[];
};
type SmokeResetPhaseResult = {
  phase: string;
  durationMs: number;
  deleted: DeleteCounts;
};

const smokeResetPhaseTransactionOptions = {
  maxWait: 10_000,
  timeout: 30_000,
};

@Injectable()
export class SmokeResetService {
  private readonly logger = new Logger(SmokeResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smokeBootstrapService: SmokeBootstrapService,
  ) {}

  async reset(providedToken: string | undefined, requestId?: string) {
    this.smokeBootstrapService.assertBootstrapAllowed(providedToken);

    const resetAt = new Date();
    const target = await this.resolveSmokeTarget(this.prisma);

    this.logger.log({
      message: "smoke_reset_started",
      requestId,
      companyId: target.company?.id ?? null,
      branchId: target.branch?.id ?? null,
    });

    if (!target.company || !target.branch) {
      return {
        resetAt,
        company: target.company,
        branch: target.branch,
        deleted: {},
        phases: [],
        preserved: this.preservedData(),
        safety: this.safetySummary(),
      };
    }

    const scope = {
      companyId: target.company.id,
      branchId: target.branch.id,
    };
    let resetIds: SmokeResetIds;

    try {
      resetIds = await this.collectSmokeOperationalIds(scope);
    } catch (error) {
      this.logResetFailure({
        requestId,
        scope,
        phase: "collect_ids",
        durationMs: 0,
        error,
      });
      throw error;
    }

    const deleted: DeleteCounts = {};
    const phases: SmokeResetPhaseResult[] = [];

    for (const phase of this.resetPhases(scope, resetIds)) {
      const result = await this.runPhase({
        requestId,
        scope,
        phase: phase.name,
        run: phase.run,
      });

      phases.push(result);
      this.mergeDeletedCounts(deleted, result.deleted);
    }

    return {
      resetAt,
      company: target.company,
      branch: target.branch,
      deleted,
      phases,
      preserved: this.preservedData(),
      safety: this.safetySummary(),
    };
  }

  private async resolveSmokeTarget(
    tx: PrismaExecutor,
  ): Promise<SmokeResetTarget> {
    const company = await tx.company.findUnique({
      where: { slug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug },
      select: { id: true, slug: true },
    });

    if (!company) {
      return { company: null, branch: null };
    }

    const branch = await tx.branch.findUnique({
      where: {
        companyId_slug: {
          companyId: company.id,
          slug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
        },
      },
      select: { id: true, slug: true },
    });

    return { company, branch };
  }

  private async collectSmokeOperationalIds(
    scope: SmokeResetScope,
  ): Promise<SmokeResetIds> {
    const { companyId, branchId } = scope;
    const [
      tableSessionIds,
      cartIds,
      aiWaiterSessionIds,
      orderIds,
      preparationTaskIds,
      kitchenTicketIds,
      printJobIds,
      waiterCallIds,
      billRequestIds,
      billIds,
      onlinePaymentIntentIds,
      notificationIds,
      customerSessionIdentityIds,
      tableAttentionSnapshotIds,
    ] = await Promise.all([
      this.ids(
        this.prisma.tableSession.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.cart.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.aiWaiterSession.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.order.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.preparationTask.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.kitchenTicket.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.printJob.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.waiterCall.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.billRequest.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.bill.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.onlinePaymentIntent.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.notification.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.customerSessionIdentity.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.tableAttentionSnapshot.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
    ]);
    const [cartItemIds, aiWaiterMessageIds, orderItemIds] = await Promise.all([
      this.ids(
        this.prisma.cartItem.findMany({
          where: { cartId: { in: cartIds } },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.aiWaiterMessage.findMany({
          where: { companyId, branchId },
          select: { id: true },
        }),
      ),
      this.ids(
        this.prisma.orderItem.findMany({
          where: { orderId: { in: orderIds } },
          select: { id: true },
        }),
      ),
    ]);

    return {
      tableSessionIds,
      cartIds,
      cartItemIds,
      aiWaiterSessionIds,
      aiWaiterMessageIds,
      orderIds,
      orderItemIds,
      preparationTaskIds,
      kitchenTicketIds,
      printJobIds,
      waiterCallIds,
      billRequestIds,
      billIds,
      onlinePaymentIntentIds,
      notificationIds,
      customerSessionIdentityIds,
      tableAttentionSnapshotIds,
    };
  }

  private resetPhases(scope: SmokeResetScope, ids: SmokeResetIds) {
    const { companyId, branchId } = scope;

    return [
      {
        name: "realtime_notifications_print_attention_presence_device",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "realtimeEvents",
            tx.realtimeEvent.deleteMany({
              where: {
                companyId,
                OR: [
                  { branchId },
                  { tableSessionId: { in: ids.tableSessionIds } },
                  { orderId: { in: ids.orderIds } },
                  { preparationTaskId: { in: ids.preparationTaskIds } },
                  { waiterCallId: { in: ids.waiterCallIds } },
                  { billRequestId: { in: ids.billRequestIds } },
                  { notificationId: { in: ids.notificationIds } },
                ],
              },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "notificationDeliveries",
            tx.notificationDelivery.deleteMany({
              where: { notificationId: { in: ids.notificationIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "notifications",
            tx.notification.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "printJobEvents",
            tx.printJobEvent.deleteMany({
              where: { printJobId: { in: ids.printJobIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "printJobs",
            tx.printJob.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "tableAttentionEvents",
            tx.tableAttentionEvent.deleteMany({
              where: {
                OR: [
                  { companyId, branchId },
                  { tableSessionId: { in: ids.tableSessionIds } },
                  { snapshotId: { in: ids.tableAttentionSnapshotIds } },
                ],
              },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "tableAttentionSnapshots",
            tx.tableAttentionSnapshot.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "presenceEvents",
            tx.presenceEvent.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "deviceSubscriptions",
            tx.deviceSubscription.deleteMany({
              where: { companyId, branchId },
            }),
          );
        },
      },
      {
        name: "kitchen_tickets_preparation_tasks",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "kitchenTicketItems",
            tx.kitchenTicketItem.deleteMany({
              where: { ticketId: { in: ids.kitchenTicketIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "kitchenTickets",
            tx.kitchenTicket.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "preparationTaskEvents",
            tx.preparationTaskEvent.deleteMany({
              where: { preparationTaskId: { in: ids.preparationTaskIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "preparationTasks",
            tx.preparationTask.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "waiter_calls",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "waiterCallEvents",
            tx.waiterCallEvent.deleteMany({
              where: { waiterCallId: { in: ids.waiterCallIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "waiterCalls",
            tx.waiterCall.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "bills_bill_requests_payments_receipts",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "onlinePaymentReconciliationIssues",
            tx.onlinePaymentReconciliationIssue.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentReconciliationEntries",
            tx.onlinePaymentReconciliationEntry.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentReconciliationRuns",
            tx.onlinePaymentReconciliationRun.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentSettlementBatches",
            tx.onlinePaymentSettlementBatch.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentEvents",
            tx.onlinePaymentEvent.deleteMany({
              where: {
                OR: [
                  { companyId, branchId },
                  {
                    onlinePaymentIntentId: {
                      in: ids.onlinePaymentIntentIds,
                    },
                  },
                  { billId: { in: ids.billIds } },
                ],
              },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentOperations",
            tx.onlinePaymentOperation.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "onlinePaymentIntents",
            tx.onlinePaymentIntent.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "manualPayments",
            tx.manualPayment.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "billReceipts",
            tx.billReceipt.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "billEvents",
            tx.billEvent.deleteMany({ where: { billId: { in: ids.billIds } } }),
          );
          await this.deleteAndCount(
            deleted,
            "billLines",
            tx.billLine.deleteMany({ where: { billId: { in: ids.billIds } } }),
          );
          await this.deleteAndCount(
            deleted,
            "bills",
            tx.bill.deleteMany({ where: { companyId, branchId } }),
          );
          await this.deleteAndCount(
            deleted,
            "billRequestEvents",
            tx.billRequestEvent.deleteMany({
              where: { billRequestId: { in: ids.billRequestIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "billRequests",
            tx.billRequest.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "orders_order_items_events_modifiers",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "orderEvents",
            tx.orderEvent.deleteMany({
              where: { orderId: { in: ids.orderIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "orderItemModifierOptions",
            tx.orderItemModifierOption.deleteMany({
              where: { orderItemId: { in: ids.orderItemIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "orderItems",
            tx.orderItem.deleteMany({
              where: { orderId: { in: ids.orderIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "orders",
            tx.order.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "ai_waiter_sessions_messages_proposals_usage",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "aiWaiterToolCalls",
            tx.aiWaiterToolCall.deleteMany({
              where: {
                OR: [
                  { companyId, branchId },
                  { aiWaiterSessionId: { in: ids.aiWaiterSessionIds } },
                  { messageId: { in: ids.aiWaiterMessageIds } },
                ],
              },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "aiWaiterMessages",
            tx.aiWaiterMessage.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "aiWaiterCartProposals",
            tx.aiWaiterCartProposal.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "aiWaiterUsageEvents",
            tx.aiWaiterUsageEvent.deleteMany({
              where: { companyId, branchId },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "aiWaiterSessions",
            tx.aiWaiterSession.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "carts_cart_items_modifiers",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "cartItemModifierOptions",
            tx.cartItemModifierOption.deleteMany({
              where: { cartItemId: { in: ids.cartItemIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "cartItems",
            tx.cartItem.deleteMany({
              where: { cartId: { in: ids.cartIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "carts",
            tx.cart.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
      {
        name: "table_sessions_customer_identities",
        run: async (tx: Prisma.TransactionClient, deleted: DeleteCounts) => {
          await this.deleteAndCount(
            deleted,
            "customerSessionIdentities",
            tx.customerSessionIdentity.deleteMany({
              where: {
                OR: [
                  { companyId, branchId },
                  { id: { in: ids.customerSessionIdentityIds } },
                ],
              },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "tableSessionEvents",
            tx.tableSessionEvent.deleteMany({
              where: { tableSessionId: { in: ids.tableSessionIds } },
            }),
          );
          await this.deleteAndCount(
            deleted,
            "tableSessions",
            tx.tableSession.deleteMany({ where: { companyId, branchId } }),
          );
        },
      },
    ];
  }

  private async runPhase(input: {
    requestId?: string;
    scope: SmokeResetScope;
    phase: string;
    run: (tx: Prisma.TransactionClient, deleted: DeleteCounts) => Promise<void>;
  }): Promise<SmokeResetPhaseResult> {
    const startedAt = Date.now();
    const deleted: DeleteCounts = {};

    try {
      await this.prisma.$transaction(
        async (tx) => {
          await input.run(tx, deleted);
        },
        smokeResetPhaseTransactionOptions,
      );
    } catch (error) {
      this.logResetFailure({
        requestId: input.requestId,
        scope: input.scope,
        phase: input.phase,
        durationMs: Date.now() - startedAt,
        counts: deleted,
        error,
      });
      throw error;
    }

    const durationMs = Date.now() - startedAt;

    this.logger.log({
      message: "smoke_reset_phase_completed",
      requestId: input.requestId,
      phase: input.phase,
      durationMs,
      counts: deleted,
      companyId: input.scope.companyId,
      branchId: input.scope.branchId,
    });

    return {
      phase: input.phase,
      durationMs,
      deleted,
    };
  }

  private logResetFailure(input: {
    requestId?: string;
    scope?: SmokeResetScope;
    phase: string;
    durationMs: number;
    counts?: DeleteCounts;
    error: unknown;
  }) {
    this.logger.error({
      message: "smoke_reset_failed",
      requestId: input.requestId,
      phase: input.phase,
      durationMs: input.durationMs,
      counts: input.counts ?? {},
      companyId: input.scope?.companyId,
      branchId: input.scope?.branchId,
      error: this.safeErrorSummary(input.error),
    });
  }

  private safeErrorSummary(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return {
        name: error.name,
        code: error.code,
        message: error.message,
      };
    }

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
      };
    }

    return { message: "Unknown smoke reset failure" };
  }

  private async ids(promise: Promise<Array<{ id: string }>>) {
    return (await promise).map((record) => record.id);
  }

  private async deleteAndCount(
    deleted: DeleteCounts,
    key: string,
    promise: Promise<{ count: number }>,
  ) {
    const result = await promise;
    deleted[key] = result.count;
  }

  private mergeDeletedCounts(target: DeleteCounts, source: DeleteCounts) {
    for (const [key, count] of Object.entries(source)) {
      target[key] = (target[key] ?? 0) + count;
    }
  }

  private preservedData() {
    return [
      "company",
      "subscription/plan",
      "branch",
      "floors",
      "tables and QR tokens",
      "menu/categories/items/modifiers",
      "staff users/memberships",
      "platform admin",
      "printer station config",
      "smart cashier settings",
    ];
  }

  private safetySummary() {
    return {
      tokenRequired: true,
      productionDisabled: true,
      companySlug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug,
      branchSlug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
      acceptsArbitraryTenantIds: false,
    };
  }
}
