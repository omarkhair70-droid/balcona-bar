import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SMOKE_BOOTSTRAP_IDENTIFIERS } from "./smoke-bootstrap.constants";

type DeleteCounts = Record<string, number>;
type SmokeResetTarget = {
  company: { id: string; slug: string } | null;
  branch: { id: string; slug: string } | null;
};

@Injectable()
export class SmokeResetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly smokeBootstrapService: SmokeBootstrapService,
  ) {}

  async reset(providedToken: string | undefined) {
    this.smokeBootstrapService.assertBootstrapAllowed(providedToken);

    return this.prisma.$transaction(async (tx) => {
      const target = await this.resolveSmokeTarget(tx);
      const resetAt = new Date();

      if (!target.company || !target.branch) {
        return {
          resetAt,
          company: target.company,
          branch: target.branch,
          deleted: {},
          preserved: this.preservedData(),
          safety: this.safetySummary(),
        };
      }

      const deleted = await this.deleteSmokeOperationalData(tx, {
        companyId: target.company.id,
        branchId: target.branch.id,
      });

      return {
        resetAt,
        company: target.company,
        branch: target.branch,
        deleted,
        preserved: this.preservedData(),
        safety: this.safetySummary(),
      };
    });
  }

  private async resolveSmokeTarget(
    tx: Prisma.TransactionClient,
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

  private async deleteSmokeOperationalData(
    tx: Prisma.TransactionClient,
    scope: { companyId: string; branchId: string },
  ) {
    const deleted: DeleteCounts = {};
    const { companyId, branchId } = scope;
    const tableSessionIds = await this.ids(
      tx.tableSession.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const cartIds = await this.ids(
      tx.cart.findMany({ where: { companyId, branchId }, select: { id: true } }),
    );
    const cartItemIds = await this.ids(
      tx.cartItem.findMany({
        where: { cartId: { in: cartIds } },
        select: { id: true },
      }),
    );
    const aiWaiterSessionIds = await this.ids(
      tx.aiWaiterSession.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const aiWaiterMessageIds = await this.ids(
      tx.aiWaiterMessage.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const orderIds = await this.ids(
      tx.order.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const orderItemIds = await this.ids(
      tx.orderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { id: true },
      }),
    );
    const preparationTaskIds = await this.ids(
      tx.preparationTask.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const kitchenTicketIds = await this.ids(
      tx.kitchenTicket.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const printJobIds = await this.ids(
      tx.printJob.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const waiterCallIds = await this.ids(
      tx.waiterCall.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const billRequestIds = await this.ids(
      tx.billRequest.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const billIds = await this.ids(
      tx.bill.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const onlinePaymentIntentIds = await this.ids(
      tx.onlinePaymentIntent.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const notificationIds = await this.ids(
      tx.notification.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const customerSessionIdentityIds = await this.ids(
      tx.customerSessionIdentity.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );
    const tableAttentionSnapshotIds = await this.ids(
      tx.tableAttentionSnapshot.findMany({
        where: { companyId, branchId },
        select: { id: true },
      }),
    );

    await this.deleteAndCount(
      deleted,
      "realtimeEvents",
      tx.realtimeEvent.deleteMany({
        where: {
          companyId,
          OR: [
            { branchId },
            { tableSessionId: { in: tableSessionIds } },
            { orderId: { in: orderIds } },
            { preparationTaskId: { in: preparationTaskIds } },
            { waiterCallId: { in: waiterCallIds } },
            { billRequestId: { in: billRequestIds } },
            { notificationId: { in: notificationIds } },
          ],
        },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "notificationDeliveries",
      tx.notificationDelivery.deleteMany({
        where: { notificationId: { in: notificationIds } },
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
        where: { printJobId: { in: printJobIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "printJobs",
      tx.printJob.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "kitchenTicketItems",
      tx.kitchenTicketItem.deleteMany({
        where: { ticketId: { in: kitchenTicketIds } },
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
        where: { preparationTaskId: { in: preparationTaskIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "preparationTasks",
      tx.preparationTask.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "waiterCallEvents",
      tx.waiterCallEvent.deleteMany({
        where: { waiterCallId: { in: waiterCallIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "waiterCalls",
      tx.waiterCall.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "onlinePaymentEvents",
      tx.onlinePaymentEvent.deleteMany({
        where: {
          OR: [
            { companyId, branchId },
            { onlinePaymentIntentId: { in: onlinePaymentIntentIds } },
            { billId: { in: billIds } },
          ],
        },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "onlinePaymentIntents",
      tx.onlinePaymentIntent.deleteMany({ where: { companyId, branchId } }),
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
      tx.billEvent.deleteMany({ where: { billId: { in: billIds } } }),
    );
    await this.deleteAndCount(
      deleted,
      "billLines",
      tx.billLine.deleteMany({ where: { billId: { in: billIds } } }),
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
        where: { billRequestId: { in: billRequestIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "billRequests",
      tx.billRequest.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "orderEvents",
      tx.orderEvent.deleteMany({ where: { orderId: { in: orderIds } } }),
    );
    await this.deleteAndCount(
      deleted,
      "orderItemModifierOptions",
      tx.orderItemModifierOption.deleteMany({
        where: { orderItemId: { in: orderItemIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "orderItems",
      tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } }),
    );
    await this.deleteAndCount(
      deleted,
      "orders",
      tx.order.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "aiWaiterToolCalls",
      tx.aiWaiterToolCall.deleteMany({
        where: {
          OR: [
            { companyId, branchId },
            { aiWaiterSessionId: { in: aiWaiterSessionIds } },
            { messageId: { in: aiWaiterMessageIds } },
          ],
        },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "aiWaiterMessages",
      tx.aiWaiterMessage.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "aiWaiterCartProposals",
      tx.aiWaiterCartProposal.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "aiWaiterUsageEvents",
      tx.aiWaiterUsageEvent.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "aiWaiterSessions",
      tx.aiWaiterSession.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "cartItemModifierOptions",
      tx.cartItemModifierOption.deleteMany({
        where: { cartItemId: { in: cartItemIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "cartItems",
      tx.cartItem.deleteMany({ where: { cartId: { in: cartIds } } }),
    );
    await this.deleteAndCount(
      deleted,
      "carts",
      tx.cart.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "tableAttentionEvents",
      tx.tableAttentionEvent.deleteMany({
        where: {
          OR: [
            { companyId, branchId },
            { tableSessionId: { in: tableSessionIds } },
            { snapshotId: { in: tableAttentionSnapshotIds } },
          ],
        },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "tableAttentionSnapshots",
      tx.tableAttentionSnapshot.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "presenceEvents",
      tx.presenceEvent.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "deviceSubscriptions",
      tx.deviceSubscription.deleteMany({ where: { companyId, branchId } }),
    );
    await this.deleteAndCount(
      deleted,
      "customerSessionIdentities",
      tx.customerSessionIdentity.deleteMany({
        where: {
          OR: [
            { companyId, branchId },
            { id: { in: customerSessionIdentityIds } },
          ],
        },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "tableSessionEvents",
      tx.tableSessionEvent.deleteMany({
        where: { tableSessionId: { in: tableSessionIds } },
      }),
    );
    await this.deleteAndCount(
      deleted,
      "tableSessions",
      tx.tableSession.deleteMany({ where: { companyId, branchId } }),
    );

    return deleted;
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
