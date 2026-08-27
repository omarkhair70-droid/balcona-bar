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
      | "amount_mismatch"
      | "currency_mismatch"
      | "environment_mismatch",
    readonly metadata: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
