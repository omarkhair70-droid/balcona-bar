import {
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
} from "@prisma/client";

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

export type PaymentProviderCapabilities = {
  hostedCheckout: boolean;
  embeddedCheckout: boolean;
  cards: boolean;
  mobileWallets: boolean;
  kioskOrReference: boolean;
  bankTransferOrIpn: boolean;
  tokenization: boolean;
  recurring: boolean;
  authorizeCapture: boolean;
  void: boolean;
  partialRefund: boolean;
  fullRefund: boolean;
  transactionInquiry: boolean;
  settlementData: boolean;
  terminal: boolean;
  softPos: boolean;
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
      | "environment_mismatch"
      | "transaction_not_found"
      | "unsupported_operation"
      | "provider_declined",
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
  /**
   * Provider-native numeric integration identifier when the provider exposes one.
   *
   * Paymob uses this field. Providers that do not expose a numeric integration
   * identifier must leave it undefined rather than fabricating a sentinel value.
   */
  integrationId?: number;
  /**
   * Provider-native integration / rail / account reference when it is useful for
   * verification but is not naturally represented as a numeric integration ID.
   */
  providerIntegrationReference?: string;
  status: OnlinePaymentIntentStatus;
  amountMinor: number;
  currency: string;
  actionable: boolean;
  hasParentTransaction?: boolean;
  parentProviderTransactionId?: string;
  operationType?: OnlinePaymentOperationType;
  refundedAmountMinor?: number;
  capturedAmountMinor?: number;
  isLive?: boolean;
  providerSettled?: boolean;
  providerReportedFeeMinor?: number;
  providerSettlementDate?: string;
  providerSettlementReference?: string;
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

export type ProviderPostPaymentOperationInput = {
  type: OnlinePaymentOperationType;
  parentProviderTransactionId: string;
  amountMinor: number;
  expectedCurrency: string;
};

export type ProviderPostPaymentOperationResult = {
  provider: OnlinePaymentProvider;
  type: OnlinePaymentOperationType;
  status: OnlinePaymentOperationStatus;
  parentProviderTransactionId: string;
  providerTransactionId: string;
  providerOrderId?: string;
  amountMinor: number;
  currency?: string;
  safeMetadata: Record<string, unknown>;
};
