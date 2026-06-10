"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
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
  onRefresh
}: CashierOrderQueueProps) {
  const t = useTranslations("staff");

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>{t("orders.queueTitle")}</CardTitle>
          <CardDescription>{t("orders.queueDescription")}</CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("actions.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onStatusChange(option)}
              className={cn(
                "min-h-9 whitespace-nowrap rounded-button border px-3 text-xs font-semibold transition",
                status === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {humanizeStatus(option)}
            </button>
          ))}
        </div>

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
          <div className="grid gap-3">
            {orders.map((order, index) => {
              const orderId = getOrderId(order) || String(index);

              return (
                <CashierOrderCard
                  key={orderId}
                  order={order}
                  selected={selectedOrderId === orderId}
                  onSelect={onSelectOrder}
                />
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
