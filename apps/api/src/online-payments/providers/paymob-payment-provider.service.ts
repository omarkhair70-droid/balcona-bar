import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import {
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
} from "@prisma/client";
import {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProviderError,
  ProviderPostPaymentOperationInput,
  ProviderPostPaymentOperationResult,
  ProviderTransactionInquiryResult,
  ProviderTransactionState,
  VerifiedProviderTransactionWebhook,
} from "./payment-provider.types";

const DEFAULT_PAYMOB_BASE_URL = "https://accept.paymob.com";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_EXPIRATION_SECONDS = 15 * 60;

type PaymobIntentionResponse = {
  id?: string;
  client_secret?: string;
  intention_order_id?: number | string;
  status?: string;
  created?: string;
  intention_detail?: {
    amount?: number;
    currency?: string;
  };
  payment_methods?: Array<{
    integration_id?: number;
    live?: boolean;
    name?: string;
    method_type?: string;
  }>;
};

type PaymobInquiryConfig = {
  baseUrl: string;
  apiKey: string;
  integrationIds: number[];
  timeoutMs: number;
  expectedLive: boolean;
};

type PaymobPostPaymentConfig = {
  baseUrl: string;
  secretKey: string;
  integrationIds: number[];
  timeoutMs: number;
  expectedLive: boolean;
};


@Injectable()
export class PaymobPaymentProviderService {
  readonly provider = OnlinePaymentProvider.paymob;
  private inquiryAuthToken?: { token: string; expiresAtMs: number };
  private inquiryAuthTokenRequest?: Promise<string>;

  constructor(private readonly configService: ConfigService) {}

  async createPayment(
    input: CreateProviderPaymentInput,
  ): Promise<CreateProviderPaymentResult> {
    const config = this.readConfig();
    const returnUrl = this.validatedReturnUrl(input.customerReturnUrl, config);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    let response: Response;

    try {
      response = await fetch(`${config.baseUrl}/v1/intention/`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Token ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amountMinor,
          currency: input.currency,
          payment_methods: config.integrationIds,
          billing_data: {
            first_name: input.billingData.firstName,
            last_name: input.billingData.lastName,
            email: input.billingData.email,
            phone_number: input.billingData.phoneNumber,
          },
          special_reference: input.localIntentId,
          notification_url: config.notificationUrl,
          ...(returnUrl ? { redirection_url: returnUrl } : {}),
          expiration: config.expirationSeconds,
          extras: {
            balcona_intent_id: input.localIntentId,
            balcona_company_id: input.companyId,
            balcona_branch_id: input.branchId,
            balcona_bill_id: input.billId,
          },
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PaymentProviderError(
          "Paymob intention request timed out",
          "timeout",
        );
      }

      throw new PaymentProviderError(
        "Paymob intention request failed",
        "provider_unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw this.errorForHttpStatus(response.status);
    }

    let payload: PaymobIntentionResponse;

    try {
      payload = (await response.json()) as PaymobIntentionResponse;
    } catch {
      throw new PaymentProviderError(
        "Paymob returned a non-JSON intention response",
        "invalid_response",
        { status: response.status },
      );
    }

    const providerIntentId = this.identifierString(payload.id);
    const providerOrderId = this.identifierString(payload.intention_order_id);
    const clientSecret = this.nonEmptyString(payload.client_secret);
    const responseAmount = payload.intention_detail?.amount;
    const responseCurrency = this.nonEmptyString(
      payload.intention_detail?.currency,
    );

    if (!providerIntentId || !providerOrderId || !clientSecret) {
      throw new PaymentProviderError(
        "Paymob intention response is missing required identifiers",
        "invalid_response",
        { status: response.status },
      );
    }

    if (responseAmount !== input.amountMinor) {
      throw new PaymentProviderError(
        "Paymob intention amount does not match the Balcona intent",
        "amount_mismatch",
        {
          expectedAmountMinor: input.amountMinor,
          receivedAmountMinor: responseAmount,
        },
      );
    }

    if (responseCurrency !== input.currency) {
      throw new PaymentProviderError(
        "Paymob intention currency does not match the Balcona intent",
        "currency_mismatch",
        {
          expectedCurrency: input.currency,
          receivedCurrency: responseCurrency,
        },
      );
    }

    const liveFlags = (payload.payment_methods ?? [])
      .map((method) => method.live)
      .filter((value): value is boolean => typeof value === "boolean");

    if (
      liveFlags.length > 0 &&
      liveFlags.some((live) => live !== config.expectedLive)
    ) {
      throw new PaymentProviderError(
        "Paymob intention environment does not match configuration",
        "environment_mismatch",
        {
          expectedLive: config.expectedLive,
        },
      );
    }

    const checkoutUrl = new URL("/unifiedcheckout/", config.baseUrl);
    checkoutUrl.searchParams.set("publicKey", config.publicKey);
    checkoutUrl.searchParams.set("clientSecret", clientSecret);

    return {
      provider: this.provider,
      providerIntentId,
      providerOrderId,
      status: OnlinePaymentIntentStatus.pending,
      checkoutUrl: checkoutUrl.toString(),
      checkoutExpiresAt: new Date(
        Date.now() + config.expirationSeconds * 1000,
      ),
      metadata: {
        paymobIntentionOrderId: payload.intention_order_id,
        paymobStatus: payload.status,
        paymobCreatedAt: payload.created,
        paymentMethodIntegrationIds: (payload.payment_methods ?? [])
          .map((method) => method.integration_id)
          .filter((value): value is number => Number.isInteger(value)),
        expectedLive: config.expectedLive,
      },
    };
  }

  refundTransaction(
    input: Omit<ProviderPostPaymentOperationInput, "type">,
  ) {
    return this.performPostPaymentOperation({
      ...input,
      type: OnlinePaymentOperationType.refund,
    });
  }

  voidTransaction(
    input: Omit<ProviderPostPaymentOperationInput, "type">,
  ) {
    return this.performPostPaymentOperation({
      ...input,
      type: OnlinePaymentOperationType.void,
    });
  }

  captureTransaction(
    input: Omit<ProviderPostPaymentOperationInput, "type">,
  ) {
    return this.performPostPaymentOperation({
      ...input,
      type: OnlinePaymentOperationType.capture,
    });
  }

  private async performPostPaymentOperation(
    input: ProviderPostPaymentOperationInput,
  ): Promise<ProviderPostPaymentOperationResult> {
    const config = this.readPostPaymentConfig();
    const parentProviderTransactionId = this.identifierString(
      input.parentProviderTransactionId,
    );

    if (!parentProviderTransactionId || !/^\d+$/.test(parentProviderTransactionId)) {
      throw new PaymentProviderError(
        "Paymob transaction id is invalid",
        "invalid_request",
      );
    }

    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new PaymentProviderError(
        "Paymob post-payment amount is invalid",
        "invalid_request",
      );
    }

    const operationPath =
      input.type === OnlinePaymentOperationType.refund
        ? "/api/acceptance/void_refund/refund"
        : input.type === OnlinePaymentOperationType.void
          ? "/api/acceptance/void_refund/void"
          : "/api/acceptance/capture";
    const body =
      input.type === OnlinePaymentOperationType.void
        ? { transaction_id: Number(parentProviderTransactionId) }
        : {
            transaction_id: Number(parentProviderTransactionId),
            amount_cents: input.amountMinor,
          };

    const response = await this.fetchWithTimeout(
      `${config.baseUrl}${operationPath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      config.timeoutMs,
      `Paymob ${input.type} request timed out`,
      `Paymob ${input.type} request failed`,
    );

    if (!response.ok) {
      throw this.errorForPostPaymentHttpStatus(response.status, input.type);
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        `Paymob returned a non-JSON ${input.type} response`,
        "invalid_response",
        { status: response.status },
      );
    }

    return this.normalizePostPaymentOperation(
      value,
      input,
      config,
    );
  }

  async inquireTransactionByOrder(
    providerOrderIdValue: string,
  ): Promise<ProviderTransactionInquiryResult> {
    const config = this.readInquiryConfig();
    const providerOrderId = this.identifierString(providerOrderIdValue);

    if (!providerOrderId) {
      throw new PaymentProviderError(
        "Paymob order id is required for transaction inquiry",
        "invalid_request",
      );
    }

    let authToken = await this.getInquiryAuthToken(config);
    let response = await this.fetchTransactionInquiry(
      config,
      authToken,
      providerOrderId,
    );

    if (response.status === 401 || response.status === 403) {
      this.inquiryAuthToken = undefined;
      authToken = await this.getInquiryAuthToken(config, true);
      response = await this.fetchTransactionInquiry(
        config,
        authToken,
        providerOrderId,
      );
    }

    if (response.status === 404) {
      return {
        found: false,
        provider: this.provider,
        providerOrderId,
      };
    }

    if (!response.ok) {
      throw this.errorForInquiryHttpStatus(response.status);
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Paymob returned a non-JSON transaction inquiry response",
        "invalid_response",
        { status: response.status },
      );
    }

    const transaction = this.normalizeInquiryTransaction(
      value,
      providerOrderId,
      config,
    );

    return {
      found: true,
      provider: this.provider,
      providerOrderId,
      transaction,
    };
  }

  async inquireTransactionById(
    providerTransactionIdValue: string,
  ): Promise<ProviderTransactionState> {
    const config = this.readInquiryConfig();
    const providerTransactionId = this.identifierString(
      providerTransactionIdValue,
    );

    if (!providerTransactionId || !/^\d+$/.test(providerTransactionId)) {
      throw new PaymentProviderError(
        "Paymob transaction id is required for transaction inquiry",
        "invalid_request",
      );
    }

    let authToken = await this.getInquiryAuthToken(config);
    let response = await this.fetchTransactionById(
      config,
      authToken,
      providerTransactionId,
    );

    if (response.status === 401 || response.status === 403) {
      this.inquiryAuthToken = undefined;
      authToken = await this.getInquiryAuthToken(config, true);
      response = await this.fetchTransactionById(
        config,
        authToken,
        providerTransactionId,
      );
    }

    if (response.status === 404) {
      throw new PaymentProviderError(
        "Paymob transaction was not found",
        "transaction_not_found",
      );
    }

    if (!response.ok) {
      throw this.errorForInquiryHttpStatus(response.status);
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Paymob returned a non-JSON transaction inquiry response",
        "invalid_response",
        { status: response.status },
      );
    }

    const transaction = this.normalizeInquiryTransaction(
      value,
      undefined,
      config,
    );

    if (transaction.providerTransactionId !== providerTransactionId) {
      throw new PaymentProviderError(
        "Paymob inquiry returned a different transaction",
        "invalid_response",
      );
    }

    return transaction;
  }

  private async getInquiryAuthToken(
    config: PaymobInquiryConfig,
    forceRefresh = false,
  ) {
    const now = Date.now();

    if (
      !forceRefresh &&
      this.inquiryAuthToken &&
      this.inquiryAuthToken.expiresAtMs > now
    ) {
      return this.inquiryAuthToken.token;
    }

    if (!forceRefresh && this.inquiryAuthTokenRequest) {
      return this.inquiryAuthTokenRequest;
    }

    const request = this.requestInquiryAuthToken(config);

    if (!forceRefresh) {
      this.inquiryAuthTokenRequest = request;
    }

    try {
      return await request;
    } finally {
      if (!forceRefresh) {
        this.inquiryAuthTokenRequest = undefined;
      }
    }
  }

  private async requestInquiryAuthToken(
    config: PaymobInquiryConfig,
  ) {
    const response = await this.fetchWithTimeout(
      `${config.baseUrl}/api/auth/tokens`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: config.apiKey }),
      },
      config.timeoutMs,
      "Paymob inquiry authentication timed out",
      "Paymob inquiry authentication request failed",
    );

    if (!response.ok) {
      throw this.errorForInquiryHttpStatus(response.status);
    }

    let value: unknown;

    try {
      value = await response.json();
    } catch {
      throw new PaymentProviderError(
        "Paymob returned a non-JSON inquiry authentication response",
        "invalid_response",
        { status: response.status },
      );
    }

    const payload = this.requireRecord(
      value,
      "Paymob inquiry authentication response",
    );
    const token = this.nonEmptyString(payload.token);

    if (!token) {
      throw new PaymentProviderError(
        "Paymob inquiry authentication response is missing token",
        "invalid_response",
      );
    }

    this.inquiryAuthToken = {
      token,
      expiresAtMs: Date.now() + 55 * 60 * 1000,
    };

    return token;
  }

  private fetchTransactionInquiry(
    config: PaymobInquiryConfig,
    authToken: string,
    providerOrderId: string,
  ) {
    return this.fetchWithTimeout(
      `${config.baseUrl}/api/ecommerce/orders/transaction_inquiry`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order_id: providerOrderId }),
      },
      config.timeoutMs,
      "Paymob transaction inquiry timed out",
      "Paymob transaction inquiry request failed",
    );
  }

  private fetchTransactionById(
    config: PaymobInquiryConfig,
    authToken: string,
    providerTransactionId: string,
  ) {
    return this.fetchWithTimeout(
      `${config.baseUrl}/api/acceptance/transactions/${encodeURIComponent(
        providerTransactionId,
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      },
      config.timeoutMs,
      "Paymob transaction inquiry timed out",
      "Paymob transaction inquiry request failed",
    );
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

  private normalizeInquiryTransaction(
    value: unknown,
    expectedProviderOrderId: string | undefined,
    config: PaymobInquiryConfig,
  ): ProviderTransactionState {
    const obj = this.requireRecord(value, "Paymob transaction inquiry response");
    const order = this.requireRecord(
      obj.order,
      "Paymob transaction inquiry order",
    );
    const sourceData =
      obj.source_data && typeof obj.source_data === "object"
        ? this.requireRecord(
            obj.source_data,
            "Paymob transaction inquiry source data",
          )
        : {};

    const providerTransactionId = this.identifierString(obj.id);
    const providerOrderId = this.identifierString(order.id);
    const amountMinor = this.integerValue(obj.amount_cents);
    const currency = this.nonEmptyString(obj.currency);
    const integrationId = this.integerValue(obj.integration_id);
    const isLive = this.booleanValue(obj.is_live);

    if (
      !providerTransactionId ||
      !providerOrderId ||
      amountMinor === undefined ||
      !currency ||
      integrationId === undefined ||
      isLive === undefined
    ) {
      throw new PaymentProviderError(
        "Paymob transaction inquiry is missing required values",
        "invalid_response",
      );
    }

    if (
      expectedProviderOrderId &&
      providerOrderId !== expectedProviderOrderId
    ) {
      throw new PaymentProviderError(
        "Paymob inquiry returned a different order",
        "invalid_response",
        {
          expectedProviderOrderId,
          receivedProviderOrderId: providerOrderId,
        },
      );
    }

    if (!config.integrationIds.includes(integrationId)) {
      throw new PaymentProviderError(
        "Paymob inquiry transaction uses an unconfigured integration",
        "environment_mismatch",
        { integrationId },
      );
    }

    if (isLive !== config.expectedLive) {
      throw new PaymentProviderError(
        "Paymob inquiry environment does not match configuration",
        "environment_mismatch",
        {
          expectedLive: config.expectedLive,
          receivedLive: isLive,
        },
      );
    }

    const pending = this.booleanValue(obj.pending);
    const success = this.booleanValue(obj.success);
    const isAuth = this.booleanValue(obj.is_auth);
    const isCapture = this.booleanValue(obj.is_capture);
    const isVoided = this.booleanValue(obj.is_voided);
    const isRefunded = this.booleanValue(obj.is_refunded);
    const hasParentTransaction = this.booleanValue(
      obj.has_parent_transaction,
    );

    if (
      pending === undefined ||
      success === undefined ||
      isAuth === undefined ||
      isCapture === undefined ||
      isVoided === undefined ||
      isRefunded === undefined ||
      hasParentTransaction === undefined
    ) {
      throw new PaymentProviderError(
        "Paymob transaction inquiry contains invalid state flags",
        "invalid_response",
      );
    }

    const orderCancelled =
      this.booleanValue(order.is_canceled) === true ||
      this.booleanValue(order.is_cancel) === true;
    const status = this.normalizeTransactionStatus({
      pending,
      success,
      isAuth,
      isCapture,
      isVoided: isVoided || orderCancelled,
    });
    const merchantReference = this.identifierString(order.merchant_order_id);
    const parentProviderTransactionId = this.identifierString(
      obj.parent_transaction,
    );
    const isRefund = this.booleanValue(obj.is_refund) === true;
    const isVoid = this.booleanValue(obj.is_void) === true;
    const operationType = isCapture
      ? OnlinePaymentOperationType.capture
      : isRefund
        ? OnlinePaymentOperationType.refund
        : isVoid
          ? OnlinePaymentOperationType.void
          : undefined;
    const refundedAmountMinor = this.integerValue(obj.refunded_amount_cents);
    const capturedAmountMinor =
      isCapture ? amountMinor : this.integerValue(obj.captured_amount);
    const updatedAt = this.nonEmptyString(obj.updated_at);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify([
          providerTransactionId,
          providerOrderId,
          amountMinor,
          currency,
          integrationId,
          pending,
          success,
          isAuth,
          isCapture,
          isVoided,
          isRefunded,
          hasParentTransaction,
          isLive,
          updatedAt ?? null,
        ]),
      )
      .digest("hex")
      .slice(0, 32);

    return {
      provider: this.provider,
      providerEventId: `paymob_inquiry_${providerTransactionId}_${fingerprint}`,
      providerTransactionId,
      providerOrderId,
      merchantReference,
      integrationId,
      status,
      amountMinor,
      currency,
      actionable: !hasParentTransaction && !isRefunded,
      hasParentTransaction,
      parentProviderTransactionId,
      operationType,
      refundedAmountMinor,
      capturedAmountMinor,
      isLive,
      safeMetadata: {
        providerTransactionId,
        providerOrderId,
        integrationId,
        inquiry: true,
        isLive,
        updatedAt,
        errorOccurred: this.booleanValue(obj.error_occured),
        hasParentTransaction,
        isAuth,
        isCapture,
        isRefund,
        isVoid,
        isRefunded,
        isVoided,
        parentProviderTransactionId,
        operationType,
        pending,
        success,
        sourceType: this.nonEmptyString(sourceData.type),
        sourceSubtype: this.nonEmptyString(sourceData.sub_type),
      },
    };
  }

  private normalizeTransactionStatus(input: {
    pending: boolean;
    success: boolean;
    isAuth: boolean;
    isCapture: boolean;
    isVoided: boolean;
  }) {
    if (input.pending) {
      return OnlinePaymentIntentStatus.pending;
    }

    if (input.isVoided) {
      return OnlinePaymentIntentStatus.cancelled;
    }

    if (input.success && input.isAuth && !input.isCapture) {
      return OnlinePaymentIntentStatus.requires_action;
    }

    if (input.success) {
      return OnlinePaymentIntentStatus.succeeded;
    }

    return OnlinePaymentIntentStatus.failed;
  }

  verifyTransactionWebhook(
    objValue: unknown,
    receivedHmacValue: string,
  ): VerifiedProviderTransactionWebhook {
    const config = this.readWebhookConfig();
    const obj = this.requireRecord(objValue, "Paymob transaction object");
    const order = this.requireRecord(obj.order, "Paymob transaction order");
    const sourceData = this.requireRecord(
      obj.source_data,
      "Paymob transaction source data",
    );

    const signedFields = [
      this.requireSignedScalar(obj.amount_cents, "amount_cents"),
      this.requireSignedScalar(obj.created_at, "created_at"),
      this.requireSignedScalar(obj.currency, "currency"),
      this.requireSignedScalar(obj.error_occured, "error_occured"),
      this.requireSignedScalar(
        obj.has_parent_transaction,
        "has_parent_transaction",
      ),
      this.requireSignedScalar(obj.id, "id"),
      this.requireSignedScalar(obj.integration_id, "integration_id"),
      this.requireSignedScalar(obj.is_3d_secure, "is_3d_secure"),
      this.requireSignedScalar(obj.is_auth, "is_auth"),
      this.requireSignedScalar(obj.is_capture, "is_capture"),
      this.requireSignedScalar(obj.is_refunded, "is_refunded"),
      this.requireSignedScalar(
        obj.is_standalone_payment,
        "is_standalone_payment",
      ),
      this.requireSignedScalar(obj.is_voided, "is_voided"),
      this.requireSignedScalar(order.id, "order.id"),
      this.requireSignedScalar(obj.owner, "owner"),
      this.requireSignedScalar(obj.pending, "pending"),
      this.requireSignedScalar(sourceData.pan, "source_data.pan"),
      this.requireSignedScalar(sourceData.sub_type, "source_data.sub_type"),
      this.requireSignedScalar(sourceData.type, "source_data.type"),
      this.requireSignedScalar(obj.success, "success"),
    ];
    const canonical = signedFields.map((value) => String(value)).join("");
    const receivedHmac = receivedHmacValue.trim().toLowerCase();

    if (!/^[a-f0-9]{128}$/.test(receivedHmac)) {
      throw new PaymentProviderError(
        "Paymob transaction HMAC is invalid",
        "signature_invalid",
      );
    }

    const computedHmac = createHmac("sha512", config.hmacSecret)
      .update(canonical)
      .digest("hex");
    const verified = timingSafeEqual(
      Buffer.from(computedHmac, "hex"),
      Buffer.from(receivedHmac, "hex"),
    );

    if (!verified) {
      throw new PaymentProviderError(
        "Paymob transaction HMAC verification failed",
        "signature_invalid",
      );
    }

    const providerTransactionId = this.identifierString(obj.id);
    const providerOrderId = this.identifierString(order.id);
    const amountMinor = this.integerValue(obj.amount_cents);
    const currency = this.nonEmptyString(obj.currency);
    const integrationId = this.integerValue(obj.integration_id);

    if (
      !providerTransactionId ||
      !providerOrderId ||
      amountMinor === undefined ||
      !currency ||
      integrationId === undefined
    ) {
      throw new PaymentProviderError(
        "Paymob transaction callback is missing required verified values",
        "invalid_response",
      );
    }

    if (!config.integrationIds.includes(integrationId)) {
      throw new PaymentProviderError(
        "Paymob transaction uses an integration that is not configured",
        "environment_mismatch",
        { integrationId },
      );
    }

    const pending = this.booleanValue(obj.pending);
    const success = this.booleanValue(obj.success);
    const isAuth = this.booleanValue(obj.is_auth);
    const isCapture = this.booleanValue(obj.is_capture);
    const isVoided = this.booleanValue(obj.is_voided);
    const hasParentTransaction = this.booleanValue(
      obj.has_parent_transaction,
    );

    if (
      pending === undefined ||
      success === undefined ||
      isAuth === undefined ||
      isCapture === undefined ||
      isVoided === undefined ||
      hasParentTransaction === undefined
    ) {
      throw new PaymentProviderError(
        "Paymob transaction callback contains invalid state flags",
        "invalid_response",
      );
    }

    const status = this.normalizeTransactionStatus({
      pending,
      success,
      isAuth,
      isCapture,
      isVoided,
    });

    const merchantReference = this.identifierString(order.merchant_order_id);
    const providerEventId =
      `paymob_tx_${providerTransactionId}_${computedHmac.slice(0, 32)}`;

    return {
      provider: this.provider,
      providerEventId,
      providerTransactionId,
      providerOrderId,
      merchantReference,
      integrationId,
      status,
      amountMinor,
      currency,
      actionable: !hasParentTransaction,
      hasParentTransaction,
      safeMetadata: {
        providerTransactionId,
        providerOrderId,
        integrationId,
        errorOccurred: this.booleanValue(obj.error_occured),
        hasParentTransaction,
        is3dSecure: this.booleanValue(obj.is_3d_secure),
        isAuth,
        isCapture,
        isRefunded: this.booleanValue(obj.is_refunded),
        isStandalonePayment: this.booleanValue(obj.is_standalone_payment),
        isVoided,
        pending,
        success,
        sourceType: this.nonEmptyString(sourceData.type),
        sourceSubtype: this.nonEmptyString(sourceData.sub_type),
      },
    };
  }

  private readPostPaymentConfig(): PaymobPostPaymentConfig {
    const configuredBaseUrl = (
      this.configService.get<string>("onlinePayments.paymob.baseUrl") ??
      DEFAULT_PAYMOB_BASE_URL
    ).replace(/\/+$/, "");
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    const secretKey = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.secretKey"),
    );
    const integrationIds =
      this.configService.get<number[]>("onlinePayments.paymob.integrationIds") ??
      [];
    const timeoutMs =
      this.configService.get<number>("onlinePayments.paymob.timeoutMs") ??
      DEFAULT_TIMEOUT_MS;
    const expectedLive =
      this.configService.get<boolean>("onlinePayments.paymob.expectedLive") ??
      false;

    if (!secretKey) {
      throw new PaymentProviderError(
        "Paymob secret key is not configured for post-payment operations",
        "missing_config",
      );
    }

    if (integrationIds.length === 0) {
      throw new PaymentProviderError(
        "Paymob payment integration IDs are not configured",
        "missing_config",
      );
    }

    if (appEnvironment === "production" && !expectedLive) {
      throw new PaymentProviderError(
        "Production Paymob post-payment operations require live configuration",
        "environment_mismatch",
      );
    }

    return {
      baseUrl: this.validatedServerUrl(
        configuredBaseUrl,
        appEnvironment,
        "Paymob base URL",
      ),
      secretKey,
      integrationIds,
      timeoutMs,
      expectedLive,
    };
  }

  private normalizePostPaymentOperation(
    value: unknown,
    input: ProviderPostPaymentOperationInput,
    config: PaymobPostPaymentConfig,
  ): ProviderPostPaymentOperationResult {
    const obj = this.requireRecord(
      value,
      `Paymob ${input.type} response`,
    );
    const providerTransactionId = this.identifierString(obj.id);
    const parentProviderTransactionId =
      this.identifierString(obj.parent_transaction) ??
      input.parentProviderTransactionId;
    const integrationId = this.integerValue(obj.integration_id);
    const isLive = this.booleanValue(obj.is_live);
    const pending = this.booleanValue(obj.pending);
    const success = this.booleanValue(obj.success);
    const errorOccurred = this.booleanValue(obj.error_occured) ?? false;
    const currency = this.nonEmptyString(obj.currency);
    const responseAmount = this.integerValue(obj.amount_cents);
    const isCapture = this.booleanValue(obj.is_capture) === true;
    const isRefund = this.booleanValue(obj.is_refund) === true;
    const isVoid = this.booleanValue(obj.is_void) === true;
    const isCaptured = this.booleanValue(obj.is_captured) === true;
    const isRefunded = this.booleanValue(obj.is_refunded) === true;
    const isVoided = this.booleanValue(obj.is_voided) === true;

    if (
      !providerTransactionId ||
      integrationId === undefined ||
      isLive === undefined ||
      pending === undefined ||
      success === undefined
    ) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response is missing required values`,
        "invalid_response",
      );
    }

    if (parentProviderTransactionId !== input.parentProviderTransactionId) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response references a different parent transaction`,
        "invalid_response",
      );
    }

    if (!config.integrationIds.includes(integrationId)) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response uses an unconfigured integration`,
        "environment_mismatch",
        { integrationId },
      );
    }

    if (isLive !== config.expectedLive) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response environment does not match configuration`,
        "environment_mismatch",
        {
          expectedLive: config.expectedLive,
          receivedLive: isLive,
        },
      );
    }

    if (currency && currency !== input.expectedCurrency) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response currency does not match the Balcona payment`,
        "currency_mismatch",
        {
          expectedCurrency: input.expectedCurrency,
          receivedCurrency: currency,
        },
      );
    }

    const operationFlagMatches =
      input.type === OnlinePaymentOperationType.refund
        ? isRefund || isRefunded
        : input.type === OnlinePaymentOperationType.void
          ? isVoid || isVoided
          : isCapture || isCaptured;

    if (!operationFlagMatches) {
      throw new PaymentProviderError(
        `Paymob response does not represent the requested ${input.type} operation`,
        "invalid_response",
      );
    }

    if (
      providerTransactionId !== input.parentProviderTransactionId &&
      responseAmount !== undefined &&
      responseAmount !== input.amountMinor
    ) {
      throw new PaymentProviderError(
        `Paymob ${input.type} response amount does not match the requested amount`,
        "amount_mismatch",
        {
          expectedAmountMinor: input.amountMinor,
          receivedAmountMinor: responseAmount,
        },
      );
    }

    const status =
      pending
        ? OnlinePaymentOperationStatus.pending
        : success && !errorOccurred
          ? OnlinePaymentOperationStatus.succeeded
          : OnlinePaymentOperationStatus.failed;
    const order =
      obj.order && typeof obj.order === "object" && !Array.isArray(obj.order)
        ? (obj.order as Record<string, unknown>)
        : undefined;
    const providerOrderId = order
      ? this.identifierString(order.id)
      : this.identifierString(obj.order);

    return {
      provider: this.provider,
      type: input.type,
      status,
      parentProviderTransactionId,
      providerTransactionId,
      providerOrderId,
      amountMinor: input.amountMinor,
      currency: currency ?? input.expectedCurrency,
      safeMetadata: {
        integrationId,
        isLive,
        pending,
        success,
        errorOccurred,
        isCapture,
        isRefund,
        isVoid,
        isCaptured,
        isRefunded,
        isVoided,
        providerOrderId,
      },
    };
  }

  private errorForPostPaymentHttpStatus(
    status: number,
    type: OnlinePaymentOperationType,
  ) {
    if (status === 401 || status === 403) {
      return new PaymentProviderError(
        `Paymob rejected the configured credentials for ${type}`,
        "authentication_failed",
        { status },
      );
    }

    if (status === 429) {
      return new PaymentProviderError(
        `Paymob ${type} rate limit reached`,
        "rate_limited",
        { status },
      );
    }

    if (status >= 400 && status < 500) {
      return new PaymentProviderError(
        `Paymob rejected the ${type} request`,
        "invalid_request",
        { status },
      );
    }

    return new PaymentProviderError(
      `Paymob ${type} is temporarily unavailable`,
      "provider_unavailable",
      { status },
    );
  }

  private readInquiryConfig(): PaymobInquiryConfig {
    const configuredBaseUrl = (
      this.configService.get<string>("onlinePayments.paymob.baseUrl") ??
      DEFAULT_PAYMOB_BASE_URL
    ).replace(/\/+$/, "");
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    const apiKey = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.apiKey"),
    );
    const integrationIds =
      this.configService.get<number[]>("onlinePayments.paymob.integrationIds") ??
      [];
    const timeoutMs =
      this.configService.get<number>("onlinePayments.paymob.timeoutMs") ??
      DEFAULT_TIMEOUT_MS;
    const expectedLive =
      this.configService.get<boolean>("onlinePayments.paymob.expectedLive") ??
      false;

    if (!apiKey) {
      throw new PaymentProviderError(
        "Paymob API key is not configured for transaction inquiry",
        "missing_config",
      );
    }

    if (integrationIds.length === 0) {
      throw new PaymentProviderError(
        "Paymob payment integration IDs are not configured",
        "missing_config",
      );
    }

    if (appEnvironment === "production" && !expectedLive) {
      throw new PaymentProviderError(
        "Production Paymob inquiry must use live payment configuration",
        "environment_mismatch",
      );
    }

    return {
      baseUrl: this.validatedServerUrl(
        configuredBaseUrl,
        appEnvironment,
        "Paymob base URL",
      ),
      apiKey,
      integrationIds,
      timeoutMs,
      expectedLive,
    };
  }

  private errorForInquiryHttpStatus(status: number) {
    if (status === 401 || status === 403) {
      return new PaymentProviderError(
        "Paymob rejected the inquiry credentials",
        "authentication_failed",
        { status },
      );
    }

    if (status === 429) {
      return new PaymentProviderError(
        "Paymob inquiry rate limit reached",
        "rate_limited",
        { status },
      );
    }

    if (status >= 400 && status < 500) {
      return new PaymentProviderError(
        "Paymob rejected the transaction inquiry",
        "invalid_request",
        { status },
      );
    }

    return new PaymentProviderError(
      "Paymob transaction inquiry is temporarily unavailable",
      "provider_unavailable",
      { status },
    );
  }

  private readWebhookConfig() {
    const hmacSecret = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.hmacSecret"),
    );
    const integrationIds =
      this.configService.get<number[]>("onlinePayments.paymob.integrationIds") ??
      [];

    if (!hmacSecret) {
      throw new PaymentProviderError(
        "Paymob HMAC secret is not configured",
        "missing_config",
      );
    }

    if (integrationIds.length === 0) {
      throw new PaymentProviderError(
        "Paymob payment integration IDs are not configured",
        "missing_config",
      );
    }

    return { hmacSecret, integrationIds };
  }

  private readConfig() {
    const configuredBaseUrl = (
      this.configService.get<string>("onlinePayments.paymob.baseUrl") ??
      DEFAULT_PAYMOB_BASE_URL
    ).replace(/\/+$/, "");
    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    const secretKey = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.secretKey"),
    );
    const publicKey = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.publicKey"),
    );
    const notificationUrl = this.nonEmptyString(
      this.configService.get<string>("onlinePayments.paymob.notificationUrl"),
    );
    const integrationIds =
      this.configService.get<number[]>("onlinePayments.paymob.integrationIds") ??
      [];
    const allowedReturnOrigins =
      this.configService.get<string[]>(
        "onlinePayments.paymob.allowedReturnOrigins",
      ) ?? [];
    const timeoutMs =
      this.configService.get<number>("onlinePayments.paymob.timeoutMs") ??
      DEFAULT_TIMEOUT_MS;
    const expirationSeconds =
      this.configService.get<number>(
        "onlinePayments.paymob.expirationSeconds",
      ) ?? DEFAULT_EXPIRATION_SECONDS;
    const expectedLive =
      this.configService.get<boolean>("onlinePayments.paymob.expectedLive") ??
      false;

    if (!secretKey || !publicKey || !notificationUrl) {
      throw new PaymentProviderError(
        "Paymob payment credentials are not configured",
        "missing_config",
      );
    }

    if (integrationIds.length === 0) {
      throw new PaymentProviderError(
        "Paymob payment integration IDs are not configured",
        "missing_config",
      );
    }

    if (appEnvironment === "production" && !expectedLive) {
      throw new PaymentProviderError(
        "Production Paymob configuration must use live credentials and integration IDs",
        "environment_mismatch",
      );
    }

    const baseUrl = this.validatedServerUrl(
      configuredBaseUrl,
      appEnvironment,
      "Paymob base URL",
    );
    const safeNotificationUrl = this.validatedServerUrl(
      notificationUrl,
      appEnvironment,
      "Paymob notification URL",
    );

    return {
      baseUrl,
      secretKey,
      publicKey,
      notificationUrl: safeNotificationUrl,
      integrationIds,
      allowedReturnOrigins,
      timeoutMs,
      expirationSeconds,
      expectedLive,
    };
  }

  private validatedReturnUrl(
    value: string | undefined,
    config: { allowedReturnOrigins: string[] },
  ) {
    const normalized = this.nonEmptyString(value);

    if (!normalized) {
      return undefined;
    }

    let url: URL;

    try {
      url = new URL(normalized);
    } catch {
      throw new PaymentProviderError(
        "Customer return URL is invalid",
        "invalid_request",
      );
    }

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new PaymentProviderError(
        "Customer return URL protocol is not allowed",
        "invalid_request",
      );
    }

    if (config.allowedReturnOrigins.length === 0) {
      throw new PaymentProviderError(
        "Customer return URL cannot be used without an origin allowlist",
        "invalid_request",
      );
    }

    if (!config.allowedReturnOrigins.includes(url.origin)) {
      throw new PaymentProviderError(
        "Customer return URL origin is not allowed",
        "invalid_request",
      );
    }

    const appEnvironment =
      this.configService.get<string>("app.environment") ?? "development";
    if (appEnvironment === "production" && url.protocol !== "https:") {
      throw new PaymentProviderError(
        "Customer return URL must use HTTPS in production",
        "invalid_request",
      );
    }

    return url.toString();
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

    if (!["http:", "https:"].includes(url.protocol)) {
      throw new PaymentProviderError(
        `${label} protocol is not allowed`,
        "missing_config",
      );
    }

    if (appEnvironment === "production" && url.protocol !== "https:") {
      throw new PaymentProviderError(
        `${label} must use HTTPS in production`,
        "environment_mismatch",
      );
    }

    return url.toString().replace(/\/+$/, "");
  }

  private errorForHttpStatus(status: number) {
    if (status === 401 || status === 403) {
      return new PaymentProviderError(
        "Paymob rejected the configured credentials",
        "authentication_failed",
        { status },
      );
    }

    if (status === 429) {
      return new PaymentProviderError(
        "Paymob rate limit reached",
        "rate_limited",
        { status },
      );
    }

    if (status >= 400 && status < 500) {
      return new PaymentProviderError(
        "Paymob rejected the intention request",
        "invalid_request",
        { status },
      );
    }

    return new PaymentProviderError(
      "Paymob is temporarily unavailable",
      "provider_unavailable",
      { status },
    );
  }

  private requireRecord(value: unknown, label: string) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new PaymentProviderError(
        `${label} is invalid`,
        "invalid_response",
      );
    }

    return value as Record<string, unknown>;
  }

  private requireSignedScalar(value: unknown, label: string) {
    if (
      value === undefined ||
      (typeof value === "object" && value !== null) ||
      typeof value === "function" ||
      typeof value === "symbol"
    ) {
      throw new PaymentProviderError(
        `Paymob HMAC field ${label} is invalid`,
        "invalid_response",
      );
    }

    return value;
  }

  private identifierString(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    return this.nonEmptyString(value);
  }

  private integerValue(value: unknown) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
      const parsed = Number.parseInt(value.trim(), 10);
      return Number.isSafeInteger(parsed) ? parsed : undefined;
    }

    return undefined;
  }

  private booleanValue(value: unknown) {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return undefined;
  }

  private nonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
