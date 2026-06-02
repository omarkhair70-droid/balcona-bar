import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  MANUAL_REVIEW_REASON_CODES,
  SMART_CASHIER_RULE_SCOPES,
} from './create-smart-cashier-review-rule.dto';

export class UpdateSmartCashierReviewRuleDto {
  @IsOptional()
  @IsIn(SMART_CASHIER_RULE_SCOPES)
  scope?: (typeof SMART_CASHIER_RULE_SCOPES)[number];

  @IsOptional()
  @IsUUID()
  menuItemId?: string | null;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @IsIn(MANUAL_REVIEW_REASON_CODES)
  reasonCode?: (typeof MANUAL_REVIEW_REASON_CODES)[number];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
