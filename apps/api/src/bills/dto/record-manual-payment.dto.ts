import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const MANUAL_PAYMENT_METHODS = [
  'cash',
  'card_pos',
  'wallet_manual',
  'other',
] as const;

export class RecordManualPaymentDto {
  @IsIn(MANUAL_PAYMENT_METHODS)
  method!: (typeof MANUAL_PAYMENT_METHODS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
