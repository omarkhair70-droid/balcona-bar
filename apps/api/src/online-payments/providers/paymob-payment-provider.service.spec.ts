import { ConfigService } from "@nestjs/config";
import { OnlinePaymentProvider } from "@prisma/client";
import { PaymobPaymentProviderService } from "./paymob-payment-provider.service";
import { PaymentProviderError } from "./payment-provider.types";

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "onlinePayments.paymob.baseUrl": "https://accept.paymob.com",
    "onlinePayments.paymob.secretKey": "test-secret",
    "onlinePayments.paymob.publicKey": "test-public",
    "onlinePayments.paymob.notificationUrl":
      "https://api.example.com/api/v1/online-payments/webhooks/paymob",
    "onlinePayments.paymob.integrationIds": [101, 202],
    "onlinePayments.paymob.allowedReturnOrigins": ["https://app.example.com"],
    "onlinePayments.paymob.timeoutMs": 10000,
    "onlinePayments.paymob.expirationSeconds": 900,
    "onlinePayments.paymob.expectedLive": false,
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
