import { AiWaiterContext, AiWaiterMenuItemSnapshot } from "../ai-waiter.types";
import { AiWaiterMenuGroundingService } from "./ai-waiter-menu-grounding.service";
import { AiWaiterItemDetailGroundingService } from "./ai-waiter-item-detail-grounding.service";

function menuItem(
  input: Pick<AiWaiterMenuItemSnapshot, "id" | "slug" | "name"> &
    Partial<AiWaiterMenuItemSnapshot>,
): AiWaiterMenuItemSnapshot {
  return {
    id: input.id,
    slug: input.slug,
    name: input.name,
    description: input.description ?? null,
    currency: "EGP",
    isFeatured: input.isFeatured ?? false,
    category: input.category ?? {
      id: "category-coffee",
      name: "Coffee",
      slug: "coffee",
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

const latte = menuItem({
  id: "item-spanish-latte",
  slug: "spanish-latte",
  name: "Spanish Latte",
  isFeatured: true,
  modifierGroups: [
    {
      id: "size",
      name: "Size",
      slug: "size",
      selectionType: "single",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { id: "small", groupId: "size", name: "Small", slug: "small" },
        { id: "medium", groupId: "size", name: "Medium", slug: "medium" },
        { id: "large", groupId: "size", name: "Large", slug: "large" },
      ],
    },
    {
      id: "sugar",
      name: "Sugar",
      slug: "sugar",
      selectionType: "single",
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        {
          id: "low-sugar",
          groupId: "sugar",
          name: "Low sugar",
          slug: "low-sugar",
        },
        {
          id: "normal-sugar",
          groupId: "sugar",
          name: "Normal sugar",
          slug: "normal-sugar",
        },
      ],
    },
    {
      id: "milk",
      name: "Milk",
      slug: "milk",
      selectionType: "single",
      isRequired: false,
      minSelections: 0,
      maxSelections: 1,
      options: [
        { id: "oat", groupId: "milk", name: "Oat milk", slug: "oat-milk" },
      ],
    },
  ],
});

const lemonMint = menuItem({
  id: "item-lemon-mint",
  slug: "lemon-mint",
  name: "Lemon Mint",
  description: "Cold lemon drink",
  isFeatured: true,
  category: {
    id: "category-cold",
    name: "Cold Drinks",
    slug: "cold-drinks",
  },
});

describe("AiWaiterItemDetailGroundingService", () => {
  const menuGrounding = new AiWaiterMenuGroundingService();
  const service = new AiWaiterItemDetailGroundingService();

  it("returns item details for an exact item with required modifiers", () => {
    const ctx = context([latte, lemonMint]);
    const message = "هات Spanish Latte";
    const result = service.build({
      context: ctx,
      message,
      grounding: menuGrounding.rankCandidates(ctx, { message }),
    });

    expect(result.mode).toBe("exact_item_detail");
    expect(result.item?.id).toBe("item-spanish-latte");
    expect(result.item?.requiredModifierGroups).toHaveLength(2);
    expect(result.pendingModifier).toMatchObject({
      menuItemId: "item-spanish-latte",
      modifierGroupId: "size",
    });
  });

  it("does not include modifiers for vague recommendations", () => {
    const ctx = context([latte, lemonMint]);
    const message = "عايز حاجة ساقعة";
    const result = service.build({
      context: ctx,
      message,
      grounding: menuGrounding.rankCandidates(ctx, { message }),
    });

    expect(result.mode).toBe("none");
    expect(result.item).toBeUndefined();
  });

  it("detects pending modifier metadata and maps Arabic size answers", () => {
    const ctx = context([latte], [
      {
        role: "assistant",
        kind: "text",
        content: "اختار الحجم",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        metadata: {
          mode: "modifier_question",
          pendingModifier: {
            menuItemId: "item-spanish-latte",
            modifierGroupId: "size",
            allowedOptions: [
              { id: "small", name: "Small", slug: "small" },
              { id: "medium", name: "Medium", slug: "medium" },
              { id: "large", name: "Large", slug: "large" },
            ],
            question: "اختار الحجم",
            createdAt: "2026-01-01T00:00:00.000Z",
          },
          pendingItem: {
            id: "item-spanish-latte",
            name: "Spanish Latte",
          },
        },
      },
    ]);
    const message = "وسط";
    const result = service.build({
      context: ctx,
      message,
      grounding: menuGrounding.rankCandidates(ctx, { message }),
    });

    expect(result.selectedModifierOptionIds).toContain("medium");
    expect(result.mode).toBe("pending_modifier_resolution");
    expect(result.missingRequiredGroups[0]).toMatchObject({
      id: "sugar",
    });
  });

  it("completes item and modifier selections from the same message", () => {
    const ctx = context([latte]);
    const message = "هات Spanish Latte medium مش مسكر";
    const result = service.build({
      context: ctx,
      message,
      grounding: menuGrounding.rankCandidates(ctx, { message }),
    });

    expect(result.mode).toBe("complete_for_proposal");
    expect(result.selectedModifierOptionIds).toEqual(
      expect.arrayContaining(["medium", "low-sugar"]),
    );
    expect(result.missingRequiredGroups).toHaveLength(0);
  });

  it("caps large option lists in item detail grounding", () => {
    const item = menuItem({
      id: "item-custom",
      slug: "custom-latte",
      name: "Custom Latte",
      modifierGroups: [
        {
          id: "flavor",
          name: "Flavor",
          slug: "flavor",
          selectionType: "single",
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          options: Array.from({ length: 12 }, (_, index) => ({
            id: `flavor-${index + 1}`,
            groupId: "flavor",
            name: `Flavor ${index + 1}`,
            slug: `flavor-${index + 1}`,
          })),
        },
      ],
    });
    const ctx = context([item]);
    const message = "هات Custom Latte";
    const result = service.build({
      context: ctx,
      message,
      grounding: menuGrounding.rankCandidates(ctx, { message }),
    });

    expect(result.item?.requiredModifierGroups[0].options).toHaveLength(8);
    expect(result.item?.requiredModifierGroups[0].omittedOptionCount).toBe(4);
  });
});
