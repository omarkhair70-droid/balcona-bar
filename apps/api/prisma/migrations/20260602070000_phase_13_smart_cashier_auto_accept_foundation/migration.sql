-- CreateEnum
CREATE TYPE "SmartCashierMode" AS ENUM ('manual_only', 'assisted', 'auto_accept_safe_orders');

-- CreateEnum
CREATE TYPE "SmartCashierRuleScope" AS ENUM ('branch', 'menu_item', 'category');

-- CreateEnum
CREATE TYPE "ManualReviewReasonCode" AS ENUM ('smart_cashier_disabled', 'branch_manual_only', 'assisted_mode_requires_review', 'cart_invalid', 'branch_closed', 'order_amount_too_high', 'item_requires_review', 'item_unavailable', 'modifier_unavailable', 'out_of_stock', 'payment_required', 'customer_note_present', 'unknown');

-- CreateEnum
CREATE TYPE "AutoAcceptDecision" AS ENUM ('auto_accepted', 'requires_manual_review');

-- AlterEnum
ALTER TYPE "RealtimeEventType" ADD VALUE 'smart_cashier_evaluated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'smart_cashier_auto_accepted';
ALTER TYPE "RealtimeEventType" ADD VALUE 'smart_cashier_manual_review_required';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "autoAcceptDecision" "AutoAcceptDecision",
ADD COLUMN "autoAcceptedAt" TIMESTAMP(3),
ADD COLUMN "manualReviewReasons" JSONB,
ADD COLUMN "smartCashierModeSnapshot" "SmartCashierMode",
ADD COLUMN "autoAcceptEvaluatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BranchSmartCashierSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "mode" "SmartCashierMode" NOT NULL DEFAULT 'manual_only',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "maxAutoAcceptSubtotalMinor" INTEGER,
    "requirePaymentBeforeAutoAccept" BOOLEAN NOT NULL DEFAULT false,
    "reviewCustomerNotes" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchSmartCashierSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartCashierReviewRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "scope" "SmartCashierRuleScope" NOT NULL,
    "menuItemId" TEXT,
    "categoryId" TEXT,
    "reasonCode" "ManualReviewReasonCode" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartCashierReviewRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_autoAcceptDecision_idx" ON "Order"("autoAcceptDecision");

-- CreateIndex
CREATE INDEX "Order_autoAcceptedAt_idx" ON "Order"("autoAcceptedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BranchSmartCashierSettings_branchId_key" ON "BranchSmartCashierSettings"("branchId");

-- CreateIndex
CREATE INDEX "BranchSmartCashierSettings_companyId_idx" ON "BranchSmartCashierSettings"("companyId");

-- CreateIndex
CREATE INDEX "BranchSmartCashierSettings_branchId_idx" ON "BranchSmartCashierSettings"("branchId");

-- CreateIndex
CREATE INDEX "BranchSmartCashierSettings_mode_idx" ON "BranchSmartCashierSettings"("mode");

-- CreateIndex
CREATE INDEX "BranchSmartCashierSettings_enabled_idx" ON "BranchSmartCashierSettings"("enabled");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_companyId_idx" ON "SmartCashierReviewRule"("companyId");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_branchId_idx" ON "SmartCashierReviewRule"("branchId");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_scope_idx" ON "SmartCashierReviewRule"("scope");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_menuItemId_idx" ON "SmartCashierReviewRule"("menuItemId");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_categoryId_idx" ON "SmartCashierReviewRule"("categoryId");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_reasonCode_idx" ON "SmartCashierReviewRule"("reasonCode");

-- CreateIndex
CREATE INDEX "SmartCashierReviewRule_enabled_idx" ON "SmartCashierReviewRule"("enabled");

-- AddForeignKey
ALTER TABLE "BranchSmartCashierSettings" ADD CONSTRAINT "BranchSmartCashierSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchSmartCashierSettings" ADD CONSTRAINT "BranchSmartCashierSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCashierReviewRule" ADD CONSTRAINT "SmartCashierReviewRule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCashierReviewRule" ADD CONSTRAINT "SmartCashierReviewRule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCashierReviewRule" ADD CONSTRAINT "SmartCashierReviewRule_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmartCashierReviewRule" ADD CONSTRAINT "SmartCashierReviewRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
