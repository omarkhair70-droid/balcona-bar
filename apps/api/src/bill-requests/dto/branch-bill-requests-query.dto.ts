import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export const BRANCH_BILL_REQUEST_STATUS_FILTERS = [
  'open',
  'acknowledged',
  'presented',
  'closed',
  'cancelled',
  'active',
  'all',
] as const;

export class BranchBillRequestsQueryDto {
  @IsOptional()
  @IsIn(BRANCH_BILL_REQUEST_STATUS_FILTERS)
  status?: (typeof BRANCH_BILL_REQUEST_STATUS_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
