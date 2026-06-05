import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
  Prisma,
  BillStatus,
} from "@prisma/client";
import { randomUUID } from "crypto";
import {
  BillsService,
  OnlinePaymentSettlementResult,
} from "../bills/bills.service";
import { BranchOnlinePaymentsQueryDto } from "./dto/branch-online-payments-query.dto";
import { CreateOnlinePaymentIntentDto } from "./dto/create-online-payment-intent.dto";
import { MockOnlinePaymentWebhookDto } from "./dto/mock-online-payment-webhook.dto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";

const ACTIVE_ONLINE_PAYMENT_STATUSES: OnlinePaymentIntentStatus[] = [
  OnlinePaymentIntentStatus.pending,
  OnlinePaymentIntentStatus.requires_action,
];
const DEFAULT_ONLINE_PAYMENT_LIMIT = 50;
const MOCK_CHECKOUT_TTL_MINUTES = 15;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;
const onlinePaymentIntentInclude = {
  bill: {
    select: {
      id: true,
      billNumber: true,
      status: true,
      totalMinor: true,
      paidMinor: true,
      balanceDueMinor: true,
      currency: true,
    },
  },
  tableSession: {
    select: {
      id: true,
      status: true,
      table: {
        select: {
          id: true,
          code: true,
          displayName: true,
        },
      },
    },
  },
  events: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.OnlinePaymentIntentInclude;

type OnlinePaymentIntentRecord = Prisma.OnlinePaymentIntentGetPayload<{
  include: typeof onlinePaymentIntentInclude;
}>;

@Injectable()
export class OnlinePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly billsService: BillsService,
    private readonly realtimeEventsService: RealtimeEventsService,
  ) {}

  async createIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto = {},
  ) {
    this.assertOnlinePaymentsEnabled();
    const provider = this.getConfiguredProvider();

    if (provider !== OnlinePaymentProvider.mock) {
      throw new BadRequestException(
        "Online payment provider is not configured for live processing yet",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUnique({
        where: { id: billId },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          tableSessionId: true,
          status: true,
          currency: true,
          totalMinor: true,
          balanceDueMinor: true,
        },
      });

      if (!bill || bill.tableSessionId !== sessionId) {
        throw new NotFoundException("Bill not found for this table session");
      }

      this.assertBillCanStartOnlinePayment(bill);

      if (body.idempotencyKey) {
        const idempotentIntent = await tx.onlinePaymentIntent.findUnique({
          where: { idempotencyKey: body.idempotencyKey },
          include: this.intentInclude(),
        });

        if (idempotentIntent) {
          if (
            idempotentIntent.billId !== bill.id ||
            idempotentIntent.tableSessionId !== sessionId
          ) {
            throw new BadRequestException(
              "Idempotency key is already used for another online payment",
            );
          }

          return this.toIntentResult(idempotentIntent, "idempotent");
        }
      }

      const existingActiveIntent = await tx.onlinePaymentIntent.findFirst({
        where: {
          billId: bill.id,
          tableSessionId: sessionId,
          amountMinor: bill.balanceDueMinor,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: this.intentInclude(),
      });

      if (existingActiveIntent) {
        return this.toIntentResult(existingActiveIntent, "existing_active");
      }

      const providerIntentId = `mock_${randomUUID()}`;
      const checkoutExpiresAt = new Date(
        Date.now() + MOCK_CHECKOUT_TTL_MINUTES * 60 * 1000,
      );
      const providerCheckoutUrl = this.buildMockCheckoutUrl(providerIntentId);
      const intent = await tx.onlinePaymentIntent.create({
        data: {
          companyId: bill.companyId,
          branchId: bill.branchId,
          tableSessionId: sessionId,
          billId: bill.id,
          provider,
          providerIntentId,
          providerCheckoutUrl,
          idempotencyKey: body.idempotencyKey ?? `auto_${randomUUID()}`,
          status: OnlinePaymentIntentStatus.pending,
          amountMinor: bill.balanceDueMinor,
          currency: bill.currency,
          customerReturnUrl: this.normalizeOptionalText(body.customerReturnUrl),
          checkoutExpiresAt,
          metadata: this.toJsonValue({
            source: "customer_pay_online",
            mockProvider: true,
          }),
        },
        include: this.intentInclude(),
      });

      await tx.bill.updateMany({
        where: {
          id: bill.id,
          status: BillStatus.presented,
          balanceDueMinor: bill.balanceDueMinor,
        },
        data: { status: BillStatus.payment_pending },
      });
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.intent_created,
        {
          checkoutExpiresAt,
          providerCheckoutUrl,
        },
      );
      await this.realtimeEventsService.recordOnlinePaymentIntentCreated(
        intent.id,
        tx,
      );

      return this.toIntentResult(intent, "created");
    });
  }

  async findIntentForCustomer(sessionId: string, intentId: string) {
    const intent = await this.prisma.onlinePaymentIntent.findFirst({
      where: { id: intentId, tableSessionId: sessionId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    return this.toIntentResult(intent, "found");
  }

  async findForBranch(
    branchId: string,
    query: BranchOnlinePaymentsQueryDto = {},
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

    const intents = await this.prisma.onlinePaymentIntent.findMany({
      where: {
        branchId,
        ...this.statusWhere(query.status ?? "active"),
        ...(query.provider && query.provider !== "all"
          ? { provider: query.provider as OnlinePaymentProvider }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: this.normalizeLimit(query.limit),
      include: this.intentInclude(),
    });

    return {
      branch,
      filters: {
        status: query.status ?? "active",
        provider: query.provider ?? "all",
        limit: this.normalizeLimit(query.limit),
      },
      onlinePaymentIntents: intents.map((intent) =>
        this.toIntentSummary(intent),
      ),
    };
  }

  async findOne(intentId: string, tx: PrismaExecutor = this.prisma) {
    const intent = await tx.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    return this.toIntentResult(intent, "found");
  }

  async mockSucceed(intentId: string) {
    this.assertMockProviderAllowed();

    return this.processMockWebhook({
      intentId,
      providerEventId: `mock_evt_${randomUUID()}`,
      status: "succeeded",
    });
  }

  async mockFail(
    intentId: string,
    body: { failureCode?: string; failureMessage?: string } = {},
  ) {
    this.assertMockProviderAllowed();

    return this.processMockWebhook({
      intentId,
      providerEventId: `mock_evt_${randomUUID()}`,
      status: "failed",
      failureCode: body.failureCode ?? "mock_failed",
      failureMessage: body.failureMessage ?? "Mock online payment failed",
    });
  }

  async processMockWebhook(body: MockOnlinePaymentWebhookDto) {
    this.assertMockProviderAllowed();

    if (!body.intentId && !body.providerIntentId) {
      throw new BadRequestException(
        "Mock webhook requires intentId or providerIntentId",
      );
    }

    return this.prisma.$transaction(async (tx) => {
      if (body.providerEventId) {
        const existingEvent = await tx.onlinePaymentEvent.findUnique({
          where: {
            provider_providerEventId: {
              provider: OnlinePaymentProvider.mock,
              providerEventId: body.providerEventId,
            },
          },
          select: { onlinePaymentIntentId: true },
        });

        if (existingEvent) {
          const intent = await tx.onlinePaymentIntent.findUnique({
            where: { id: existingEvent.onlinePaymentIntentId },
            include: this.intentInclude(),
          });

          if (!intent) {
            throw new NotFoundException("Online payment intent not found");
          }

          return this.toIntentResult(intent, "duplicate_event", {
            settled: false,
            reason: "duplicate_event",
            message: "Mock webhook event was already processed",
          });
        }
      }

      const intent = await tx.onlinePaymentIntent.findFirst({
        where: {
          provider: OnlinePaymentProvider.mock,
          ...(body.intentId ? { id: body.intentId } : {}),
          ...(body.providerIntentId
            ? { providerIntentId: body.providerIntentId }
            : {}),
        },
        include: this.intentInclude(),
      });

      if (!intent) {
        throw new NotFoundException("Online payment intent not found");
      }

      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.provider_webhook_received,
        {
          status: body.status,
          providerEventId: body.providerEventId,
          amountMinor: body.amountMinor,
          failureCode: body.failureCode,
          failureMessage: body.failureMessage,
        },
        body.providerEventId,
      );

      if (body.status === "succeeded") {
        return this.applyMockSuccess(tx, intent, body);
      }

      return this.applyMockStatusUpdate(tx, intent, body);
    });
  }

  private async applyMockSuccess(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    body: MockOnlinePaymentWebhookDto,
  ) {
    const paymentAmountMinor = body.amountMinor ?? intent.amountMinor;

    if (paymentAmountMinor !== intent.amountMinor) {
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.settlement_skipped,
        {
          reason: "amount_mismatch",
          webhookAmountMinor: paymentAmountMinor,
          intentAmountMinor: intent.amountMinor,
        },
      );

      throw new BadRequestException(
        "Online payment amount does not match the intent amount",
      );
    }

    if (
      !ACTIVE_ONLINE_PAYMENT_STATUSES.includes(intent.status) &&
      intent.status !== OnlinePaymentIntentStatus.succeeded
    ) {
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.settlement_skipped,
        {
          reason: "intent_terminal",
          status: intent.status,
          providerEventId: body.providerEventId,
        },
      );

      return this.toIntentResult(intent, "settlement_skipped", {
        settled: false,
        reason: "intent_terminal",
        message: "Online payment intent is already in a terminal state",
      });
    }

    const now = new Date();
    await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
      },
      data: {
        status: OnlinePaymentIntentStatus.succeeded,
        succeededAt: now,
        failureCode: null,
        failureMessage: null,
      },
    });

    const latestIntent = await this.loadIntentOrThrow(intent.id, tx);
    const settlement = await this.billsService.settleBillWithOnlinePayment(
      {
        billId: latestIntent.billId,
        onlinePaymentIntentId: latestIntent.id,
        provider: latestIntent.provider,
        providerIntentId: latestIntent.providerIntentId,
        providerEventId: body.providerEventId,
        amountMinor: latestIntent.amountMinor,
      },
      tx,
    );

    await this.createOnlinePaymentEvent(
      tx,
      latestIntent,
      settlement.settled
        ? OnlinePaymentEventType.settlement_completed
        : OnlinePaymentEventType.settlement_skipped,
      {
        reason: settlement.reason,
        message: settlement.message,
        providerEventId: body.providerEventId,
      },
    );
    await this.realtimeEventsService.recordOnlinePaymentSucceeded(
      latestIntent.id,
      tx,
    );

    return this.toIntentResult(
      await this.loadIntentOrThrow(intent.id, tx),
      settlement.settled ? "settled" : "settlement_skipped",
      settlement,
    );
  }

  private async applyMockStatusUpdate(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    body: MockOnlinePaymentWebhookDto,
  ) {
    const nextStatus = body.status as OnlinePaymentIntentStatus;
    const now = new Date();
    const data: Prisma.OnlinePaymentIntentUpdateManyMutationInput = {
      status: nextStatus,
      failureCode: body.failureCode ?? null,
      failureMessage: body.failureMessage ?? null,
    };

    if (nextStatus === OnlinePaymentIntentStatus.failed) {
      data.failedAt = now;
    } else if (nextStatus === OnlinePaymentIntentStatus.cancelled) {
      data.cancelledAt = now;
    } else if (nextStatus === OnlinePaymentIntentStatus.expired) {
      data.expiredAt = now;
    }

    await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
      },
      data,
    });
    const latestIntent = await this.loadIntentOrThrow(intent.id, tx);
    await this.createOnlinePaymentEvent(
      tx,
      latestIntent,
      OnlinePaymentEventType.status_updated,
      {
        status: nextStatus,
        providerEventId: body.providerEventId,
        failureCode: body.failureCode,
        failureMessage: body.failureMessage,
      },
    );

    if (
      nextStatus === OnlinePaymentIntentStatus.failed ||
      nextStatus === OnlinePaymentIntentStatus.cancelled ||
      nextStatus === OnlinePaymentIntentStatus.expired
    ) {
      await this.restoreBillPresentedIfNoActiveOnlinePayment(intent.billId, tx);
      await this.realtimeEventsService.recordOnlinePaymentFailed(intent.id, tx);
    }

    return this.toIntentResult(latestIntent, "status_updated");
  }

  private async restoreBillPresentedIfNoActiveOnlinePayment(
    billId: string,
    tx: Prisma.TransactionClient,
  ) {
    const activeIntentCount = await tx.onlinePaymentIntent.count({
      where: {
        billId,
        status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
      },
    });

    if (activeIntentCount > 0) {
      return;
    }

    await tx.bill.updateMany({
      where: {
        id: billId,
        status: BillStatus.payment_pending,
      },
      data: { status: BillStatus.presented },
    });
  }

  private async loadIntentOrThrow(intentId: string, tx: PrismaExecutor) {
    const intent = await tx.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    return intent;
  }

  private async createOnlinePaymentEvent(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    type: OnlinePaymentEventType,
    payload: Record<string, unknown> = {},
    providerEventId?: string | null,
  ) {
    await tx.onlinePaymentEvent.create({
      data: {
        onlinePaymentIntentId: intent.id,
        companyId: intent.companyId,
        branchId: intent.branchId,
        billId: intent.billId,
        provider: intent.provider,
        providerEventId: providerEventId ?? null,
        type,
        status: intent.status,
        amountMinor: intent.amountMinor,
        currency: intent.currency,
        payload: this.toJsonValue(payload),
      },
    });
  }

  private assertOnlinePaymentsEnabled() {
    if (this.configService.get<boolean>("onlinePayments.enabled") === false) {
      throw new BadRequestException("Online payments are not enabled");
    }
  }

  private assertMockProviderAllowed() {
    this.assertOnlinePaymentsEnabled();

    if (this.getConfiguredProvider() !== OnlinePaymentProvider.mock) {
      throw new BadRequestException(
        "Mock online payment provider is not active",
      );
    }

    if (
      this.configService.get<boolean>("onlinePayments.mockEnabled") === false
    ) {
      throw new ForbiddenException(
        "Mock online payment actions are disabled in this environment",
      );
    }
  }

  private assertBillCanStartOnlinePayment(bill: {
    status: BillStatus;
    balanceDueMinor: number;
  }) {
    if (
      bill.status !== BillStatus.presented &&
      bill.status !== BillStatus.payment_pending
    ) {
      if (
        bill.status === BillStatus.paid ||
        bill.status === BillStatus.closed
      ) {
        throw new BadRequestException("Bill is already paid");
      }

      throw new BadRequestException(
        "Only presented bills can start online payment",
      );
    }

    if (bill.balanceDueMinor <= 0) {
      throw new BadRequestException("Bill has no balance due");
    }
  }

  private getConfiguredProvider() {
    return this.configService.get<string>("onlinePayments.provider") ===
      OnlinePaymentProvider.external
      ? OnlinePaymentProvider.external
      : OnlinePaymentProvider.mock;
  }

  private buildMockCheckoutUrl(providerIntentId: string) {
    const baseUrl =
      this.configService.get<string>("onlinePayments.checkoutBaseUrl") ??
      "http://localhost:3001";
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

    return `${normalizedBaseUrl}/mock-payments/${providerIntentId}`;
  }

  private toIntentResult(
    intent: OnlinePaymentIntentRecord,
    outcome: string,
    settlement?: OnlinePaymentSettlementResult,
  ) {
    return {
      outcome,
      onlinePaymentIntent: this.toIntentSummary(intent),
      checkout: {
        provider: intent.provider,
        url: intent.providerCheckoutUrl,
        expiresAt: intent.checkoutExpiresAt,
        requiresHostedCheckout:
          intent.status === OnlinePaymentIntentStatus.pending ||
          intent.status === OnlinePaymentIntentStatus.requires_action,
      },
      settlement: settlement
        ? {
            settled: settlement.settled,
            reason: settlement.reason,
            message: settlement.message,
          }
        : undefined,
      bill: settlement?.billResponse ?? intent.bill ?? null,
    };
  }

  private toIntentSummary(intent: OnlinePaymentIntentRecord) {
    const { bill, tableSession, events, ...intentFields } = intent;

    return {
      ...intentFields,
      bill:
        bill === null || bill === undefined
          ? null
          : {
              id: bill.id,
              billNumber: bill.billNumber,
              status: bill.status,
              totalMinor: bill.totalMinor,
              paidMinor: bill.paidMinor,
              balanceDueMinor: bill.balanceDueMinor,
              currency: bill.currency,
            },
      tableSession:
        tableSession === null || tableSession === undefined
          ? null
          : {
              id: tableSession.id,
              status: tableSession.status,
              table: tableSession.table,
            },
      events,
    };
  }

  private statusWhere(
    status: NonNullable<BranchOnlinePaymentsQueryDto["status"]>,
  ): Prisma.OnlinePaymentIntentWhereInput {
    if (status === "all") {
      return {};
    }

    if (status === "active") {
      return { status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES } };
    }

    return { status: status as OnlinePaymentIntentStatus };
  }

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? DEFAULT_ONLINE_PAYMENT_LIMIT, 1), 100);
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalizedValue = value.trim();

    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private intentInclude() {
    return onlinePaymentIntentInclude;
  }
}
