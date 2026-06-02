-- CreateEnum
CREATE TYPE "StaffSessionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "CustomerSessionAccessStatus" AS ENUM ('active', 'revoked', 'expired');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'staff_login';
ALTER TYPE "AuditAction" ADD VALUE 'staff_logout';
ALTER TYPE "AuditAction" ADD VALUE 'staff_password_bootstrapped';
ALTER TYPE "AuditAction" ADD VALUE 'staff_session_revoked';

-- AlterTable
ALTER TABLE "StaffUser" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "StaffUser" ADD COLUMN "passwordSetAt" TIMESTAMP(3);
ALTER TABLE "StaffUser" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomerSessionIdentity" ADD COLUMN "accessTokenHash" TEXT;
ALTER TABLE "CustomerSessionIdentity" ADD COLUMN "accessTokenStatus" "CustomerSessionAccessStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "CustomerSessionIdentity" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "CustomerSessionIdentity" ADD COLUMN "accessTokenLastUsedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "staffUserId" TEXT NOT NULL,
    "status" "StaffSessionStatus" NOT NULL DEFAULT 'active',
    "tokenHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_companyId_idx" ON "StaffSession"("companyId");

-- CreateIndex
CREATE INDEX "StaffSession_branchId_idx" ON "StaffSession"("branchId");

-- CreateIndex
CREATE INDEX "StaffSession_staffUserId_idx" ON "StaffSession"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffSession_status_idx" ON "StaffSession"("status");

-- CreateIndex
CREATE INDEX "StaffSession_expiresAt_idx" ON "StaffSession"("expiresAt");

-- CreateIndex
CREATE INDEX "StaffSession_createdAt_idx" ON "StaffSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSessionIdentity_accessTokenHash_key" ON "CustomerSessionIdentity"("accessTokenHash");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_accessTokenStatus_idx" ON "CustomerSessionIdentity"("accessTokenStatus");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_accessTokenExpiresAt_idx" ON "CustomerSessionIdentity"("accessTokenExpiresAt");

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSession" ADD CONSTRAINT "StaffSession_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

