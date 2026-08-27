-- PAY-2: persist a provider order reference that is signed by provider callbacks.
-- Paymob transaction HMAC signs order.id; this lets Balcona bind a verified
-- callback without trusting merchant_order_id, which is not part of that HMAC.
ALTER TABLE "OnlinePaymentIntent"
ADD COLUMN "providerOrderId" TEXT;

CREATE UNIQUE INDEX "OnlinePaymentIntent_provider_providerOrderId_key"
ON "OnlinePaymentIntent"("provider", "providerOrderId");
