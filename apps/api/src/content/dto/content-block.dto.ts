import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CONTENT_BLOCK_PLACEMENTS,
  CONTENT_BLOCK_STATUSES,
  KEY_PATTERN,
} from './content-values';

export class ListContentBlocksQueryDto {
  @IsOptional()
  @IsIn(CONTENT_BLOCK_PLACEMENTS)
  placement?: (typeof CONTENT_BLOCK_PLACEMENTS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsIn([...CONTENT_BLOCK_STATUSES, 'all'])
  status?: (typeof CONTENT_BLOCK_STATUSES)[number] | 'all';

  @IsOptional()
  @IsUUID()
  experienceProfileId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateContentBlockDto {
  @IsOptional()
  @IsUUID()
  experienceProfileId?: string | null;

  @IsIn(CONTENT_BLOCK_PLACEMENTS)
  placement!: (typeof CONTENT_BLOCK_PLACEMENTS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsIn(CONTENT_BLOCK_STATUSES)
  status?: (typeof CONTENT_BLOCK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ctaAction?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateContentBlockDto {
  @IsOptional()
  @IsUUID()
  experienceProfileId?: string | null;

  @IsOptional()
  @IsIn(CONTENT_BLOCK_PLACEMENTS)
  placement?: (typeof CONTENT_BLOCK_PLACEMENTS)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(KEY_PATTERN)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  language?: string;

  @IsOptional()
  @IsIn(CONTENT_BLOCK_STATUSES)
  status?: (typeof CONTENT_BLOCK_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ctaLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  ctaAction?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: unknown;
}
