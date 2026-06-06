import { IsIn, IsOptional, IsString } from "class-validator";
import {
  PLATFORM_PLAN_CODES,
  PLATFORM_SUBSCRIPTION_STATUSES,
} from "./bootstrap-platform-company.dto";

export class UpdatePlatformSubscriptionDto {
  @IsOptional()
  @IsIn(PLATFORM_PLAN_CODES)
  planCode?: (typeof PLATFORM_PLAN_CODES)[number];

  @IsOptional()
  @IsIn(PLATFORM_SUBSCRIPTION_STATUSES)
  status?: (typeof PLATFORM_SUBSCRIPTION_STATUSES)[number];

  @IsOptional()
  @IsString()
  cancellationReason?: string | null;
}
