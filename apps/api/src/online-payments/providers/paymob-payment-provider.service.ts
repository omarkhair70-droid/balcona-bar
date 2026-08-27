import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
} from "@prisma/client";
import {
  CreateProviderPaymentInput,
  CreateProviderPaymentResult,
  PaymentProviderError,
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

@Injectable()
export class PaymobPaymentProviderService {
  readonly provider = OnlinePaymentProvider.paymob;

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

    const providerIntentId = this.nonEmptyString(payload.id);
    const clientSecret = this.nonEmptyString(payload.client_secret);
    const responseAmount = payload.intention_detail?.amount;
    const responseCurrency = this.nonEmptyString(
      payload.intention_detail?.currency,
    );

    if (!providerIntentId || !clientSecret) {
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

  private readConfig() {
    const baseUrl = (
      this.configService.get<string>("onlinePayments.paymob.baseUrl") ??
      DEFAULT_PAYMOB_BASE_URL
    ).replace(/\/+$/, "");
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

    return {
      baseUrl,
      secretKey,
      publicKey,
      notificationUrl,
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

    if (
      config.allowedReturnOrigins.length > 0 &&
      !config.allowedReturnOrigins.includes(url.origin)
    ) {
      throw new PaymentProviderError(
        "Customer return URL origin is not allowed",
        "invalid_request",
      );
    }

    return url.toString();
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

  private nonEmptyString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
      ? value.trim()
      : undefined;
  }
}
