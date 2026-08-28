import { OnlinePaymentProvider } from "@prisma/client";
import {
  PAYMENT_PROVIDER_CAPABILITIES,
  paymentProviderCapabilities,
} from "./payment-provider-capabilities";

describe("payment provider capabilities", () => {
  it("defines an explicit capability set for every provider enum member", () => {
    for (const provider of Object.values(OnlinePaymentProvider)) {
      expect(PAYMENT_PROVIDER_CAPABILITIES[provider]).toBeDefined();
    }
  });

  it("does not infer commercial IPN capability from unrelated providers", () => {
    expect(
      paymentProviderCapabilities(OnlinePaymentProvider.paymob)
        .bankTransferOrIpn,
    ).toBe(false);
    expect(
      paymentProviderCapabilities(OnlinePaymentProvider.fawry)
        .bankTransferOrIpn,
    ).toBe(false);
    expect(
      paymentProviderCapabilities(OnlinePaymentProvider.external)
        .bankTransferOrIpn,
    ).toBe(false);
  });

  it("keeps Maestr fail-closed except for the verified commercial IPN rail", () => {
    const capabilities = paymentProviderCapabilities(
      OnlinePaymentProvider.maestr,
    );

    expect(capabilities.bankTransferOrIpn).toBe(true);
    expect(capabilities.hostedCheckout).toBe(false);
    expect(capabilities.transactionInquiry).toBe(false);
    expect(capabilities.settlementData).toBe(false);
    expect(capabilities.fullRefund).toBe(false);
    expect(capabilities.partialRefund).toBe(false);
  });

  it("keeps unsupported Fawry operations conservative", () => {
    const capabilities = paymentProviderCapabilities(
      OnlinePaymentProvider.fawry,
    );

    expect(capabilities.authorizeCapture).toBe(false);
    expect(capabilities.void).toBe(false);
    expect(capabilities.transactionInquiry).toBe(true);
    expect(capabilities.fullRefund).toBe(true);
    expect(capabilities.partialRefund).toBe(true);
  });
});
