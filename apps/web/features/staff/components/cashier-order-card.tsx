"use client";

import { Clock3, ReceiptText } from "lucide-react";
import {
  getCurrency,
  getMinorTotal,
  getOrderCustomerNote,
  getOrderFloor,
  getOrderId,
  getOrderNumber,
  getOrderSource,
  getOrderStatus,
  getOrderSubmittedAt,
  getOrderTable,
  getOrderTotals
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  formatMoney,
  getRecordNumber,
  getTableLabel,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { CashierOrderStatusPill } from "./cashier-order-status-pill";

type CashierOrderCardProps = {
  order: Record<string, unknown>;
  selected?: boolean;
  onSelect: (orderId: string) => void;
};

export function CashierOrderCard({
  order,
  selected,
  onSelect
}: CashierOrderCardProps) {
  const t = useTranslations("staff");
  const orderId = getOrderId(order);
  const totals = getOrderTotals(order);
  const table = getOrderTable(order);
  const floor = getOrderFloor(order);
  const itemCount = getRecordNumber(totals, "itemCount");
  const quantity = getRecordNumber(totals, "totalQuantity");
  const note = getOrderCustomerNote(order);
  const source = getOrderSource(order);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => orderId && onSelect(orderId)}
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
            {getTableLabel(table, floor)}
          </p>
        </div>
        <CashierOrderStatusPill status={getOrderStatus(order)} />
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-[#96897E]">
            {t("orders.itemsQuantity", { count: itemCount, quantity })}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[#8F8176]">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDateTime(getOrderSubmittedAt(order))}
          </p>
        </div>
        <strong className="shrink-0 text-sm text-[#FFF4E6]">
          {formatMoney(getMinorTotal(totals), getCurrency(totals))}
        </strong>
      </div>

      {source ? (
        <p className="mt-2 text-[10px] uppercase tracking-[0.08em] text-[#80746A]">
          {source}
        </p>
      ) : null}

      {note ? (
        <p className="mt-3 line-clamp-2 rounded-md border border-[#71413A] bg-[#321F1C] p-2 text-xs text-[#E4A199]">
          {note}
        </p>
      ) : null}
    </button>
  );
}
