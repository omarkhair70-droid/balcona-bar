-- CreateEnum
CREATE TYPE "WaiterCallType" AS ENUM ('call_waiter', 'need_bill', 'need_water', 'need_help', 'order_problem', 'clean_table', 'other');

-- CreateEnum
CREATE TYPE "WaiterCallStatus" AS ENUM ('open', 'acknowledged', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "WaiterCallEventType" AS ENUM ('created', 'acknowledged', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "WaiterCallActorType" AS ENUM ('customer', 'staff', 'system', 'dev');

-- CreateTable
CREATE TABLE "WaiterCall" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" "WaiterCallType" NOT NULL,
    "status" "WaiterCallStatus" NOT NULL DEFAULT 'open',
    "message" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaiterCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiterCallEvent" (
    "id" TEXT NOT NULL,
    "waiterCallId" TEXT NOT NULL,
    "type" "WaiterCallEventType" NOT NULL,
    "actorType" "WaiterCallActorType" NOT NULL,
    "actorStaffUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaiterCallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaiterCall_companyId_idx" ON "WaiterCall"("companyId");

-- CreateIndex
CREATE INDEX "WaiterCall_branchId_idx" ON "WaiterCall"("branchId");

-- CreateIndex
CREATE INDEX "WaiterCall_tableSessionId_idx" ON "WaiterCall"("tableSessionId");

-- CreateIndex
CREATE INDEX "WaiterCall_tableId_idx" ON "WaiterCall"("tableId");

-- CreateIndex
CREATE INDEX "WaiterCall_orderId_idx" ON "WaiterCall"("orderId");

-- CreateIndex
CREATE INDEX "WaiterCall_type_idx" ON "WaiterCall"("type");

-- CreateIndex
CREATE INDEX "WaiterCall_status_idx" ON "WaiterCall"("status");

-- CreateIndex
CREATE INDEX "WaiterCall_createdAt_idx" ON "WaiterCall"("createdAt");

-- CreateIndex
CREATE INDEX "WaiterCall_priority_idx" ON "WaiterCall"("priority");

-- CreateIndex
CREATE INDEX "WaiterCallEvent_waiterCallId_idx" ON "WaiterCallEvent"("waiterCallId");

-- CreateIndex
CREATE INDEX "WaiterCallEvent_type_idx" ON "WaiterCallEvent"("type");

-- CreateIndex
CREATE INDEX "WaiterCallEvent_actorType_idx" ON "WaiterCallEvent"("actorType");

-- CreateIndex
CREATE INDEX "WaiterCallEvent_createdAt_idx" ON "WaiterCallEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCall" ADD CONSTRAINT "WaiterCall_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCallEvent" ADD CONSTRAINT "WaiterCallEvent_waiterCallId_fkey" FOREIGN KEY ("waiterCallId") REFERENCES "WaiterCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiterCallEvent" ADD CONSTRAINT "WaiterCallEvent_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
