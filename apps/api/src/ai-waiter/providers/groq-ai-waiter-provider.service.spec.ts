import { ConfigService } from "@nestjs/config";
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
      modifierGroups: [],
    },
  ],
};

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "aiWaiter.groq.apiKey": "test-groq-key",
    "aiWaiter.groq.model": "test-model",
    "aiWaiter.groq.timeoutMs": 1000,
    "aiWaiter.groq.maxRetries": 1,
    "aiWaiter.groq.maxContextItems": 80,
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
    expect(String(init.body)).not.toContain("test-groq-key");
    expect(result.metadata).toMatchObject({
      provider: "groq",
      model: "test-model",
      promptTokens: 100,
      totalTokens: 150,
    });
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

  it("retries invalid schema once before accepting a corrected response", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            validPlanResponse(
              JSON.stringify({ assistantMessage: "Missing required schema" }),
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
