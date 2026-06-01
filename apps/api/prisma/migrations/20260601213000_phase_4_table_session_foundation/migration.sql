-- CreateEnum
CREATE TYPE "TableSessionStatus" AS ENUM ('active', 'idle', 'closed', 'expired');

-- CreateEnum
CREATE TYPE "TableSessionSource" AS ENUM ('qr', 'staff', 'dev');

-- CreateEnum
CREATE TYPE "TableSessionEventType" AS ENUM ('created', 'resumed', 'viewed', 'closed', 'expired');

-- CreateTable
CREATE TABLE "TableSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "status" "TableSessionStatus" NOT NULL DEFAULT 'active',
    "source" "TableSessionSource" NOT NULL,
    "guestLabel" TEXT,
    "partySize" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TableSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSessionEvent" (
    "id" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "type" "TableSessionEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TableSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TableSession_companyId_idx" ON "TableSession"("companyId");

-- CreateIndex
CREATE INDEX "TableSession_branchId_idx" ON "TableSession"("branchId");

-- CreateIndex
CREATE INDEX "TableSession_tableId_idx" ON "TableSession"("tableId");

-- CreateIndex
CREATE INDEX "TableSession_status_idx" ON "TableSession"("status");

-- CreateIndex
CREATE INDEX "TableSession_lastSeenAt_idx" ON "TableSession"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "TableSession_one_open_per_table_idx" ON "TableSession"("tableId") WHERE "status" IN ('active', 'idle');

-- CreateIndex
CREATE INDEX "TableSessionEvent_tableSessionId_idx" ON "TableSessionEvent"("tableSessionId");

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSession" ADD CONSTRAINT "TableSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSessionEvent" ADD CONSTRAINT "TableSessionEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
