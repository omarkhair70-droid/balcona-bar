import { ConfigService } from "@nestjs/config";
import { AiWaiterMessageKind } from "@prisma/client";
import { AiWaiterContext, AiWaiterProviderResult } from "../ai-waiter.types";
import { AiWaiterStubProviderService } from "../ai-waiter-stub-provider.service";
import { AiWaiterProviderRegistry } from "./ai-waiter-provider-registry.service";
import { AiWaiterProviderError } from "./groq-ai-waiter.types";
import { GroqAiWaiterProviderService } from "./groq-ai-waiter-provider.service";

const context = {
  menuItems: [],
} as unknown as AiWaiterContext;

function config(provider?: string) {
  return {
    get: jest.fn((key: string) =>
      key === "aiWaiter.provider" ? provider : undefined,
    ),
  } as unknown as ConfigService;
}

describe("AiWaiterProviderRegistry", () => {
  it("selects stub by default", async () => {
    const stub = {
      name: "stub",
      respond: jest.fn(() => ({
        content: "stub",
        kind: AiWaiterMessageKind.text,
        suggestedActions: [],
        toolCalls: [],
        metadata: { provider: "stub" },
      })),
    } as unknown as AiWaiterStubProviderService;
    const groq = { name: "groq" } as unknown as GroqAiWaiterProviderService;
    const registry = new AiWaiterProviderRegistry(config(), stub, groq);

    const result = await registry.respond(context, {
      message: "hello",
      language: "en",
    });

    expect(registry.getConfiguredProviderName()).toBe("stub");
    expect(result.content).toBe("stub");
    expect(stub.respond).toHaveBeenCalled();
  });

  it("selects groq when configured", async () => {
    const stub = {
      name: "stub",
      safeFallbackResult: jest.fn(),
    } as unknown as AiWaiterStubProviderService;
    const groqResult: AiWaiterProviderResult = {
      content: "groq",
      kind: AiWaiterMessageKind.text,
      suggestedActions: [],
      toolCalls: [],
      metadata: { provider: "groq" },
    };
    const groq = {
      name: "groq",
      respond: jest.fn().mockResolvedValue(groqResult),
    } as unknown as GroqAiWaiterProviderService;
    const registry = new AiWaiterProviderRegistry(config("groq"), stub, groq);

    const result = await registry.respond(context, {
      message: "hello",
      language: "en",
    });

    expect(registry.getConfiguredProviderName()).toBe("groq");
    expect(result.content).toBe("groq");
    expect(groq.respond).toHaveBeenCalled();
  });

  it("falls back safely to stub when groq fails", async () => {
    const stub = {
      name: "stub",
      safeFallbackResult: jest.fn(() => ({
        content: "safe fallback",
        kind: AiWaiterMessageKind.text,
        suggestedActions: ["show_menu"],
        toolCalls: [],
        metadata: { provider: "stub" },
      })),
    } as unknown as AiWaiterStubProviderService;
    const groq = {
      name: "groq",
      respond: jest
        .fn()
        .mockRejectedValue(
          new AiWaiterProviderError("missing", "missing_config"),
        ),
    } as unknown as GroqAiWaiterProviderService;
    const registry = new AiWaiterProviderRegistry(config("groq"), stub, groq);

    const result = await registry.respond(context, {
      message: "hello",
      language: "en",
    });

    expect(result.content).toBe("safe fallback");
    expect(result.metadata).toMatchObject({
      provider: "groq",
      fallbackProvider: "stub",
      fallbackUsed: true,
      errorType: "missing_config",
    });
  });
});
