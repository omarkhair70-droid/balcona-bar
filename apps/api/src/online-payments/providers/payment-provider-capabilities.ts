import { OnlinePaymentProvider } from "@prisma/client";
import { PaymentProviderCapabilities } from "./payment-provider.types";

const NONE: PaymentProviderCapabilities = {
  hostedCheckout: false,
  embeddedCheckout: false,
  cards: false,
  mobileWallets: false,
  kioskOrReference: false,
  bankTransferOrIpn: false,
  tokenization: false,
  recurring: false,
  authorizeCapture: false,
  void: false,
  partialRefund: false,
  fullRefund: false,
  transactionInquiry: false,
  settlementData: false,
  terminal: false,
  softPos: false,
};

export const PAYMENT_PROVIDER_CAPABILITIES: Record<
  OnlinePaymentProvider,
  PaymentProviderCapabilities
> = {
  [OnlinePaymentProvider.mock]: {
    ...NONE,
    hostedCheckout: true,
  },
  [OnlinePaymentProvider.paymob]: {
    ...NONE,
    hostedCheckout: true,
    cards: true,
    authorizeCapture: true,
    void: true,
    partialRefund: true,
    fullRefund: true,
    transactionInquiry: true,
    settlementData: true,
  },
  [OnlinePaymentProvider.fawry]: {
    ...NONE,
    hostedCheckout: true,
    cards: true,
    mobileWallets: true,
    kioskOrReference: true,
    partialRefund: true,
    fullRefund: true,
    transactionInquiry: true,
    settlementData: true,
  },
  [OnlinePaymentProvider.external]: {
    ...NONE,
  },
};

export function paymentProviderCapabilities(
  provider: OnlinePaymentProvider,
): PaymentProviderCapabilities {
  return PAYMENT_PROVIDER_CAPABILITIES[provider];
}
