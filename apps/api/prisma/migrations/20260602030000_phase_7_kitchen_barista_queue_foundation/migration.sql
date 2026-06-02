-- CreateEnum
CREATE TYPE "PreparationTaskStatus" AS ENUM ('pending', 'preparing', 'ready', 'cancelled');

-- CreateEnum
CREATE TYPE "PreparationTaskEventType" AS ENUM ('created', 'started', 'marked_ready', 'cancelled');

-- CreateTable
CREATE TABLE "PreparationTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "station" "PreparationStation" NOT NULL,
    "status" "PreparationTaskStatus" NOT NULL DEFAULT 'pending',
    "quantity" INTEGER NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "itemSlugSnapshot" TEXT NOT NULL,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreparationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreparationTaskEvent" (
    "id" TEXT NOT NULL,
    "preparationTaskId" TEXT NOT NULL,
    "type" "PreparationTaskEventType" NOT NULL,
    "actorStaffUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreparationTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PreparationTask_orderItemId_key" ON "PreparationTask"("orderItemId");

-- CreateIndex
CREATE INDEX "PreparationTask_companyId_idx" ON "PreparationTask"("companyId");

-- CreateIndex
CREATE INDEX "PreparationTask_branchId_idx" ON "PreparationTask"("branchId");

-- CreateIndex
CREATE INDEX "PreparationTask_orderId_idx" ON "PreparationTask"("orderId");

-- CreateIndex
CREATE INDEX "PreparationTask_orderItemId_idx" ON "PreparationTask"("orderItemId");

-- CreateIndex
CREATE INDEX "PreparationTask_station_idx" ON "PreparationTask"("station");

-- CreateIndex
CREATE INDEX "PreparationTask_status_idx" ON "PreparationTask"("status");

-- CreateIndex
CREATE INDEX "PreparationTask_createdAt_idx" ON "PreparationTask"("createdAt");

-- CreateIndex
CREATE INDEX "PreparationTaskEvent_preparationTaskId_idx" ON "PreparationTaskEvent"("preparationTaskId");

-- CreateIndex
CREATE INDEX "PreparationTaskEvent_type_idx" ON "PreparationTaskEvent"("type");

-- CreateIndex
CREATE INDEX "PreparationTaskEvent_createdAt_idx" ON "PreparationTaskEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationTask" ADD CONSTRAINT "PreparationTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationTaskEvent" ADD CONSTRAINT "PreparationTaskEvent_preparationTaskId_fkey" FOREIGN KEY ("preparationTaskId") REFERENCES "PreparationTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreparationTaskEvent" ADD CONSTRAINT "PreparationTaskEvent_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
