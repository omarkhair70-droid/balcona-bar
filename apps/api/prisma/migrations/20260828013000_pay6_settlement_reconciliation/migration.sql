CREATE TYPE "OnlinePaymentReconciliationSource" AS ENUM (
  'provider_inquiry',
  'settlement_statement'
);

CREATE TYPE "OnlinePaymentReconciliationRunStatus" AS ENUM (
  'running',
  'pending',
  'matched',
  'mismatch',
  'failed'
);

CREATE TYPE "OnlinePaymentReconciliationMovementType" AS ENUM (
  'sale',
  'refund',
  'void'
);

CREATE TYPE "OnlinePaymentReconciliationMatchStatus" AS ENUM (
  'matched',
  'provider_pending',
  'mismatch'
);

CREATE TYPE "OnlinePaymentReconciliationIssueType" AS ENUM (
  'provider_transaction_missing',
  'provider_status_mismatch',
  'amount_mismatch',
  'currency_mismatch',
  'operation_type_mismatch',
  'settlement_status_mismatch',
  'statement_line_missing',
  'statement_only_transaction',
  'statement_total_mismatch',
  'statement_net_mismatch'
);

CREATE TYPE "OnlinePaymentReconciliationIssueStatus" AS ENUM (
  'open',
  'acknowledged',
  'resolved'
);

ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'online_payment_reconciliation_run';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'online_payment_settlement_imported';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'online_payment_reconciliation_issue_acknowledged';
ALTER TYPE "AuditAction"
  ADD VALUE IF NOT EXISTS 'online_payment_reconciliation_issue_resolved';

CREATE TABLE "OnlinePaymentSettlementBatch" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "externalReference" TEXT NOT NULL,
  "payoutReference" TEXT,
  "currency" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "grossMinor" INTEGER NOT NULL,
  "adjustmentMinor" INTEGER NOT NULL,
  "feeMinor" INTEGER NOT NULL,
  "netMinor" INTEGER NOT NULL,
  "sourceHash" TEXT NOT NULL,
  "importedByStaffUserId" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlinePaymentSettlementBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlinePaymentSettlementBatch_period_valid"
    CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "OnlinePaymentSettlementBatch_nonnegative_totals"
    CHECK (
      "grossMinor" >= 0 AND
      "adjustmentMinor" >= 0 AND
      "feeMinor" >= 0
    )
);

CREATE UNIQUE INDEX
  "OnlinePaymentSettlementBatch_provider_branchId_externalReference_key"
  ON "OnlinePaymentSettlementBatch"("provider", "branchId", "externalReference");
CREATE UNIQUE INDEX
  "OnlinePaymentSettlementBatch_provider_branchId_sourceHash_key"
  ON "OnlinePaymentSettlementBatch"("provider", "branchId", "sourceHash");
CREATE INDEX "OnlinePaymentSettlementBatch_companyId_idx"
  ON "OnlinePaymentSettlementBatch"("companyId");
CREATE INDEX "OnlinePaymentSettlementBatch_branchId_idx"
  ON "OnlinePaymentSettlementBatch"("branchId");
CREATE INDEX "OnlinePaymentSettlementBatch_provider_idx"
  ON "OnlinePaymentSettlementBatch"("provider");
CREATE INDEX "OnlinePaymentSettlementBatch_periodStart_periodEnd_idx"
  ON "OnlinePaymentSettlementBatch"("periodStart", "periodEnd");
CREATE INDEX "OnlinePaymentSettlementBatch_settledAt_idx"
  ON "OnlinePaymentSettlementBatch"("settledAt");
CREATE INDEX "OnlinePaymentSettlementBatch_createdAt_idx"
  ON "OnlinePaymentSettlementBatch"("createdAt");

CREATE TABLE "OnlinePaymentSettlementLine" (
  "id" TEXT NOT NULL,
  "settlementBatchId" TEXT NOT NULL,
  "providerTransactionId" TEXT NOT NULL,
  "movementType" "OnlinePaymentReconciliationMovementType" NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "feeMinor" INTEGER NOT NULL DEFAULT 0,
  "netMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "settlementReference" TEXT,
  "settledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlinePaymentSettlementLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlinePaymentSettlementLine_amount_positive"
    CHECK ("amountMinor" > 0),
  CONSTRAINT "OnlinePaymentSettlementLine_fee_nonnegative"
    CHECK ("feeMinor" >= 0)
);

CREATE UNIQUE INDEX
  "OnlinePaymentSettlementLine_settlementBatchId_providerTransactionId_key"
  ON "OnlinePaymentSettlementLine"("settlementBatchId", "providerTransactionId");
CREATE INDEX "OnlinePaymentSettlementLine_providerTransactionId_idx"
  ON "OnlinePaymentSettlementLine"("providerTransactionId");
CREATE INDEX "OnlinePaymentSettlementLine_movementType_idx"
  ON "OnlinePaymentSettlementLine"("movementType");
CREATE INDEX "OnlinePaymentSettlementLine_settledAt_idx"
  ON "OnlinePaymentSettlementLine"("settledAt");

CREATE TABLE "OnlinePaymentReconciliationRun" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "source" "OnlinePaymentReconciliationSource" NOT NULL,
  "status" "OnlinePaymentReconciliationRunStatus" NOT NULL DEFAULT 'running',
  "idempotencyKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL,
  "settlementBatchId" TEXT,
  "requestedByStaffUserId" TEXT,
  "localGrossMinor" INTEGER NOT NULL DEFAULT 0,
  "localAdjustmentMinor" INTEGER NOT NULL DEFAULT 0,
  "localNetBeforeFeesMinor" INTEGER NOT NULL DEFAULT 0,
  "providerGrossMinor" INTEGER,
  "providerAdjustmentMinor" INTEGER,
  "providerFeeMinor" INTEGER,
  "providerNetMinor" INTEGER,
  "matchedCount" INTEGER NOT NULL DEFAULT 0,
  "pendingCount" INTEGER NOT NULL DEFAULT 0,
  "mismatchCount" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "failureMessage" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlinePaymentReconciliationRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlinePaymentReconciliationRun_period_valid"
    CHECK ("periodEnd" > "periodStart"),
  CONSTRAINT "OnlinePaymentReconciliationRun_counts_nonnegative"
    CHECK (
      "matchedCount" >= 0 AND
      "pendingCount" >= 0 AND
      "mismatchCount" >= 0
    )
);

CREATE UNIQUE INDEX "OnlinePaymentReconciliationRun_idempotencyKey_key"
  ON "OnlinePaymentReconciliationRun"("idempotencyKey");
CREATE INDEX "OnlinePaymentReconciliationRun_companyId_idx"
  ON "OnlinePaymentReconciliationRun"("companyId");
CREATE INDEX "OnlinePaymentReconciliationRun_branchId_idx"
  ON "OnlinePaymentReconciliationRun"("branchId");
CREATE INDEX "OnlinePaymentReconciliationRun_provider_idx"
  ON "OnlinePaymentReconciliationRun"("provider");
CREATE INDEX "OnlinePaymentReconciliationRun_source_idx"
  ON "OnlinePaymentReconciliationRun"("source");
CREATE INDEX "OnlinePaymentReconciliationRun_status_idx"
  ON "OnlinePaymentReconciliationRun"("status");
CREATE INDEX "OnlinePaymentReconciliationRun_periodStart_periodEnd_idx"
  ON "OnlinePaymentReconciliationRun"("periodStart", "periodEnd");
CREATE INDEX "OnlinePaymentReconciliationRun_settlementBatchId_idx"
  ON "OnlinePaymentReconciliationRun"("settlementBatchId");
CREATE INDEX "OnlinePaymentReconciliationRun_createdAt_idx"
  ON "OnlinePaymentReconciliationRun"("createdAt");

CREATE TABLE "OnlinePaymentReconciliationEntry" (
  "id" TEXT NOT NULL,
  "reconciliationRunId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "movementType" "OnlinePaymentReconciliationMovementType" NOT NULL,
  "onlinePaymentIntentId" TEXT,
  "onlinePaymentOperationId" TEXT,
  "providerTransactionId" TEXT NOT NULL,
  "parentProviderTransactionId" TEXT,
  "localAmountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "providerAmountMinor" INTEGER,
  "providerSettled" BOOLEAN,
  "providerFeeMinor" INTEGER,
  "providerSettlementDate" TIMESTAMP(3),
  "providerSettlementReference" TEXT,
  "settlementLineId" TEXT,
  "matchStatus" "OnlinePaymentReconciliationMatchStatus" NOT NULL,
  "mismatchCode" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlinePaymentReconciliationEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OnlinePaymentReconciliationEntry_local_amount_nonzero"
    CHECK ("localAmountMinor" <> 0)
);

CREATE INDEX
  "OnlinePaymentReconciliationEntry_reconciliationRunId_providerTransactionId_idx"
  ON "OnlinePaymentReconciliationEntry"("reconciliationRunId", "providerTransactionId");
CREATE INDEX "OnlinePaymentReconciliationEntry_companyId_idx"
  ON "OnlinePaymentReconciliationEntry"("companyId");
CREATE INDEX "OnlinePaymentReconciliationEntry_branchId_idx"
  ON "OnlinePaymentReconciliationEntry"("branchId");
CREATE INDEX "OnlinePaymentReconciliationEntry_provider_idx"
  ON "OnlinePaymentReconciliationEntry"("provider");
CREATE INDEX "OnlinePaymentReconciliationEntry_movementType_idx"
  ON "OnlinePaymentReconciliationEntry"("movementType");
CREATE INDEX "OnlinePaymentReconciliationEntry_onlinePaymentIntentId_idx"
  ON "OnlinePaymentReconciliationEntry"("onlinePaymentIntentId");
CREATE INDEX "OnlinePaymentReconciliationEntry_onlinePaymentOperationId_idx"
  ON "OnlinePaymentReconciliationEntry"("onlinePaymentOperationId");
CREATE INDEX "OnlinePaymentReconciliationEntry_settlementLineId_idx"
  ON "OnlinePaymentReconciliationEntry"("settlementLineId");
CREATE INDEX "OnlinePaymentReconciliationEntry_matchStatus_idx"
  ON "OnlinePaymentReconciliationEntry"("matchStatus");
CREATE INDEX "OnlinePaymentReconciliationEntry_providerSettlementDate_idx"
  ON "OnlinePaymentReconciliationEntry"("providerSettlementDate");

CREATE TABLE "OnlinePaymentReconciliationIssue" (
  "id" TEXT NOT NULL,
  "reconciliationRunId" TEXT NOT NULL,
  "reconciliationEntryId" TEXT,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "provider" "OnlinePaymentProvider" NOT NULL,
  "type" "OnlinePaymentReconciliationIssueType" NOT NULL,
  "status" "OnlinePaymentReconciliationIssueStatus" NOT NULL DEFAULT 'open',
  "message" TEXT NOT NULL,
  "details" JSONB,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByStaffUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByStaffUserId" TEXT,
  "resolutionNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlinePaymentReconciliationIssue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OnlinePaymentReconciliationIssue_reconciliationRunId_idx"
  ON "OnlinePaymentReconciliationIssue"("reconciliationRunId");
CREATE INDEX "OnlinePaymentReconciliationIssue_reconciliationEntryId_idx"
  ON "OnlinePaymentReconciliationIssue"("reconciliationEntryId");
CREATE INDEX "OnlinePaymentReconciliationIssue_companyId_idx"
  ON "OnlinePaymentReconciliationIssue"("companyId");
CREATE INDEX "OnlinePaymentReconciliationIssue_branchId_idx"
  ON "OnlinePaymentReconciliationIssue"("branchId");
CREATE INDEX "OnlinePaymentReconciliationIssue_provider_idx"
  ON "OnlinePaymentReconciliationIssue"("provider");
CREATE INDEX "OnlinePaymentReconciliationIssue_type_idx"
  ON "OnlinePaymentReconciliationIssue"("type");
CREATE INDEX "OnlinePaymentReconciliationIssue_status_idx"
  ON "OnlinePaymentReconciliationIssue"("status");
CREATE INDEX "OnlinePaymentReconciliationIssue_detectedAt_idx"
  ON "OnlinePaymentReconciliationIssue"("detectedAt");

ALTER TABLE "OnlinePaymentSettlementBatch"
  ADD CONSTRAINT "OnlinePaymentSettlementBatch_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentSettlementBatch"
  ADD CONSTRAINT "OnlinePaymentSettlementBatch_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentSettlementBatch"
  ADD CONSTRAINT "OnlinePaymentSettlementBatch_importedByStaffUserId_fkey"
  FOREIGN KEY ("importedByStaffUserId") REFERENCES "StaffUser"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OnlinePaymentSettlementLine"
  ADD CONSTRAINT "OnlinePaymentSettlementLine_settlementBatchId_fkey"
  FOREIGN KEY ("settlementBatchId") REFERENCES "OnlinePaymentSettlementBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OnlinePaymentReconciliationRun"
  ADD CONSTRAINT "OnlinePaymentReconciliationRun_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationRun"
  ADD CONSTRAINT "OnlinePaymentReconciliationRun_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationRun"
  ADD CONSTRAINT "OnlinePaymentReconciliationRun_settlementBatchId_fkey"
  FOREIGN KEY ("settlementBatchId") REFERENCES "OnlinePaymentSettlementBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationRun"
  ADD CONSTRAINT "OnlinePaymentReconciliationRun_requestedByStaffUserId_fkey"
  FOREIGN KEY ("requestedByStaffUserId") REFERENCES "StaffUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_reconciliationRunId_fkey"
  FOREIGN KEY ("reconciliationRunId") REFERENCES "OnlinePaymentReconciliationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_onlinePaymentIntentId_fkey"
  FOREIGN KEY ("onlinePaymentIntentId") REFERENCES "OnlinePaymentIntent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_onlinePaymentOperationId_fkey"
  FOREIGN KEY ("onlinePaymentOperationId") REFERENCES "OnlinePaymentOperation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationEntry"
  ADD CONSTRAINT "OnlinePaymentReconciliationEntry_settlementLineId_fkey"
  FOREIGN KEY ("settlementLineId") REFERENCES "OnlinePaymentSettlementLine"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_reconciliationRunId_fkey"
  FOREIGN KEY ("reconciliationRunId") REFERENCES "OnlinePaymentReconciliationRun"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_reconciliationEntryId_fkey"
  FOREIGN KEY ("reconciliationEntryId") REFERENCES "OnlinePaymentReconciliationEntry"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_acknowledgedByStaffUserId_fkey"
  FOREIGN KEY ("acknowledgedByStaffUserId") REFERENCES "StaffUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnlinePaymentReconciliationIssue"
  ADD CONSTRAINT "OnlinePaymentReconciliationIssue_resolvedByStaffUserId_fkey"
  FOREIGN KEY ("resolvedByStaffUserId") REFERENCES "StaffUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
