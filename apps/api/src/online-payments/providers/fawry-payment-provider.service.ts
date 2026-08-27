import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
} from "@prisma/client";
import { createHash, timingSafeEqual } from "crypto";
import {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProviderError,
  ProviderTransactionInquiryResult,
  ProviderTransactionState,
} from "./payment-provider.types";
import { FawryHostedPaymentMethod } from "../dto/create-online-payment-intent.dto";

type FawryConfig = {
  checkoutUrl: string;
  statusUrl: string;
  refundUrl: string;
  cancelUrl: string;
  merchantCode: string;
  secureKey: string;
  notificationUrl: string;
  returnUrl: string;
  allowedReturnOrigins: string[];
  timeoutMs: number;
  expirationSeconds: number;
  expectedLive: boolean;
  appEnvironment: string;
};

const DEFAULT_STAGING_CHECKOUT_URL =
  "https://atfawry.fawrystaging.com/fawrypay-api/api/payments/init";
const DEFAULT_STAGING_STATUS_URL =
  "https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/status/v2";
const DEFAULT_STAGING_REFUND_URL =
  "https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/refund";
const DEFAULT_STAGING_CANCEL_URL =
  "https://atfawry.fawrystaging.com/ECommerceWeb/api/orders/cancel-unpaid-order";

@Injectable()
export class FawryPaymentProviderService {
  readonly provider = OnlinePaymentProvider.fawry;

  constructor(private readonly configService: ConfigService) {}

  async createPayment(
    input: CreateProviderPaymentInput,
    paymentMethod?: FawryHostedPaymentMethod,
  ): Promise<CreateProviderPaymentResult> {
    const config = this.readConfig();

    if (input.currency.toUpperCase() !== "EGP") {
      throw new PaymentProviderError(
        "Fawry hosted checkout currently supports EGP only in Balcona",
        "unsupported_operation",
      );
    }

    const amount = this.formatMinor(input.amountMinor);
    const returnUrl = this.resolveReturnUrl(
      input.customerReturnUrl,
      config,
    );
    const checkoutExpiresAt = new Date(
      Date.now() + config.expirationSeconds * 1000,
    );
    const itemId = input.billId;
    const quantity = "1";
    const signature = this.sha256(
      [
        config.merchantCode,
        input.localIntentId,
        "",
        returnUrl,
        itemId,
        quantity,
        amount,
        config.secureKey,
      ].join(""),
    );

    const requestBody: Record<string, unknown> = {
      merchantCode: config.merchantCode,
      merchantRefNum: input.localIntentId,
      customerMobile: input.billingData.phoneNumber,
      customerEmail: input.billingData.email,
      customerName: [
        input.billingData.firstName,
        input.billingData.lastName,
      ]
        .filter(Boolean)
        .join(" "),
      paymentExpiry: String(checkoutExpiresAt.getTime()),
      language: "en-gb",
      chargeItems: [
        {
          itemId,
          description: "Balcona bill",
          price: Number(amount),
          quantity: 1,
        },
      ],
      returnUrl,
      orderWebHookUrl: config.notificationUrl,
      authCaptureModePayment: false,
      signature,
    };

    if (paymentMethod) {
      requestBody.paymentMethod = paymentMethod;
    }

    const response = await this.fetchWithTimeout(
      config.checkoutUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      config.timeoutMs,
      "Fawry hosted checkout initialization timed out",
      "Fawry hosted checkout initialization failed",
    );

    if (!response.ok) {
      throw this.errorForHttpStatus(
        response.status,
        "Fawry hosted checkout",
      );
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Fawry returned a non-JSON hosted checkout response",
        "invalid_response",
        { status: response.status },
      );
    }

    const checkoutUrl = this.extractRedirectUrl(value);

    if (!checkoutUrl) {
      throw new PaymentProviderError(
        "Fawry hosted checkout response is missing redirect URL",
        "invalid_response",
      );
    }

    return {
      provider: this.provider,
      providerIntentId: `fawry:${input.localIntentId}`,
      providerOrderId: input.localIntentId,
      status: OnlinePaymentIntentStatus.pending,
      checkoutUrl,
      checkoutExpiresAt,
      metadata: {
        fawryMerchantRefNumber: input.localIntentId,
        fawryPaymentMethod: paymentMethod ?? "ALL_HOSTED",
        fawryCheckoutMode: "hosted",
      },
    };
  }

  async refundPayment(input: {
    referenceNumber: string;
    amountMinor: number;
    reason?: string;
  }) {
    const config = this.readConfig();
    const referenceNumber = this.identifierString(input.referenceNumber);
    const refundAmount = this.formatMinor(input.amountMinor);
    const reason = input.reason?.trim() ?? "";

    if (!referenceNumber) {
      throw new PaymentProviderError(
        "Fawry refund reference number is required",
        "invalid_request",
      );
    }

    const signature = this.sha256(
      config.merchantCode +
        referenceNumber +
        refundAmount +
        reason +
        config.secureKey,
    );
    const response = await this.fetchWithTimeout(
      config.refundUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          merchantCode: config.merchantCode,
          referenceNumber,
          refundAmount,
          ...(reason ? { reason } : {}),
          signature,
        }),
      },
      config.timeoutMs,
      "Fawry refund request timed out",
      "Fawry refund request failed",
    );

    if (!response.ok) {
      throw this.errorForHttpStatus(response.status, "Fawry refund");
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Fawry returned a non-JSON refund response",
        "invalid_response",
        { status: response.status },
      );
    }

    const obj = this.requireRecord(value, "Fawry refund response");
    const statusCode = this.integerValue(obj.statusCode);

    if (statusCode !== 200) {
      if (statusCode === 9935 || statusCode === 9954) {
        throw new PaymentProviderError(
          "Fawry rejected the refund for the current transaction state",
          "provider_declined",
          { statusCode },
        );
      }

      if (statusCode === 9938) {
        throw new PaymentProviderError(
          "Fawry refund transaction was not found",
          "transaction_not_found",
          { statusCode },
        );
      }

      throw new PaymentProviderError(
        "Fawry refund response was not successful",
        "invalid_response",
        {
          statusCode,
          statusDescription: this.nonEmptyString(obj.statusDescription),
        },
      );
    }

    return {
      accepted: true as const,
      statusCode,
      statusDescription: this.nonEmptyString(obj.statusDescription),
      referenceNumber,
      amountMinor: input.amountMinor,
    };
  }

  verifyNotification(value: unknown): ProviderTransactionState {
    const config = this.readWebhookConfig();
    const obj = this.requireRecord(value, "Fawry notification");
    const requestId = this.nonEmptyString(obj.requestId);
    const fawryRefNumber =
      this.identifierString(obj.fawryRefNumber) ??
      this.identifierString(obj.referenceNumber);
    const merchantRefNumber =
      this.identifierString(obj.merchantRefNumber) ??
      this.identifierString(obj.merchantRefNum);
    const orderStatus = this.nonEmptyString(
      obj.orderStatus ?? obj.paymentStatus,
    )?.toUpperCase();
    const paymentMethod = this.nonEmptyString(obj.paymentMethod);
    const paymentReferenceNumber =
      this.identifierString(obj.paymentRefrenceNumber) ??
      this.identifierString(obj.paymentReferenceNumber) ??
      "";
    const paymentAmount = this.decimalValue(obj.paymentAmount);
    const orderAmount =
      this.decimalValue(obj.orderAmount) ??
      this.deriveOrderAmount(obj);
    const messageSignature =
      this.nonEmptyString(obj.messageSignature) ??
      this.nonEmptyString(obj.signature);

    if (
      !fawryRefNumber ||
      !merchantRefNumber ||
      !orderStatus ||
      !paymentMethod ||
      paymentAmount === undefined ||
      orderAmount === undefined ||
      !messageSignature
    ) {
      throw new PaymentProviderError(
        "Fawry notification is missing signed fields",
        "invalid_response",
      );
    }

    const signedPayload = [
      fawryRefNumber,
      merchantRefNumber,
      this.formatDecimal(paymentAmount),
      this.formatDecimal(orderAmount),
      orderStatus,
      paymentMethod,
      paymentReferenceNumber,
      config.secureKey,
    ].join("");
    const expectedSignature = this.sha256(signedPayload);

    if (!this.safeEqualHex(expectedSignature, messageSignature)) {
      throw new PaymentProviderError(
        "Fawry notification signature is invalid",
        "signature_invalid",
      );
    }

    return this.normalizeTransactionState(
      obj,
      {
        fawryRefNumber,
        merchantRefNumber,
        orderStatus,
        paymentMethod,
        paymentReferenceNumber,
        orderAmount,
        paymentAmount,
      },
      requestId,
      messageSignature,
    );
  }

  async inquireByMerchantReference(
    merchantRefNumberValue: string,
  ): Promise<ProviderTransactionInquiryResult> {
    const config = this.readConfig();
    const merchantRefNumber =
      this.identifierString(merchantRefNumberValue);

    if (!merchantRefNumber) {
      throw new PaymentProviderError(
        "Fawry merchant reference is required for status inquiry",
        "invalid_request",
      );
    }

    const signature = this.sha256(
      config.merchantCode + merchantRefNumber + config.secureKey,
    );
    const url = new URL(config.statusUrl);
    url.searchParams.set("merchantCode", config.merchantCode);
    url.searchParams.set("merchantRefNumber", merchantRefNumber);
    url.searchParams.set("signature", signature);

    const response = await this.fetchWithTimeout(
      url.toString(),
      {
        method: "GET",
        headers: { Accept: "application/json" },
      },
      config.timeoutMs,
      "Fawry payment status inquiry timed out",
      "Fawry payment status inquiry failed",
    );

    if (response.status === 404) {
      return {
        found: false,
        provider: this.provider,
        providerOrderId: merchantRefNumber,
      };
    }

    if (!response.ok) {
      throw this.errorForHttpStatus(
        response.status,
        "Fawry payment status inquiry",
      );
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Fawry returned a non-JSON payment status response",
        "invalid_response",
      );
    }

    const obj = this.requireRecord(value, "Fawry payment status response");
    const statusCode = this.integerValue(obj.statusCode);

    if (
      statusCode !== undefined &&
      statusCode !== 200 &&
      [9938, 404].includes(statusCode)
    ) {
      return {
        found: false,
        provider: this.provider,
        providerOrderId: merchantRefNumber,
      };
    }

    if (statusCode !== undefined && statusCode !== 200) {
      throw new PaymentProviderError(
        "Fawry rejected the payment status inquiry",
        "invalid_response",
        { statusCode },
      );
    }

    const returnedMerchantRef =
      this.identifierString(obj.merchantRefNumber) ??
      this.identifierString(obj.merchantRefNum);
    const fawryRefNumber =
      this.identifierString(obj.fawryRefNumber) ??
      this.identifierString(obj.referenceNumber);
    const orderStatus = this.nonEmptyString(
      obj.orderStatus ?? obj.paymentStatus,
    )?.toUpperCase();
    const paymentMethod =
      this.nonEmptyString(obj.paymentMethod) ?? "UNKNOWN";
    const paymentReferenceNumber =
      this.identifierString(obj.paymentRefrenceNumber) ??
      this.identifierString(obj.paymentReferenceNumber) ??
      "";
    const paymentAmount = this.decimalValue(obj.paymentAmount);
    const orderAmount =
      this.decimalValue(obj.orderAmount) ??
      this.deriveOrderAmount(obj);

    if (
      !returnedMerchantRef ||
      returnedMerchantRef !== merchantRefNumber ||
      !fawryRefNumber ||
      !orderStatus ||
      paymentAmount === undefined ||
      orderAmount === undefined
    ) {
      throw new PaymentProviderError(
        "Fawry payment status response is missing required values",
        "invalid_response",
      );
    }

    const messageSignature =
      this.nonEmptyString(obj.messageSignature) ??
      this.nonEmptyString(obj.signature);

    if (messageSignature) {
      const expected = this.sha256(
        [
          fawryRefNumber,
          returnedMerchantRef,
          this.formatDecimal(paymentAmount),
          this.formatDecimal(orderAmount),
          orderStatus,
          paymentMethod,
          paymentReferenceNumber,
          config.secureKey,
        ].join(""),
      );

      if (!this.safeEqualHex(expected, messageSignature)) {
        throw new PaymentProviderError(
          "Fawry payment status response signature is invalid",
          "signature_invalid",
        );
      }
    }

    const state = this.normalizeTransactionState(
      obj,
      {
        fawryRefNumber,
        merchantRefNumber: returnedMerchantRef,
        orderStatus,
        paymentMethod,
        paymentReferenceNumber,
        orderAmount,
        paymentAmount,
      },
      this.nonEmptyString(obj.requestId),
      messageSignature,
    );

    return {
      found: true,
      provider: this.provider,
      providerOrderId: merchantRefNumber,
      transaction: state,
    };
  }

  private normalizeTransactionState(
    obj: Record<string, unknown>,
    values: {
      fawryRefNumber: string;
      merchantRefNumber: string;
      orderStatus: string;
      paymentMethod: string;
      paymentReferenceNumber: string;
      orderAmount: number;
      paymentAmount: number;
    },
    requestId?: string,
    messageSignature?: string,
  ): ProviderTransactionState {
    const status = this.normalizeStatus(values.orderStatus);
    const refundLike =
      values.orderStatus === "REFUNDED" ||
      values.orderStatus === "PARTIAL_REFUNDED";
    const eventSeed = [
      requestId ?? "",
      values.fawryRefNumber,
      values.merchantRefNumber,
      values.orderStatus,
      values.paymentReferenceNumber,
      messageSignature ?? "",
    ].join("|");
    const providerEventId =
      `fawry_${this.sha256(eventSeed).slice(0, 40)}`;
    const feeMinor = this.decimalToMinor(obj.fawryFees);
    const paymentTime =
      this.identifierString(obj.paymentTime ?? obj.paymentDate);
    const batchNumber = this.extractBatchNumber(obj);

    return {
      provider: this.provider,
      providerEventId,
      providerTransactionId: values.fawryRefNumber,
      providerOrderId: values.merchantRefNumber,
      merchantReference: values.merchantRefNumber,
      integrationId: 0,
      status,
      amountMinor: this.decimalNumberToMinor(values.orderAmount),
      currency: "EGP",
      actionable: !refundLike,
      providerReportedFeeMinor: feeMinor,
      providerSettlementReference: batchNumber,
      safeMetadata: {
        fawryRefNumber: values.fawryRefNumber,
        merchantRefNumber: values.merchantRefNumber,
        orderStatus: values.orderStatus,
        paymentMethod: values.paymentMethod,
        paymentReferenceNumber:
          values.paymentReferenceNumber || undefined,
        paymentAmountMinor:
          this.decimalNumberToMinor(values.paymentAmount),
        fawryFeesMinor: feeMinor,
        paymentTime,
        failureErrorCode: this.integerValue(obj.failureErrorCode),
        failureReason: this.nonEmptyString(obj.failureReason),
        batchNumber,
        refunded: values.orderStatus === "REFUNDED",
        partialRefunded: values.orderStatus === "PARTIAL_REFUNDED",
      },
    };
  }

  private normalizeStatus(orderStatus: string) {
    switch (orderStatus.toUpperCase()) {
      case "PAID":
      case "REFUNDED":
      case "PARTIAL_REFUNDED":
        return OnlinePaymentIntentStatus.succeeded;
      case "CANCELED":
      case "CANCELLED":
        return OnlinePaymentIntentStatus.cancelled;
      case "EXPIRED":
        return OnlinePaymentIntentStatus.expired;
      case "FAILED":
        return OnlinePaymentIntentStatus.failed;
      case "NEW":
      default:
        return OnlinePaymentIntentStatus.pending;
    }
  }

  private resolveReturnUrl(
    requestedReturnUrl: string | undefined,
    config: FawryConfig,
  ) {
    const raw = requestedReturnUrl?.trim() || config.returnUrl;
    let url: URL;

    try {
      url = new URL(raw);
    } catch {
      throw new PaymentProviderError(
        "Fawry return URL is invalid",
        "invalid_request",
      );
    }

    if (
      config.appEnvironment === "production" &&
      url.protocol !== "https:"
    ) {
      throw new PaymentProviderError(
        "Fawry production return URL must use HTTPS",
        "environment_mismatch",
      );
    }

    if (
      config.allowedReturnOrigins.length > 0 &&
      !config.allowedReturnOrigins.includes(url.origin)
    ) {
      throw new PaymentProviderError(
        "Fawry return URL origin is not allowed",
        "invalid_request",
      );
    }

    return url.toString();
  }

  private extractRedirectUrl(value: unknown) {
    if (typeof value === "string") {
      return this.validHttpUrl(value);
    }

    const obj = this.requireRecord(
      value,
      "Fawry hosted checkout response",
    );
    const nextAction =
      obj.nextAction &&
      typeof obj.nextAction === "object" &&
      !Array.isArray(obj.nextAction)
        ? (obj.nextAction as Record<string, unknown>)
        : undefined;
    const candidate =
      this.nonEmptyString(obj.redirectUrl) ??
      this.nonEmptyString(obj.checkoutUrl) ??
      this.nonEmptyString(obj.url) ??
      this.nonEmptyString(nextAction?.redirectUrl);

    return candidate ? this.validHttpUrl(candidate) : undefined;
  }

  private readWebhookConfig() {
    const config = this.readConfig();

    if (!config.secureKey) {
      throw new PaymentProviderError(
        "Fawry secure key is not configured",
        "missing_config",
      );
    }

    return config;
  }

  private readConfig(): FawryConfig {
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    const checkoutUrl =
      this.configService.get<string>("onlinePayments.fawry.checkoutUrl") ??
      DEFAULT_STAGING_CHECKOUT_URL;
    const statusUrl =
      this.configService.get<string>("onlinePayments.fawry.statusUrl") ??
      DEFAULT_STAGING_STATUS_URL;
    const refundUrl =
      this.configService.get<string>("onlinePayments.fawry.refundUrl") ??
      DEFAULT_STAGING_REFUND_URL;
    const cancelUrl =
      this.configService.get<string>("onlinePayments.fawry.cancelUrl") ??
      DEFAULT_STAGING_CANCEL_URL;
    const merchantCode = this.nonEmptyString(
      this.configService.get<string>(
        "onlinePayments.fawry.merchantCode",
      ),
    );
    const secureKey = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.fawry.secureKey"),
    );
    const notificationUrl = this.nonEmptyString(
      this.configService.get<string>(
        "onlinePayments.fawry.notificationUrl",
      ),
    );
    const returnUrl = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.fawry.returnUrl"),
    );
    const allowedReturnOrigins =
      this.configService.get<string[]>(
        "onlinePayments.fawry.allowedReturnOrigins",
      ) ?? [];
    const timeoutMs =
      this.configService.get<number>("onlinePayments.fawry.timeoutMs") ??
      10000;
    const expirationSeconds =
      this.configService.get<number>(
        "onlinePayments.fawry.expirationSeconds",
      ) ?? 900;
    const expectedLive =
      this.configService.get<boolean>(
        "onlinePayments.fawry.expectedLive",
      ) ?? false;

    if (!merchantCode || !secureKey || !notificationUrl || !returnUrl) {
      throw new PaymentProviderError(
        "Fawry merchant configuration is incomplete",
        "missing_config",
      );
    }

    if (appEnvironment === "production" && !expectedLive) {
      throw new PaymentProviderError(
        "Production Fawry checkout must use live configuration",
        "environment_mismatch",
      );
    }

    return {
      checkoutUrl: this.validatedServerUrl(
        checkoutUrl,
        appEnvironment,
        "Fawry checkout URL",
      ),
      statusUrl: this.validatedServerUrl(
        statusUrl,
        appEnvironment,
        "Fawry status URL",
      ),
      refundUrl: this.validatedServerUrl(
        refundUrl,
        appEnvironment,
        "Fawry refund URL",
      ),
      cancelUrl: this.validatedServerUrl(
        cancelUrl,
        appEnvironment,
        "Fawry cancel URL",
      ),
      merchantCode,
      secureKey,
      notificationUrl: this.validatedServerUrl(
        notificationUrl,
        appEnvironment,
        "Fawry notification URL",
      ),
      returnUrl,
      allowedReturnOrigins,
      timeoutMs,
      expirationSeconds,
      expectedLive,
      appEnvironment,
    };
  }

  private validatedServerUrl(
    value: string,
    appEnvironment: string,
    label: string,
  ) {
    let url: URL;

    try {
      url = new URL(value);
    } catch {
      throw new PaymentProviderError(
        `${label} is invalid`,
        "missing_config",
      );
    }

    if (appEnvironment === "production" && url.protocol !== "https:") {
      throw new PaymentProviderError(
        `${label} must use HTTPS in production`,
        "environment_mismatch",
      );
    }

    return url.toString().replace(/\/$/, "");
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs: number,
    timeoutMessage: string,
    failureMessage: string,
  ) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PaymentProviderError(timeoutMessage, "timeout");
      }

      throw new PaymentProviderError(
        failureMessage,
        "provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private errorForHttpStatus(status: number, operation: string) {
    if (status === 401 || status === 403) {
      return new PaymentProviderError(
        `${operation} credentials were rejected`,
        "authentication_failed",
        { status },
      );
    }

    if (status === 404) {
      return new PaymentProviderError(
        `${operation} resource was not found`,
        "transaction_not_found",
        { status },
      );
    }

    if (status === 429) {
      return new PaymentProviderError(
        `${operation} rate limit reached`,
        "rate_limited",
        { status },
      );
    }

    if (status >= 400 && status < 500) {
      return new PaymentProviderError(
        `${operation} request was rejected`,
        "invalid_request",
        { status },
      );
    }

    return new PaymentProviderError(
      `${operation} is temporarily unavailable`,
      "provider_unavailable",
      { status },
    );
  }

  private deriveOrderAmount(obj: Record<string, unknown>) {
    const paymentAmount = this.decimalValue(obj.paymentAmount);

    if (paymentAmount === undefined) {
      return undefined;
    }

    const fawryFees = this.decimalValue(obj.fawryFees) ?? 0;
    const shippingFees = this.decimalValue(obj.shippingFees) ?? 0;
    const candidate = paymentAmount - fawryFees - shippingFees;

    return candidate >= 0 ? candidate : undefined;
  }

  private extractBatchNumber(obj: Record<string, unknown>) {
    const threeDSInfo =
      obj.threeDSInfo &&
      typeof obj.threeDSInfo === "object" &&
      !Array.isArray(obj.threeDSInfo)
        ? (obj.threeDSInfo as Record<string, unknown>)
        : undefined;

    return this.identifierString(threeDSInfo?.batchNumber);
  }

  private formatMinor(amountMinor: number) {
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      throw new PaymentProviderError(
        "Fawry payment amount is invalid",
        "invalid_request",
      );
    }

    return (amountMinor / 100).toFixed(2);
  }

  private formatDecimal(value: number) {
    return value.toFixed(2);
  }

  private decimalNumberToMinor(value: number) {
    return Math.round(value * 100);
  }

  private decimalToMinor(value: unknown) {
    const decimal = this.decimalValue(value);
    return decimal === undefined
      ? undefined
      : this.decimalNumberToMinor(decimal);
  }

  private decimalValue(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (
      typeof value === "string" &&
      /^-?\d+(?:\.\d+)?$/.test(value.trim())
    ) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private integerValue(value: unknown) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      return Number.parseInt(value, 10);
    }

    return undefined;
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

  private nonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : undefined;
  }

  private requireRecord(value: unknown, label: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new PaymentProviderError(
        `${label} must be an object`,
        "invalid_response",
      );
    }

    return value as Record<string, unknown>;
  }

  private validHttpUrl(value: string) {
    try {
      const url = new URL(value);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return undefined;
      }

      return url.toString();
    } catch {
      return undefined;
    }
  }

  private sha256(value: string) {
    return createHash("sha256").update(value, "utf8").digest("hex");
  }

  private safeEqualHex(expected: string, received: string) {
    if (
      !/^[a-f0-9]{64}$/i.test(expected) ||
      !/^[a-f0-9]{64}$/i.test(received)
    ) {
      return false;
    }

    const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
    const receivedBuffer = Buffer.from(received.toLowerCase(), "hex");

    return (
      expectedBuffer.length === receivedBuffer.length &&
      timingSafeEqual(expectedBuffer, receivedBuffer)
    );
  }
}
