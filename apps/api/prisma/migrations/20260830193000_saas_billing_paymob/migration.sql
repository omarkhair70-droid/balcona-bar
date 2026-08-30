CREATE TYPE "SaasBillingProvider" AS ENUM ('paymob');
CREATE TYPE "SaasBillingEnvironment" AS ENUM ('test', 'live');
CREATE TYPE "SaasBillingPaymentAttemptStatus" AS ENUM ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'unknown');
CREATE TYPE "SaasBillingInvoiceStatus" AS ENUM ('open', 'paid', 'void', 'uncollectible');

ALTER TABLE "CompanySubscription"
  ADD COLUMN "billingProvider" "SaasBillingProvider",
  ADD COLUMN "billingEnvironment" "SaasBillingEnvironment",
  ADD COLUMN "providerCustomerReference" TEXT,
  ADD COLUMN "providerSubscriptionReference" TEXT,
  ADD COLUMN "providerPlanReference" TEXT,
  ADD COLUMN "graceEndsAt" TIMESTAMP(3),
  ADD COLUMN "lastBillingSyncAt" TIMESTAMP(3),
  ADD COLUMN "billingMetadata" JSONB;

CREATE TABLE "SaasBillingPaymentAttempt" (
  "id" TEXT NOT NULL,
  "companySubscriptionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "provider" "SaasBillingProvider" NOT NULL,
  "environment" "SaasBillingEnvironment" NOT NULL,
  "status" "SaasBillingPaymentAttemptStatus" NOT NULL DEFAULT 'pending',
  "providerIntentionReference" TEXT,
  "providerOrderReference" TEXT,
  "providerTransactionReference" TEXT,
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "checkoutUrl" TEXT,
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "succeededAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaasBillingPaymentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasBillingInvoice" (
  "id" TEXT NOT NULL,
  "companySubscriptionId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "paymentAttemptId" TEXT,
  "provider" "SaasBillingProvider" NOT NULL,
  "environment" "SaasBillingEnvironment" NOT NULL,
  "providerInvoiceReference" TEXT,
  "status" "SaasBillingInvoiceStatus" NOT NULL DEFAULT 'open',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EGP',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SaasBillingInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaasBillingEvent" (
  "id" TEXT NOT NULL,
  "companySubscriptionId" TEXT,
  "companyId" TEXT,
  "paymentAttemptId" TEXT,
  "provider" "SaasBillingProvider" NOT NULL,
  "providerEventKey" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "payloadHash" TEXT NOT NULL,
  "safeMetadata" JSONB,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaasBillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanySubscription_billingProvider_providerSubscriptionReference_key"
  ON "CompanySubscription"("billingProvider", "providerSubscriptionReference");
CREATE INDEX "CompanySubscription_billingProvider_billingEnvironment_idx"
  ON "CompanySubscription"("billingProvider", "billingEnvironment");

CREATE UNIQUE INDEX "SaasBillingPaymentAttempt_provider_providerIntentionReference_key"
  ON "SaasBillingPaymentAttempt"("provider", "providerIntentionReference");
CREATE UNIQUE INDEX "SaasBillingPaymentAttempt_provider_providerTransactionReference_key"
  ON "SaasBillingPaymentAttempt"("provider", "providerTransactionReference");
CREATE INDEX "SaasBillingPaymentAttempt_companySubscriptionId_createdAt_idx"
  ON "SaasBillingPaymentAttempt"("companySubscriptionId", "createdAt");
CREATE INDEX "SaasBillingPaymentAttempt_companyId_createdAt_idx"
  ON "SaasBillingPaymentAttempt"("companyId", "createdAt");
CREATE INDEX "SaasBillingPaymentAttempt_status_createdAt_idx"
  ON "SaasBillingPaymentAttempt"("status", "createdAt");

CREATE UNIQUE INDEX "SaasBillingInvoice_provider_providerInvoiceReference_key"
  ON "SaasBillingInvoice"("provider", "providerInvoiceReference");
CREATE INDEX "SaasBillingInvoice_companySubscriptionId_createdAt_idx"
  ON "SaasBillingInvoice"("companySubscriptionId", "createdAt");
CREATE INDEX "SaasBillingInvoice_companyId_createdAt_idx"
  ON "SaasBillingInvoice"("companyId", "createdAt");
CREATE INDEX "SaasBillingInvoice_status_dueAt_idx"
  ON "SaasBillingInvoice"("status", "dueAt");

CREATE UNIQUE INDEX "SaasBillingEvent_providerEventKey_key"
  ON "SaasBillingEvent"("providerEventKey");
CREATE INDEX "SaasBillingEvent_companySubscriptionId_createdAt_idx"
  ON "SaasBillingEvent"("companySubscriptionId", "createdAt");
CREATE INDEX "SaasBillingEvent_companyId_createdAt_idx"
  ON "SaasBillingEvent"("companyId", "createdAt");
CREATE INDEX "SaasBillingEvent_provider_createdAt_idx"
  ON "SaasBillingEvent"("provider", "createdAt");

ALTER TABLE "SaasBillingPaymentAttempt"
  ADD CONSTRAINT "SaasBillingPaymentAttempt_companySubscriptionId_fkey"
  FOREIGN KEY ("companySubscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaasBillingPaymentAttempt"
  ADD CONSTRAINT "SaasBillingPaymentAttempt_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaasBillingInvoice"
  ADD CONSTRAINT "SaasBillingInvoice_companySubscriptionId_fkey"
  FOREIGN KEY ("companySubscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaasBillingInvoice"
  ADD CONSTRAINT "SaasBillingInvoice_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaasBillingInvoice"
  ADD CONSTRAINT "SaasBillingInvoice_paymentAttemptId_fkey"
  FOREIGN KEY ("paymentAttemptId") REFERENCES "SaasBillingPaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaasBillingEvent"
  ADD CONSTRAINT "SaasBillingEvent_companySubscriptionId_fkey"
  FOREIGN KEY ("companySubscriptionId") REFERENCES "CompanySubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaasBillingEvent"
  ADD CONSTRAINT "SaasBillingEvent_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SaasBillingEvent"
  ADD CONSTRAINT "SaasBillingEvent_paymentAttemptId_fkey"
  FOREIGN KEY ("paymentAttemptId") REFERENCES "SaasBillingPaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
