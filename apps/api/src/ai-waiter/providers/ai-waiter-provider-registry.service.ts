import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiWaiterContext,
  AiWaiterProvider,
  AiWaiterProviderResult,
} from "../ai-waiter.types";
import { AiWaiterStubProviderService } from "../ai-waiter-stub-provider.service";
import { AiWaiterProviderError } from "./groq-ai-waiter.types";
import { GroqAiWaiterProviderService } from "./groq-ai-waiter-provider.service";

type SupportedAiWaiterProvider = "stub" | "groq";

@Injectable()
export class AiWaiterProviderRegistry {
  private readonly logger = new Logger(AiWaiterProviderRegistry.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly stubProvider: AiWaiterStubProviderService,
    private readonly groqProvider: GroqAiWaiterProviderService,
  ) {}

  getConfiguredProviderName(): SupportedAiWaiterProvider {
    const configuredProvider =
      this.configService.get<string>("aiWaiter.provider") ?? "stub";

    return configuredProvider === "groq" ? "groq" : "stub";
  }

  getProvider(): AiWaiterProvider {
    return this.getConfiguredProviderName() === "groq"
      ? this.groqProvider
      : this.stubProvider;
  }

  async respond(
    context: AiWaiterContext,
    input: { message: string; language: string },
  ): Promise<AiWaiterProviderResult> {
    const provider = this.getProvider();

    if (provider.name !== "groq") {
      return provider.respond(context, input);
    }

    try {
      return await provider.respond(context, input);
    } catch (error) {
      const metadata =
        error instanceof AiWaiterProviderError
          ? {
              errorType: error.code,
              status: error.metadata.status,
              retryAfter: error.metadata.retryAfter,
            }
          : {
              errorType: "unknown",
            };

      this.logger.warn({
        provider: "groq",
        fallbackProvider: "stub",
        ...metadata,
      });

      return this.withFallbackMetadata(
        this.stubProvider.safeFallbackResult(String(metadata.errorType)),
        metadata,
      );
    }
  }

  private withFallbackMetadata(
    result: AiWaiterProviderResult,
    metadata: Record<string, unknown>,
  ) {
    return {
      ...result,
      metadata: {
        ...result.metadata,
        provider: "groq",
        fallbackProvider: "stub",
        fallbackUsed: true,
        ...metadata,
      },
    };
  }
}
