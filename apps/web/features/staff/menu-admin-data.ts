import type {
  MenuAdminCategoryStatus,
  MenuAdminItemStatus,
  MenuAdminPreparationStation,
  MenuAdminSelectionType
} from "@/lib/api/types";

export const menuAdminTabs = [
  { id: "categories", label: "Categories" },
  { id: "items", label: "Items" },
  { id: "availability", label: "Availability" },
  { id: "modifiers", label: "Modifiers" },
  { id: "preview", label: "Preview Issues" }
] as const;

export type MenuAdminTab = (typeof menuAdminTabs)[number]["id"];

export const menuCategoryStatuses: MenuAdminCategoryStatus[] = [
  "active",
  "inactive"
];

export const menuItemStatuses: MenuAdminItemStatus[] = [
  "active",
  "inactive",
  "archived"
];

export const modifierStatuses = ["active", "inactive"] as const;

export const menuPreparationStations: MenuAdminPreparationStation[] = [
  "barista",
  "kitchen",
  "dessert",
  "cashier"
];

export const modifierSelectionTypes: MenuAdminSelectionType[] = [
  "single",
  "multiple"
];

export function slugifyMenuAdminValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatMenuMoney(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(minor / 100);
}

export function minorToMenuInput(minor?: number | null) {
  return minor === null || minor === undefined ? "" : (minor / 100).toFixed(2);
}

export function menuInputToMinor(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

export function optionalMenuInputToMinor(value: string) {
  return value.trim() === "" ? null : menuInputToMinor(value);
}

export function menuInputToInteger(value: string, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

export function humanizeMenuAdminValue(value: string) {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function getMenuAdminErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Menu admin update failed. Review the form and try again.";
}
