import { OnlinePaymentIntentStatus, OnlinePaymentProvider } from "@prisma/client";

export type PaymentBillingData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

export type CreateProviderPaymentInput = {
  localIntentId: string;
  companyId: string;
  branchId: string;
  billId: string;
  amountMinor: number;
  currency: string;
  billingData: PaymentBillingData;
  customerReturnUrl?: string;
};

export type CreateProviderPaymentResult = {
  provider: OnlinePaymentProvider;
  providerIntentId: string;
  providerOrderId?: string;
  status: OnlinePaymentIntentStatus;
  checkoutUrl: string;
  checkoutExpiresAt?: Date;
  metadata?: Record<string, unknown>;
};

export class PaymentProviderError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_config"
      | "authentication_failed"
      | "invalid_request"
      | "provider_unavailable"
      | "rate_limited"
      | "timeout"
      | "invalid_response"
      | "signature_invalid"
      | "amount_mismatch"
      | "currency_mismatch"
      | "environment_mismatch",
    readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}


export type ProviderTransactionState = {
  provider: OnlinePaymentProvider;
  providerEventId: string;
  providerTransactionId: string;
  providerOrderId: string;
  merchantReference?: string;
  integrationId: number;
  status: OnlinePaymentIntentStatus;
  amountMinor: number;
  currency: string;
  actionable: boolean;
  safeMetadata: Record<string, unknown>;
};

export type VerifiedProviderTransactionWebhook = ProviderTransactionState;

export type ProviderTransactionInquiryResult =
  | {
      found: false;
      provider: OnlinePaymentProvider;
      providerOrderId: string;
    }
  | {
      found: true;
      provider: OnlinePaymentProvider;
      providerOrderId: string;
      transaction: ProviderTransactionState;
    };
