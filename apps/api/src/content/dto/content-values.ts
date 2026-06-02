import {
  ContentBlockPlacement,
  ContentBlockStatus,
  NotificationChannel,
  NotificationKind,
} from '@prisma/client';

export const CONTENT_BLOCK_PLACEMENTS = [
  ContentBlockPlacement.customer_home,
  ContentBlockPlacement.customer_welcome,
  ContentBlockPlacement.menu_header,
  ContentBlockPlacement.order_status,
  ContentBlockPlacement.bill_flow,
  ContentBlockPlacement.waiter_call,
  ContentBlockPlacement.table_question,
  ContentBlockPlacement.ai_waiter_intro,
  ContentBlockPlacement.owner_dashboard,
  ContentBlockPlacement.venue_zone,
  ContentBlockPlacement.other,
] as const;

export const CONTENT_BLOCK_STATUSES = [
  ContentBlockStatus.active,
  ContentBlockStatus.inactive,
  ContentBlockStatus.archived,
] as const;

export const NOTIFICATION_KINDS = [
  NotificationKind.welcome,
  NotificationKind.order_submitted,
  NotificationKind.order_accepted,
  NotificationKind.order_rejected,
  NotificationKind.preparation_started,
  NotificationKind.preparation_ready,
  NotificationKind.order_served,
  NotificationKind.bill_requested,
  NotificationKind.bill_presented,
  NotificationKind.bill_closed,
  NotificationKind.waiter_call,
  NotificationKind.system,
] as const;

export const NOTIFICATION_CHANNELS = [
  NotificationChannel.in_app,
  NotificationChannel.web_push,
  NotificationChannel.whatsapp,
  NotificationChannel.sms,
  NotificationChannel.wifi_portal,
  NotificationChannel.beacon,
  NotificationChannel.geofence,
] as const;

export const KEY_PATTERN = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
