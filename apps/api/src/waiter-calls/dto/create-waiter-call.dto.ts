import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WAITER_CALL_TYPES } from './waiter-call-values';

export class CreateWaiterCallDto {
  @IsIn(WAITER_CALL_TYPES)
  type!: (typeof WAITER_CALL_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(5)
  priority?: number;
}
