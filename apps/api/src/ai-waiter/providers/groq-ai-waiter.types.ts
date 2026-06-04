export type GroqAiWaiterIntent =
  | "open_conversation"
  | "recommendation"
  | "specific_item_request"
  | "cart_proposal"
  | "modifier_question"
  | "request_bill"
  | "call_waiter"
  | "order_status"
  | "complaint"
  | "allergy_or_health"
  | "clarification"
  | "out_of_scope";

export type GroqAiWaiterPlan = {
  customerMessage: string;
  language: "ar-EG" | "en" | "mixed";
  intent: GroqAiWaiterIntent;
  confidence: number;
  assistantMessage: string;
  suggestedActions: string[];
  menuItemCandidates: Array<{
    menuItemId?: string;
    slug?: string;
    name?: string;
    reason?: string;
  }>;
  proposedCart?: {
    title: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifierOptionIds: string[];
      notes?: string;
    }>;
  } | null;
  missingRequiredModifier?: {
    menuItemId: string;
    modifierGroupId: string;
    question: string;
  } | null;
  safety: {
    requiresHumanFallback: boolean;
    reason?: string;
    allergyOrHealthConcern?: boolean;
    refusedUnsafeRequest?: boolean;
  };
  debug?: Record<string, unknown>;
};

export class AiWaiterProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_config"
      | "http_error"
      | "rate_limited"
      | "timeout"
      | "network_error"
      | "invalid_json"
      | "invalid_schema"
      | "unsafe_output",
    readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
