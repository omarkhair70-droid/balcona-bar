"use client";

import {
  AlertTriangle,
  BellRing,
  ChefHat,
  Clock3,
  Receipt,
  Radio,
  WalletCards
} from "lucide-react";
import { MetricCard } from "@/components/ui/metric-card";
import { humanizeStatus } from "@/features/staff/staff-format";
import type { StaffRealtimeState } from "@/features/staff/use-staff-branch-realtime";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type OwnerPulseMetricsProps = {
  activeOrders: number;
  submittedOrders: number;
  preparingTasks: number;
  readyOrders: number;
  openWaiterCalls: number;
  openBillRequests: number;
  urgentAttention: number;
  visibleOrderValue: string;
  realtimeState: StaffRealtimeState;
  isLoading?: boolean;
};

function metricValue(value: number | string, isLoading?: boolean) {
  return isLoading ? "..." : String(value);
}

export function OwnerPulseMetrics({
  activeOrders,
  submittedOrders,
  preparingTasks,
  readyOrders,
  openWaiterCalls,
  openBillRequests,
  urgentAttention,
  visibleOrderValue,
  realtimeState,
  isLoading
}: OwnerPulseMetricsProps) {
  const t = useTranslations("owner");

  return (
    <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard
        label={t("pulse.activeOrders")}
        value={metricValue(activeOrders, isLoading)}
        description={t("pulse.activeOrdersDescription")}
        icon={<Receipt className="size-4" aria-hidden="true" />}
        tone="primary"
      />
      <MetricCard
        label={t("pulse.unaccepted")}
        value={metricValue(submittedOrders, isLoading)}
        description={t("pulse.unacceptedDescription")}
        icon={<Clock3 className="size-4" aria-hidden="true" />}
        tone={submittedOrders > 0 ? "warning" : "muted"}
      />
      <MetricCard
        label={t("pulse.preparing")}
        value={metricValue(preparingTasks, isLoading)}
        description={t("pulse.preparingDescription")}
        icon={<ChefHat className="size-4" aria-hidden="true" />}
        tone="accent"
      />
      <MetricCard
        label={t("pulse.ready")}
        value={metricValue(readyOrders, isLoading)}
        description={t("pulse.readyDescription")}
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={readyOrders > 0 ? "warning" : "success"}
      />
      <MetricCard
        label={t("pulse.waiterCalls")}
        value={metricValue(openWaiterCalls, isLoading)}
        description={t("pulse.waiterCallsDescription")}
        icon={<BellRing className="size-4" aria-hidden="true" />}
        tone={openWaiterCalls > 0 ? "warning" : "success"}
      />
      <MetricCard
        label={t("pulse.billRequests")}
        value={metricValue(openBillRequests, isLoading)}
        description={t("pulse.billRequestsDescription")}
        icon={<WalletCards className="size-4" aria-hidden="true" />}
        tone={openBillRequests > 0 ? "primary" : "muted"}
      />
      <MetricCard
        label={t("pulse.urgent")}
        value={metricValue(urgentAttention, isLoading)}
        description={t("pulse.urgentDescription")}
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={urgentAttention > 0 ? "warning" : "success"}
      />
      <MetricCard
        label={t("pulse.visibleValue")}
        value={isLoading ? "..." : visibleOrderValue}
        description={t("pulse.visibleValueDescription")}
        icon={<Radio className="size-4" aria-hidden="true" />}
        tone={realtimeState === "connected" ? "success" : "muted"}
      />
      <MetricCard
        className="md:col-span-4 xl:col-span-8"
        label={t("pulse.realtime")}
        value={
          realtimeState === "connected"
            ? t("pulse.realtimeLive")
            : t("pulse.realtimeWatch")
        }
        description={humanizeStatus(realtimeState)}
        icon={<Radio className="size-4" aria-hidden="true" />}
        tone={realtimeState === "connected" ? "success" : "warning"}
      />
    </section>
  );
}
