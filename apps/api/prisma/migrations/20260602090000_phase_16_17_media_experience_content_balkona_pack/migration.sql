-- CreateEnum
CREATE TYPE "VenueZoneStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('image', 'video', 'icon', 'animation', 'document', 'audio', 'other');

-- CreateEnum
CREATE TYPE "MediaAssetStatus" AS ENUM ('active', 'archived', 'deleted');

-- CreateEnum
CREATE TYPE "MediaStorageProvider" AS ENUM ('external_url', 'local_placeholder', 'supabase', 'cloudflare_r2', 's3', 'other');

-- CreateEnum
CREATE TYPE "MediaAssetUsageTarget" AS ENUM ('company', 'branch', 'menu_category', 'menu_item', 'modifier_group', 'venue_zone', 'experience_profile', 'content_block', 'notification_template', 'ai_waiter', 'other');

-- CreateEnum
CREATE TYPE "ExperienceProfileStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ExperienceProfileScope" AS ENUM ('company', 'branch');

-- CreateEnum
CREATE TYPE "ContentBlockStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "ContentBlockPlacement" AS ENUM ('customer_home', 'customer_welcome', 'menu_header', 'order_status', 'bill_flow', 'waiter_call', 'table_question', 'ai_waiter_intro', 'owner_dashboard', 'venue_zone', 'other');

-- AlterTable
ALTER TABLE "VenueZone" ADD COLUMN "status" "VenueZoneStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "type" "MediaAssetType" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'active',
    "provider" "MediaStorageProvider" NOT NULL DEFAULT 'external_url',
    "storageKey" TEXT,
    "publicUrl" TEXT,
    "originalUrl" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "title" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "dominantColor" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAssetUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "mediaAssetId" TEXT NOT NULL,
    "target" "MediaAssetUsageTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'default',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAssetUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperienceProfile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "scope" "ExperienceProfileScope" NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ExperienceProfileStatus" NOT NULL DEFAULT 'draft',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "theme" JSONB NOT NULL,
    "designTokens" JSONB NOT NULL,
    "motionTokens" JSONB,
    "layoutConfig" JSONB,
    "brandVoice" JSONB,
    "aiWaiterTone" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperienceProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBlock" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "experienceProfileId" TEXT,
    "placement" "ContentBlockPlacement" NOT NULL,
    "key" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "status" "ContentBlockStatus" NOT NULL DEFAULT 'active',
    "title" TEXT,
    "body" TEXT,
    "ctaLabel" TEXT,
    "ctaAction" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VenueZone_status_idx" ON "VenueZone"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_companyId_idx" ON "MediaAsset"("companyId");

-- CreateIndex
CREATE INDEX "MediaAsset_branchId_idx" ON "MediaAsset"("branchId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");

-- CreateIndex
CREATE INDEX "MediaAsset_provider_idx" ON "MediaAsset"("provider");

-- CreateIndex
CREATE INDEX "MediaAsset_createdAt_idx" ON "MediaAsset"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAssetUsage_target_targetId_role_mediaAssetId_key" ON "MediaAssetUsage"("target", "targetId", "role", "mediaAssetId");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_companyId_idx" ON "MediaAssetUsage"("companyId");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_branchId_idx" ON "MediaAssetUsage"("branchId");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_mediaAssetId_idx" ON "MediaAssetUsage"("mediaAssetId");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_target_targetId_idx" ON "MediaAssetUsage"("target", "targetId");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_target_targetId_role_idx" ON "MediaAssetUsage"("target", "targetId", "role");

-- CreateIndex
CREATE INDEX "MediaAssetUsage_sortOrder_idx" ON "MediaAssetUsage"("sortOrder");

-- CreateIndex
CREATE INDEX "ExperienceProfile_companyId_idx" ON "ExperienceProfile"("companyId");

-- CreateIndex
CREATE INDEX "ExperienceProfile_branchId_idx" ON "ExperienceProfile"("branchId");

-- CreateIndex
CREATE INDEX "ExperienceProfile_key_idx" ON "ExperienceProfile"("key");

-- CreateIndex
CREATE INDEX "ExperienceProfile_status_idx" ON "ExperienceProfile"("status");

-- CreateIndex
CREATE INDEX "ExperienceProfile_isDefault_idx" ON "ExperienceProfile"("isDefault");

-- CreateIndex
CREATE INDEX "ContentBlock_companyId_idx" ON "ContentBlock"("companyId");

-- CreateIndex
CREATE INDEX "ContentBlock_branchId_idx" ON "ContentBlock"("branchId");

-- CreateIndex
CREATE INDEX "ContentBlock_experienceProfileId_idx" ON "ContentBlock"("experienceProfileId");

-- CreateIndex
CREATE INDEX "ContentBlock_placement_idx" ON "ContentBlock"("placement");

-- CreateIndex
CREATE INDEX "ContentBlock_key_idx" ON "ContentBlock"("key");

-- CreateIndex
CREATE INDEX "ContentBlock_language_idx" ON "ContentBlock"("language");

-- CreateIndex
CREATE INDEX "ContentBlock_status_idx" ON "ContentBlock"("status");

-- CreateIndex
CREATE INDEX "ContentBlock_sortOrder_idx" ON "ContentBlock"("sortOrder");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetUsage" ADD CONSTRAINT "MediaAssetUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetUsage" ADD CONSTRAINT "MediaAssetUsage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetUsage" ADD CONSTRAINT "MediaAssetUsage_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceProfile" ADD CONSTRAINT "ExperienceProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperienceProfile" ADD CONSTRAINT "ExperienceProfile_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBlock" ADD CONSTRAINT "ContentBlock_experienceProfileId_fkey" FOREIGN KEY ("experienceProfileId") REFERENCES "ExperienceProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
