import { ConfigService } from "@nestjs/config";
import { OnlinePaymentProvider } from "@prisma/client";
import { createHmac } from "crypto";
import { PaymobPaymentProviderService } from "./paymob-payment-provider.service";
import { PaymentProviderError } from "./payment-provider.types";

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "onlinePayments.paymob.baseUrl": "https://accept.paymob.com",
    "onlinePayments.paymob.secretKey": "test-secret",
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
