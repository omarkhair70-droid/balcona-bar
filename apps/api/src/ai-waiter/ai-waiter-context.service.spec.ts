import { ConfigService } from "@nestjs/config";
import { CartService } from "../cart/cart.service";
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
    const service = new AiWaiterContextService(
      prisma,
      cartService,
      configService,
    );

    const context = await service.buildContext({
      id: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableId: "table-1",
      status: "active",
      guestLabel: null,
      partySize: 2,
      expiresAt: null,
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
    const service = new AiWaiterContextService(
      prisma,
      cartService,
      configService,
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
        expiresAt: null,
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
});
