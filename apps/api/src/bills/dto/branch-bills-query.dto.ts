import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const BRANCH_BILL_STATUS_FILTERS = [
  'draft',
  'requested',
  'presented',
  'payment_pending',
  'paid',
  'cancelled',
  'closed',
  'active',
  'all',
] as const;

export class BranchBillsQueryDto {
  @IsOptional()
  @IsIn(BRANCH_BILL_STATUS_FILTERS)
  status?: (typeof BRANCH_BILL_STATUS_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
