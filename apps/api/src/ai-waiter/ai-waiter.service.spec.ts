import {
  AiWaiterCartProposalStatus,
  AiWaiterMessageKind,
  AiWaiterMessageRole,
  AiWaiterProviderMode,
  AiWaiterSessionStatus,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
  RealtimeEventType,
} from "@prisma/client";
import { TableAttentionService } from "../autopilot/table-attention.service";
import { CartService } from "../cart/cart.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { WaiterCallsService } from "../waiter-calls/waiter-calls.service";
import { AiWaiterContextService } from "./ai-waiter-context.service";
import { AiWaiterToolExecutorService } from "./ai-waiter-tool-executor.service";
import { AiWaiterContext, AiWaiterProviderResult } from "./ai-waiter.types";
import { AiWaiterProviderRegistry } from "./providers/ai-waiter-provider-registry.service";
import { AiWaiterService } from "./ai-waiter.service";

const now = new Date("2026-01-01T00:00:00.000Z");

const tableSession = {
  id: "table-session-1",
  companyId: "company-1",
  branchId: "branch-1",
  tableId: "table-1",
  status: "active",
  expiresAt: new Date("2026-01-02T00:00:00.000Z"),
};

const activeAiWaiterSession = {
  id: "ai-session-1",
  companyId: "company-1",
  branchId: "branch-1",
  tableSessionId: "table-session-1",
  status: AiWaiterSessionStatus.active,
  language: "ar-EG",
  providerMode: AiWaiterProviderMode.stub,
};

const context: AiWaiterContext = {
  tableSession,
  branch: {
    id: "branch-1",
    companyId: "company-1",
    name: "Balcona Main",
    slug: "main",
  },
  effectiveExperience: {
    language: "ar-EG",
  },
  cartSummary: {},
  recentMessages: [],
  menuItems: [
    {
      id: "item-lemon-mint",
      slug: "lemon-mint",
      name: "Lemon Mint",
      currency: "EGP",
      isFeatured: true,
      modifierGroups: [],
    },
  ],
};

function createService(input: {
  providerResult: AiWaiterProviderResult;
  tx: Record<string, any>;
}) {
  const prisma = {
    aiWaiterSession: {
      findFirst: jest.fn().mockResolvedValue(activeAiWaiterSession),
    },
    $transaction: jest.fn((callback) => callback(input.tx)),
  } as unknown as PrismaService;
  const contextService = {
    findOpenTableSessionOrThrow: jest.fn().mockResolvedValue(tableSession),
    buildContext: jest.fn().mockResolvedValue(context),
  } as unknown as AiWaiterContextService;
  const providerRegistry = {
    respond: jest.fn().mockResolvedValue(input.providerResult),
    getConfiguredProviderName: jest.fn().mockReturnValue("groq"),
  } as unknown as AiWaiterProviderRegistry;
  const realtimeEventsService = {
    createRealtimeEvent: jest.fn().mockResolvedValue({}),
  } as unknown as RealtimeEventsService;
  const toolExecutor = {
    execute: jest.fn().mockImplementation(({ providerResult }) =>
      Promise.resolve({
        ...providerResult,
        metadata: {
          ...(providerResult.metadata ?? {}),
          toolExecution: { refreshCustomerState: false, actions: [] },
        },
      }),
    ),
  } as unknown as AiWaiterToolExecutorService;
  const saasService = {
    assertCompanyFeatureEnabled: jest.fn().mockResolvedValue(undefined),
    assertWithinLimit: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new AiWaiterService(
      prisma,
      contextService,
      providerRegistry,
      {} as unknown as CartService,
      {} as unknown as WaiterCallsService,
      realtimeEventsService,
      {} as unknown as TableAttentionService,
      saasService as never,
      toolExecutor,
    ),
    prisma,
    contextService,
    providerRegistry,
    realtimeEventsService,
    toolExecutor,
    saasService,
  };
}

describe("AiWaiterService provider integration", () => {
  it("persists a mocked Groq assistant response and cart proposal through the existing backend flow", async () => {
    const providerResult: AiWaiterProviderResult = {
      content: "تمام، Lemon Mint موجود. راجع الاقتراح قبل الإضافة للسلة.",
      kind: AiWaiterMessageKind.cart_proposal,
      suggestedActions: ["apply_cart_proposal", "reject_cart_proposal"],
      proposal: {
        title: "Lemon Mint proposal",
        items: [
          {
            menuItemId: "item-lemon-mint",
            quantity: 1,
            modifierOptionIds: [],
          },
        ],
      },
      toolCalls: [
        {
          toolName: AiWaiterToolName.create_cart_proposal,
          status: AiWaiterToolCallStatus.succeeded,
          output: { menuItemIds: ["item-lemon-mint"] },
        },
      ],
      metadata: {
        provider: "groq",
        model: "test-model",
        intent: "cart_proposal",
        confidence: 0.9,
      },
    };
    const tx = {
      aiWaiterMessage: {
        create: jest
          .fn()
          .mockResolvedValueOnce({
            id: "customer-message-1",
            role: AiWaiterMessageRole.customer,
            kind: AiWaiterMessageKind.text,
            createdAt: now,
          })
          .mockResolvedValueOnce({
            id: "assistant-message-1",
            role: AiWaiterMessageRole.assistant,
            kind: AiWaiterMessageKind.cart_proposal,
            createdAt: now,
          }),
      },
      aiWaiterSession: {
        update: jest.fn().mockResolvedValue(activeAiWaiterSession),
        findUnique: jest.fn().mockResolvedValue(activeAiWaiterSession),
      },
      aiWaiterCartProposal: {
        create: jest.fn().mockResolvedValue({
          id: "proposal-1",
          status: AiWaiterCartProposalStatus.proposed,
        }),
      },
      aiWaiterToolCall: {
        create: jest.fn().mockResolvedValue({}),
      },
      aiWaiterUsageEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const {
      service,
      providerRegistry,
      contextService,
      realtimeEventsService,
      toolExecutor,
    } = createService({ providerResult, tx });

    const result = await service.sendMessage("table-session-1", {
      message: "هات Lemon Mint",
      language: "ar-EG",
    });

    expect(contextService.buildContext).toHaveBeenCalledWith(
      tableSession,
      activeAiWaiterSession.id,
    );
    expect(providerRegistry.respond).toHaveBeenCalledWith(context, {
      message: "هات Lemon Mint",
      language: "ar-EG",
    });
    expect(toolExecutor.execute).toHaveBeenCalledWith({
      context,
      customerMessage: "هات Lemon Mint",
      providerResult,
    });
    expect(tx.aiWaiterCartProposal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AiWaiterCartProposalStatus.proposed,
          title: "Lemon Mint proposal",
          currency: "EGP",
        }),
      }),
    );
    expect(tx.aiWaiterUsageEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerMode: AiWaiterProviderMode.stub,
          modelName: "test-model",
          metadata: expect.objectContaining({
            provider: "groq",
            fallbackUsed: false,
          }),
        }),
      }),
    );
    expect(realtimeEventsService.createRealtimeEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: RealtimeEventType.ai_waiter_cart_proposal_created,
      }),
      tx,
    );
    expect(result.cartProposal).toMatchObject({
      id: "proposal-1",
      status: AiWaiterCartProposalStatus.proposed,
    });
  });
});
