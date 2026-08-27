import {
  BillStatus,
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
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
    operations: [],
    ...overrides,
  };
}

function operation(
  type: OnlinePaymentOperationType,
  status: OnlinePaymentOperationStatus,
  overrides: Record<string, unknown> = {},
) {
  const paymentIntent = intent(
    type === OnlinePaymentOperationType.capture
      ? OnlinePaymentIntentStatus.requires_action
      : OnlinePaymentIntentStatus.succeeded,
    OnlinePaymentProvider.paymob,
    {
      metadata: { paymobTransactionId: "555001" },
    },
  );

  return {
    id: "operation-1",
    onlinePaymentIntentId: "intent-1",
    companyId: "company-1",
    branchId: "branch-1",
    billId: "bill-1",
    provider: OnlinePaymentProvider.paymob,
    type,
    status,
    idempotencyKey: "operation-key-1",
    parentProviderTransactionId: "555001",
    providerTransactionId:
      status === OnlinePaymentOperationStatus.pending ? null : "555010",
    amountMinor:
      type === OnlinePaymentOperationType.refund ? 5000 : 12500,
    currency: "EGP",
    reason: "customer request",
    requestedByStaffUserId: "staff-1",
    requestedAt: now,
    completedAt:
      status === OnlinePaymentOperationStatus.succeeded ? now : null,
    failedAt: status === OnlinePaymentOperationStatus.failed ? now : null,
    failureCode: null,
    failureMessage: null,
    metadata:
      type === OnlinePaymentOperationType.refund
        ? { previousRefundedMinor: 0, expectedRefundedMinor: 5000 }
        : {},
    createdAt: now,
    updatedAt: now,
    onlinePaymentIntent: paymentIntent,
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
      findMany: jest.fn().mockResolvedValue([]),
    },
    onlinePaymentOperation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

      if (key === "onlinePayments.reconciliation.enabled") {
        return false;
      }

      return undefined;
    }),
  };
  const billsService = {
    refreshReceiptForOnlinePaymentAdjustment: jest
      .fn()
      .mockResolvedValue("receipt-1"),
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
  const auditService = {
    recordAuditLog: jest.fn().mockResolvedValue({ id: "audit-1" }),
  };
  const paymobPaymentProviderService = {
    createPayment: jest.fn(),
    verifyTransactionWebhook: jest.fn(),
    inquireTransactionByOrder: jest.fn(),
    inquireTransactionById: jest.fn(),
    refundTransaction: jest.fn(),
    voidTransaction: jest.fn(),
    captureTransaction: jest.fn(),
  };
  const fawryPaymentProviderService = {
    createPayment: jest.fn(),
    verifyNotification: jest.fn(),
    inquireByMerchantReference: jest.fn(),
  };
  const service = new OnlinePaymentsService(
    prisma as never,
    configService as never,
    billsService as never,
    realtimeEventsService as never,
    saasService as never,
    auditService as never,
    paymobPaymentProviderService as never,
    fawryPaymentProviderService as never,
  );

  return {
    service,
    tx,
    billsService,
    realtimeEventsService,
    saasService,
    auditService,
    paymobPaymentProviderService,
    fawryPaymentProviderService,
  };
}

function providerState(
  overrides: Record<string, unknown> = {},
) {
  return {
    provider: OnlinePaymentProvider.paymob,
    providerEventId: "paymob_inquiry_555001_state",
    providerTransactionId: "555001",
    providerOrderId: "12345",
    merchantReference: "intent-1",
    integrationId: 101,
    status: OnlinePaymentIntentStatus.succeeded,
    amountMinor: 12500,
    currency: "EGP",
    actionable: true,
    hasParentTransaction: false,
    isLive: false,
    safeMetadata: {
      sourceType: "card",
      pending: false,
      success: true,
      errorOccurred: false,
      isRefunded: false,
      isVoided: false,
      isCaptured: false,
    },
    ...overrides,
  };
}

function setupOperationHarness(
  context: ReturnType<typeof createService>,
  type: OnlinePaymentOperationType,
  intentStatus: OnlinePaymentIntentStatus,
) {
  const { tx } = context;
  let currentIntent = intent(
    intentStatus,
    OnlinePaymentProvider.paymob,
    {
      metadata: { paymobTransactionId: "555001" },
    },
  );
  let currentOperation: any = null;

  tx.onlinePaymentIntent.findUnique.mockImplementation(async () => currentIntent);
  tx.onlinePaymentIntent.updateMany.mockImplementation(async ({ data }: any) => {
    currentIntent = {
      ...currentIntent,
      ...data,
      status: data?.status ?? currentIntent.status,
    };
    if (currentOperation) {
      currentOperation.onlinePaymentIntent = currentIntent;
    }
    return { count: 1 };
  });

  tx.onlinePaymentOperation.findUnique.mockImplementation(
    async ({ where }: any) => {
      if (where?.idempotencyKey) {
        return null;
      }

      return currentOperation;
    },
  );
  tx.onlinePaymentOperation.findFirst.mockResolvedValue(null);
  tx.onlinePaymentOperation.findMany.mockResolvedValue([]);
  tx.onlinePaymentOperation.create.mockImplementation(async ({ data }: any) => {
    currentOperation = {
      ...operation(type, OnlinePaymentOperationStatus.pending),
      ...data,
      providerTransactionId: null,
      onlinePaymentIntent: currentIntent,
    };
    return currentOperation;
  });
  tx.onlinePaymentOperation.updateMany.mockImplementation(
    async ({ data }: any) => {
      if (currentOperation) {
        currentOperation = {
          ...currentOperation,
          ...data,
          onlinePaymentIntent: currentIntent,
        };
      }
      return { count: 1 };
    },
  );

  return {
    getIntent: () => currentIntent,
    getOperation: () => currentOperation,
    setOperation: (value: any) => {
      currentOperation = value;
    },
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
    tx.onlinePaymentIntent.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
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

  it("recovers a missed Paymob success through inquiry and settles exactly once", async () => {
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
    paymobPaymentProviderService.inquireTransactionByOrder.mockResolvedValueOnce({
      found: true,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
      transaction: {
        provider: OnlinePaymentProvider.paymob,
        providerEventId: "paymob_inquiry_555001_state",
        providerTransactionId: "555001",
        providerOrderId: "12345",
        merchantReference: "intent-1",
        integrationId: 101,
        status: OnlinePaymentIntentStatus.succeeded,
        amountMinor: 12500,
        currency: "EGP",
        actionable: true,
        safeMetadata: { inquiry: true, isLive: false },
      },
    });
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(succeededIntent)
      .mockResolvedValueOnce(succeededIntent);

    const result = await service.recoverPaymobIntent(
      "intent-1",
      "staff_manual",
    );

    expect(
      paymobPaymentProviderService.inquireTransactionByOrder,
    ).toHaveBeenCalledWith("12345");
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.provider_inquiry_received,
          providerEventId: "paymob_inquiry_555001_state",
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ settlement: { settled: true } });
  });

  it("reactivates a locally failed intent when Paymob inquiry says it is still pending", async () => {
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
    const recoveredIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.inquireTransactionByOrder.mockResolvedValueOnce({
      found: true,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
      transaction: {
        provider: OnlinePaymentProvider.paymob,
        providerEventId: "paymob_inquiry_555001_pending",
        providerTransactionId: "555001",
        providerOrderId: "12345",
        merchantReference: "intent-1",
        integrationId: 101,
        status: OnlinePaymentIntentStatus.pending,
        amountMinor: 12500,
        currency: "EGP",
        actionable: true,
        safeMetadata: { inquiry: true, isLive: false },
      },
    });
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(recoveredIntent);
    tx.onlinePaymentIntent.findFirst.mockResolvedValueOnce(null);

    const result = await service.recoverPaymobIntent(
      "intent-1",
      "staff_manual",
    );

    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.pending,
          failedAt: null,
          cancelledAt: null,
          expiredAt: null,
          failureCode: null,
          failureMessage: null,
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(result.outcome).toBe("status_recovered");
  });

  it("expires an active Paymob checkout after inquiry confirms no provider transaction exists", async () => {
    const {
      service,
      tx,
      paymobPaymentProviderService,
      realtimeEventsService,
    } = createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
      {
        checkoutExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    );
    const expiredIntent = intent(
      OnlinePaymentIntentStatus.expired,
      OnlinePaymentProvider.paymob,
      {
        checkoutExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        expiredAt: now,
        failureCode: "paymob_checkout_expired_without_transaction",
      },
    );
    paymobPaymentProviderService.inquireTransactionByOrder.mockResolvedValueOnce({
      found: false,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
    });
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(pendingIntent)
      .mockResolvedValueOnce(expiredIntent);

    const result = await service.recoverPaymobIntent(
      "intent-1",
      "scheduled_reconciliation",
    );

    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.expired,
          failureCode: "paymob_checkout_expired_without_transaction",
        }),
      }),
    );
    expect(
      realtimeEventsService.recordOnlinePaymentFailed,
    ).toHaveBeenCalledWith("intent-1", tx);
    expect(result.outcome).toBe("expired");
  });

  it("rejects inquiry amount mismatch without settling the bill", async () => {
    const {
      service,
      tx,
      billsService,
      paymobPaymentProviderService,
    } = createService("paymob");
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.inquireTransactionByOrder.mockResolvedValueOnce({
      found: true,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
      transaction: {
        provider: OnlinePaymentProvider.paymob,
        providerEventId: "paymob_inquiry_555001_amount",
        providerTransactionId: "555001",
        providerOrderId: "12345",
        merchantReference: "intent-1",
        integrationId: 101,
        status: OnlinePaymentIntentStatus.succeeded,
        amountMinor: 9900,
        currency: "EGP",
        actionable: true,
        safeMetadata: { inquiry: true, isLive: false },
      },
    });
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(pendingIntent)
      .mockResolvedValueOnce(pendingIntent);

    const result = await service.recoverPaymobIntent(
      "intent-1",
      "staff_manual",
    );

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(result).toMatchObject({ settlement: { reason: "amount_mismatch" } });
  });

  it("blocks a new Paymob retry when inquiry recovers the previous attempt as pending", async () => {
    const {
      service,
      tx,
      paymobPaymentProviderService,
    } = createService("paymob");
    const failedIntent = intent(
      OnlinePaymentIntentStatus.failed,
      OnlinePaymentProvider.paymob,
      {
        failedAt: now,
        failureCode: "paymob_transaction_failed",
      },
    );
    const pendingIntent = intent(
      OnlinePaymentIntentStatus.pending,
      OnlinePaymentProvider.paymob,
    );
    paymobPaymentProviderService.inquireTransactionByOrder.mockResolvedValueOnce({
      found: true,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
      transaction: {
        provider: OnlinePaymentProvider.paymob,
        providerEventId: "paymob_inquiry_555001_pending_retry",
        providerTransactionId: "555001",
        providerOrderId: "12345",
        merchantReference: "intent-1",
        integrationId: 101,
        status: OnlinePaymentIntentStatus.pending,
        amountMinor: 12500,
        currency: "EGP",
        actionable: true,
        safeMetadata: { inquiry: true, isLive: false },
      },
    });
    tx.onlinePaymentIntent.findFirst
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingIntent);
    tx.onlinePaymentIntent.findUnique
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(failedIntent)
      .mockResolvedValueOnce(pendingIntent);
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

    const result = await service.createIntentForCustomer(
      "session-1",
      "bill-1",
      {
        billingData: {
          firstName: "Omar",
          lastName: "Khair",
          email: "omar@example.com",
          phoneNumber: "+201001234567",
        },
      },
    );

    expect(paymobPaymentProviderService.createPayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentIntent.create).not.toHaveBeenCalled();
    expect(result.outcome).toBe("existing_active");
  });

  it("completes a partial refund only after authoritative child inquiry", async () => {
    const context = createService("paymob");
    const {
      service,
      tx,
      billsService,
      auditService,
      paymobPaymentProviderService,
    } = context;
    setupOperationHarness(
      context,
      OnlinePaymentOperationType.refund,
      OnlinePaymentIntentStatus.succeeded,
    );

    paymobPaymentProviderService.inquireTransactionById
      .mockResolvedValueOnce(providerState())
      .mockResolvedValueOnce(
        providerState({
          providerEventId: "paymob_inquiry_555010_refund",
          providerTransactionId: "555010",
          amountMinor: 5000,
          hasParentTransaction: true,
          parentProviderTransactionId: "555001",
          operationType: OnlinePaymentOperationType.refund,
          actionable: false,
          safeMetadata: {
            sourceType: "card",
            pending: false,
            success: true,
            errorOccurred: false,
            isRefund: true,
            isRefunded: false,
          },
        }),
      );
    paymobPaymentProviderService.refundTransaction.mockResolvedValueOnce({
      provider: OnlinePaymentProvider.paymob,
      type: OnlinePaymentOperationType.refund,
      status: OnlinePaymentOperationStatus.pending,
      parentProviderTransactionId: "555001",
      providerTransactionId: "555010",
      amountMinor: 5000,
      currency: "EGP",
      safeMetadata: { responseAccepted: true },
    });

    const result = await service.refundPaymobIntent(
      "intent-1",
      "staff-1",
      {
        amountMinor: 5000,
        idempotencyKey: "refund-key-1",
        reason: "customer request",
      },
    );

    expect(
      paymobPaymentProviderService.refundTransaction,
    ).toHaveBeenCalledWith({
      parentProviderTransactionId: "555001",
      amountMinor: 5000,
      expectedCurrency: "EGP",
    });
    expect(tx.onlinePaymentOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: OnlinePaymentOperationStatus.succeeded,
          providerTransactionId: "555010",
        }),
      }),
    );
    expect(
      billsService.refreshReceiptForOnlinePaymentAdjustment,
    ).toHaveBeenCalledWith("bill-1", tx);
    expect(auditService.recordAuditLog).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("succeeded");
    expect(result.operation.amountMinor).toBe(5000);
  });

  it("rejects refund amounts above the remaining refundable balance before Paymob mutation", async () => {
    const context = createService("paymob");
    const { service, tx, paymobPaymentProviderService } = context;
    setupOperationHarness(
      context,
      OnlinePaymentOperationType.refund,
      OnlinePaymentIntentStatus.succeeded,
    );
    tx.onlinePaymentOperation.findMany.mockResolvedValueOnce([
      { amountMinor: 10000 },
    ]);

    await expect(
      service.refundPaymobIntent("intent-1", "staff-1", {
        amountMinor: 3000,
        idempotencyKey: "refund-key-over",
      }),
    ).rejects.toThrow(
      "Refund amount exceeds the remaining refundable amount",
    );

    expect(paymobPaymentProviderService.refundTransaction).not.toHaveBeenCalled();
    expect(tx.onlinePaymentOperation.create).not.toHaveBeenCalled();
  });

  it("rejects partial capture because current Balcona settlement requires the full bill amount", async () => {
    const context = createService("paymob");
    const { service, tx, paymobPaymentProviderService } = context;
    setupOperationHarness(
      context,
      OnlinePaymentOperationType.capture,
      OnlinePaymentIntentStatus.requires_action,
    );

    await expect(
      service.capturePaymobIntent("intent-1", "staff-1", {
        amountMinor: 5000,
        idempotencyKey: "capture-partial",
      }),
    ).rejects.toThrow(
      "Balcona currently requires full capture to preserve full-bill settlement integrity",
    );

    expect(paymobPaymentProviderService.captureTransaction).not.toHaveBeenCalled();
    expect(tx.onlinePaymentOperation.create).not.toHaveBeenCalled();
  });

  it("full capture settles the bill only after authoritative capture inquiry", async () => {
    const context = createService("paymob");
    const {
      service,
      billsService,
      paymobPaymentProviderService,
    } = context;
    setupOperationHarness(
      context,
      OnlinePaymentOperationType.capture,
      OnlinePaymentIntentStatus.requires_action,
    );

    paymobPaymentProviderService.inquireTransactionById
      .mockResolvedValueOnce(
        providerState({
          status: OnlinePaymentIntentStatus.requires_action,
          safeMetadata: {
            sourceType: "card",
            pending: false,
            success: true,
            errorOccurred: false,
            isAuth: true,
            isCapture: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        providerState({
          providerEventId: "paymob_inquiry_555020_capture",
          providerTransactionId: "555020",
          amountMinor: 12500,
          hasParentTransaction: true,
          parentProviderTransactionId: "555001",
          operationType: OnlinePaymentOperationType.capture,
          safeMetadata: {
            sourceType: "card",
            pending: false,
            success: true,
            errorOccurred: false,
            isCapture: true,
            isCaptured: true,
          },
        }),
      );
    paymobPaymentProviderService.captureTransaction.mockResolvedValueOnce({
      provider: OnlinePaymentProvider.paymob,
      type: OnlinePaymentOperationType.capture,
      status: OnlinePaymentOperationStatus.pending,
      parentProviderTransactionId: "555001",
      providerTransactionId: "555020",
      amountMinor: 12500,
      currency: "EGP",
      safeMetadata: { responseAccepted: true },
    });

    const result = await service.capturePaymobIntent(
      "intent-1",
      "staff-1",
      {
        amountMinor: 12500,
        idempotencyKey: "capture-full",
      },
    );

    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("succeeded");
  });

  it("leaves an ambiguous refund timeout pending so a second financial operation stays blocked", async () => {
    const context = createService("paymob");
    const {
      service,
      tx,
      paymobPaymentProviderService,
    } = context;
    const harness = setupOperationHarness(
      context,
      OnlinePaymentOperationType.refund,
      OnlinePaymentIntentStatus.succeeded,
    );

    paymobPaymentProviderService.inquireTransactionById.mockResolvedValueOnce(
      providerState(),
    );
    paymobPaymentProviderService.refundTransaction.mockRejectedValueOnce(
      new PaymentProviderError("timeout", "timeout"),
    );

    await expect(
      service.refundPaymobIntent("intent-1", "staff-1", {
        amountMinor: 5000,
        idempotencyKey: "refund-timeout",
      }),
    ).rejects.toThrow(
      "Paymob operation outcome is uncertain and must be recovered before another financial operation",
    );

    expect(harness.getOperation().status).toBe(
      OnlinePaymentOperationStatus.pending,
    );
    expect(harness.getOperation().failureCode).toBe("uncertain:timeout");

    tx.onlinePaymentOperation.findUnique.mockResolvedValueOnce(null);
    tx.onlinePaymentOperation.findFirst.mockResolvedValueOnce(
      harness.getOperation(),
    );

    await expect(
      service.refundPaymobIntent("intent-1", "staff-1", {
        amountMinor: 1000,
        idempotencyKey: "refund-second",
      }),
    ).rejects.toThrow(
      "Another payment operation is still awaiting provider confirmation",
    );
  });

  it("rejects Paymob void for a non-card transaction before mutation", async () => {
    const context = createService("paymob");
    const { service, paymobPaymentProviderService } = context;
    setupOperationHarness(
      context,
      OnlinePaymentOperationType.void,
      OnlinePaymentIntentStatus.succeeded,
    );

    paymobPaymentProviderService.inquireTransactionById.mockResolvedValueOnce(
      providerState({
        safeMetadata: {
          sourceType: "wallet",
          pending: false,
          success: true,
          errorOccurred: false,
        },
      }),
    );

    await expect(
      service.voidPaymobIntent("intent-1", "staff-1", {
        idempotencyKey: "void-wallet",
      }),
    ).rejects.toThrow(
      "Paymob payment operation is not valid for the current transaction state",
    );

    expect(paymobPaymentProviderService.voidTransaction).not.toHaveBeenCalled();
  });

  it("uses a child webhook only as a trigger and finalizes the pending refund from authoritative inquiry", async () => {
    const context = createService("paymob");
    const {
      service,
      tx,
      billsService,
      paymobPaymentProviderService,
    } = context;
    const harness = setupOperationHarness(
      context,
      OnlinePaymentOperationType.refund,
      OnlinePaymentIntentStatus.succeeded,
    );
    const pendingOperation = operation(
      OnlinePaymentOperationType.refund,
      OnlinePaymentOperationStatus.pending,
      {
        providerTransactionId: null,
        onlinePaymentIntent: harness.getIntent(),
      },
    );
    harness.setOperation(pendingOperation);
    tx.onlinePaymentOperation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(pendingOperation);

    paymobPaymentProviderService.verifyTransactionWebhook.mockReturnValueOnce({
      provider: OnlinePaymentProvider.paymob,
      providerEventId: "paymob_tx_555010_verified",
      providerTransactionId: "555010",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 5000,
      currency: "EGP",
      actionable: false,
      hasParentTransaction: true,
      safeMetadata: {
        hasParentTransaction: true,
        pending: false,
        success: true,
      },
    });
    paymobPaymentProviderService.inquireTransactionById.mockResolvedValueOnce(
      providerState({
        providerEventId: "paymob_inquiry_555010_refund",
        providerTransactionId: "555010",
        amountMinor: 5000,
        hasParentTransaction: true,
        parentProviderTransactionId: "555001",
        operationType: OnlinePaymentOperationType.refund,
        actionable: false,
        safeMetadata: {
          sourceType: "card",
          pending: false,
          success: true,
          errorOccurred: false,
          isRefund: true,
        },
      }),
    );

    const result = await service.processPaymobWebhook(
      "verified-hmac",
      { child: "callback" },
    );

    expect(
      paymobPaymentProviderService.inquireTransactionById,
    ).toHaveBeenCalledWith("555010");
    expect(
      billsService.refreshReceiptForOnlinePaymentAdjustment,
    ).toHaveBeenCalledWith("bill-1", tx);
    expect(result.outcome).toBe("succeeded");
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
    expect(result).toMatchObject({ settlement: { settled: true } });
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
    expect(result).toMatchObject({ settlement: { settled: true } });
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
    expect(result).toMatchObject({ settlement: { reason: "amount_mismatch" } });
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
    expect(result).toMatchObject({ settlement: { settled: true } });
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
    expect(result).toMatchObject({
      settlement: {
        settled: false,
        reason: "bill_already_paid",
      },
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
