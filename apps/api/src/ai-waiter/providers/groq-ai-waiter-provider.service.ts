import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiWaiterContext,
  AiWaiterProvider,
  AiWaiterProviderResult,
} from "../ai-waiter.types";
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

type GroqFetchMetadata = {
  status?: number;
  retryAfter?: string | null;
  latencyMs: number;
  attempt: number;
  requestBodySizeBytes?: number;
};

type GroqPlanResponse = {
  content: string;
  usage?: GroqChatCompletionResponse["usage"];
  requestBodySizeBytes: number;
  rateLimit: {
    retryAfter: string | null;
    remaining: string | null;
    reset: string | null;
  };
};

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 1;
const DEFAULT_MAX_CONTEXT_ITEMS = 8;
const JSON_RETRY_INSTRUCTION =
  "The previous response was invalid. Return valid JSON only, matching the requested schema. No markdown. No commentary.";

@Injectable()
export class GroqAiWaiterProviderService implements AiWaiterProvider {
  readonly name = "groq";
  private readonly logger = new Logger(GroqAiWaiterProviderService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly safetyService: AiWaiterProviderSafetyService,
  ) {}

  async respond(
    context: AiWaiterContext,
    input: { message: string; language: string },
  ): Promise<AiWaiterProviderResult> {
    const apiKey = this.configService.get<string>("aiWaiter.groq.apiKey");

    if (!apiKey) {
      throw new AiWaiterProviderError("GROQ_API_KEY is not configured", "missing_config");
    }

    if (this.configService.get<boolean>("aiWaiter.groq.dryRun")) {
      throw new AiWaiterProviderError("GROQ_DRY_RUN is enabled", "missing_config", {
        dryRun: true,
      });
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
        jsonRetryUsed: false,
        customerInput: input,
      });
    } catch (error) {
      if (!this.isInvalidStructuredOutput(error)) {
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
        jsonRetryUsed: true,
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
            requestBodySizeBytes: requestBody.sizeBytes,
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

        if (!content) {
          throw new AiWaiterProviderError("Groq returned empty content", "invalid_schema", {
            latencyMs,
            attempt,
            requestBodySizeBytes: requestBody.sizeBytes,
          });
        }

        return {
          content,
          usage: json.usage,
          requestBodySizeBytes: requestBody.sizeBytes,
          rateLimit: this.safeRateLimitHeaders(response),
        };
      } catch (error) {
        if (error instanceof AiWaiterProviderError) {
          lastError = error;
        } else if (
          error instanceof Error &&
          error.name === "AbortError"
        ) {
          lastError = new AiWaiterProviderError("Groq request timed out", "timeout", {
            attempt,
            requestBodySizeBytes: requestBody.sizeBytes,
          });
        } else {
          lastError = new AiWaiterProviderError(
            error instanceof Error ? error.message : "Groq network error",
            "network_error",
            { attempt, requestBodySizeBytes: requestBody.sizeBytes },
          );
        }

        this.logProviderError(lastError);

        if (attempt >= maxRetries || !["timeout", "network_error"].includes(lastError.code)) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new AiWaiterProviderError("Groq request failed", "network_error");
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
    const body = JSON.stringify({
      model: input.model,
      temperature: 0.2,
      max_completion_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: this.systemPrompt() },
        { role: "user", content: this.contextPrompt(input.context) },
        {
          role: "user",
          content: JSON.stringify({
            customerMessage: input.input.message,
            requestedLanguage: input.input.language,
            retryInstruction:
              input.outputRetryAttempt > 0
                ? JSON_RETRY_INSTRUCTION
                : undefined,
          }),
        },
      ],
    });

    return {
      body,
      sizeBytes: Buffer.byteLength(body, "utf8"),
    };
  }

  private parsePlan(content: string): unknown {
    try {
      return JSON.parse(this.extractJson(content));
    } catch (error) {
      throw new AiWaiterProviderError(
        error instanceof Error ? error.message : "Groq returned invalid JSON",
        "invalid_json",
      );
    }
  }

  private mapGroqResponse(
    response: GroqPlanResponse,
    context: AiWaiterContext,
    input: {
      model: string;
      startedAt: number;
      jsonRetryUsed: boolean;
      customerInput: { message: string; language: string };
    },
  ) {
    let plan: GroqAiWaiterPlan;

    try {
      const rawPlan = this.parsePlan(response.content);
      plan = this.normalizeGroqPlan(rawPlan, input.customerInput);
    } catch (error) {
      if (error instanceof AiWaiterProviderError) {
        throw new AiWaiterProviderError(error.message, error.code, {
          ...error.metadata,
          requestBodySizeBytes: response.requestBodySizeBytes,
        });
      }

      throw error;
    }

    const latencyMs = Date.now() - input.startedAt;

    return this.safetyService.validateAndMapPlan(plan, context, {
      provider: "groq",
      model: input.model,
      fallbackUsed: false,
      latencyMs,
      jsonRetryUsed: input.jsonRetryUsed,
      requestBodySizeBytes: response.requestBodySizeBytes,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      totalTokens: response.usage?.total_tokens,
      rateLimit: response.rateLimit,
    });
  }

  private normalizeGroqPlan(
    rawPlan: unknown,
    input: { message: string; language: string },
  ): GroqAiWaiterPlan {
    if (!this.isRecord(rawPlan)) {
      throw new AiWaiterProviderError(
        "Groq returned JSON that did not match the AI waiter schema",
        "invalid_schema",
      );
    }

    const safety = this.isRecord(rawPlan.safety) ? rawPlan.safety : {};
    const language = this.languageValue(rawPlan.language, input.language);
    const debug = this.isRecord(rawPlan.debug) ? rawPlan.debug : {};

    return {
      customerMessage: this.stringValue(rawPlan.customerMessage, input.message),
      language,
      intent: this.intentValue(rawPlan.intent),
      confidence: this.numberValue(rawPlan.confidence, 0.5, 0, 1),
      assistantMessage: this.stringValue(
        rawPlan.assistantMessage,
        this.defaultAssistantMessage(language),
      ),
      suggestedActions: this.stringArray(rawPlan.suggestedActions),
      menuItemCandidates: this.recordArray(rawPlan.menuItemCandidates).map(
        (item) => ({
          menuItemId: this.optionalString(item.menuItemId),
          slug: this.optionalString(item.slug),
          name: this.optionalString(item.name),
          reason: this.optionalString(item.reason),
        }),
      ),
      proposedCart: this.normalizeProposedCart(rawPlan.proposedCart),
      missingRequiredModifier: this.normalizeMissingRequiredModifier(
        rawPlan.missingRequiredModifier,
      ),
      safety: {
        requiresHumanFallback: safety.requiresHumanFallback === true,
        reason: this.optionalString(safety.reason),
        allergyOrHealthConcern: safety.allergyOrHealthConcern === true,
        refusedUnsafeRequest: safety.refusedUnsafeRequest === true,
      },
      debug: {
        ...debug,
        normalizedByProvider: true,
        rawOutputForSafety: rawPlan,
      },
    };
  }

  private systemPrompt() {
    return [
      "You are Balcona Bar's smart AI waiter.",
      "You speak warm concise Egyptian Arabic by default.",
      "You also understand English and Franco-Arabic.",
      "You only help with cafe menu, recommendations, draft cart proposals, waiter calls, bill requests, and order status.",
      "You must never invent menu items.",
      "You must never invent or change prices.",
      "You must never confirm final orders by yourself.",
      "You can create a draft cart proposal only.",
      "The customer must review and apply the proposal.",
      "The backend validates all menu IDs, availability, modifiers, and prices.",
      "For allergies or health, do not guarantee safety; offer human waiter fallback.",
      "For discounts, payments, or refunds, do not promise anything; offer staff help.",
      "If unsure, ask a short clarification question.",
      "Return JSON only with this shape: { customerMessage, language, intent, confidence, assistantMessage, suggestedActions, menuItemCandidates, proposedCart, missingRequiredModifier, safety, debug }.",
      "Example JSON:",
      "{",
      '  "customerMessage": "...",',
      '  "language": "ar-EG",',
      '  "intent": "recommendation",',
      '  "confidence": 0.8,',
      '  "assistantMessage": "تمام...",',
      '  "suggestedActions": ["show_menu"],',
      '  "menuItemCandidates": [],',
      '  "proposedCart": null,',
      '  "missingRequiredModifier": null,',
      '  "safety": {',
      '    "requiresHumanFallback": false,',
      '    "allergyOrHealthConcern": false,',
      '    "refusedUnsafeRequest": false',
      "  },",
      '  "debug": {}',
      "}",
      "Do not include prices, payment actions, final order submission actions, markdown, or chain-of-thought.",
    ].join("\n");
  }

  private contextPrompt(context: AiWaiterContext) {
    const maxItems = this.numberConfig(
      "aiWaiter.groq.maxContextItems",
      DEFAULT_MAX_CONTEXT_ITEMS,
    );
    const menuItems = context.menuItems.slice(0, maxItems).map((item) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      isFeatured: item.isFeatured,
    }));

    return JSON.stringify({
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
      cartSummary: context.cartSummary,
      recentMessages: context.recentMessages.map((message) => ({
        role: message.role,
        kind: message.kind,
        content: message.content,
      })),
      menuPolicy: {
        onlyUseMenuItemIdsFromThisList: true,
        pricesAreBackendOnly: true,
        finalOrderSubmitIsForbidden: true,
      },
      menuItems,
      omittedMenuItemCount: Math.max(0, context.menuItems.length - menuItems.length),
    });
  }

  private extractJson(content: string) {
    const trimmed = content.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed;
    }

    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");

    if (start >= 0 && end > start) {
      return trimmed.slice(start, end + 1);
    }

    return trimmed;
  }

  private isInvalidStructuredOutput(
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
    const delayMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 250;

    await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 1500)));
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
      requestBodySizeBytes: error.metadata.requestBodySizeBytes,
      model: this.configService.get<string>("aiWaiter.groq.model"),
    });
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
        quantity: this.numberValue(item.quantity, 1),
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

  private defaultAssistantMessage(language: GroqAiWaiterPlan["language"]) {
    return language === "en"
      ? "I can help with the available menu or ask a human waiter for you."
      : "أقدر أساعدك من المنيو المتاح أو أنادي ويتر.";
  }

  private intentValue(value: unknown): GroqAiWaiterPlan["intent"] {
    const allowed: GroqAiWaiterPlan["intent"][] = [
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
      : "clarification";
  }

  private languageValue(
    value: unknown,
    fallback: string,
  ): GroqAiWaiterPlan["language"] {
    const normalized = value === undefined ? fallback : value;

    if (normalized === "en" || normalized === "mixed") {
      return normalized;
    }

    return "ar-EG";
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
