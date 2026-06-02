import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export const PRESENCE_TRIGGER_TYPES = [
  'qr_session_started',
  'qr_session_resumed',
  'wifi_portal_entered',
  'beacon_detected',
  'geofence_entered',
  'app_opened_near_venue',
  'manual_staff_trigger',
] as const;

export const NOTIFICATION_CHANNELS = [
  'in_app',
  'web_push',
  'whatsapp',
  'sms',
  'wifi_portal',
  'beacon',
  'geofence',
] as const;

export class CreatePresenceEventDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;

  @IsIn(PRESENCE_TRIGGER_TYPES)
  triggerType!: (typeof PRESENCE_TRIGGER_TYPES)[number];

  @IsOptional()
  @IsUUID()
  tableSessionId?: string;

  @IsOptional()
  @IsUUID()
  venueZoneId?: string;

  @IsOptional()
  @IsUUID()
  customerSessionIdentityId?: string;

  @IsOptional()
  @IsUUID()
  deviceSubscriptionId?: string;

  @IsOptional()
  @IsIn(NOTIFICATION_CHANNELS)
  sourceChannel?: (typeof NOTIFICATION_CHANNELS)[number];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
