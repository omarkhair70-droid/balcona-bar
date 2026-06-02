import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { MODIFIER_OPTION_STATUSES, SLUG_PATTERN } from './menu-admin-values';

export class CreateModifierOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceDeltaMinor?: number;

  @IsOptional()
  @IsIn(MODIFIER_OPTION_STATUSES)
  status?: (typeof MODIFIER_OPTION_STATUSES)[number];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateModifierOptionDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceDeltaMinor?: number;

  @IsOptional()
  @IsIn(MODIFIER_OPTION_STATUSES)
  status?: (typeof MODIFIER_OPTION_STATUSES)[number];

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
