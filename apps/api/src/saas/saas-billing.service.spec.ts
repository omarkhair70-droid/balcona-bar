import { createHmac } from "node:crypto";
import {
  CompanySubscriptionStatus,
  SaasBillingEnvironment,
  SaasBillingPaymentAttemptStatus,
  SaasBillingProvider,
} from "@prisma/client";
import { SaasBillingService } from "./saas-billing.service";

const attemptId = "11111111-1111-4111-8111-111111111111";

function billingConfig(enabled = true) {
  const values: Record<string, unknown> = {
    "saasBilling.enabled": enabled,
    "saasBilling.expectedLive": false,
    "saasBilling.paymob.baseUrl": "https://accept.paymob.test",
    "saasBilling.paymob.apiKey": "billing-api-key",
    "saasBilling.paymob.secretKey": "billing-secret-key",
    "saasBilling.paymob.publicKey": "billing-public-key",
    "saasBilling.paymob.hmacSecret": "billing-hmac-secret",
    "saasBilling.paymob.online3dsIntegrationId": 101,
    "saasBilling.paymob.motoIntegrationId": 202,
    "saasBilling.paymob.transactionWebhookUrl":
      "https://api.example.com/api/v1/saas-billing/webhooks/paymob/transaction",
    "saasBilling.paymob.subscriptionWebhookUrl":
      "https://api.example.com/api/v1/saas-billing/webhooks/paymob/subscription",
    "saasBilling.paymob.returnUrl":
      "https://app.example.com/office/account",
    "saasBilling.paymob.timeoutMs": 10_000,
    "saasBilling.paymob.expirationSeconds": 900,
    "saasBilling.graceDays": 7,
    "app.environment": "test",
  };

  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function webhookObject(overrides: Record<string, unknown> = {}) {
  return {
    amount_cents: 12500,
    created_at: "2026-08-30T12:00:00.000Z",
    currency: "EGP",
    error_occured: false,
    has_parent_transaction: false,
    id: 555001,
    integration_id: 101,
    is_3d_secure: true,
    is_auth: false,
    is_capture: false,
    is_refunded: false,
    is_standalone_payment: true,
    is_voided: false,
    order: {
      id: 700001,
      merchant_order_id: `saas:${attemptId}`,
    },
    owner: 900001,
    pending: false,
    source_data: {
      pan: "2345",
      sub_type: "MasterCard",
      type: "card",
    },
    success: true,
    is_live: false,
    paid_at: "2026-08-30T12:00:05.000Z",
    ...overrides,
  };
}

function signWebhook(obj: ReturnType<typeof webhookObject>) {
  const order = obj.order as Record<string, unknown>;
  const source = obj.source_data as Record<string, unknown>;
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
    source.pan,
    source.sub_type,
    source.type,
    obj.success,
  ];

  return createHmac("sha512", "billing-hmac-secret")
    .update(signedValues.map((value) => String(value)).join(""))
    .digest("hex");
}

function setup(enabled = true) {
  const subscription = {
    id: "subscription-1",
    companyId: "company-1",
    planId: "plan-1",
    status: CompanySubscriptionStatus.trialing,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    trialEndsAt: null,
    suspendedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    billingProvider: SaasBillingProvider.paymob,
    billingEnvironment: SaasBillingEnvironment.test,
    providerCustomerReference: null,
    providerSubscriptionReference: null,
    providerPlanReference: "55",
    graceEndsAt: null,
    lastBillingSyncAt: null,
    billingMetadata: null,
    metadata: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    plan: {
      id: "plan-1",
      code: "starter",
      name: "Starter",
      status: "active",
      monthlyPriceMinor: 12500,
      currency: "EGP",
    },
  };

  const attempt = {
    id: attemptId,
    companySubscriptionId: subscription.id,
    companyId: subscription.companyId,
    provider: SaasBillingProvider.paymob,
    environment: SaasBillingEnvironment.test,
    status: SaasBillingPaymentAttemptStatus.requires_action,
    providerIntentionReference: "intention-1",
    providerOrderReference: "700001",
    providerTransactionReference: null,
    amountMinor: 12500,
    currency: "EGP",
    checkoutUrl: "https://accept.paymob.test/unifiedcheckout/",
    failureCode: null,
    failureMessage: null,
    periodStart: new Date("2026-08-30T12:00:00.000Z"),
    periodEnd: new Date("2026-09-29T12:00:00.000Z"),
    succeededAt: null,
    failedAt: null,
    metadata: null,
    createdAt: new Date("2026-08-30T11:55:00.000Z"),
    updatedAt: new Date("2026-08-30T11:55:00.000Z"),
    subscription,
  };

  const invoice = {
    id: "invoice-1",
    paymentAttemptId: attemptId,
    periodStart: attempt.periodStart,
    periodEnd: attempt.periodEnd,
  };

  const prisma = {
    companySubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn().mockResolvedValue(subscription),
    },
    saasPlan: {
      findUnique: jest.fn(),
    },
    saasBillingPaymentAttempt: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(attempt),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(attempt),
    },
    saasBillingInvoice: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(invoice),
      update: jest.fn().mockResolvedValue(invoice),
    },
    saasBillingEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
    $transaction: jest.fn(),
  };
  const configService = billingConfig(enabled);
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };
  const service = new SaasBillingService(
    prisma as never,
    configService as never,
    auditService as never,
  );

  return { service, prisma, auditService, subscription, attempt };
}

describe("SaasBillingService", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("fails checkout closed before database access when SaaS billing is disabled", async () => {
    const { service, prisma } = setup(false);

    await expect(
      service.startCompanyCheckout("company-1", "staff-1", {
        firstName: "Omar",
        lastName: "Khair",
        email: "owner@example.com",
        phoneNumber: "+201000000000",
      }),
    ).rejects.toThrow("Balcona SaaS billing is disabled");

    expect(prisma.companySubscription.findUnique).not.toHaveBeenCalled();
    expect(prisma.saasBillingPaymentAttempt.create).not.toHaveBeenCalled();
  });

  it("rejects a Paymob transaction before persistence when HMAC is invalid", async () => {
    const { service, prisma } = setup(true);
    const obj = webhookObject();

    await expect(
      service.processPaymobTransactionWebhook("0".repeat(128), obj),
    ).rejects.toThrow(
      "Paymob SaaS billing callback HMAC verification failed",
    );

    expect(prisma.saasBillingEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.saasBillingPaymentAttempt.update).not.toHaveBeenCalled();
    expect(prisma.companySubscription.update).not.toHaveBeenCalled();
  });

  it("reuses a recurring attempt already linked to the provider transaction", async () => {
    const { service, prisma, attempt } = setup(true);
    const recurring = webhookObject({
      order: {
        id: 700002,
        merchant_order_id: "provider-recurring-order",
      },
      integration_id: 202,
    });
    const hmac = signWebhook(recurring);

    prisma.saasBillingPaymentAttempt.findUnique.mockResolvedValueOnce(null);
    prisma.saasBillingPaymentAttempt.findFirst.mockResolvedValueOnce({
      ...attempt,
      providerTransactionReference: "555001",
      providerOrderReference: "700002",
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ token: "provider-auth-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 991,
              state: "active",
              plan_id: 55,
              starts_at: "2026-08-30T12:00:00.000Z",
              next_billing: "2026-09-29T12:00:00.000Z",
            },
          ]),
      }) as typeof fetch;

    await service.processPaymobTransactionWebhook(hmac, recurring);

    expect(prisma.saasBillingPaymentAttempt.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          provider: SaasBillingProvider.paymob,
          providerTransactionReference: "555001",
        },
      }),
    );
    expect(prisma.saasBillingPaymentAttempt.create).not.toHaveBeenCalled();
  });

  it("activates the subscription only after verified provider transaction truth", async () => {
    const { service, prisma, auditService } = setup(true);
    const obj = webhookObject();
    const hmac = signWebhook(obj);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ token: "provider-auth-token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify([
            {
              id: 991,
              state: "active",
              plan_id: 55,
              starts_at: "2026-08-30T12:00:00.000Z",
              next_billing: "2026-09-29T12:00:00.000Z",
            },
          ]),
      });
    global.fetch = fetchMock as typeof fetch;

    const result = await service.processPaymobTransactionWebhook(hmac, obj);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(prisma.saasBillingPaymentAttempt.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: attemptId },
        data: expect.objectContaining({
          status: SaasBillingPaymentAttemptStatus.succeeded,
          providerTransactionReference: "555001",
        }),
      }),
    );
    expect(prisma.saasBillingInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invoice-1" },
        data: expect.objectContaining({ status: "paid" }),
      }),
    );
    expect(prisma.companySubscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "subscription-1" },
        data: expect.objectContaining({
          status: CompanySubscriptionStatus.active,
          providerSubscriptionReference: "991",
        }),
      }),
    );
    expect(prisma.saasBillingEvent.upsert).toHaveBeenCalled();
    expect(auditService.recordAuditLog).toHaveBeenCalled();
    expect(result).toEqual({ accepted: true, status: "succeeded" });
  });
});
