import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { AI_WAITER_SESSION_STATUS_FILTERS } from "./ai-waiter-values";

export class ListAiWaiterSessionsQueryDto {
  @IsOptional()
  @IsIn(AI_WAITER_SESSION_STATUS_FILTERS)
  status?: (typeof AI_WAITER_SESSION_STATUS_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
