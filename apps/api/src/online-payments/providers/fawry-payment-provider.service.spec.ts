import {
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
} from "@prisma/client";
import { createHash } from "crypto";
import { FawryHostedPaymentMethod } from "../dto/create-online-payment-intent.dto";
import { FawryPaymentProviderService } from "./fawry-payment-provider.service";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function config(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    "app.environment": "test",
    "onlinePayments.fawry.checkoutUrl":
      "https://atfawry.fawrystaging.com/fawrypay-api/api/payments/init",
    "onlinePayments.fawry.statusUrl":
      "https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/status/v2",
    "onlinePayments.fawry.refundUrl":
      "https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/refund",
    "onlinePayments.fawry.cancelUrl":
      "https://atfawry.fawrystaging.com/ECommerceWeb/api/orders/cancel-unpaid-order",
    "onlinePayments.fawry.merchantCode": "MERCHANT-1",
    "onlinePayments.fawry.secureKey": "secure-test-key",
    "onlinePayments.fawry.notificationUrl":
      "https://api.example.com/api/v1/online-payments/webhooks/fawry",
    "onlinePayments.fawry.returnUrl":
      "https://app.example.com/payment/return",
    "onlinePayments.fawry.allowedReturnOrigins": [
      "https://app.example.com",
    ],
    "onlinePayments.fawry.timeoutMs": 10000,
    "onlinePayments.fawry.expirationSeconds": 900,
    "onlinePayments.fawry.expectedLive": false,
    ...overrides,
  };

  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function paymentInput() {
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
      phoneNumber: "01001234567",
    },
    customerReturnUrl: "https://app.example.com/payment/return",
  };
}

describe("FawryPaymentProviderService", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("creates Fawry hosted checkout with the documented checkout signature", async () => {
    jest.spyOn(Date, "now").mockReturnValue(
      new Date("2026-08-28T00:00:00.000Z").getTime(),
    );
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          redirectUrl:
            "https://atfawry.fawrystaging.com/checkout/session-1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new FawryPaymentProviderService(config() as never);

    const result = await service.createPayment(
      paymentInput(),
      FawryHostedPaymentMethod.Card,
    );

    const request = fetchSpy.mock.calls[0];
    const body = JSON.parse(String((request[1] as RequestInit).body));
    const expectedSignature = sha256(
      [
        "MERCHANT-1",
        "intent-1",
        "",
        "https://app.example.com/payment/return",
        "bill-1",
        "1",
        "125.00",
        "secure-test-key",
      ].join(""),
    );

    expect(body).toMatchObject({
      merchantCode: "MERCHANT-1",
      merchantRefNum: "intent-1",
      customerMobile: "01001234567",
      customerEmail: "omar@example.com",
      paymentMethod: "CARD",
      returnUrl: "https://app.example.com/payment/return",
      orderWebHookUrl:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      authCaptureModePayment: false,
      signature: expectedSignature,
      chargeItems: [
        {
          itemId: "bill-1",
          description: "Balcona bill",
          price: 125,
          quantity: 1,
        },
      ],
    });
    expect(result).toMatchObject({
      provider: OnlinePaymentProvider.fawry,
      providerIntentId: "fawry:intent-1",
      providerOrderId: "intent-1",
      status: OnlinePaymentIntentStatus.pending,
      checkoutUrl:
        "https://atfawry.fawrystaging.com/checkout/session-1",
    });
  });

  it("verifies Fawry Notification V2 before normalizing PAID", () => {
    const service = new FawryPaymentProviderService(config() as never);
    const signature = sha256(
      [
        "987654321",
        "intent-1",
        "126.00",
        "125.00",
        "PAID",
        "CARD",
        "AUTH-1",
        "secure-test-key",
      ].join(""),
    );

    const result = service.verifyNotification({
      requestId: "request-1",
      fawryRefNumber: "987654321",
      merchantRefNumber: "intent-1",
      paymentAmount: 126,
      orderAmount: 125,
      fawryFees: 1,
      orderStatus: "PAID",
      paymentMethod: "CARD",
      paymentRefrenceNumber: "AUTH-1",
      paymentTime: 1787875200000,
      messageSignature: signature,
    });

    expect(result).toMatchObject({
      provider: OnlinePaymentProvider.fawry,
      providerTransactionId: "987654321",
      providerOrderId: "intent-1",
      merchantReference: "intent-1",
      status: OnlinePaymentIntentStatus.succeeded,
      amountMinor: 12500,
      currency: "EGP",
      actionable: true,
      providerReportedFeeMinor: 100,
      safeMetadata: {
        orderStatus: "PAID",
        paymentMethod: "CARD",
        paymentAmountMinor: 12600,
        fawryFeesMinor: 100,
      },
    });
  });

  it("rejects a Fawry notification with the wrong signature", () => {
    const service = new FawryPaymentProviderService(config() as never);

    expect(() =>
      service.verifyNotification({
        requestId: "request-1",
        fawryRefNumber: "987654321",
        merchantRefNumber: "intent-1",
        paymentAmount: 125,
        orderAmount: 125,
        orderStatus: "PAID",
        paymentMethod: "CARD",
        messageSignature: "0".repeat(64),
      }),
    ).toThrow("Fawry notification signature is invalid");
  });

  it("signs Get Payment Status V2 by merchantCode + merchantRef + secureKey", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          statusCode: 200,
          referenceNumber: "987654321",
          merchantRefNumber: "intent-1",
          paymentAmount: 126,
          orderAmount: 125,
          fawryFees: 1,
          orderStatus: "PAID",
          paymentMethod: "CARD",
          paymentRefrenceNumber: "AUTH-1",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new FawryPaymentProviderService(config() as never);

    const result =
      await service.inquireByMerchantReference("intent-1");

    const calledUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    expect(calledUrl.searchParams.get("merchantCode")).toBe("MERCHANT-1");
    expect(calledUrl.searchParams.get("merchantRefNumber")).toBe(
      "intent-1",
    );
    expect(calledUrl.searchParams.get("signature")).toBe(
      sha256("MERCHANT-1" + "intent-1" + "secure-test-key"),
    );
    expect(result).toMatchObject({
      found: true,
      provider: OnlinePaymentProvider.fawry,
      providerOrderId: "intent-1",
      transaction: {
        providerTransactionId: "987654321",
        status: OnlinePaymentIntentStatus.succeeded,
        amountMinor: 12500,
        providerReportedFeeMinor: 100,
      },
    });
  });

  it("preserves REFUNDED and PARTIAL_REFUNDED as adjustments instead of a new sale settlement", () => {
    const service = new FawryPaymentProviderService(config() as never);

    for (const status of ["REFUNDED", "PARTIAL_REFUNDED"]) {
      const signature = sha256(
        [
          "987654321",
          "intent-1",
          "125.00",
          "125.00",
          status,
          "CARD",
          "",
          "secure-test-key",
        ].join(""),
      );
      const result = service.verifyNotification({
        requestId: `request-${status}`,
        fawryRefNumber: "987654321",
        merchantRefNumber: "intent-1",
        paymentAmount: 125,
        orderAmount: 125,
        orderStatus: status,
        paymentMethod: "CARD",
        messageSignature: signature,
      });

      expect(result.status).toBe(OnlinePaymentIntentStatus.succeeded);
      expect(result.actionable).toBe(false);
    }
  });

  it("signs partial refund with exact two-decimal amount and optional reason", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          type: "ChargeResponse",
          statusCode: 200,
          statusDescription: "Operation done successfully",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const service = new FawryPaymentProviderService(config() as never);

    const result = await service.refundPayment({
      referenceNumber: "987654321",
      amountMinor: 5000,
      reason: "customer request",
    });

    const request = fetchSpy.mock.calls[0];
    const body = JSON.parse(String((request[1] as RequestInit).body));
    expect(body).toEqual({
      merchantCode: "MERCHANT-1",
      referenceNumber: "987654321",
      refundAmount: "50.00",
      reason: "customer request",
      signature: sha256(
        "MERCHANT-1" +
          "987654321" +
          "50.00" +
          "customer request" +
          "secure-test-key",
      ),
    });
    expect(result).toMatchObject({
      accepted: true,
      statusCode: 200,
      referenceNumber: "987654321",
      amountMinor: 5000,
    });
  });

  it("rejects customer return URLs outside the configured allowlist", async () => {
    const service = new FawryPaymentProviderService(config() as never);

    await expect(
      service.createPayment({
        ...paymentInput(),
        customerReturnUrl: "https://evil.example/payment/return",
      }),
    ).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
});
