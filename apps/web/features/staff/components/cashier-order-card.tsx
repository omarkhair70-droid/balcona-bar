"use client";

import { ReceiptText } from "lucide-react";
import {
  getCurrency,
  getMinorTotal,
  getOrderFloor,
  getOrderItems,
  getOrderId,
  getOrderNumber,
  getOrderStatus,
  getOrderSubmittedAt,
  getOrderTable,
  getOrderTotals
} from "@/features/staff/cashier-data";
import {
  formatMoney,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { CashierOrderStatusPill } from "./cashier-order-status-pill";

function formatOrderAge(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60_000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

type CashierOrderCardProps = {
  order: Record<string, unknown>;
  selected?: boolean;
  onSelect: (orderId: string) => void;
  onPrefetch?: (orderId: string) => void;
};

export function CashierOrderCard({
  order,
  selected,
  onSelect,
  onPrefetch,
}: CashierOrderCardProps) {
  const t = useTranslations("staff");
  const orderId = getOrderId(order);
  const totals = getOrderTotals(order);
  const table = getOrderTable(order);
  const floor = getOrderFloor(order);
  const itemCount = getRecordNumber(totals, "itemCount");
  const items = getOrderItems(order);
  const firstItem = items[0];
  const firstItemLabel =
    getRecordString(firstItem, "itemNameSnapshot") ||
    t("orders.itemsQuantity", {
      count: itemCount,
      quantity: getRecordNumber(totals, "totalQuantity")
    });
  const age = formatOrderAge(getOrderSubmittedAt(order));

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => orderId && onSelect(orderId)}
      onPointerEnter={() => orderId && onPrefetch?.(orderId)}
      onFocus={() => orderId && onPrefetch?.(orderId)}
      className={cn(
        "w-full rounded-md border p-3 text-start transition",
        selected
          ? "border-[#8A6239] bg-[#34271E]"
          : "border-[#3B3028] bg-[#211A15] hover:border-[#554238] hover:bg-[#292019]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-4 shrink-0 text-[#C68A4A]" aria-hidden="true" />
            <p className="truncate text-sm font-semibold text-[#FFF4E6]">
              {getOrderNumber(order) ||
                t("orders.orderFallback", {
                  orderNumber: shortId(orderId)
                })}
            </p>
          </div>
          <p className="mt-1 text-xs text-[#A99B8E]">
            {getTableLabel(table, floor)} · {age}
          </p>
        </div>
        <CashierOrderStatusPill status={getOrderStatus(order)} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-[#96897E]">
          {firstItemLabel}
          {items.length > 1 ? ` +${items.length - 1}` : ""}
        </p>
        <strong className="shrink-0 text-sm text-[#FFF4E6]">
          {formatMoney(getMinorTotal(totals), getCurrency(totals))}
        </strong>
      </div>
    </button>
  );
}
