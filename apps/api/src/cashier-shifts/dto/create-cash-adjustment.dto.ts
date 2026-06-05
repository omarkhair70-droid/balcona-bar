import { Type } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export const CASH_ADJUSTMENT_TYPES = [
  'cash_in',
  'cash_out',
  'correction',
] as const;

export class CreateCashAdjustmentDto {
  @IsIn(CASH_ADJUSTMENT_TYPES)
  type!: (typeof CASH_ADJUSTMENT_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(-10_000_000)
  @Max(10_000_000)
  amountMinor!: number;

  @IsString()
  @MaxLength(500)
  note!: string;
}
