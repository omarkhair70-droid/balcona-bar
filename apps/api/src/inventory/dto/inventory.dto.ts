import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
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
  SUPPLIER_STATUSES,
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

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: (typeof SUPPLIER_STATUSES)[number];
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contact?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  taxId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsIn(SUPPLIER_STATUSES)
  status?: (typeof SUPPLIER_STATUSES)[number];
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
}

export class UpdatePurchaseOrderDto {
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsDateString()
  expectedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

}

export class CreatePurchaseOrderLineDto {
  @IsUUID()
  inventoryItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantityOrdered!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitCostMinor!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePurchaseOrderLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantityOrdered?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitCostMinor?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ReceivePurchaseOrderLineDto {
  @IsUUID()
  purchaseOrderLineId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantityReceived!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  unitCostMinor?: number | null;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderLineDto)
  lines!: ReceivePurchaseOrderLineDto[];

  @IsOptional()
  @IsDateString()
  receivedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
