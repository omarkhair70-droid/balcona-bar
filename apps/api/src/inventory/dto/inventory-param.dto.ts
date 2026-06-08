import { IsNotEmpty, IsUUID } from 'class-validator';

export class CompanyIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  companyId!: string;
}

export class BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  branchId!: string;
}

export class InventoryItemIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;
}

export class SupplierIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;
}

export class PurchaseOrderIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderId!: string;
}

export class PurchaseOrderLineIdParamDto extends PurchaseOrderIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  purchaseOrderLineId!: string;
}

export class BranchInventoryItemParamDto extends BranchIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  inventoryItemId!: string;
}

export class MenuItemIdParamDto {
  @IsUUID()
  @IsNotEmpty()
  menuItemId!: string;
}
