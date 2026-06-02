-- CreateEnum
CREATE TYPE "AiWaiterSessionStatus" AS ENUM ('active', 'escalated', 'closed');

-- CreateEnum
CREATE TYPE "AiWaiterMessageRole" AS ENUM ('customer', 'assistant', 'system', 'tool');

-- CreateEnum
CREATE TYPE "AiWaiterMessageKind" AS ENUM ('text', 'menu_suggestion', 'cart_proposal', 'action_result', 'escalation', 'status');

-- CreateEnum
CREATE TYPE "AiWaiterCartProposalStatus" AS ENUM ('proposed', 'applied', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "AiWaiterToolName" AS ENUM ('show_menu', 'recommend_items', 'create_cart_proposal', 'apply_cart_proposal', 'call_waiter', 'request_bill', 'read_order_status', 'fallback_to_human');

-- CreateEnum
CREATE TYPE "AiWaiterToolCallStatus" AS ENUM ('pending', 'succeeded', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "AiWaiterEscalationReason" AS ENUM ('customer_requested_human', 'unclear_request', 'unavailable_item', 'missing_required_options', 'safety_or_policy', 'system_error', 'other');

-- CreateEnum
CREATE TYPE "AiWaiterProviderMode" AS ENUM ('stub', 'external_disabled', 'external_ready');

-- AlterEnum
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_session_started';
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_message_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_cart_proposal_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_cart_proposal_applied';
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_escalated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'ai_waiter_session_closed';

-- CreateTable
CREATE TABLE "AiWaiterSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "status" "AiWaiterSessionStatus" NOT NULL DEFAULT 'active',
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "providerMode" "AiWaiterProviderMode" NOT NULL DEFAULT 'stub',
    "modelName" TEXT,
    "summary" JSONB,
    "contextMetadata" JSONB,
    "totalInputTokens" INTEGER NOT NULL DEFAULT 0,
    "totalOutputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "escalatedAt" TIMESTAMP(3),
    "escalationReason" "AiWaiterEscalationReason",
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWaiterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWaiterMessage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "aiWaiterSessionId" TEXT NOT NULL,
    "role" "AiWaiterMessageRole" NOT NULL,
    "kind" "AiWaiterMessageKind" NOT NULL DEFAULT 'text',
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "content" TEXT NOT NULL,
    "structuredPayload" JSONB,
    "metadata" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWaiterMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWaiterCartProposal" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "aiWaiterSessionId" TEXT NOT NULL,
    "status" "AiWaiterCartProposalStatus" NOT NULL DEFAULT 'proposed',
    "title" TEXT,
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "items" JSONB NOT NULL,
    "validationSnapshot" JSONB,
    "estimatedSubtotalMinor" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "appliedCartId" TEXT,
    "appliedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiWaiterCartProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWaiterToolCall" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "aiWaiterSessionId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" "AiWaiterToolName" NOT NULL,
    "status" "AiWaiterToolCallStatus" NOT NULL DEFAULT 'pending',
    "input" JSONB,
    "output" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWaiterToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiWaiterUsageEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "aiWaiterSessionId" TEXT NOT NULL,
    "providerMode" "AiWaiterProviderMode" NOT NULL,
    "modelName" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiWaiterUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiWaiterSession_companyId_idx" ON "AiWaiterSession"("companyId");

-- CreateIndex
CREATE INDEX "AiWaiterSession_branchId_idx" ON "AiWaiterSession"("branchId");

-- CreateIndex
CREATE INDEX "AiWaiterSession_tableSessionId_idx" ON "AiWaiterSession"("tableSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterSession_status_idx" ON "AiWaiterSession"("status");

-- CreateIndex
CREATE INDEX "AiWaiterSession_lastMessageAt_idx" ON "AiWaiterSession"("lastMessageAt");

-- CreateIndex
CREATE INDEX "AiWaiterSession_createdAt_idx" ON "AiWaiterSession"("createdAt");

-- CreateIndex
CREATE INDEX "AiWaiterMessage_aiWaiterSessionId_idx" ON "AiWaiterMessage"("aiWaiterSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterMessage_tableSessionId_idx" ON "AiWaiterMessage"("tableSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterMessage_role_idx" ON "AiWaiterMessage"("role");

-- CreateIndex
CREATE INDEX "AiWaiterMessage_kind_idx" ON "AiWaiterMessage"("kind");

-- CreateIndex
CREATE INDEX "AiWaiterMessage_createdAt_idx" ON "AiWaiterMessage"("createdAt");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_companyId_idx" ON "AiWaiterCartProposal"("companyId");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_branchId_idx" ON "AiWaiterCartProposal"("branchId");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_tableSessionId_idx" ON "AiWaiterCartProposal"("tableSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_aiWaiterSessionId_idx" ON "AiWaiterCartProposal"("aiWaiterSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_status_idx" ON "AiWaiterCartProposal"("status");

-- CreateIndex
CREATE INDEX "AiWaiterCartProposal_createdAt_idx" ON "AiWaiterCartProposal"("createdAt");

-- CreateIndex
CREATE INDEX "AiWaiterToolCall_aiWaiterSessionId_idx" ON "AiWaiterToolCall"("aiWaiterSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterToolCall_tableSessionId_idx" ON "AiWaiterToolCall"("tableSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterToolCall_toolName_idx" ON "AiWaiterToolCall"("toolName");

-- CreateIndex
CREATE INDEX "AiWaiterToolCall_status_idx" ON "AiWaiterToolCall"("status");

-- CreateIndex
CREATE INDEX "AiWaiterToolCall_createdAt_idx" ON "AiWaiterToolCall"("createdAt");

-- CreateIndex
CREATE INDEX "AiWaiterUsageEvent_companyId_idx" ON "AiWaiterUsageEvent"("companyId");

-- CreateIndex
CREATE INDEX "AiWaiterUsageEvent_branchId_idx" ON "AiWaiterUsageEvent"("branchId");

-- CreateIndex
CREATE INDEX "AiWaiterUsageEvent_tableSessionId_idx" ON "AiWaiterUsageEvent"("tableSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterUsageEvent_aiWaiterSessionId_idx" ON "AiWaiterUsageEvent"("aiWaiterSessionId");

-- CreateIndex
CREATE INDEX "AiWaiterUsageEvent_createdAt_idx" ON "AiWaiterUsageEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "AiWaiterSession" ADD CONSTRAINT "AiWaiterSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterSession" ADD CONSTRAINT "AiWaiterSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterSession" ADD CONSTRAINT "AiWaiterSession_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterMessage" ADD CONSTRAINT "AiWaiterMessage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterMessage" ADD CONSTRAINT "AiWaiterMessage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterMessage" ADD CONSTRAINT "AiWaiterMessage_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterMessage" ADD CONSTRAINT "AiWaiterMessage_aiWaiterSessionId_fkey" FOREIGN KEY ("aiWaiterSessionId") REFERENCES "AiWaiterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterCartProposal" ADD CONSTRAINT "AiWaiterCartProposal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterCartProposal" ADD CONSTRAINT "AiWaiterCartProposal_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterCartProposal" ADD CONSTRAINT "AiWaiterCartProposal_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterCartProposal" ADD CONSTRAINT "AiWaiterCartProposal_aiWaiterSessionId_fkey" FOREIGN KEY ("aiWaiterSessionId") REFERENCES "AiWaiterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterCartProposal" ADD CONSTRAINT "AiWaiterCartProposal_appliedCartId_fkey" FOREIGN KEY ("appliedCartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterToolCall" ADD CONSTRAINT "AiWaiterToolCall_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterToolCall" ADD CONSTRAINT "AiWaiterToolCall_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterToolCall" ADD CONSTRAINT "AiWaiterToolCall_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterToolCall" ADD CONSTRAINT "AiWaiterToolCall_aiWaiterSessionId_fkey" FOREIGN KEY ("aiWaiterSessionId") REFERENCES "AiWaiterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterToolCall" ADD CONSTRAINT "AiWaiterToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "AiWaiterMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterUsageEvent" ADD CONSTRAINT "AiWaiterUsageEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterUsageEvent" ADD CONSTRAINT "AiWaiterUsageEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterUsageEvent" ADD CONSTRAINT "AiWaiterUsageEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiWaiterUsageEvent" ADD CONSTRAINT "AiWaiterUsageEvent_aiWaiterSessionId_fkey" FOREIGN KEY ("aiWaiterSessionId") REFERENCES "AiWaiterSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
