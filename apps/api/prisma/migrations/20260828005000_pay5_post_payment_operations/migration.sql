CREATE TYPE "OnlinePaymentOperationType" AS ENUM ('refund', 'void', 'capture');
CREATE TYPE "OnlinePaymentOperationStatus" AS ENUM ('pending', 'succeeded', 'failed');

ALTER TYPE "OnlinePaymentEventType" ADD VALUE IF NOT EXISTS 'provider_operation_requested';
ALTER TYPE "OnlinePaymentEventType" ADD VALUE IF NOT EXISTS 'provider_operation_completed';
ALTER TYPE "OnlinePaymentEventType" ADD VALUE IF NOT EXISTS 'provider_operation_failed';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'online_payment_refunded';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'online_payment_voided';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'online_payment_captured';

CREATE TABLE "OnlinePaymentOperation" (
  "id" TEXT NOT NULL,
  "onlinePaymentIntentId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "type" "OnlinePaymentOperationType" NOT NULL,
  "status" "OnlinePaymentOperationStatus" NOT NULL DEFAULT 'pending',
  "idempotencyKey" TEXT NOT NULL,
  "parentProviderTransactionId" TEXT NOT NULL,
  "providerTransactionId" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "reason" TEXT,
  "requestedByStaffUserId" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OnlinePaymentOperation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlinePaymentOperation_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE UNIQUE INDEX "OnlinePaymentOperation_idempotencyKey_key"
  ON "OnlinePaymentOperation"("idempotencyKey");
CREATE UNIQUE INDEX "OnlinePaymentOperation_provider_providerTransactionId_key"
  ON "OnlinePaymentOperation"("provider", "providerTransactionId");
CREATE UNIQUE INDEX "OnlinePaymentOperation_one_pending_per_intent"
  ON "OnlinePaymentOperation"("onlinePaymentIntentId")
  WHERE "status" = 'pending';

CREATE INDEX "OnlinePaymentOperation_onlinePaymentIntentId_idx"
  ON "OnlinePaymentOperation"("onlinePaymentIntentId");
CREATE INDEX "OnlinePaymentOperation_companyId_idx"
  ON "OnlinePaymentOperation"("companyId");
CREATE INDEX "OnlinePaymentOperation_branchId_idx"
  ON "OnlinePaymentOperation"("branchId");
CREATE INDEX "OnlinePaymentOperation_billId_idx"
  ON "OnlinePaymentOperation"("billId");
CREATE INDEX "OnlinePaymentOperation_provider_idx"
  ON "OnlinePaymentOperation"("provider");
CREATE INDEX "OnlinePaymentOperation_type_idx"
  ON "OnlinePaymentOperation"("type");
CREATE INDEX "OnlinePaymentOperation_status_idx"
  ON "OnlinePaymentOperation"("status");
CREATE INDEX "OnlinePaymentOperation_requestedByStaffUserId_idx"
  ON "OnlinePaymentOperation"("requestedByStaffUserId");
CREATE INDEX "OnlinePaymentOperation_completedAt_idx"
  ON "OnlinePaymentOperation"("completedAt");
CREATE INDEX "OnlinePaymentOperation_createdAt_idx"
  ON "OnlinePaymentOperation"("createdAt");
CREATE INDEX "OnlinePaymentOperation_intent_type_status_idx"
  ON "OnlinePaymentOperation"("onlinePaymentIntentId", "type", "status");

ALTER TABLE "OnlinePaymentOperation"
  ADD CONSTRAINT "OnlinePaymentOperation_onlinePaymentIntentId_fkey"
  FOREIGN KEY ("onlinePaymentIntentId") REFERENCES "OnlinePaymentIntent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentOperation"
  ADD CONSTRAINT "OnlinePaymentOperation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentOperation"
  ADD CONSTRAINT "OnlinePaymentOperation_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentOperation"
  ADD CONSTRAINT "OnlinePaymentOperation_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentOperation"
  ADD CONSTRAINT "OnlinePaymentOperation_requestedByStaffUserId_fkey"
  FOREIGN KEY ("requestedByStaffUserId") REFERENCES "StaffUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
