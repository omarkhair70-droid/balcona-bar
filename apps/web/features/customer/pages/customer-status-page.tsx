"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
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
import { getGuestOrderStage, type GuestOrderStage } from "../customer-guest-state";
import { StatusTimeline } from "../status-timeline";

type CustomerStatusPageProps = {
  sessionId: string;
};

function getOrderNumber(order: Record<string, unknown>, fallback: string) {
  return getRecordString(
    order,
    "orderNumber",
    getRecordString(order, "id", fallback)
  );
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

function orderStage(order: Record<string, unknown>) {
  const lifecycle =
    typeof order.lifecycle === "object" && order.lifecycle !== null
      ? (order.lifecycle as Record<string, unknown>)
      : undefined;
  return getGuestOrderStage(
    getRecordString(
      lifecycle,
      "progressStep",
      getRecordString(order, "status", "submitted")
    )
  );
}

function stageKey(stage: GuestOrderStage) {
  return `status.stages.${stage}`;
}

function stageDescriptionKey(stage: GuestOrderStage) {
  return `status.stageDescriptions.${stage}`;
}

export function CustomerStatusPage({ sessionId }: CustomerStatusPageProps) {
  const t = useTranslations("customer");
  const token = useCustomerSessionStore((state) => state.customerAccessToken);

  const ordersQuery = useQuery({
    queryKey: customerQueryKeys.orders(sessionId),
    queryFn: () => getTableSessionOrders(sessionId, token),
    enabled: Boolean(token),
    staleTime: 10_000
  });

  const statusQuery = useQuery({
    queryKey: customerQueryKeys.status(sessionId),
    queryFn: () => getCustomerStatus(sessionId, token),
    enabled: Boolean(token),
    staleTime: 10_000
  });

  const timelineQuery = useQuery({
    queryKey: customerQueryKeys.timeline(sessionId),
    queryFn: () => getCustomerTimeline(sessionId, token),
    enabled: Boolean(token),
    staleTime: 10_000
  });

  const orders = ordersQuery.data?.orders ?? [];
  const currentStage = getGuestOrderStage(
    getRecordString(
      statusQuery.data,
      "customerStatus",
      orders.length > 0 ? "submitted" : "submitted"
    )
  );
  const hasOrders = orders.length > 0;

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="status"
      eyebrow={t("status.eyebrow")}
      title={t("status.title")}
      description={t("status.description")}
    >
      {hasOrders ? (
        <section className="rounded-[24px] border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                {t("status.current")}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-foreground">
                {t(stageKey(currentStage))}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(stageDescriptionKey(currentStage))}
              </p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              {["ready", "served"].includes(currentStage) ? (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              ) : (
                <Clock3 className="size-4" aria-hidden="true" />
              )}
            </span>
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-black text-foreground">
            {t("status.ordersTitle")}
          </h2>
          {hasOrders ? (
            <span className="text-[10px] font-bold text-muted-foreground">
              {orders.length} · {t("status.forThisSession")}
            </span>
          ) : null}
        </div>

        <div className="mt-2 rounded-[22px] border border-border bg-card px-3">
          {ordersQuery.isPending ? (
            <div className="py-4">
              <LoadingState label={t("status.loadingOrders")} />
            </div>
          ) : null}

          {ordersQuery.isError ? (
            <div className="py-4">
              <EmptyState
                title={t("errors.ordersLoad")}
                description={t("errors.tryAgain")}
              />
            </div>
          ) : null}

          {ordersQuery.isSuccess && !hasOrders ? (
            <div className="py-4">
              <EmptyState
                title={t("empty.statusOrdersTitle")}
                description={t("empty.statusOrdersDescription")}
                action={
                  <Link
                    href={`/customer/session/${sessionId}/menu`}
                    className={buttonVariants({ variant: "secondary" })}
                  >
                    {t("actions.browseMenu")}
                  </Link>
                }
              />
            </div>
          ) : null}

          {orders.map((order, index) => {
            const stage = orderStage(order);
            return (
              <div
                key={getOrderKey(order, index)}
                className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-foreground">
                    {getOrderNumber(order, t("status.orderFallback"))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(stageKey(stage))}
                  </p>
                </div>
                <span className="size-2 shrink-0 rounded-full bg-primary" />
              </div>
            );
          })}
        </div>
      </section>

      {hasOrders ? (
        <section className="mt-5 pb-8">
          <h2 className="text-sm font-black text-foreground">
            {t("status.timelineTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("status.timelineDescription")}
          </p>

          <div className="mt-4">
            {timelineQuery.isPending ? (
              <LoadingState label={t("status.loadingTimeline")} />
            ) : null}

            {timelineQuery.isError ? (
              <EmptyState
                title={t("errors.timelineLoad")}
                description={t("errors.tryAgain")}
              />
            ) : null}

            {timelineQuery.data ? (
              <StatusTimeline events={timelineQuery.data.timeline} />
            ) : null}
          </div>
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
