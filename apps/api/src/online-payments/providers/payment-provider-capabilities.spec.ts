import { OnlinePaymentProvider } from "@prisma/client";
import { paymentProviderCapabilities } from "./payment-provider-capabilities";

describe("paymentProviderCapabilities", () => {
  it("keeps unverified direct-terminal execution disabled", () => {
    for (const provider of Object.values(OnlinePaymentProvider)) {
      expect(paymentProviderCapabilities(provider).directTerminal).toBe(false);
    }
  });

  it("exposes only verified Fawry hosted channels", () => {
    const capabilities = paymentProviderCapabilities(
      OnlinePaymentProvider.fawry,
    );

    expect(capabilities).toEqual(
      expect.objectContaining({
        hostedCheckout: true,
        card: true,
        wallet: true,
        referenceCode: true,
        inquiry: true,
      }),
    );
  });

  it("does not claim Maestr payment execution without the merchant contract", () => {
    expect(paymentProviderCapabilities(OnlinePaymentProvider.maestr)).toEqual(
      expect.objectContaining({
        hostedCheckout: false,
        refund: false,
        settlementImport: false,
        recurringBilling: false,
        bankTransferOrIpn: true,
      }),
    );
  });
});
