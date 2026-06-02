import type { CartResponse, MenuItemSummary } from "@/lib/api/types";

export function formatMoney(
  amountMinor?: number | null,
  currency = "EGP"
) {
  const amount = (amountMinor ?? 0) / 100;

  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

export function getMenuItemPrice(item: MenuItemSummary) {
  return item.effectivePriceMinor ?? item.basePriceMinor;
}

export function getCartItemCount(cart?: CartResponse | null) {
  return cart?.totals.totalQuantity ?? 0;
}

export function getRecordString(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = ""
) {
  const value = record?.[key];

  return typeof value === "string" ? value : fallback;
}
