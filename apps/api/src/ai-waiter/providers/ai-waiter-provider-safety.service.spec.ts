import { AiWaiterMessageKind, AiWaiterToolCallStatus } from "@prisma/client";
import { AiWaiterContext } from "../ai-waiter.types";
import { AiWaiterProviderSafetyService } from "./ai-waiter-provider-safety.service";
import { GroqAiWaiterPlan } from "./groq-ai-waiter.types";

const context: AiWaiterContext = {
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
  recentMessages: [],
  menuItems: [
    {
      id: "item-latte",
      slug: "latte",
      name: "Latte",
      currency: "EGP",
      isFeatured: true,
      modifierGroups: [
        {
          id: "size-group",
          name: "Size",
          slug: "size",
          selectionType: "single",
          isRequired: true,
          minSelections: 1,
          maxSelections: 1,
          options: [
            {
              id: "size-medium",
              groupId: "size-group",
              name: "Medium",
              slug: "medium",
            },
            {
              id: "size-large",
              groupId: "size-group",
              name: "Large",
              slug: "large",
            },
          ],
        },
      ],
    },
    {
      id: "item-lemon-mint",
      slug: "lemon-mint",
      name: "Lemon Mint",
      currency: "EGP",
      isFeatured: false,
      modifierGroups: [],
    },
  ],
};

function plan(overrides: Partial<GroqAiWaiterPlan> = {}): GroqAiWaiterPlan {
  return {
    customerMessage: "عايز حاجة ساقعة",
    language: "ar-EG",
    intent: "recommendation",
    confidence: 0.8,
    assistantMessage: "أنصحك بليمون نعناع من المنيو المتاح.",
    suggestedActions: ["show_menu", "choose_item"],
    menuItemCandidates: [{ menuItemId: "item-lemon-mint" }],
    proposedCart: null,
    missingRequiredModifier: null,
    safety: {
      requiresHumanFallback: false,
    },
    ...overrides,
  };
}

describe("AiWaiterProviderSafetyService", () => {
  const service = new AiWaiterProviderSafetyService();

  it("maps a valid Groq cart proposal with real menu item and modifier IDs", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "cart_proposal",
        proposedCart: {
          title: "Latte proposal",
          items: [
            {
              menuItemId: "item-latte",
              quantity: 1,
              modifierOptionIds: ["size-medium"],
            },
          ],
        },
      }),
      context,
      { provider: "groq", model: "test-model" },
    );

    expect(result.kind).toBe(AiWaiterMessageKind.cart_proposal);
    expect(result.proposal?.items).toEqual([
      {
        menuItemId: "item-latte",
        quantity: 1,
        modifierOptionIds: ["size-medium"],
        customerNote: undefined,
      },
    ]);
    expect(result.metadata).toMatchObject({
      provider: "groq",
      model: "test-model",
      intent: "cart_proposal",
    });
  });

  it("rejects fake menu item IDs", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "cart_proposal",
        proposedCart: {
          title: "Fake item",
          items: [
            {
              menuItemId: "fake-item",
              quantity: 1,
              modifierOptionIds: [],
            },
          ],
        },
      }),
      context,
    );

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unknown_menu_item_rejected");
  });

  it("rejects fake price fields from Groq output", () => {
    const unsafePlan = {
      ...plan(),
      priceMinor: 100,
    };
    const result = service.validateAndMapPlan(unsafePlan, context);

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("price_field_rejected");
  });

  it("rejects final order submit actions", () => {
    const result = service.validateAndMapPlan(
      plan({ suggestedActions: ["final_order_submit"] }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unsafe_action_rejected");
  });

  it("forces allergy and health concerns to human fallback without guarantees", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "allergy_or_health",
        assistantMessage: "سلامتك أهم، أنادي ويتر يتأكد.",
        safety: {
          requiresHumanFallback: true,
          allergyOrHealthConcern: true,
        },
      }),
      context,
    );

    expect(result.kind).toBe(AiWaiterMessageKind.escalation);
    expect(result.suggestedActions).toContain("escalate_to_waiter");
    expect(result.metadata?.safetyFlags).toContain("no_allergy_guarantee");
  });

  it("rejects allergy guarantees", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "allergy_or_health",
        assistantMessage: "This is 100% safe for allergy.",
        safety: {
          requiresHumanFallback: false,
          allergyOrHealthConcern: true,
        },
      }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("allergy_guarantee_rejected");
  });

  it("rejects discount promises", () => {
    const result = service.validateAndMapPlan(
      plan({
        assistantMessage: "I can give you a discount.",
      }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain(
      "payment_or_discount_promise_rejected",
    );
  });

  it("allows sugar-free and caffeine-free cafe phrases", () => {
    const sugarFreeResult = service.validateAndMapPlan(
      plan({
        assistantMessage:
          "I can suggest a sugar-free drink from the available menu.",
      }),
      context,
    );
    const caffeineFreeResult = service.validateAndMapPlan(
      plan({
        assistantMessage:
          "I can suggest a caffeine-free option from the available menu.",
      }),
      context,
    );

    expect(sugarFreeResult.kind).toBe(AiWaiterMessageKind.menu_suggestion);
    expect(sugarFreeResult.metadata?.fallbackUsed).not.toBe(true);
    expect(caffeineFreeResult.kind).toBe(AiWaiterMessageKind.menu_suggestion);
    expect(caffeineFreeResult.metadata?.fallbackUsed).not.toBe(true);
  });

  it("rejects free item promises without rejecting dietary free phrases", () => {
    const result = service.validateAndMapPlan(
      plan({
        assistantMessage: "I can add a free item to your order.",
      }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain(
      "payment_or_discount_promise_rejected",
    );
  });

  it("rejects unknown modifier option IDs", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "cart_proposal",
        proposedCart: {
          title: "Latte proposal",
          items: [
            {
              menuItemId: "item-latte",
              quantity: 1,
              modifierOptionIds: ["size-medium", "fake-option"],
            },
          ],
        },
      }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unknown_modifier_rejected");
  });

  it("rejects modifier selections that exceed group max selections", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "cart_proposal",
        proposedCart: {
          title: "Latte proposal",
          items: [
            {
              menuItemId: "item-latte",
              quantity: 1,
              modifierOptionIds: ["size-medium", "size-large"],
            },
          ],
        },
      }),
      context,
    );

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain(
      "modifier_selection_limit_enforced",
    );
  });

  it("enforces quantity limits", () => {
    const result = service.validateAndMapPlan(
      plan({
        intent: "cart_proposal",
        proposedCart: {
          title: "Large proposal",
          items: [
            {
              menuItemId: "item-lemon-mint",
              quantity: 99,
              modifierOptionIds: [],
            },
          ],
        },
      }),
      context,
    );

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("quantity_limit_enforced");
    expect(result.proposal).toBeUndefined();
  });

  it("maps bill and waiter intents to safe action results", () => {
    const billResult = service.validateAndMapPlan(
      plan({ intent: "request_bill" }),
      context,
    );
    const waiterResult = service.validateAndMapPlan(
      plan({ intent: "call_waiter" }),
      context,
    );

    expect(billResult.kind).toBe(AiWaiterMessageKind.action_result);
    expect(billResult.suggestedActions).toContain("request_bill");
    expect(waiterResult.kind).toBe(AiWaiterMessageKind.escalation);
    expect(waiterResult.toolCalls[0]?.status).toBe(
      AiWaiterToolCallStatus.succeeded,
    );
  });
});
