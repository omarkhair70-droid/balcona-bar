import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  TABLE_ATTENTION_PRIORITY_FILTERS,
  TABLE_ATTENTION_STATUS_FILTERS,
} from './attention-values';

export class AttentionQueryDto {
  @IsOptional()
  @IsIn(TABLE_ATTENTION_STATUS_FILTERS)
  status?: (typeof TABLE_ATTENTION_STATUS_FILTERS)[number];

  @IsOptional()
  @IsIn(TABLE_ATTENTION_PRIORITY_FILTERS)
  priority?: (typeof TABLE_ATTENTION_PRIORITY_FILTERS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

