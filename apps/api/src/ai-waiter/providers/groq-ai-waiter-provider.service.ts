import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
} from "@prisma/client";
import {
  AiWaiterContext,
  AiWaiterProvider,
  AiWaiterProviderResult,
} from "../ai-waiter.types";
import {
  AiWaiterItemDetailGroundingService,
  ItemDetailGroundingResult,
} from "../grounding/ai-waiter-item-detail-grounding.service";
import {
  AiWaiterMenuGroundingService,
  MenuGroundingResult,
} from "../grounding/ai-waiter-menu-grounding.service";
import { AiWaiterProviderSafetyService } from "./ai-waiter-provider-safety.service";
import {
  AiWaiterProviderError,
  GroqAiWaiterPlan,
} from "./groq-ai-waiter.types";

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type GroqRequestStats = {
  requestBodyChars: number;
  menuItemsSent: number;
  recentMessagesSent: number;
  totalMenuItemsAvailable: number;
  groundingMode: MenuGroundingResult["groundingMode"];
  topMatchReasons: string[];
  exactMatchFound: boolean;
  omittedMenuItemCount: number;
  itemDetailGroundingMode: ItemDetailGroundingResult["mode"];
  itemDetailMenuItemId?: string;
  requiredModifierGroupCount: number;
  optionalModifierGroupCount: number;
  selectedModifierOptionCount: number;
  pendingModifierGroupId?: string;
};

type GroqFetchMetadata = {
  status?: number;
  retryAfter?: string | null;
  latencyMs: number;
  attempt: number;
} & GroqRequestStats;

type GroqPlanResponse = {
  content: string;
  usage?: GroqChatCompletionResponse["usage"];
  stats: GroqRequestStats;
  grounding: MenuGroundingResult;
  itemDetailGrounding: ItemDetailGroundingResult;
  rateLimit: {
    retryAfter: string | null;
    remaining: string | null;
    reset: string | null;
  };
};

type GroqResponseMode =
  | "open_chat"
  | "menu_recommendation"
  | "commerce_action"
  | "clarification"
  | "safety_fallback";

type BalconaActionBlock = {
  action: string;
  items?: Array<{
    menuItemId: string;
    quantity: number;
    modifierOptionIds: string[];
    notes?: string;
  }>;
  reason?: string;
  raw: Record<string, unknown>;
};

type NormalizedGroqOutput = {
  visibleText: string;
  mode: GroqResponseMode;
  plan: GroqAiWaiterPlan;
  actionBlock?: BalconaActionBlock;
  normalizationUsed: boolean;
  actionRejected?: boolean;
  safetyFlags: string[];
};

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_MAX_CONTEXT_ITEMS = 8;
const MAX_RECENT_MESSAGES = 2;
const MAX_RECENT_MESSAGE_CHARS = 200;
const MAX_MENU_DESCRIPTION_CHARS = 160;
const ACTION_MARKER = "BALCONA_ACTION_JSON:";
const JSON_RETRY_INSTRUCTION =
  "Return a safe customer-facing answer. Plain text is allowed. If you include BALCONA_ACTION_JSON, make that action JSON valid only.";
const SAFE_ACTIONS = new Set([
  "none",
  "create_cart_proposal",
  "call_waiter",
  "request_bill",
  "order_status",
]);
const DISALLOWED_ACTIONS = new Set([
  "final_order_submit",
  "submit_order",
  "pay",
  "take_payment",
  "refund",
  "discount",
  "change_price",
  "update_price",
  "delete_order",
  "confirm_payment",
]);
const PRICE_OR_COMMERCE_KEYS = [
  "price",
  "priceMinor",
  "basePriceMinor",
  "discount",
  "total",
  "subtotal",
  "currencyAmount",
  "payment",
  "refund",
];

@Injectable()
export class GroqAiWaiterProviderService implements AiWaiterProvider {
  readonly name = "groq";
  private readonly logger = new Logger(GroqAiWaiterProviderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly safetyService: AiWaiterProviderSafetyService,
    private readonly menuGroundingService: AiWaiterMenuGroundingService,
    private readonly itemDetailGroundingService: AiWaiterItemDetailGroundingService,
  ) {}

  async respond(
    context: AiWaiterContext,
    input: { message: string; language: string },
  ): Promise<AiWaiterProviderResult> {
    const apiKey = this.configService.get<string>("aiWaiter.groq.apiKey");

    if (!apiKey) {
      throw new AiWaiterProviderError(
        "GROQ_API_KEY is not configured",
        "missing_config",
      );
    }

    if (this.configService.get<boolean>("aiWaiter.groq.dryRun")) {
      throw new AiWaiterProviderError(
        "GROQ_DRY_RUN is enabled",
        "missing_config",
        {
          dryRun: true,
        },
      );
    }

    const model =
      this.configService.get<string>("aiWaiter.groq.model") ??
      DEFAULT_GROQ_MODEL;
    const startedAt = Date.now();
    const requestInput = {
      apiKey,
      model,
      context,
      input,
    };
    const firstResponse = await this.requestPlan({
      ...requestInput,
      outputRetryAttempt: 0,
    });

    try {
      return this.mapGroqResponse(firstResponse, context, {
        model,
        startedAt,
        retryUsed: false,
        customerInput: input,
      });
    } catch (error) {
      if (!this.isRetryableOutputError(error)) {
        throw error;
      }

      this.logProviderError(error);

      const retryResponse = await this.requestPlan({
        ...requestInput,
        outputRetryAttempt: 1,
      });

      return this.mapGroqResponse(retryResponse, context, {
        model,
        startedAt,
        retryUsed: true,
        customerInput: input,
      });
    }
  }

  private async requestPlan(input: {
    apiKey: string;
    model: string;
    context: AiWaiterContext;
    input: { message: string; language: string };
    outputRetryAttempt: number;
  }): Promise<GroqPlanResponse> {
    const maxRetries = this.numberConfig(
      "aiWaiter.groq.maxRetries",
      DEFAULT_MAX_RETRIES,
    );
    const requestBody = this.buildCompletionRequestBody(input);
    let lastError: AiWaiterProviderError | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const startedAt = Date.now();

      try {
        const response = await this.fetchCompletion(
          input.apiKey,
          requestBody.body,
        );
        const latencyMs = Date.now() - startedAt;

        if (!response.ok) {
          const retryAfter = response.headers.get("retry-after");
          const metadata: GroqFetchMetadata = {
            status: response.status,
            retryAfter,
            latencyMs,
            attempt,
            ...requestBody.stats,
          };
          const errorCode =
            response.status === 429
              ? "rate_limited"
              : response.status >= 500
                ? "http_error"
                : "http_error";

          lastError = new AiWaiterProviderError(
            `Groq request failed with status ${response.status}`,
            errorCode,
            metadata,
          );
          this.logProviderError(lastError);

          if (!this.shouldRetry(response.status, attempt, maxRetries)) {
            throw lastError;
          }

          await this.delayForRetry(retryAfter);
          continue;
        }

        const json = (await response.json()) as GroqChatCompletionResponse;
        const content = json.choices?.[0]?.message?.content;

        if (!this.stringValue(content)) {
          throw new AiWaiterProviderError(
            "Groq returned empty content",
            "invalid_schema",
            {
              latencyMs,
              attempt,
              ...requestBody.stats,
            },
          );
        }

        return {
          content: content ?? "",
          usage: json.usage,
          stats: requestBody.stats,
          grounding: requestBody.grounding,
          itemDetailGrounding: requestBody.itemDetailGrounding,
          rateLimit: this.safeRateLimitHeaders(response),
        };
      } catch (error) {
        if (error instanceof AiWaiterProviderError) {
          lastError = error;
        } else if (error instanceof Error && error.name === "AbortError") {
          lastError = new AiWaiterProviderError(
            "Groq request timed out",
            "timeout",
            {
              attempt,
              ...requestBody.stats,
            },
          );
        } else {
          lastError = new AiWaiterProviderError(
            error instanceof Error ? error.message : "Groq network error",
            "network_error",
            { attempt, ...requestBody.stats },
          );
        }

        this.logProviderError(lastError);

        if (
          attempt >= maxRetries ||
          !["timeout", "network_error"].includes(lastError.code)
        ) {
          throw lastError;
        }
      }
    }

    throw (
      lastError ??
      new AiWaiterProviderError("Groq request failed", "network_error")
    );
  }

  private async fetchCompletion(apiKey: string, body: string) {
    const timeoutMs = this.numberConfig(
      "aiWaiter.groq.timeoutMs",
      DEFAULT_TIMEOUT_MS,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildCompletionRequestBody(input: {
    model: string;
    context: AiWaiterContext;
    input: { message: string; language: string };
    outputRetryAttempt: number;
  }) {
    const contextPayload = this.contextPayload(
      input.context,
      input.input.message,
    );
    const body = JSON.stringify({
      model: input.model,
      temperature: 0.45,
      max_completion_tokens: 900,
      messages: [
        { role: "system", content: this.systemPrompt() },
        { role: "user", content: JSON.stringify(contextPayload.payload) },
        {
          role: "user",
          content: JSON.stringify({
            customerMessage: input.input.message,
            requestedLanguage: input.input.language,
            retryInstruction:
              input.outputRetryAttempt > 0 ? JSON_RETRY_INSTRUCTION : undefined,
          }),
        },
      ],
    });
    const stats = {
      requestBodyChars: body.length,
      menuItemsSent: contextPayload.grounding.candidates.length,
      recentMessagesSent: contextPayload.recentMessagesSent,
      totalMenuItemsAvailable: contextPayload.grounding.totalMenuItemsAvailable,
      groundingMode: contextPayload.grounding.groundingMode,
      topMatchReasons: contextPayload.grounding.topMatchReasons,
      exactMatchFound: contextPayload.grounding.exactMatchFound,
      omittedMenuItemCount: contextPayload.grounding.omittedMenuItemCount,
      itemDetailGroundingMode: contextPayload.itemDetailGrounding.mode,
      itemDetailMenuItemId: contextPayload.itemDetailGrounding.item?.id,
      requiredModifierGroupCount:
        contextPayload.itemDetailGrounding.item?.requiredModifierGroups.length ??
        0,
      optionalModifierGroupCount:
        contextPayload.itemDetailGrounding.item?.optionalModifierGroups.length ??
        0,
      selectedModifierOptionCount:
        contextPayload.itemDetailGrounding.selectedModifierOptionIds.length,
      pendingModifierGroupId:
        contextPayload.itemDetailGrounding.pendingModifier?.modifierGroupId,
    };

    this.logger.debug({
      provider: "groq",
      requestBodyChars: stats.requestBodyChars,
      menuItemsSent: stats.menuItemsSent,
      recentMessagesSent: stats.recentMessagesSent,
      totalMenuItemsAvailable: stats.totalMenuItemsAvailable,
      groundingMode: stats.groundingMode,
      omittedMenuItemCount: stats.omittedMenuItemCount,
      itemDetailGroundingMode: stats.itemDetailGroundingMode,
      itemDetailMenuItemId: stats.itemDetailMenuItemId,
      requiredModifierGroupCount: stats.requiredModifierGroupCount,
      optionalModifierGroupCount: stats.optionalModifierGroupCount,
      selectedModifierOptionCount: stats.selectedModifierOptionCount,
      pendingModifierGroupId: stats.pendingModifierGroupId,
    });

    return {
      body,
      stats,
      grounding: contextPayload.grounding,
      itemDetailGrounding: contextPayload.itemDetailGrounding,
    };
  }

  private mapGroqResponse(
    response: GroqPlanResponse,
    context: AiWaiterContext,
    input: {
      model: string;
      startedAt: number;
      retryUsed: boolean;
      customerInput: { message: string; language: string };
    },
  ) {
    const normalized = this.normalizeGroqOutput(
      response.content,
      input.customerInput,
      context,
      response.grounding,
      response.itemDetailGrounding,
    );
    const latencyMs = Date.now() - input.startedAt;
    const metadata = {
      provider: "groq",
      model: input.model,
      mode: normalized.mode,
      normalizationUsed: normalized.normalizationUsed,
      actionRejected: normalized.actionRejected === true ? true : undefined,
      safetyFlags:
        normalized.safetyFlags.length > 0 ? normalized.safetyFlags : undefined,
      fallbackUsed: normalized.mode === "safety_fallback",
      latencyMs,
      retryUsed: input.retryUsed,
      requestBodyChars: response.stats.requestBodyChars,
      menuItemsSent: response.stats.menuItemsSent,
      recentMessagesSent: response.stats.recentMessagesSent,
      totalMenuItemsAvailable: response.stats.totalMenuItemsAvailable,
      groundingMode: response.stats.groundingMode,
      topMatchReasons: response.stats.topMatchReasons,
      exactMatchFound: response.stats.exactMatchFound,
      omittedMenuItemCount: response.stats.omittedMenuItemCount,
      itemDetailGroundingMode: response.stats.itemDetailGroundingMode,
      itemDetailMenuItemId: response.stats.itemDetailMenuItemId,
      requiredModifierGroupCount: response.stats.requiredModifierGroupCount,
      optionalModifierGroupCount: response.stats.optionalModifierGroupCount,
      selectedModifierOptionCount: response.stats.selectedModifierOptionCount,
      pendingModifierGroupId: response.stats.pendingModifierGroupId,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      rateLimit: response.rateLimit,
    };

    if (normalized.mode === "safety_fallback") {
      return this.safetyFallbackResult(normalized, metadata);
    }

    if (normalized.actionRejected) {
      return this.openChatResult(normalized, {
        ...metadata,
        mode: "open_chat",
        actionRejected: true,
        fallbackUsed: false,
      });
    }

    const modifierQuestion = this.modifierQuestionResult(
      normalized,
      response.itemDetailGrounding,
      metadata,
    );

    if (modifierQuestion) {
      return modifierQuestion;
    }

    const plan = this.planWithDeterministicModifierCompletion(
      normalized.plan,
      response.itemDetailGrounding,
    );
    const mode =
      plan === normalized.plan ? normalized.mode : "commerce_action";
    const mapped = this.safetyService.validateAndMapPlan(
      plan,
      context,
      {
        ...metadata,
        mode,
      },
    );

    if (
      mode === "commerce_action" &&
      mapped.metadata?.fallbackUsed === true &&
      normalized.visibleText.length > 0
    ) {
      return this.openChatResult(normalized, {
        ...metadata,
        mode: "open_chat",
        actionRejected: true,
        fallbackUsed: false,
        safetyFlags: this.metadataSafetyFlags(mapped.metadata),
      });
    }

    return mapped;
  }

  private normalizeGroqOutput(
    rawContent: string,
    input: { message: string; language: string },
    context: AiWaiterContext,
    grounding: MenuGroundingResult,
    itemDetailGrounding: ItemDetailGroundingResult,
  ): NormalizedGroqOutput {
    const actionExtraction = this.extractActionBlock(rawContent);
    const rawJson = this.tryParseJson(actionExtraction.visibleContent);
    const rawRecord = this.isRecord(rawJson) ? rawJson : undefined;
    const language = this.languageValue(
      rawRecord?.language,
      input.language,
      input.message,
    );
    const visibleText = this.visibleTextFromOutput(
      actionExtraction.visibleContent,
      rawRecord,
      language,
    );
    const visibleUnsafeReason = this.firstUnsafeVisibleTextReason(visibleText);
    const action = this.normalizeActionBlock(actionExtraction.actionBlock);
    const actionRejected =
      actionExtraction.actionParseError !== undefined ||
      action.rejectionReason !== undefined;
    const safetyFlags = [
      ...(visibleUnsafeReason ? [visibleUnsafeReason] : []),
      ...(actionExtraction.actionParseError
        ? [actionExtraction.actionParseError]
        : []),
      ...(action.rejectionReason ? [action.rejectionReason] : []),
    ];

    if (visibleUnsafeReason) {
      return {
        visibleText,
        mode: "safety_fallback",
        plan: this.normalizeGroqPlan(
          rawRecord ?? { assistantMessage: visibleText },
          input,
          language,
          visibleText,
          action.block,
          actionExtraction.actionBlock,
        ),
        actionBlock: action.block,
        normalizationUsed: true,
        actionRejected,
        safetyFlags,
      };
    }

    if (
      actionExtraction.actionParseError &&
      visibleText === this.defaultAssistantMessage(language)
    ) {
      throw new AiWaiterProviderError(
        "Groq returned malformed action JSON without safe visible text",
        "invalid_schema",
      );
    }

    const plan = this.normalizeGroqPlan(
      rawRecord ?? { assistantMessage: visibleText },
      input,
      language,
      visibleText,
      action.block,
      actionExtraction.actionBlock,
    );
    const groundingRejectionReason = this.groundingRejectionReason(
      plan,
      action.block,
      grounding,
      itemDetailGrounding,
    );
    const finalActionRejected =
      actionRejected || groundingRejectionReason !== undefined;

    if (groundingRejectionReason) {
      safetyFlags.push(groundingRejectionReason);
    }

    const mode = this.modeForPlan(
      plan,
      action.block,
      finalActionRejected,
      rawRecord,
      context,
    );

    return {
      visibleText,
      mode,
      plan,
      actionBlock: action.block,
      normalizationUsed: true,
      actionRejected: finalActionRejected,
      safetyFlags,
    };
  }

  private normalizeGroqPlan(
    rawPlan: Record<string, unknown>,
    input: { message: string; language: string },
    language: GroqAiWaiterPlan["language"],
    visibleText: string,
    actionBlock?: BalconaActionBlock,
    rawActionBlock?: unknown,
  ): GroqAiWaiterPlan {
    const safety = this.isRecord(rawPlan.safety) ? rawPlan.safety : {};
    const debug = this.isRecord(rawPlan.debug) ? rawPlan.debug : {};
    const intent = this.intentValue(rawPlan.intent, actionBlock);

    return {
      customerMessage: this.stringValue(rawPlan.customerMessage, input.message),
      language,
      intent,
      confidence: this.numberValue(rawPlan.confidence, 0.5, 0, 1),
      assistantMessage: this.stringValue(
        visibleText,
        this.defaultAssistantMessage(language),
      ),
      suggestedActions: this.suggestedActionsFor(rawPlan, actionBlock),
      menuItemCandidates: this.recordArray(rawPlan.menuItemCandidates).map(
        (item) => ({
          menuItemId: this.optionalString(item.menuItemId),
          slug: this.optionalString(item.slug),
          name: this.optionalString(item.name),
          reason: this.optionalString(item.reason),
        }),
      ),
      proposedCart: this.proposedCartFor(rawPlan, actionBlock),
      missingRequiredModifier: this.normalizeMissingRequiredModifier(
        rawPlan.missingRequiredModifier,
      ),
      safety: {
        requiresHumanFallback:
          safety.requiresHumanFallback === true ||
          actionBlock?.action === "call_waiter",
        reason: this.optionalString(safety.reason ?? actionBlock?.reason),
        allergyOrHealthConcern: safety.allergyOrHealthConcern === true,
        refusedUnsafeRequest: safety.refusedUnsafeRequest === true,
      },
      debug: {
        ...debug,
        normalizationUsed: true,
        rawOutputForSafety: rawPlan,
        rawActionBlockForSafety: rawActionBlock,
      },
    };
  }

  private openChatResult(
    normalized: NormalizedGroqOutput,
    metadata: Record<string, unknown>,
  ): AiWaiterProviderResult {
    return {
      content: normalized.visibleText,
      kind: AiWaiterMessageKind.text,
      suggestedActions: [],
      toolCalls: [],
      metadata,
    };
  }

  private safetyFallbackResult(
    normalized: NormalizedGroqOutput,
    metadata: Record<string, unknown>,
  ): AiWaiterProviderResult {
    return {
      content:
        "خليني أساعدك بأمان. أقدر أرد عليك أو أرشح من تجربة بالكونا، لكن مش هأكد سعر/دفع/خصم/سلامة صحية غير متحقق.",
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["show_menu", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.fallback_to_human,
          status: AiWaiterToolCallStatus.skipped,
          output: {
            reason: normalized.safetyFlags[0] ?? "unsafe_visible_text_rejected",
          },
        },
      ],
      metadata,
    };
  }

  private modifierQuestionResult(
    normalized: NormalizedGroqOutput,
    itemDetail: ItemDetailGroundingResult,
    metadata: Record<string, unknown>,
  ): AiWaiterProviderResult | undefined {
    if (
      itemDetail.mode === "none" ||
      itemDetail.missingRequiredGroups.length === 0 ||
      !itemDetail.item
    ) {
      return undefined;
    }

    const pendingModifier =
      itemDetail.pendingModifier ??
      this.pendingModifierFromMissingGroup(itemDetail);

    if (!pendingModifier) {
      return undefined;
    }

    return {
      content: pendingModifier.question,
      kind: AiWaiterMessageKind.text,
      suggestedActions: ["answer_required_modifier", "escalate_to_waiter"],
      toolCalls: [
        {
          toolName: AiWaiterToolName.create_cart_proposal,
          status: AiWaiterToolCallStatus.skipped,
          input: {
            menuItemId: itemDetail.item.id,
            modifierGroupId: pendingModifier.modifierGroupId,
          },
          output: {
            reason: "missing_required_options",
          },
        },
      ],
      metadata: {
        ...metadata,
        mode: "modifier_question",
        intent: "modifier_question",
        confidence: normalized.plan.confidence,
        safety: normalized.plan.safety,
        pendingModifier,
        pendingItem: {
          id: itemDetail.item.id,
          name: itemDetail.item.name,
        },
        selectedModifierOptionIds: itemDetail.selectedModifierOptionIds,
        missingRequiredGroups: itemDetail.missingRequiredGroups.map((group) => ({
          id: group.id,
          name: group.name,
          slug: group.slug,
          minSelections: group.minSelections,
          maxSelections: group.maxSelections,
        })),
        itemDetailGroundingMode: itemDetail.mode,
        itemDetailMenuItemId: itemDetail.item.id,
        requiredModifierGroupCount: itemDetail.item.requiredModifierGroups.length,
        optionalModifierGroupCount: itemDetail.item.optionalModifierGroups.length,
        selectedModifierOptionCount: itemDetail.selectedModifierOptionIds.length,
        pendingModifierGroupId: pendingModifier.modifierGroupId,
      },
    };
  }

  private pendingModifierFromMissingGroup(
    itemDetail: ItemDetailGroundingResult,
  ) {
    const group = itemDetail.missingRequiredGroups[0];

    if (!itemDetail.item || !group) {
      return undefined;
    }

    return {
      menuItemId: itemDetail.item.id,
      modifierGroupId: group.id,
      allowedOptionIds: group.options.map((option) => option.id),
      allowedOptions: group.options,
      selectedModifierOptionIds: itemDetail.selectedModifierOptionIds,
      question: `تمام، ${itemDetail.item.name}. اختار ${group.name}: ${group.options
        .map((option) => option.name)
        .join(" / ")}؟`,
      createdAt: new Date().toISOString(),
    };
  }

  private planWithDeterministicModifierCompletion(
    plan: GroqAiWaiterPlan,
    itemDetail: ItemDetailGroundingResult,
  ): GroqAiWaiterPlan {
    if (
      !itemDetail.item ||
      itemDetail.missingRequiredGroups.length > 0 ||
      itemDetail.selectedModifierOptionIds.length === 0
    ) {
      return plan;
    }

    const selectedModifierOptionIds = Array.from(
      new Set(itemDetail.selectedModifierOptionIds),
    );
    const proposedCart = plan.proposedCart?.items.length
      ? {
          title: plan.proposedCart.title,
          items: plan.proposedCart.items.map((item) =>
            item.menuItemId === itemDetail.item?.id
              ? {
                  ...item,
                  modifierOptionIds: Array.from(
                    new Set([
                      ...(item.modifierOptionIds ?? []),
                      ...selectedModifierOptionIds,
                    ]),
                  ),
                }
              : item,
          ),
        }
      : {
          title: "AI waiter proposal",
          items: [
            {
              menuItemId: itemDetail.item.id,
              quantity: 1,
              modifierOptionIds: selectedModifierOptionIds,
            },
          ],
        };

    return {
      ...plan,
      intent: "cart_proposal",
      proposedCart,
      suggestedActions: [
        "apply_cart_proposal",
        "reject_cart_proposal",
        "escalate_to_waiter",
      ],
      assistantMessage: this.stringValue(
        plan.assistantMessage,
        `تمام، هجهز ${itemDetail.item.name} كاقتراح في الكارت. راجع الكارت قبل تأكيد الطلب.`,
      ),
    };
  }

  private systemPrompt() {
    return [
      "You are Balcona Bar's AI Brain - an intelligent companion, premium cafe assistant, and smart waiter.",
      "You can chat openly and naturally like a full AI assistant.",
      "You speak in the customer's language.",
      "If the customer writes Arabic, use warm Egyptian Arabic by default.",
      "If the customer writes English, reply in English.",
      "If the customer uses Franco Arabic, understand it and reply naturally in Egyptian Arabic or natural mixed language.",
      "You understand mixed Arabic and English.",
      "Personality: warm, sharp, helpful, human-like, premium but not fake, concise enough for mobile, emotionally aware, commercially smart, hospitality-first.",
      "You can help with general safe questions, small talk, mood-based help, studying/work session advice, captions, light creative writing, cafe-related ideas, drink and food explanations, menu recommendations, group choices, soft upselling, pairings, customer-service guidance, and Balcona vibe.",
      "Gently connect answers to Balcona when natural, but do not force it. Useful first, salesy second.",
      'Example: User "أنا مخنوق" -> "فاهمك. خلينا نخفف اليوم بحاجة رايقة. تحب حاجة ساقعة ومنعشة ولا قهوة تفوقك شوية؟"',
      'Example: User "اكتبلي كابشن" -> "أكيد. جرب: فوق الدوشة، القعدة هنا بتاخد نفس."',
      'Example: User "عايز أذاكر" -> "لو هتذاكر، خليك في حاجة تفوقك من غير ما تبقى تقيلة. تحب قهوة ساقعة ولا سخنة؟"',
      'Example: User "هات مانجو" -> "تمام، Mango اختيار منعش. تحب أعملهولك كاقتراح في الكارت؟"',
      "Hard platform rules: never submit final orders, change prices, invent prices, invent discounts, confirm payment, issue refunds, guarantee allergy safety, mutate the database directly, expose secrets, or pretend staff confirmed something.",
      "The AI can speak openly. The backend controls actions.",
      "For ordinary conversation, reply with plain customer-facing text. Plain text is valid.",
      "The backend searches the full branch menu internally and sends you a compact relevantMenuItems list.",
      "Use only relevantMenuItems when naming confirmed menu matches or creating action proposals.",
      "If a requested item is not in relevantMenuItems, do not invent it. Ask one short clarification or suggest checking the menu.",
      "For vague recommendations such as cold drink, dessert, or caffeine, recommend from relevantMenuItems and ask one useful follow-up unless the customer clearly chose a specific item.",
      "For broad recommendations, do not ask modifier questions yet.",
      "For exact high-confidence item requests, check itemDetailGrounding before proposing.",
      "If itemDetailGrounding has missingRequiredGroups or pendingModifier, ask the modifier question first and do not create a cart proposal yet.",
      "If itemDetailGrounding has selectedModifierOptionIds and no missingRequiredGroups, use only those backend-provided modifier option ids in any cart proposal.",
      "Use only modifier option ids from itemDetailGrounding. Never invent modifier ids and never expose internal ids to the customer.",
      "If a proposal is incomplete or a modifier answer is unclear, ask one short clarification or offer a human waiter.",
      "Optional modifiers can be suggested, but they must not block a valid proposal.",
      "For exact high-confidence item requests without required modifiers, you may create a cart proposal, but only with menuItemId values from relevantMenuItems.",
      "For bill, waiter, or order status requests, use the matching safe action without menu items.",
      "For allergies or health concerns, never guarantee safety; offer human waiter fallback.",
      "For real platform actions only, optionally append this hidden backend block after the visible answer:",
      "BALCONA_ACTION_JSON:",
      '{ "action": "create_cart_proposal" | "call_waiter" | "request_bill" | "order_status" | "none", "items": [{ "menuItemId": "...", "quantity": 1, "modifierOptionIds": [], "notes": "..." }], "reason": "..." }',
      "Never show the action block as part of the customer-facing answer. The backend strips it.",
      "Allowed action names: none, create_cart_proposal, call_waiter, request_bill, order_status.",
      "Disallowed action names: final_order_submit, submit_order, pay, take_payment, refund, discount, change_price, update_price, delete_order, confirm_payment, and any direct database mutation.",
      "Menu item ids must come only from relevantMenuItems. Never invent menu item ids.",
      "Modifier option ids must come only from itemDetailGrounding for the selected item. Never invent modifier option ids.",
      "Expected structured JSON example when JSON is useful:",
      JSON.stringify({
        customerMessage: "...",
        language: "ar-EG",
        intent: "recommendation",
        confidence: 0.8,
        assistantMessage: "تمام، أرشحلك حاجة منعشة من الاختيارات المتاحة.",
        suggestedActions: ["show_menu"],
        menuItemCandidates: [],
        proposedCart: null,
        missingRequiredModifier: null,
        safety: {
          requiresHumanFallback: false,
          allergyOrHealthConcern: false,
          refusedUnsafeRequest: false,
        },
        debug: {},
      }),
      "Do not include prices, payment confirmations, final order submission, markdown tables, or chain-of-thought.",
      "If the customer is unsure, ask one short useful question. Suggest pairings and next steps naturally without pressure.",
    ].join("\n");
  }

  private contextPayload(context: AiWaiterContext, customerMessage: string) {
    const maxItems = this.numberConfig(
      "aiWaiter.groq.maxContextItems",
      DEFAULT_MAX_CONTEXT_ITEMS,
    );
    const grounding = this.menuGroundingService.rankCandidates(context, {
      message: customerMessage,
      maxCandidates: maxItems,
    });
    const itemDetailGrounding = this.itemDetailGroundingService.build({
      context,
      message: customerMessage,
      grounding,
    });
    const relevantMenuItems = grounding.candidates.map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: this.truncateText(
        item.description ?? "",
        MAX_MENU_DESCRIPTION_CHARS,
      ),
      isFeatured: item.isFeatured,
      category: item.category,
    }));
    const recentMessages = context.recentMessages
      .slice(-MAX_RECENT_MESSAGES)
      .map((message) => ({
        role: message.role,
        kind: message.kind,
        content: this.truncateText(message.content, MAX_RECENT_MESSAGE_CHARS),
        metadata: message.metadata,
      }));
    const compactItemDetail =
      itemDetailGrounding.mode === "none"
        ? undefined
        : {
            mode: itemDetailGrounding.mode,
            item: itemDetailGrounding.item,
            pendingModifier: itemDetailGrounding.pendingModifier,
            pendingItem: itemDetailGrounding.pendingItem,
            selectedModifierOptionIds:
              itemDetailGrounding.selectedModifierOptionIds,
            missingRequiredGroups: itemDetailGrounding.missingRequiredGroups,
            confidence: itemDetailGrounding.confidence,
            reasons: itemDetailGrounding.reasons,
          };

    return {
      payload: {
        branch: {
          id: context.branch.id,
          name: context.branch.name,
          slug: context.branch.slug,
        },
        tableSession: {
          id: context.tableSession.id,
          status: context.tableSession.status,
          partySize: context.tableSession.partySize,
        },
        cart: this.compactCartSummary(context.cartSummary),
        recentMessages,
        menuPolicy: {
          onlyUseRelevantMenuItemIds: true,
          pricesAreBackendOnly: true,
          finalOrderSubmitIsForbidden: true,
          actionBlockIsOptional: true,
          fullMenuWasSearchedByBackend: true,
          missingItemRequiresClarification: true,
          modifierDetailsAreSelectedItemOnly: true,
        },
        grounding: {
          mode: grounding.groundingMode,
          totalMenuItemsAvailable: grounding.totalMenuItemsAvailable,
          menuItemsSent: relevantMenuItems.length,
          omittedMenuItemCount: grounding.omittedMenuItemCount,
          exactMatchFound: grounding.exactMatchFound,
          topMatchReasons: grounding.topMatchReasons,
        },
        relevantMenuItems,
        itemDetailGrounding: compactItemDetail,
      },
      recentMessagesSent: recentMessages.length,
      grounding,
      itemDetailGrounding,
    };
  }

  private extractActionBlock(content: string) {
    const markerIndex = content.indexOf(ACTION_MARKER);

    if (markerIndex < 0) {
      return { visibleContent: content };
    }

    const beforeMarker = content.slice(0, markerIndex).trim();
    const afterMarker = content.slice(markerIndex + ACTION_MARKER.length);
    const parsed = this.parseLeadingJsonObject(afterMarker);

    if (!parsed) {
      return {
        visibleContent: beforeMarker,
        actionParseError: "invalid_action_json",
      };
    }

    return {
      visibleContent: beforeMarker,
      actionBlock: parsed.value,
    };
  }

  private normalizeActionBlock(value: unknown): {
    block?: BalconaActionBlock;
    rejectionReason?: string;
  } {
    if (value === undefined) {
      return {};
    }

    if (!this.isRecord(value)) {
      return { rejectionReason: "invalid_action_json" };
    }

    const action = this.stringValue(value.action, "none");
    const normalizedAction = action.trim().toLowerCase();

    if (DISALLOWED_ACTIONS.has(normalizedAction)) {
      return { rejectionReason: "unsafe_action_rejected" };
    }

    if (!SAFE_ACTIONS.has(normalizedAction)) {
      return { rejectionReason: "unsafe_action_rejected" };
    }

    if (this.hasUnsafeCommerceKeys(value)) {
      return { rejectionReason: "price_field_rejected" };
    }

    if (normalizedAction === "none") {
      return {
        block: {
          action: "none",
          reason: this.optionalString(value.reason),
          raw: value,
        },
      };
    }

    if (normalizedAction === "create_cart_proposal") {
      const items = this.recordArray(value.items).map((item) => ({
        menuItemId: this.stringValue(item.menuItemId),
        quantity: Math.round(this.numberValue(item.quantity, 1)),
        modifierOptionIds: this.stringArray(item.modifierOptionIds),
        notes: this.optionalString(item.notes),
      }));

      if (items.length === 0) {
        return { rejectionReason: "invalid_action_payload" };
      }

      return {
        block: {
          action: normalizedAction,
          items,
          reason: this.optionalString(value.reason),
          raw: value,
        },
      };
    }

    return {
      block: {
        action: normalizedAction,
        reason: this.optionalString(value.reason),
        raw: value,
      },
    };
  }

  private visibleTextFromOutput(
    visibleContent: string,
    rawRecord: Record<string, unknown> | undefined,
    language: GroqAiWaiterPlan["language"],
  ) {
    if (rawRecord) {
      return this.stringValue(
        rawRecord.assistantMessage ??
          rawRecord.message ??
          rawRecord.response ??
          rawRecord.content,
        this.defaultAssistantMessage(language),
      );
    }

    return this.stringValue(
      this.stripCodeFences(visibleContent),
      this.defaultAssistantMessage(language),
    );
  }

  private modeForPlan(
    plan: GroqAiWaiterPlan,
    actionBlock: BalconaActionBlock | undefined,
    actionRejected: boolean,
    rawRecord: Record<string, unknown> | undefined,
    context: AiWaiterContext,
  ): GroqResponseMode {
    if (actionRejected) {
      return "open_chat";
    }

    if (actionBlock && actionBlock.action !== "none") {
      return "commerce_action";
    }

    if (plan.proposedCart?.items.length) {
      return "commerce_action";
    }

    if (
      plan.intent === "request_bill" ||
      plan.intent === "call_waiter" ||
      plan.intent === "order_status"
    ) {
      return "commerce_action";
    }

    if (
      plan.intent === "recommendation" ||
      plan.menuItemCandidates.length > 0 ||
      context.menuItems.some((item) =>
        plan.assistantMessage.toLowerCase().includes(item.name.toLowerCase()),
      )
    ) {
      return "menu_recommendation";
    }

    if (rawRecord?.intent === "clarification") {
      return "clarification";
    }

    return "open_chat";
  }

  private suggestedActionsFor(
    rawPlan: Record<string, unknown>,
    actionBlock: BalconaActionBlock | undefined,
  ) {
    if (actionBlock?.action === "create_cart_proposal") {
      return [
        "apply_cart_proposal",
        "reject_cart_proposal",
        "escalate_to_waiter",
      ];
    }

    if (actionBlock?.action === "call_waiter") {
      return ["escalate_to_waiter"];
    }

    if (actionBlock?.action === "request_bill") {
      return ["request_bill", "escalate_to_waiter"];
    }

    if (actionBlock?.action === "order_status") {
      return ["view_order_status", "escalate_to_waiter"];
    }

    return this.stringArray(rawPlan.suggestedActions);
  }

  private proposedCartFor(
    rawPlan: Record<string, unknown>,
    actionBlock: BalconaActionBlock | undefined,
  ): GroqAiWaiterPlan["proposedCart"] {
    if (actionBlock?.action === "create_cart_proposal") {
      return {
        title: "AI waiter proposal",
        items: actionBlock.items ?? [],
      };
    }

    return this.normalizeProposedCart(rawPlan.proposedCart);
  }

  private groundingRejectionReason(
    plan: GroqAiWaiterPlan,
    actionBlock: BalconaActionBlock | undefined,
    grounding: MenuGroundingResult,
    itemDetailGrounding: ItemDetailGroundingResult,
  ) {
    const groundedItemIds = new Set(
      grounding.candidates.map((candidate) => candidate.id),
    );

    if (itemDetailGrounding.item) {
      groundedItemIds.add(itemDetailGrounding.item.id);
    }
    const actionItems =
      actionBlock?.action === "create_cart_proposal"
        ? (actionBlock.items ?? [])
        : [];
    const planItems = plan.proposedCart?.items ?? [];
    const proposalItems = [...actionItems, ...planItems];

    if (proposalItems.length === 0) {
      return undefined;
    }

    if (proposalItems.some((item) => !groundedItemIds.has(item.menuItemId))) {
      return "ungrounded_menu_item_rejected";
    }

    if (itemDetailGrounding.item) {
      const allowedModifierOptionIds = new Set(
        [
          ...itemDetailGrounding.item.requiredModifierGroups,
          ...itemDetailGrounding.item.optionalModifierGroups,
        ].flatMap((group) => group.options.map((option) => option.id)),
      );
      const selectedItemProposals = proposalItems.filter(
        (item) => item.menuItemId === itemDetailGrounding.item?.id,
      );

      if (
        selectedItemProposals.some((item) =>
          (item.modifierOptionIds ?? []).some(
            (optionId) => !allowedModifierOptionIds.has(optionId),
          ),
        )
      ) {
        return "ungrounded_modifier_option_rejected";
      }
    }

    return undefined;
  }

  private intentValue(
    value: unknown,
    actionBlock: BalconaActionBlock | undefined,
  ): GroqAiWaiterPlan["intent"] {
    if (actionBlock?.action === "create_cart_proposal") {
      return "cart_proposal";
    }

    if (actionBlock?.action === "call_waiter") {
      return "call_waiter";
    }

    if (actionBlock?.action === "request_bill") {
      return "request_bill";
    }

    if (actionBlock?.action === "order_status") {
      return "order_status";
    }

    const allowed: GroqAiWaiterPlan["intent"][] = [
      "open_conversation",
      "recommendation",
      "specific_item_request",
      "cart_proposal",
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
      : "open_conversation";
  }

  private firstUnsafeVisibleTextReason(text: string) {
    const normalized = text.toLowerCase();

    if (!normalized) {
      return "empty_groq_response";
    }

    const unsafePatterns: Array<[RegExp, string]> = [
      [
        /\b(discount|refund)\s+(confirmed|applied|issued|processed)\b/,
        "payment_or_discount_promise_rejected",
      ],
      [
        /\b(payment|paid)\s+(confirmed|successful|received)\b/,
        "payment_or_discount_promise_rejected",
      ],
      [
        /\b(final\s+)?order\s+(submitted|placed|confirmed)\b/,
        "unsafe_action_rejected",
      ],
      [
        /\b(price|total)\s+(changed|updated|lowered|reduced)\b/,
        "price_field_rejected",
      ],
      [
        /(^|[^-\w])free\s+(item|order|drink|dessert|coffee|meal|beverage|upgrade)\b/,
        "payment_or_discount_promise_rejected",
      ],
      [
        /\b(giveaway|complimentary|on the house|for free)\b/,
        "payment_or_discount_promise_rejected",
      ],
      [
        /\b(give|send|add)\s+(you\s+)?(a\s+)?free\b/,
        "payment_or_discount_promise_rejected",
      ],
      [
        /\b(allergy|allergen).*(guaranteed safe|100% safe|totally safe)\b/,
        "allergy_guarantee_rejected",
      ],
      [
        /\b(guaranteed safe|100% safe|totally safe).*(allergy|allergen)\b/,
        "allergy_guarantee_rejected",
      ],
      [
        /\b(staff|manager|barista|waiter)\s+(confirmed|approved)\b/,
        "staff_confirmation_rejected",
      ],
      [
        /\b(api[_-]?key|secret key|groq_api_key|bearer\s+[a-z0-9._-]+)\b/,
        "secret_exposure_rejected",
      ],
      [
        /\bbypass\s+(the\s+)?(system|backend|validation|guardrails)\b/,
        "unsafe_instruction_rejected",
      ],
      [/(تم|اتأكد)\s+(الدفع|الطلب)/, "payment_or_discount_promise_rejected"],
      [
        /(خصم|استرداد|ريفاند)\s+(اتطبق|اتأكد|تم)/,
        "payment_or_discount_promise_rejected",
      ],
      [/(آمن|امن|مضمون).*(حساسية|الحساسية)/, "allergy_guarantee_rejected"],
      [
        /(مجاني|هدية|على حسابنا|من غير فلوس)/,
        "payment_or_discount_promise_rejected",
      ],
    ];

    return unsafePatterns.find(([pattern]) => pattern.test(normalized))?.[1];
  }

  private normalizeProposedCart(
    value: unknown,
  ): GroqAiWaiterPlan["proposedCart"] {
    if (!this.isRecord(value)) {
      return null;
    }

    return {
      title: this.stringValue(value.title, "AI waiter proposal"),
      items: this.recordArray(value.items).map((item) => ({
        menuItemId: this.stringValue(item.menuItemId),
        quantity: Math.round(this.numberValue(item.quantity, 1)),
        modifierOptionIds: this.stringArray(item.modifierOptionIds),
        notes: this.optionalString(item.notes),
      })),
    };
  }

  private normalizeMissingRequiredModifier(
    value: unknown,
  ): GroqAiWaiterPlan["missingRequiredModifier"] {
    if (!this.isRecord(value)) {
      return null;
    }

    return {
      menuItemId: this.stringValue(value.menuItemId),
      modifierGroupId: this.stringValue(value.modifierGroupId),
      question: this.stringValue(
        value.question,
        this.defaultAssistantMessage("ar-EG"),
      ),
    };
  }

  private compactCartSummary(value: unknown) {
    if (!this.isRecord(value)) {
      return {
        itemCount: 0,
        totalQuantity: 0,
        hasOpenCart: false,
      };
    }

    const items = Array.isArray(value.items) ? value.items : [];
    const totals = this.isRecord(value.totals) ? value.totals : {};
    const itemCount = this.numberValue(totals.itemCount, items.length, 0);
    const totalQuantity = this.numberValue(
      totals.totalQuantity,
      items.reduce(
        (sum, item) =>
          sum +
          (this.isRecord(item) ? this.numberValue(item.quantity, 0, 0) : 0),
        0,
      ),
      0,
    );

    return {
      itemCount,
      totalQuantity,
      hasOpenCart: itemCount > 0 || totalQuantity > 0,
    };
  }

  private parseLeadingJsonObject(text: string) {
    const start = text.indexOf("{");

    if (start < 0) {
      return undefined;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const char = text[index];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === "{") {
        depth += 1;
      }

      if (char === "}") {
        depth -= 1;

        if (depth === 0) {
          const candidate = text.slice(start, index + 1);

          try {
            const parsed = JSON.parse(candidate);

            return this.isRecord(parsed) ? { value: parsed } : undefined;
          } catch {
            return undefined;
          }
        }
      }
    }

    return undefined;
  }

  private tryParseJson(content: string) {
    const trimmed = this.stripCodeFences(content).trim();

    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return undefined;
    }

    try {
      return JSON.parse(this.extractJson(trimmed));
    } catch {
      return undefined;
    }
  }

  private extractJson(content: string) {
    const trimmed = content.trim();

    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      return trimmed;
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private stripCodeFences(content: string) {
    return content
      .replace(/^```(?:json|text)?/i, "")
      .replace(/```$/i, "")
      .trim();
  }

  private defaultAssistantMessage(language: GroqAiWaiterPlan["language"]) {
    return language === "en"
      ? "I can help with that, and I can connect it back to Balcona when useful."
      : "أقدر أساعدك في ده، ونربطه بتجربة بالكونا لو تحب.";
  }

  private languageValue(
    value: unknown,
    fallback: string,
    message: string,
  ): GroqAiWaiterPlan["language"] {
    const normalized = value === undefined ? fallback : value;

    if (normalized === "en" || normalized === "mixed") {
      return normalized;
    }

    if (typeof normalized === "string" && normalized.startsWith("ar")) {
      return "ar-EG";
    }

    if (
      /^[\x00-\x7F]+$/.test(message) &&
      !this.looksLikeFrancoArabic(message)
    ) {
      return "en";
    }

    if (this.looksLikeFrancoArabic(message)) {
      return "mixed";
    }

    return "ar-EG";
  }

  private looksLikeFrancoArabic(value: string) {
    return /\b(3ayez|عايز|7aga|sokar|mesh|mafeesh|keda|enta|ana|2ahwa)\b/i.test(
      value,
    );
  }

  private hasUnsafeCommerceKeys(value: Record<string, unknown>) {
    const json = JSON.stringify(value).toLowerCase();

    return PRICE_OR_COMMERCE_KEYS.some((key) =>
      json.includes(`"${key.toLowerCase()}"`),
    );
  }

  private metadataSafetyFlags(metadata: Record<string, unknown> | undefined) {
    return Array.isArray(metadata?.safetyFlags)
      ? metadata.safetyFlags.filter(
          (flag): flag is string => typeof flag === "string",
        )
      : ["action_validation_rejected"];
  }

  private isRetryableOutputError(
    error: unknown,
  ): error is AiWaiterProviderError {
    return (
      error instanceof AiWaiterProviderError &&
      (error.code === "invalid_json" || error.code === "invalid_schema")
    );
  }

  private shouldRetry(status: number, attempt: number, maxRetries: number) {
    return attempt < maxRetries && (status === 429 || status >= 500);
  }

  private async delayForRetry(retryAfter: string | null) {
    const seconds = retryAfter ? Number.parseInt(retryAfter, 10) : 0;
    const delayMs =
      Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 250;

    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(delayMs, 1500)),
    );
  }

  private safeRateLimitHeaders(response: Response) {
    return {
      retryAfter: response.headers.get("retry-after"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
    };
  }

  private numberConfig(key: string, fallback: number) {
    const value = this.configService.get<number | string>(key);
    const parsed = typeof value === "number" ? value : Number(value);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private logProviderError(error: AiWaiterProviderError) {
    this.logger.warn({
      provider: "groq",
      errorType: error.code,
      status: error.metadata.status,
      retryAfter: error.metadata.retryAfter,
      requestDuration: error.metadata.latencyMs,
      requestBodyChars: error.metadata.requestBodyChars,
      menuItemsSent: error.metadata.menuItemsSent,
      recentMessagesSent: error.metadata.recentMessagesSent,
      totalMenuItemsAvailable: error.metadata.totalMenuItemsAvailable,
      groundingMode: error.metadata.groundingMode,
      omittedMenuItemCount: error.metadata.omittedMenuItemCount,
      topMatchReasons: error.metadata.topMatchReasons,
      exactMatchFound: error.metadata.exactMatchFound,
      model: this.configService.get<string>("aiWaiter.groq.model"),
    });
  }

  private truncateText(value: string, maxChars: number) {
    return value.length > maxChars ? value.slice(0, maxChars).trim() : value;
  }

  private stringValue(value: unknown, fallback = "") {
    if (typeof value !== "string") {
      return fallback;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : fallback;
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
}
