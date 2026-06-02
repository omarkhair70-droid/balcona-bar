import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { AI_WAITER_ESCALATION_REASONS } from "./ai-waiter-values";

export class EscalateAiWaiterDto {
  @IsIn(AI_WAITER_ESCALATION_REASONS)
  reason!: (typeof AI_WAITER_ESCALATION_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
