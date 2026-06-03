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
import { CustomerSessionScreen } from "../customer-session-screen";
import { getRecordString } from "../customer-format";
import { StatusTimeline } from "../status-timeline";

type CustomerStatusPageProps = {
  sessionId: string;
};

function getOrderNumber(order: Record<string, unknown>) {
  return getRecordString(order, "orderNumber", getRecordString(order, "id", "Order"));
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
  return getRecordString(order, "status", "submitted").replaceAll("_", " ");
}

export function CustomerStatusPage({ sessionId }: CustomerStatusPageProps) {
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
      eyebrow="Order status"
      title="Follow your table timeline"
      description="Current orders, customer status, and timeline events refresh when realtime session events arrive."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Current"
          value={customerStatus.replaceAll("_", " ")}
          description="Customer-facing state"
          icon={<Clock className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Orders"
          value={`${orders.length}`}
          description="For this session"
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Timeline"
          value={`${timelineQuery.data?.timeline.length ?? 0}`}
          description="Visible events"
          icon={<PackageCheck className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>Orders</CardTitle>
            <CardDescription>
              Friendly status cards for orders submitted from this table.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {ordersQuery.isPending ? <LoadingState label="Loading orders" /> : null}
            {ordersQuery.isError ? (
              <EmptyState
                title="Orders could not load"
                description={ordersQuery.error.message}
              />
            ) : null}
            {ordersQuery.isSuccess && orders.length === 0 ? (
              <EmptyState
                title="No orders yet"
                description="Submit your cart and the timeline will begin here."
                action={
                  <Link
                    href={`/customer/session/${sessionId}/cart`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    Review cart
                  </Link>
                }
              />
            ) : null}
            {orders.map((order, index) => (
              <div key={getOrderKey(order, index)} className="rounded-card border bg-surface/75 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {getOrderNumber(order)}
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
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              Table, order, notification, service, and bill events in one
              customer-friendly list.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timelineQuery.isPending ? <LoadingState label="Loading timeline" /> : null}
            {timelineQuery.isError ? (
              <EmptyState
                title="Timeline could not load"
                description={timelineQuery.error.message}
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
