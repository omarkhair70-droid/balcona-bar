-- CreateEnum
CREATE TYPE "RealtimeEventType" AS ENUM ('connection_opened', 'table_session_started', 'table_session_resumed', 'notification_created', 'notification_read', 'notification_dismissed', 'order_submitted', 'order_accepted', 'order_rejected', 'preparation_task_created', 'preparation_task_started', 'preparation_task_ready', 'preparation_task_cancelled', 'waiter_call_created', 'waiter_call_acknowledged', 'waiter_call_resolved', 'waiter_call_cancelled', 'system');

-- CreateEnum
CREATE TYPE "RealtimeEventChannel" AS ENUM ('branch_orders', 'branch_preparation', 'branch_waiter_calls', 'branch_notifications', 'session_status', 'session_notifications', 'session_waiter_calls', 'system');

-- CreateTable
CREATE TABLE "RealtimeEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "tableSessionId" TEXT,
    "orderId" TEXT,
    "preparationTaskId" TEXT,
    "waiterCallId" TEXT,
    "notificationId" TEXT,
    "type" "RealtimeEventType" NOT NULL,
    "channel" "RealtimeEventChannel" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealtimeEvent_companyId_idx" ON "RealtimeEvent"("companyId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_branchId_idx" ON "RealtimeEvent"("branchId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_tableSessionId_idx" ON "RealtimeEvent"("tableSessionId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_orderId_idx" ON "RealtimeEvent"("orderId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_preparationTaskId_idx" ON "RealtimeEvent"("preparationTaskId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_waiterCallId_idx" ON "RealtimeEvent"("waiterCallId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_notificationId_idx" ON "RealtimeEvent"("notificationId");

-- CreateIndex
CREATE INDEX "RealtimeEvent_type_idx" ON "RealtimeEvent"("type");

-- CreateIndex
CREATE INDEX "RealtimeEvent_channel_idx" ON "RealtimeEvent"("channel");

-- CreateIndex
CREATE INDEX "RealtimeEvent_createdAt_idx" ON "RealtimeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "RealtimeEvent_branchId_channel_createdAt_idx" ON "RealtimeEvent"("branchId", "channel", "createdAt");

-- CreateIndex
CREATE INDEX "RealtimeEvent_tableSessionId_channel_createdAt_idx" ON "RealtimeEvent"("tableSessionId", "channel", "createdAt");

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_preparationTaskId_fkey" FOREIGN KEY ("preparationTaskId") REFERENCES "PreparationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_waiterCallId_fkey" FOREIGN KEY ("waiterCallId") REFERENCES "WaiterCall"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RealtimeEvent" ADD CONSTRAINT "RealtimeEvent_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
