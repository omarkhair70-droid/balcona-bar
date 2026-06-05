import { IsIn, IsISO8601, IsOptional } from 'class-validator';

export const ownerAnalyticsPresets = [
  'today',
  'last_7_days',
  'last_30_days',
] as const;

export type OwnerAnalyticsPreset = (typeof ownerAnalyticsPresets)[number];

export class OwnerAnalyticsQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(ownerAnalyticsPresets)
  preset?: OwnerAnalyticsPreset;
}
