import { ConfigService } from "@nestjs/config";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { PrismaService } from "../prisma/prisma.service";
import { AiWaiterContextService } from "./ai-waiter-context.service";
import { AiWaiterMenuGroundingService } from "./grounding/ai-waiter-menu-grounding.service";

function menuItem(index: number) {
  return {
    id: `item-${index}`,
    name: index === 61 ? "Deep Menu Item 61 Mango" : `Menu Item ${index}`,
    slug: index === 61 ? "deep-menu-item-61-mango" : `menu-item-${index}`,
    description:
      index === 61 ? "Cold mango drink beyond the old snapshot window" : null,
    currency: "EGP",
    isFeatured: false,
    category: {
      id: "category-drinks",
      name: "Drinks",
      slug: "drinks",
    },
    modifierGroups: [],
  };
}

describe("AiWaiterContextService", () => {
  it("includes menu items beyond the old first-60 window when within the configured snapshot cap", async () => {
    const prisma = {
      experienceProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      menuItem: {
        findMany: jest.fn(({ take }: { take: number }) =>
          Promise.resolve(
            Array.from({ length: Math.min(take, 61) }, (_, index) =>
              menuItem(index + 1),
            ),
          ),
        ),
      },
      aiWaiterMessage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;
    const cartService = {
      getCart: jest.fn().mockResolvedValue({}),
    } as unknown as CartService;
    const configService = {
      get: jest.fn((key: string) =>
        key === "aiWaiter.menuSnapshotLimit" ? 200 : undefined,
      ),
    } as unknown as ConfigService;
    const inventoryService = {
      getBranchMenuAvailability: jest.fn().mockResolvedValue({
        items: Array.from({ length: 61 }, (_, index) => ({
          menuItemId: `item-${index + 1}`,
          canOrder: true,
        })),
      }),
    } as unknown as InventoryService;
    const service = new AiWaiterContextService(
      prisma,
      cartService,
      configService,
      inventoryService,
    );

    const context = await service.buildContext({
      id: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableId: "table-1",
      status: "active",
      guestLabel: null,
      partySize: 2,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      table: {
        id: "table-1",
        code: "T01",
        displayName: "Table 1",
        status: "active",
        capacity: 4,
        floor: {
          id: "floor-1",
          name: "Ground",
        },
      },
      branch: {
        id: "branch-1",
        companyId: "company-1",
        name: "Balcona Main",
        slug: "main",
      },
    });
    const grounding = new AiWaiterMenuGroundingService().rankCandidates(
      context,
      {
        message: "عايز Mango item 61",
        maxCandidates: 12,
      },
    );

    expect(prisma.menuItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
    expect(context.menuItems).toHaveLength(61);
    expect(inventoryService.getBranchMenuAvailability).toHaveBeenCalledWith(
      "branch-1",
    );
    expect(context.menuItems[60]).toMatchObject({
      id: "item-61",
      name: "Deep Menu Item 61 Mango",
    });
    expect(grounding.candidates[0]).toMatchObject({
      id: "item-61",
      name: "Deep Menu Item 61 Mango",
    });
  });

  it("includes only compact pending modifier metadata in recent messages", async () => {
    const prisma = {
      experienceProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      menuItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      aiWaiterMessage: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: "assistant",
            kind: "text",
            content: "اختار الحجم",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            metadata: {
              mode: "modifier_question",
              provider: "groq",
              rawPrompt: "should not leak",
              pendingModifier: {
                menuItemId: "item-1",
                modifierGroupId: "size",
                allowedOptions: [
                  { id: "small", name: "Small", slug: "small" },
                  { id: "medium", name: "Medium", slug: "medium" },
                ],
                selectedModifierOptionIds: ["previous-option"],
                question: "اختار الحجم",
                createdAt: "2026-01-01T00:00:00.000Z",
              },
              pendingItem: {
                id: "item-1",
                name: "Spanish Latte",
              },
            },
          },
        ]),
      },
    } as unknown as PrismaService;
    const cartService = {
      getCart: jest.fn().mockResolvedValue({}),
    } as unknown as CartService;
    const configService = {
      get: jest.fn((key: string) =>
        key === "aiWaiter.menuSnapshotLimit" ? 200 : undefined,
      ),
    } as unknown as ConfigService;
    const inventoryService = {
      getBranchMenuAvailability: jest.fn().mockResolvedValue({ items: [] }),
    } as unknown as InventoryService;
    const service = new AiWaiterContextService(
      prisma,
      cartService,
      configService,
      inventoryService,
    );

    const result = await service.buildContext(
      {
        id: "session-1",
        companyId: "company-1",
        branchId: "branch-1",
        tableId: "table-1",
        status: "active",
        guestLabel: null,
        partySize: 2,
        startedAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        table: {
          id: "table-1",
          code: "T01",
          displayName: "Table 1",
          status: "active",
          capacity: 4,
          floor: null,
        },
        branch: {
          id: "branch-1",
          companyId: "company-1",
          name: "Balcona Main",
          slug: "main",
        },
      },
      "ai-session-1",
    );

    expect(result.recentMessages[0].metadata).toMatchObject({
      mode: "modifier_question",
      provider: "groq",
      pendingModifier: {
        menuItemId: "item-1",
        modifierGroupId: "size",
        allowedOptions: [
          { id: "small", name: "Small", slug: "small" },
          { id: "medium", name: "Medium", slug: "medium" },
        ],
      },
      pendingItem: {
        id: "item-1",
        name: "Spanish Latte",
      },
    });
    expect(JSON.stringify(result.recentMessages[0].metadata)).not.toContain(
      "rawPrompt",
    );
  });

  it("builds compact customer-safe operational context for cart, orders, bill, waiter calls, and attention", async () => {
    const prisma = {
      experienceProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      menuItem: {
        findMany: jest.fn().mockResolvedValue([menuItem(1), menuItem(2)]),
      },
      aiWaiterMessage: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "order-1",
            orderNumber: "A001",
            status: "preparing",
            submittedAt: new Date("2026-01-01T00:10:00.000Z"),
            cashierAcceptedAt: new Date("2026-01-01T00:11:00.000Z"),
            readyAt: null,
            servedAt: null,
            completedAt: null,
            itemCount: 2,
            preparationTasks: [
              { status: "pending", station: "barista" },
              { status: "preparing", station: "kitchen" },
            ],
          },
        ]),
        count: jest.fn(({ where }: { where: { status?: { in?: string[] } } }) =>
          Promise.resolve(where.status?.in?.includes("cashier_accepted") ? 1 : 1),
        ),
      },
      billRequest: {
        findFirst: jest.fn().mockResolvedValue({
          id: "bill-request-1",
          status: "open",
        }),
      },
      bill: {
        findFirst: jest.fn().mockResolvedValue({
          id: "bill-1",
          status: "requested",
          receipt: null,
        }),
      },
      waiterCall: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "waiter-call-1",
            type: "call_waiter",
            status: "open",
            priority: 1,
            createdAt: new Date("2026-01-01T00:12:00.000Z"),
            message: "Need help",
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      tableAttentionSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          status: "needs_attention",
          priority: "medium",
          score: 42,
          reasons: [
            "waiter_call_open",
            "bill_requested",
            "extra-1",
            "extra-2",
            "extra-3",
            "extra-4",
          ],
          recommendedActions: [
            "acknowledge_call",
            "present_bill",
            "extra-1",
            "extra-2",
            "extra-3",
            "extra-4",
          ],
        }),
      },
      branchOperatingSettings: {
        findUnique: jest.fn().mockResolvedValue({
          operatingMode: "assisted",
          serviceMode: "dine_in",
          aiWaiterEnabled: true,
          waiterCallsEnabled: true,
          billFlowEnabled: true,
          tableAttentionEnabled: true,
        }),
      },
      branchFeatureFlag: {
        findMany: jest.fn().mockResolvedValue([
          { key: "ai_waiter", enabled: true },
          { key: "waiter_calls", enabled: true },
          { key: "bill_flow", enabled: true },
          { key: "table_attention", enabled: true },
        ]),
      },
    } as unknown as PrismaService;
    const cartService = {
      getCart: jest.fn().mockResolvedValue({
        cart: { id: "cart-1", status: "draft" },
        items: Array.from({ length: 7 }, (_, index) => ({
          id: `cart-item-${index + 1}`,
          menuItemId: `item-${index + 1}`,
          itemNameSnapshot: `Cart Item ${index + 1}`,
          quantity: index + 1,
          notes: index === 0 ? "less ice" : null,
          modifierOptions: [
            {
              modifierOptionNameSnapshot: "Low sugar",
            },
          ],
        })),
        totals: { itemCount: 7, totalQuantity: 28 },
      }),
    } as unknown as CartService;
    const configService = {
      get: jest.fn((key: string) =>
        key === "aiWaiter.menuSnapshotLimit" ? 200 : undefined,
      ),
    } as unknown as ConfigService;
    const inventoryService = {
      getBranchMenuAvailability: jest.fn().mockResolvedValue({
        items: [
          { menuItemId: "item-1", canOrder: true },
          { menuItemId: "item-2", canOrder: false },
        ],
      }),
    } as unknown as InventoryService;
    const service = new AiWaiterContextService(
      prisma,
      cartService,
      configService,
      inventoryService,
    );

    const result = await service.buildContext({
      id: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableId: "table-1",
      status: "active",
      guestLabel: null,
      partySize: 2,
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      table: {
        id: "table-1",
        code: "T01",
        displayName: "Table 1",
        status: "active",
        capacity: 4,
        floor: { id: "floor-1", name: "Ground" },
      },
      branch: {
        id: "branch-1",
        companyId: "company-1",
        name: "Balcona Main",
        slug: "main",
      },
    });

    expect(result.menuItems).toHaveLength(1);
    expect(result.operationalContext).toMatchObject({
      table: {
        id: "table-1",
        label: "Table 1",
        capacity: 4,
        floor: { id: "floor-1", name: "Ground" },
      },
      cart: {
        itemCount: 7,
        totalQuantity: 28,
        hasOpenCart: true,
      },
      orders: {
        activeCount: 1,
        latest: {
          id: "order-1",
          customerStatus: "preparing",
          preparationSummary: {
            pending: 1,
            preparing: 1,
            ready: 0,
            cancelled: 0,
            stations: ["barista", "kitchen"],
          },
        },
      },
      bill: {
        activeBillRequestId: "bill-request-1",
        hasBillableOrders: true,
        billStatus: "requested",
        receiptAvailable: false,
      },
      waiterCalls: {
        activeCount: 1,
        latest: {
          id: "waiter-call-1",
          type: "call_waiter",
          status: "open",
        },
      },
      attention: {
        status: "needs_attention",
        priority: "medium",
        score: 42,
      },
      branchOps: {
        operatingMode: "assisted",
        serviceMode: "dine_in",
        aiWaiterEnabled: true,
        waiterCallsEnabled: true,
        billFlowEnabled: true,
        tableAttentionEnabled: true,
      },
    });
    expect(result.operationalContext?.cart?.items).toHaveLength(6);
    expect(result.operationalContext?.cart?.items[0]).toMatchObject({
      id: "cart-item-1",
      menuItemId: "item-1",
      name: "Cart Item 1",
      quantity: 1,
      notes: "less ice",
      modifierLabels: ["Low sugar"],
    });
    expect(result.operationalContext?.attention?.reasons).toHaveLength(5);
    expect(result.operationalContext?.attention?.recommendedActions).toHaveLength(
      5,
    );
    expect(JSON.stringify(result.operationalContext)).not.toContain(
      "subtotalMinor",
    );
  });
});
