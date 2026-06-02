-- CreateEnum
CREATE TYPE "BillRequestStatus" AS ENUM ('open', 'acknowledged', 'presented', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillRequestEventType" AS ENUM ('created', 'acknowledged', 'presented', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillRequestActorType" AS ENUM ('customer', 'staff', 'system', 'dev');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'preparing';
ALTER TYPE "OrderStatus" ADD VALUE 'ready';
ALTER TYPE "OrderStatus" ADD VALUE 'served';
ALTER TYPE "OrderStatus" ADD VALUE 'completed';

-- AlterEnum
ALTER TYPE "OrderEventType" ADD VALUE 'preparation_started';
ALTER TYPE "OrderEventType" ADD VALUE 'preparation_ready';
ALTER TYPE "OrderEventType" ADD VALUE 'served';
ALTER TYPE "OrderEventType" ADD VALUE 'completed';
ALTER TYPE "OrderEventType" ADD VALUE 'bill_requested';

-- AlterEnum
ALTER TYPE "NotificationKind" ADD VALUE 'order_served';
ALTER TYPE "NotificationKind" ADD VALUE 'bill_requested';
ALTER TYPE "NotificationKind" ADD VALUE 'bill_presented';
ALTER TYPE "NotificationKind" ADD VALUE 'bill_closed';

-- AlterEnum
ALTER TYPE "RealtimeEventType" ADD VALUE 'order_preparation_started';
ALTER TYPE "RealtimeEventType" ADD VALUE 'order_preparation_ready';
ALTER TYPE "RealtimeEventType" ADD VALUE 'order_served';
ALTER TYPE "RealtimeEventType" ADD VALUE 'order_completed';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_requested';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_acknowledged';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_presented';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_closed';
ALTER TYPE "RealtimeEventType" ADD VALUE 'bill_cancelled';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "preparingAt" TIMESTAMP(3),
ADD COLUMN "readyAt" TIMESTAMP(3),
ADD COLUMN "servedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "servedByStaffUserId" TEXT,
ADD COLUMN "completedByStaffUserId" TEXT,
ADD COLUMN "completionNote" TEXT;

-- AlterTable
ALTER TABLE "RealtimeEvent" ADD COLUMN "billRequestId" TEXT;

-- CreateTable
CREATE TABLE "BillRequest" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "status" "BillRequestStatus" NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "subtotalMinor" INTEGER NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "presentedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "requestedByActorType" "BillRequestActorType" NOT NULL DEFAULT 'customer',
    "acknowledgedByStaffUserId" TEXT,
    "presentedByStaffUserId" TEXT,
    "closedByStaffUserId" TEXT,
    "cancelledByStaffUserId" TEXT,
    "note" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillRequestEvent" (
    "id" TEXT NOT NULL,
    "billRequestId" TEXT NOT NULL,
    "type" "BillRequestEventType" NOT NULL,
    "actorType" "BillRequestActorType" NOT NULL,
    "actorStaffUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_preparingAt_idx" ON "Order"("preparingAt");

-- CreateIndex
CREATE INDEX "Order_readyAt_idx" ON "Order"("readyAt");

-- CreateIndex
CREATE INDEX "Order_servedAt_idx" ON "Order"("servedAt");

-- CreateIndex
CREATE INDEX "Order_completedAt_idx" ON "Order"("completedAt");

-- CreateIndex
CREATE INDEX "Order_servedByStaffUserId_idx" ON "Order"("servedByStaffUserId");

-- CreateIndex
CREATE INDEX "Order_completedByStaffUserId_idx" ON "Order"("completedByStaffUserId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_billRequestId_idx" ON "RealtimeEvent"("billRequestId");

-- CreateIndex
CREATE INDEX "BillRequest_companyId_idx" ON "BillRequest"("companyId");

-- CreateIndex
CREATE INDEX "BillRequest_branchId_idx" ON "BillRequest"("branchId");

-- CreateIndex
CREATE INDEX "BillRequest_tableSessionId_idx" ON "BillRequest"("tableSessionId");

-- CreateIndex
CREATE INDEX "BillRequest_status_idx" ON "BillRequest"("status");

-- CreateIndex
CREATE INDEX "BillRequest_requestedAt_idx" ON "BillRequest"("requestedAt");

-- CreateIndex
CREATE INDEX "BillRequest_branchId_status_requestedAt_idx" ON "BillRequest"("branchId", "status", "requestedAt");

-- CreateIndex
CREATE INDEX "BillRequest_tableSessionId_status_idx" ON "BillRequest"("tableSessionId", "status");

-- CreateIndex
CREATE INDEX "BillRequestEvent_billRequestId_idx" ON "BillRequestEvent"("billRequestId");

-- CreateIndex
CREATE INDEX "BillRequestEvent_type_idx" ON "BillRequestEvent"("type");

-- CreateIndex
CREATE INDEX "BillRequestEvent_actorStaffUserId_idx" ON "BillRequestEvent"("actorStaffUserId");

-- CreateIndex
CREATE INDEX "BillRequestEvent_createdAt_idx" ON "BillRequestEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_servedByStaffUserId_fkey" FOREIGN KEY ("servedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_completedByStaffUserId_fkey" FOREIGN KEY ("completedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_billRequestId_fkey" FOREIGN KEY ("billRequestId") REFERENCES "BillRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_acknowledgedByStaffUserId_fkey" FOREIGN KEY ("acknowledgedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_presentedByStaffUserId_fkey" FOREIGN KEY ("presentedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_closedByStaffUserId_fkey" FOREIGN KEY ("closedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequest" ADD CONSTRAINT "BillRequest_cancelledByStaffUserId_fkey" FOREIGN KEY ("cancelledByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequestEvent" ADD CONSTRAINT "BillRequestEvent_billRequestId_fkey" FOREIGN KEY ("billRequestId") REFERENCES "BillRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillRequestEvent" ADD CONSTRAINT "BillRequestEvent_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
