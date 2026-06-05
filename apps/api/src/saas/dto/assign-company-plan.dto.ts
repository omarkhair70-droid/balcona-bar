import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const ASSIGNABLE_COMPANY_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled",
] as const;

export class AssignCompanyPlanDto {
  @IsString()
  @MaxLength(80)
  planCode!: string;

  @IsOptional()
  @IsIn(ASSIGNABLE_COMPANY_SUBSCRIPTION_STATUSES)
  status?: (typeof ASSIGNABLE_COMPANY_SUBSCRIPTION_STATUSES)[number];
}
