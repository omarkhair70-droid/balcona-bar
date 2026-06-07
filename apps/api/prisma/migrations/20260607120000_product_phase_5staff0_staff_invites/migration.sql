-- CreateEnum
CREATE TYPE "StaffInviteStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'staff_invite_created';
ALTER TYPE "AuditAction" ADD VALUE 'staff_invite_accepted';
ALTER TYPE "AuditAction" ADD VALUE 'staff_invite_revoked';

-- CreateTable
CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "staffUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "StaffRole" NOT NULL,
    "status" "StaffInviteStatus" NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByPlatformAdminId" TEXT,
    "createdByStaffUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffInvite_companyId_idx" ON "StaffInvite"("companyId");

-- CreateIndex
CREATE INDEX "StaffInvite_branchId_idx" ON "StaffInvite"("branchId");

-- CreateIndex
CREATE INDEX "StaffInvite_staffUserId_idx" ON "StaffInvite"("staffUserId");

-- CreateIndex
CREATE INDEX "StaffInvite_email_idx" ON "StaffInvite"("email");

-- CreateIndex
CREATE INDEX "StaffInvite_status_idx" ON "StaffInvite"("status");

-- CreateIndex
CREATE INDEX "StaffInvite_expiresAt_idx" ON "StaffInvite"("expiresAt");

-- CreateIndex
CREATE INDEX "StaffInvite_createdAt_idx" ON "StaffInvite"("createdAt");

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvite" ADD CONSTRAINT "StaffInvite_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
