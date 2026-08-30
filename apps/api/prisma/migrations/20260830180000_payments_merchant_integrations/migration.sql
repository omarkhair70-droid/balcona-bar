ALTER TYPE "OnlinePaymentProvider" ADD VALUE IF NOT EXISTS 'maestr';

CREATE TYPE "MerchantPaymentIntegrationEnvironment" AS ENUM ('sandbox', 'test', 'live');
CREATE TYPE "MerchantPaymentIntegrationStatus" AS ENUM ('draft', 'needs_setup', 'ready', 'blocked', 'disabled');

CREATE TABLE "MerchantPaymentIntegration" (
  "id" TEXT NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "environment" "MerchantPaymentIntegrationEnvironment" NOT NULL DEFAULT 'sandbox',
  "status" "MerchantPaymentIntegrationStatus" NOT NULL DEFAULT 'needs_setup',
  "priority" INTEGER NOT NULL DEFAULT 100,
  "merchantAccountReference" TEXT,
  "enabledChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "configurationMetadata" JSONB,
  "secretReferences" JSONB,
  "readinessMessage" TEXT,
  "webhookConfigured" BOOLEAN NOT NULL DEFAULT false,
  "webhookVerifiedAt" TIMESTAMP(3),
  "recoveryReady" BOOLEAN NOT NULL DEFAULT false,
  "settlementConfigured" BOOLEAN NOT NULL DEFAULT false,
  "liveVerifiedAt" TIMESTAMP(3),
  "lastValidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MerchantPaymentIntegration_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OnlinePaymentIntent"
  ADD COLUMN "merchantPaymentIntegrationId" TEXT;

CREATE UNIQUE INDEX "MerchantPaymentIntegration_scopeKey_key"
  ON "MerchantPaymentIntegration"("scopeKey");
CREATE INDEX "MerchantPaymentIntegration_companyId_status_priority_idx"
  ON "MerchantPaymentIntegration"("companyId", "status", "priority");
CREATE INDEX "MerchantPaymentIntegration_branchId_status_priority_idx"
  ON "MerchantPaymentIntegration"("branchId", "status", "priority");
CREATE INDEX "MerchantPaymentIntegration_provider_environment_status_idx"
  ON "MerchantPaymentIntegration"("provider", "environment", "status");
CREATE INDEX "OnlinePaymentIntent_merchantPaymentIntegrationId_idx"
  ON "OnlinePaymentIntent"("merchantPaymentIntegrationId");

ALTER TABLE "MerchantPaymentIntegration"
  ADD CONSTRAINT "MerchantPaymentIntegration_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MerchantPaymentIntegration"
  ADD CONSTRAINT "MerchantPaymentIntegration_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentIntent"
  ADD CONSTRAINT "OnlinePaymentIntent_merchantPaymentIntegrationId_fkey"
  FOREIGN KEY ("merchantPaymentIntegrationId") REFERENCES "MerchantPaymentIntegration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
