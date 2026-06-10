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
        "w-full rounded-card border bg-surface/75 p-4 text-start shadow-card transition hover:border-primary/55 hover:bg-surface",
        selected ? "border-primary/70 bg-primary/10" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {getOrderNumber(order) ||
                t("orders.orderFallback", {
                  orderNumber: shortId(orderId)
                })}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {getTableLabel(table, floor)}
          </p>
        </div>
        <CashierOrderStatusPill status={getOrderStatus(order)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("orders.items")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {t("orders.itemsQuantity", { count: itemCount, quantity })}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("orders.total")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(getMinorTotal(totals), getCurrency(totals))}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatDateTime(getOrderSubmittedAt(order))}
        </span>
        {source ? <span>{source}</span> : null}
      </div>

      {note ? (
        <p className="mt-3 line-clamp-2 rounded-card border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {note}
        </p>
      ) : null}
    </button>
  );
}
