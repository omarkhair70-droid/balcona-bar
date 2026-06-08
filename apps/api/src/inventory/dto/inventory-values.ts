import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryUnit,
  PurchaseOrderStatus,
  SupplierStatus,
} from '@prisma/client';

export const INVENTORY_UNITS = [
  InventoryUnit.piece,
  InventoryUnit.gram,
  InventoryUnit.milliliter,
] as const;

export const INVENTORY_ITEM_STATUSES = [
  InventoryItemStatus.active,
  InventoryItemStatus.inactive,
  InventoryItemStatus.archived,
] as const;

export const MANUAL_INVENTORY_MOVEMENT_TYPES = [
  InventoryMovementType.opening_balance,
  InventoryMovementType.stock_in,
  InventoryMovementType.stock_out,
  InventoryMovementType.correction,
  InventoryMovementType.waste,
] as const;

export const SUPPLIER_STATUSES = [
  SupplierStatus.active,
  SupplierStatus.inactive,
  SupplierStatus.archived,
] as const;

export const PURCHASE_ORDER_STATUSES = [
  PurchaseOrderStatus.draft,
  PurchaseOrderStatus.submitted,
  PurchaseOrderStatus.partially_received,
  PurchaseOrderStatus.received,
  PurchaseOrderStatus.cancelled,
] as const;
