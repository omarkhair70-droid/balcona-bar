import { formatErrorMessage } from "@/lib/api/error-message";
import type {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryStockStatus,
  InventoryUnit
} from "@/lib/api/types";

export const inventoryUnits: InventoryUnit[] = [
  "piece",
  "gram",
  "milliliter"
];

export const inventoryItemStatuses: InventoryItemStatus[] = [
  "active",
  "inactive",
  "archived"
];

export const manualInventoryMovementTypes: Array<
  Extract<
    InventoryMovementType,
    "opening_balance" | "stock_in" | "stock_out" | "correction" | "waste"
  >
> = ["opening_balance", "stock_in", "stock_out", "correction", "waste"];

export function humanizeInventoryValue(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function inventoryStatusBadgeVariant(
  status: InventoryStockStatus
): "success" | "warning" | "danger" {
  if (status === "out_of_stock") {
    return "danger";
  }

  if (status === "low_stock") {
    return "warning";
  }

  return "success";
}

export function quantityToInput(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

export function inventoryInputToQuantity(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative whole number.`);
  }

  return parsed;
}

export function optionalInventoryInputToQuantity(
  value: string,
  label: string
) {
  return value.trim().length === 0
    ? null
    : inventoryInputToQuantity(value, label);
}

export function getInventoryErrorMessage(error: unknown) {
  return formatErrorMessage(
    error,
    "Inventory action failed. Check the values and try again."
  );
}
