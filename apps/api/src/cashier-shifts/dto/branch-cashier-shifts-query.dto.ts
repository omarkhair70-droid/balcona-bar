import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const CASHIER_SHIFT_STATUS_FILTERS = ['open', 'closed', 'all'] as const;

export class BranchCashierShiftsQueryDto {
  @IsOptional()
  @IsIn(CASHIER_SHIFT_STATUS_FILTERS)
  status?: (typeof CASHIER_SHIFT_STATUS_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
