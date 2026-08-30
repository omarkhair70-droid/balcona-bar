CREATE TYPE "DemoRequestStatus" AS ENUM ('new', 'contacted', 'qualified', 'closed');

CREATE TABLE "DemoRequest" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "city" TEXT,
    "locationCount" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "consent" BOOLEAN NOT NULL,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "status" "DemoRequestStatus" NOT NULL DEFAULT 'new',
    "internalNotes" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DemoRequest_status_createdAt_idx" ON "DemoRequest"("status", "createdAt");
CREATE INDEX "DemoRequest_email_idx" ON "DemoRequest"("email");
CREATE INDEX "DemoRequest_businessName_idx" ON "DemoRequest"("businessName");
