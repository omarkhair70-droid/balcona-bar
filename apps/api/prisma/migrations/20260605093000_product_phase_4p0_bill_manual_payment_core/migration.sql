CREATE TYPE "BillStatus" AS ENUM ('draft', 'requested', 'presented', 'payment_pending', 'paid', 'cancelled', 'closed');

CREATE TYPE "BillEventType" AS ENUM ('created', 'linked_to_request', 'presented', 'payment_recorded', 'paid', 'cancelled', 'closed', 'receipt_generated');

CREATE TYPE "BillPaymentMethod" AS ENUM ('cash', 'card_pos', 'wallet_manual', 'other');

CREATE TYPE "ManualPaymentStatus" AS ENUM ('recorded', 'voided');

CREATE TYPE "BillLineType" AS ENUM ('item', 'service', 'tax', 'discount', 'manual');

ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_payment_recorded';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_paid';
ALTER TYPE "RealtimeEventType" ADD VALUE 'receipt_generated';

CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "billRequestId" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'draft',
    "billNumber" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "subtotalMinor" INTEGER NOT NULL,
    "serviceChargeMinor" INTEGER NOT NULL DEFAULT 0,
    "taxMinor" INTEGER NOT NULL DEFAULT 0,
    "discountMinor" INTEGER NOT NULL DEFAULT 0,
    "totalMinor" INTEGER NOT NULL,
    "paidMinor" INTEGER NOT NULL DEFAULT 0,
    "balanceDueMinor" INTEGER NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdByActorType" TEXT NOT NULL DEFAULT 'system',
    "presentedByStaffUserId" TEXT,
    "paidByStaffUserId" TEXT,
    "closedByStaffUserId" TEXT,
    "cancelledByStaffUserId" TEXT,
    "cancellationReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "menuItemId" TEXT,
    "lineType" "BillLineType" NOT NULL DEFAULT 'item',
    "itemNameSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "modifiersTotalMinor" INTEGER NOT NULL,
    "lineTotalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "modifiersSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManualPayment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "method" "BillPaymentMethod" NOT NULL,
    "status" "ManualPaymentStatus" NOT NULL DEFAULT 'recorded',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "recordedByStaffUserId" TEXT NOT NULL,
    "voidedByStaffUserId" TEXT,
    "voidReason" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillReceipt" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "printableText" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillReceipt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BillEvent" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "type" "BillEventType" NOT NULL,
    "actorStaffUserId" TEXT,
    "actorType" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Bill_billRequestId_key" ON "Bill"("billRequestId");
CREATE UNIQUE INDEX "Bill_branchId_billNumber_key" ON "Bill"("branchId", "billNumber");
CREATE INDEX "Bill_companyId_idx" ON "Bill"("companyId");
CREATE INDEX "Bill_branchId_idx" ON "Bill"("branchId");
CREATE INDEX "Bill_tableSessionId_idx" ON "Bill"("tableSessionId");
CREATE INDEX "Bill_status_idx" ON "Bill"("status");
CREATE INDEX "Bill_paidAt_idx" ON "Bill"("paidAt");
CREATE INDEX "Bill_createdAt_idx" ON "Bill"("createdAt");
CREATE INDEX "Bill_branchId_status_createdAt_idx" ON "Bill"("branchId", "status", "createdAt");
CREATE INDEX "Bill_tableSessionId_status_idx" ON "Bill"("tableSessionId", "status");

CREATE INDEX "BillLine_billId_idx" ON "BillLine"("billId");
CREATE INDEX "BillLine_orderId_idx" ON "BillLine"("orderId");
CREATE INDEX "BillLine_orderItemId_idx" ON "BillLine"("orderItemId");
CREATE INDEX "BillLine_menuItemId_idx" ON "BillLine"("menuItemId");

CREATE INDEX "ManualPayment_companyId_idx" ON "ManualPayment"("companyId");
CREATE INDEX "ManualPayment_branchId_idx" ON "ManualPayment"("branchId");
CREATE INDEX "ManualPayment_billId_idx" ON "ManualPayment"("billId");
CREATE INDEX "ManualPayment_method_idx" ON "ManualPayment"("method");
CREATE INDEX "ManualPayment_status_idx" ON "ManualPayment"("status");
CREATE INDEX "ManualPayment_recordedAt_idx" ON "ManualPayment"("recordedAt");

CREATE UNIQUE INDEX "BillReceipt_billId_key" ON "BillReceipt"("billId");
CREATE UNIQUE INDEX "BillReceipt_branchId_receiptNumber_key" ON "BillReceipt"("branchId", "receiptNumber");
CREATE INDEX "BillReceipt_companyId_idx" ON "BillReceipt"("companyId");
CREATE INDEX "BillReceipt_branchId_idx" ON "BillReceipt"("branchId");
CREATE INDEX "BillReceipt_generatedAt_idx" ON "BillReceipt"("generatedAt");

CREATE INDEX "BillEvent_billId_idx" ON "BillEvent"("billId");
CREATE INDEX "BillEvent_type_idx" ON "BillEvent"("type");
CREATE INDEX "BillEvent_actorStaffUserId_idx" ON "BillEvent"("actorStaffUserId");
CREATE INDEX "BillEvent_createdAt_idx" ON "BillEvent"("createdAt");

ALTER TABLE "Bill" ADD CONSTRAINT "Bill_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_billRequestId_fkey" FOREIGN KEY ("billRequestId") REFERENCES "BillRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_presentedByStaffUserId_fkey" FOREIGN KEY ("presentedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_paidByStaffUserId_fkey" FOREIGN KEY ("paidByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_closedByStaffUserId_fkey" FOREIGN KEY ("closedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_cancelledByStaffUserId_fkey" FOREIGN KEY ("cancelledByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BillLine" ADD CONSTRAINT "BillLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_recordedByStaffUserId_fkey" FOREIGN KEY ("recordedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualPayment" ADD CONSTRAINT "ManualPayment_voidedByStaffUserId_fkey" FOREIGN KEY ("voidedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BillReceipt" ADD CONSTRAINT "BillReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillReceipt" ADD CONSTRAINT "BillReceipt_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillReceipt" ADD CONSTRAINT "BillReceipt_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BillEvent" ADD CONSTRAINT "BillEvent_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillEvent" ADD CONSTRAINT "BillEvent_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
