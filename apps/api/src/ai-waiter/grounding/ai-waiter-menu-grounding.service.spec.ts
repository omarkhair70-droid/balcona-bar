import { AiWaiterContext, AiWaiterMenuItemSnapshot } from "../ai-waiter.types";
import { AiWaiterMenuGroundingService } from "./ai-waiter-menu-grounding.service";

function menuItem(
  input: Pick<AiWaiterMenuItemSnapshot, "id" | "slug" | "name"> &
    Partial<AiWaiterMenuItemSnapshot> & {
      categoryName?: string;
      categorySlug?: string;
    },
): AiWaiterMenuItemSnapshot {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    currency: input.currency ?? "EGP",
    isFeatured: input.isFeatured ?? false,
    category: {
      id: `category-${input.categorySlug ?? "general"}`,
      name: input.categoryName ?? "General",
      slug: input.categorySlug ?? "general",
    },
    modifierGroups: input.modifierGroups ?? [],
  };
}

function context(
  menuItems: AiWaiterMenuItemSnapshot[],
  recentMessages: AiWaiterContext["recentMessages"] = [],
): AiWaiterContext {
  return {
    tableSession: {
      id: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableId: "table-1",
      status: "active",
      partySize: 2,
    },
    branch: {
      id: "branch-1",
      companyId: "company-1",
      name: "Balcona Main",
      slug: "main",
    },
    effectiveExperience: {},
    cartSummary: {},
    recentMessages,
    menuItems,
  };
}

const menuItems = [
  menuItem({
    id: "item-lemon-mint",
    slug: "lemon-mint",
    name: "Lemon Mint",
    description: "Cold lemon mint juice, refreshing and light",
    isFeatured: true,
    categoryName: "Cold Drinks",
    categorySlug: "cold-drinks",
  }),
  menuItem({
    id: "item-mango-smoothie",
    slug: "mango-smoothie",
    name: "Mango Smoothie",
    description: "Cold mango smoothie",
    isFeatured: true,
    categoryName: "Cold Drinks",
    categorySlug: "cold-drinks",
  }),
  menuItem({
    id: "item-iced-spanish-latte",
    slug: "iced-spanish-latte",
    name: "Iced Spanish Latte",
    description: "Cold coffee latte with caffeine",
    isFeatured: true,
    categoryName: "Coffee",
    categorySlug: "coffee",
  }),
  menuItem({
    id: "item-matcha-latte",
    slug: "matcha-latte",
    name: "Matcha Latte",
    description: "Premium matcha latte for focus",
    categoryName: "Coffee",
    categorySlug: "coffee",
  }),
  menuItem({
    id: "item-classic-waffle",
    slug: "classic-waffle",
    name: "Classic Waffle",
    description: "Sweet dessert waffle with chocolate",
    categoryName: "Desserts",
    categorySlug: "desserts",
  }),
  menuItem({
    id: "item-pancake-stack",
    slug: "pancake-stack",
    name: "Pancake Stack",
    description: "Sweet sharing pancakes",
    categoryName: "Desserts",
    categorySlug: "desserts",
  }),
  menuItem({
    id: "item-egyptian-tea",
    slug: "egyptian-tea",
    name: "Egyptian Tea",
    description: "Simple budget hot tea",
    categoryName: "Tea",
    categorySlug: "tea",
  }),
];

describe("AiWaiterMenuGroundingService", () => {
  const service = new AiWaiterMenuGroundingService();

  it("ranks exact English item requests first", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "هات Lemon Mint",
    });

    expect(result.candidates[0]).toMatchObject({
      id: "item-lemon-mint",
      name: "Lemon Mint",
    });
    expect(result.exactMatchFound).toBe(true);
    expect(result.topMatchReasons).toContain("exact_name_match");
  });

  it("ranks Arabic Balcona aliases for lemon mint", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "هات ليمون نعناع",
    });

    expect(result.candidates[0].id).toBe("item-lemon-mint");
    expect(result.candidates[0].matchReasons).toEqual(
      expect.arrayContaining(["token_overlap", "cold_intent"]),
    );
  });

  it("handles typo aliases such as lemoon mint", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "lemoon mint",
    });

    expect(result.candidates[0].id).toBe("item-lemon-mint");
    expect(result.candidates[0].matchReasons).toEqual(
      expect.arrayContaining(["token_overlap", "typo_match"]),
    );
  });

  it("ranks mango requests above early menu items", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "عايز مانجو",
      maxCandidates: 4,
    });

    expect(result.candidates[0].id).toBe("item-mango-smoothie");
    expect(result.candidates).toHaveLength(4);
    expect(result.omittedMenuItemCount).toBe(3);
  });

  it("turns vague cold drink phrases into cold candidates", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "عايز حاجة ساقعة",
    });

    expect(result.candidates[0].matchReasons).toContain("cold_intent");
    expect(result.candidates.map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining([
        "item-lemon-mint",
        "item-mango-smoothie",
        "item-iced-spanish-latte",
      ]),
    );
  });

  it("turns caffeine phrases into coffee-focused candidates", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "عايز حاجة تفوقني",
    });

    expect(result.candidates[0].id).toBe("item-iced-spanish-latte");
    expect(result.candidates[0].matchReasons).toEqual(
      expect.arrayContaining(["coffee_intent", "caffeine_intent"]),
    );
  });

  it("turns sweet phrases into dessert candidates", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "عايز حاجة حلوة",
    });

    expect(result.candidates[0].id).toBe("item-classic-waffle");
    expect(result.candidates[0].matchReasons).toContain("dessert_intent");
  });

  it("keeps budget words from breaking cold search", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "عايز حاجة رخيصة ساقعة",
    });

    expect(result.candidates[0].matchReasons).toContain("cold_intent");
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it("handles Franco-Arabic cold drink phrasing", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "3ayez haga sa2a3a",
    });

    expect(result.candidates[0].matchReasons).toContain("cold_intent");
  });

  it("falls back to featured and category-diverse items when no phrase matches", () => {
    const result = service.rankCandidates(context(menuItems), {
      message: "tell me something surprising about architecture",
      maxCandidates: 4,
    });

    expect(result.groundingMode).toBe("fallback_featured");
    expect(result.candidates).toHaveLength(4);
    expect(result.topMatchReasons).toEqual(
      expect.arrayContaining(["fallback_featured", "fallback_diverse"]),
    );
  });

  it("uses recent messages as a small ranking hint", () => {
    const result = service.rankCandidates(
      context(menuItems, [
        {
          role: "customer",
          kind: "text",
          content: "كنت بفكر في Matcha Latte",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ]),
      {
        message: "طب رشحلي حاجة",
        maxCandidates: 3,
      },
    );

    expect(result.candidates.map((candidate) => candidate.id)).toContain(
      "item-matcha-latte",
    );
  });
});
