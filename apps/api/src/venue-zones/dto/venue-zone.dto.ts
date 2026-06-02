import { Type } from 'class-transformer';
import {
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
import {
  SLUG_PATTERN,
  VENUE_ZONE_STATUSES,
  VENUE_ZONE_TYPES,
} from './venue-zone-values';

export class ListVenueZonesQueryDto {
  @IsOptional()
  @IsIn(VENUE_ZONE_TYPES)
  type?: (typeof VENUE_ZONE_TYPES)[number];

  @IsOptional()
  @IsIn([...VENUE_ZONE_STATUSES, 'all'])
  status?: (typeof VENUE_ZONE_STATUSES)[number] | 'all';

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

export class CreateVenueZoneDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsIn(VENUE_ZONE_TYPES)
  type!: (typeof VENUE_ZONE_TYPES)[number];

  @IsOptional()
  @IsIn(VENUE_ZONE_STATUSES)
  status?: (typeof VENUE_ZONE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  metadata?: unknown;
}

export class UpdateVenueZoneDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug?: string;

  @IsOptional()
  @IsIn(VENUE_ZONE_TYPES)
  type?: (typeof VENUE_ZONE_TYPES)[number];

  @IsOptional()
  @IsIn(VENUE_ZONE_STATUSES)
  status?: (typeof VENUE_ZONE_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  metadata?: unknown;
}
