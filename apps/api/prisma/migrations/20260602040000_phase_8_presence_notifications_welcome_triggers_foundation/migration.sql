-- CreateEnum
CREATE TYPE "PresenceTriggerType" AS ENUM ('qr_session_started', 'qr_session_resumed', 'wifi_portal_entered', 'beacon_detected', 'geofence_entered', 'app_opened_near_venue', 'manual_staff_trigger');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('in_app', 'web_push', 'whatsapp', 'sms', 'wifi_portal', 'beacon', 'geofence');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('welcome', 'order_submitted', 'order_accepted', 'order_rejected', 'preparation_started', 'preparation_ready', 'waiter_call', 'system');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('pending', 'sent', 'failed', 'read', 'dismissed');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('pending', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "DeviceSubscriptionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "VenueZoneType" AS ENUM ('branch', 'entrance', 'seating_area', 'cashier', 'kitchen', 'outdoor', 'custom');

-- CreateTable
CREATE TABLE "VenueZone" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "VenueZoneType" NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerSessionIdentity" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "displayName" TEXT,
    "phone" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ar-EG',
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "notificationsOptIn" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSessionIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSubscription" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "customerSessionIdentityId" TEXT,
    "tableSessionId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "DeviceSubscriptionStatus" NOT NULL DEFAULT 'active',
    "endpoint" TEXT,
    "token" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "venueZoneId" TEXT,
    "customerSessionIdentityId" TEXT,
    "deviceSubscriptionId" TEXT,
    "triggerType" "PresenceTriggerType" NOT NULL,
    "sourceChannel" "NotificationChannel",
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "key" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'ar-EG',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableSessionId" TEXT,
    "customerSessionIdentityId" TEXT,
    "orderId" TEXT,
    "preparationTaskId" TEXT,
    "templateId" TEXT,
    "presenceEventId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "deviceSubscriptionId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
    "externalMessageId" TEXT,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueZone_branchId_slug_key" ON "VenueZone"("branchId", "slug");

-- CreateIndex
CREATE INDEX "VenueZone_companyId_idx" ON "VenueZone"("companyId");

-- CreateIndex
CREATE INDEX "VenueZone_branchId_idx" ON "VenueZone"("branchId");

-- CreateIndex
CREATE INDEX "VenueZone_type_idx" ON "VenueZone"("type");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_companyId_idx" ON "CustomerSessionIdentity"("companyId");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_branchId_idx" ON "CustomerSessionIdentity"("branchId");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_tableSessionId_idx" ON "CustomerSessionIdentity"("tableSessionId");

-- CreateIndex
CREATE INDEX "CustomerSessionIdentity_phone_idx" ON "CustomerSessionIdentity"("phone");

-- CreateIndex
CREATE INDEX "DeviceSubscription_companyId_idx" ON "DeviceSubscription"("companyId");

-- CreateIndex
CREATE INDEX "DeviceSubscription_branchId_idx" ON "DeviceSubscription"("branchId");

-- CreateIndex
CREATE INDEX "DeviceSubscription_customerSessionIdentityId_idx" ON "DeviceSubscription"("customerSessionIdentityId");

-- CreateIndex
CREATE INDEX "DeviceSubscription_tableSessionId_idx" ON "DeviceSubscription"("tableSessionId");

-- CreateIndex
CREATE INDEX "DeviceSubscription_channel_idx" ON "DeviceSubscription"("channel");

-- CreateIndex
CREATE INDEX "DeviceSubscription_status_idx" ON "DeviceSubscription"("status");

-- CreateIndex
CREATE INDEX "PresenceEvent_companyId_idx" ON "PresenceEvent"("companyId");

-- CreateIndex
CREATE INDEX "PresenceEvent_branchId_idx" ON "PresenceEvent"("branchId");

-- CreateIndex
CREATE INDEX "PresenceEvent_tableSessionId_idx" ON "PresenceEvent"("tableSessionId");

-- CreateIndex
CREATE INDEX "PresenceEvent_triggerType_idx" ON "PresenceEvent"("triggerType");

-- CreateIndex
CREATE INDEX "PresenceEvent_occurredAt_idx" ON "PresenceEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "PresenceEvent_venueZoneId_idx" ON "PresenceEvent"("venueZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationTemplate_scope_key" ON "NotificationTemplate"("companyId", "branchId", "key", "channel", "language");

-- CreateIndex
CREATE INDEX "NotificationTemplate_companyId_idx" ON "NotificationTemplate"("companyId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_branchId_idx" ON "NotificationTemplate"("branchId");

-- CreateIndex
CREATE INDEX "NotificationTemplate_kind_idx" ON "NotificationTemplate"("kind");

-- CreateIndex
CREATE INDEX "NotificationTemplate_channel_idx" ON "NotificationTemplate"("channel");

-- CreateIndex
CREATE INDEX "NotificationTemplate_isActive_idx" ON "NotificationTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_companyId_idx" ON "Notification"("companyId");

-- CreateIndex
CREATE INDEX "Notification_branchId_idx" ON "Notification"("branchId");

-- CreateIndex
CREATE INDEX "Notification_tableSessionId_idx" ON "Notification"("tableSessionId");

-- CreateIndex
CREATE INDEX "Notification_customerSessionIdentityId_idx" ON "Notification"("customerSessionIdentityId");

-- CreateIndex
CREATE INDEX "Notification_kind_idx" ON "Notification"("kind");

-- CreateIndex
CREATE INDEX "Notification_channel_idx" ON "Notification"("channel");

-- CreateIndex
CREATE INDEX "Notification_status_idx" ON "Notification"("status");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_orderId_idx" ON "Notification"("orderId");

-- CreateIndex
CREATE INDEX "Notification_preparationTaskId_idx" ON "Notification"("preparationTaskId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_deviceSubscriptionId_idx" ON "NotificationDelivery"("deviceSubscriptionId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_channel_idx" ON "NotificationDelivery"("channel");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE INDEX "NotificationDelivery_createdAt_idx" ON "NotificationDelivery"("createdAt");

-- AddForeignKey
ALTER TABLE "VenueZone" ADD CONSTRAINT "VenueZone_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueZone" ADD CONSTRAINT "VenueZone_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSessionIdentity" ADD CONSTRAINT "CustomerSessionIdentity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSessionIdentity" ADD CONSTRAINT "CustomerSessionIdentity_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSessionIdentity" ADD CONSTRAINT "CustomerSessionIdentity_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSubscription" ADD CONSTRAINT "DeviceSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSubscription" ADD CONSTRAINT "DeviceSubscription_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSubscription" ADD CONSTRAINT "DeviceSubscription_customerSessionIdentityId_fkey" FOREIGN KEY ("customerSessionIdentityId") REFERENCES "CustomerSessionIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSubscription" ADD CONSTRAINT "DeviceSubscription_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_venueZoneId_fkey" FOREIGN KEY ("venueZoneId") REFERENCES "VenueZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_customerSessionIdentityId_fkey" FOREIGN KEY ("customerSessionIdentityId") REFERENCES "CustomerSessionIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceEvent" ADD CONSTRAINT "PresenceEvent_deviceSubscriptionId_fkey" FOREIGN KEY ("deviceSubscriptionId") REFERENCES "DeviceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationTemplate" ADD CONSTRAINT "NotificationTemplate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_customerSessionIdentityId_fkey" FOREIGN KEY ("customerSessionIdentityId") REFERENCES "CustomerSessionIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_preparationTaskId_fkey" FOREIGN KEY ("preparationTaskId") REFERENCES "PreparationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "NotificationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_presenceEventId_fkey" FOREIGN KEY ("presenceEventId") REFERENCES "PresenceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_deviceSubscriptionId_fkey" FOREIGN KEY ("deviceSubscriptionId") REFERENCES "DeviceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
