-- CreateEnum
CREATE TYPE "OnlinePaymentProvider" AS ENUM ('mock', 'external');

-- CreateEnum
CREATE TYPE "OnlinePaymentIntentStatus" AS ENUM ('pending', 'requires_action', 'succeeded', 'failed', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "OnlinePaymentEventType" AS ENUM ('intent_created', 'provider_webhook_received', 'status_updated', 'settlement_completed', 'settlement_skipped');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RealtimeEventType" ADD VALUE 'online_payment_intent_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'online_payment_succeeded';
ALTER TYPE "RealtimeEventType" ADD VALUE 'online_payment_failed';

-- CreateTable
CREATE TABLE "OnlinePaymentIntent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "provider" "OnlinePaymentProvider" NOT NULL DEFAULT 'mock',
    "providerIntentId" TEXT,
    "providerCheckoutUrl" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "OnlinePaymentIntentStatus" NOT NULL DEFAULT 'pending',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "customerReturnUrl" TEXT,
    "checkoutExpiresAt" TIMESTAMP(3),
    "succeededAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnlinePaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePaymentEvent" (
    "id" TEXT NOT NULL,
    "onlinePaymentIntentId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "provider" "OnlinePaymentProvider" NOT NULL,
    "providerEventId" TEXT,
    "type" "OnlinePaymentEventType" NOT NULL,
    "status" "OnlinePaymentIntentStatus",
    "amountMinor" INTEGER,
    "currency" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlinePaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentIntent_providerIntentId_key" ON "OnlinePaymentIntent"("providerIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentIntent_idempotencyKey_key" ON "OnlinePaymentIntent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_companyId_idx" ON "OnlinePaymentIntent"("companyId");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_branchId_idx" ON "OnlinePaymentIntent"("branchId");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_tableSessionId_idx" ON "OnlinePaymentIntent"("tableSessionId");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_billId_idx" ON "OnlinePaymentIntent"("billId");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_provider_idx" ON "OnlinePaymentIntent"("provider");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_status_idx" ON "OnlinePaymentIntent"("status");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_createdAt_idx" ON "OnlinePaymentIntent"("createdAt");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_updatedAt_idx" ON "OnlinePaymentIntent"("updatedAt");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_branchId_status_createdAt_idx" ON "OnlinePaymentIntent"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OnlinePaymentIntent_billId_status_idx" ON "OnlinePaymentIntent"("billId", "status");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_onlinePaymentIntentId_idx" ON "OnlinePaymentEvent"("onlinePaymentIntentId");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_companyId_idx" ON "OnlinePaymentEvent"("companyId");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_branchId_idx" ON "OnlinePaymentEvent"("branchId");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_billId_idx" ON "OnlinePaymentEvent"("billId");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_provider_idx" ON "OnlinePaymentEvent"("provider");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_type_idx" ON "OnlinePaymentEvent"("type");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_status_idx" ON "OnlinePaymentEvent"("status");

-- CreateIndex
CREATE INDEX "OnlinePaymentEvent_createdAt_idx" ON "OnlinePaymentEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePaymentEvent_provider_providerEventId_key" ON "OnlinePaymentEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "OnlinePaymentIntent" ADD CONSTRAINT "OnlinePaymentIntent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentIntent" ADD CONSTRAINT "OnlinePaymentIntent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentIntent" ADD CONSTRAINT "OnlinePaymentIntent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentIntent" ADD CONSTRAINT "OnlinePaymentIntent_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentEvent" ADD CONSTRAINT "OnlinePaymentEvent_onlinePaymentIntentId_fkey" FOREIGN KEY ("onlinePaymentIntentId") REFERENCES "OnlinePaymentIntent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentEvent" ADD CONSTRAINT "OnlinePaymentEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentEvent" ADD CONSTRAINT "OnlinePaymentEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnlinePaymentEvent" ADD CONSTRAINT "OnlinePaymentEvent_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
