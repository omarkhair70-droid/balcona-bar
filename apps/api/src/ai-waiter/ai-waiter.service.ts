import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  AiWaiterCartProposalStatus,
  AiWaiterEscalationReason,
  AiWaiterMessageKind,
  AiWaiterMessageRole,
  AiWaiterProviderMode,
  AiWaiterSessionStatus,
  AiWaiterToolCallStatus,
  AiWaiterToolName,
  Prisma,
  RealtimeEventChannel,
  RealtimeEventType,
  WaiterCallType,
} from "@prisma/client";
import {
  AddCartItemDto,
  SelectedModifierDto,
} from "../cart/dto/add-cart-item.dto";
import { CartService } from "../cart/cart.service";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { WaiterCallsService } from "../waiter-calls/waiter-calls.service";
import { AiWaiterContextService } from "./ai-waiter-context.service";
import {
  AiWaiterContext,
  AiWaiterProposalItem,
  AiWaiterProviderResult,
  AiWaiterProviderToolCall,
} from "./ai-waiter.types";
import { EscalateAiWaiterDto } from "./dto/escalate-ai-waiter.dto";
import { ListAiWaiterMessagesQueryDto } from "./dto/list-ai-waiter-messages-query.dto";
import { ListAiWaiterSessionsQueryDto } from "./dto/list-ai-waiter-sessions-query.dto";
import { RejectCartProposalDto } from "./dto/reject-cart-proposal.dto";
import { SendAiWaiterMessageDto } from "./dto/send-ai-waiter-message.dto";
import { StartAiWaiterDto } from "./dto/start-ai-waiter.dto";
import { AiWaiterStubProviderService } from "./ai-waiter-stub-provider.service";

const DEFAULT_LANGUAGE = "ar-EG";
const DEFAULT_MESSAGE_LIMIT = 50;
const DEFAULT_SESSION_LIMIT = 50;
const PROPOSAL_TTL_MS = 30 * 60 * 1000;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

@Injectable()
export class AiWaiterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextService: AiWaiterContextService,
    private readonly stubProvider: AiWaiterStubProviderService,
    private readonly cartService: CartService,
    private readonly waiterCallsService: WaiterCallsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async start(sessionId: string, body: StartAiWaiterDto = {}) {
    const tableSession =
      await this.contextService.findOpenTableSessionOrThrow(sessionId);
    const language = this.normalizeLanguage(body.language);
    const { session } = await this.ensureActiveSession(tableSession, language);

    return this.getSessionState(session.id);
  }

  async getCurrent(sessionId: string) {
    const tableSession =
      await this.contextService.findOpenTableSessionOrThrow(sessionId);
    const session = await this.findActiveSessionForTableSession(sessionId);

    if (!session) {
      const [cartSummary, effectiveExperience] = await Promise.all([
        this.cartService.getCart(tableSession.id),
        this.contextService.getEffectiveExperience(
          tableSession.companyId,
          tableSession.branchId,
        ),
      ]);

      return {
        tableSession,
        session: null,
        messages: [],
        latestCartProposal: null,
        cartSummary,
        effectiveExperience,
      };
    }

    return this.getSessionState(session.id);
  }

  async listMessages(
    sessionId: string,
    query: ListAiWaiterMessagesQueryDto = {},
  ) {
    await this.contextService.findOpenTableSessionOrThrow(sessionId);
    const session = await this.findActiveSessionForTableSession(sessionId);
    const limit = this.normalizeLimit(query.limit, DEFAULT_MESSAGE_LIMIT);

    if (!session) {
      return {
        session: null,
        filters: { limit },
        messages: [],
      };
    }

    const messages = await this.prisma.aiWaiterMessage.findMany({
      where: { aiWaiterSessionId: session.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    return {
      session,
      filters: { limit },
      messages: messages.reverse(),
    };
  }

  async sendMessage(sessionId: string, body: SendAiWaiterMessageDto) {
    const tableSession =
      await this.contextService.findOpenTableSessionOrThrow(sessionId);
    const language = this.normalizeLanguage(body.language);
    const normalizedMessage = this.normalizeRequiredText(
      body.message,
      "message",
    );
    const { session } = await this.ensureActiveSession(tableSession, language);
    const customerInputTokens = this.estimateTokens(normalizedMessage);

    const customerMessage = await this.prisma.$transaction(async (tx) => {
      const message = await tx.aiWaiterMessage.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          role: AiWaiterMessageRole.customer,
          kind: AiWaiterMessageKind.text,
          language,
          content: normalizedMessage,
          inputTokens: customerInputTokens,
        },
      });

      await tx.aiWaiterSession.update({
        where: { id: session.id },
        data: {
          language,
          messageCount: { increment: 1 },
          lastMessageAt: message.createdAt,
        },
      });
      await this.recordAiWaiterRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          messageId: message.id,
        },
        RealtimeEventType.ai_waiter_message_created,
        { role: message.role, kind: message.kind },
        tx,
      );

      return message;
    });
    const context = await this.contextService.buildContext(
      tableSession,
      session.id,
    );
    const providerResult = this.stubProvider.respond(context, {
      message: normalizedMessage,
      language,
    });

    const persisted = await this.persistProviderResult({
      sessionId: session.id,
      context,
      language,
      providerResult,
      inputTokens: customerInputTokens,
    });

    return {
      session: persisted.session,
      customerMessage,
      assistantMessage: persisted.assistantMessage,
      suggestedActions: providerResult.suggestedActions,
      cartProposal: persisted.cartProposal,
    };
  }

  async applyProposal(proposalId: string) {
    const proposal = await this.findCartProposalOrThrow(proposalId);

    if (proposal.status !== AiWaiterCartProposalStatus.proposed) {
      throw new BadRequestException(
        "Only proposed cart proposals can be applied",
      );
    }

    if (proposal.expiresAt && proposal.expiresAt <= new Date()) {
      await this.prisma.aiWaiterCartProposal.update({
        where: { id: proposal.id },
        data: {
          status: AiWaiterCartProposalStatus.expired,
          validationSnapshot: this.toJsonValue({
            reason: "proposal_expired",
            checkedAt: new Date().toISOString(),
          }),
        },
      });
      throw new BadRequestException("Cart proposal has expired");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const lockedProposal = await tx.aiWaiterCartProposal.findUnique({
          where: { id: proposalId },
        });

        if (!lockedProposal) {
          throw new NotFoundException("AI waiter cart proposal not found");
        }

        if (lockedProposal.status !== AiWaiterCartProposalStatus.proposed) {
          throw new BadRequestException(
            "Only proposed cart proposals can be applied",
          );
        }

        const items = this.parseProposalItems(lockedProposal.items);
        let updatedCart: any = null;

        for (const item of items) {
          updatedCart = await this.cartService.addItemWithTransaction(
            lockedProposal.tableSessionId,
            await this.toAddCartItemDto(item, tx),
            tx,
          );
        }

        if (!updatedCart?.cart?.id) {
          throw new BadRequestException("Cart proposal did not add any items");
        }

        const updatedProposal = await tx.aiWaiterCartProposal.update({
          where: { id: lockedProposal.id },
          data: {
            status: AiWaiterCartProposalStatus.applied,
            appliedAt: new Date(),
            appliedCartId: updatedCart.cart.id,
            validationSnapshot: this.toJsonValue({
              appliedItemCount: items.length,
              appliedAt: new Date().toISOString(),
              validatedBy: "CartService.addItemWithTransaction",
            }),
          },
        });

        await this.createToolCall(
          {
            companyId: lockedProposal.companyId,
            branchId: lockedProposal.branchId,
            tableSessionId: lockedProposal.tableSessionId,
            aiWaiterSessionId: lockedProposal.aiWaiterSessionId,
          },
          {
            toolName: AiWaiterToolName.apply_cart_proposal,
            status: AiWaiterToolCallStatus.succeeded,
            input: { proposalId: lockedProposal.id },
            output: { cartId: updatedCart.cart.id, itemCount: items.length },
          },
          tx,
        );
        await this.recordAiWaiterRealtimeEvent(
          {
            companyId: lockedProposal.companyId,
            branchId: lockedProposal.branchId,
            tableSessionId: lockedProposal.tableSessionId,
            aiWaiterSessionId: lockedProposal.aiWaiterSessionId,
            proposalId: lockedProposal.id,
          },
          RealtimeEventType.ai_waiter_cart_proposal_applied,
          { cartId: updatedCart.cart.id, itemCount: items.length },
          tx,
        );

        return {
          proposal: updatedProposal,
          cart: updatedCart,
        };
      });
    } catch (error) {
      await this.captureProposalApplyError(proposalId, error);
      throw error;
    }
  }

  async rejectProposal(proposalId: string, body: RejectCartProposalDto = {}) {
    const proposal = await this.findCartProposalOrThrow(proposalId);

    if (proposal.status !== AiWaiterCartProposalStatus.proposed) {
      throw new BadRequestException(
        "Only proposed cart proposals can be rejected",
      );
    }

    const updatedProposal = await this.prisma.aiWaiterCartProposal.update({
      where: { id: proposal.id },
      data: {
        status: AiWaiterCartProposalStatus.rejected,
        rejectedAt: new Date(),
        rejectionReason: this.normalizeOptionalText(body.reason),
      },
    });

    return { proposal: updatedProposal };
  }

  async escalate(sessionId: string, body: EscalateAiWaiterDto) {
    const tableSession =
      await this.contextService.findOpenTableSessionOrThrow(sessionId);
    const language = DEFAULT_LANGUAGE;
    const { session } = await this.ensureActiveSession(tableSession, language);
    const message =
      this.normalizeOptionalText(body.message) ??
      "Customer requested a human waiter from AI waiter.";
    const waiterCall = await this.waiterCallsService.createForTableSession(
      sessionId,
      {
        type: WaiterCallType.call_waiter,
        message,
        priority: 2,
      },
    );

    const updatedSession = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.aiWaiterMessage.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          role: AiWaiterMessageRole.system,
          kind: AiWaiterMessageKind.escalation,
          language,
          content: "AI waiter escalated this table session to human staff.",
          structuredPayload: this.toJsonValue({
            reason: body.reason,
            waiterCallId: waiterCall.waiterCall.id,
          }),
        },
      });
      const updated = await tx.aiWaiterSession.update({
        where: { id: session.id },
        data: {
          status: AiWaiterSessionStatus.escalated,
          escalatedAt: now,
          escalationReason: body.reason as AiWaiterEscalationReason,
          messageCount: { increment: 1 },
          lastMessageAt: now,
        },
      });

      await this.createToolCall(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
        },
        {
          toolName: AiWaiterToolName.call_waiter,
          status: AiWaiterToolCallStatus.succeeded,
          input: { reason: body.reason, message },
          output: { waiterCallId: waiterCall.waiterCall.id },
        },
        tx,
      );
      await this.recordAiWaiterRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          waiterCallId: waiterCall.waiterCall.id,
        },
        RealtimeEventType.ai_waiter_escalated,
        { reason: body.reason, waiterCallId: waiterCall.waiterCall.id },
        tx,
      );

      return updated;
    });

    return {
      session: updatedSession,
      waiterCall,
    };
  }

  async close(sessionId: string) {
    await this.contextService.findTableSessionOrThrow(sessionId);
    const session = await this.findActiveSessionForTableSession(sessionId);

    if (!session) {
      throw new NotFoundException("Active AI waiter session not found");
    }

    const updatedSession = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.aiWaiterMessage.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          role: AiWaiterMessageRole.system,
          kind: AiWaiterMessageKind.status,
          language: session.language,
          content: "AI waiter session closed.",
        },
      });
      const updated = await tx.aiWaiterSession.update({
        where: { id: session.id },
        data: {
          status: AiWaiterSessionStatus.closed,
          closedAt: now,
          messageCount: { increment: 1 },
          lastMessageAt: now,
        },
      });

      await this.recordAiWaiterRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
        },
        RealtimeEventType.ai_waiter_session_closed,
        { status: AiWaiterSessionStatus.closed },
        tx,
      );

      return updated;
    });

    return { session: updatedSession };
  }

  async listBranchSessions(
    branchId: string,
    query: ListAiWaiterSessionsQueryDto = {},
  ) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        companyId: true,
        name: true,
        slug: true,
        status: true,
      },
    });

    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const limit = this.normalizeLimit(query.limit, DEFAULT_SESSION_LIMIT);
    const statusFilter =
      !query.status || query.status === "all"
        ? {}
        : { status: query.status as AiWaiterSessionStatus };
    const sessions = await this.prisma.aiWaiterSession.findMany({
      where: {
        branchId,
        ...statusFilter,
      },
      orderBy: [
        { lastMessageAt: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
      include: {
        tableSession: {
          select: {
            id: true,
            status: true,
            guestLabel: true,
            partySize: true,
            tableId: true,
          },
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: {
            id: true,
            role: true,
            kind: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });

    return {
      branch,
      filters: {
        status: query.status ?? "all",
        limit,
      },
      sessions,
    };
  }

  async getSessionDetail(aiWaiterSessionId: string) {
    const session = await this.prisma.aiWaiterSession.findUnique({
      where: { id: aiWaiterSessionId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
        tableSession: { select: this.tableSessionSelect() },
        messages: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        cartProposals: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
        toolCalls: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
        usageEvents: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        },
      },
    });

    if (!session) {
      throw new NotFoundException("AI waiter session not found");
    }

    return { session };
  }

  private async ensureActiveSession(
    tableSession: Awaited<
      ReturnType<AiWaiterContextService["findTableSessionOrThrow"]>
    >,
    language: string,
  ) {
    const existing = await this.findActiveSessionForTableSession(
      tableSession.id,
    );

    if (existing) {
      return { session: existing, created: false };
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.aiWaiterSession.create({
        data: {
          companyId: tableSession.companyId,
          branchId: tableSession.branchId,
          tableSessionId: tableSession.id,
          status: AiWaiterSessionStatus.active,
          language,
          providerMode: AiWaiterProviderMode.stub,
          contextMetadata: this.toJsonValue({
            source: "phase_18_stub_provider",
          }),
        },
      });
      const welcome = await tx.aiWaiterMessage.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          role: AiWaiterMessageRole.assistant,
          kind: AiWaiterMessageKind.status,
          language,
          content:
            "أهلاً بيك. أقدر أرشحلك من المنيو أو أجهزلك اقتراح للسلة، والأسعار والطلب النهائي هيتأكدوا من السيستم.",
          metadata: this.toJsonValue({ provider: "stub" }),
        },
      });
      const updatedSession = await tx.aiWaiterSession.update({
        where: { id: session.id },
        data: {
          messageCount: 1,
          lastMessageAt: welcome.createdAt,
        },
      });

      await this.recordAiWaiterRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          messageId: welcome.id,
        },
        RealtimeEventType.ai_waiter_session_started,
        { language, providerMode: AiWaiterProviderMode.stub },
        tx,
      );

      return updatedSession;
    });

    return { session: created, created: true };
  }

  private async persistProviderResult(input: {
    sessionId: string;
    context: AiWaiterContext;
    language: string;
    providerResult: AiWaiterProviderResult;
    inputTokens: number;
  }) {
    const outputTokens = this.estimateTokens(input.providerResult.content);
    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.aiWaiterSession.findUnique({
        where: { id: input.sessionId },
      });

      if (!session) {
        throw new NotFoundException("AI waiter session not found");
      }

      const assistantMessage = await tx.aiWaiterMessage.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          role: AiWaiterMessageRole.assistant,
          kind: input.providerResult.kind,
          language: input.language,
          content: input.providerResult.content,
          structuredPayload: this.toJsonValue({
            suggestedActions: input.providerResult.suggestedActions,
            proposal: input.providerResult.proposal
              ? {
                  title: input.providerResult.proposal.title,
                  items: input.providerResult.proposal.items,
                }
              : undefined,
          }),
          metadata: this.toJsonValue(input.providerResult.metadata ?? {}),
          outputTokens,
        },
      });
      const cartProposal = input.providerResult.proposal
        ? await this.createCartProposal(
            session,
            input.context,
            input.providerResult,
            tx,
          )
        : null;

      for (const toolCall of input.providerResult.toolCalls) {
        await this.createToolCall(
          {
            companyId: session.companyId,
            branchId: session.branchId,
            tableSessionId: session.tableSessionId,
            aiWaiterSessionId: session.id,
            messageId: assistantMessage.id,
          },
          toolCall,
          tx,
        );
      }

      await tx.aiWaiterUsageEvent.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          providerMode: AiWaiterProviderMode.stub,
          modelName: "deterministic-stub-v1",
          inputTokens: input.inputTokens,
          outputTokens,
          estimatedCostMicros: 0,
          metadata: this.toJsonValue({
            menuItemCount: input.context.menuItems.length,
            recentMessageCount: input.context.recentMessages.length,
          }),
        },
      });
      const updatedSession = await tx.aiWaiterSession.update({
        where: { id: session.id },
        data: {
          totalInputTokens: { increment: input.inputTokens },
          totalOutputTokens: { increment: outputTokens },
          estimatedCostMicros: { increment: 0 },
          messageCount: { increment: 1 },
          lastMessageAt: assistantMessage.createdAt,
        },
      });

      await this.recordAiWaiterRealtimeEvent(
        {
          companyId: session.companyId,
          branchId: session.branchId,
          tableSessionId: session.tableSessionId,
          aiWaiterSessionId: session.id,
          messageId: assistantMessage.id,
          proposalId: cartProposal?.id,
        },
        RealtimeEventType.ai_waiter_message_created,
        {
          role: assistantMessage.role,
          kind: assistantMessage.kind,
          cartProposalId: cartProposal?.id,
        },
        tx,
      );

      if (cartProposal) {
        await this.recordAiWaiterRealtimeEvent(
          {
            companyId: session.companyId,
            branchId: session.branchId,
            tableSessionId: session.tableSessionId,
            aiWaiterSessionId: session.id,
            proposalId: cartProposal.id,
          },
          RealtimeEventType.ai_waiter_cart_proposal_created,
          {
            status: cartProposal.status,
            itemCount: input.providerResult.proposal?.items.length ?? 0,
          },
          tx,
        );
      }

      return {
        session: updatedSession,
        assistantMessage,
        cartProposal,
      };
    });

    return result;
  }

  private async createCartProposal(
    session: {
      id: string;
      companyId: string;
      branchId: string;
      tableSessionId: string;
    },
    context: AiWaiterContext,
    providerResult: AiWaiterProviderResult,
    tx: Prisma.TransactionClient,
  ) {
    if (!providerResult.proposal) {
      return null;
    }

    const currency = this.currencyForProposal(
      context,
      providerResult.proposal.items,
    );

    return tx.aiWaiterCartProposal.create({
      data: {
        companyId: session.companyId,
        branchId: session.branchId,
        tableSessionId: session.tableSessionId,
        aiWaiterSessionId: session.id,
        status: AiWaiterCartProposalStatus.proposed,
        title: providerResult.proposal.title,
        language: context.effectiveExperience.language ?? DEFAULT_LANGUAGE,
        items: this.toJsonValue(providerResult.proposal.items),
        currency,
        expiresAt:
          providerResult.proposal.expiresAt ??
          new Date(Date.now() + PROPOSAL_TTL_MS),
        validationSnapshot: this.toJsonValue({
          createdBy: "deterministic-stub-v1",
          pricingAuthority: "backend_cart_validation_only",
        }),
      },
    });
  }

  private async toAddCartItemDto(
    item: AiWaiterProposalItem,
    tx: Prisma.TransactionClient,
  ): Promise<AddCartItemDto> {
    return {
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: this.normalizeOptionalText(item.customerNote),
      selectedModifiers: await this.toSelectedModifiers(item, tx),
    };
  }

  private async toSelectedModifiers(
    item: AiWaiterProposalItem,
    tx: Prisma.TransactionClient,
  ): Promise<SelectedModifierDto[]> {
    const optionIds = Array.from(new Set(item.modifierOptionIds ?? []));

    if (optionIds.length === 0) {
      return [];
    }

    const options = await tx.modifierOption.findMany({
      where: { id: { in: optionIds } },
      select: {
        id: true,
        groupId: true,
      },
    });

    if (options.length !== optionIds.length) {
      throw new BadRequestException("Modifier option does not exist");
    }

    const optionIdsByGroup = new Map<string, string[]>();

    for (const option of options) {
      const groupOptions = optionIdsByGroup.get(option.groupId) ?? [];
      groupOptions.push(option.id);
      optionIdsByGroup.set(option.groupId, groupOptions);
    }

    return Array.from(optionIdsByGroup.entries()).map(
      ([modifierGroupId, groupOptionIds]) => ({
        modifierGroupId,
        optionIds: groupOptionIds,
      }),
    );
  }

  private parseProposalItems(items: Prisma.JsonValue): AiWaiterProposalItem[] {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException("Cart proposal has no items");
    }

    return items.map((item, index) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        throw new BadRequestException(
          `Cart proposal item ${index + 1} is invalid`,
        );
      }

      const rawItem = item as Record<string, unknown>;
      const menuItemId = rawItem.menuItemId;
      const quantity = rawItem.quantity;
      const modifierOptionIds = rawItem.modifierOptionIds;
      const customerNote = rawItem.customerNote;

      if (typeof menuItemId !== "string" || menuItemId.length === 0) {
        throw new BadRequestException(
          `Cart proposal item ${index + 1} is missing menuItemId`,
        );
      }

      if (!Number.isInteger(quantity) || (quantity as number) < 1) {
        throw new BadRequestException(
          `Cart proposal item ${index + 1} has invalid quantity`,
        );
      }

      if (
        modifierOptionIds !== undefined &&
        (!Array.isArray(modifierOptionIds) ||
          modifierOptionIds.some((value) => typeof value !== "string"))
      ) {
        throw new BadRequestException(
          `Cart proposal item ${index + 1} has invalid modifier options`,
        );
      }

      return {
        menuItemId,
        quantity: quantity as number,
        modifierOptionIds: (modifierOptionIds as string[] | undefined) ?? [],
        customerNote:
          typeof customerNote === "string"
            ? customerNote.slice(0, 500)
            : undefined,
      };
    });
  }

  private async createToolCall(
    scope: {
      companyId: string;
      branchId: string;
      tableSessionId: string;
      aiWaiterSessionId: string;
      messageId?: string;
    },
    toolCall: AiWaiterProviderToolCall,
    tx: PrismaExecutor,
  ) {
    return tx.aiWaiterToolCall.create({
      data: {
        companyId: scope.companyId,
        branchId: scope.branchId,
        tableSessionId: scope.tableSessionId,
        aiWaiterSessionId: scope.aiWaiterSessionId,
        messageId: scope.messageId,
        toolName: toolCall.toolName,
        status: toolCall.status ?? AiWaiterToolCallStatus.succeeded,
        input:
          toolCall.input === undefined
            ? undefined
            : this.toJsonValue(toolCall.input),
        output:
          toolCall.output === undefined
            ? undefined
            : this.toJsonValue(toolCall.output),
        errorCode: toolCall.errorCode,
        errorMessage: toolCall.errorMessage,
        completedAt:
          toolCall.status === AiWaiterToolCallStatus.pending
            ? undefined
            : new Date(),
      },
    });
  }

  private async recordAiWaiterRealtimeEvent(
    scope: {
      companyId: string;
      branchId: string;
      tableSessionId: string;
      aiWaiterSessionId: string;
      messageId?: string;
      proposalId?: string;
      waiterCallId?: string;
    },
    type: RealtimeEventType,
    payload: Record<string, unknown>,
    tx: PrismaExecutor,
  ) {
    return this.realtimeEventsService.createRealtimeEvent(
      {
        companyId: scope.companyId,
        branchId: scope.branchId,
        tableSessionId: scope.tableSessionId,
        waiterCallId: scope.waiterCallId,
        type,
        channel: RealtimeEventChannel.session_status,
        payload: {
          aiWaiterSessionId: scope.aiWaiterSessionId,
          messageId: scope.messageId,
          cartProposalId: scope.proposalId,
          ...payload,
        },
      },
      tx,
    );
  }

  private async getSessionState(aiWaiterSessionId: string) {
    const session = await this.prisma.aiWaiterSession.findUnique({
      where: { id: aiWaiterSessionId },
      include: {
        company: { select: this.companySelect() },
        branch: { select: this.branchSelect() },
        tableSession: { select: this.tableSessionSelect() },
      },
    });

    if (!session) {
      throw new NotFoundException("AI waiter session not found");
    }

    const [messages, latestCartProposal, cartSummary, effectiveExperience] =
      await Promise.all([
        this.prisma.aiWaiterMessage.findMany({
          where: { aiWaiterSessionId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: DEFAULT_MESSAGE_LIMIT,
        }),
        this.prisma.aiWaiterCartProposal.findFirst({
          where: {
            aiWaiterSessionId,
            status: AiWaiterCartProposalStatus.proposed,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
        this.cartService.getCart(session.tableSessionId),
        this.contextService.getEffectiveExperience(
          session.companyId,
          session.branchId,
        ),
      ]);

    return {
      session,
      messages: messages.reverse(),
      latestCartProposal,
      cartSummary,
      effectiveExperience,
    };
  }

  private async findActiveSessionForTableSession(tableSessionId: string) {
    return this.prisma.aiWaiterSession.findFirst({
      where: {
        tableSessionId,
        status: AiWaiterSessionStatus.active,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  private async findCartProposalOrThrow(proposalId: string) {
    const proposal = await this.prisma.aiWaiterCartProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new NotFoundException("AI waiter cart proposal not found");
    }

    return proposal;
  }

  private async captureProposalApplyError(proposalId: string, error: unknown) {
    await this.prisma.aiWaiterCartProposal
      .update({
        where: { id: proposalId },
        data: {
          validationSnapshot: this.toJsonValue({
            lastApplyError: this.errorMessage(error),
            checkedAt: new Date().toISOString(),
          }),
        },
      })
      .catch(() => undefined);
  }

  private currencyForProposal(
    context: AiWaiterContext,
    items: AiWaiterProposalItem[],
  ) {
    const firstMenuItem = context.menuItems.find(
      (item) => item.id === items[0]?.menuItemId,
    );

    return firstMenuItem?.currency ?? "EGP";
  }

  private normalizeLanguage(language?: string | null) {
    const normalized = this.normalizeOptionalText(language);

    return normalized ?? DEFAULT_LANGUAGE;
  }

  private normalizeRequiredText(value: string, fieldName: string) {
    const normalized = this.normalizeOptionalText(value);

    if (!normalized) {
      throw new BadRequestException(`${fieldName} cannot be empty`);
    }

    return normalized;
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return undefined;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : undefined;
  }

  private estimateTokens(value: string) {
    return Math.max(1, Math.ceil(value.length / 4));
  }

  private normalizeLimit(limit: number | undefined, defaultLimit: number) {
    return Math.min(Math.max(limit ?? defaultLimit, 1), 100);
  }

  private errorMessage(error: unknown) {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();

      return typeof response === "string" ? response : JSON.stringify(response);
    }

    return error instanceof Error ? error.message : "Unknown error";
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private companySelect() {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
    };
  }

  private branchSelect() {
    return {
      id: true,
      companyId: true,
      name: true,
      slug: true,
      address: true,
      status: true,
    };
  }

  private tableSessionSelect() {
    return {
      id: true,
      companyId: true,
      branchId: true,
      tableId: true,
      status: true,
      guestLabel: true,
      partySize: true,
      startedAt: true,
      lastSeenAt: true,
      expiresAt: true,
      closedAt: true,
      closeReason: true,
      createdAt: true,
      updatedAt: true,
    };
  }
}
