import {
  BillStatus,
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
} from "@prisma/client";
import { OnlinePaymentsService } from "./online-payments.service";
import { PaymentProviderError } from "./providers/payment-provider.types";

const now = new Date("2026-06-05T10:00:00.000Z");

function intent(
  status: OnlinePaymentIntentStatus = OnlinePaymentIntentStatus.pending,
  provider: OnlinePaymentProvider = OnlinePaymentProvider.mock,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "intent-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableSessionId: "session-1",
    billId: "bill-1",
    provider,
    providerIntentId:
      provider === OnlinePaymentProvider.paymob ? "pi_test_123" : "mock-intent-1",
    providerOrderId:
      provider === OnlinePaymentProvider.paymob ? "12345" : null,
    providerCheckoutUrl:
      provider === OnlinePaymentProvider.paymob
        ? "https://accept.paymob.com/unifiedcheckout/?publicKey=test-public&clientSecret=test-client"
        : "http://localhost:3001/mock-payments/mock-intent-1",
    idempotencyKey: "key-1",
    status,
    amountMinor: 12500,
    currency: "EGP",
    customerReturnUrl: null,
    checkoutExpiresAt: new Date("2026-06-05T10:15:00.000Z"),
    succeededAt: status === OnlinePaymentIntentStatus.succeeded ? now : null,
    failedAt: null,
    cancelledAt: null,
    expiredAt: null,
    failureCode: null,
    failureMessage: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    bill: {
      id: "bill-1",
      billNumber: "BILL-00001",
      status:
        status === OnlinePaymentIntentStatus.succeeded
          ? BillStatus.paid
          : BillStatus.payment_pending,
      totalMinor: 12500,
      paidMinor: status === OnlinePaymentIntentStatus.succeeded ? 12500 : 0,
      balanceDueMinor:
        status === OnlinePaymentIntentStatus.succeeded ? 0 : 12500,
      currency: "EGP",
    },
    tableSession: {
      id: "session-1",
      status: "active",
      table: {
        id: "table-1",
        code: "T01",
        displayName: "Table 1",
      },
    },
    events: [],
    ...overrides,
  };
}

function createService(provider = "mock", environment = "test") {
  const tx = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    onlinePaymentEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
    onlinePaymentIntent: {
      findFirst: jest.fn().mockResolvedValue(intent()),
      findUnique: jest
        .fn()
        .mockResolvedValue(intent(OnlinePaymentIntentStatus.succeeded)),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    bill: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    ...tx,
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "onlinePayments.enabled") {
        return true;
      }

      if (key === "onlinePayments.provider") {
        return provider;
      }

      if (key === "onlinePayments.mockEnabled") {
        return true;
      }

      if (key === "onlinePayments.checkoutBaseUrl") {
        return "http://localhost:3001";
      }

      if (key === "app.environment") {
        return environment;
      }

      return undefined;
    }),
  };
  const billsService = {
    settleBillWithOnlinePayment: jest.fn().mockResolvedValue({
      settled: true,
      reason: "settled",
      billResponse: { bill: { id: "bill-1", status: BillStatus.paid } },
    }),
  };
  const realtimeEventsService = {
    recordOnlinePaymentIntentCreated: jest.fn().mockResolvedValue(undefined),
    recordOnlinePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
    recordOnlinePaymentFailed: jest.fn().mockResolvedValue(undefined),
  };
  const saasService = {
    assertCompanyFeatureEnabled: jest.fn().mockResolvedValue(undefined),
  };
  const paymobPaymentProviderService = {
    createPayment: jest.fn(),
    verifyTransactionWebhook: jest.fn(),
  };
  const service = new OnlinePaymentsService(
    prisma as never,
    configService as never,
    billsService as never,
    realtimeEventsService as never,
    saasService as never,
    paymobPaymentProviderService as never,
  );

  return {
    service,
    tx,
    billsService,
    realtimeEventsService,
    saasService,
    paymobPaymentProviderService,
  };
}

describe("OnlinePaymentsService", () => {
  it("blocks customer online payment creation when the plan does not include online payments", async () => {
    const { service, tx, saasService } = createService();
    tx.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableSessionId: "session-1",
      status: BillStatus.presented,
      currency: "EGP",
      totalMinor: 12500,
      balanceDueMinor: 12500,
    });
    saasService.assertCompanyFeatureEnabled.mockRejectedValueOnce(
      new Error("Your current plan does not include online payments."),
    );

    await expect(
      service.createIntentForCustomer("session-1", "bill-1"),
    ).rejects.toThrow("Your current plan does not include online payments.");
    expect(tx.onlinePaymentIntent.create).not.toHaveBeenCalled();
  });

  it("forbids the mock provider for customer payment creation in production", async () => {
    const { service, tx } = createService("mock", "production");

    await expect(
      service.createIntentForCustomer("session-1", "bill-1"),
    ).rejects.toThrow("Mock online payments are forbidden in production");

    expect(tx.bill.findUnique).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.create).not.toHaveBeenCalled();
  });

  it("serializes mock intent creation with a bill advisory lock before checking active intents", async () => {
    const { service, tx } = createService("mock");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.mock,
    );
    tx.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableSessionId: "session-1",
      status: BillStatus.presented,
      currency: "EGP",
      totalMinor: 12500,
      balanceDueMinor: 12500,
    });
    tx.onlinePaymentIntent.findFirst.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.create.mockResolvedValueOnce(pendingIntent);

    const result = await service.createIntentForCustomer(
      "session-1",
      "bill-1",
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentIntent.create).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.onlinePaymentIntent.findFirst.mock.invocationCallOrder[0],
    );
    expect(result.outcome).toBe("created");
  });

  it("rejects a stale active intent whose amount no longer matches the bill", async () => {
    const { service, tx } = createService("mock");
    tx.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableSessionId: "session-1",
      status: BillStatus.payment_pending,
      currency: "EGP",
      totalMinor: 12500,
      balanceDueMinor: 12500,
    });
    tx.onlinePaymentIntent.findFirst.mockResolvedValueOnce(
      intent(
        OnlinePaymentIntentStatus.pending,
        OnlinePaymentProvider.mock,
        { amountMinor: 10000 },
      ),
    );

    await expect(
      service.createIntentForCustomer("session-1", "bill-1"),
    ).rejects.toThrow(
      "Bill amount or currency changed while an online payment is active",
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentIntent.create).not.toHaveBeenCalled();
  });

  it("rejects an active intent owned by another configured provider", async () => {
    const { service, tx } = createService("mock");
    tx.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableSessionId: "session-1",
      status: BillStatus.payment_pending,
      currency: "EGP",
      totalMinor: 12500,
      balanceDueMinor: 12500,
    });
    tx.onlinePaymentIntent.findFirst.mockResolvedValueOnce(
      intent(
        OnlinePaymentIntentStatus.pending,
        OnlinePaymentProvider.paymob,
      ),
    );

    await expect(
      service.createIntentForCustomer("session-1", "bill-1"),
    ).rejects.toThrow(
      "Bill already has an active online payment with another provider",
    );

    expect(tx.onlinePaymentIntent.create).not.toHaveBeenCalled();
  });

  it("requires billing data before Paymob checkout initialization", async () => {
    const { service, tx, paymobPaymentProviderService } = createService("paymob");

    await expect(
      service.createIntentForCustomer("session-1", "bill-1", {
        idempotencyKey: "paymob-key-1",
      }),
    ).rejects.toThrow("Billing data is required to prepare Paymob checkout");

    expect(tx.bill.findUnique).not.toHaveBeenCalled();
    expect(paymobPaymentProviderService.createPayment).not.toHaveBeenCalled();
  });

  it("creates a local Paymob intent before the provider call and finalizes hosted checkout", async () => {
    const {
      service,
      tx,
      paymobPaymentProviderService,
      realtimeEventsService,
    } = createService("paymob");
    const localIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
      {
        providerIntentId: null,
        providerCheckoutUrl: null,
        checkoutExpiresAt: null,
        idempotencyKey: "paymob-key-1",
      },
    );
    const readyIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
      {
        idempotencyKey: "paymob-key-1",
      },
    );

    tx.bill.findUnique.mockResolvedValueOnce({
      id: "bill-1",
      companyId: "company-1",
      branchId: "branch-1",
      tableSessionId: "session-1",
      status: BillStatus.presented,
      currency: "EGP",
      totalMinor: 12500,
      balanceDueMinor: 12500,
    });
    tx.onlinePaymentIntent.findFirst.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.create.mockResolvedValueOnce(localIntent);
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(readyIntent);
    paymobPaymentProviderService.createPayment.mockResolvedValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerIntentId: "pi_test_123",
      providerOrderId: "12345",
      status: OnlinePaymentIntentStatus.pending,
      checkoutUrl:
        "https://accept.paymob.com/unifiedcheckout/?publicKey=test-public&clientSecret=test-client",
      checkoutExpiresAt: new Date("2026-06-05T10:15:00.000Z"),
      metadata: {
        expectedLive: false,
      },
    });

    const result = await service.createIntentForCustomer(
      "session-1",
      "bill-1",
      {
        idempotencyKey: "paymob-key-1",
        customerReturnUrl: "https://app.example.com/payment/return",
        billingData: {
          firstName: "Omar",
          lastName: "Khair",
          email: "omar@example.com",
          phoneNumber: "+201001234567",
        },
      },
    );

    expect(tx.onlinePaymentIntent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: OnlinePaymentProvider.paymob,
          providerIntentId: null,
          providerCheckoutUrl: null,
          amountMinor: 12500,
          currency: "EGP",
        }),
      }),
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.onlinePaymentIntent.create.mock.invocationCallOrder[0],
    );
    expect(paymobPaymentProviderService.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        localIntentId: "intent-1",
        amountMinor: 12500,
        currency: "EGP",
        billingData: expect.objectContaining({
          email: "omar@example.com",
        }),
      }),
    );
    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "intent-1",
          provider: OnlinePaymentProvider.paymob,
          providerIntentId: null,
        }),
        data: expect.objectContaining({
          providerIntentId: "pi_test_123",
          status: OnlinePaymentIntentStatus.pending,
        }),
      }),
    );
    expect(
      realtimeEventsService.recordOnlinePaymentIntentCreated,
    ).toHaveBeenCalledWith("intent-1", tx);
    expect(result.checkout).toMatchObject({
      provider: OnlinePaymentProvider.paymob,
      url: readyIntent.providerCheckoutUrl,
      requiresHostedCheckout: true,
    });
  });

  it("settles a verified Paymob success exactly through the existing guarded bill settlement", async () => {
    const {
      service,
      tx,
      billsService,
      realtimeEventsService,
      paymobPaymentProviderService,
    } = createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    const succeededIntent = intent(
      OnlinePaymentIntentStatus.succeeded,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555001_hash",
      providerTransactionId: "555001",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      safeMetadata: {
        sourceType: "card",
        sourceSubtype: "MasterCard",
      },
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(pendingIntent)
      .mockResolvedValueOnce(succeededIntent)
      .mockResolvedValueOnce(succeededIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(paymobPaymentProviderService.verifyTransactionWebhook).toHaveBeenCalledWith(
      { signed: "payload" },
      "verified-hmac",
    );
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          provider: OnlinePaymentProvider.paymob,
          providerEventId: "paymob_tx_555001_hash",
          type: OnlinePaymentEventType.provider_webhook_received,
        }),
      }),
    );
    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "intent-1",
          provider: OnlinePaymentProvider.paymob,
          providerOrderId: "12345",
        }),
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.succeeded,
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        billId: "bill-1",
        onlinePaymentIntentId: "intent-1",
        provider: OnlinePaymentProvider.paymob,
        providerEventId: "paymob_tx_555001_hash",
        amountMinor: 12500,
      }),
      tx,
    );
    expect(
      realtimeEventsService.recordOnlinePaymentSucceeded,
    ).toHaveBeenCalledWith("intent-1", tx);
    expect(result.settlement).toMatchObject({ settled: true });
  });

  it("recovers a verified late Paymob success after an earlier local failed state", async () => {
    const {
      service,
      tx,
      billsService,
      paymobPaymentProviderService,
    } = createService("paymob");
    const failedIntent = intent(
      OnlinePaymentIntentStatus.failed,
      OnlinePaymentProvider.paymob,
      {
        failedAt: now,
        failureCode: "paymob_transaction_failed",
        failureMessage: "Paymob transaction failed",
      },
    );
    const succeededIntent = intent(
      OnlinePaymentIntentStatus.succeeded,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555003_late_success",
      providerTransactionId: "555003",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      safeMetadata: {},
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(succeededIntent)
      .mockResolvedValueOnce(succeededIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "intent-1",
          status: { not: OnlinePaymentIntentStatus.succeeded },
        }),
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.succeeded,
          failedAt: null,
          cancelledAt: null,
          expiredAt: null,
          failureCode: null,
          failureMessage: null,
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(result.settlement).toMatchObject({ settled: true });
  });

  it("rejects an invalid Paymob HMAC before reading or mutating payment state", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    paymobPaymentProviderService.verifyTransactionWebhook.mockImplementationOnce(
      () => {
        throw new PaymentProviderError(
          "bad signature",
          "signature_invalid",
        );
      },
    );

    await expect(
      service.processPaymobWebhook("bad-hmac", { signed: "payload" }),
    ).rejects.toThrow("Invalid Paymob webhook signature");

    expect(tx.onlinePaymentEvent.findUnique).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.updateMany).not.toHaveBeenCalled();
    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
  });

  it("acknowledges an unmatched verified Paymob order without settlement", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_777001_unmatched",
      providerTransactionId: "777001",
      providerOrderId: "99999",
      merchantReference: "missing-intent",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      safeMetadata: {},
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique.mockResolvedValueOnce(null);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(tx.onlinePaymentEvent.create).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.updateMany).not.toHaveBeenCalled();
    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      received: true,
      outcome: "unmatched_provider_order",
      providerOrderId: "99999",
      settlement: {
        settled: false,
        reason: "unmatched_provider_order",
      },
    });
  });

  it("deduplicates the same verified Paymob callback without double settlement", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    const succeededIntent = intent(
      OnlinePaymentIntentStatus.succeeded,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555001_hash",
      providerTransactionId: "555001",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      safeMetadata: {},
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce({
      onlinePaymentIntentId: "intent-1",
    });
    tx.onlinePaymentIntent.findUnique.mockResolvedValueOnce(succeededIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: "duplicate_event",
      settlement: { reason: "duplicate_event" },
    });
  });

  it("records and rejects a signed Paymob amount mismatch without settlement", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555001_amount",
      providerTransactionId: "555001",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 9900,
      currency: "EGP",
      actionable: true,
      safeMetadata: {},
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique.mockResolvedValueOnce(pendingIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.updateMany).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_skipped,
        }),
      }),
    );
    expect(result.settlement).toMatchObject({ reason: "amount_mismatch" });
  });

  it("keeps auth-only Paymob callbacks in requires_action and does not settle", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    const authIntent = intent(
      OnlinePaymentIntentStatus.requires_action,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555001_auth",
      providerTransactionId: "555001",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.requires_action,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      safeMetadata: { isAuth: true, isCapture: false },
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(pendingIntent)
      .mockResolvedValueOnce(authIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.requires_action,
        }),
      }),
    );
    expect(result.outcome).toBe("status_updated");
  });

  it("ignores verified Paymob child transactions until capture/refund phases", async () => {
    const { service, tx, billsService, paymobPaymentProviderService } =
      createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555002_child",
      providerTransactionId: "555002",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: false,
      safeMetadata: { hasParentTransaction: true },
    });
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentIntent.findUnique.mockResolvedValueOnce(pendingIntent);

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { signed: "payload" },
    );

    expect(tx.onlinePaymentIntent.updateMany).not.toHaveBeenCalled();
    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(result.outcome).toBe("child_transaction_ignored");
  });

  it("settles a mock success webhook once through the guarded bill settlement", async () => {
    const { service, tx, billsService, realtimeEventsService } =
      createService();

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-1",
      status: "succeeded",
    });

    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "intent-1",
          status: { in: ["pending", "requires_action"] },
        }),
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.succeeded,
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_completed,
        }),
      }),
    );
    expect(
      realtimeEventsService.recordOnlinePaymentSucceeded,
    ).toHaveBeenCalledWith("intent-1", tx);
    expect(result.settlement).toMatchObject({ settled: true });
  });

  it("ignores a duplicate mock webhook event without double-settling", async () => {
    const { service, tx, billsService } = createService();
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce({
      onlinePaymentIntentId: "intent-1",
    });

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-duplicate",
      status: "succeeded",
    });

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: "duplicate_event",
      settlement: { settled: false, reason: "duplicate_event" },
    });
  });

  it("records settlement_skipped when online success arrives after manual payment", async () => {
    const { service, tx, billsService } = createService();
    billsService.settleBillWithOnlinePayment.mockResolvedValueOnce({
      settled: false,
      reason: "bill_already_paid",
      message: "Bill is already paid",
      billResponse: { bill: { id: "bill-1", status: BillStatus.paid } },
    });

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-after-manual",
      status: "succeeded",
    });

    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_skipped,
        }),
      }),
    );
    expect(result.settlement).toMatchObject({
      settled: false,
      reason: "bill_already_paid",
    });
  });

  it("rejects an unsafe success amount without bill settlement", async () => {
    const { service, tx, billsService } = createService();

    await expect(
      service.processMockWebhook({
        intentId: "intent-1",
        providerEventId: "evt-amount-mismatch",
        status: "succeeded",
        amountMinor: 9900,
      }),
    ).rejects.toThrow("Online payment amount does not match the intent amount");

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_skipped,
        }),
      }),
    );
  });
});
