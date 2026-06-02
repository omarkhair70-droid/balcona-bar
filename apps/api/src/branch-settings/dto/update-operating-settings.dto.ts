import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';
import {
  BRANCH_OPERATING_MODES,
  BRANCH_SERVICE_MODES,
} from './branch-settings-values';

export class UpdateOperatingSettingsDto {
  @IsOptional()
  @IsIn(BRANCH_OPERATING_MODES)
  operatingMode?: (typeof BRANCH_OPERATING_MODES)[number];

  @IsOptional()
  @IsIn(BRANCH_SERVICE_MODES)
  serviceMode?: (typeof BRANCH_SERVICE_MODES)[number];

  @IsOptional()
  @IsBoolean()
  aiWaiterEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  waiterCallsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  smartCashierEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  realtimeEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  mediaExperienceEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  billFlowEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  tableAttentionEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  analyticsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  presenceTriggersEnabled?: boolean;

  @IsOptional()
  @IsObject()
  openingHours?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  serviceConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  attentionConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
