import { Injectable } from "@nestjs/common";
import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
} from "@prisma/client";
import {
  AiWaiterContext,
  AiWaiterMenuItemSnapshot,
  AiWaiterProvider,
  AiWaiterProviderResult,
} from "./ai-waiter.types";

const HUMAN_KEYWORDS = [
  "waiter",
  "human",
  "help",
  "staff",
  "server",
  "ويتر",
  "جرسون",
  "مساعدة",
  "ساعدني",
  "اكلم",
  "أكلم",
  "انسان",
  "إنسان",
];
const BILL_KEYWORDS = ["bill", "check", "account", "الحساب", "حساب", "فاتورة"];
const ORDER_STATUS_KEYWORDS = [
  "order status",
  "where is my order",
  "my order",
  "status",
  "طلبي",
  "فين الطلب",
  "حالة الطلب",
  "اتأخر",
];
const RECOMMENDATION_KEYWORDS = [
  "recommend",
  "suggest",
  "cold",
  "sweet",
  "refreshing",
  "رشح",
  "ترشح",
  "اقتراح",
  "ساقعة",
  "بارد",
  "مش مسكرة",
  "حلو",
];

@Injectable()
export class AiWaiterStubProviderService implements AiWaiterProvider {
  readonly name = "stub";

  respond(
    context: AiWaiterContext,
    input: { message: string; language: string },
  ) {
    const normalizedMessage = this.normalize(input.message);

    if (this.containsAny(normalizedMessage, HUMAN_KEYWORDS)) {
      return this.humanFallbackResult(input.message);
    }

    if (this.containsAny(normalizedMessage, BILL_KEYWORDS)) {
      return this.billResult(input.message);
    }

    if (this.containsAny(normalizedMessage, ORDER_STATUS_KEYWORDS)) {
      return this.orderStatusResult(input.message);
    }

    const matchedItem = this.findExactMenuMatch(
      normalizedMessage,
      context.menuItems,
    );

    if (matchedItem) {
      const missingRequiredGroups = matchedItem.modifierGroups.filter(
        (group) => group.isRequired && Math.max(1, group.minSelections) > 0,
      );

      if (missingRequiredGroups.length > 0) {
        return this.missingModifiersResult(
          matchedItem,
          missingRequiredGroups[0],
        );
      }

      return this.cartProposalResult(matchedItem);
    }

    if (
      this.containsAny(normalizedMessage, RECOMMENDATION_KEYWORDS) ||
      input.message.trim().length <= 8
    ) {
      return this.recommendationResult(context.menuItems);
    }

    return this.clarifyingResult(input.message);
  }

  safeFallbackResult(reason = "provider_unavailable") {
    return {
      content:
        "حصلت مشكلة بسيطة في الويتر الذكي. أقدر أساعدك بالمنيو الأساسي أو أنادي ويتر.",
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["show_menu", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.skipped,
          output: { reason },
        },
      ],
      metadata: { provider: "stub", fallbackUsed: true, reason },
    } satisfies AiWaiterProviderResult;
  }

  private recommendationResult(menuItems: AiWaiterMenuItemSnapshot[]) {
    const recommendations = this.pickRecommendations(menuItems);

    if (recommendations.length === 0) {
      return {
        content:
          "القائمة المتاحة مش واضحة عندي دلوقتي. أقدر أطلبلك ويتر يساعدك.",
        kind: AiWaiterMessageKind.text,
        suggestedActions: ["escalate_to_waiter"],
        toolCalls: [
          {
            toolName: AiWaiterToolName.show_menu,
            status: AiWaiterToolCallStatus.skipped,
            output: { reason: "no_available_menu_items" },
          },
        ],
        metadata: { provider: "stub" },
      } satisfies AiWaiterProviderResult;
    }

    const names = recommendations.map((item) => item.name).join("، ");

    return {
      content: `أنصحك بـ ${names}. تحب أضيف اختيار منهم كسلة مقترحة؟`,
      kind: AiWaiterMessageKind.menu_suggestion,
      suggestedActions: ["show_menu", "choose_item", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.recommend_items,
          status: AiWaiterToolCallStatus.succeeded,
          output: {
            menuItemIds: recommendations.map((item) => item.id),
          },
        },
      ],
      metadata: { provider: "stub" },
    } satisfies AiWaiterProviderResult;
  }

  private cartProposalResult(item: AiWaiterMenuItemSnapshot) {
    return {
      content: `تمام، حضرتلك اقتراح فيه ${item.name}. راجعه وبعدين طبقه على السلة لو مناسب.`,
      kind: AiWaiterMessageKind.cart_proposal,
      suggestedActions: ["apply_cart_proposal", "reject_cart_proposal"],
      proposal: {
        title: `اقتراح ${item.name}`,
        items: [
          {
            menuItemId: item.id,
            quantity: 1,
            modifierOptionIds: [],
          },
        ],
      },
      toolCalls: [
        {
          toolName: AiWaiterToolName.create_cart_proposal,
          status: AiWaiterToolCallStatus.succeeded,
          input: { menuItemName: item.name },
          output: { menuItemId: item.id, quantity: 1 },
        },
      ],
      metadata: { provider: "stub", matchedMenuItemId: item.id },
    } satisfies AiWaiterProviderResult;
  }

  private missingModifiersResult(
    item: AiWaiterMenuItemSnapshot,
    group: AiWaiterMenuItemSnapshot["modifierGroups"][number],
  ) {
    const options = group.options.map((option) => option.name).join("، ");

    return {
      content: `ينفع. ${item.name} محتاج اختيار ${group.name}${options ? `: ${options}` : ""}. تحب أنهي اختيار؟`,
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["answer_required_modifier", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.create_cart_proposal,
          status: AiWaiterToolCallStatus.skipped,
          input: { menuItemId: item.id },
          output: {
            reason: "missing_required_options",
            modifierGroupId: group.id,
          },
        },
      ],
      metadata: {
        provider: "stub",
        matchedMenuItemId: item.id,
        missingModifierGroupId: group.id,
      },
    } satisfies AiWaiterProviderResult;
  }

  private humanFallbackResult(message: string) {
    return {
      content: "حاضر، أقدر أنادي ويتر يساعدك على الترابيزة.",
      kind: AiWaiterMessageKind.escalation,
      suggestedActions: ["escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.succeeded,
          input: { message },
          output: { suggestedAction: "escalate_to_waiter" },
        },
      ],
      metadata: { provider: "stub", intent: "call_waiter" },
    } satisfies AiWaiterProviderResult;
  }

  private billResult(message: string) {
    return {
      content:
        "حاضر. لو فيه طلب قابل للحساب هطلبهولك من الفريق، ومن غير ما أسجل أي دفع.",
      kind: AiWaiterMessageKind.action_result,
      suggestedActions: ["request_bill", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.request_bill,
          status: AiWaiterToolCallStatus.skipped,
          input: { message },
          output: { reason: "bill_flow_is_separate_endpoint" },
        },
      ],
      metadata: { provider: "stub", intent: "request_bill" },
    } satisfies AiWaiterProviderResult;
  }

  private orderStatusResult(message: string) {
    return {
      content:
        "هراجع حالة الطلب من السيستم. لو مفيش طلب متسجل لسه، الكارت الحالي يفضل مسودة لحد ما تأكده.",
      kind: AiWaiterMessageKind.action_result,
      suggestedActions: ["view_order_status", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.read_order_status,
          status: AiWaiterToolCallStatus.skipped,
          input: { message },
          output: { reason: "order_status_requires_context" },
        },
      ],
      metadata: { provider: "stub", intent: "order_status" },
    } satisfies AiWaiterProviderResult;
  }

  private clarifyingResult(message: string) {
    return {
      content:
        "ممكن توضّحلي تحب إيه من المنيو؟ أقدر أرشحلك حاجات متاحة أو أنادي ويتر لو أسهل.",
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["show_menu", "recommend_items", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.skipped,
          input: { message },
          output: { reason: "clarification_needed" },
        },
      ],
      metadata: { provider: "stub" },
    } satisfies AiWaiterProviderResult;
  }

  private pickRecommendations(menuItems: AiWaiterMenuItemSnapshot[]) {
    const featured = menuItems.filter((item) => item.isFeatured);
    const fallback = menuItems.filter((item) => !item.isFeatured);

    return [...featured, ...fallback].slice(0, 4);
  }

  private findExactMenuMatch(
    normalizedMessage: string,
    menuItems: AiWaiterMenuItemSnapshot[],
  ) {
    return menuItems.find((item) => {
      const normalizedName = this.normalize(item.name);
      const normalizedSlug = this.normalize(item.slug.replace(/-/g, " "));

      return (
        normalizedMessage.includes(normalizedName) ||
        normalizedMessage.includes(normalizedSlug)
      );
    });
  }

  private containsAny(message: string, keywords: string[]) {
    return keywords.some((keyword) =>
      message.includes(this.normalize(keyword)),
    );
  }

  private normalize(value: string) {
    return value.toLocaleLowerCase("ar-EG").replace(/\s+/g, " ").trim();
  }
}
