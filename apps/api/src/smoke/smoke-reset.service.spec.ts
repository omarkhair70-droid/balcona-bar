import { ConfigService } from "@nestjs/config";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import { SmokeResetService } from "./smoke-reset.service";
import { SMOKE_BOOTSTRAP_IDENTIFIERS } from "./smoke-bootstrap.constants";

const operationalDeleteModels = [
  "realtimeEvent",
  "notificationDelivery",
  "notification",
  "printJobEvent",
  "printJob",
  "kitchenTicketItem",
  "kitchenTicket",
  "preparationTaskEvent",
  "preparationTask",
  "waiterCallEvent",
  "waiterCall",
  "onlinePaymentEvent",
  "onlinePaymentIntent",
  "manualPayment",
  "billReceipt",
  "billEvent",
  "billLine",
  "bill",
  "billRequestEvent",
  "billRequest",
  "orderEvent",
  "orderItemModifierOption",
  "orderItem",
  "order",
  "aiWaiterToolCall",
  "aiWaiterMessage",
  "aiWaiterCartProposal",
  "aiWaiterUsageEvent",
  "aiWaiterSession",
  "cartItemModifierOption",
  "cartItem",
  "cart",
  "tableAttentionEvent",
  "tableAttentionSnapshot",
  "presenceEvent",
  "deviceSubscription",
  "customerSessionIdentity",
  "tableSessionEvent",
  "tableSession",
] as const;

function serviceWithConfig(config: Record<string, unknown>, prisma: any = {}) {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback,
    ),
  } as unknown as ConfigService;
  const bootstrap = new SmokeBootstrapService({} as never, configService);

  return new SmokeResetService(prisma as never, bootstrap);
}

function buildResetPrisma() {
  const tx: any = {
    company: {
      findUnique: jest.fn().mockResolvedValue({
        id: "smoke-company",
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug,
      }),
      deleteMany: jest.fn(),
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue({
        id: "smoke-branch",
        slug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
      }),
      deleteMany: jest.fn(),
    },
    menuItem: {
      deleteMany: jest.fn(),
    },
    staffUser: {
      deleteMany: jest.fn(),
    },
  };
  const idsByModel: Record<string, string[]> = {
    tableSession: ["session-1"],
    cart: ["cart-1"],
    cartItem: ["cart-item-1"],
    aiWaiterSession: ["ai-session-1"],
    aiWaiterMessage: ["ai-message-1"],
    order: ["order-1", "non-smoke-order"],
    orderItem: ["order-item-1"],
    preparationTask: ["task-1"],
    kitchenTicket: ["ticket-1"],
    printJob: ["print-job-1"],
    waiterCall: ["waiter-call-1"],
    billRequest: ["bill-request-1"],
    bill: ["bill-1"],
    onlinePaymentIntent: ["online-payment-intent-1"],
    notification: ["notification-1"],
    customerSessionIdentity: ["identity-1"],
    tableAttentionSnapshot: ["attention-1"],
  };

  for (const model of operationalDeleteModels) {
    tx[model] ??= {};
    tx[model].findMany ??= jest
      .fn()
      .mockResolvedValue((idsByModel[model] ?? []).map((id) => ({ id })));
    tx[model].deleteMany ??= jest
      .fn()
      .mockResolvedValue({ count: idsByModel[model]?.length ?? 1 });
  }

  return {
    tx,
    prisma: {
      $transaction: jest.fn((callback) => callback(tx)),
    },
  };
}

describe("SmokeResetService", () => {
  it("refuses production through the shared smoke token guard", async () => {
    const service = serviceWithConfig({
      "app.environment": "production",
      "app.nodeEnvironment": "production",
      "smokeBootstrap.enabled": true,
      "smokeBootstrap.token": "token",
    });

    await expect(service.reset("token")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "SMOKE_BOOTSTRAP_DISABLED_IN_PRODUCTION",
      }),
    });
  });

  it("refuses missing and invalid reset tokens", async () => {
    const missingTokenService = serviceWithConfig({
      "app.environment": "staging",
      "app.nodeEnvironment": "production",
      "smokeBootstrap.enabled": true,
    });
    const invalidTokenService = serviceWithConfig({
      "app.environment": "staging",
      "app.nodeEnvironment": "production",
      "smokeBootstrap.enabled": true,
      "smokeBootstrap.token": "token",
    });

    await expect(missingTokenService.reset("token")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "SMOKE_BOOTSTRAP_TOKEN_MISSING",
      }),
    });
    await expect(invalidTokenService.reset("wrong")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "SMOKE_BOOTSTRAP_TOKEN_INVALID",
      }),
    });
  });

  it("resolves only deterministic smoke company and branch identifiers", async () => {
    const { prisma, tx } = buildResetPrisma();
    const service = serviceWithConfig(
      {
        "app.environment": "staging",
        "app.nodeEnvironment": "production",
        "smokeBootstrap.enabled": true,
        "smokeBootstrap.token": "token",
      },
      prisma,
    );

    await service.reset("token");

    expect(tx.company.findUnique).toHaveBeenCalledWith({
      where: { slug: SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug },
      select: { id: true, slug: true },
    });
    expect(tx.branch.findUnique).toHaveBeenCalledWith({
      where: {
        companyId_slug: {
          companyId: "smoke-company",
          slug: SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug,
        },
      },
      select: { id: true, slug: true },
    });
  });

  it("deletes smoke operational data without deleting tenant setup data", async () => {
    const { prisma, tx } = buildResetPrisma();
    const service = serviceWithConfig(
      {
        "app.environment": "staging",
        "app.nodeEnvironment": "production",
        "smokeBootstrap.enabled": true,
        "smokeBootstrap.token": "token",
      },
      prisma,
    );

    const result = await service.reset("token");

    expect(tx.tableSession.deleteMany).toHaveBeenCalledWith({
      where: { companyId: "smoke-company", branchId: "smoke-branch" },
    });
    expect(tx.order.deleteMany).toHaveBeenCalledWith({
      where: { companyId: "smoke-company", branchId: "smoke-branch" },
    });
    expect(tx.bill.deleteMany).toHaveBeenCalledWith({
      where: { companyId: "smoke-company", branchId: "smoke-branch" },
    });
    expect(tx.company.deleteMany).not.toHaveBeenCalled();
    expect(tx.branch.deleteMany).not.toHaveBeenCalled();
    expect(tx.menuItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.staffUser.deleteMany).not.toHaveBeenCalled();
    expect(result.preserved).toEqual(
      expect.arrayContaining(["company", "staff users/memberships"]),
    );
    expect((result.deleted as Record<string, number>).orders).toBeGreaterThan(0);
  });

  it("deletes dependent operational data in safe dependency order", async () => {
    const { prisma, tx } = buildResetPrisma();
    const service = serviceWithConfig(
      {
        "app.environment": "staging",
        "app.nodeEnvironment": "production",
        "smokeBootstrap.enabled": true,
        "smokeBootstrap.token": "token",
      },
      prisma,
    );

    await service.reset("token");

    expect(
      tx.kitchenTicketItem.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.kitchenTicket.deleteMany.mock.invocationCallOrder[0]);
    expect(
      tx.orderItemModifierOption.deleteMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.orderItem.deleteMany.mock.invocationCallOrder[0]);
    expect(tx.orderItem.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.order.deleteMany.mock.invocationCallOrder[0],
    );
    expect(tx.tableSessionEvent.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.tableSession.deleteMany.mock.invocationCallOrder[0],
    );
  });
});
