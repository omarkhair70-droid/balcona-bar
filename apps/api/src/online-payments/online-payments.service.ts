import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
  Prisma,
  BillStatus,
  SaasFeatureKey,
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
import { SaasService } from "../saas/saas.service";
import { PaymobPaymentProviderService } from "./providers/paymob-payment-provider.service";
import {
  PaymentProviderError,
  ProviderTransactionState,
  VerifiedProviderTransactionWebhook,
} from "./providers/payment-provider.types";

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
    private readonly saasService: SaasService,
    private readonly paymobPaymentProviderService: PaymobPaymentProviderService,
  ) {}

  async createIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto = {},
  ) {
    this.assertOnlinePaymentsEnabled();
    const provider = this.getConfiguredProvider();
    this.assertConfiguredProviderAllowed(provider);

    if (provider === OnlinePaymentProvider.paymob) {
      return this.createPaymobIntentForCustomer(sessionId, billId, body);
    }

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

      await this.saasService.assertCompanyFeatureEnabled(
        bill.companyId,
        SaasFeatureKey.online_payments,
      );
      this.assertBillCanStartOnlinePayment(bill);
      await this.lockBillForOnlinePayment(tx, bill.id);

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
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: this.intentInclude(),
      });

      if (existingActiveIntent) {
        this.assertActiveIntentCompatibleWithBill(
          existingActiveIntent,
          bill,
          provider,
        );

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

  private async createPaymobIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto,
  ) {
    const billingData = body.billingData;

    if (!billingData) {
      throw new BadRequestException(
        "Billing data is required to prepare Paymob checkout",
      );
    }

    await this.recoverBeforePaymobRetry(sessionId, billId);

    const preparation = await this.prisma.$transaction(async (tx) => {
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

      await this.saasService.assertCompanyFeatureEnabled(
        bill.companyId,
        SaasFeatureKey.online_payments,
      );
      this.assertBillCanStartOnlinePayment(bill);
      await this.lockBillForOnlinePayment(tx, bill.id);

      if (body.idempotencyKey) {
        const idempotentIntent = await tx.onlinePaymentIntent.findUnique({
          where: { idempotencyKey: body.idempotencyKey },
          include: this.intentInclude(),
        });

        if (idempotentIntent) {
          if (
            idempotentIntent.billId !== bill.id ||
            idempotentIntent.tableSessionId !== sessionId ||
            idempotentIntent.provider !== OnlinePaymentProvider.paymob
          ) {
            throw new BadRequestException(
              "Idempotency key is already used for another online payment",
            );
          }

          return {
            kind: "existing" as const,
            result: this.toIntentResult(idempotentIntent, "idempotent"),
          };
        }
      }

      const existingActiveIntent = await tx.onlinePaymentIntent.findFirst({
        where: {
          billId: bill.id,
          tableSessionId: sessionId,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: this.intentInclude(),
      });

      if (existingActiveIntent) {
        this.assertActiveIntentCompatibleWithBill(
          existingActiveIntent,
          bill,
          OnlinePaymentProvider.paymob,
        );

        return {
          kind: "existing" as const,
          result: this.toIntentResult(
            existingActiveIntent,
            "existing_active",
          ),
        };
      }

      const localIntent = await tx.onlinePaymentIntent.create({
        data: {
          companyId: bill.companyId,
          branchId: bill.branchId,
          tableSessionId: sessionId,
          billId: bill.id,
          provider: OnlinePaymentProvider.paymob,
          providerIntentId: null,
          providerCheckoutUrl: null,
          idempotencyKey: body.idempotencyKey ?? `auto_${randomUUID()}`,
          status: OnlinePaymentIntentStatus.pending,
          amountMinor: bill.balanceDueMinor,
          currency: bill.currency,
          customerReturnUrl: this.normalizeOptionalText(body.customerReturnUrl),
          metadata: this.toJsonValue({
            source: "customer_pay_online",
            provider: "paymob",
            providerInitialization: "pending",
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
        localIntent,
        OnlinePaymentEventType.intent_created,
        {
          provider: "paymob",
          providerInitialization: "pending",
        },
      );
      await this.realtimeEventsService.recordOnlinePaymentIntentCreated(
        localIntent.id,
        tx,
      );

      return {
        kind: "created" as const,
        intent: localIntent,
      };
    });

    if (preparation.kind === "existing") {
      return preparation.result;
    }

    const localIntent = preparation.intent;

    try {
      const providerPayment =
        await this.paymobPaymentProviderService.createPayment({
          localIntentId: localIntent.id,
          companyId: localIntent.companyId,
          branchId: localIntent.branchId,
          billId: localIntent.billId,
          amountMinor: localIntent.amountMinor,
          currency: localIntent.currency,
          billingData,
          customerReturnUrl:
            this.normalizeOptionalText(body.customerReturnUrl) ?? undefined,
        });

      return this.prisma.$transaction(async (tx) => {
        await tx.onlinePaymentIntent.updateMany({
          where: {
            id: localIntent.id,
            provider: OnlinePaymentProvider.paymob,
            status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
            providerIntentId: null,
          },
          data: {
            providerIntentId: providerPayment.providerIntentId,
            providerOrderId: providerPayment.providerOrderId,
            providerCheckoutUrl: providerPayment.checkoutUrl,
            checkoutExpiresAt: providerPayment.checkoutExpiresAt,
            status: providerPayment.status,
            metadata: this.toJsonValue({
              ...this.jsonRecord(localIntent.metadata),
              ...providerPayment.metadata,
              providerInitialization: "ready",
            }),
          },
        });

        const readyIntent = await this.loadIntentOrThrow(localIntent.id, tx);

        if (!readyIntent.providerIntentId || !readyIntent.providerCheckoutUrl) {
          throw new ServiceUnavailableException(
            "Online payment checkout could not be prepared",
          );
        }

        await this.createOnlinePaymentEvent(
          tx,
          readyIntent,
          OnlinePaymentEventType.status_updated,
          {
            provider: "paymob",
            providerInitialization: "ready",
            providerIntentId: readyIntent.providerIntentId,
            providerOrderId: readyIntent.providerOrderId,
            checkoutExpiresAt: readyIntent.checkoutExpiresAt,
          },
        );

        return this.toIntentResult(readyIntent, "created");
      });
    } catch (error) {
      await this.markPaymobInitializationFailed(localIntent.id, error);
      throw this.mapPaymobProviderError(error);
    }
  }

  private async markPaymobInitializationFailed(
    intentId: string,
    error: unknown,
  ) {
    const providerCode =
      error instanceof PaymentProviderError ? error.code : "provider_unavailable";

    await this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentIntent.updateMany({
        where: {
          id: intentId,
          provider: OnlinePaymentProvider.paymob,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
          providerIntentId: null,
        },
        data: {
          status: OnlinePaymentIntentStatus.failed,
          failedAt: new Date(),
          failureCode: `paymob_${providerCode}`,
          failureMessage: "Paymob checkout initialization failed",
          metadata: this.toJsonValue({
            provider: "paymob",
            providerInitialization: "failed",
            providerErrorCode: providerCode,
          }),
        },
      });

      const failedIntent = await this.loadIntentOrThrow(intentId, tx);

      if (failedIntent.status === OnlinePaymentIntentStatus.failed) {
        await this.createOnlinePaymentEvent(
          tx,
          failedIntent,
          OnlinePaymentEventType.status_updated,
          {
            provider: "paymob",
            providerInitialization: "failed",
            providerErrorCode: providerCode,
          },
        );
        await this.restoreBillPresentedIfNoActiveOnlinePayment(
          failedIntent.billId,
          tx,
        );
        await this.realtimeEventsService.recordOnlinePaymentFailed(
          failedIntent.id,
          tx,
        );
      }
    });
  }

  private mapPaymobProviderError(error: unknown) {
    if (
      error instanceof PaymentProviderError &&
      error.code === "invalid_request"
    ) {
      return new BadRequestException("Online payment checkout request is invalid");
    }

    return new ServiceUnavailableException(
      "Online payment checkout is temporarily unavailable",
    );
  }

  private async recoverBeforePaymobRetry(
    sessionId: string,
    billId: string,
  ) {
    const latestIntent = await this.prisma.onlinePaymentIntent.findFirst({
      where: {
        billId,
        tableSessionId: sessionId,
        provider: OnlinePaymentProvider.paymob,
        providerOrderId: { not: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: this.intentInclude(),
    });

    if (!latestIntent || latestIntent.status === OnlinePaymentIntentStatus.succeeded) {
      return;
    }

    const terminalStatus = [
      OnlinePaymentIntentStatus.failed,
      OnlinePaymentIntentStatus.cancelled,
      OnlinePaymentIntentStatus.expired,
    ].includes(latestIntent.status);
    const activeCheckoutExpired =
      ACTIVE_ONLINE_PAYMENT_STATUSES.includes(latestIntent.status) &&
      Boolean(
        latestIntent.checkoutExpiresAt &&
          latestIntent.checkoutExpiresAt <= new Date(),
      );

    if (!terminalStatus && !activeCheckoutExpired) {
      return;
    }

    await this.recoverPaymobIntent(
      latestIntent.id,
      "customer_retry_preflight",
    );
  }

  async recoverPaymobIntent(
    intentId: string,
    source:
      | "customer_retry_preflight"
      | "scheduled_reconciliation"
      | "staff_manual" = "staff_manual",
  ) {
    this.assertOnlinePaymentsEnabled();

    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    if (intent.provider !== OnlinePaymentProvider.paymob) {
      throw new BadRequestException(
        "Provider inquiry is only available for Paymob intents",
      );
    }

    if (!intent.providerOrderId) {
      throw new BadRequestException(
        "Paymob intent does not have a provider order id",
      );
    }

    let inquiry;

    try {
      inquiry =
        await this.paymobPaymentProviderService.inquireTransactionByOrder(
          intent.providerOrderId,
        );
    } catch (error) {
      throw this.mapPaymobInquiryError(error);
    }

    if (!inquiry.found) {
      return this.handlePaymobInquiryNotFound(intent, source);
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.processPaymobInquiryState(
          tx,
          intent.id,
          inquiry.transaction,
          source,
        ),
      );
    } catch (error) {
      if (this.isProviderEventUniqueConstraintError(error)) {
        return this.paymobDuplicateProviderStateResult(
          inquiry.transaction.providerEventId,
          "duplicate_inquiry",
        );
      }

      throw error;
    }
  }

  async reconcilePendingPaymobIntents() {
    if (
      this.configService.get<boolean>(
        "onlinePayments.reconciliation.enabled",
        false,
      ) !== true
    ) {
      return {
        enabled: false,
        attempted: 0,
        recovered: 0,
        failed: 0,
      };
    }

    const staleSeconds = this.configService.get<number>(
      "onlinePayments.reconciliation.staleSeconds",
      120,
    );
    const batchSize = this.configService.get<number>(
      "onlinePayments.reconciliation.batchSize",
      25,
    );
    const staleBefore = new Date(Date.now() - staleSeconds * 1000);
    const intents = await this.prisma.onlinePaymentIntent.findMany({
      where: {
        provider: OnlinePaymentProvider.paymob,
        providerOrderId: { not: null },
        status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        updatedAt: { lte: staleBefore },
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });

    let recovered = 0;
    let failed = 0;
    const failures: Array<{ intentId: string; code: string }> = [];

    for (const candidate of intents) {
      try {
        await this.recoverPaymobIntent(
          candidate.id,
          "scheduled_reconciliation",
        );
        recovered += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          intentId: candidate.id,
          code:
            error instanceof PaymentProviderError
              ? error.code
              : error instanceof Error
                ? error.name
                : "unknown_error",
        });
      }
    }

    return {
      enabled: true,
      attempted: intents.length,
      recovered,
      failed,
      failures,
    };
  }

  private async processPaymobInquiryState(
    tx: Prisma.TransactionClient,
    intentId: string,
    state: ProviderTransactionState,
    source: string,
  ) {
    const existingEvent = await tx.onlinePaymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: OnlinePaymentProvider.paymob,
          providerEventId: state.providerEventId,
        },
      },
      select: { onlinePaymentIntentId: true },
    });

    if (existingEvent) {
      const duplicateIntent = await this.loadIntentOrThrow(
        existingEvent.onlinePaymentIntentId,
        tx,
      );

      return this.toIntentResult(duplicateIntent, "duplicate_inquiry", {
        settled: false,
        reason: "duplicate_inquiry",
        message: "Paymob inquiry state was already processed",
      });
    }

    const intent = await this.loadIntentOrThrow(intentId, tx);

    if (intent.providerOrderId !== state.providerOrderId) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        state,
        "provider_order_mismatch",
        {
          inquiryProviderOrderId: state.providerOrderId,
          localProviderOrderId: intent.providerOrderId,
          source,
        },
      );
    }

    await this.createOnlinePaymentEvent(
      tx,
      intent,
      OnlinePaymentEventType.provider_inquiry_received,
      {
        source,
        inquiryStatus: state.status,
        providerTransactionId: state.providerTransactionId,
        providerOrderId: state.providerOrderId,
        integrationId: state.integrationId,
        actionable: state.actionable,
        ...state.safeMetadata,
      },
      state.providerEventId,
    );

    if (state.merchantReference && state.merchantReference !== intent.id) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        state,
        "merchant_reference_mismatch",
        {
          inquiryMerchantReference: state.merchantReference,
          localIntentId: intent.id,
          source,
        },
      );
    }

    if (state.amountMinor !== intent.amountMinor) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        state,
        "amount_mismatch",
        {
          inquiryAmountMinor: state.amountMinor,
          intentAmountMinor: intent.amountMinor,
          source,
        },
      );
    }

    if (state.currency !== intent.currency) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        state,
        "currency_mismatch",
        {
          inquiryCurrency: state.currency,
          intentCurrency: intent.currency,
          source,
        },
      );
    }

    if (!state.actionable) {
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.status_updated,
        {
          reason: "inquiry_transaction_deferred",
          source,
          providerTransactionId: state.providerTransactionId,
          providerEventId: state.providerEventId,
          inquiryStatus: state.status,
        },
      );

      return this.toIntentResult(intent, "inquiry_transaction_deferred", {
        settled: false,
        reason: "inquiry_transaction_deferred",
        message:
          "Paymob inquiry returned a child/refund transaction deferred to PAY-5",
      });
    }

    if (state.status === OnlinePaymentIntentStatus.succeeded) {
      return this.applyPaymobSuccess(tx, intent, state);
    }

    return this.applyPaymobStatusUpdate(tx, intent, state, {
      allowTerminalRecovery: true,
      source,
    });
  }

  private async handlePaymobInquiryNotFound(
    intent: OnlinePaymentIntentRecord,
    source: string,
  ) {
    const checkoutExpired =
      Boolean(intent.checkoutExpiresAt) &&
      intent.checkoutExpiresAt! <= new Date();

    if (
      !checkoutExpired ||
      !ACTIVE_ONLINE_PAYMENT_STATUSES.includes(intent.status)
    ) {
      return this.toIntentResult(intent, "provider_transaction_not_found", {
        settled: false,
        reason: "provider_transaction_not_found",
        message: "Paymob has no transaction for this provider order",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const update = await tx.onlinePaymentIntent.updateMany({
        where: {
          id: intent.id,
          provider: OnlinePaymentProvider.paymob,
          providerOrderId: intent.providerOrderId,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        },
        data: {
          status: OnlinePaymentIntentStatus.expired,
          expiredAt: now,
          failedAt: null,
          cancelledAt: null,
          failureCode: "paymob_checkout_expired_without_transaction",
          failureMessage:
            "Paymob checkout expired without a provider transaction",
        },
      });

      const latest = await this.loadIntentOrThrow(intent.id, tx);

      if (update.count === 1) {
        await this.createOnlinePaymentEvent(
          tx,
          latest,
          OnlinePaymentEventType.status_updated,
          {
            reason: "provider_transaction_not_found_after_checkout_expiry",
            source,
          },
        );
        await this.restoreBillPresentedIfNoActiveOnlinePayment(
          latest.billId,
          tx,
        );
        await this.realtimeEventsService.recordOnlinePaymentFailed(
          latest.id,
          tx,
        );
      }

      return this.toIntentResult(
        latest,
        update.count === 1 ? "expired" : "state_unchanged",
      );
    });
  }

  private mapPaymobInquiryError(error: unknown) {
    if (!(error instanceof PaymentProviderError)) {
      return new ServiceUnavailableException(
        "Paymob transaction inquiry is temporarily unavailable",
      );
    }

    if (error.code === "invalid_request") {
      return new BadRequestException("Paymob transaction inquiry is invalid");
    }

    return new ServiceUnavailableException(
      "Paymob transaction inquiry is temporarily unavailable",
    );
  }

  async processPaymobWebhook(receivedHmac: string, obj: unknown) {
    this.assertOnlinePaymentsEnabled();

    let verified: VerifiedProviderTransactionWebhook;

    try {
      verified =
        this.paymobPaymentProviderService.verifyTransactionWebhook(
          obj,
          receivedHmac,
        );
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.code === "signature_invalid"
      ) {
        throw new UnauthorizedException("Invalid Paymob webhook signature");
      }

      if (
        error instanceof PaymentProviderError &&
        error.code === "missing_config"
      ) {
        throw new ServiceUnavailableException(
          "Paymob webhook verification is not configured",
        );
      }

      throw new BadRequestException("Invalid Paymob transaction callback");
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.processVerifiedPaymobWebhook(tx, verified),
      );
    } catch (error) {
      if (this.isProviderEventUniqueConstraintError(error)) {
        return this.paymobDuplicateProviderStateResult(
          verified.providerEventId,
          "duplicate_event",
        );
      }

      throw error;
    }
  }

  private async processVerifiedPaymobWebhook(
    tx: Prisma.TransactionClient,
    verified: VerifiedProviderTransactionWebhook,
  ) {
    const existingEvent = await tx.onlinePaymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: OnlinePaymentProvider.paymob,
          providerEventId: verified.providerEventId,
        },
      },
      select: { onlinePaymentIntentId: true },
    });

    if (existingEvent) {
      const duplicateIntent = await this.loadIntentOrThrow(
        existingEvent.onlinePaymentIntentId,
        tx,
      );

      return this.toIntentResult(duplicateIntent, "duplicate_event", {
        settled: false,
        reason: "duplicate_event",
        message: "Paymob webhook event was already processed",
      });
    }

    const intent = await tx.onlinePaymentIntent.findUnique({
      where: {
        provider_providerOrderId: {
          provider: OnlinePaymentProvider.paymob,
          providerOrderId: verified.providerOrderId,
        },
      },
      include: this.intentInclude(),
    });

    if (!intent) {
      return {
        received: true,
        outcome: "unmatched_provider_order",
        provider: OnlinePaymentProvider.paymob,
        providerTransactionId: verified.providerTransactionId,
        providerOrderId: verified.providerOrderId,
        settlement: {
          settled: false,
          reason: "unmatched_provider_order",
          message: "Verified Paymob order is not linked to a local payment intent",
        },
      };
    }

    await this.createOnlinePaymentEvent(
      tx,
      intent,
      OnlinePaymentEventType.provider_webhook_received,
      {
        callbackStatus: verified.status,
        providerTransactionId: verified.providerTransactionId,
        providerOrderId: verified.providerOrderId,
        integrationId: verified.integrationId,
        actionable: verified.actionable,
        ...verified.safeMetadata,
      },
      verified.providerEventId,
    );

    if (
      verified.merchantReference &&
      verified.merchantReference !== intent.id
    ) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        verified,
        "merchant_reference_mismatch",
        {
          callbackMerchantReference: verified.merchantReference,
          localIntentId: intent.id,
        },
      );
    }

    if (verified.amountMinor !== intent.amountMinor) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        verified,
        "amount_mismatch",
        {
          callbackAmountMinor: verified.amountMinor,
          intentAmountMinor: intent.amountMinor,
        },
      );
    }

    if (verified.currency !== intent.currency) {
      return this.skipPaymobSettlement(
        tx,
        intent,
        verified,
        "currency_mismatch",
        {
          callbackCurrency: verified.currency,
          intentCurrency: intent.currency,
        },
      );
    }

    if (!verified.actionable) {
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.status_updated,
        {
          reason: "child_transaction_ignored",
          providerTransactionId: verified.providerTransactionId,
          providerEventId: verified.providerEventId,
          callbackStatus: verified.status,
        },
      );

      return this.toIntentResult(intent, "child_transaction_ignored", {
        settled: false,
        reason: "child_transaction_ignored",
        message:
          "Paymob child transactions are deferred to capture/refund processing",
      });
    }

    if (verified.status === OnlinePaymentIntentStatus.succeeded) {
      return this.applyPaymobSuccess(tx, intent, verified);
    }

    return this.applyPaymobStatusUpdate(tx, intent, verified);
  }

  private async applyPaymobSuccess(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    verified: VerifiedProviderTransactionWebhook,
  ) {
    if (intent.status === OnlinePaymentIntentStatus.succeeded) {
      return this.toIntentResult(intent, "already_succeeded", {
        settled: false,
        reason: "already_succeeded",
        message: "Paymob payment was already settled",
      });
    }

    const now = new Date();
    const updateResult = await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        provider: OnlinePaymentProvider.paymob,
        providerOrderId: verified.providerOrderId,
        status: { not: OnlinePaymentIntentStatus.succeeded },
      },
      data: {
        status: OnlinePaymentIntentStatus.succeeded,
        succeededAt: now,
        failedAt: null,
        cancelledAt: null,
        expiredAt: null,
        failureCode: null,
        failureMessage: null,
        metadata: this.toJsonValue({
          ...this.jsonRecord(intent.metadata),
          paymobTransactionId: verified.providerTransactionId,
          paymobLastVerifiedEventId: verified.providerEventId,
          ...verified.safeMetadata,
        }),
      },
    });

    if (updateResult.count !== 1) {
      const latestIntent = await this.loadIntentOrThrow(intent.id, tx);
      return this.toIntentResult(latestIntent, "settlement_skipped", {
        settled: false,
        reason: "concurrent_state_change",
        message: "Payment intent state changed before settlement",
      });
    }

    const latestIntent = await this.loadIntentOrThrow(intent.id, tx);
    const settlement = await this.billsService.settleBillWithOnlinePayment(
      {
        billId: latestIntent.billId,
        onlinePaymentIntentId: latestIntent.id,
        provider: latestIntent.provider,
        providerIntentId: latestIntent.providerIntentId,
        providerEventId: verified.providerEventId,
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
        providerTransactionId: verified.providerTransactionId,
        providerEventId: verified.providerEventId,
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

  private async applyPaymobStatusUpdate(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    verified: ProviderTransactionState,
    options: {
      allowTerminalRecovery?: boolean;
      source?: string;
    } = {},
  ) {
    if (!ACTIVE_ONLINE_PAYMENT_STATUSES.includes(intent.status)) {
      if (
        options.allowTerminalRecovery &&
        ACTIVE_ONLINE_PAYMENT_STATUSES.includes(verified.status)
      ) {
        const competingActive = await tx.onlinePaymentIntent.findFirst({
          where: {
            billId: intent.billId,
            id: { not: intent.id },
            status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
          },
          select: { id: true },
        });

        if (competingActive) {
          await this.createOnlinePaymentEvent(
            tx,
            intent,
            OnlinePaymentEventType.status_updated,
            {
              reason: "recovery_conflict_with_active_intent",
              source: options.source,
              competingIntentId: competingActive.id,
              providerTransactionId: verified.providerTransactionId,
              providerEventId: verified.providerEventId,
            },
          );

          return this.toIntentResult(intent, "recovery_conflict", {
            settled: false,
            reason: "recovery_conflict",
            message:
              "Provider state is still active but another local payment intent is already active",
          });
        }

        const recovered = await tx.onlinePaymentIntent.updateMany({
          where: {
            id: intent.id,
            provider: OnlinePaymentProvider.paymob,
            providerOrderId: verified.providerOrderId,
            status: { not: OnlinePaymentIntentStatus.succeeded },
          },
          data: {
            status: verified.status,
            failedAt: null,
            cancelledAt: null,
            expiredAt: null,
            failureCode: null,
            failureMessage: null,
            metadata: this.toJsonValue({
              ...this.jsonRecord(intent.metadata),
              paymobTransactionId: verified.providerTransactionId,
              paymobLastVerifiedEventId: verified.providerEventId,
              ...verified.safeMetadata,
            }),
          },
        });

        const latest = await this.loadIntentOrThrow(intent.id, tx);

        if (recovered.count === 1) {
          await tx.bill.updateMany({
            where: {
              id: intent.billId,
              status: BillStatus.presented,
              balanceDueMinor: intent.amountMinor,
            },
            data: { status: BillStatus.payment_pending },
          });
          await this.createOnlinePaymentEvent(
            tx,
            latest,
            OnlinePaymentEventType.status_updated,
            {
              reason: "terminal_state_recovered_from_provider_inquiry",
              source: options.source,
              inquiryStatus: verified.status,
              providerTransactionId: verified.providerTransactionId,
              providerEventId: verified.providerEventId,
            },
          );
        }

        return this.toIntentResult(
          latest,
          recovered.count === 1 ? "status_recovered" : "state_unchanged",
        );
      }
      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.status_updated,
        {
          reason: "terminal_state_preserved",
          currentStatus: intent.status,
          callbackStatus: verified.status,
          providerTransactionId: verified.providerTransactionId,
        },
      );

      return this.toIntentResult(intent, "terminal_state_preserved");
    }

    const now = new Date();
    const data: Prisma.OnlinePaymentIntentUpdateManyMutationInput = {
      status: verified.status,
      metadata: this.toJsonValue({
        ...this.jsonRecord(intent.metadata),
        paymobTransactionId: verified.providerTransactionId,
        paymobLastVerifiedEventId: verified.providerEventId,
        ...verified.safeMetadata,
      }),
    };

    if (verified.status === OnlinePaymentIntentStatus.failed) {
      data.failedAt = now;
      data.failureCode = "paymob_transaction_failed";
      data.failureMessage = "Paymob transaction failed";
    } else if (verified.status === OnlinePaymentIntentStatus.cancelled) {
      data.cancelledAt = now;
      data.failureCode = "paymob_transaction_cancelled";
      data.failureMessage = "Paymob transaction was cancelled or voided";
    }

    const updateResult = await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        provider: OnlinePaymentProvider.paymob,
        providerOrderId: verified.providerOrderId,
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
        callbackStatus: verified.status,
        providerTransactionId: verified.providerTransactionId,
        providerEventId: verified.providerEventId,
        changed: updateResult.count === 1,
      },
    );

    if (
      updateResult.count === 1 &&
      (verified.status === OnlinePaymentIntentStatus.failed ||
        verified.status === OnlinePaymentIntentStatus.cancelled)
    ) {
      await this.restoreBillPresentedIfNoActiveOnlinePayment(intent.billId, tx);
      await this.realtimeEventsService.recordOnlinePaymentFailed(intent.id, tx);
    }

    return this.toIntentResult(
      latestIntent,
      updateResult.count === 1 ? "status_updated" : "state_unchanged",
    );
  }

  private async skipPaymobSettlement(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    verified: VerifiedProviderTransactionWebhook,
    reason: string,
    details: Record<string, unknown> = {},
  ) {
    await this.createOnlinePaymentEvent(
      tx,
      intent,
      OnlinePaymentEventType.settlement_skipped,
      {
        reason,
        providerTransactionId: verified.providerTransactionId,
        providerEventId: verified.providerEventId,
        ...details,
      },
    );

    return this.toIntentResult(intent, "settlement_skipped", {
      settled: false,
      reason,
      message: "Verified Paymob callback did not pass settlement guards",
    });
  }

  private async paymobDuplicateProviderStateResult(
    providerEventId: string,
    outcome = "duplicate_event",
  ) {
    const event = await this.prisma.onlinePaymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: OnlinePaymentProvider.paymob,
          providerEventId,
        },
      },
      select: { onlinePaymentIntentId: true },
    });

    if (!event) {
      throw new ServiceUnavailableException(
        "Paymob webhook could not be processed idempotently",
      );
    }

    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: event.onlinePaymentIntentId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new ServiceUnavailableException(
        "Paymob webhook intent could not be reloaded",
      );
    }

    return this.toIntentResult(intent, outcome, {
      settled: false,
      reason: outcome,
      message: "Paymob provider state was already processed",
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

  private isProviderEventUniqueConstraintError(error: unknown) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      return false;
    }

    const target = error.meta?.target;

    return (
      Array.isArray(target) &&
      target.some(
        (value) =>
          value === "providerEventId" ||
          String(value).includes("providerEventId"),
      )
    );
  }

  private assertActiveIntentCompatibleWithBill(
    intent: {
      provider: OnlinePaymentProvider;
      amountMinor: number;
      currency: string;
    },
    bill: {
      balanceDueMinor: number;
      currency: string;
    },
    expectedProvider: OnlinePaymentProvider,
  ) {
    if (intent.provider !== expectedProvider) {
      throw new ConflictException(
        "Bill already has an active online payment with another provider",
      );
    }

    if (
      intent.amountMinor !== bill.balanceDueMinor ||
      intent.currency !== bill.currency
    ) {
      throw new ConflictException(
        "Bill amount or currency changed while an online payment is active",
      );
    }
  }

  private async lockBillForOnlinePayment(
    tx: Prisma.TransactionClient,
    billId: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`online-payment:${billId}`}, 0)
      )
    `;
  }

  private assertConfiguredProviderAllowed(provider: OnlinePaymentProvider) {
    if (
      this.configService.get<string>("app.environment") === "production" &&
      provider === OnlinePaymentProvider.mock
    ) {
      throw new ServiceUnavailableException(
        "Mock online payments are forbidden in production",
      );
    }
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
    const provider = this.configService.get<string>("onlinePayments.provider");

    if (provider === OnlinePaymentProvider.paymob) {
      return OnlinePaymentProvider.paymob;
    }

    if (provider === OnlinePaymentProvider.external) {
      return OnlinePaymentProvider.external;
    }

    return OnlinePaymentProvider.mock;
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

  private jsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return {};
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private intentInclude() {
    return onlinePaymentIntentInclude;
  }
}
