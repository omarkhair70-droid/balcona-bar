import {
  MediaAssetStatus,
  MediaAssetType,
  MediaAssetUsageTarget,
  MediaStorageProvider,
} from '@prisma/client';

export const MEDIA_ASSET_TYPES = [
  MediaAssetType.image,
  MediaAssetType.video,
  MediaAssetType.icon,
  MediaAssetType.animation,
  MediaAssetType.document,
  MediaAssetType.audio,
  MediaAssetType.other,
] as const;

export const MEDIA_ASSET_STATUSES = [
  MediaAssetStatus.active,
  MediaAssetStatus.archived,
  MediaAssetStatus.deleted,
] as const;

export const MEDIA_STORAGE_PROVIDERS = [
  MediaStorageProvider.external_url,
  MediaStorageProvider.local_placeholder,
  MediaStorageProvider.supabase,
  MediaStorageProvider.cloudflare_r2,
  MediaStorageProvider.s3,
  MediaStorageProvider.other,
] as const;

export const MEDIA_USAGE_TARGETS = [
  MediaAssetUsageTarget.company,
  MediaAssetUsageTarget.branch,
  MediaAssetUsageTarget.menu_category,
  MediaAssetUsageTarget.menu_item,
  MediaAssetUsageTarget.modifier_group,
  MediaAssetUsageTarget.venue_zone,
  MediaAssetUsageTarget.experience_profile,
  MediaAssetUsageTarget.content_block,
  MediaAssetUsageTarget.notification_template,
  MediaAssetUsageTarget.ai_waiter,
  MediaAssetUsageTarget.other,
] as const;

export const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
