import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  AuditActorType,
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
  Prisma,
  BillStatus,
  SaasFeatureKey,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import {
  BillsService,
  OnlinePaymentSettlementResult,
} from "../bills/bills.service";
import { BranchOnlinePaymentsQueryDto } from "./dto/branch-online-payments-query.dto";
import { CreateOnlinePaymentIntentDto } from "./dto/create-online-payment-intent.dto";
import { MockOnlinePaymentWebhookDto } from "./dto/mock-online-payment-webhook.dto";
import {
  CaptureOnlinePaymentDto,
  RefundOnlinePaymentDto,
  VoidOnlinePaymentDto,
} from "./dto/post-payment-operation.dto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeEventsService } from "../realtime-events/realtime-events.service";
import { SaasService } from "../saas/saas.service";
import { FawryPaymentProviderService } from "./providers/fawry-payment-provider.service";
import { MerchantPaymentIntegrationsService } from "./merchant-payment-integrations.service";
import { PaymobPaymentProviderService } from "./providers/paymob-payment-provider.service";
import {
  PaymentProviderError,
  ProviderCustomerAction,
  ProviderRuntimeContext,
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
  operations: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      provider: true,
      type: true,
      status: true,
      parentProviderTransactionId: true,
      providerTransactionId: true,
      amountMinor: true,
      currency: true,
      reason: true,
      requestedAt: true,
      completedAt: true,
      failedAt: true,
      failureCode: true,
      failureMessage: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.OnlinePaymentIntentInclude;

type OnlinePaymentIntentRecord = Prisma.OnlinePaymentIntentGetPayload<{
  include: typeof onlinePaymentIntentInclude;
}>;

const onlinePaymentOperationInclude = {
  onlinePaymentIntent: {
    include: onlinePaymentIntentInclude,
  },
} satisfies Prisma.OnlinePaymentOperationInclude;

type OnlinePaymentOperationRecord = Prisma.OnlinePaymentOperationGetPayload<{
  include: typeof onlinePaymentOperationInclude;
}>;

@Injectable()
export class OnlinePaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly billsService: BillsService,
    private readonly realtimeEventsService: RealtimeEventsService,
    private readonly saasService: SaasService,
    private readonly auditService: AuditService,
    private readonly paymobPaymentProviderService: PaymobPaymentProviderService,
    private readonly fawryPaymentProviderService: FawryPaymentProviderService,
    @Optional()
    private readonly merchantPaymentIntegrationsService?: MerchantPaymentIntegrationsService,
  ) {}

  async createIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto = {},
  ) {
    this.assertOnlinePaymentsEnabled();
    const paymentScope = this.merchantPaymentIntegrationsService
      ? await this.prisma.bill.findUnique({
          where: { id: billId },
          select: {
            companyId: true,
            branchId: true,
            tableSessionId: true,
          },
        })
      : null;

    if (
      this.merchantPaymentIntegrationsService &&
      (!paymentScope || paymentScope.tableSessionId !== sessionId)
    ) {
      throw new NotFoundException("Bill not found for this table session");
    }

    const merchantIntegration =
      this.merchantPaymentIntegrationsService && paymentScope
        ? await this.merchantPaymentIntegrationsService.resolveForScope(
            paymentScope.companyId,
            paymentScope.branchId,
            true,
          )
        : null;
    const runtimeContext = merchantIntegration?.id
      ? {
          integrationId: merchantIntegration.id,
          environment: merchantIntegration.environment,
          merchantAccountReference:
            merchantIntegration.merchantAccountReference,
          enabledChannels: merchantIntegration.enabledChannels,
          configurationMetadata: merchantIntegration.configurationMetadata,
          secretReferences: merchantIntegration.secretReferences,
        }
      : undefined;
    const provider =
      merchantIntegration?.provider ?? this.getConfiguredProvider();
    this.assertConfiguredProviderAllowed(provider);

    if (provider === OnlinePaymentProvider.paymob) {
      return this.createPaymobIntentForCustomer(
        sessionId,
        billId,
        body,
        merchantIntegration?.id ?? null,
        runtimeContext,
      );
    }

    if (provider === OnlinePaymentProvider.fawry) {
      return this.createFawryIntentForCustomer(
        sessionId,
        billId,
        body,
        merchantIntegration?.id ?? null,
        runtimeContext,
      );
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
          merchantPaymentIntegrationId: merchantIntegration?.id ?? null,
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

  private async createFawryIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto,
    merchantPaymentIntegrationId: string | null,
    runtimeContext?: ProviderRuntimeContext,
  ) {
    const billingData = body.billingData;

    if (!billingData) {
      throw new BadRequestException(
        "Billing data is required to prepare Fawry checkout",
      );
    }

    await this.recoverBeforeFawryRetry(sessionId, billId);

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
            idempotentIntent.provider !== OnlinePaymentProvider.fawry
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
          OnlinePaymentProvider.fawry,
        );

        return {
          kind: "existing" as const,
          result: this.toIntentResult(existingActiveIntent, "existing_active"),
        };
      }

      const localIntentId = randomUUID();
      const localIntent = await tx.onlinePaymentIntent.create({
        data: {
          id: localIntentId,
          companyId: bill.companyId,
          branchId: bill.branchId,
          tableSessionId: sessionId,
          billId: bill.id,
          provider: OnlinePaymentProvider.fawry,
          merchantPaymentIntegrationId,
          providerIntentId: null,
          providerOrderId: localIntentId,
          providerCheckoutUrl: null,
          idempotencyKey: body.idempotencyKey ?? `auto_${randomUUID()}`,
          status: OnlinePaymentIntentStatus.pending,
          amountMinor: bill.balanceDueMinor,
          currency: bill.currency,
          customerReturnUrl: this.normalizeOptionalText(body.customerReturnUrl),
          metadata: this.toJsonValue({
            source: "customer_pay_online",
            provider: "fawry",
            providerInitialization: "pending",
            fawryMerchantRefNumber: localIntentId,
            fawryPaymentMethod: body.fawryPaymentMethod ?? "ALL_HOSTED",
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
          provider: "fawry",
          providerInitialization: "pending",
          merchantRefNumber: localIntentId,
          paymentMethod: body.fawryPaymentMethod ?? "ALL_HOSTED",
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
        await this.fawryPaymentProviderService.createPayment(
          {
            localIntentId: localIntent.id,
            companyId: localIntent.companyId,
            branchId: localIntent.branchId,
            billId: localIntent.billId,
            amountMinor: localIntent.amountMinor,
            currency: localIntent.currency,
            billingData,
            customerReturnUrl:
              this.normalizeOptionalText(body.customerReturnUrl) ?? undefined,
            ...(runtimeContext ? { runtimeContext } : {}),
          },
          body.fawryPaymentMethod,
        );

      return this.prisma.$transaction(async (tx) => {
        await tx.onlinePaymentIntent.updateMany({
          where: {
            id: localIntent.id,
            provider: OnlinePaymentProvider.fawry,
            providerOrderId: localIntent.id,
            status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
            providerIntentId: null,
          },
          data: {
            providerIntentId: providerPayment.providerIntentId,
            providerCheckoutUrl: providerPayment.checkoutUrl,
            checkoutExpiresAt: providerPayment.checkoutExpiresAt,
            status: providerPayment.status,
            metadata: this.toJsonValue({
              ...this.jsonRecord(localIntent.metadata),
              ...providerPayment.metadata,
              ...(providerPayment.customerAction
                ? { providerCustomerAction: providerPayment.customerAction }
                : {}),
              providerInitialization: "ready",
            }),
          },
        });

        const readyIntent = await this.loadIntentOrThrow(localIntent.id, tx);

        if (!readyIntent.providerIntentId || !readyIntent.providerCheckoutUrl) {
          throw new ServiceUnavailableException(
            "Fawry checkout could not be prepared",
          );
        }

        await this.createOnlinePaymentEvent(
          tx,
          readyIntent,
          OnlinePaymentEventType.status_updated,
          {
            provider: "fawry",
            providerInitialization: "ready",
            providerIntentId: readyIntent.providerIntentId,
            providerOrderId: readyIntent.providerOrderId,
            checkoutExpiresAt: readyIntent.checkoutExpiresAt,
          },
        );

        return this.toIntentResult(readyIntent, "created");
      });
    } catch (error) {
      await this.markFawryInitializationFailed(localIntent.id, error);
      throw this.mapFawryProviderError(error);
    }
  }

  private async markFawryInitializationFailed(
    intentId: string,
    error: unknown,
  ) {
    const providerCode =
      error instanceof PaymentProviderError
        ? error.code
        : "provider_unavailable";

    await this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentIntent.updateMany({
        where: {
          id: intentId,
          provider: OnlinePaymentProvider.fawry,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
          providerIntentId: null,
        },
        data: {
          status: OnlinePaymentIntentStatus.failed,
          failedAt: new Date(),
          failureCode: `fawry_${providerCode}`,
          failureMessage: "Fawry checkout initialization failed",
          metadata: this.toJsonValue({
            provider: "fawry",
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
            provider: "fawry",
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

  private mapFawryProviderError(error: unknown) {
    if (
      error instanceof PaymentProviderError &&
      (error.code === "invalid_request" ||
        error.code === "unsupported_operation")
    ) {
      return new BadRequestException("Fawry checkout request is invalid");
    }

    return new ServiceUnavailableException(
      "Fawry checkout is temporarily unavailable",
    );
  }

  private async recoverBeforeFawryRetry(sessionId: string, billId: string) {
    const latestIntent = await this.prisma.onlinePaymentIntent.findFirst({
      where: {
        billId,
        tableSessionId: sessionId,
        provider: OnlinePaymentProvider.fawry,
        providerOrderId: { not: null },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: this.intentInclude(),
    });

    if (
      !latestIntent ||
      latestIntent.status === OnlinePaymentIntentStatus.succeeded
    ) {
      return;
    }

    const terminalStatuses: OnlinePaymentIntentStatus[] = [
      OnlinePaymentIntentStatus.failed,
      OnlinePaymentIntentStatus.cancelled,
      OnlinePaymentIntentStatus.expired,
    ];
    const terminalStatus = terminalStatuses.includes(latestIntent.status);
    const activeCheckoutExpired =
      ACTIVE_ONLINE_PAYMENT_STATUSES.includes(latestIntent.status) &&
      Boolean(
        latestIntent.checkoutExpiresAt &&
        latestIntent.checkoutExpiresAt <= new Date(),
      );

    if (!terminalStatus && !activeCheckoutExpired) {
      return;
    }

    await this.recoverFawryIntent(latestIntent.id, "customer_retry_preflight");
  }

  async recoverFawryIntent(
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

    if (intent.provider !== OnlinePaymentProvider.fawry) {
      throw new BadRequestException(
        "Provider inquiry is only available for Fawry intents",
      );
    }

    if (!intent.providerOrderId) {
      throw new BadRequestException(
        "Fawry intent does not have a merchant reference",
      );
    }

    let inquiry;
    const runtimeContext = await this.runtimeContextForIntent(
      intent.id,
      OnlinePaymentProvider.fawry,
    );

    try {
      inquiry = runtimeContext
        ? await this.fawryPaymentProviderService.inquireByMerchantReference(
            intent.providerOrderId,
            runtimeContext,
          )
        : await this.fawryPaymentProviderService.inquireByMerchantReference(
            intent.providerOrderId,
          );
    } catch (error) {
      throw this.mapFawryInquiryError(error);
    }

    if (!inquiry.found) {
      return this.handleFawryInquiryNotFound(intent, source);
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.processFawryState(
          tx,
          inquiry.transaction,
          OnlinePaymentEventType.provider_inquiry_received,
          source,
          true,
        ),
      );
    } catch (error) {
      if (this.isProviderEventUniqueConstraintError(error)) {
        return this.fawryDuplicateProviderStateResult(
          inquiry.transaction.providerEventId,
          "duplicate_inquiry",
        );
      }

      throw error;
    }
  }

  async processFawryWebhook(value: unknown) {
    let verified: ProviderTransactionState;
    const providerOrderId = this.untrustedFawryProviderOrderId(value);
    const runtimeContext =
      providerOrderId && this.merchantPaymentIntegrationsService
        ? await this.merchantPaymentIntegrationsService.runtimeContextForProviderOrder(
            OnlinePaymentProvider.fawry,
            providerOrderId,
          )
        : undefined;

    this.assertWebhookMerchantContext(runtimeContext, providerOrderId);

    try {
      verified = runtimeContext
        ? this.fawryPaymentProviderService.verifyNotification(
            value,
            runtimeContext,
          )
        : this.fawryPaymentProviderService.verifyNotification(value);
    } catch (error) {
      if (
        error instanceof PaymentProviderError &&
        error.code === "signature_invalid"
      ) {
        throw new UnauthorizedException(
          "Fawry notification signature is invalid",
        );
      }

      if (error instanceof PaymentProviderError) {
        throw new BadRequestException("Fawry notification payload is invalid");
      }

      throw error;
    }

    try {
      return await this.prisma.$transaction((tx) =>
        this.processFawryState(
          tx,
          verified,
          OnlinePaymentEventType.provider_webhook_received,
          "webhook",
          false,
        ),
      );
    } catch (error) {
      if (this.isProviderEventUniqueConstraintError(error)) {
        return this.fawryDuplicateProviderStateResult(
          verified.providerEventId,
          "duplicate_event",
        );
      }

      throw error;
    }
  }

  private async processFawryState(
    tx: Prisma.TransactionClient,
    verified: ProviderTransactionState,
    eventType: OnlinePaymentEventType,
    source: string,
    allowTerminalRecovery: boolean,
  ) {
    const existingEvent = await tx.onlinePaymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: OnlinePaymentProvider.fawry,
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

      return this.toIntentResult(
        duplicateIntent,
        eventType === OnlinePaymentEventType.provider_inquiry_received
          ? "duplicate_inquiry"
          : "duplicate_event",
        {
          settled: false,
          reason: "duplicate_provider_state",
          message: "Fawry provider state was already processed",
        },
      );
    }

    const intent = await tx.onlinePaymentIntent.findUnique({
      where: {
        provider_providerOrderId: {
          provider: OnlinePaymentProvider.fawry,
          providerOrderId: verified.providerOrderId,
        },
      },
      include: this.intentInclude(),
    });

    if (!intent) {
      return {
        received: true,
        outcome: "unmatched_provider_order",
        provider: OnlinePaymentProvider.fawry,
        providerTransactionId: verified.providerTransactionId,
        providerOrderId: verified.providerOrderId,
        settlement: {
          settled: false,
          reason: "unmatched_provider_order",
          message:
            "Verified Fawry merchant reference is not linked to a local payment intent",
        },
      };
    }

    await this.createOnlinePaymentEvent(
      tx,
      intent,
      eventType,
      {
        source,
        providerStatus: verified.status,
        providerTransactionId: verified.providerTransactionId,
        providerOrderId: verified.providerOrderId,
        actionable: verified.actionable,
        ...verified.safeMetadata,
      },
      verified.providerEventId,
    );

    if (
      verified.merchantReference &&
      verified.merchantReference !== intent.providerOrderId
    ) {
      return this.skipFawrySettlement(
        tx,
        intent,
        verified,
        "merchant_reference_mismatch",
        { source },
      );
    }

    if (verified.amountMinor !== intent.amountMinor) {
      return this.skipFawrySettlement(tx, intent, verified, "amount_mismatch", {
        source,
        providerAmountMinor: verified.amountMinor,
        intentAmountMinor: intent.amountMinor,
      });
    }

    if (verified.currency !== intent.currency) {
      return this.skipFawrySettlement(
        tx,
        intent,
        verified,
        "currency_mismatch",
        {
          source,
          providerCurrency: verified.currency,
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
          reason: "fawry_adjustment_state_observed",
          source,
          providerTransactionId: verified.providerTransactionId,
          providerEventId: verified.providerEventId,
          providerStatus: verified.safeMetadata.orderStatus,
        },
      );

      return this.toIntentResult(intent, "provider_adjustment_observed", {
        settled: false,
        reason: "provider_adjustment_observed",
        message:
          "Fawry reported a refund adjustment; the original sale state is preserved",
      });
    }

    if (verified.status === OnlinePaymentIntentStatus.succeeded) {
      return this.applyFawrySuccess(tx, intent, verified);
    }

    return this.applyFawryStatusUpdate(tx, intent, verified, {
      allowTerminalRecovery,
      source,
    });
  }

  private async applyFawrySuccess(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    verified: ProviderTransactionState,
  ) {
    if (intent.status === OnlinePaymentIntentStatus.succeeded) {
      return this.toIntentResult(intent, "already_succeeded", {
        settled: false,
        reason: "already_succeeded",
        message: "Fawry payment was already settled",
      });
    }

    const now = new Date();
    const updateResult = await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        provider: OnlinePaymentProvider.fawry,
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
          fawryRefNumber: verified.providerTransactionId,
          fawryLastVerifiedEventId: verified.providerEventId,
          ...verified.safeMetadata,
        }),
      },
    });

    if (updateResult.count !== 1) {
      const latestIntent = await this.loadIntentOrThrow(intent.id, tx);
      return this.toIntentResult(latestIntent, "settlement_skipped", {
        settled: false,
        reason: "concurrent_state_change",
        message: "Payment intent state changed before Fawry settlement",
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
        providerTransactionId: verified.providerTransactionId,
        providerEventId: verified.providerEventId,
      },
    );

    if (settlement.settled) {
      await this.realtimeEventsService.recordOnlinePaymentSucceeded(
        latestIntent.id,
        tx,
      );
    }

    const finalIntent = await this.loadIntentOrThrow(intent.id, tx);

    return this.toIntentResult(
      finalIntent,
      settlement.settled ? "succeeded" : "succeeded_without_new_settlement",
      settlement,
    );
  }

  private async applyFawryStatusUpdate(
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
            },
          );

          return this.toIntentResult(intent, "recovery_conflict", {
            settled: false,
            reason: "recovery_conflict",
            message:
              "Fawry state is still active but another local payment intent is already active",
          });
        }

        await tx.onlinePaymentIntent.updateMany({
          where: {
            id: intent.id,
            provider: OnlinePaymentProvider.fawry,
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
              fawryRefNumber: verified.providerTransactionId,
              fawryLastVerifiedEventId: verified.providerEventId,
              ...verified.safeMetadata,
            }),
          },
        });

        await tx.bill.updateMany({
          where: {
            id: intent.billId,
            status: BillStatus.presented,
            balanceDueMinor: intent.amountMinor,
          },
          data: { status: BillStatus.payment_pending },
        });

        const latest = await this.loadIntentOrThrow(intent.id, tx);
        await this.createOnlinePaymentEvent(
          tx,
          latest,
          OnlinePaymentEventType.status_updated,
          {
            reason: "terminal_state_recovered_from_provider_inquiry",
            source: options.source,
            providerStatus: verified.status,
          },
        );

        return this.toIntentResult(latest, "status_recovered");
      }

      return this.toIntentResult(intent, "terminal_state_preserved");
    }

    const now = new Date();
    const data: Prisma.OnlinePaymentIntentUpdateManyMutationInput = {
      status: verified.status,
      metadata: this.toJsonValue({
        ...this.jsonRecord(intent.metadata),
        fawryRefNumber: verified.providerTransactionId,
        fawryLastVerifiedEventId: verified.providerEventId,
        ...verified.safeMetadata,
      }),
    };

    if (verified.status === OnlinePaymentIntentStatus.failed) {
      data.failedAt = now;
      data.failureCode = "fawry_transaction_failed";
      data.failureMessage = "Fawry transaction failed";
    } else if (verified.status === OnlinePaymentIntentStatus.cancelled) {
      data.cancelledAt = now;
      data.failureCode = "fawry_transaction_cancelled";
      data.failureMessage = "Fawry transaction was cancelled";
    } else if (verified.status === OnlinePaymentIntentStatus.expired) {
      data.expiredAt = now;
      data.failureCode = "fawry_transaction_expired";
      data.failureMessage = "Fawry transaction expired";
    }

    const updateResult = await tx.onlinePaymentIntent.updateMany({
      where: {
        id: intent.id,
        provider: OnlinePaymentProvider.fawry,
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
        source: options.source,
        providerStatus: verified.status,
        providerTransactionId: verified.providerTransactionId,
        changed: updateResult.count === 1,
      },
    );

    if (
      updateResult.count === 1 &&
      (verified.status === OnlinePaymentIntentStatus.failed ||
        verified.status === OnlinePaymentIntentStatus.cancelled ||
        verified.status === OnlinePaymentIntentStatus.expired)
    ) {
      await this.restoreBillPresentedIfNoActiveOnlinePayment(intent.billId, tx);
      await this.realtimeEventsService.recordOnlinePaymentFailed(intent.id, tx);
    }

    return this.toIntentResult(
      latestIntent,
      updateResult.count === 1 ? "status_updated" : "state_unchanged",
    );
  }

  private async handleFawryInquiryNotFound(
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
        message: "Fawry has no transaction for this merchant reference",
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentIntent.updateMany({
        where: {
          id: intent.id,
          provider: OnlinePaymentProvider.fawry,
          providerOrderId: intent.providerOrderId,
          status: { in: ACTIVE_ONLINE_PAYMENT_STATUSES },
        },
        data: {
          status: OnlinePaymentIntentStatus.expired,
          expiredAt: new Date(),
          failedAt: null,
          cancelledAt: null,
          failureCode: "fawry_checkout_expired_without_transaction",
          failureMessage:
            "Fawry checkout expired without a provider transaction",
        },
      });

      const latest = await this.loadIntentOrThrow(intent.id, tx);
      await this.restoreBillPresentedIfNoActiveOnlinePayment(latest.billId, tx);
      await this.realtimeEventsService.recordOnlinePaymentFailed(latest.id, tx);
      await this.createOnlinePaymentEvent(
        tx,
        latest,
        OnlinePaymentEventType.status_updated,
        {
          reason: "provider_transaction_not_found_after_checkout_expiry",
          source,
        },
      );

      return this.toIntentResult(latest, "expired");
    });
  }

  private mapFawryInquiryError(error: unknown) {
    if (
      error instanceof PaymentProviderError &&
      error.code === "invalid_request"
    ) {
      return new BadRequestException("Fawry status inquiry is invalid");
    }

    return new ServiceUnavailableException(
      "Fawry payment status inquiry is temporarily unavailable",
    );
  }

  private async skipFawrySettlement(
    tx: Prisma.TransactionClient,
    intent: OnlinePaymentIntentRecord,
    verified: ProviderTransactionState,
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
      message: "Verified Fawry state did not pass settlement guards",
    });
  }

  private async fawryDuplicateProviderStateResult(
    providerEventId: string,
    outcome = "duplicate_event",
  ) {
    const event = await this.prisma.onlinePaymentEvent.findUnique({
      where: {
        provider_providerEventId: {
          provider: OnlinePaymentProvider.fawry,
          providerEventId,
        },
      },
      select: { onlinePaymentIntentId: true },
    });

    if (!event) {
      throw new ServiceUnavailableException(
        "Fawry provider state could not be processed idempotently",
      );
    }

    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: event.onlinePaymentIntentId },
      include: this.intentInclude(),
    });

    if (!intent) {
      throw new ServiceUnavailableException(
        "Fawry provider-state intent could not be reloaded",
      );
    }

    return this.toIntentResult(intent, outcome, {
      settled: false,
      reason: outcome,
      message: "Fawry provider state was already processed",
    });
  }

  async recoverProviderIntent(
    intentId: string,
    source: "staff_manual" | "scheduled_reconciliation" = "staff_manual",
  ) {
    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      select: { provider: true },
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    if (intent.provider === OnlinePaymentProvider.paymob) {
      return this.recoverPaymobIntent(intentId, source);
    }

    if (intent.provider === OnlinePaymentProvider.fawry) {
      return this.recoverFawryIntent(intentId, source);
    }

    throw new BadRequestException(
      "Provider inquiry is not available for this payment provider",
    );
  }

  private async createPaymobIntentForCustomer(
    sessionId: string,
    billId: string,
    body: CreateOnlinePaymentIntentDto,
    merchantPaymentIntegrationId: string | null,
    runtimeContext?: ProviderRuntimeContext,
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
          result: this.toIntentResult(existingActiveIntent, "existing_active"),
        };
      }

      const localIntent = await tx.onlinePaymentIntent.create({
        data: {
          companyId: bill.companyId,
          branchId: bill.branchId,
          tableSessionId: sessionId,
          billId: bill.id,
          provider: OnlinePaymentProvider.paymob,
          merchantPaymentIntegrationId,
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
          ...(runtimeContext ? { runtimeContext } : {}),
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
              ...(providerPayment.customerAction
                ? { providerCustomerAction: providerPayment.customerAction }
                : {}),
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
      error instanceof PaymentProviderError
        ? error.code
        : "provider_unavailable";

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
      return new BadRequestException(
        "Online payment checkout request is invalid",
      );
    }

    return new ServiceUnavailableException(
      "Online payment checkout is temporarily unavailable",
    );
  }

  private async recoverBeforePaymobRetry(sessionId: string, billId: string) {
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

    if (
      !latestIntent ||
      latestIntent.status === OnlinePaymentIntentStatus.succeeded
    ) {
      return;
    }

    const terminalStatuses: OnlinePaymentIntentStatus[] = [
      OnlinePaymentIntentStatus.failed,
      OnlinePaymentIntentStatus.cancelled,
      OnlinePaymentIntentStatus.expired,
    ];
    const terminalStatus = terminalStatuses.includes(latestIntent.status);
    const activeCheckoutExpired =
      ACTIVE_ONLINE_PAYMENT_STATUSES.includes(latestIntent.status) &&
      Boolean(
        latestIntent.checkoutExpiresAt &&
        latestIntent.checkoutExpiresAt <= new Date(),
      );

    if (!terminalStatus && !activeCheckoutExpired) {
      return;
    }

    await this.recoverPaymobIntent(latestIntent.id, "customer_retry_preflight");
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
    const runtimeContext = await this.runtimeContextForIntent(
      intent.id,
      OnlinePaymentProvider.paymob,
    );

    try {
      inquiry = runtimeContext
        ? await this.paymobPaymentProviderService.inquireTransactionByOrder(
            intent.providerOrderId,
            runtimeContext,
          )
        : await this.paymobPaymentProviderService.inquireTransactionByOrder(
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

  async reconcilePendingPaymobOperations() {
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
    const operations = await this.prisma.onlinePaymentOperation.findMany({
      where: {
        provider: OnlinePaymentProvider.paymob,
        status: OnlinePaymentOperationStatus.pending,
        updatedAt: { lte: staleBefore },
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });

    let recovered = 0;
    let failed = 0;
    const failures: Array<{ operationId: string; code: string }> = [];

    for (const operation of operations) {
      try {
        await this.recoverPaymobOperation(
          operation.id,
          "scheduled_reconciliation",
        );
        recovered += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          operationId: operation.id,
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
      attempted: operations.length,
      recovered,
      failed,
      failures,
    };
  }

  async reconcilePendingFawryOperations() {
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
    const operations = await this.prisma.onlinePaymentOperation.findMany({
      where: {
        provider: OnlinePaymentProvider.fawry,
        type: OnlinePaymentOperationType.refund,
        status: OnlinePaymentOperationStatus.pending,
        updatedAt: { lte: staleBefore },
        metadata: {
          path: ["fawryRefundRecovery"],
          equals: "full_total_provable",
        },
      },
      orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
      take: batchSize,
      select: { id: true },
    });

    let recovered = 0;
    let failed = 0;
    const failures: Array<{ operationId: string; code: string }> = [];

    for (const operation of operations) {
      try {
        await this.recoverFawryRefundOperation(
          operation.id,
          "scheduled_reconciliation",
        );
        recovered += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          operationId: operation.id,
          code: error instanceof Error ? error.name : "unknown_error",
        });
      }
    }

    return {
      enabled: true,
      attempted: operations.length,
      recovered,
      failed,
      failures,
    };
  }

  async reconcilePendingFawryIntents() {
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
        provider: OnlinePaymentProvider.fawry,
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
        await this.recoverFawryIntent(candidate.id, "scheduled_reconciliation");
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
      return this.skipPaymobSettlement(tx, intent, state, "amount_mismatch", {
        inquiryAmountMinor: state.amountMinor,
        intentAmountMinor: intent.amountMinor,
        source,
      });
    }

    if (state.currency !== intent.currency) {
      return this.skipPaymobSettlement(tx, intent, state, "currency_mismatch", {
        inquiryCurrency: state.currency,
        intentCurrency: intent.currency,
        source,
      });
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

  async refundProviderIntent(
    intentId: string,
    staffUserId: string,
    body: RefundOnlinePaymentDto,
  ) {
    const intent = await this.prisma.onlinePaymentIntent.findUnique({
      where: { id: intentId },
      select: { provider: true },
    });

    if (!intent) {
      throw new NotFoundException("Online payment intent not found");
    }

    if (intent.provider === OnlinePaymentProvider.paymob) {
      return this.refundPaymobIntent(intentId, staffUserId, body);
    }

    if (intent.provider === OnlinePaymentProvider.fawry) {
      return this.refundFawryIntent(intentId, staffUserId, body);
    }

    throw new BadRequestException(
      "Refund is not available for this payment provider",
    );
  }

  private async refundFawryIntent(
    intentId: string,
    staffUserId: string,
    body: RefundOnlinePaymentDto,
  ) {
    this.assertOnlinePaymentsEnabled();

    const preparation = await this.prisma.$transaction(async (tx) => {
      const intent = await this.loadIntentOrThrow(intentId, tx);

      if (intent.provider !== OnlinePaymentProvider.fawry) {
        throw new BadRequestException(
          "Fawry refund requires a Fawry payment intent",
        );
      }

      if (intent.status !== OnlinePaymentIntentStatus.succeeded) {
        throw new BadRequestException(
          "Only a succeeded Fawry payment can be refunded",
        );
      }

      await this.lockOnlinePaymentOperation(tx, intent.id);

      const existingByKey = await tx.onlinePaymentOperation.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
        include: onlinePaymentOperationInclude,
      });

      if (existingByKey) {
        if (
          existingByKey.onlinePaymentIntentId !== intent.id ||
          existingByKey.type !== OnlinePaymentOperationType.refund ||
          existingByKey.amountMinor !== body.amountMinor
        ) {
          throw new ConflictException(
            "Idempotency key is already used for another payment operation",
          );
        }

        return {
          kind: "existing" as const,
          operation: existingByKey,
        };
      }

      const pendingOperation = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          status: OnlinePaymentOperationStatus.pending,
        },
        include: onlinePaymentOperationInclude,
      });

      if (pendingOperation) {
        throw new ConflictException(
          "Another payment operation is still awaiting provider confirmation",
        );
      }

      const metadata = this.jsonRecord(intent.metadata);
      const fawryRefNumber =
        typeof metadata.fawryRefNumber === "string"
          ? metadata.fawryRefNumber
          : null;

      if (!fawryRefNumber) {
        throw new ConflictException(
          "Fawry transaction truth is missing. Recover the payment before refunding it.",
        );
      }

      const previousRefunds = await tx.onlinePaymentOperation.findMany({
        where: {
          onlinePaymentIntentId: intent.id,
          type: OnlinePaymentOperationType.refund,
          status: OnlinePaymentOperationStatus.succeeded,
        },
        select: { amountMinor: true },
      });
      const refundedMinor = previousRefunds.reduce(
        (sum, operation) => sum + operation.amountMinor,
        0,
      );
      const refundableMinor = intent.amountMinor - refundedMinor;

      if (
        !Number.isSafeInteger(body.amountMinor) ||
        body.amountMinor <= 0 ||
        body.amountMinor > refundableMinor
      ) {
        throw new BadRequestException(
          "Refund amount exceeds the remaining refundable amount",
        );
      }

      const operation = await tx.onlinePaymentOperation.create({
        data: {
          onlinePaymentIntentId: intent.id,
          companyId: intent.companyId,
          branchId: intent.branchId,
          billId: intent.billId,
          provider: OnlinePaymentProvider.fawry,
          type: OnlinePaymentOperationType.refund,
          status: OnlinePaymentOperationStatus.pending,
          idempotencyKey: body.idempotencyKey,
          parentProviderTransactionId: fawryRefNumber,
          amountMinor: body.amountMinor,
          currency: intent.currency,
          reason: this.normalizeOptionalText(body.reason),
          requestedByStaffUserId: staffUserId,
          metadata: this.toJsonValue({
            source: "staff_post_payment_operation",
            previousRefundedMinor: refundedMinor,
            expectedRefundedMinor: refundedMinor + body.amountMinor,
            fawryRefundRecovery:
              refundedMinor + body.amountMinor === intent.amountMinor
                ? "full_total_provable"
                : "partial_exact_amount_requires_direct_response",
          }),
        },
        include: onlinePaymentOperationInclude,
      });

      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.provider_operation_requested,
        {
          operationId: operation.id,
          operationType: OnlinePaymentOperationType.refund,
          provider: OnlinePaymentProvider.fawry,
          amountMinor: operation.amountMinor,
          currency: operation.currency,
          parentProviderTransactionId: fawryRefNumber,
          requestedByStaffUserId: staffUserId,
        },
      );

      return {
        kind: "created" as const,
        operation,
      };
    });

    if (preparation.kind === "existing") {
      return this.toOperationResult(preparation.operation, "idempotent");
    }

    try {
      const runtimeContext = await this.runtimeContextForIntent(
        preparation.operation.onlinePaymentIntentId,
        OnlinePaymentProvider.fawry,
      );
      const refundInput = {
        referenceNumber: preparation.operation.parentProviderTransactionId,
        amountMinor: preparation.operation.amountMinor,
        reason: preparation.operation.reason ?? undefined,
      };
      const providerResult = runtimeContext
        ? await this.fawryPaymentProviderService.refundPayment(
            refundInput,
            runtimeContext,
          )
        : await this.fawryPaymentProviderService.refundPayment(refundInput);

      return this.finalizeFawryRefundOperation(
        preparation.operation.id,
        "direct_refund_response",
        {
          statusCode: providerResult.statusCode,
          statusDescription: providerResult.statusDescription,
        },
      );
    } catch (error) {
      if (this.isAmbiguousFawryRefundError(error)) {
        await this.markFawryRefundUncertain(preparation.operation.id, error);

        throw new ServiceUnavailableException(
          "Fawry refund outcome is uncertain and must be recovered before another refund",
        );
      }

      await this.failFawryRefundOperation(preparation.operation.id, error);

      if (
        error instanceof PaymentProviderError &&
        (error.code === "invalid_request" ||
          error.code === "provider_declined" ||
          error.code === "transaction_not_found")
      ) {
        throw new BadRequestException(
          "Fawry rejected the refund for the current payment state",
        );
      }

      throw new ServiceUnavailableException(
        "Fawry refund is temporarily unavailable",
      );
    }
  }

  refundPaymobIntent(
    intentId: string,
    staffUserId: string,
    body: RefundOnlinePaymentDto,
  ) {
    return this.executePaymobOperation(
      intentId,
      staffUserId,
      OnlinePaymentOperationType.refund,
      body.amountMinor,
      body.idempotencyKey,
      body.reason,
    );
  }

  voidPaymobIntent(
    intentId: string,
    staffUserId: string,
    body: VoidOnlinePaymentDto,
  ) {
    return this.executePaymobOperation(
      intentId,
      staffUserId,
      OnlinePaymentOperationType.void,
      undefined,
      body.idempotencyKey,
      body.reason,
    );
  }

  capturePaymobIntent(
    intentId: string,
    staffUserId: string,
    body: CaptureOnlinePaymentDto,
  ) {
    return this.executePaymobOperation(
      intentId,
      staffUserId,
      OnlinePaymentOperationType.capture,
      body.amountMinor,
      body.idempotencyKey,
      body.reason,
    );
  }

  async recoverProviderOperation(
    operationId: string,
    source:
      | "staff_manual"
      | "scheduled_reconciliation"
      | "child_webhook" = "staff_manual",
  ) {
    const operation = await this.prisma.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      select: { provider: true },
    });

    if (!operation) {
      throw new NotFoundException("Online payment operation not found");
    }

    if (operation.provider === OnlinePaymentProvider.paymob) {
      return this.recoverPaymobOperation(operationId, source);
    }

    if (operation.provider === OnlinePaymentProvider.fawry) {
      return this.recoverFawryRefundOperation(operationId, source);
    }

    throw new BadRequestException(
      "Provider operation recovery is not available for this provider",
    );
  }

  private async recoverFawryRefundOperation(
    operationId: string,
    source: "staff_manual" | "scheduled_reconciliation" | "child_webhook",
  ) {
    this.assertOnlinePaymentsEnabled();

    const operation = await this.prisma.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      include: onlinePaymentOperationInclude,
    });

    if (!operation) {
      throw new NotFoundException("Online payment operation not found");
    }

    if (
      operation.provider !== OnlinePaymentProvider.fawry ||
      operation.type !== OnlinePaymentOperationType.refund
    ) {
      throw new BadRequestException(
        "Fawry operation recovery currently supports refunds only",
      );
    }

    if (operation.status !== OnlinePaymentOperationStatus.pending) {
      return this.toOperationResult(operation, "already_terminal");
    }

    const merchantRefNumber = operation.onlinePaymentIntent.providerOrderId;

    if (!merchantRefNumber) {
      throw new ServiceUnavailableException(
        "Fawry merchant reference is missing for refund recovery",
      );
    }

    let inquiry;
    const runtimeContext = await this.runtimeContextForIntent(
      operation.onlinePaymentIntentId,
      OnlinePaymentProvider.fawry,
    );

    try {
      inquiry = runtimeContext
        ? await this.fawryPaymentProviderService.inquireByMerchantReference(
            merchantRefNumber,
            runtimeContext,
          )
        : await this.fawryPaymentProviderService.inquireByMerchantReference(
            merchantRefNumber,
          );
    } catch {
      throw new ServiceUnavailableException(
        "Fawry refund recovery is temporarily unavailable",
      );
    }

    if (!inquiry.found) {
      throw new ServiceUnavailableException(
        "Fawry refund recovery could not find the original transaction",
      );
    }

    const metadata = this.jsonRecord(operation.metadata);
    const expectedRefundedMinor = Number(
      metadata.expectedRefundedMinor ?? operation.amountMinor,
    );
    const fullTotalProvable =
      Number.isSafeInteger(expectedRefundedMinor) &&
      expectedRefundedMinor === operation.onlinePaymentIntent.amountMinor &&
      inquiry.transaction.safeMetadata.refunded === true;

    if (!fullTotalProvable) {
      return this.toOperationResult(operation, "provider_confirmation_pending");
    }

    return this.finalizeFawryRefundOperation(operation.id, source, {
      providerStatus: inquiry.transaction.safeMetadata.orderStatus,
      fawryRefNumber: inquiry.transaction.providerTransactionId,
    });
  }

  async recoverPaymobOperation(
    operationId: string,
    source:
      | "staff_manual"
      | "scheduled_reconciliation"
      | "child_webhook" = "staff_manual",
  ) {
    this.assertOnlinePaymentsEnabled();

    const operation = await this.prisma.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      include: onlinePaymentOperationInclude,
    });

    if (!operation) {
      throw new NotFoundException("Online payment operation not found");
    }

    if (operation.provider !== OnlinePaymentProvider.paymob) {
      throw new BadRequestException(
        "Provider operation recovery is only available for Paymob",
      );
    }

    if (operation.status !== OnlinePaymentOperationStatus.pending) {
      return this.toOperationResult(operation, "already_terminal");
    }

    return this.verifyAndFinalizePaymobOperation(operation, source);
  }

  private async executePaymobOperation(
    intentId: string,
    staffUserId: string,
    type: OnlinePaymentOperationType,
    requestedAmountMinor: number | undefined,
    idempotencyKey: string,
    reason?: string,
  ) {
    this.assertOnlinePaymentsEnabled();

    const preparation = await this.prisma.$transaction(async (tx) => {
      const intent = await this.loadIntentOrThrow(intentId, tx);

      if (intent.provider !== OnlinePaymentProvider.paymob) {
        throw new BadRequestException(
          "Refund, void and capture are currently available only for Paymob payments",
        );
      }

      await this.lockOnlinePaymentOperation(tx, intent.id);

      const existingByKey = await tx.onlinePaymentOperation.findUnique({
        where: { idempotencyKey },
        include: onlinePaymentOperationInclude,
      });

      if (existingByKey) {
        if (
          existingByKey.onlinePaymentIntentId !== intent.id ||
          existingByKey.type !== type ||
          (requestedAmountMinor !== undefined &&
            existingByKey.amountMinor !== requestedAmountMinor)
        ) {
          throw new ConflictException(
            "Idempotency key is already used for another payment operation",
          );
        }

        return {
          kind: "existing" as const,
          operation: existingByKey,
        };
      }

      const pendingOperation = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          status: OnlinePaymentOperationStatus.pending,
        },
        include: onlinePaymentOperationInclude,
      });

      if (pendingOperation) {
        throw new ConflictException(
          "Another payment operation is still awaiting provider confirmation",
        );
      }

      const targetProviderTransactionId =
        await this.resolvePaymobOperationTargetTransactionId(intent, tx);

      if (!targetProviderTransactionId) {
        throw new ConflictException(
          "Paymob transaction truth is missing. Recover the payment before starting a financial operation.",
        );
      }

      const previousRefunds = await tx.onlinePaymentOperation.findMany({
        where: {
          onlinePaymentIntentId: intent.id,
          type: OnlinePaymentOperationType.refund,
          status: OnlinePaymentOperationStatus.succeeded,
        },
        select: { amountMinor: true },
      });
      const refundedMinor = previousRefunds.reduce(
        (sum, operation) => sum + operation.amountMinor,
        0,
      );
      const successfulVoid = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          type: OnlinePaymentOperationType.void,
          status: OnlinePaymentOperationStatus.succeeded,
        },
        select: { id: true },
      });
      const successfulCapture = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          type: OnlinePaymentOperationType.capture,
          status: OnlinePaymentOperationStatus.succeeded,
        },
        select: { id: true, amountMinor: true },
      });

      let amountMinor = requestedAmountMinor ?? intent.amountMinor;

      if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
        throw new BadRequestException(
          "Payment operation amount must be a positive integer",
        );
      }

      if (type === OnlinePaymentOperationType.refund) {
        if (intent.status !== OnlinePaymentIntentStatus.succeeded) {
          throw new BadRequestException(
            "Only a succeeded online payment can be refunded",
          );
        }

        if (successfulVoid) {
          throw new ConflictException(
            "A voided payment cannot also be refunded",
          );
        }

        const refundableMinor = intent.amountMinor - refundedMinor;

        if (amountMinor > refundableMinor) {
          throw new BadRequestException(
            "Refund amount exceeds the remaining refundable amount",
          );
        }
      } else if (type === OnlinePaymentOperationType.void) {
        if (
          intent.status !== OnlinePaymentIntentStatus.succeeded &&
          intent.status !== OnlinePaymentIntentStatus.requires_action
        ) {
          throw new BadRequestException(
            "Only an authorized or succeeded Paymob payment can be voided",
          );
        }

        if (refundedMinor > 0 || successfulVoid) {
          throw new ConflictException(
            "A refunded or already voided payment cannot be voided again",
          );
        }

        amountMinor = intent.amountMinor;
      } else {
        if (intent.status !== OnlinePaymentIntentStatus.requires_action) {
          throw new BadRequestException(
            "Capture is only available for an authorization-only Paymob payment",
          );
        }

        if (successfulVoid || successfulCapture) {
          throw new ConflictException(
            "Authorization is already voided or captured",
          );
        }

        if (amountMinor !== intent.amountMinor) {
          throw new BadRequestException(
            "Balcona currently requires full capture to preserve full-bill settlement integrity",
          );
        }
      }

      const operation = await tx.onlinePaymentOperation.create({
        data: {
          onlinePaymentIntentId: intent.id,
          companyId: intent.companyId,
          branchId: intent.branchId,
          billId: intent.billId,
          provider: OnlinePaymentProvider.paymob,
          type,
          status: OnlinePaymentOperationStatus.pending,
          idempotencyKey,
          parentProviderTransactionId: targetProviderTransactionId,
          amountMinor,
          currency: intent.currency,
          reason: this.normalizeOptionalText(reason),
          requestedByStaffUserId: staffUserId,
          metadata: this.toJsonValue({
            source: "staff_post_payment_operation",
            previousRefundedMinor: refundedMinor,
            expectedRefundedMinor:
              type === OnlinePaymentOperationType.refund
                ? refundedMinor + amountMinor
                : undefined,
          }),
        },
        include: onlinePaymentOperationInclude,
      });

      await this.createOnlinePaymentEvent(
        tx,
        intent,
        OnlinePaymentEventType.provider_operation_requested,
        {
          operationId: operation.id,
          operationType: type,
          amountMinor,
          currency: intent.currency,
          parentProviderTransactionId: targetProviderTransactionId,
          requestedByStaffUserId: staffUserId,
        },
      );

      return {
        kind: "created" as const,
        operation,
      };
    });

    if (preparation.kind === "existing") {
      return this.toOperationResult(preparation.operation, "idempotent");
    }

    let parentState: ProviderTransactionState;
    const runtimeContext = await this.runtimeContextForIntent(
      preparation.operation.onlinePaymentIntentId,
      OnlinePaymentProvider.paymob,
    );

    try {
      parentState = runtimeContext
        ? await this.paymobPaymentProviderService.inquireTransactionById(
            preparation.operation.parentProviderTransactionId,
            runtimeContext,
          )
        : await this.paymobPaymentProviderService.inquireTransactionById(
            preparation.operation.parentProviderTransactionId,
          );
      this.assertPaymobOperationParentEligible(
        preparation.operation,
        parentState,
      );
    } catch (error) {
      await this.failPaymobOperationBeforeMutation(
        preparation.operation.id,
        error,
        "provider_preflight_failed",
      );
      throw this.mapPaymobOperationError(error);
    }

    let providerResult;

    try {
      const providerInput = {
        parentProviderTransactionId:
          preparation.operation.parentProviderTransactionId,
        amountMinor: preparation.operation.amountMinor,
        expectedCurrency: preparation.operation.currency,
      };

      if (preparation.operation.type === OnlinePaymentOperationType.refund) {
        providerResult = runtimeContext
          ? await this.paymobPaymentProviderService.refundTransaction(
              providerInput,
              runtimeContext,
            )
          : await this.paymobPaymentProviderService.refundTransaction(
              providerInput,
            );
      } else if (
        preparation.operation.type === OnlinePaymentOperationType.void
      ) {
        providerResult = runtimeContext
          ? await this.paymobPaymentProviderService.voidTransaction(
              providerInput,
              runtimeContext,
            )
          : await this.paymobPaymentProviderService.voidTransaction(
              providerInput,
            );
      } else {
        providerResult = runtimeContext
          ? await this.paymobPaymentProviderService.captureTransaction(
              providerInput,
              runtimeContext,
            )
          : await this.paymobPaymentProviderService.captureTransaction(
              providerInput,
            );
      }
    } catch (error) {
      if (this.isAmbiguousProviderMutationError(error)) {
        await this.markPaymobOperationUncertain(
          preparation.operation.id,
          error,
        );
        throw new ServiceUnavailableException(
          "Paymob operation outcome is uncertain and must be recovered before another financial operation",
        );
      }

      await this.failPaymobOperationBeforeMutation(
        preparation.operation.id,
        error,
        "provider_request_rejected",
      );
      throw this.mapPaymobOperationError(error);
    }

    const updatedOperation = await this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentOperation.updateMany({
        where: {
          id: preparation.operation.id,
          status: OnlinePaymentOperationStatus.pending,
        },
        data: {
          providerTransactionId: providerResult.providerTransactionId,
          metadata: this.toJsonValue({
            ...this.jsonRecord(preparation.operation.metadata),
            providerRequestState: providerResult.status,
            providerResponse: providerResult.safeMetadata,
          }),
        },
      });

      return this.loadOperationOrThrow(preparation.operation.id, tx);
    });

    if (providerResult.status === OnlinePaymentOperationStatus.failed) {
      return this.failPaymobOperationBeforeMutation(
        updatedOperation.id,
        new PaymentProviderError(
          `Paymob ${updatedOperation.type} was declined`,
          "provider_declined",
        ),
        "provider_declined",
      );
    }

    try {
      return await this.verifyAndFinalizePaymobOperation(
        updatedOperation,
        "provider_response",
      );
    } catch (error) {
      if (this.isAmbiguousProviderMutationError(error)) {
        await this.markPaymobOperationUncertain(updatedOperation.id, error);
        throw new ServiceUnavailableException(
          "Paymob operation is pending authoritative provider confirmation",
        );
      }

      throw this.mapPaymobOperationError(error);
    }
  }

  private async resolvePaymobOperationTargetTransactionId(
    intent: OnlinePaymentIntentRecord,
    tx: Prisma.TransactionClient,
  ) {
    const latestCapture = await tx.onlinePaymentOperation.findFirst({
      where: {
        onlinePaymentIntentId: intent.id,
        type: OnlinePaymentOperationType.capture,
        status: OnlinePaymentOperationStatus.succeeded,
        providerTransactionId: { not: null },
      },
      orderBy: [{ completedAt: "desc" }, { id: "desc" }],
      select: { providerTransactionId: true },
    });

    if (latestCapture?.providerTransactionId) {
      return latestCapture.providerTransactionId;
    }

    const metadata = this.jsonRecord(intent.metadata);
    return typeof metadata.paymobTransactionId === "string"
      ? metadata.paymobTransactionId
      : null;
  }

  private assertPaymobOperationParentEligible(
    operation: OnlinePaymentOperationRecord,
    state: ProviderTransactionState,
  ) {
    if (state.providerTransactionId !== operation.parentProviderTransactionId) {
      throw new PaymentProviderError(
        "Paymob operation target transaction changed",
        "invalid_response",
      );
    }

    if (state.currency !== operation.currency) {
      throw new PaymentProviderError(
        "Paymob operation target currency does not match",
        "currency_mismatch",
      );
    }

    const sourceType = this.stringMetadata(state.safeMetadata, "sourceType");

    if (
      (operation.type === OnlinePaymentOperationType.void ||
        operation.type === OnlinePaymentOperationType.capture) &&
      sourceType !== "card"
    ) {
      throw new PaymentProviderError(
        `Paymob ${operation.type} is supported only for card transactions`,
        "unsupported_operation",
      );
    }

    if (
      operation.type === OnlinePaymentOperationType.refund &&
      state.status !== OnlinePaymentIntentStatus.succeeded
    ) {
      throw new PaymentProviderError(
        "Paymob transaction is not currently refundable",
        "unsupported_operation",
      );
    }

    if (
      operation.type === OnlinePaymentOperationType.capture &&
      state.status !== OnlinePaymentIntentStatus.requires_action
    ) {
      throw new PaymentProviderError(
        "Paymob transaction is not currently awaiting capture",
        "unsupported_operation",
      );
    }

    if (
      operation.type === OnlinePaymentOperationType.void &&
      state.status !== OnlinePaymentIntentStatus.succeeded &&
      state.status !== OnlinePaymentIntentStatus.requires_action
    ) {
      throw new PaymentProviderError(
        "Paymob transaction is not currently voidable",
        "unsupported_operation",
      );
    }
  }

  private async verifyAndFinalizePaymobOperation(
    operation: OnlinePaymentOperationRecord,
    source: string,
  ) {
    let state: ProviderTransactionState;
    const runtimeContext = await this.runtimeContextForIntent(
      operation.onlinePaymentIntentId,
      OnlinePaymentProvider.paymob,
    );

    if (
      operation.providerTransactionId &&
      operation.providerTransactionId !== operation.parentProviderTransactionId
    ) {
      state = runtimeContext
        ? await this.paymobPaymentProviderService.inquireTransactionById(
            operation.providerTransactionId,
            runtimeContext,
          )
        : await this.paymobPaymentProviderService.inquireTransactionById(
            operation.providerTransactionId,
          );
    } else {
      state = runtimeContext
        ? await this.paymobPaymentProviderService.inquireTransactionById(
            operation.parentProviderTransactionId,
            runtimeContext,
          )
        : await this.paymobPaymentProviderService.inquireTransactionById(
            operation.parentProviderTransactionId,
          );
    }

    return this.prisma.$transaction((tx) =>
      this.finalizePaymobOperationFromState(tx, operation.id, state, source),
    );
  }

  private async finalizePaymobOperationFromState(
    tx: Prisma.TransactionClient,
    operationId: string,
    state: ProviderTransactionState,
    source: string,
  ) {
    const operation = await this.loadOperationOrThrow(operationId, tx);

    if (operation.status !== OnlinePaymentOperationStatus.pending) {
      return this.toOperationResult(operation, "already_terminal");
    }

    const parentMutation =
      state.providerTransactionId === operation.parentProviderTransactionId;
    const metadata = this.jsonRecord(operation.metadata);

    if (!parentMutation) {
      if (
        state.parentProviderTransactionId !==
        operation.parentProviderTransactionId
      ) {
        throw new PaymentProviderError(
          "Paymob child transaction belongs to another parent",
          "invalid_response",
        );
      }

      if (state.operationType !== operation.type) {
        throw new PaymentProviderError(
          "Paymob child transaction type does not match the requested operation",
          "invalid_response",
        );
      }

      if (
        operation.type !== OnlinePaymentOperationType.void &&
        state.amountMinor !== operation.amountMinor
      ) {
        throw new PaymentProviderError(
          "Paymob child transaction amount does not match the requested operation",
          "amount_mismatch",
        );
      }
    } else {
      const isRefunded =
        this.booleanMetadata(state.safeMetadata, "isRefunded") === true;
      const isVoided =
        this.booleanMetadata(state.safeMetadata, "isVoided") === true;
      const isCaptured =
        this.booleanMetadata(state.safeMetadata, "isCaptured") === true ||
        this.booleanMetadata(state.safeMetadata, "isCapture") === true;

      if (operation.type === OnlinePaymentOperationType.refund) {
        const expectedRefundedMinor = Number(
          metadata.expectedRefundedMinor ?? operation.amountMinor,
        );
        const refundAmountConfirmed =
          state.refundedAmountMinor !== undefined &&
          state.refundedAmountMinor >= expectedRefundedMinor;

        if (!isRefunded && !refundAmountConfirmed) {
          return this.toOperationResult(
            operation,
            "provider_confirmation_pending",
          );
        }
      }

      if (operation.type === OnlinePaymentOperationType.void && !isVoided) {
        return this.toOperationResult(
          operation,
          "provider_confirmation_pending",
        );
      }

      if (
        operation.type === OnlinePaymentOperationType.capture &&
        (!isCaptured ||
          (state.capturedAmountMinor !== undefined &&
            state.capturedAmountMinor < operation.amountMinor))
      ) {
        return this.toOperationResult(
          operation,
          "provider_confirmation_pending",
        );
      }
    }

    const pending =
      this.booleanMetadata(state.safeMetadata, "pending") === true;
    const success =
      this.booleanMetadata(state.safeMetadata, "success") === true;
    const errorOccurred =
      this.booleanMetadata(state.safeMetadata, "errorOccurred") === true;

    if (pending) {
      return this.toOperationResult(operation, "provider_confirmation_pending");
    }

    if (!success || errorOccurred) {
      await tx.onlinePaymentOperation.updateMany({
        where: {
          id: operation.id,
          status: OnlinePaymentOperationStatus.pending,
        },
        data: {
          status: OnlinePaymentOperationStatus.failed,
          failedAt: new Date(),
          failureCode: "paymob_operation_failed",
          failureMessage: "Paymob operation failed",
          metadata: this.toJsonValue({
            ...metadata,
            providerConfirmationSource: source,
            providerConfirmation: state.safeMetadata,
          }),
        },
      });

      const failedOperation = await this.loadOperationOrThrow(operation.id, tx);
      await this.createOnlinePaymentEvent(
        tx,
        failedOperation.onlinePaymentIntent,
        OnlinePaymentEventType.provider_operation_failed,
        {
          operationId: failedOperation.id,
          operationType: failedOperation.type,
          source,
          providerTransactionId: state.providerTransactionId,
        },
      );

      return this.toOperationResult(failedOperation, "failed");
    }

    const now = new Date();
    await tx.onlinePaymentOperation.updateMany({
      where: {
        id: operation.id,
        status: OnlinePaymentOperationStatus.pending,
      },
      data: {
        status: OnlinePaymentOperationStatus.succeeded,
        providerTransactionId: state.providerTransactionId,
        completedAt: now,
        failedAt: null,
        failureCode: null,
        failureMessage: null,
        metadata: this.toJsonValue({
          ...metadata,
          providerConfirmationSource: source,
          providerConfirmation: state.safeMetadata,
        }),
      },
    });

    let latestOperation = await this.loadOperationOrThrow(operation.id, tx);

    if (latestOperation.type === OnlinePaymentOperationType.capture) {
      await this.applyPaymobSuccess(tx, latestOperation.onlinePaymentIntent, {
        ...state,
        status: OnlinePaymentIntentStatus.succeeded,
        amountMinor: latestOperation.amountMinor,
        actionable: true,
      });
    } else if (
      latestOperation.type === OnlinePaymentOperationType.void &&
      latestOperation.onlinePaymentIntent.status ===
        OnlinePaymentIntentStatus.requires_action
    ) {
      await this.applyPaymobStatusUpdate(
        tx,
        latestOperation.onlinePaymentIntent,
        {
          ...state,
          status: OnlinePaymentIntentStatus.cancelled,
          actionable: true,
        },
      );
    }

    latestOperation = await this.loadOperationOrThrow(operation.id, tx);

    await this.createOnlinePaymentEvent(
      tx,
      latestOperation.onlinePaymentIntent,
      OnlinePaymentEventType.provider_operation_completed,
      {
        operationId: latestOperation.id,
        operationType: latestOperation.type,
        amountMinor: latestOperation.amountMinor,
        source,
        parentProviderTransactionId:
          latestOperation.parentProviderTransactionId,
        providerTransactionId: latestOperation.providerTransactionId,
      },
    );

    if (
      latestOperation.type === OnlinePaymentOperationType.refund ||
      (latestOperation.type === OnlinePaymentOperationType.void &&
        latestOperation.onlinePaymentIntent.status ===
          OnlinePaymentIntentStatus.succeeded)
    ) {
      await this.billsService.refreshReceiptForOnlinePaymentAdjustment(
        latestOperation.billId,
        tx,
      );
    }

    await this.auditService.recordAuditLog(
      {
        companyId: latestOperation.companyId,
        branchId: latestOperation.branchId,
        actorType: AuditActorType.staff,
        actorStaffUserId: latestOperation.requestedByStaffUserId,
        targetType: "online_payment_operation",
        targetId: latestOperation.id,
        action: this.auditActionForOperation(latestOperation.type),
        message: `Paymob ${latestOperation.type} completed`,
        metadata: {
          onlinePaymentIntentId: latestOperation.onlinePaymentIntentId,
          billId: latestOperation.billId,
          amountMinor: latestOperation.amountMinor,
          currency: latestOperation.currency,
          providerTransactionId: latestOperation.providerTransactionId,
          parentProviderTransactionId:
            latestOperation.parentProviderTransactionId,
        },
      },
      tx,
    );

    return this.toOperationResult(latestOperation, "succeeded");
  }

  private async failPaymobOperationBeforeMutation(
    operationId: string,
    error: unknown,
    failureCode: string,
  ) {
    const providerCode =
      error instanceof PaymentProviderError ? error.code : "unknown_error";

    return this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentOperation.updateMany({
        where: {
          id: operationId,
          status: OnlinePaymentOperationStatus.pending,
        },
        data: {
          status: OnlinePaymentOperationStatus.failed,
          failedAt: new Date(),
          failureCode: `${failureCode}:${providerCode}`,
          failureMessage: "Paymob operation could not be completed",
        },
      });
      const operation = await this.loadOperationOrThrow(operationId, tx);
      await this.createOnlinePaymentEvent(
        tx,
        operation.onlinePaymentIntent,
        OnlinePaymentEventType.provider_operation_failed,
        {
          operationId: operation.id,
          operationType: operation.type,
          providerErrorCode: providerCode,
        },
      );

      return this.toOperationResult(operation, "failed");
    });
  }

  private async markPaymobOperationUncertain(
    operationId: string,
    error: unknown,
  ) {
    const providerCode =
      error instanceof PaymentProviderError ? error.code : "unknown_error";
    const operation = await this.prisma.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      select: { metadata: true },
    });

    await this.prisma.onlinePaymentOperation.updateMany({
      where: {
        id: operationId,
        status: OnlinePaymentOperationStatus.pending,
      },
      data: {
        failureCode: `uncertain:${providerCode}`,
        failureMessage:
          "Provider request outcome is uncertain; recovery is required before another financial operation",
        metadata: this.toJsonValue({
          ...this.jsonRecord(operation?.metadata ?? null),
          providerRequestState: "uncertain",
          providerErrorCode: providerCode,
        }),
      },
    });
  }

  private isAmbiguousProviderMutationError(error: unknown) {
    return (
      error instanceof PaymentProviderError &&
      [
        "timeout",
        "provider_unavailable",
        "invalid_response",
        "amount_mismatch",
        "currency_mismatch",
        "environment_mismatch",
      ].includes(error.code)
    );
  }

  private mapPaymobOperationError(error: unknown) {
    if (error instanceof PaymentProviderError) {
      if (
        error.code === "invalid_request" ||
        error.code === "amount_mismatch" ||
        error.code === "currency_mismatch" ||
        error.code === "unsupported_operation"
      ) {
        return new BadRequestException(
          "Paymob payment operation is not valid for the current transaction state",
        );
      }

      if (error.code === "provider_declined") {
        return new BadRequestException("Paymob declined the payment operation");
      }
    }

    return new ServiceUnavailableException(
      "Paymob payment operation is awaiting or missing provider confirmation",
    );
  }

  private async finalizeFawryRefundOperation(
    operationId: string,
    source: string,
    providerMetadata: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.loadOperationOrThrow(operationId, tx);

      if (before.status !== OnlinePaymentOperationStatus.pending) {
        return this.toOperationResult(before, "already_terminal");
      }

      const update = await tx.onlinePaymentOperation.updateMany({
        where: {
          id: operationId,
          provider: OnlinePaymentProvider.fawry,
          type: OnlinePaymentOperationType.refund,
          status: OnlinePaymentOperationStatus.pending,
        },
        data: {
          status: OnlinePaymentOperationStatus.succeeded,
          completedAt: new Date(),
          failedAt: null,
          failureCode: null,
          failureMessage: null,
          metadata: this.toJsonValue({
            ...this.jsonRecord(before.metadata),
            providerConfirmationSource: source,
            providerConfirmation: providerMetadata,
          }),
        },
      });

      const operation = await this.loadOperationOrThrow(operationId, tx);

      if (
        update.count !== 1 ||
        operation.status !== OnlinePaymentOperationStatus.succeeded
      ) {
        return this.toOperationResult(operation, "state_unchanged");
      }

      await this.createOnlinePaymentEvent(
        tx,
        operation.onlinePaymentIntent,
        OnlinePaymentEventType.provider_operation_completed,
        {
          operationId: operation.id,
          operationType: operation.type,
          provider: OnlinePaymentProvider.fawry,
          amountMinor: operation.amountMinor,
          source,
          parentProviderTransactionId: operation.parentProviderTransactionId,
        },
      );
      await this.billsService.refreshReceiptForOnlinePaymentAdjustment(
        operation.billId,
        tx,
      );
      await this.auditService.recordAuditLog(
        {
          companyId: operation.companyId,
          branchId: operation.branchId,
          actorType: AuditActorType.staff,
          actorStaffUserId: operation.requestedByStaffUserId,
          targetType: "online_payment_operation",
          targetId: operation.id,
          action: AuditAction.online_payment_refunded,
          message: "Fawry refund completed",
          metadata: {
            onlinePaymentIntentId: operation.onlinePaymentIntentId,
            billId: operation.billId,
            amountMinor: operation.amountMinor,
            currency: operation.currency,
            parentProviderTransactionId: operation.parentProviderTransactionId,
            source,
          },
        },
        tx,
      );

      return this.toOperationResult(operation, "succeeded");
    });
  }

  private async markFawryRefundUncertain(operationId: string, error: unknown) {
    const providerCode =
      error instanceof PaymentProviderError ? error.code : "unknown_error";
    const operation = await this.prisma.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      select: { metadata: true },
    });

    await this.prisma.onlinePaymentOperation.updateMany({
      where: {
        id: operationId,
        provider: OnlinePaymentProvider.fawry,
        status: OnlinePaymentOperationStatus.pending,
      },
      data: {
        failureCode: `uncertain:${providerCode}`,
        failureMessage:
          "Fawry refund outcome is uncertain; provider recovery is required before another refund",
        metadata: this.toJsonValue({
          ...this.jsonRecord(operation?.metadata ?? null),
          providerRequestState: "uncertain",
          providerErrorCode: providerCode,
        }),
      },
    });
  }

  private async failFawryRefundOperation(operationId: string, error: unknown) {
    const providerCode =
      error instanceof PaymentProviderError ? error.code : "unknown_error";

    return this.prisma.$transaction(async (tx) => {
      await tx.onlinePaymentOperation.updateMany({
        where: {
          id: operationId,
          provider: OnlinePaymentProvider.fawry,
          status: OnlinePaymentOperationStatus.pending,
        },
        data: {
          status: OnlinePaymentOperationStatus.failed,
          failedAt: new Date(),
          failureCode: `fawry_refund_failed:${providerCode}`,
          failureMessage: "Fawry refund could not be completed",
        },
      });
      const operation = await this.loadOperationOrThrow(operationId, tx);

      await this.createOnlinePaymentEvent(
        tx,
        operation.onlinePaymentIntent,
        OnlinePaymentEventType.provider_operation_failed,
        {
          operationId: operation.id,
          operationType: operation.type,
          provider: OnlinePaymentProvider.fawry,
          providerErrorCode: providerCode,
        },
      );

      return this.toOperationResult(operation, "failed");
    });
  }

  private isAmbiguousFawryRefundError(error: unknown) {
    return (
      error instanceof PaymentProviderError &&
      ["timeout", "provider_unavailable", "invalid_response"].includes(
        error.code,
      )
    );
  }

  private async loadOperationOrThrow(operationId: string, tx: PrismaExecutor) {
    const operation = await tx.onlinePaymentOperation.findUnique({
      where: { id: operationId },
      include: onlinePaymentOperationInclude,
    });

    if (!operation) {
      throw new NotFoundException("Online payment operation not found");
    }

    return operation;
  }

  private async lockOnlinePaymentOperation(
    tx: Prisma.TransactionClient,
    intentId: string,
  ) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`online-payment-operation:${intentId}`}, 0)
      )
    `;
  }

  private toOperationResult(
    operation: OnlinePaymentOperationRecord,
    outcome: string,
  ) {
    return {
      outcome,
      operation: {
        id: operation.id,
        onlinePaymentIntentId: operation.onlinePaymentIntentId,
        provider: operation.provider,
        type: operation.type,
        status: operation.status,
        parentProviderTransactionId: operation.parentProviderTransactionId,
        providerTransactionId: operation.providerTransactionId,
        amountMinor: operation.amountMinor,
        currency: operation.currency,
        reason: operation.reason,
        requestedAt: operation.requestedAt,
        completedAt: operation.completedAt,
        failedAt: operation.failedAt,
        failureCode: operation.failureCode,
        failureMessage: operation.failureMessage,
      },
      onlinePaymentIntent: this.toIntentSummary(operation.onlinePaymentIntent),
    };
  }

  private auditActionForOperation(type: OnlinePaymentOperationType) {
    if (type === OnlinePaymentOperationType.refund) {
      return AuditAction.online_payment_refunded;
    }

    if (type === OnlinePaymentOperationType.void) {
      return AuditAction.online_payment_voided;
    }

    return AuditAction.online_payment_captured;
  }

  private booleanMetadata(metadata: Record<string, unknown>, key: string) {
    return typeof metadata[key] === "boolean"
      ? (metadata[key] as boolean)
      : undefined;
  }

  private stringMetadata(metadata: Record<string, unknown>, key: string) {
    return typeof metadata[key] === "string"
      ? (metadata[key] as string)
      : undefined;
  }

  async processPaymobWebhook(receivedHmac: string, obj: unknown) {
    this.assertOnlinePaymentsEnabled();

    let verified: VerifiedProviderTransactionWebhook;
    const providerOrderId = this.untrustedPaymobProviderOrderId(obj);
    const runtimeContext =
      providerOrderId && this.merchantPaymentIntegrationsService
        ? await this.merchantPaymentIntegrationsService.runtimeContextForProviderOrder(
            OnlinePaymentProvider.paymob,
            providerOrderId,
          )
        : undefined;

    this.assertWebhookMerchantContext(runtimeContext, providerOrderId);

    try {
      verified = runtimeContext
        ? this.paymobPaymentProviderService.verifyTransactionWebhook(
            obj,
            receivedHmac,
            runtimeContext,
          )
        : this.paymobPaymentProviderService.verifyTransactionWebhook(
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

    if (verified.hasParentTransaction) {
      return this.processPaymobChildWebhook(verified);
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

  private async processPaymobChildWebhook(
    verified: VerifiedProviderTransactionWebhook,
  ) {
    const receipt = await this.prisma.$transaction(async (tx) => {
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
        return {
          intentId: existingEvent.onlinePaymentIntentId,
          duplicate: true,
        };
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
          unmatched: true as const,
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
          childTransaction: true,
          authoritativeInquiryRequired: true,
          ...verified.safeMetadata,
        },
        verified.providerEventId,
      );

      return {
        intentId: intent.id,
        duplicate: false,
      };
    });

    if ("unmatched" in receipt) {
      return {
        received: true,
        outcome: "unmatched_child_provider_order",
        provider: OnlinePaymentProvider.paymob,
        providerTransactionId: verified.providerTransactionId,
        providerOrderId: verified.providerOrderId,
      };
    }

    let state: ProviderTransactionState;

    try {
      const runtimeContext = await this.runtimeContextForIntent(
        receipt.intentId,
        OnlinePaymentProvider.paymob,
      );
      state = runtimeContext
        ? await this.paymobPaymentProviderService.inquireTransactionById(
            verified.providerTransactionId,
            runtimeContext,
          )
        : await this.paymobPaymentProviderService.inquireTransactionById(
            verified.providerTransactionId,
          );
    } catch (error) {
      throw this.mapPaymobInquiryError(error);
    }

    return this.prisma.$transaction(async (tx) => {
      const intent = await this.loadIntentOrThrow(receipt.intentId, tx);

      if (
        state.providerOrderId !== intent.providerOrderId ||
        state.currency !== intent.currency
      ) {
        await this.createOnlinePaymentEvent(
          tx,
          intent,
          OnlinePaymentEventType.settlement_skipped,
          {
            reason: "child_transaction_scope_mismatch",
            providerTransactionId: state.providerTransactionId,
            providerOrderId: state.providerOrderId,
          },
        );

        return this.toIntentResult(intent, "child_transaction_scope_mismatch");
      }

      if (!state.parentProviderTransactionId || !state.operationType) {
        await this.createOnlinePaymentEvent(
          tx,
          intent,
          OnlinePaymentEventType.status_updated,
          {
            reason: "child_transaction_missing_operation_identity",
            providerTransactionId: state.providerTransactionId,
          },
        );

        return this.toIntentResult(
          intent,
          "child_transaction_missing_operation_identity",
        );
      }

      const linkedOperation = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          provider: OnlinePaymentProvider.paymob,
          providerTransactionId: state.providerTransactionId,
        },
        include: onlinePaymentOperationInclude,
      });

      if (
        linkedOperation &&
        linkedOperation.status !== OnlinePaymentOperationStatus.pending
      ) {
        return this.toOperationResult(
          linkedOperation,
          "duplicate_child_operation",
        );
      }

      const operation = await tx.onlinePaymentOperation.findFirst({
        where: {
          onlinePaymentIntentId: intent.id,
          provider: OnlinePaymentProvider.paymob,
          status: OnlinePaymentOperationStatus.pending,
          ...(state.operationType ? { type: state.operationType } : {}),
          ...(state.parentProviderTransactionId
            ? {
                parentProviderTransactionId: state.parentProviderTransactionId,
              }
            : {}),
          OR: [
            { providerTransactionId: state.providerTransactionId },
            { providerTransactionId: null },
          ],
        },
        include: onlinePaymentOperationInclude,
      });

      if (!operation) {
        await this.createOnlinePaymentEvent(
          tx,
          intent,
          OnlinePaymentEventType.status_updated,
          {
            reason: "unmatched_child_transaction",
            providerTransactionId: state.providerTransactionId,
            parentProviderTransactionId: state.parentProviderTransactionId,
            operationType: state.operationType,
          },
        );

        return this.toIntentResult(intent, "unmatched_child_transaction");
      }

      if (!operation.providerTransactionId) {
        await tx.onlinePaymentOperation.updateMany({
          where: {
            id: operation.id,
            status: OnlinePaymentOperationStatus.pending,
            providerTransactionId: null,
          },
          data: {
            providerTransactionId: state.providerTransactionId,
          },
        });
      }

      return this.finalizePaymobOperationFromState(
        tx,
        operation.id,
        state,
        "child_webhook",
      );
    });
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
          message:
            "Verified Paymob order is not linked to a local payment intent",
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

    if (provider === OnlinePaymentProvider.fawry) {
      return OnlinePaymentProvider.fawry;
    }

    if (provider === OnlinePaymentProvider.external) {
      return OnlinePaymentProvider.external;
    }

    return OnlinePaymentProvider.mock;
  }

  private runtimeContextForIntent(
    intentId: string,
    provider: OnlinePaymentProvider,
  ) {
    return this.merchantPaymentIntegrationsService?.runtimeContextForIntent(
      intentId,
      provider,
    );
  }

  private assertWebhookMerchantContext(
    runtimeContext: ProviderRuntimeContext | undefined,
    providerOrderId: string | undefined,
  ) {
    if (
      this.merchantPaymentIntegrationsService &&
      this.configService.get<string>("app.environment") === "production" &&
      (!providerOrderId || !runtimeContext)
    ) {
      throw new UnauthorizedException(
        "Payment webhook is not bound to a tenant merchant integration",
      );
    }
  }

  private untrustedFawryProviderOrderId(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const input = value as Record<string, unknown>;
    return this.untrustedIdentifier(
      input.merchantRefNumber ?? input.merchantRefNum,
    );
  }

  private untrustedPaymobProviderOrderId(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    const order = (value as Record<string, unknown>).order;
    if (!order || typeof order !== "object" || Array.isArray(order)) {
      return undefined;
    }
    return this.untrustedIdentifier((order as Record<string, unknown>).id);
  }

  private untrustedIdentifier(value: unknown) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
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
        customerAction: this.providerCustomerAction(
          intent.metadata,
          intent.providerCheckoutUrl,
        ),
        expiresAt: intent.checkoutExpiresAt,
        requiresCustomerAction:
          intent.status === OnlinePaymentIntentStatus.pending ||
          intent.status === OnlinePaymentIntentStatus.requires_action,
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

  private providerCustomerAction(
    metadata: Prisma.JsonValue | null,
    fallbackCheckoutUrl?: string | null,
  ): ProviderCustomerAction | undefined {
    const rawAction = this.jsonRecord(metadata).providerCustomerAction;

    if (
      rawAction &&
      typeof rawAction === "object" &&
      !Array.isArray(rawAction)
    ) {
      const action = rawAction as Record<string, unknown>;
      const type = action.type;

      if (type === "redirect" || type === "deep_link") {
        const url = typeof action.url === "string" ? action.url.trim() : "";

        if (url) {
          return { type, url };
        }
      }

      if (type === "qr") {
        const value =
          typeof action.value === "string" ? action.value.trim() : "";

        if (value) {
          return { type, value };
        }
      }

      if (type === "display_reference") {
        const reference =
          typeof action.reference === "string" ? action.reference.trim() : "";

        if (reference) {
          return { type, reference };
        }
      }
    }

    const fallback = fallbackCheckoutUrl?.trim();

    return fallback ? { type: "redirect", url: fallback } : undefined;
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
