-- Add cart-item idempotency for safe customer add-to-cart retries.
ALTER TABLE "CartItem" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "CartItem_cartId_idempotencyKey_key" ON "CartItem"("cartId", "idempotencyKey");
