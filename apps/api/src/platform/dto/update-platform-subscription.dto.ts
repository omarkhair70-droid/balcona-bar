import { IsIn, IsOptional, IsString } from "class-validator";
import { PLATFORM_PLAN_CODES } from "./bootstrap-platform-company.dto";

export const PLATFORM_SUBSCRIPTION_UPDATE_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;

export class UpdatePlatformSubscriptionDto {
  @IsOptional()
  @IsIn(PLATFORM_PLAN_CODES)
  planCode?: (typeof PLATFORM_PLAN_CODES)[number];

  @IsOptional()
  @IsIn(PLATFORM_SUBSCRIPTION_UPDATE_STATUSES)
  status?: (typeof PLATFORM_SUBSCRIPTION_UPDATE_STATUSES)[number];

  @IsOptional()
  @IsString()
  cancellationReason?: string | null;
}
