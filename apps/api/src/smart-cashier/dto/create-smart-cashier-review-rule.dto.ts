import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export const SMART_CASHIER_RULE_SCOPES = [
  'branch',
  'menu_item',
  'category',
] as const;

export const MANUAL_REVIEW_REASON_CODES = [
  'smart_cashier_disabled',
  'branch_manual_only',
  'assisted_mode_requires_review',
  'cart_invalid',
  'branch_closed',
  'order_amount_too_high',
  'item_requires_review',
  'item_unavailable',
  'modifier_unavailable',
  'out_of_stock',
  'payment_required',
  'customer_note_present',
  'unknown',
] as const;

export class CreateSmartCashierReviewRuleDto {
  @IsIn(SMART_CASHIER_RULE_SCOPES)
  scope!: (typeof SMART_CASHIER_RULE_SCOPES)[number];

  @IsOptional()
  @IsUUID()
  menuItemId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsIn(MANUAL_REVIEW_REASON_CODES)
  reasonCode!: (typeof MANUAL_REVIEW_REASON_CODES)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
