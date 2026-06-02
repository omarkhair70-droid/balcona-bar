-- CreateEnum
CREATE TYPE "BranchOperatingMode" AS ENUM ('manual', 'assisted', 'autopilot');

-- CreateEnum
CREATE TYPE "BranchServiceMode" AS ENUM ('dine_in', 'takeaway', 'mixed');

-- CreateEnum
CREATE TYPE "BranchFeatureFlagKey" AS ENUM ('ai_waiter', 'waiter_calls', 'smart_cashier', 'realtime', 'media_experience', 'bill_flow', 'table_attention', 'analytics', 'notifications', 'presence_triggers');

-- CreateEnum
CREATE TYPE "TableAttentionStatus" AS ENUM ('normal', 'needs_attention', 'urgent', 'resolved', 'muted');

-- CreateEnum
CREATE TYPE "TableAttentionReason" AS ENUM ('order_waiting_for_acceptance', 'preparation_delayed', 'order_ready_not_served', 'waiter_call_open', 'bill_requested', 'ai_waiter_escalated', 'session_idle_too_long', 'manual_flag', 'other');

-- CreateEnum
CREATE TYPE "TableAttentionPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('customer', 'staff', 'system', 'ai_waiter', 'dev');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('settings_updated', 'feature_flag_updated', 'order_accepted', 'order_rejected', 'order_served', 'order_completed', 'bill_acknowledged', 'bill_presented', 'bill_closed', 'bill_cancelled', 'waiter_call_acknowledged', 'waiter_call_resolved', 'waiter_call_cancelled', 'ai_waiter_escalated', 'attention_recalculated', 'attention_resolved', 'attention_muted', 'attention_rebuilt', 'menu_changed', 'experience_changed', 'media_changed', 'content_changed', 'other');

-- AlterEnum
ALTER TYPE "RealtimeEventType" ADD VALUE 'table_attention_updated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'table_attention_resolved';
ALTER TYPE "RealtimeEventType" ADD VALUE 'branch_attention_queue_updated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'branch_settings_updated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'analytics_snapshot_generated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'audit_log_created';

-- CreateTable
CREATE TABLE "BranchOperatingSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "operatingMode" "BranchOperatingMode" NOT NULL DEFAULT 'assisted',
    "serviceMode" "BranchServiceMode" NOT NULL DEFAULT 'dine_in',
    "aiWaiterEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waiterCallsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "smartCashierEnabled" BOOLEAN NOT NULL DEFAULT true,
    "realtimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "mediaExperienceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "billFlowEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tableAttentionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "analyticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "presenceTriggersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "openingHours" JSONB,
    "serviceConfig" JSONB,
    "attentionConfig" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchOperatingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchFeatureFlag" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "key" "BranchFeatureFlagKey" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchFeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAttentionSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "status" "TableAttentionStatus" NOT NULL DEFAULT 'normal',
    "priority" "TableAttentionPriority" NOT NULL DEFAULT 'low',
    "score" INTEGER NOT NULL DEFAULT 0,
    "reasons" JSONB NOT NULL,
    "recommendedActions" JSONB,
    "source" TEXT NOT NULL DEFAULT 'autopilot',
    "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableAttentionSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableAttentionEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "snapshotId" TEXT,
    "reason" "TableAttentionReason" NOT NULL,
    "priority" "TableAttentionPriority" NOT NULL,
    "scoreDelta" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableAttentionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "actorType" "AuditActorType" NOT NULL,
    "actorStaffUserId" TEXT,
    "tableSessionId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "action" "AuditAction" NOT NULL,
    "message" TEXT,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "requestId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchOperatingSettings_branchId_key" ON "BranchOperatingSettings"("branchId");

-- CreateIndex
CREATE INDEX "BranchOperatingSettings_companyId_idx" ON "BranchOperatingSettings"("companyId");

-- CreateIndex
CREATE INDEX "BranchOperatingSettings_branchId_idx" ON "BranchOperatingSettings"("branchId");

-- CreateIndex
CREATE INDEX "BranchOperatingSettings_operatingMode_idx" ON "BranchOperatingSettings"("operatingMode");

-- CreateIndex
CREATE INDEX "BranchOperatingSettings_serviceMode_idx" ON "BranchOperatingSettings"("serviceMode");

-- CreateIndex
CREATE UNIQUE INDEX "BranchFeatureFlag_branchId_key_key" ON "BranchFeatureFlag"("branchId", "key");

-- CreateIndex
CREATE INDEX "BranchFeatureFlag_companyId_idx" ON "BranchFeatureFlag"("companyId");

-- CreateIndex
CREATE INDEX "BranchFeatureFlag_branchId_idx" ON "BranchFeatureFlag"("branchId");

-- CreateIndex
CREATE INDEX "BranchFeatureFlag_key_idx" ON "BranchFeatureFlag"("key");

-- CreateIndex
CREATE INDEX "BranchFeatureFlag_enabled_idx" ON "BranchFeatureFlag"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TableAttentionSnapshot_tableSessionId_key" ON "TableAttentionSnapshot"("tableSessionId");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_companyId_idx" ON "TableAttentionSnapshot"("companyId");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_branchId_idx" ON "TableAttentionSnapshot"("branchId");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_tableSessionId_idx" ON "TableAttentionSnapshot"("tableSessionId");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_status_idx" ON "TableAttentionSnapshot"("status");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_priority_idx" ON "TableAttentionSnapshot"("priority");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_score_idx" ON "TableAttentionSnapshot"("score");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_lastEvaluatedAt_idx" ON "TableAttentionSnapshot"("lastEvaluatedAt");

-- CreateIndex
CREATE INDEX "TableAttentionSnapshot_branchId_status_priority_idx" ON "TableAttentionSnapshot"("branchId", "status", "priority");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_companyId_idx" ON "TableAttentionEvent"("companyId");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_branchId_idx" ON "TableAttentionEvent"("branchId");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_tableSessionId_idx" ON "TableAttentionEvent"("tableSessionId");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_snapshotId_idx" ON "TableAttentionEvent"("snapshotId");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_reason_idx" ON "TableAttentionEvent"("reason");

-- CreateIndex
CREATE INDEX "TableAttentionEvent_createdAt_idx" ON "TableAttentionEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_idx" ON "AuditLog"("branchId");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_idx" ON "AuditLog"("actorType");

-- CreateIndex
CREATE INDEX "AuditLog_actorStaffUserId_idx" ON "AuditLog"("actorStaffUserId");

-- CreateIndex
CREATE INDEX "AuditLog_tableSessionId_idx" ON "AuditLog"("tableSessionId");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BranchOperatingSettings" ADD CONSTRAINT "BranchOperatingSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchOperatingSettings" ADD CONSTRAINT "BranchOperatingSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchFeatureFlag" ADD CONSTRAINT "BranchFeatureFlag_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchFeatureFlag" ADD CONSTRAINT "BranchFeatureFlag_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionSnapshot" ADD CONSTRAINT "TableAttentionSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionSnapshot" ADD CONSTRAINT "TableAttentionSnapshot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionSnapshot" ADD CONSTRAINT "TableAttentionSnapshot_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionEvent" ADD CONSTRAINT "TableAttentionEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionEvent" ADD CONSTRAINT "TableAttentionEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionEvent" ADD CONSTRAINT "TableAttentionEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableAttentionEvent" ADD CONSTRAINT "TableAttentionEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "TableAttentionSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
