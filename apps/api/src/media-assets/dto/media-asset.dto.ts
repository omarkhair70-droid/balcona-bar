import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HEX_COLOR_PATTERN,
  MEDIA_ASSET_STATUSES,
  MEDIA_ASSET_TYPES,
  MEDIA_USAGE_TARGETS,
  MEDIA_STORAGE_PROVIDERS,
} from './media-values';

export class ListMediaAssetsQueryDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsIn(MEDIA_ASSET_TYPES)
  type?: (typeof MEDIA_ASSET_TYPES)[number];

  @IsOptional()
  @IsIn([...MEDIA_ASSET_STATUSES, 'all'])
  status?: (typeof MEDIA_ASSET_STATUSES)[number] | 'all';

  @IsOptional()
  @IsIn(MEDIA_STORAGE_PROVIDERS)
  provider?: (typeof MEDIA_STORAGE_PROVIDERS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class CreateMediaAssetDto {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsIn(MEDIA_ASSET_TYPES)
  type!: (typeof MEDIA_ASSET_TYPES)[number];

  @IsOptional()
  @IsIn(MEDIA_STORAGE_PROVIDERS)
  provider?: (typeof MEDIA_STORAGE_PROVIDERS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  publicUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  originalUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  width?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  height?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string | null;

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN)
  dominantColor?: string | null;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateMediaAssetDto {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn(MEDIA_ASSET_TYPES)
  type?: (typeof MEDIA_ASSET_TYPES)[number];

  @IsOptional()
  @IsIn(MEDIA_ASSET_STATUSES)
  status?: (typeof MEDIA_ASSET_STATUSES)[number];

  @IsOptional()
  @IsIn(MEDIA_STORAGE_PROVIDERS)
  provider?: (typeof MEDIA_STORAGE_PROVIDERS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageKey?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  publicUrl?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  originalUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  mimeType?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sizeBytes?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  width?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  height?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationSeconds?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string | null;

  @IsOptional()
  @Matches(HEX_COLOR_PATTERN)
  dominantColor?: string | null;

  @IsOptional()
  metadata?: unknown;
}

export class CreateMediaUsageDto {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsIn(MEDIA_USAGE_TARGETS)
  target!: (typeof MEDIA_USAGE_TARGETS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateMediaUsageDto {
  @IsOptional()
  @IsUUID()
  branchId?: string | null;

  @IsOptional()
  @IsIn(MEDIA_USAGE_TARGETS)
  target?: (typeof MEDIA_USAGE_TARGETS)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  metadata?: unknown;
}

export class ListMediaUsagesQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsOptional()
  @IsIn(MEDIA_USAGE_TARGETS)
  target?: (typeof MEDIA_USAGE_TARGETS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  targetId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  role?: string;
}
