-- CreateEnum
CREATE TYPE "CashierShiftStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "CashDrawerTransactionType" AS ENUM ('opening_float', 'cash_payment', 'cash_in', 'cash_out', 'correction');

-- CreateEnum
CREATE TYPE "CashDrawerTransactionSourceType" AS ENUM ('manual_payment', 'adjustment', 'opening_float');

-- CreateEnum
CREATE TYPE "CashierShiftReportType" AS ENUM ('x_report', 'z_report');

-- AlterTable
ALTER TABLE "ManualPayment" ADD COLUMN "cashierShiftId" TEXT;

-- CreateTable
CREATE TABLE "CashierShift" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedByStaffUserId" TEXT NOT NULL,
    "closedByStaffUserId" TEXT,
    "status" "CashierShiftStatus" NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "openingFloatMinor" INTEGER NOT NULL,
    "expectedCashMinor" INTEGER NOT NULL DEFAULT 0,
    "countedCashMinor" INTEGER,
    "cashOverShortMinor" INTEGER,
    "cashSalesMinor" INTEGER NOT NULL DEFAULT 0,
    "cardSalesMinor" INTEGER NOT NULL DEFAULT 0,
    "walletSalesMinor" INTEGER NOT NULL DEFAULT 0,
    "otherSalesMinor" INTEGER NOT NULL DEFAULT 0,
    "paymentCount" INTEGER NOT NULL DEFAULT 0,
    "billCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingNote" TEXT,
    "closingNote" TEXT,
    "zReportNumber" TEXT,
    "zReportSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashierShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashDrawerTransaction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierShiftId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "type" "CashDrawerTransactionType" NOT NULL,
    "signedAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceType" "CashDrawerTransactionSourceType",
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashDrawerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashierShiftReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashierShiftId" TEXT NOT NULL,
    "generatedByStaffUserId" TEXT,
    "type" "CashierShiftReportType" NOT NULL,
    "reportNumber" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashierShiftReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashierShift_branchId_zReportNumber_key" ON "CashierShift"("branchId", "zReportNumber");

-- CreateIndex
CREATE INDEX "CashierShift_companyId_idx" ON "CashierShift"("companyId");

-- CreateIndex
CREATE INDEX "CashierShift_branchId_idx" ON "CashierShift"("branchId");

-- CreateIndex
CREATE INDEX "CashierShift_status_idx" ON "CashierShift"("status");

-- CreateIndex
CREATE INDEX "CashierShift_openedAt_idx" ON "CashierShift"("openedAt");

-- CreateIndex
CREATE INDEX "CashierShift_closedAt_idx" ON "CashierShift"("closedAt");

-- CreateIndex
CREATE INDEX "CashierShift_branchId_status_openedAt_idx" ON "CashierShift"("branchId", "status", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashierShift_one_open_per_branch" ON "CashierShift"("branchId") WHERE "status" = 'open';

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_companyId_idx" ON "CashDrawerTransaction"("companyId");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_branchId_idx" ON "CashDrawerTransaction"("branchId");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_cashierShiftId_idx" ON "CashDrawerTransaction"("cashierShiftId");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_staffUserId_idx" ON "CashDrawerTransaction"("staffUserId");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_type_idx" ON "CashDrawerTransaction"("type");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_sourceType_sourceId_idx" ON "CashDrawerTransaction"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "CashDrawerTransaction_createdAt_idx" ON "CashDrawerTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashierShiftReport_branchId_type_reportNumber_key" ON "CashierShiftReport"("branchId", "type", "reportNumber");

-- CreateIndex
CREATE INDEX "CashierShiftReport_companyId_idx" ON "CashierShiftReport"("companyId");

-- CreateIndex
CREATE INDEX "CashierShiftReport_branchId_idx" ON "CashierShiftReport"("branchId");

-- CreateIndex
CREATE INDEX "CashierShiftReport_cashierShiftId_idx" ON "CashierShiftReport"("cashierShiftId");

-- CreateIndex
CREATE INDEX "CashierShiftReport_generatedByStaffUserId_idx" ON "CashierShiftReport"("generatedByStaffUserId");

-- CreateIndex
CREATE INDEX "CashierShiftReport_type_idx" ON "CashierShiftReport"("type");

-- CreateIndex
CREATE INDEX "CashierShiftReport_generatedAt_idx" ON "CashierShiftReport"("generatedAt");

-- CreateIndex
CREATE INDEX "ManualPayment_cashierShiftId_idx" ON "ManualPayment"("cashierShiftId");

-- AddForeignKey
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_openedByStaffUserId_fkey" FOREIGN KEY ("openedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShift" ADD CONSTRAINT "CashierShift_closedByStaffUserId_fkey" FOREIGN KEY ("closedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerTransaction" ADD CONSTRAINT "CashDrawerTransaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerTransaction" ADD CONSTRAINT "CashDrawerTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerTransaction" ADD CONSTRAINT "CashDrawerTransaction_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashDrawerTransaction" ADD CONSTRAINT "CashDrawerTransaction_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftReport" ADD CONSTRAINT "CashierShiftReport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftReport" ADD CONSTRAINT "CashierShiftReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftReport" ADD CONSTRAINT "CashierShiftReport_cashierShiftId_fkey" FOREIGN KEY ("cashierShiftId") REFERENCES "CashierShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashierShiftReport" ADD CONSTRAINT "CashierShiftReport_generatedByStaffUserId_fkey" FOREIGN KEY ("generatedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
