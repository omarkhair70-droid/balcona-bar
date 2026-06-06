-- CreateEnum
CREATE TYPE "PlatformAdminStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "PlatformAdminRole" AS ENUM ('owner', 'admin', 'support');

-- CreateEnum
CREATE TYPE "PlatformAdminSessionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "PlatformAdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "PlatformAdminRole" NOT NULL DEFAULT 'admin',
    "status" "PlatformAdminStatus" NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAdminSession" (
    "id" TEXT NOT NULL,
    "platformAdminUserId" TEXT NOT NULL,
    "status" "PlatformAdminSessionStatus" NOT NULL DEFAULT 'active',
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformAuditEvent" (
    "id" TEXT NOT NULL,
    "platformAdminUserId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdminUser_email_key" ON "PlatformAdminUser"("email");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_email_idx" ON "PlatformAdminUser"("email");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_role_idx" ON "PlatformAdminUser"("role");

-- CreateIndex
CREATE INDEX "PlatformAdminUser_status_idx" ON "PlatformAdminUser"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformAdminSession_tokenHash_key" ON "PlatformAdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformAdminSession_platformAdminUserId_idx" ON "PlatformAdminSession"("platformAdminUserId");

-- CreateIndex
CREATE INDEX "PlatformAdminSession_status_idx" ON "PlatformAdminSession"("status");

-- CreateIndex
CREATE INDEX "PlatformAdminSession_expiresAt_idx" ON "PlatformAdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "PlatformAdminSession_createdAt_idx" ON "PlatformAdminSession"("createdAt");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_platformAdminUserId_idx" ON "PlatformAuditEvent"("platformAdminUserId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_action_idx" ON "PlatformAuditEvent"("action");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_targetType_targetId_idx" ON "PlatformAuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "PlatformAuditEvent_createdAt_idx" ON "PlatformAuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformAdminSession" ADD CONSTRAINT "PlatformAdminSession_platformAdminUserId_fkey" FOREIGN KEY ("platformAdminUserId") REFERENCES "PlatformAdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformAuditEvent" ADD CONSTRAINT "PlatformAuditEvent_platformAdminUserId_fkey" FOREIGN KEY ("platformAdminUserId") REFERENCES "PlatformAdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
