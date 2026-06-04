import { ConfigService } from "@nestjs/config";
import {
  AiWaiterMessageKind,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
} from "@prisma/client";
import { AiWaiterContext } from "../ai-waiter.types";
import { AiWaiterMenuGroundingService } from "../grounding/ai-waiter-menu-grounding.service";
import { AiWaiterProviderSafetyService } from "./ai-waiter-provider-safety.service";
import { AiWaiterProviderError } from "./groq-ai-waiter.types";
import { GroqAiWaiterProviderService } from "./groq-ai-waiter-provider.service";

const longMessage = `${"study ".repeat(80)}keep this trimmed`;

const context: AiWaiterContext = {
  tableSession: {
    id: "session-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableId: "table-1",
    status: "active",
    partySize: 3,
  },
  branch: {
    id: "branch-1",
    companyId: "company-1",
    name: "Balcona Main",
    slug: "main",
  },
  effectiveExperience: {},
  cartSummary: {
    items: [{ quantity: 2 }, { quantity: 1 }],
    totals: {
      itemCount: 2,
      totalQuantity: 3,
    },
  },
  recentMessages: [
    {
      role: "customer",
      kind: "text",
      content: "first message should be omitted",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      role: "assistant",
      kind: "text",
      content: longMessage,
      createdAt: new Date("2026-01-01T00:01:00.000Z"),
    },
    {
      role: "customer",
      kind: "text",
      content: "عايز حاجة تساعدني أذاكر",
      createdAt: new Date("2026-01-01T00:02:00.000Z"),
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
      category: {
        id: "category-cold",
        name: "Cold Drinks",
        slug: "cold-drinks",
      },
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
    {
      id: "item-iced-spanish-latte",
      slug: "iced-spanish-latte",
      name: "Iced Spanish Latte",
      description: "Cold coffee latte with a sweet Spanish profile",
      currency: "EGP",
      isFeatured: true,
      category: {
        id: "category-coffee",
        name: "Coffee",
        slug: "coffee",
      },
      modifierGroups: [],
    },
    {
      id: "item-classic-waffle",
      slug: "classic-waffle",
      name: "Classic Waffle",
      description: "Warm dessert waffle with chocolate",
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-dessert",
        name: "Desserts",
        slug: "desserts",
      },
      modifierGroups: [],
    },
    {
      id: "item-matcha-latte",
      slug: "matcha-latte",
      name: "Matcha Latte",
      description: "Premium matcha latte for focus",
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-coffee",
        name: "Coffee",
        slug: "coffee",
      },
      modifierGroups: [],
    },
    {
      id: "item-pancake-stack",
      slug: "pancake-stack",
      name: "Pancake Stack",
      description: "Sweet sharing pancakes",
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-dessert",
        name: "Desserts",
        slug: "desserts",
      },
      modifierGroups: [],
    },
    {
      id: "item-mango-smoothie",
      slug: "mango-smoothie",
      name: "Mango Smoothie",
      description: "Cold mango smoothie",
      currency: "EGP",
      isFeatured: true,
      category: {
        id: "category-cold",
        name: "Cold Drinks",
        slug: "cold-drinks",
      },
      modifierGroups: [],
    },
    {
      id: "item-chocolate-milkshake",
      slug: "chocolate-milkshake",
      name: "Chocolate Milkshake",
      description: "Cold dessert milkshake",
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-cold",
        name: "Cold Drinks",
        slug: "cold-drinks",
      },
      modifierGroups: [],
    },
    {
      id: "item-egyptian-tea",
      slug: "egyptian-tea",
      name: "Egyptian Tea",
      description: "Simple hot tea",
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-tea",
        name: "Tea",
        slug: "tea",
      },
      modifierGroups: [],
    },
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `item-extra-${index + 1}`,
      slug: `extra-${index + 1}`,
      name: `Extra Item ${index + 1}`,
      description: `Extra item ${index + 1} description`,
      currency: "EGP",
      isFeatured: false,
      category: {
        id: "category-extra",
        name: "Extra",
        slug: "extra",
      },
      modifierGroups: [],
    })),
  ],
};

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "aiWaiter.groq.apiKey": "test-groq-key",
    "aiWaiter.groq.model": "test-model",
    "aiWaiter.groq.timeoutMs": 1000,
    "aiWaiter.groq.maxRetries": 1,
    "aiWaiter.groq.maxContextItems": undefined,
    "aiWaiter.groq.dryRun": false,
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function groqResponse(content: string) {
  return {
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    },
  };
}

function actionResponse(visibleText: string, action: Record<string, unknown>) {
  return `${visibleText}\n\nBALCONA_ACTION_JSON:\n${JSON.stringify(action)}`;
}

function createProvider(overrides: Record<string, unknown> = {}) {
  return new GroqAiWaiterProviderService(
    config(overrides),
    new AiWaiterProviderSafetyService(),
    new AiWaiterMenuGroundingService(),
  );
}

function requestBody(fetchMock: jest.Mock) {
  const [, init] = fetchMock.mock.calls[0];

  return {
    init,
    body: JSON.parse(String(init.body)),
    bodyText: String(init.body),
  };
}

describe("GroqAiWaiterProviderService", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("accepts plain Arabic text as open chat without falling back to stub", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(groqResponse("فاهمك. تحب حاجة رايقة ولا حاجة تفوقك؟")),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "أنا مخنوق",
      language: "ar-EG",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toContain("فاهمك");
    expect(result.metadata).toMatchObject({
      provider: "groq",
      mode: "open_chat",
      normalizationUsed: true,
      fallbackUsed: false,
    });
  });

  it("accepts plain English text as open chat", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse("A calm study session pairs well with something light."),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "I want to study",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toContain("study session");
    expect(result.metadata).toMatchObject({
      provider: "groq",
      mode: "open_chat",
    });
  });

  it.each([
    ["general safe question", "What is a good way to focus for 30 minutes?"],
    ["caption request", "أكيد. جرب: فوق الدوشة، القعدة هنا بتاخد نفس."],
    ["small talk", "أنا معاك. نحلي القعدة بحاجة بسيطة؟"],
  ])("accepts %s as open chat", async (_label, responseText) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse(responseText)), { status: 200 }),
    );

    const result = await createProvider().respond(context, {
      message: "chat with me",
      language: "mixed",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toBe(responseText);
    expect(result.metadata?.mode).toBe("open_chat");
  });

  it("accepts partial JSON with assistantMessage", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            JSON.stringify({
              intent: "recommendation",
              assistantMessage: "تمام، Lemon Mint اختيار منعش.",
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "عايز حاجة ساقعة",
      language: "ar-EG",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.menu_suggestion);
    expect(result.content).toContain("Lemon Mint");
    expect(result.metadata).toMatchObject({
      mode: "menu_recommendation",
      normalizationUsed: true,
    });
  });

  it.each([
    ["message", { message: "Message alias works." }],
    ["response", { response: "Response alias works." }],
    ["content", { content: "Content alias works." }],
  ])("accepts partial JSON with %s alias", async (_field, payload) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse(JSON.stringify(payload))), {
        status: 200,
      }),
    );

    const result = await createProvider().respond(context, {
      message: "hello",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toContain("works");
    expect(result.metadata?.mode).toBe("open_chat");
  });

  it("strips hidden action block and maps valid create_cart_proposal", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("تمام، أقدر أجهز Lemon Mint كاقتراح في الكارت.", {
              action: "create_cart_proposal",
              items: [
                {
                  menuItemId: "item-lemon-mint",
                  quantity: 1,
                  modifierOptionIds: [],
                },
              ],
              reason: "customer_requested_item",
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "هات Lemon Mint",
      language: "mixed",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.cart_proposal);
    expect(result.content).not.toContain("BALCONA_ACTION_JSON");
    expect(result.proposal?.items).toEqual([
      {
        menuItemId: "item-lemon-mint",
        quantity: 1,
        modifierOptionIds: [],
        customerNote: undefined,
      },
    ]);
    expect(result.metadata).toMatchObject({
      mode: "commerce_action",
      provider: "groq",
    });
  });

  it("rejects fake item action but keeps safe visible text", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("أقدر أساعدك نختار حاجة من المنيو المتاح.", {
              action: "create_cart_proposal",
              items: [{ menuItemId: "fake-item", quantity: 1 }],
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "add fake",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toContain("المنيو المتاح");
    expect(result.proposal).toBeUndefined();
    expect(result.metadata).toMatchObject({
      actionRejected: true,
      fallbackUsed: false,
    });
    expect(result.metadata?.safetyFlags).toContain(
      "ungrounded_menu_item_rejected",
    );
  });

  it("rejects existing menu item actions that were not grounded for the request", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("أقدر أساعدك بحاجة من الاختيارات المناسبة.", {
              action: "create_cart_proposal",
              items: [{ menuItemId: "item-mango-smoothie", quantity: 1 }],
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider({
      "aiWaiter.groq.maxContextItems": 1,
    }).respond(context, {
      message: "هات Lemon Mint",
      language: "mixed",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.proposal).toBeUndefined();
    expect(result.metadata).toMatchObject({
      actionRejected: true,
      fallbackUsed: false,
      menuItemsSent: 1,
    });
    expect(result.metadata?.safetyFlags).toContain(
      "ungrounded_menu_item_rejected",
    );
  });

  it("rejects invalid modifier action but keeps safe visible text", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("أقدر أجهزلك اقتراح بسيط.", {
              action: "create_cart_proposal",
              items: [
                {
                  menuItemId: "item-lemon-mint",
                  quantity: 1,
                  modifierOptionIds: ["fake-option"],
                },
              ],
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "add with bad modifier",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.actionRejected).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unknown_modifier_rejected");
  });

  it("rejects oversized quantity action but keeps safe visible text", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("خلينا نبدأ باقتراح معقول ونعدله سوا.", {
              action: "create_cart_proposal",
              items: [{ menuItemId: "item-lemon-mint", quantity: 99 }],
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "add 99",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.actionRejected).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("quantity_limit_enforced");
  });

  it("rejects final_order_submit hidden action", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("أقدر أساعدك تراجع الاختيارات الأول.", {
              action: "final_order_submit",
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "submit",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.actionRejected).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("unsafe_action_rejected");
  });

  it("rejects price fields from partial JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            JSON.stringify({
              assistantMessage: "This is a nice choice.",
              intent: "recommendation",
              priceMinor: 100,
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "price?",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain("price_field_rejected");
  });

  it("rejects discount and payment promises in visible text", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(groqResponse("Payment confirmed and discount applied.")),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "did I pay?",
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.text);
    expect(result.content).toContain("بأمان");
    expect(result.metadata).toMatchObject({
      mode: "safety_fallback",
      fallbackUsed: true,
    });
    expect(result.metadata?.safetyFlags).toContain(
      "payment_or_discount_promise_rejected",
    );
  });

  it("rejects allergy guarantees in visible text", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(groqResponse("This drink is 100% safe for allergy.")),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "I have milk allergy",
      language: "en",
    });

    expect(result.metadata?.fallbackUsed).toBe(true);
    expect(result.metadata?.safetyFlags).toContain(
      "allergy_guarantee_rejected",
    );
  });

  it("maps call_waiter action safely", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("أكيد، أقدر أطلبلك مساعدة من الويتر.", {
              action: "call_waiter",
              reason: "customer_requested_human",
            }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: "ناديلي حد",
      language: "ar-EG",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.escalation);
    expect(result.toolCalls[0]).toMatchObject({
      toolName: AiWaiterToolName.fallback_to_human,
      status: AiWaiterToolCallStatus.succeeded,
    });
  });

  it.each([
    ["request_bill", AiWaiterToolName.request_bill],
    ["order_status", AiWaiterToolName.read_order_status],
  ])("maps %s action safely", async (action, toolName) => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(
          groqResponse(
            actionResponse("تمام، أقدر أوجهك للخطوة المناسبة.", { action }),
          ),
        ),
        { status: 200 },
      ),
    );

    const result = await createProvider().respond(context, {
      message: action,
      language: "en",
    });

    expect(result.kind).toBe(AiWaiterMessageKind.action_result);
    expect(result.toolCalls[0]).toMatchObject({
      toolName,
      status: AiWaiterToolCallStatus.skipped,
    });
  });

  it("keeps request body compact and excludes modifier details by default", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse("Safe open answer.")), {
        status: 200,
      }),
    );

    const result = await createProvider().respond(context, {
      message: "recommend",
      language: "en",
    });
    const { body, bodyText } = requestBody(fetchMock);
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(body.response_format).toBeUndefined();
    expect(contextMessage.menuItems).toBeUndefined();
    expect(contextMessage.relevantMenuItems).toHaveLength(12);
    expect(contextMessage.grounding).toMatchObject({
      menuItemsSent: 12,
      totalMenuItemsAvailable: 14,
      omittedMenuItemCount: 2,
    });
    expect(contextMessage.relevantMenuItems[0]).toMatchObject({
      id: "item-lemon-mint",
      slug: "lemon-mint",
      name: "Lemon Mint",
      isFeatured: true,
    });
    expect(Object.keys(contextMessage.relevantMenuItems[0]).sort()).toEqual([
      "category",
      "description",
      "id",
      "isFeatured",
      "name",
      "slug",
    ]);
    expect(contextMessage.cart).toEqual({
      itemCount: 2,
      totalQuantity: 3,
      hasOpenCart: true,
    });
    expect(contextMessage.recentMessages).toHaveLength(2);
    expect(contextMessage.recentMessages[0].content.length).toBeLessThanOrEqual(
      200,
    );
    expect(bodyText).not.toContain("modifierGroups");
    expect(bodyText).not.toContain("options");
    expect(bodyText).not.toContain("sweetness-low");
    expect(bodyText).not.toContain("test-groq-key");
    expect(result.metadata).toMatchObject({
      requestBodyChars: bodyText.length,
      menuItemsSent: 12,
      recentMessagesSent: 2,
      totalMenuItemsAvailable: 14,
      omittedMenuItemCount: 2,
    });
  });

  it("honors explicit GROQ_MAX_CONTEXT_ITEMS", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse("Safe open answer.")), {
        status: 200,
      }),
    );

    await createProvider({ "aiWaiter.groq.maxContextItems": 2 }).respond(
      context,
      {
        message: "recommend",
        language: "en",
      },
    );
    const { body } = requestBody(fetchMock);
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(contextMessage.relevantMenuItems).toHaveLength(2);
    expect(contextMessage.grounding.omittedMenuItemCount).toBe(12);
  });

  it("grounds exact menu requests from the full menu instead of the first items only", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify(groqResponse("Mango Smoothie موجود ومنعش.")),
        {
          status: 200,
        },
      ),
    );

    await createProvider({ "aiWaiter.groq.maxContextItems": 4 }).respond(
      context,
      {
        message: "عايز مانجو",
        language: "ar-EG",
      },
    );
    const { body } = requestBody(fetchMock);
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(contextMessage.relevantMenuItems).toHaveLength(4);
    expect(contextMessage.relevantMenuItems[0]).toMatchObject({
      id: "item-mango-smoothie",
      name: "Mango Smoothie",
    });
    expect(contextMessage.grounding).toMatchObject({
      mode: "ranked",
      exactMatchFound: false,
    });
    expect(contextMessage.grounding.topMatchReasons).toEqual(
      expect.arrayContaining(["token_overlap", "cold_intent"]),
    );
  });

  it("keeps the Groq request body compact with GROQ_MAX_CONTEXT_ITEMS=8", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse("Safe open answer.")), {
        status: 200,
      }),
    );

    await createProvider({ "aiWaiter.groq.maxContextItems": 8 }).respond(
      context,
      {
        message: "عايز حاجة ساقعة",
        language: "ar-EG",
      },
    );
    const { body, bodyText } = requestBody(fetchMock);
    const contextMessage = JSON.parse(body.messages[1].content);

    expect(contextMessage.relevantMenuItems).toHaveLength(8);
    expect(contextMessage.grounding.menuItemsSent).toBe(8);
    expect(bodyText.length).toBeLessThan(12000);
    expect(bodyText).not.toContain("modifierGroups");
    expect(bodyText).not.toContain("options");
  });

  it("retries malformed action JSON once and then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            groqResponse("BALCONA_ACTION_JSON:\n{ not valid json"),
          ),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(groqResponse("Safe answer after retry.")), {
          status: 200,
        }),
      );

    const result = await createProvider().respond(context, {
      message: "hello",
      language: "en",
    });
    const [, retryInit] = fetchMock.mock.calls[1];
    const retryBody = JSON.parse(String(retryInit.body));
    const retryInput = JSON.parse(retryBody.messages[2].content);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retryInput.retryInstruction).toContain("Plain text is allowed");
    expect(result.content).toBe("Safe answer after retry.");
    expect(result.metadata?.retryUsed).toBe(true);
  });

  it("throws timeout for aborted requests so registry can fallback safely", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("aborted"), { name: "AbortError" }),
    );

    await expect(
      createProvider({ "aiWaiter.groq.maxRetries": 0 }).respond(context, {
        message: "hello",
        language: "en",
      }),
    ).rejects.toMatchObject({ code: "timeout" });
  });

  it("throws invalid_schema for empty response so registry can fallback safely", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(groqResponse("")), { status: 200 }),
    );

    await expect(
      createProvider().respond(context, {
        message: "hello",
        language: "en",
      }),
    ).rejects.toMatchObject({ code: "invalid_schema" });
  });

  it("throws missing_config when GROQ_API_KEY is not configured", async () => {
    await expect(
      createProvider({ "aiWaiter.groq.apiKey": undefined }).respond(context, {
        message: "hello",
        language: "en",
      }),
    ).rejects.toBeInstanceOf(AiWaiterProviderError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
