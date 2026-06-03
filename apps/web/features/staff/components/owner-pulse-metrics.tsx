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
  return (
    <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
      <MetricCard
        label="Active orders"
        value={metricValue(activeOrders, isLoading)}
        description="Visible non-terminal orders"
        icon={<Receipt className="size-4" aria-hidden="true" />}
        tone="primary"
      />
      <MetricCard
        label="Unaccepted"
        value={metricValue(submittedOrders, isLoading)}
        description="Needs cashier decision"
        icon={<Clock3 className="size-4" aria-hidden="true" />}
        tone={submittedOrders > 0 ? "warning" : "muted"}
      />
      <MetricCard
        label="Preparing"
        value={metricValue(preparingTasks, isLoading)}
        description="Station work active"
        icon={<ChefHat className="size-4" aria-hidden="true" />}
        tone="accent"
      />
      <MetricCard
        label="Ready"
        value={metricValue(readyOrders, isLoading)}
        description="May need serving"
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={readyOrders > 0 ? "warning" : "success"}
      />
      <MetricCard
        label="Waiter calls"
        value={metricValue(openWaiterCalls, isLoading)}
        description="Open service asks"
        icon={<BellRing className="size-4" aria-hidden="true" />}
        tone={openWaiterCalls > 0 ? "warning" : "success"}
      />
      <MetricCard
        label="Bill requests"
        value={metricValue(openBillRequests, isLoading)}
        description="Open bill lane"
        icon={<WalletCards className="size-4" aria-hidden="true" />}
        tone={openBillRequests > 0 ? "primary" : "muted"}
      />
      <MetricCard
        label="Urgent"
        value={metricValue(urgentAttention, isLoading)}
        description="Attention queue"
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        tone={urgentAttention > 0 ? "warning" : "success"}
      />
      <MetricCard
        label="Visible value"
        value={isLoading ? "..." : visibleOrderValue}
        description="Tracked order value"
        icon={<Radio className="size-4" aria-hidden="true" />}
        tone={realtimeState === "connected" ? "success" : "muted"}
      />
      <MetricCard
        className="md:col-span-4 xl:col-span-8"
        label="Realtime"
        value={realtimeState === "connected" ? "Live" : "Watch"}
        description={humanizeStatus(realtimeState)}
        icon={<Radio className="size-4" aria-hidden="true" />}
        tone={realtimeState === "connected" ? "success" : "warning"}
      />
    </section>
  );
}
