import { ConfigService } from "@nestjs/config";
import { AiWaiterMessageKind } from "@prisma/client";
import { AiWaiterContext } from "../ai-waiter.types";
import { AiWaiterProviderSafetyService } from "./ai-waiter-provider-safety.service";
import { AiWaiterProviderError } from "./groq-ai-waiter.types";
import { GroqAiWaiterProviderService } from "./groq-ai-waiter-provider.service";

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
  cartSummary: { items: [] },
  recentMessages: [
    {
      role: "assistant",
      kind: "status",
      content: "Welcome",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ],
  menuItems: [
    {
      id: "item-lemon-mint",
      slug: "lemon-mint",
      name: "Lemon Mint",
      description: "Cold lemon and mint drink",
      currency: "EGP",
      isFeatured: true,
      modifierGroups: [
        {
          id: "sweetness-group",
          name: "Sweetness",
          slug: "sweetness",
          selectionType: "single",
          isRequired: false,
          minSelections: 0,
          maxSelections: 1,
          options: [
            {
              id: "sweetness-low",
              groupId: "sweetness-group",
              name: "Low sugar",
              slug: "low-sugar",
            },
          ],
        },
      ],
    },
  ],
};

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "aiWaiter.groq.apiKey": "test-groq-key",
    "aiWaiter.groq.model": "test-model",
    "aiWaiter.groq.timeoutMs": 1000,
    "aiWaiter.groq.maxRetries": 1,
    "aiWaiter.groq.maxContextItems": 8,
    "aiWaiter.groq.dryRun": false,
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function validPlanResponse(content?: string) {
  return {
    choices: [
      {
        message: {
          content:
            content ??
            JSON.stringify({
              customerMessage: "عايز حاجة ساقعة",
              language: "ar-EG",
              intent: "recommendation",
              confidence: 0.86,
              assistantMessage: "أنصحك بليمون نعناع من المنيو المتاح.",
              suggestedActions: ["show_menu", "choose_item"],
              menuItemCandidates: [{ menuItemId: "item-lemon-mint" }],
              proposedCart: null,
              missingRequiredModifier: null,
              safety: {
                requiresHumanFallback: false,
              },
            }),
        },
      },
    ],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

function contextWithMenuItemCount(count: number): AiWaiterContext {
  return {
    ...context,
    menuItems: Array.from({ length: count }, (_, index) => ({
      id: `item-${index + 1}`,
      slug: `item-${index + 1}`,
      name: `Menu Item ${index + 1}`,
      description: `Menu item ${index + 1} description`,
      currency: "EGP",
      isFeatured: index < 2,
      modifierGroups: context.menuItems[0]?.modifierGroups ?? [],
    })),
  };
}

describe("GroqAiWaiterProviderService", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends Groq request with auth, compact menu context, and JSON response format", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(validPlanResponse()), { status: 200 }),
    );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "عايز حاجة ساقعة",
      language: "ar-EG",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(init.headers.Authorization).toBe("Bearer test-groq-key");
    expect(body.model).toBe("test-model");
    expect(body.temperature).toBe(0.2);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(contextMessage.menuItems[0]).toMatchObject({
      id: "item-lemon-mint",
      slug: "lemon-mint",
      name: "Lemon Mint",
    });
    expect(Object.keys(contextMessage.menuItems[0]).sort()).toEqual([
      "description",
      "id",
      "isFeatured",
      "name",
      "slug",
    ]);
    expect(String(init.body)).not.toContain("modifierGroups");
    expect(String(init.body)).not.toContain("options");
    expect(String(init.body)).not.toContain("test-groq-key");
    expect(result.metadata).toMatchObject({
      provider: "groq",
      model: "test-model",
      promptTokens: 100,
      totalTokens: 150,
      requestBodySizeBytes: Buffer.byteLength(String(init.body), "utf8"),
    });
  });

  it("keeps request context compact with GROQ_MAX_CONTEXT_ITEMS=8", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(validPlanResponse()), { status: 200 }),
    );
    const provider = new GroqAiWaiterProviderService(
      config({ "aiWaiter.groq.maxContextItems": 8 }),
      new AiWaiterProviderSafetyService(),
    );

    await provider.respond(contextWithMenuItemCount(20), {
      message: "recommend",
      language: "en",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(contextMessage.menuItems).toHaveLength(8);
    expect(contextMessage.omittedMenuItemCount).toBe(12);
    expect(String(init.body)).not.toContain("modifierGroups");
    expect(String(init.body)).not.toContain("options");
    expect(Buffer.byteLength(String(init.body), "utf8")).toBeLessThan(12_000);
  });

  it("retries once on 429 and then parses a valid response", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse()), { status: 200 }),
      );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "recommend",
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.content).toContain("ليمون");
  });

  it("retries invalid JSON once with a JSON-only instruction and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse("not json")), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse()), { status: 200 }),
      );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "hello",
      language: "en",
    });
    const [, retryInit] = fetchMock.mock.calls[1];
    const retryBody = JSON.parse(String(retryInit.body));
    const retryInput = JSON.parse(retryBody.messages[2].content);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryInput.retryInstruction).toContain("valid JSON only");
    expect(result.metadata).toMatchObject({ jsonRetryUsed: true });
  });

  it("normalizes missing arrays and safety before safety validation", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          validPlanResponse(
            JSON.stringify({
              customerMessage: "عايز حاجة ساقعة",
              language: "ar-EG",
              intent: "recommendation",
              confidence: 0.72,
              assistantMessage: "تمام، أرشحلك حاجة ساقعة من المنيو.",
            }),
          ),
        ),
        { status: 200 },
      ),
    );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "عايز حاجة ساقعة",
      language: "ar-EG",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe(AiWaiterMessageKind.menu_suggestion);
    expect(result.suggestedActions).toContain("show_menu");
    expect(result.metadata).toMatchObject({
      confidence: 0.72,
      jsonRetryUsed: false,
      safety: {
        requiresHumanFallback: false,
        allergyOrHealthConcern: false,
        refusedUnsafeRequest: false,
      },
    });
  });

  it("normalizes assistantMessage and intent only into a complete safe plan", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          validPlanResponse(
            JSON.stringify({
              assistantMessage: "I can help with the available menu.",
              intent: "clarification",
            }),
          ),
        ),
        { status: 200 },
      ),
    );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "hello",
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toBe("I can help with the available menu.");
    expect(result.metadata).toMatchObject({
      intent: "clarification",
      confidence: 0.5,
      safety: {
        requiresHumanFallback: false,
      },
    });
  });

  it("keeps price fields unsafe after normalization", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          validPlanResponse(
            JSON.stringify({
              assistantMessage: "This costs 100.",
              intent: "recommendation",
              priceMinor: 100,
            }),
          ),
        ),
        { status: 200 },
      ),
    );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "price?",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("price_field_rejected");
  });

  it("keeps fake menu item IDs unsafe after normalization", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          validPlanResponse(
            JSON.stringify({
              assistantMessage: "I can draft that for you.",
              intent: "cart_proposal",
              proposedCart: {
                title: "Draft",
                items: [
                  {
                    menuItemId: "fake-item",
                    quantity: 1,
                    modifierOptionIds: [],
                  },
                ],
              },
            }),
          ),
        ),
        { status: 200 },
      ),
    );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "add fake item",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unknown_menu_item_rejected");
  });

  it("retries invalid schema once before accepting a corrected response", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            validPlanResponse(
              JSON.stringify(["not", "a", "plan"]),
            ),
          ),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse()), { status: 200 }),
      );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    const result = await provider.respond(context, {
      message: "hello",
      language: "en",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.metadata).toMatchObject({ jsonRetryUsed: true });
  });

  it("throws invalid_json after the JSON retry also fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse("not json")), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(validPlanResponse("still not json")), {
          status: 200,
        }),
      );
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    await expect(
      provider.respond(context, { message: "hello", language: "en" }),
    ).rejects.toMatchObject({ code: "invalid_json" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws http_error for invalid key responses", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const provider = new GroqAiWaiterProviderService(
      config(),
      new AiWaiterProviderSafetyService(),
    );

    await expect(
      provider.respond(context, { message: "hello", language: "en" }),
    ).rejects.toMatchObject({
      code: "http_error",
      metadata: expect.objectContaining({ status: 401 }),
    });
  });

  it("throws timeout for aborted requests", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );
    const provider = new GroqAiWaiterProviderService(
      config({ "aiWaiter.groq.maxRetries": 0 }),
      new AiWaiterProviderSafetyService(),
    );

    await expect(
      provider.respond(context, { message: "hello", language: "en" }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("throws missing_config when GROQ_API_KEY is not configured", async () => {
    const provider = new GroqAiWaiterProviderService(
      config({ "aiWaiter.groq.apiKey": undefined }),
      new AiWaiterProviderSafetyService(),
    );

    await expect(
      provider.respond(context, { message: "hello", language: "en" }),
    ).rejects.toBeInstanceOf(AiWaiterProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
