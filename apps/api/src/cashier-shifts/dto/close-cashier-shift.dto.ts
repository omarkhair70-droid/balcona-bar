import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CloseCashierShiftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  countedCashMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
