import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AuditAction,
  AuditActorType,
  CompanySubscriptionStatus,
  Prisma,
  SaasBillingEnvironment,
  SaasBillingInvoiceStatus,
  SaasBillingPaymentAttemptStatus,
  SaasBillingProvider,
} from "@prisma/client";
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  CancelSaasBillingDto,
  ChangeSaasBillingPlanDto,
  StartSaasBillingCheckoutDto,
} from "./dto/saas-billing.dto";

type JsonRecord = Record<string, unknown>;

type BillingConfig = {
  enabled: boolean;
  provider: SaasBillingProvider;
  environment: SaasBillingEnvironment;
  expectedLive: boolean;
  baseUrl: string;
  apiKey?: string;
  secretKey?: string;
  publicKey?: string;
  hmacSecret?: string;
  online3dsIntegrationId: number;
  motoIntegrationId: number;
  transactionWebhookUrl?: string;
  subscriptionWebhookUrl?: string;
  returnUrl?: string;
  timeoutMs: number;
  expirationSeconds: number;
  graceDays: number;
};

type VerifiedPaymobTransaction = {
  eventKey: string;
  providerTransactionId: string;
  providerOrderId: string;
  merchantReference?: string;
  integrationId: number;
  amountMinor: number;
  currency: string;
  pending: boolean;
  success: boolean;
  isLive: boolean;
  paidAt?: Date;
};

@Injectable()
export class SaasBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getCompanyBillingOverview(companyId: string) {
    const subscription = await this.requireSubscription(companyId);
    const [paymentAttempts, invoices] = await Promise.all([
      this.prisma.saasBillingPaymentAttempt.findMany({
        where: { companySubscriptionId: subscription.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
      }),
      this.prisma.saasBillingInvoice.findMany({
        where: { companySubscriptionId: subscription.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 30,
      }),
    ]);
    const config = this.readConfig(false);
    const readiness = this.configurationReadiness(config);

    return {
      company: subscription.company,
      plan: subscription.plan,
      subscription: this.publicSubscription(subscription),
      billing: {
        provider: "paymob" as const,
        enabled: config.enabled,
        environment: config.environment,
        ready: readiness.ready,
        readinessMessage: readiness.message,
        liveVerified:
          config.environment === SaasBillingEnvironment.live &&
          config.expectedLive &&
          Boolean(subscription.providerSubscriptionReference),
      },
      paymentAttempts: paymentAttempts.map((attempt) => ({
        id: attempt.id,
        status: attempt.status,
        provider: attempt.provider,
        environment: attempt.environment,
        amountMinor: attempt.amountMinor,
        currency: attempt.currency,
        providerTransactionReference: attempt.providerTransactionReference,
        failureCode: attempt.failureCode,
        failureMessage: attempt.failureMessage,
        createdAt: attempt.createdAt,
        updatedAt: attempt.updatedAt,
        succeededAt: attempt.succeededAt,
        failedAt: attempt.failedAt,
      })),
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        provider: invoice.provider,
        environment: invoice.environment,
        amountMinor: invoice.amountMinor,
        currency: invoice.currency,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        dueAt: invoice.dueAt,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
      })),
    };
  }

  async startCompanyCheckout(
    companyId: string,
    staffUserId: string,
    input: StartSaasBillingCheckoutDto,
  ) {
    const config = this.readConfig(true);
    const subscription = await this.requireSubscription(companyId);
    const amountMinor = subscription.plan.monthlyPriceMinor;

    if (!amountMinor || amountMinor <= 0) {
      throw new BadRequestException(
        "The current Balcona plan does not have a recurring monthly price",
      );
    }

    if (subscription.plan.currency.toUpperCase() !== "EGP") {
      throw new BadRequestException(
        "Paymob SaaS billing currently supports EGP Balcona plans",
      );
    }

    let providerPlanReference = subscription.providerPlanReference;
    if (!providerPlanReference) {
      const providerPlan = await this.createProviderPlan(subscription, config);
      providerPlanReference = providerPlan.id;
      await this.prisma.companySubscription.update({
        where: { id: subscription.id },
        data: {
          billingProvider: SaasBillingProvider.paymob,
          billingEnvironment: config.environment,
          providerPlanReference,
          lastBillingSyncAt: new Date(),
        },
      });
    }

    const attemptId = randomUUID();
    const now = new Date();
    const periodEnd = this.addDays(now, 30);

    await this.prisma.saasBillingPaymentAttempt.create({
      data: {
        id: attemptId,
        companySubscriptionId: subscription.id,
        companyId,
        provider: SaasBillingProvider.paymob,
        environment: config.environment,
        status: SaasBillingPaymentAttemptStatus.pending,
        amountMinor,
        currency: "EGP",
        periodStart: now,
        periodEnd,
        metadata: this.toJson({
          purpose: "subscription_enrollment",
          planCode: subscription.plan.code,
        }),
      },
    });

    try {
      const providerIntent = await this.createSubscriptionIntention(
        {
          attemptId,
          companyId,
          subscriptionId: subscription.id,
          providerPlanReference,
          amountMinor,
          billingData: input,
        },
        config,
      );
      const checkoutUrl = this.checkoutUrl(
        config,
        providerIntent.clientSecret,
      );

      await this.prisma.$transaction([
        this.prisma.saasBillingPaymentAttempt.update({
          where: { id: attemptId },
          data: {
            status: SaasBillingPaymentAttemptStatus.requires_action,
            providerIntentionReference: providerIntent.id,
            providerOrderReference: providerIntent.orderId,
            checkoutUrl,
            metadata: this.toJson({
              purpose: "subscription_enrollment",
              planCode: subscription.plan.code,
              providerStatus: providerIntent.status,
            }),
          },
        }),
        this.prisma.saasBillingInvoice.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId,
            paymentAttemptId: attemptId,
            provider: SaasBillingProvider.paymob,
            environment: config.environment,
            status: SaasBillingInvoiceStatus.open,
            amountMinor,
            currency: "EGP",
            periodStart: now,
            periodEnd,
            dueAt: now,
            metadata: this.toJson({
              purpose: "initial_subscription_period",
              planCode: subscription.plan.code,
            }),
          },
        }),
      ]);

      await this.auditService.recordAuditLog({
        companyId,
        actorType: AuditActorType.staff,
        actorStaffUserId: staffUserId,
        targetType: "saas_billing_payment_attempt",
        targetId: attemptId,
        action: AuditAction.other,
        message: "Balcona SaaS subscription checkout created",
        metadata: {
          provider: "paymob",
          environment: config.environment,
          amountMinor,
          currency: "EGP",
          planCode: subscription.plan.code,
        },
      });

      return {
        paymentAttemptId: attemptId,
        provider: "paymob" as const,
        environment: config.environment,
        status: SaasBillingPaymentAttemptStatus.requires_action,
        amountMinor,
        currency: "EGP",
        checkout: {
          type: "redirect" as const,
          url: checkoutUrl,
          expiresAt: new Date(
            Date.now() + config.expirationSeconds * 1000,
          ),
        },
      };
    } catch (error) {
      await this.prisma.saasBillingPaymentAttempt.update({
        where: { id: attemptId },
        data: {
          status: SaasBillingPaymentAttemptStatus.failed,
          failureCode: "provider_create_failed",
          failureMessage: this.safeErrorMessage(error),
          failedAt: new Date(),
        },
      });
      throw error;
    }
  }

  async syncCompanySubscription(
    companyId: string,
    staffUserId?: string,
  ) {
    const config = this.readConfig(true);
    const subscription = await this.requireSubscription(companyId);
    const providerSubscriptionReference =
      subscription.providerSubscriptionReference;

    if (!providerSubscriptionReference) {
      throw new BadRequestException(
        "The company has not completed provider subscription enrollment yet",
      );
    }

    const remote = await this.getProviderSubscription(
      providerSubscriptionReference,
      config,
    );
    const state = this.stringValue(remote.state)?.toLowerCase();
    const mappedStatus = this.mapProviderSubscriptionState(
      state,
      subscription.status,
    );
    const nextBilling = this.dateValue(remote.next_billing);
    const startsAt = this.dateValue(remote.starts_at);
    const planReference = this.identifierString(remote.plan_id);

    const updated = await this.prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: mappedStatus,
        billingProvider: SaasBillingProvider.paymob,
        billingEnvironment: config.environment,
        providerPlanReference:
          planReference ?? subscription.providerPlanReference,
        currentPeriodStart:
          startsAt ?? subscription.currentPeriodStart ?? undefined,
        currentPeriodEnd:
          nextBilling ?? subscription.currentPeriodEnd ?? undefined,
        lastBillingSyncAt: new Date(),
        suspendedAt:
          mappedStatus === CompanySubscriptionStatus.suspended
            ? new Date()
            : mappedStatus === CompanySubscriptionStatus.active
              ? null
              : undefined,
        cancelledAt:
          mappedStatus === CompanySubscriptionStatus.cancelled
            ? new Date()
            : undefined,
      },
      include: { plan: true, company: true },
    });

    if (staffUserId) {
      await this.auditService.recordAuditLog({
        companyId,
        actorType: AuditActorType.staff,
        actorStaffUserId: staffUserId,
        targetType: "company_subscription",
        targetId: subscription.id,
        action: AuditAction.other,
        message: "Balcona SaaS subscription synchronized from Paymob",
        metadata: {
          providerSubscriptionReference,
          providerState: state ?? "unknown",
          mappedStatus,
        },
      });
    }

    return {
      subscription: this.publicSubscription(updated),
      providerState: state ?? "unknown",
      syncedAt: updated.lastBillingSyncAt,
    };
  }

  async changeCompanyPlan(
    companyId: string,
    staffUserId: string,
    input: ChangeSaasBillingPlanDto,
  ) {
    const config = this.readConfig(true);
    const subscription = await this.requireSubscription(companyId);
    const providerSubscriptionReference =
      subscription.providerSubscriptionReference;

    if (!providerSubscriptionReference) {
      throw new BadRequestException(
        "Complete subscription enrollment before changing plans",
      );
    }

    const targetPlan = await this.prisma.saasPlan.findUnique({
      where: { code: input.planCode },
    });
    if (!targetPlan || targetPlan.status !== "active") {
      throw new NotFoundException("Active SaaS plan not found");
    }
    if (!targetPlan.monthlyPriceMinor || targetPlan.monthlyPriceMinor <= 0) {
      throw new BadRequestException(
        "The target plan does not have a recurring monthly price",
      );
    }
    if (targetPlan.currency.toUpperCase() !== "EGP") {
      throw new BadRequestException(
        "The target plan currency is not supported by Paymob SaaS billing",
      );
    }

    const token = await this.paymobAuthToken(config);
    const response = await this.fetchJson(
      `${config.baseUrl}/api/acceptance/subscriptions/${encodeURIComponent(
        providerSubscriptionReference,
      )}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount_cents: targetPlan.monthlyPriceMinor,
        }),
      },
      config.timeoutMs,
      "Paymob subscription plan change",
    );

    const remote = this.recordValue(response);
    const remoteAmount = this.integerValue(remote.amount_cents);
    if (
      remoteAmount !== undefined &&
      remoteAmount !== targetPlan.monthlyPriceMinor
    ) {
      throw new ServiceUnavailableException(
        "Paymob returned a different recurring amount for the plan change",
      );
    }

    const beforePlan = subscription.plan;
    const updated = await this.prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        planId: targetPlan.id,
        billingProvider: SaasBillingProvider.paymob,
        billingEnvironment: config.environment,
        lastBillingSyncAt: new Date(),
      },
      include: { plan: true, company: true },
    });

    await this.auditService.recordAuditLog({
      companyId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUserId,
      targetType: "company_subscription",
      targetId: subscription.id,
      action: AuditAction.other,
      message: "Balcona SaaS subscription plan changed",
      before: {
        planCode: beforePlan.code,
        amountMinor: beforePlan.monthlyPriceMinor,
      },
      after: {
        planCode: targetPlan.code,
        amountMinor: targetPlan.monthlyPriceMinor,
      },
    });

    return {
      subscription: this.publicSubscription(updated),
      providerState: this.stringValue(remote.state) ?? "unknown",
    };
  }

  async cancelCompanySubscription(
    companyId: string,
    staffUserId: string,
    input: CancelSaasBillingDto,
  ) {
    const config = this.readConfig(true);
    const subscription = await this.requireSubscription(companyId);
    const providerSubscriptionReference =
      subscription.providerSubscriptionReference;

    if (!providerSubscriptionReference) {
      throw new BadRequestException(
        "There is no provider subscription to cancel",
      );
    }

    const token = await this.paymobAuthToken(config);
    const response = await this.fetchJson(
      `${config.baseUrl}/api/acceptance/subscriptions/${encodeURIComponent(
        providerSubscriptionReference,
      )}/cancel`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      },
      config.timeoutMs,
      "Paymob subscription cancellation",
    );
    const remote = this.recordValue(response);
    const state = this.stringValue(remote.state)?.toLowerCase();

    if (state && state !== "cancelled" && state !== "canceled") {
      throw new ServiceUnavailableException(
        "Paymob did not confirm subscription cancellation",
      );
    }

    const updated = await this.prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: CompanySubscriptionStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReason:
          input.reason?.trim() || "Cancelled from Balcona Account",
        lastBillingSyncAt: new Date(),
      },
      include: { plan: true, company: true },
    });

    await this.auditService.recordAuditLog({
      companyId,
      actorType: AuditActorType.staff,
      actorStaffUserId: staffUserId,
      targetType: "company_subscription",
      targetId: subscription.id,
      action: AuditAction.other,
      message: "Balcona SaaS subscription cancelled",
      metadata: {
        provider: "paymob",
        providerSubscriptionReference,
        reason: updated.cancellationReason,
      },
    });

    return {
      subscription: this.publicSubscription(updated),
      providerState: state ?? "cancelled",
    };
  }

  async processPaymobTransactionWebhook(
    receivedHmacValue: string,
    objValue: unknown,
  ) {
    const config = this.readConfig(true);
    const transaction = this.verifyPaymobTransactionWebhook(
      objValue,
      receivedHmacValue,
      config,
    );

    const existingEvent = await this.prisma.saasBillingEvent.findUnique({
      where: { providerEventKey: transaction.eventKey },
    });
    if (existingEvent?.processedAt) {
      return { accepted: true, duplicate: true };
    }

    const attemptId = this.attemptIdFromMerchantReference(
      transaction.merchantReference,
    );
    const attempt = attemptId
      ? await this.prisma.saasBillingPaymentAttempt.findUnique({
          where: { id: attemptId },
          include: { subscription: { include: { plan: true } } },
        })
      : null;

    const remoteSubscription = await this.findProviderSubscriptionByTransaction(
      transaction.providerTransactionId,
      config,
    );
    const providerSubscriptionReference = this.identifierString(
      remoteSubscription?.id,
    );

    let subscription = attempt?.subscription ?? null;
    if (!subscription && providerSubscriptionReference) {
      subscription = await this.prisma.companySubscription.findFirst({
        where: {
          billingProvider: SaasBillingProvider.paymob,
          providerSubscriptionReference,
        },
        include: { plan: true },
      });
    }

    if (
      subscription?.providerSubscriptionReference &&
      providerSubscriptionReference &&
      subscription.providerSubscriptionReference !==
        providerSubscriptionReference
    ) {
      throw new BadRequestException(
        "Paymob transaction resolved to a different SaaS subscription",
      );
    }

    if (!subscription) {
      await this.recordBillingEvent({
        transaction,
        providerSubscriptionReference,
        eventType: "transaction_unmatched",
        processed: false,
      });
      return { accepted: true, matched: false };
    }

    const expectedAmount =
      attempt?.amountMinor ?? subscription.plan.monthlyPriceMinor;
    const expectedCurrency = subscription.plan.currency.toUpperCase();

    if (
      !expectedAmount ||
      transaction.amountMinor !== expectedAmount ||
      transaction.currency.toUpperCase() !== expectedCurrency
    ) {
      if (attempt) {
        await this.prisma.saasBillingPaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: SaasBillingPaymentAttemptStatus.unknown,
            providerTransactionReference:
              transaction.providerTransactionId,
            failureCode: "amount_or_currency_mismatch",
            failureMessage:
              "Verified provider transaction did not match the Balcona subscription amount/currency",
          },
        });
      }
      await this.recordBillingEvent({
        transaction,
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        attemptId: attempt?.id,
        providerSubscriptionReference,
        eventType: "transaction_mismatch",
        processed: true,
      });
      throw new BadRequestException(
        "Verified Paymob SaaS transaction amount or currency mismatch",
      );
    }

    if (transaction.pending) {
      if (attempt) {
        await this.prisma.saasBillingPaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: SaasBillingPaymentAttemptStatus.pending,
            providerTransactionReference:
              transaction.providerTransactionId,
          },
        });
      }
      await this.recordBillingEvent({
        transaction,
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        attemptId: attempt?.id,
        providerSubscriptionReference,
        eventType: "transaction_pending",
        processed: true,
      });
      return { accepted: true, status: "pending" };
    }

    const remoteState = this.stringValue(remoteSubscription?.state)?.toLowerCase();
    const now = transaction.paidAt ?? new Date();
    const nextBilling = this.dateValue(remoteSubscription?.next_billing);
    const startsAt = this.dateValue(remoteSubscription?.starts_at);
    const remotePlanReference = this.identifierString(
      remoteSubscription?.plan_id,
    );

    if (transaction.success) {
      const resolvedAttempt =
        attempt ??
        (await this.prisma.saasBillingPaymentAttempt.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            provider: SaasBillingProvider.paymob,
            environment: config.environment,
            status: SaasBillingPaymentAttemptStatus.succeeded,
            providerTransactionReference:
              transaction.providerTransactionId,
            providerOrderReference: transaction.providerOrderId,
            amountMinor: transaction.amountMinor,
            currency: transaction.currency.toUpperCase(),
            succeededAt: now,
            periodStart: now,
            periodEnd: nextBilling ?? this.addDays(now, 30),
            metadata: this.toJson({
              purpose: "recurring_subscription_charge",
            }),
          },
        }));

      if (attempt) {
        await this.prisma.saasBillingPaymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: SaasBillingPaymentAttemptStatus.succeeded,
            providerTransactionReference:
              transaction.providerTransactionId,
            providerOrderReference: transaction.providerOrderId,
            succeededAt: now,
            failureCode: null,
            failureMessage: null,
          },
        });
      }

      const existingInvoice = await this.prisma.saasBillingInvoice.findFirst({
        where: { paymentAttemptId: resolvedAttempt.id },
      });
      if (existingInvoice) {
        await this.prisma.saasBillingInvoice.update({
          where: { id: existingInvoice.id },
          data: {
            status: SaasBillingInvoiceStatus.paid,
            paidAt: now,
            periodStart:
              existingInvoice.periodStart ?? startsAt ?? now,
            periodEnd:
              existingInvoice.periodEnd ??
              nextBilling ??
              this.addDays(now, 30),
          },
        });
      } else {
        await this.prisma.saasBillingInvoice.create({
          data: {
            companySubscriptionId: subscription.id,
            companyId: subscription.companyId,
            paymentAttemptId: resolvedAttempt.id,
            provider: SaasBillingProvider.paymob,
            environment: config.environment,
            status: SaasBillingInvoiceStatus.paid,
            amountMinor: transaction.amountMinor,
            currency: transaction.currency.toUpperCase(),
            periodStart: startsAt ?? now,
            periodEnd: nextBilling ?? this.addDays(now, 30),
            dueAt: now,
            paidAt: now,
            metadata: this.toJson({
              providerTransactionReference:
                transaction.providerTransactionId,
            }),
          },
        });
      }

      await this.prisma.companySubscription.update({
        where: { id: subscription.id },
        data: {
          status: CompanySubscriptionStatus.active,
          billingProvider: SaasBillingProvider.paymob,
          billingEnvironment: config.environment,
          providerSubscriptionReference:
            providerSubscriptionReference ??
            subscription.providerSubscriptionReference,
          providerPlanReference:
            remotePlanReference ?? subscription.providerPlanReference,
          currentPeriodStart: startsAt ?? now,
          currentPeriodEnd:
            nextBilling ?? this.addDays(now, 30),
          graceEndsAt: null,
          suspendedAt: null,
          lastBillingSyncAt: new Date(),
        },
      });

      await this.recordBillingEvent({
        transaction,
        subscriptionId: subscription.id,
        companyId: subscription.companyId,
        attemptId: resolvedAttempt.id,
        providerSubscriptionReference,
        eventType: "transaction_succeeded",
        processed: true,
      });

      await this.auditService.recordAuditLog({
        companyId: subscription.companyId,
        actorType: AuditActorType.system,
        targetType: "company_subscription",
        targetId: subscription.id,
        action: AuditAction.other,
        message: "Verified Paymob SaaS billing transaction activated subscription period",
        metadata: {
          providerTransactionReference:
            transaction.providerTransactionId,
          providerSubscriptionReference,
          providerState: remoteState ?? "unknown",
          amountMinor: transaction.amountMinor,
          currency: transaction.currency,
        },
      });

      return { accepted: true, status: "succeeded" };
    }

    const failedAttempt =
      attempt ??
      (await this.prisma.saasBillingPaymentAttempt.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          provider: SaasBillingProvider.paymob,
          environment: config.environment,
          status: SaasBillingPaymentAttemptStatus.failed,
          providerTransactionReference:
            transaction.providerTransactionId,
          providerOrderReference: transaction.providerOrderId,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency.toUpperCase(),
          failedAt: new Date(),
          failureCode: "provider_declined",
          failureMessage: "Paymob recurring subscription charge failed",
          metadata: this.toJson({
            purpose: "recurring_subscription_charge",
          }),
        },
      }));

    if (attempt) {
      await this.prisma.saasBillingPaymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: SaasBillingPaymentAttemptStatus.failed,
          providerTransactionReference:
            transaction.providerTransactionId,
          providerOrderReference: transaction.providerOrderId,
          failedAt: new Date(),
          failureCode: "provider_declined",
          failureMessage: "Paymob subscription charge failed",
        },
      });
    }

    const graceEndsAt = this.addDays(new Date(), config.graceDays);
    await this.prisma.companySubscription.update({
      where: { id: subscription.id },
      data: {
        status: CompanySubscriptionStatus.past_due,
        graceEndsAt,
        lastBillingSyncAt: new Date(),
      },
    });

    const failedInvoice = await this.prisma.saasBillingInvoice.findFirst({
      where: { paymentAttemptId: failedAttempt.id },
    });
    if (!failedInvoice) {
      await this.prisma.saasBillingInvoice.create({
        data: {
          companySubscriptionId: subscription.id,
          companyId: subscription.companyId,
          paymentAttemptId: failedAttempt.id,
          provider: SaasBillingProvider.paymob,
          environment: config.environment,
          status: SaasBillingInvoiceStatus.open,
          amountMinor: transaction.amountMinor,
          currency: transaction.currency.toUpperCase(),
          periodStart: subscription.currentPeriodEnd ?? new Date(),
          dueAt: new Date(),
          metadata: this.toJson({
            reason: "provider_charge_failed",
          }),
        },
      });
    }

    await this.recordBillingEvent({
      transaction,
      subscriptionId: subscription.id,
      companyId: subscription.companyId,
      attemptId: failedAttempt.id,
      providerSubscriptionReference,
      eventType: "transaction_failed",
      processed: true,
    });

    return {
      accepted: true,
      status: "failed",
      graceEndsAt,
    };
  }

  async processPaymobSubscriptionWebhook(body: unknown) {
    const record = this.recordValue(body);
    const providerSubscriptionReference = this.identifierString(record.id);

    if (!providerSubscriptionReference) {
      return { accepted: true, matched: false };
    }

    const subscription = await this.prisma.companySubscription.findFirst({
      where: {
        billingProvider: SaasBillingProvider.paymob,
        providerSubscriptionReference,
      },
    });

    if (!subscription) {
      return { accepted: true, matched: false };
    }

    // The public Paymob subscription-webhook contract reviewed by Balcona
    // does not establish a verifiable signature. Treat it only as a trigger;
    // all state is re-read from Paymob using authenticated server credentials.
    await this.syncCompanySubscription(subscription.companyId);
    return { accepted: true, matched: true };
  }

  private async createProviderPlan(
    subscription: Awaited<ReturnType<SaasBillingService["requireSubscription"]>>,
    config: BillingConfig,
  ) {
    const token = await this.paymobAuthToken(config);
    const response = await this.fetchJson(
      `${config.baseUrl}/api/acceptance/subscription-plans`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          frequency: 30,
          name: `Balcona ${subscription.plan.code}`,
          reminder_days: 3,
          retrial_days: 2,
          plan_type: "merchant_subscription",
          number_of_deductions: null,
          amount_cents: subscription.plan.monthlyPriceMinor,
          use_transaction_amount: true,
          is_active: true,
          integration: config.motoIntegrationId,
          webhook_url: config.subscriptionWebhookUrl,
        }),
      },
      config.timeoutMs,
      "Paymob subscription plan creation",
    );
    const record = this.recordValue(response);
    const id = this.identifierString(record.id);
    if (!id) {
      throw new ServiceUnavailableException(
        "Paymob subscription plan response did not include a plan id",
      );
    }
    return { id };
  }

  private async createSubscriptionIntention(
    input: {
      attemptId: string;
      companyId: string;
      subscriptionId: string;
      providerPlanReference: string;
      amountMinor: number;
      billingData: StartSaasBillingCheckoutDto;
    },
    config: BillingConfig,
  ) {
    const response = await this.fetchJson(
      `${config.baseUrl}/v1/intention/`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: "EGP",
          payment_methods: [config.online3dsIntegrationId],
          subscription_plan_id: Number(input.providerPlanReference),
          billing_data: {
            first_name: input.billingData.firstName,
            last_name: input.billingData.lastName,
            email: input.billingData.email,
            phone_number: input.billingData.phoneNumber,
          },
          special_reference: `saas:${input.attemptId}`,
          extras: {
            balcona_company_id: input.companyId,
            balcona_subscription_id: input.subscriptionId,
            balcona_attempt_id: input.attemptId,
          },
          expiration: config.expirationSeconds,
          notification_url: config.transactionWebhookUrl,
          redirection_url: config.returnUrl,
        }),
      },
      config.timeoutMs,
      "Paymob subscription intention",
    );
    const record = this.recordValue(response);
    const id = this.identifierString(record.id);
    const clientSecret = this.stringValue(record.client_secret);
    const orderId = this.identifierString(record.intention_order_id);
    const status = this.stringValue(record.status) ?? "unknown";

    if (!id || !clientSecret || !orderId) {
      throw new ServiceUnavailableException(
        "Paymob subscription intention response was incomplete",
      );
    }

    const methods = Array.isArray(record.payment_methods)
      ? record.payment_methods
      : [];
    const matchingMethod = methods
      .map((method) => this.recordValue(method))
      .find(
        (method) =>
          this.integerValue(method.integration_id) ===
          config.online3dsIntegrationId,
      );
    if (matchingMethod) {
      const live = this.booleanValue(matchingMethod.live);
      if (live !== undefined && live !== config.expectedLive) {
        throw new ServiceUnavailableException(
          "Paymob SaaS billing intention returned the wrong test/live integration",
        );
      }
    }

    return { id, clientSecret, orderId, status };
  }

  private async findProviderSubscriptionByTransaction(
    providerTransactionId: string,
    config: BillingConfig,
  ) {
    const token = await this.paymobAuthToken(config);
    const response = await this.fetchJson(
      `${config.baseUrl}/api/acceptance/subscriptions?transaction=${encodeURIComponent(
        providerTransactionId,
      )}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      config.timeoutMs,
      "Paymob subscription lookup by transaction",
    );
    const record = this.recordValue(response);
    if (Array.isArray(response)) {
      return this.recordValue(response[0]);
    }
    if (Array.isArray(record.results)) {
      return this.recordValue(record.results[0]);
    }
    if (this.identifierString(record.id)) {
      return record;
    }
    return undefined;
  }

  private async getProviderSubscription(
    providerSubscriptionReference: string,
    config: BillingConfig,
  ) {
    const token = await this.paymobAuthToken(config);
    const response = await this.fetchJson(
      `${config.baseUrl}/api/acceptance/subscriptions/${encodeURIComponent(
        providerSubscriptionReference,
      )}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      config.timeoutMs,
      "Paymob subscription retrieval",
    );
    return this.recordValue(response);
  }

  private async paymobAuthToken(config: BillingConfig) {
    const response = await this.fetchJson(
      `${config.baseUrl}/api/auth/tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: config.apiKey }),
      },
      config.timeoutMs,
      "Paymob authentication",
    );
    const token = this.stringValue(this.recordValue(response).token);
    if (!token) {
      throw new ServiceUnavailableException(
        "Paymob authentication response did not include a token",
      );
    }
    return token;
  }

  private checkoutUrl(config: BillingConfig, clientSecret: string) {
    const url = new URL("/unifiedcheckout/", config.baseUrl);
    url.searchParams.set("publicKey", config.publicKey ?? "");
    url.searchParams.set("clientSecret", clientSecret);
    return url.toString();
  }

  private verifyPaymobTransactionWebhook(
    objValue: unknown,
    receivedHmacValue: string,
    config: BillingConfig,
  ): VerifiedPaymobTransaction {
    const obj = this.recordValue(objValue);
    const order = this.recordValue(obj.order);
    const sourceData = this.recordValue(obj.source_data);
    const signedValues = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_refunded,
      obj.is_standalone_payment,
      obj.is_voided,
      order.id,
      obj.owner,
      obj.pending,
      sourceData.pan,
      sourceData.sub_type,
      sourceData.type,
      obj.success,
    ];

    if (signedValues.some((value) => value === undefined || value === null)) {
      throw new BadRequestException(
        "Paymob SaaS billing callback is missing signed fields",
      );
    }

    const receivedHmac = receivedHmacValue.trim().toLowerCase();
    if (!/^[a-f0-9]{128}$/.test(receivedHmac) || !config.hmacSecret) {
      throw new BadRequestException(
        "Paymob SaaS billing callback signature is invalid",
      );
    }

    const computedHmac = createHmac("sha512", config.hmacSecret)
      .update(signedValues.map((value) => String(value)).join(""))
      .digest("hex");

    if (
      !timingSafeEqual(
        Buffer.from(computedHmac, "hex"),
        Buffer.from(receivedHmac, "hex"),
      )
    ) {
      throw new BadRequestException(
        "Paymob SaaS billing callback HMAC verification failed",
      );
    }

    const providerTransactionId = this.identifierString(obj.id);
    const providerOrderId = this.identifierString(order.id);
    const merchantReference = this.identifierString(order.merchant_order_id);
    const integrationId = this.integerValue(obj.integration_id);
    const amountMinor = this.integerValue(obj.amount_cents);
    const currency = this.stringValue(obj.currency);
    const pending = this.booleanValue(obj.pending);
    const success = this.booleanValue(obj.success);
    const isLive = this.booleanValue(obj.is_live);

    if (
      !providerTransactionId ||
      !providerOrderId ||
      integrationId === undefined ||
      amountMinor === undefined ||
      !currency ||
      pending === undefined ||
      success === undefined
    ) {
      throw new BadRequestException(
        "Paymob SaaS billing callback contains invalid verified values",
      );
    }

    if (
      integrationId !== config.online3dsIntegrationId &&
      integrationId !== config.motoIntegrationId
    ) {
      throw new BadRequestException(
        "Paymob SaaS billing callback integration is not configured for Balcona billing",
      );
    }

    if (isLive !== undefined && isLive !== config.expectedLive) {
      throw new BadRequestException(
        "Paymob SaaS billing callback test/live environment mismatch",
      );
    }

    return {
      eventKey: `paymob_saas_tx_${providerTransactionId}_${computedHmac.slice(
        0,
        32,
      )}`,
      providerTransactionId,
      providerOrderId,
      merchantReference,
      integrationId,
      amountMinor,
      currency,
      pending,
      success,
      isLive: isLive ?? config.expectedLive,
      paidAt: this.dateValue(obj.paid_at),
    };
  }

  private async recordBillingEvent(input: {
    transaction: VerifiedPaymobTransaction;
    subscriptionId?: string;
    companyId?: string;
    attemptId?: string;
    providerSubscriptionReference?: string;
    eventType: string;
    processed: boolean;
  }) {
    const payloadHash = createHash("sha256")
      .update(
        JSON.stringify({
          transaction: input.transaction.providerTransactionId,
          order: input.transaction.providerOrderId,
          integration: input.transaction.integrationId,
          amount: input.transaction.amountMinor,
          currency: input.transaction.currency,
          pending: input.transaction.pending,
          success: input.transaction.success,
        }),
      )
      .digest("hex");

    await this.prisma.saasBillingEvent.upsert({
      where: { providerEventKey: input.transaction.eventKey },
      create: {
        companySubscriptionId: input.subscriptionId,
        companyId: input.companyId,
        paymentAttemptId: input.attemptId,
        provider: SaasBillingProvider.paymob,
        providerEventKey: input.transaction.eventKey,
        eventType: input.eventType,
        verified: true,
        payloadHash,
        safeMetadata: this.toJson({
          providerTransactionReference:
            input.transaction.providerTransactionId,
          providerOrderReference: input.transaction.providerOrderId,
          providerSubscriptionReference:
            input.providerSubscriptionReference,
          integrationId: input.transaction.integrationId,
          amountMinor: input.transaction.amountMinor,
          currency: input.transaction.currency,
          live: input.transaction.isLive,
        }),
        processedAt: input.processed ? new Date() : null,
      },
      update: {
        companySubscriptionId: input.subscriptionId,
        companyId: input.companyId,
        paymentAttemptId: input.attemptId,
        eventType: input.eventType,
        verified: true,
        payloadHash,
        processedAt: input.processed ? new Date() : undefined,
      },
    });
  }

  private async requireSubscription(companyId: string) {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: {
        company: {
          select: { id: true, name: true, slug: true, status: true },
        },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(
        "Company SaaS subscription is not configured",
      );
    }
    return subscription;
  }

  private publicSubscription(
    subscription: Awaited<ReturnType<SaasBillingService["requireSubscription"]>>,
  ) {
    return {
      id: subscription.id,
      companyId: subscription.companyId,
      planId: subscription.planId,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEndsAt: subscription.trialEndsAt,
      suspendedAt: subscription.suspendedAt,
      cancelledAt: subscription.cancelledAt,
      cancellationReason: subscription.cancellationReason,
      billingProvider: subscription.billingProvider,
      billingEnvironment: subscription.billingEnvironment,
      providerSubscriptionReference:
        subscription.providerSubscriptionReference,
      providerPlanReference: subscription.providerPlanReference,
      graceEndsAt: subscription.graceEndsAt,
      lastBillingSyncAt: subscription.lastBillingSyncAt,
    };
  }

  private mapProviderSubscriptionState(
    state: string | undefined,
    fallback: CompanySubscriptionStatus,
  ) {
    if (state === "active") {
      return CompanySubscriptionStatus.active;
    }
    if (state === "suspended") {
      return CompanySubscriptionStatus.suspended;
    }
    if (state === "cancelled" || state === "canceled") {
      return CompanySubscriptionStatus.cancelled;
    }
    return fallback;
  }

  private attemptIdFromMerchantReference(reference?: string) {
    if (!reference?.startsWith("saas:")) {
      return undefined;
    }
    const id = reference.slice("saas:".length);
    return /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id) ? id : undefined;
  }

  private configurationReadiness(config: BillingConfig) {
    if (!config.enabled) {
      return {
        ready: false,
        message: "Balcona SaaS billing is disabled",
      };
    }
    const missing = [
      ["apiKey", config.apiKey],
      ["secretKey", config.secretKey],
      ["publicKey", config.publicKey],
      ["hmacSecret", config.hmacSecret],
      ["transactionWebhookUrl", config.transactionWebhookUrl],
      ["subscriptionWebhookUrl", config.subscriptionWebhookUrl],
      ["returnUrl", config.returnUrl],
    ].filter(([, value]) => !value);

    if (
      missing.length > 0 ||
      config.online3dsIntegrationId <= 0 ||
      config.motoIntegrationId <= 0
    ) {
      return {
        ready: false,
        message:
          "Balcona SaaS billing Paymob credentials, 3DS/MOTO integrations, or callback URLs are incomplete",
      };
    }

    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    if (
      appEnvironment === "production" &&
      (!config.expectedLive ||
        config.environment !== SaasBillingEnvironment.live)
    ) {
      return {
        ready: false,
        message: "Production SaaS billing requires verified live configuration",
      };
    }

    return { ready: true, message: "Balcona SaaS billing is software-ready" };
  }

  private readConfig(required: boolean): BillingConfig {
    const expectedLive =
      this.configService.get<boolean>("saasBilling.expectedLive") ?? false;
    const config: BillingConfig = {
      enabled:
        this.configService.get<boolean>("saasBilling.enabled") ?? false,
      provider: SaasBillingProvider.paymob,
      environment: expectedLive
        ? SaasBillingEnvironment.live
        : SaasBillingEnvironment.test,
      expectedLive,
      baseUrl: (
        this.configService.get<string>("saasBilling.paymob.baseUrl") ??
        "https://accept.paymob.com"
      ).replace(/\/+$/, ""),
      apiKey: this.configService.get<string>("saasBilling.paymob.apiKey"),
      secretKey: this.configService.get<string>(
        "saasBilling.paymob.secretKey",
      ),
      publicKey: this.configService.get<string>(
        "saasBilling.paymob.publicKey",
      ),
      hmacSecret: this.configService.get<string>(
        "saasBilling.paymob.hmacSecret",
      ),
      online3dsIntegrationId:
        this.configService.get<number>(
          "saasBilling.paymob.online3dsIntegrationId",
        ) ?? 0,
      motoIntegrationId:
        this.configService.get<number>(
          "saasBilling.paymob.motoIntegrationId",
        ) ?? 0,
      transactionWebhookUrl: this.configService.get<string>(
        "saasBilling.paymob.transactionWebhookUrl",
      ),
      subscriptionWebhookUrl: this.configService.get<string>(
        "saasBilling.paymob.subscriptionWebhookUrl",
      ),
      returnUrl: this.configService.get<string>(
        "saasBilling.paymob.returnUrl",
      ),
      timeoutMs:
        this.configService.get<number>("saasBilling.paymob.timeoutMs") ??
        10_000,
      expirationSeconds:
        this.configService.get<number>(
          "saasBilling.paymob.expirationSeconds",
        ) ?? 900,
      graceDays:
        this.configService.get<number>("saasBilling.graceDays") ?? 7,
    };

    const readiness = this.configurationReadiness(config);
    if (required && !readiness.ready) {
      throw new ServiceUnavailableException(readiness.message);
    }
    return config;
  }

  private async fetchJson(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    label: string,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      const text = await response.text();
      let body: unknown = {};
      if (text.trim()) {
        try {
          body = JSON.parse(text) as unknown;
        } catch {
          body = { message: text.slice(0, 300) };
        }
      }
      if (!response.ok) {
        throw new ServiceUnavailableException(
          `${label} failed with provider status ${response.status}`,
        );
      }
      return body;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      throw new ServiceUnavailableException(
        `${label} is temporarily unavailable`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private recordValue(value: unknown): JsonRecord {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonRecord)
      : {};
  }

  private stringValue(value: unknown) {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;
  }

  private identifierString(value: unknown) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
    return undefined;
  }

  private integerValue(value: unknown) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      const parsed = Number.parseInt(value, 10);
      return Number.isSafeInteger(parsed) ? parsed : undefined;
    }
    return undefined;
  }

  private booleanValue(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }
    if (value === "true" || value === "1" || value === 1) {
      return true;
    }
    if (value === "false" || value === "0" || value === 0) {
      return false;
    }
    return undefined;
  }

  private dateValue(value: unknown) {
    if (typeof value !== "string" || !value.trim()) {
      return undefined;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  private addDays(value: Date, days: number) {
    return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private toJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
  }

  private safeErrorMessage(error: unknown) {
    if (error instanceof Error) {
      return error.message.slice(0, 240);
    }
    return "Provider request failed";
  }
}
