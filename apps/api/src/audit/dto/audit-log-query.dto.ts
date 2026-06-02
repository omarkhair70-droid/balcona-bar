import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AUDIT_ACTIONS, AUDIT_ACTOR_TYPES } from './audit-values';

export class AuditLogQueryDto {
  @IsOptional()
  @IsIn(AUDIT_ACTIONS)
  action?: (typeof AUDIT_ACTIONS)[number];

  @IsOptional()
  @IsIn(AUDIT_ACTOR_TYPES)
  actorType?: (typeof AUDIT_ACTOR_TYPES)[number];

  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsUUID()
  tableSessionId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
