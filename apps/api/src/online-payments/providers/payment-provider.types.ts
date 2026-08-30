import {
  MerchantPaymentIntegrationEnvironment,
  OnlinePaymentIntentStatus,
  OnlinePaymentOperationStatus,
  OnlinePaymentOperationType,
  OnlinePaymentProvider,
} from "@prisma/client";

export type ProviderRuntimeContext = {
  integrationId: string;
  environment: MerchantPaymentIntegrationEnvironment;
  merchantAccountReference: string | null;
  enabledChannels: string[];
  configurationMetadata: Record<string, unknown>;
  secretReferences: Record<string, string>;
};

export type PaymentBillingData = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
};

export type PaymentProviderCapabilities = {
  hostedCheckout: boolean;
  embeddedCheckout: boolean;
  card: boolean;
  wallet: boolean;
  referenceCode: boolean;
  qr: boolean;
  deepLink: boolean;
  inquiry: boolean;
  refund: boolean;
  partialRefund: boolean;
  void: boolean;
  capture: boolean;
  settlementImport: boolean;
  providerReconciliation: boolean;
  directTerminal: boolean;
  recurringBilling: boolean;
  bankTransferOrIpn: boolean;
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
  runtimeContext?: ProviderRuntimeContext;
};

export type ProviderCustomerAction =
  | {
      type: "redirect";
      url: string;
    }
  | {
      type: "deep_link";
      url: string;
    }
  | {
      type: "qr";
      value: string;
    }
  | {
      type: "display_reference";
      reference: string;
    };

export type CreateProviderPaymentResult = {
  provider: OnlinePaymentProvider;
  providerIntentId: string;
  providerOrderId?: string;
  status: OnlinePaymentIntentStatus;
  checkoutUrl?: string;
  customerAction?: ProviderCustomerAction;
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
  integrationId?: number;
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
