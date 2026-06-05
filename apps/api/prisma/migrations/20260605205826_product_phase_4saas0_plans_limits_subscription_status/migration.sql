-- CreateEnum
CREATE TYPE "SaasPlanStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "CompanySubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'cancelled');

-- CreateEnum
CREATE TYPE "SaasFeatureKey" AS ENUM ('setup', 'kds', 'inventory', 'online_payments', 'owner_analytics', 'ai_waiter', 'multi_branch', 'advanced_reports');

-- CreateTable
CREATE TABLE "SaasPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "SaasPlanStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "monthlyPriceMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "maxBranches" INTEGER,
    "maxTables" INTEGER,
    "maxStaffUsers" INTEGER,
    "maxMenuItems" INTEGER,
    "maxInventoryItems" INTEGER,
    "maxAiMessagesPerMonth" INTEGER,
    "setupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kdsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inventoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "onlinePaymentsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiWaiterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "multiBranchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "advancedReportsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaasPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "CompanySubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyPlanLimitOverride" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueInt" INTEGER,
    "valueBoolean" BOOLEAN,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyPlanLimitOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaasPlan_code_key" ON "SaasPlan"("code");

-- CreateIndex
CREATE INDEX "SaasPlan_status_idx" ON "SaasPlan"("status");

-- CreateIndex
CREATE INDEX "SaasPlan_sortOrder_idx" ON "SaasPlan"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CompanySubscription_companyId_key" ON "CompanySubscription"("companyId");

-- CreateIndex
CREATE INDEX "CompanySubscription_planId_idx" ON "CompanySubscription"("planId");

-- CreateIndex
CREATE INDEX "CompanySubscription_status_idx" ON "CompanySubscription"("status");

-- CreateIndex
CREATE INDEX "CompanyPlanLimitOverride_companyId_idx" ON "CompanyPlanLimitOverride"("companyId");

-- CreateIndex
CREATE INDEX "CompanyPlanLimitOverride_key_idx" ON "CompanyPlanLimitOverride"("key");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyPlanLimitOverride_companyId_key_key" ON "CompanyPlanLimitOverride"("companyId", "key");

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SaasPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyPlanLimitOverride" ADD CONSTRAINT "CompanyPlanLimitOverride_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
