import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export const SMART_CASHIER_MODES = [
  'manual_only',
  'assisted',
  'auto_accept_safe_orders',
] as const;

export class UpsertBranchSmartCashierSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(SMART_CASHIER_MODES)
  mode?: (typeof SMART_CASHIER_MODES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxAutoAcceptSubtotalMinor?: number | null;

  @IsOptional()
  @IsBoolean()
  requirePaymentBeforeAutoAccept?: boolean;

  @IsOptional()
  @IsBoolean()
  reviewCustomerNotes?: boolean;
}
