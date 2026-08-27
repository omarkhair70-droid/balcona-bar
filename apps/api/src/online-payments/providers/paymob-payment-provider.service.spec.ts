import { ConfigService } from "@nestjs/config";
import {
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
} from "@prisma/client";
import { createHmac } from "crypto";
import { PaymobPaymentProviderService } from "./paymob-payment-provider.service";
import { PaymentProviderError } from "./payment-provider.types";

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "onlinePayments.paymob.baseUrl": "https://accept.paymob.com",
    "onlinePayments.paymob.secretKey": "test-secret",
    "onlinePayments.paymob.apiKey": "test-api-key",
    "onlinePayments.paymob.publicKey": "test-public",
    "onlinePayments.paymob.hmacSecret": "test-hmac-secret",
    "onlinePayments.paymob.notificationUrl":
      "https://api.example.com/api/v1/online-payments/webhooks/paymob",
    "onlinePayments.paymob.integrationIds": [101, 202],
    "onlinePayments.paymob.allowedReturnOrigins": ["https://app.example.com"],
    "onlinePayments.paymob.timeoutMs": 10000,
    "onlinePayments.paymob.expirationSeconds": 900,
    "onlinePayments.paymob.expectedLive": false,
    "app.environment": "development",
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function input() {
  return {
    localIntentId: "intent-1",
    companyId: "company-1",
    branchId: "branch-1",
    billId: "bill-1",
    amountMinor: 12500,
    currency: "EGP",
    billingData: {
      firstName: "Omar",
      lastName: "Khair",
      email: "omar@example.com",
      phoneNumber: "+201001234567",
    },
    customerReturnUrl: "https://app.example.com/payment/return?bill=bill-1",
  };
}

function successResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      id: "pi_test_123",
      client_secret: "client-secret-123",
      intention_order_id: 12345,
      status: "intended",
      intention_detail: {
        amount: 12500,
        currency: "EGP",
      },
      payment_methods: [
        {
          integration_id: 101,
          live: false,
          name: "Card",
          method_type: "card",
        },
      ],
      ...overrides,
    }),
    {
      status: 201,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function paymobTransaction(overrides: Record<string, unknown> = {}) {
  return {
    amount_cents: 12500,
    created_at: "2026-08-27T20:30:00.000000",
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
      id: 12345,
      merchant_order_id: "intent-1",
    },
    owner: 999,
    pending: false,
    source_data: {
      pan: "2346",
      sub_type: "MasterCard",
      type: "card",
    },
    success: true,
    ...overrides,
  };
}

function postPaymentResponse(
  type: OnlinePaymentOperationType,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 555010,
    parent_transaction: 555001,
    pending: false,
    success: true,
    amount_cents: type === OnlinePaymentOperationType.void ? 12500 : 5000,
    currency: "EGP",
    integration_id: 101,
    is_live: false,
    error_occured: false,
    is_refund: type === OnlinePaymentOperationType.refund,
    is_void: type === OnlinePaymentOperationType.void,
    is_capture: type === OnlinePaymentOperationType.capture,
    is_refunded: type === OnlinePaymentOperationType.refund,
    is_voided: type === OnlinePaymentOperationType.void,
    is_captured: type === OnlinePaymentOperationType.capture,
    ...overrides,
  };
}

function inquiryTransaction(overrides: Record<string, unknown> = {}) {
  return {
    id: 555001,
    pending: false,
    amount_cents: 12500,
    success: true,
    is_auth: false,
    is_capture: false,
    is_standalone_payment: true,
    is_voided: false,
    is_refunded: false,
    is_3d_secure: true,
    integration_id: 101,
    has_parent_transaction: false,
    order: {
      id: 12345,
      merchant_order_id: "intent-1",
      currency: "EGP",
      is_cancel: false,
      is_canceled: false,
    },
    created_at: "2026-08-27T20:30:00.000000",
    updated_at: "2026-08-27T20:31:00.000000",
    currency: "EGP",
    source_data: {
      pan: "2346",
      sub_type: "MasterCard",
      type: "card",
    },
    error_occured: false,
    is_live: false,
    ...overrides,
  };
}

function transactionHmac(obj: Record<string, any>) {
  const fields = [
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
    obj.order.id,
    obj.owner,
    obj.pending,
    obj.source_data.pan,
    obj.source_data.sub_type,
    obj.source_data.type,
    obj.success,
  ];

  return createHmac("sha512", "test-hmac-secret")
    .update(fields.map(String).join(""))
    .digest("hex");
}

describe("PaymobPaymentProviderService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates a server-side Paymob intention and returns Unified Checkout", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      successResponse(),
    );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.createPayment(input());

    expect(result).toMatchObject({
      provider: OnlinePaymentProvider.paymob,
      providerIntentId: "pi_test_123",
      providerOrderId: "12345",
      checkoutUrl:
        "https://accept.paymob.com/unifiedcheckout/?publicKey=test-public&clientSecret=client-secret-123",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, request] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://accept.paymob.com/v1/intention/");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Token test-secret",
        "Content-Type": "application/json",
      },
    });

    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      amount: 12500,
      currency: "EGP",
      payment_methods: [101, 202],
      special_reference: "intent-1",
      notification_url:
        "https://api.example.com/api/v1/online-payments/webhooks/paymob",
      redirection_url:
        "https://app.example.com/payment/return?bill=bill-1",
      expiration: 900,
      billing_data: {
        first_name: "Omar",
        last_name: "Khair",
        email: "omar@example.com",
        phone_number: "+201001234567",
      },
      extras: {
        balcona_intent_id: "intent-1",
        balcona_company_id: "company-1",
        balcona_branch_id: "branch-1",
        balcona_bill_id: "bill-1",
      },
    });
  });

  it("fails closed when Paymob returns a different amount", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      successResponse({
        intention_detail: { amount: 9900, currency: "EGP" },
      }),
    );
    const service = new PaymobPaymentProviderService(config());

    await expect(service.createPayment(input())).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "amount_mismatch",
    });
  });

  it("fails closed when Paymob returns live methods for a test configuration", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      successResponse({
        payment_methods: [
          {
            integration_id: 101,
            live: true,
            name: "Card",
            method_type: "card",
          },
        ],
      }),
    );
    const service = new PaymobPaymentProviderService(config());

    await expect(service.createPayment(input())).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "environment_mismatch",
    });
  });

  it("rejects a customer return URL outside the configured allowlist", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymobPaymentProviderService(config());

    await expect(
      service.createPayment({
        ...input(),
        customerReturnUrl: "https://evil.example/payment",
      }),
    ).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "invalid_request",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fails closed when a return URL is supplied without an origin allowlist", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymobPaymentProviderService(
      config({
        "onlinePayments.paymob.allowedReturnOrigins": [],
      }),
    );

    await expect(service.createPayment(input())).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "invalid_request",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects test-mode Paymob configuration in production", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymobPaymentProviderService(
      config({
        "app.environment": "production",
        "onlinePayments.paymob.expectedLive": false,
      }),
    );

    await expect(
      service.createPayment({
        ...input(),
        customerReturnUrl: "https://app.example.com/payment",
      }),
    ).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "environment_mismatch",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires HTTPS provider callback configuration in production", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymobPaymentProviderService(
      config({
        "app.environment": "production",
        "onlinePayments.paymob.expectedLive": true,
        "onlinePayments.paymob.notificationUrl":
          "http://api.example.com/api/v1/online-payments/webhooks/paymob",
      }),
    );

    await expect(
      service.createPayment({
        ...input(),
        customerReturnUrl: "https://app.example.com/payment",
      }),
    ).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "environment_mismatch",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call Paymob without required server credentials", async () => {
    const fetchSpy = jest.spyOn(global, "fetch");
    const service = new PaymobPaymentProviderService(
      config({
        "onlinePayments.paymob.secretKey": undefined,
      }),
    );

    await expect(service.createPayment(input())).rejects.toBeInstanceOf(
      PaymentProviderError,
    );
    await expect(service.createPayment(input())).rejects.toMatchObject({
      code: "missing_config",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends partial refund through the documented Secret-Key endpoint", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(postPaymentResponse(OnlinePaymentOperationType.refund)),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.refundTransaction({
      parentProviderTransactionId: "555001",
      amountMinor: 5000,
      expectedCurrency: "EGP",
    });

    expect(result).toMatchObject({
      provider: OnlinePaymentProvider.paymob,
      type: OnlinePaymentOperationType.refund,
      status: OnlinePaymentOperationStatus.pending,
      parentProviderTransactionId: "555001",
      providerTransactionId: "555010",
      amountMinor: 5000,
      currency: "EGP",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://accept.paymob.com/api/acceptance/void_refund/refund",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Token test-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transaction_id: 555001,
          amount_cents: 5000,
        }),
      }),
    );
  });

  it("sends void without an amount through the documented endpoint", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(postPaymentResponse(OnlinePaymentOperationType.void)),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new PaymobPaymentProviderService(config());

    await service.voidTransaction({
      parentProviderTransactionId: "555001",
      amountMinor: 12500,
      expectedCurrency: "EGP",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://accept.paymob.com/api/acceptance/void_refund/void",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ transaction_id: 555001 }),
      }),
    );
  });

  it("sends capture with the authorized amount through the documented endpoint", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify(
          postPaymentResponse(OnlinePaymentOperationType.capture, {
            amount_cents: 12500,
          }),
        ),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new PaymobPaymentProviderService(config());

    await service.captureTransaction({
      parentProviderTransactionId: "555001",
      amountMinor: 12500,
      expectedCurrency: "EGP",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://accept.paymob.com/api/acceptance/capture",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          transaction_id: 555001,
          amount_cents: 12500,
        }),
      }),
    );
  });

  it("inquires a child transaction by id and normalizes its operation identity", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            inquiryTransaction({
              id: 555010,
              amount_cents: 5000,
              has_parent_transaction: true,
              parent_transaction: 555001,
              is_refund: true,
              is_refunded: false,
            }),
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.inquireTransactionById("555010");

    expect(result).toMatchObject({
      providerTransactionId: "555010",
      parentProviderTransactionId: "555001",
      operationType: OnlinePaymentOperationType.refund,
      amountMinor: 5000,
      currency: "EGP",
      hasParentTransaction: true,
    });
    expect(result.safeMetadata).not.toHaveProperty("pan");
  });

  it("normalizes provider settlement signals from Paymob transaction inquiry", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            inquiryTransaction({
              is_settled: true,
              merchant_commission: 250,
              data: {
                migs_transaction: {
                  acquirer: {
                    settlementDate: "2026-08-28",
                    batch: 20260828,
                  },
                },
              },
            }),
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.inquireTransactionById("555001");

    expect(result).toMatchObject({
      providerSettled: true,
      providerReportedFeeMinor: 250,
      providerSettlementDate: "2026-08-28",
      providerSettlementReference: "20260828",
      safeMetadata: {
        providerSettled: true,
        providerReportedFeeMinor: 250,
        providerSettlementDate: "2026-08-28",
        providerSettlementReference: "20260828",
      },
    });
  });

  it("keeps provider settlement pending when Paymob explicitly reports is_settled=false", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(inquiryTransaction({ is_settled: false })),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.inquireTransactionById("555001");

    expect(result.providerSettled).toBe(false);
  });

  it("authenticates with the Paymob API key and inquires by stored provider order id", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(inquiryTransaction()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.inquireTransactionByOrder("12345");

    expect(result).toMatchObject({
      found: true,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
      transaction: {
        providerTransactionId: "555001",
        providerOrderId: "12345",
        merchantReference: "intent-1",
        integrationId: 101,
        amountMinor: 12500,
        currency: "EGP",
        status: "succeeded",
        actionable: true,
      },
    });
    expect(result.found && result.transaction.safeMetadata).not.toHaveProperty(
      "pan",
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      "https://accept.paymob.com/api/auth/tokens",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ api_key: "test-api-key" }),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://accept.paymob.com/api/ecommerce/orders/transaction_inquiry",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer inquiry-auth-token",
        }),
        body: JSON.stringify({ order_id: "12345" }),
      }),
    );
  });

  it("returns not-found when Paymob has no transaction for the order", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 404 }));
    const service = new PaymobPaymentProviderService(config());

    await expect(service.inquireTransactionByOrder("12345")).resolves.toEqual({
      found: false,
      provider: OnlinePaymentProvider.paymob,
      providerOrderId: "12345",
    });
  });

  it("refreshes a rejected cached inquiry token exactly once", async () => {
    const fetchSpy = jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "stale-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "fresh-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(inquiryTransaction()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    const service = new PaymobPaymentProviderService(config());

    await expect(service.inquireTransactionByOrder("12345")).resolves.toMatchObject({
      found: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(fetchSpy.mock.calls[3]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: "Bearer fresh-token",
      }),
    });
  });

  it("rejects an inquiry transaction from the wrong live/test environment", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(inquiryTransaction({ is_live: true })),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const service = new PaymobPaymentProviderService(config());

    await expect(
      service.inquireTransactionByOrder("12345"),
    ).rejects.toMatchObject({
      code: "environment_mismatch",
    });
  });

  it("defers refunded or child inquiry transactions to PAY-5 instead of settling them", async () => {
    jest.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ token: "inquiry-auth-token" }), {
          status: 201,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify(
            inquiryTransaction({
              is_refunded: true,
              has_parent_transaction: true,
            }),
          ),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    const service = new PaymobPaymentProviderService(config());

    const result = await service.inquireTransactionByOrder("12345");

    expect(result.found && result.transaction.actionable).toBe(false);
  });

  it("verifies a Paymob transaction callback with the documented 20-field HMAC", () => {
    const service = new PaymobPaymentProviderService(config());
    const obj = paymobTransaction();
    const result = service.verifyTransactionWebhook(
      obj,
      transactionHmac(obj),
    );

    expect(result).toMatchObject({
      provider: OnlinePaymentProvider.paymob,
      providerTransactionId: "555001",
      providerOrderId: "12345",
      merchantReference: "intent-1",
      integrationId: 101,
      amountMinor: 12500,
      currency: "EGP",
      status: "succeeded",
      actionable: true,
    });
    expect(result.providerEventId).toMatch(
      /^paymob_tx_555001_[a-f0-9]{32}$/,
    );
    expect(result.safeMetadata).not.toHaveProperty("pan");
  });

  it("rejects a tampered Paymob transaction callback", () => {
    const service = new PaymobPaymentProviderService(config());
    const original = paymobTransaction();
    const hmac = transactionHmac(original);
    const tampered = {
      ...original,
      amount_cents: 9900,
    };

    expect(() =>
      service.verifyTransactionWebhook(tampered, hmac),
    ).toThrow(
      expect.objectContaining({
        code: "signature_invalid",
      }),
    );
  });

  it("rejects a signed transaction from an unconfigured integration", () => {
    const service = new PaymobPaymentProviderService(config());
    const obj = paymobTransaction({ integration_id: 303 });

    expect(() =>
      service.verifyTransactionWebhook(obj, transactionHmac(obj)),
    ).toThrow(
      expect.objectContaining({
        code: "environment_mismatch",
      }),
    );
  });

  it("does not normalize auth-only Paymob callbacks as settled", () => {
    const service = new PaymobPaymentProviderService(config());
    const obj = paymobTransaction({
      is_auth: true,
      is_capture: false,
      is_standalone_payment: false,
    });

    const result = service.verifyTransactionWebhook(
      obj,
      transactionHmac(obj),
    );

    expect(result.status).toBe("requires_action");
  });

  it("marks Paymob child transactions non-actionable for PAY-2", () => {
    const service = new PaymobPaymentProviderService(config());
    const obj = paymobTransaction({
      has_parent_transaction: true,
      id: 555002,
    });

    const result = service.verifyTransactionWebhook(
      obj,
      transactionHmac(obj),
    );

    expect(result.actionable).toBe(false);
  });

  it("maps provider authentication failures without exposing provider bodies", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "sensitive provider body" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const service = new PaymobPaymentProviderService(config());

    await expect(service.createPayment(input())).rejects.toMatchObject({
      name: "PaymentProviderError",
      code: "authentication_failed",
      message: "Paymob rejected the configured credentials",
    });
  });
});
