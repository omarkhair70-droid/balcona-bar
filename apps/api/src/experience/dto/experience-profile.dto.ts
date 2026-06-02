import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EXPERIENCE_PROFILE_STATUSES, KEY_PATTERN } from './experience-values';

export class ListExperienceProfilesQueryDto {
  @IsOptional()
  @IsIn([...EXPERIENCE_PROFILE_STATUSES, 'all'])
  status?: (typeof EXPERIENCE_PROFILE_STATUSES)[number] | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateExperienceProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsIn(EXPERIENCE_PROFILE_STATUSES)
  status?: (typeof EXPERIENCE_PROFILE_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsNotEmpty()
  theme!: unknown;

  @IsNotEmpty()
  designTokens!: unknown;

  @IsOptional()
  motionTokens?: unknown;

  @IsOptional()
  layoutConfig?: unknown;

  @IsOptional()
  brandVoice?: unknown;

  @IsOptional()
  aiWaiterTone?: unknown;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateExperienceProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsIn(EXPERIENCE_PROFILE_STATUSES)
  status?: (typeof EXPERIENCE_PROFILE_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  theme?: unknown;

  @IsOptional()
  designTokens?: unknown;

  @IsOptional()
  motionTokens?: unknown;

  @IsOptional()
  layoutConfig?: unknown;

  @IsOptional()
  brandVoice?: unknown;

  @IsOptional()
  aiWaiterTone?: unknown;

  @IsOptional()
  metadata?: unknown;
}
