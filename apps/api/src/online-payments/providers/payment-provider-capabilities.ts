import { OnlinePaymentProvider } from "@prisma/client";
import { PaymentProviderCapabilities } from "./payment-provider.types";

const NONE: PaymentProviderCapabilities = {
  hostedCheckout: false,
  embeddedCheckout: false,
  card: false,
  wallet: false,
  referenceCode: false,
  qr: false,
  deepLink: false,
  inquiry: false,
  refund: false,
  partialRefund: false,
  void: false,
  capture: false,
  settlementImport: false,
  providerReconciliation: false,
  directTerminal: false,
  recurringBilling: false,
};

export const PAYMENT_PROVIDER_CAPABILITIES: Record<
  OnlinePaymentProvider,
  PaymentProviderCapabilities
> = {
  [OnlinePaymentProvider.mock]: { ...NONE, hostedCheckout: true },
  [OnlinePaymentProvider.paymob]: {
    ...NONE,
    hostedCheckout: true,
    card: true,
    inquiry: true,
    refund: true,
    partialRefund: true,
    void: true,
    capture: true,
    settlementImport: true,
    providerReconciliation: true,
    recurringBilling: true,
  },
  [OnlinePaymentProvider.fawry]: {
    ...NONE,
    hostedCheckout: true,
    card: true,
    wallet: true,
    referenceCode: true,
    inquiry: true,
    refund: true,
    partialRefund: true,
    settlementImport: true,
    providerReconciliation: true,
  },
  [OnlinePaymentProvider.maestr]: { ...NONE },
  [OnlinePaymentProvider.external]: { ...NONE },
};

export function paymentProviderCapabilities(
  provider: OnlinePaymentProvider,
): PaymentProviderCapabilities {
  return PAYMENT_PROVIDER_CAPABILITIES[provider];
}
