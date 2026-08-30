"use client";

import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getOrderId } from "@/features/staff/cashier-data";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { CashierOrderCard } from "./cashier-order-card";

export type CashierOrderLane = "needs_action" | "active";

type CashierOrderQueueProps = {
  orders: Record<string, unknown>[];
  lane: CashierOrderLane;
  needsActionCount: number;
  activeCount: number;
  selectedOrderId?: string;
  isLoading?: boolean;
  error?: Error;
  onLaneChange: (lane: CashierOrderLane) => void;
  onSelectOrder: (orderId: string) => void;
  onPrefetchOrder?: (orderId: string) => void;
  onRefresh: () => void;
};

export function CashierOrderQueue({
  orders,
  lane,
  needsActionCount,
  activeCount,
  selectedOrderId,
  isLoading,
  error,
  onLaneChange,
  onSelectOrder,
  onPrefetchOrder,
  onRefresh
}: CashierOrderQueueProps) {
  const t = useTranslations("staff");

  return (
    <section className="min-w-0 border-e border-[#342A23] bg-[#17120F] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-[#FFF5E8]">
            {t("orders.queueTitle")}
          </h2>
          <p className="mt-1 text-xs text-[#95887D]">
            {t("orders.taskFirstDescription")}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195] transition hover:border-[#5A483A] hover:text-[#F6EBDD]"
          aria-label={t("actions.refresh")}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        {[
          {
            id: "needs_action" as const,
            label: t("orders.needsAction"),
            count: needsActionCount
          },
          {
            id: "active" as const,
            label: t("orders.activeLane"),
            count: activeCount
          }
        ].map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onLaneChange(entry.id)}
            className={cn(
              "min-h-9 rounded-md border px-3 text-xs font-semibold transition",
              lane === entry.id
                ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
            )}
          >
            {entry.label} {entry.count}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {isLoading ? <LoadingState label={t("orders.loading")} /> : null}
        {error ? (
          <EmptyState
            title={t("orders.ordersError")}
            description={error.message}
            debug={{
              action: "cashier_orders_list",
              flow: "staff_cashier",
              error
            }}
          />
        ) : null}
        {!isLoading && !error && orders.length === 0 ? (
          <EmptyState
            title={t("orders.queueEmptyTitle")}
            description={t("orders.queueEmptyDescription")}
          />
        ) : null}
        {!isLoading && !error && orders.length > 0 ? (
          <div className="grid gap-2">
            {orders.map((order, index) => {
              const orderId = getOrderId(order) || String(index);

              return (
                <CashierOrderCard
                  key={orderId}
                  order={order}
                  selected={selectedOrderId === orderId}
                  onSelect={onSelectOrder}
                  onPrefetch={onPrefetchOrder}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
