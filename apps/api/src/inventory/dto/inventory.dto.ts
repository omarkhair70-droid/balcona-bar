import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  INVENTORY_ITEM_STATUSES,
  INVENTORY_UNITS,
  MANUAL_INVENTORY_MOVEMENT_TYPES,
} from './inventory-values';

export class CreateInventoryItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsIn(INVENTORY_UNITS)
  unit!: (typeof INVENTORY_UNITS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  lowStockThresholdQuantity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  parLevelQuantity?: number | null;
}

export class UpdateInventoryItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  sku?: string | null;

  @IsOptional()
  @IsIn(INVENTORY_ITEM_STATUSES)
  status?: (typeof INVENTORY_ITEM_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  lowStockThresholdQuantity?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  parLevelQuantity?: number | null;
}

export class AdjustInventoryLevelDto {
  @IsIn(MANUAL_INVENTORY_MOVEMENT_TYPES)
  type!: (typeof MANUAL_INVENTORY_MOVEMENT_TYPES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  finalQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}

export class MenuItemInventoryRequirementDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantityRequired!: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class ReplaceMenuItemInventoryRequirementsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => MenuItemInventoryRequirementDto)
  requirements!: MenuItemInventoryRequirementDto[];
}
