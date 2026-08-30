CREATE TYPE "PaymentTerminalProvider" AS ENUM ('paymob', 'fawry', 'geidea', 'external');
CREATE TYPE "PaymentTerminalEnvironment" AS ENUM ('test', 'live');
CREATE TYPE "PaymentTerminalStatus" AS ENUM ('draft', 'blocked', 'ready', 'disabled');
CREATE TYPE "TerminalPaymentRequestStatus" AS ENUM ('created', 'sent', 'pending', 'approved', 'declined', 'cancelled', 'timeout', 'unknown', 'blocked');

CREATE TABLE "PaymentTerminal" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "provider" "PaymentTerminalProvider" NOT NULL,
  "environment" "PaymentTerminalEnvironment" NOT NULL,
  "status" "PaymentTerminalStatus" NOT NULL DEFAULT 'draft',
  "displayName" TEXT NOT NULL,
  "providerTerminalReference" TEXT,
  "deviceReference" TEXT,
  "merchantReference" TEXT,
  "secretReference" TEXT,
  "capabilities" JSONB,
  "readinessMessage" TEXT,
  "lastSeenAt" TIMESTAMP(3),
  "liveVerifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentTerminal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TerminalPaymentRequest" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "billId" TEXT NOT NULL,
  "paymentTerminalId" TEXT NOT NULL,
  "requestedByStaffUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "TerminalPaymentRequestStatus" NOT NULL DEFAULT 'created',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "providerRequestReference" TEXT,
  "providerTransactionReference" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "timedOutAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TerminalPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentTerminal_branchId_provider_providerTerminalReference_key"
  ON "PaymentTerminal"("branchId", "provider", "providerTerminalReference");
CREATE INDEX "PaymentTerminal_companyId_idx" ON "PaymentTerminal"("companyId");
CREATE INDEX "PaymentTerminal_branchId_idx" ON "PaymentTerminal"("branchId");
CREATE INDEX "PaymentTerminal_provider_environment_idx" ON "PaymentTerminal"("provider", "environment");
CREATE INDEX "PaymentTerminal_status_idx" ON "PaymentTerminal"("status");

CREATE UNIQUE INDEX "TerminalPaymentRequest_idempotencyKey_key"
  ON "TerminalPaymentRequest"("idempotencyKey");
CREATE UNIQUE INDEX "TerminalPaymentRequest_providerTransactionReference_key"
  ON "TerminalPaymentRequest"("providerTransactionReference");
CREATE INDEX "TerminalPaymentRequest_companyId_idx" ON "TerminalPaymentRequest"("companyId");
CREATE INDEX "TerminalPaymentRequest_branchId_idx" ON "TerminalPaymentRequest"("branchId");
CREATE INDEX "TerminalPaymentRequest_billId_idx" ON "TerminalPaymentRequest"("billId");
CREATE INDEX "TerminalPaymentRequest_paymentTerminalId_idx" ON "TerminalPaymentRequest"("paymentTerminalId");
CREATE INDEX "TerminalPaymentRequest_requestedByStaffUserId_idx" ON "TerminalPaymentRequest"("requestedByStaffUserId");
CREATE INDEX "TerminalPaymentRequest_status_createdAt_idx" ON "TerminalPaymentRequest"("status", "createdAt");

ALTER TABLE "PaymentTerminal"
  ADD CONSTRAINT "PaymentTerminal_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentTerminal"
  ADD CONSTRAINT "PaymentTerminal_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TerminalPaymentRequest"
  ADD CONSTRAINT "TerminalPaymentRequest_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalPaymentRequest"
  ADD CONSTRAINT "TerminalPaymentRequest_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalPaymentRequest"
  ADD CONSTRAINT "TerminalPaymentRequest_billId_fkey"
  FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TerminalPaymentRequest"
  ADD CONSTRAINT "TerminalPaymentRequest_paymentTerminalId_fkey"
  FOREIGN KEY ("paymentTerminalId") REFERENCES "PaymentTerminal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TerminalPaymentRequest"
  ADD CONSTRAINT "TerminalPaymentRequest_requestedByStaffUserId_fkey"
  FOREIGN KEY ("requestedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
