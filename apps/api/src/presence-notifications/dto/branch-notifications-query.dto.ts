import { IsIn, IsOptional } from 'class-validator';

export const NOTIFICATION_STATUSES = [
  'pending',
  'sent',
  'failed',
  'read',
  'dismissed',
  'all',
] as const;

export const NOTIFICATION_KINDS = [
  'welcome',
  'order_submitted',
  'order_accepted',
  'order_rejected',
  'preparation_started',
  'preparation_ready',
  'waiter_call',
  'system',
  'all',
] as const;

export class BranchNotificationsQueryDto {
  @IsOptional()
  @IsIn(NOTIFICATION_STATUSES)
  status?: (typeof NOTIFICATION_STATUSES)[number];

  @IsOptional()
  @IsIn(NOTIFICATION_KINDS)
  kind?: (typeof NOTIFICATION_KINDS)[number];
}
