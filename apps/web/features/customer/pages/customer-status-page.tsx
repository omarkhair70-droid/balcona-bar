"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, Clock, PackageCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import {
  getCustomerStatus,
  getCustomerTimeline,
  getTableSessionOrders
} from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { getRecordString } from "../customer-format";
import { StatusTimeline } from "../status-timeline";

type CustomerStatusPageProps = {
  sessionId: string;
};

function getOrderNumber(order: Record<string, unknown>, fallback: string) {
  return getRecordString(order, "orderNumber", getRecordString(order, "id", fallback));
}

function getOrderKey(order: Record<string, unknown>, index: number) {
  return (
    getRecordString(
      order,
      "id",
      getRecordString(
        order,
        "orderId",
        getRecordString(order, "orderNumber", `order-${index}`)
      )
    ) || `order-${index}`
  );
}

function getOrderStatus(order: Record<string, unknown>) {
  const lifecycle =
    typeof order.lifecycle === "object" && order.lifecycle !== null
      ? (order.lifecycle as Record<string, unknown>)
      : undefined;
  const customerLabel = getRecordString(lifecycle, "customerLabel");

  if (customerLabel) {
    return customerLabel;
  }

  return getRecordString(order, "status", "submitted").replaceAll("_", " ");
}

export function CustomerStatusPage({ sessionId }: CustomerStatusPageProps) {
  const t = useTranslations("customer");
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const ordersQuery = useQuery({
    queryKey: customerQueryKeys.orders(sessionId),
    queryFn: () => getTableSessionOrders(sessionId, token),
    staleTime: 10_000
  });
  const statusQuery = useQuery({
    queryKey: customerQueryKeys.status(sessionId),
    queryFn: () => getCustomerStatus(sessionId, token),
    staleTime: 10_000
  });
  const timelineQuery = useQuery({
    queryKey: customerQueryKeys.timeline(sessionId),
    queryFn: () => getCustomerTimeline(sessionId, token),
    staleTime: 10_000
  });
  const orders = ordersQuery.data?.orders ?? [];
  const customerStatus = getRecordString(
    statusQuery.data,
    "customerStatus",
    orders.length > 0 ? "submitted" : "ready"
  );

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="status"
      eyebrow={t("status.eyebrow")}
      title={t("status.title")}
      description={t("status.description")}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("status.current")}
          value={customerStatus.replaceAll("_", " ")}
          description={t("status.customerFacingState")}
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("status.ordersMetric")}
          value={`${orders.length}`}
          description={t("status.forThisSession")}
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("status.timelineMetric")}
          value={`${timelineQuery.data?.timeline.length ?? 0}`}
          description={t("status.visibleEvents")}
          icon={<PackageCheck className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>{t("status.ordersTitle")}</CardTitle>
            <CardDescription>
              {t("status.ordersDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ordersQuery.isPending ? (
              <LoadingState label={t("status.loadingOrders")} />
            ) : null}
            {ordersQuery.isError ? (
              <EmptyState
                title={t("errors.ordersLoad")}
                description={ordersQuery.error.message}
                debug={{
                  action: "order_status",
                  flow: "customer_order_cycle",
                  sessionId,
                  error: ordersQuery.error
                }}
              />
            ) : null}
            {ordersQuery.isSuccess && orders.length === 0 ? (
              <EmptyState
                title={t("empty.statusOrdersTitle")}
                description={t("empty.statusOrdersDescription")}
                action={
                  <Link
                    href={`/customer/session/${sessionId}/cart`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    {t("actions.reviewCart")}
                  </Link>
                }
              />
            ) : null}
            {orders.map((order, index) => (
              <div key={getOrderKey(order, index)} className="rounded-card border bg-surface/75 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {getOrderNumber(order, t("status.orderFallback"))}
                </p>
                <p className="mt-2 text-sm capitalize text-muted-foreground">
                  {getOrderStatus(order)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>{t("status.timelineTitle")}</CardTitle>
            <CardDescription>
              {t("status.timelineDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timelineQuery.isPending ? (
              <LoadingState label={t("status.loadingTimeline")} />
            ) : null}
            {timelineQuery.isError ? (
              <EmptyState
                title={t("errors.timelineLoad")}
                description={timelineQuery.error.message}
                debug={{
                  action: "customer_timeline",
                  flow: "customer_order_cycle",
                  sessionId,
                  error: timelineQuery.error
                }}
              />
            ) : null}
            {timelineQuery.data ? (
              <StatusTimeline events={timelineQuery.data.timeline} />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </CustomerSessionScreen>
  );
}
