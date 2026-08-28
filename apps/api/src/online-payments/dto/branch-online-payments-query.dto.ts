import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export const ONLINE_PAYMENT_QUERY_STATUSES = [
  "all",
  "active",
  "pending",
  "requires_action",
  "succeeded",
  "failed",
  "cancelled",
  "expired",
] as const;

export const ONLINE_PAYMENT_QUERY_PROVIDERS = [
  "all",
  "mock",
  "paymob",
  "fawry",
  "external",
] as const;

export class BranchOnlinePaymentsQueryDto {
  @IsOptional()
  @IsIn(ONLINE_PAYMENT_QUERY_STATUSES)
  status?: (typeof ONLINE_PAYMENT_QUERY_STATUSES)[number];

  @IsOptional()
  @IsIn(ONLINE_PAYMENT_QUERY_PROVIDERS)
  provider?: (typeof ONLINE_PAYMENT_QUERY_PROVIDERS)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
