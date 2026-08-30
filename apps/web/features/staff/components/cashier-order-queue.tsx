"use client";

import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { CashierOrderStatus } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { getOrderId } from "@/features/staff/cashier-data";
import { humanizeStatus } from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CashierOrderCard } from "./cashier-order-card";

type CashierOrderQueueProps = {
  orders: Record<string, unknown>[];
  status: CashierOrderStatus;
  selectedOrderId?: string;
  isLoading?: boolean;
  error?: Error;
  onStatusChange: (status: CashierOrderStatus) => void;
  onSelectOrder: (orderId: string) => void;
  onPrefetchOrder?: (orderId: string) => void;
  onRefresh: () => void;
};

const statusOptions: CashierOrderStatus[] = [
  "submitted",
  "cashier_accepted",
  "preparing",
  "ready",
  "all"
];

export function CashierOrderQueue({
  orders,
  status,
  selectedOrderId,
  isLoading,
  error,
  onStatusChange,
  onSelectOrder,
  onPrefetchOrder,
  onRefresh
}: CashierOrderQueueProps) {
  const t = useTranslations("staff");

  return (
    <section className="min-w-0 xl:min-h-[34rem] border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#FFF5E8]">
              {t("orders.queueTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#95887D]">
              {t("orders.queueDescription")}
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

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onStatusChange(option)}
              className={cn(
                "min-h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition",
                status === option
                  ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                  : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
              )}
            >
              {humanizeStatus(option)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
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
