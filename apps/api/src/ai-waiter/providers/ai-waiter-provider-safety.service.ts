import { Injectable } from "@nestjs/common";
import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
} from "@prisma/client";
import {
  AiWaiterContext,
  AiWaiterMenuItemSnapshot,
  AiWaiterProposalItem,
  AiWaiterProviderResult,
} from "../ai-waiter.types";
import { GroqAiWaiterPlan } from "./groq-ai-waiter.types";

const MAX_AI_PROPOSAL_QUANTITY = 12;
const DISALLOWED_ACTIONS = [
  "final_order_submit",
  "submit_order",
  "pay",
  "take_payment",
  "refund",
  "discount",
  "change_price",
];
const PRICE_KEYS = [
  "price",
  "priceMinor",
  "basePriceMinor",
  "discount",
  "total",
  "subtotal",
  "currencyAmount",
];
const UNSAFE_PRICE_OR_PAYMENT_WORDS = [
  "discount",
  "خصم",
  "refund",
  "payment",
  "payment confirmed",
  "paid",
  "هخفض السعر",
];
const UNSAFE_FREE_PROMISE_PATTERNS = [
  /(^|[^-\w])free\s+(item|order|drink|dessert|coffee|meal|beverage|upgrade|modifier|latte|tea|juice)\b/,
  /\b(giveaway|complimentary|on the house|for free)\b/,
  /\b(give|send|add)\s+(you\s+)?(a\s+)?free\b/,
  /(مجاني|هدية|على حسابنا|من غير فلوس)/,
];
const ALLERGY_GUARANTEE_WORDS = [
  "allergy safe",
  "guaranteed safe",
  "100% safe",
  "خالي من الحساسية",
  "مضمون",
  "آمن تماما",
  "امن تماما",
];

@Injectable()
export class AiWaiterProviderSafetyService {
  validateAndMapPlan(
    plan: unknown,
    context: AiWaiterContext,
    metadata: Record<string, unknown> = {},
  ): AiWaiterProviderResult {
    const validatedPlan = this.assertPlanShape(plan);
    const unsafeReason = this.firstUnsafeReason(plan);

    if (unsafeReason) {
      return this.safeFallback(validatedPlan, unsafeReason, metadata);
    }

    if (validatedPlan.safety.allergyOrHealthConcern) {
      return this.allergyFallback(validatedPlan, metadata);
    }

    if (validatedPlan.safety.refusedUnsafeRequest) {
      return this.safeFallback(validatedPlan, "model_refused_unsafe_request", metadata);
    }

    if (validatedPlan.intent === "out_of_scope") {
      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.text,
        suggestedActions: ["show_menu", "escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.fallback_to_human,
            status: AiWaiterToolCallStatus.skipped,
            output: { reason: "out_of_scope_redirect" },
          },
        ],
        metadata,
      });
    }

    if (validatedPlan.intent === "call_waiter" || validatedPlan.safety.requiresHumanFallback) {
      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.escalation,
        suggestedActions: ["escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.fallback_to_human,
            status: AiWaiterToolCallStatus.succeeded,
            output: { reason: validatedPlan.safety.reason ?? "customer_requested_human" },
          },
        ],
        metadata,
      });
    }

    if (validatedPlan.intent === "request_bill") {
      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.action_result,
        suggestedActions: ["request_bill", "escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.request_bill,
            status: AiWaiterToolCallStatus.skipped,
            output: { reason: "bill_flow_is_separate_endpoint" },
          },
        ],
        metadata,
      });
    }

    if (validatedPlan.intent === "order_status") {
      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.action_result,
        suggestedActions: ["view_order_status", "escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.read_order_status,
            status: AiWaiterToolCallStatus.skipped,
            output: { reason: "customer_status_flow_is_separate_endpoint" },
          },
        ],
        metadata,
      });
    }

    if (validatedPlan.missingRequiredModifier) {
      const item = this.findMenuItem(
        context,
        validatedPlan.missingRequiredModifier.menuItemId,
      );
      const group = item?.modifierGroups.find(
        (modifierGroup) =>
          modifierGroup.id === validatedPlan.missingRequiredModifier?.modifierGroupId,
      );

      if (!item || !group) {
        return this.safeFallback(validatedPlan, "unknown_required_modifier", metadata);
      }

      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.text,
        suggestedActions: ["answer_required_modifier", "escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.create_cart_proposal,
            status: AiWaiterToolCallStatus.skipped,
            input: {
              menuItemId: item.id,
              modifierGroupId: group.id,
            },
            output: { reason: "missing_required_options" },
          },
        ],
        metadata: {
          ...metadata,
          matchedMenuItemId: item.id,
          missingModifierGroupId: group.id,
        },
      });
    }

    if (validatedPlan.proposedCart?.items.length) {
      const proposalValidation = this.validateProposal(
        validatedPlan,
        context,
      );

      if (!proposalValidation.ok) {
        return this.safeFallback(validatedPlan, proposalValidation.reason, metadata);
      }

      return {
        content: validatedPlan.assistantMessage,
        kind: AiWaiterMessageKind.cart_proposal,
        suggestedActions: ["apply_cart_proposal", "reject_cart_proposal", "escalate_to_waiter"],
        proposal: {
          title: validatedPlan.proposedCart.title,
          items: proposalValidation.items,
        },
        toolCalls: [
          {
            toolName: AiWaiterToolName.create_cart_proposal,
            status: AiWaiterToolCallStatus.succeeded,
            output: {
              itemCount: proposalValidation.items.length,
              menuItemIds: proposalValidation.items.map((item) => item.menuItemId),
            },
          },
        ],
        metadata: {
          ...metadata,
          intent: validatedPlan.intent,
          confidence: validatedPlan.confidence,
          safety: validatedPlan.safety,
        },
      };
    }

    if (validatedPlan.intent === "recommendation") {
      return this.textResult(validatedPlan, {
        kind: AiWaiterMessageKind.menu_suggestion,
        suggestedActions: this.safeSuggestedActions(validatedPlan.suggestedActions, [
          "show_menu",
          "choose_item",
          "escalate_to_waiter",
        ]),
        toolCalls: [
          {
            toolName: AiWaiterToolName.recommend_items,
            status: AiWaiterToolCallStatus.succeeded,
            output: {
              candidates: this.validMenuCandidates(validatedPlan, context),
            },
          },
        ],
        metadata,
      });
    }

    return this.textResult(validatedPlan, {
      kind: AiWaiterMessageKind.text,
      suggestedActions: this.safeSuggestedActions(validatedPlan.suggestedActions, [
        "show_menu",
        "recommend_items",
        "escalate_to_waiter",
      ]),
      toolCalls: [],
      metadata,
    });
  }

  private assertPlanShape(plan: unknown): GroqAiWaiterPlan {
    if (!this.isRecord(plan)) {
      throw new Error("Groq plan must be an object");
    }

    const candidate = plan as Record<string, unknown>;
    const safety = this.isRecord(candidate.safety) ? candidate.safety : {};
    const proposedCart = this.isRecord(candidate.proposedCart)
      ? candidate.proposedCart
      : null;
    const missingRequiredModifier = this.isRecord(candidate.missingRequiredModifier)
      ? candidate.missingRequiredModifier
      : null;

    return {
      customerMessage: this.stringValue(candidate.customerMessage),
      language: this.languageValue(candidate.language),
      intent: this.intentValue(candidate.intent),
      confidence: this.numberValue(candidate.confidence, 0.5, 0, 1),
      assistantMessage: this.stringValue(candidate.assistantMessage),
      suggestedActions: this.stringArray(candidate.suggestedActions),
      menuItemCandidates: this.recordArray(candidate.menuItemCandidates).map((item) => ({
        menuItemId: this.optionalString(item.menuItemId),
        slug: this.optionalString(item.slug),
        name: this.optionalString(item.name),
        reason: this.optionalString(item.reason),
      })),
      proposedCart: proposedCart
        ? {
            title: this.stringValue(proposedCart.title, "AI waiter proposal"),
            items: this.recordArray(proposedCart.items).map((item) => ({
              menuItemId: this.stringValue(item.menuItemId),
              quantity: Math.round(this.numberValue(item.quantity, 1)),
              modifierOptionIds: this.stringArray(item.modifierOptionIds),
              notes: this.optionalString(item.notes),
            })),
          }
        : null,
      missingRequiredModifier: missingRequiredModifier
        ? {
            menuItemId: this.stringValue(missingRequiredModifier.menuItemId),
            modifierGroupId: this.stringValue(missingRequiredModifier.modifierGroupId),
            question: this.stringValue(missingRequiredModifier.question),
          }
        : null,
      safety: {
        requiresHumanFallback: safety.requiresHumanFallback === true,
        reason: this.optionalString(safety.reason),
        allergyOrHealthConcern: safety.allergyOrHealthConcern === true,
        refusedUnsafeRequest: safety.refusedUnsafeRequest === true,
      },
      debug: this.isRecord(candidate.debug)
        ? (candidate.debug as Record<string, unknown>)
        : undefined,
    };
  }

  private validateProposal(plan: GroqAiWaiterPlan, context: AiWaiterContext) {
    const items = plan.proposedCart?.items ?? [];
    const mappedItems: AiWaiterProposalItem[] = [];

    for (const item of items) {
      const menuItem = this.findMenuItem(context, item.menuItemId);

      if (!menuItem) {
        return { ok: false as const, reason: "unknown_menu_item_rejected" };
      }

      if (item.quantity < 1 || item.quantity > MAX_AI_PROPOSAL_QUANTITY) {
        return { ok: false as const, reason: "quantity_limit_enforced" };
      }

      const requiredGroups = menuItem.modifierGroups.filter(
        (group) => group.isRequired && Math.max(1, group.minSelections) > 0,
      );
      const selectedOptionIds = new Set(item.modifierOptionIds);
      const missingRequiredGroup = requiredGroups.find((group) =>
        group.options.every((option) => !selectedOptionIds.has(option.id)),
      );

      if (missingRequiredGroup) {
        return { ok: false as const, reason: "missing_required_modifier" };
      }

      const validOptionIds = new Set(
        menuItem.modifierGroups.flatMap((group) =>
          group.options.map((option) => option.id),
        ),
      );

      if (item.modifierOptionIds.some((optionId) => !validOptionIds.has(optionId))) {
        return { ok: false as const, reason: "unknown_modifier_rejected" };
      }

      for (const group of menuItem.modifierGroups) {
        const selectedCount = group.options.filter((option) =>
          selectedOptionIds.has(option.id),
        ).length;
        const minSelections = group.isRequired
          ? Math.max(1, group.minSelections)
          : Math.max(0, group.minSelections);

        if (selectedCount < minSelections) {
          return { ok: false as const, reason: "missing_required_modifier" };
        }

        if (selectedCount > group.maxSelections) {
          return {
            ok: false as const,
            reason: "modifier_selection_limit_enforced",
          };
        }

        if (group.selectionType === "single" && selectedCount > 1) {
          return {
            ok: false as const,
            reason: "modifier_selection_limit_enforced",
          };
        }
      }

      mappedItems.push({
        menuItemId: menuItem.id,
        quantity: item.quantity,
        modifierOptionIds: item.modifierOptionIds,
        customerNote: item.notes,
      });
    }

    return { ok: true as const, items: mappedItems };
  }

  private firstUnsafeReason(plan: unknown) {
    const json = JSON.stringify(plan).toLowerCase();
    const validatedPlan = this.isRecord(plan)
      ? this.assertPlanShape(plan)
      : undefined;

    if (PRICE_KEYS.some((key) => json.includes(`"${key.toLowerCase()}"`))) {
      return "price_field_rejected";
    }

    if (
      (validatedPlan?.suggestedActions ?? []).some((action) =>
        DISALLOWED_ACTIONS.includes(action.toLowerCase()),
      )
    ) {
      return "unsafe_action_rejected";
    }

    if (this.hasUnsafePriceOrPaymentPromise(json)) {
      return "payment_or_discount_promise_rejected";
    }

    if (
      (validatedPlan?.intent === "allergy_or_health" ||
        validatedPlan?.safety.allergyOrHealthConcern) &&
      ALLERGY_GUARANTEE_WORDS.some((word) => json.includes(word))
    ) {
      return "allergy_guarantee_rejected";
    }

    return undefined;
  }

  private allergyFallback(
    plan: GroqAiWaiterPlan,
    metadata: Record<string, unknown>,
  ): AiWaiterProviderResult {
    return {
      content:
        "سلامتك أهم. مقدرش أضمن خلو أي صنف من مسببات الحساسية أو أدي نصيحة طبية. أقدر أنادي ويتر يتأكد مع الفريق.",
      kind: AiWaiterMessageKind.escalation,
      suggestedActions: ["escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.succeeded,
          output: { reason: "allergy_or_health_no_guarantee" },
        },
      ],
      metadata: {
        ...metadata,
        intent: plan.intent,
        confidence: plan.confidence,
        safety: plan.safety,
        safetyFlags: ["no_allergy_guarantee"],
      },
    };
  }

  private safeFallback(
    plan: GroqAiWaiterPlan,
    reason: string,
    metadata: Record<string, unknown>,
  ): AiWaiterProviderResult {
    return {
      content:
        "خليني أساعدك بأمان. أقدر أرشح من المنيو المتاح أو أنادي ويتر، لكن مش هأكد صنف/سعر/طلب غير متحقق.",
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["show_menu", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.skipped,
          output: { reason },
        },
      ],
      metadata: {
        ...metadata,
        intent: plan.intent,
        confidence: plan.confidence,
        fallbackUsed: true,
        safetyFlags: [reason],
      },
    };
  }

  private textResult(
    plan: GroqAiWaiterPlan,
    input: Omit<AiWaiterProviderResult, "content"> & {
      metadata: Record<string, unknown>;
    },
  ): AiWaiterProviderResult {
    return {
      content: plan.assistantMessage,
      kind: input.kind,
      suggestedActions: this.safeSuggestedActions(input.suggestedActions, []),
      toolCalls: input.toolCalls,
      metadata: {
        ...input.metadata,
        intent: plan.intent,
        confidence: plan.confidence,
        safety: plan.safety,
      },
    };
  }

  private validMenuCandidates(plan: GroqAiWaiterPlan, context: AiWaiterContext) {
    return plan.menuItemCandidates
      .map((candidate) =>
        candidate.menuItemId
          ? this.findMenuItem(context, candidate.menuItemId)
          : context.menuItems.find((item) => item.slug === candidate.slug),
      )
      .filter((item): item is AiWaiterMenuItemSnapshot => Boolean(item))
      .map((item) => ({ menuItemId: item.id, slug: item.slug, name: item.name }));
  }

  private safeSuggestedActions(actions: string[], fallback: string[]) {
    const safeActions = Array.from(
      new Set(
        actions
          .map((action) => action.trim())
          .filter(Boolean)
          .filter((action) => !DISALLOWED_ACTIONS.includes(action.toLowerCase())),
      ),
    );

    return safeActions.length > 0 ? safeActions : fallback;
  }

  private findMenuItem(context: AiWaiterContext, menuItemId: string) {
    return context.menuItems.find((item) => item.id === menuItemId);
  }

  private hasUnsafePriceOrPaymentPromise(json: string) {
    return (
      UNSAFE_PRICE_OR_PAYMENT_WORDS.some((word) => json.includes(word)) ||
      UNSAFE_FREE_PROMISE_PATTERNS.some((pattern) => pattern.test(json))
    );
  }

  private stringValue(value: unknown, fallback = "") {
    if (typeof value !== "string") {
      return fallback;
    }

    return value.trim();
  }

  private optionalString(value: unknown) {
    const normalized = this.stringValue(value);

    return normalized.length > 0 ? normalized : undefined;
  }

  private numberValue(
    value: unknown,
    fallback: number,
    min?: number,
    max?: number,
  ) {
    const parsed = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    if (typeof min === "number" && parsed < min) {
      return min;
    }

    if (typeof max === "number" && parsed > max) {
      return max;
    }

    return parsed;
  }

  private stringArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  }

  private recordArray(value: unknown) {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, unknown> =>
          this.isRecord(item),
        )
      : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private intentValue(value: unknown): GroqAiWaiterPlan["intent"] {
    const allowed: GroqAiWaiterPlan["intent"][] = [
      "open_conversation",
      "recommendation",
      "specific_item_request",
      "cart_proposal",
      "cart_refinement",
      "place_experience_question",
      "service_problem",
      "modifier_question",
      "request_bill",
      "call_waiter",
      "order_status",
      "complaint",
      "allergy_or_health",
      "clarification",
      "out_of_scope",
    ];

    return typeof value === "string" &&
      allowed.includes(value as GroqAiWaiterPlan["intent"])
      ? (value as GroqAiWaiterPlan["intent"])
      : "clarification";
  }

  private languageValue(value: unknown): GroqAiWaiterPlan["language"] {
    return value === "en" || value === "mixed" ? value : "ar-EG";
  }
}
