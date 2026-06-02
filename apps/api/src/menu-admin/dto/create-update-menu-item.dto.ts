import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MENU_ITEM_STATUSES,
  PREPARATION_STATIONS,
  SLUG_PATTERN,
} from './menu-admin-values';

export class CreateMenuItemDto {
  @IsUUID()
  categoryId!: string;

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
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  imageUrl?: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePriceMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsIn(PREPARATION_STATIONS)
  station!: (typeof PREPARATION_STATIONS)[number];

  @IsOptional()
  @IsIn(MENU_ITEM_STATUSES)
  status?: (typeof MENU_ITEM_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateMenuItemDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

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
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUrl()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  basePriceMinor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsIn(PREPARATION_STATIONS)
  station?: (typeof PREPARATION_STATIONS)[number];

  @IsOptional()
  @IsIn(MENU_ITEM_STATUSES)
  status?: (typeof MENU_ITEM_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
