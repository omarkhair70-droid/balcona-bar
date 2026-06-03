"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  ChefHat,
  LayoutDashboard,
  LogIn,
  LogOut,
  RefreshCw,
  Receipt,
  Sparkles,
  UserRoundCheck,
  WalletCards
} from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getAttentionActionLabel,
  getAttentionReasonMessage,
  getAttentionRecommendedActions,
  getAttentionReasons
} from "@/features/staff/attention-data";
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  humanizeStatus
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  buildOwnerHealthSummary,
  formatVisibleValue,
  getOwnerAttentionPriority,
  getOwnerAttentionScore,
  getOwnerAttentionStatus,
  getOwnerBillStatus,
  getOwnerOrderCurrency,
  getOwnerOrderStatus,
  getOwnerOrderValueMinor,
  getOwnerTaskStation,
  getOwnerTaskStatus,
  getOwnerWaiterCallPriority,
  getOwnerWaiterCallStatus,
  safeCountByStatus
} from "@/features/staff/owner-data";
import {
  getBranchAttentionQueue,
  getBranchBillRequests,
  getBranchEffectiveExperience,
  getBranchMenu,
  getBranchPreparationTasks,
  getBranchRealtimeEvents,
  getBranchWaiterCalls,
  getCashierOrders,
  staffLogout
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { OwnerAttentionSummary } from "../components/owner-attention-summary";
import { OwnerExperienceReadiness } from "../components/owner-experience-readiness";
import { OwnerHealthPanel } from "../components/owner-health-panel";
import { OwnerOperationsSnapshot } from "../components/owner-operations-snapshot";
import { OwnerPulseMetrics } from "../components/owner-pulse-metrics";
import { OwnerRecentActivity } from "../components/owner-recent-activity";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";

const emptyRecords: Record<string, unknown>[] = [];
const activeOrderStatuses = new Set([
  "submitted",
  "cashier_accepted",
  "preparing",
  "ready",
  "served"
]);
const activeBillStatuses = new Set(["open", "acknowledged", "presented"]);

function countBy(
  records: Record<string, unknown>[],
  predicate: (record: Record<string, unknown>) => boolean
) {
  return records.filter(predicate).length;
}

function OwnerDashboardActions() {
  const router = useRouter();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const logoutMutation = useMutation({
    mutationFn: () =>
      accessToken ? staffLogout(accessToken) : Promise.resolve({}),
    onSettled: () => {
      clearSession();
      router.push("/staff/login");
    }
  });

  if (!accessToken) {
    return (
      <Link href="/staff/login" className={buttonVariants()}>
        <LogIn className="size-4" aria-hidden="true" />
        Staff login
      </Link>
    );
  }

  return (
    <>
      <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        Overview
      </Link>
      <Link
        href="/staff/cashier"
        className={buttonVariants({ variant: "ghost" })}
      >
        <Receipt className="size-4" aria-hidden="true" />
        Cashier
      </Link>
      <Link
        href="/staff/kitchen"
        className={buttonVariants({ variant: "ghost" })}
      >
        <ChefHat className="size-4" aria-hidden="true" />
        Kitchen
      </Link>
      <Link
        href="/staff/waiter"
        className={buttonVariants({ variant: "ghost" })}
      >
        <UserRoundCheck className="size-4" aria-hidden="true" />
        Waiter
      </Link>
      <StaffBranchSelector
        access={effectiveAccess}
        selectedBranchId={selectedBranchId}
        onChange={setSelectedBranchId}
      />
      <Button
        variant="ghost"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="size-4" aria-hidden="true" />
        Logout
      </Button>
    </>
  );
}

function OwnerDataWarnings({
  warnings
}: {
  warnings: Array<{ label: string; error?: Error | null }>;
}) {
  const activeWarnings = warnings.filter((warning) => warning.error);

  if (activeWarnings.length === 0) {
    return null;
  }

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>Data source warnings</CardTitle>
        <CardDescription>
          The dashboard is showing the data that loaded successfully.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {activeWarnings.map((warning) => (
          <p
            key={warning.label}
            className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning"
          >
            <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
            {warning.label} could not load. {warning.error?.message}
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

function ManagerQuickActions({
  onRefresh
}: {
  onRefresh: () => void;
}) {
  return (
    <Card variant="quiet">
      <CardHeader>
        <Badge variant="muted" className="w-fit">
          Quick actions
        </Badge>
        <CardTitle>Manager navigation</CardTitle>
        <CardDescription>
          Read-only shortcuts into existing live staff and customer surfaces.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Link href="/staff/cashier" className={buttonVariants({ variant: "secondary" })}>
          <Receipt className="size-4" aria-hidden="true" />
          Open cashier
        </Link>
        <Link href="/staff/kitchen" className={buttonVariants({ variant: "secondary" })}>
          <ChefHat className="size-4" aria-hidden="true" />
          Open kitchen
        </Link>
        <Link href="/staff/waiter" className={buttonVariants({ variant: "secondary" })}>
          <UserRoundCheck className="size-4" aria-hidden="true" />
          Open waiter
        </Link>
        <Link href="/customer" className={buttonVariants({ variant: "ghost" })}>
          <Sparkles className="size-4" aria-hidden="true" />
          Customer demo
        </Link>
        <Button variant="secondary" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh all
        </Button>
      </CardContent>
    </Card>
  );
}

function OwnerDashboardContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const ordersQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerOrders(selectedBranchId),
    queryFn: () =>
      getCashierOrders(selectedBranchId ?? "", { status: "all" }, accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const billRequestsQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerBillRequests(selectedBranchId),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const preparationTasksQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerPreparationTasks(selectedBranchId),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station: "all", status: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const waiterCallsQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerWaiterCalls(selectedBranchId),
    queryFn: () =>
      getBranchWaiterCalls(
        selectedBranchId ?? "",
        { status: "all", type: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const attentionQueueQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerAttentionQueue(selectedBranchId),
    queryFn: () =>
      getBranchAttentionQueue(
        selectedBranchId ?? "",
        { status: "all", priority: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const realtimeEventsQuery = useQuery({
    queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
    queryFn: () =>
      getBranchRealtimeEvents(
        selectedBranchId ?? "",
        { channel: "all", limit: 12 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const experienceQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerExperience(selectedBranchId),
    queryFn: () => getBranchEffectiveExperience(selectedBranchId ?? ""),
    enabled: Boolean(selectedBranchId),
    staleTime: 60_000
  });
  const menuQuery = useQuery({
    queryKey: staffQueryKeys.staffOwnerMenu(selectedBranchId),
    queryFn: () => getBranchMenu(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 60_000
  });
  const orders = useMemo(
    () => ordersQuery.data?.orders ?? emptyRecords,
    [ordersQuery.data?.orders]
  );
  const billRequests = useMemo(
    () => billRequestsQuery.data?.billRequests ?? emptyRecords,
    [billRequestsQuery.data?.billRequests]
  );
  const preparationTasks = useMemo(
    () => preparationTasksQuery.data?.tasks ?? emptyRecords,
    [preparationTasksQuery.data?.tasks]
  );
  const waiterCalls = useMemo(
    () => waiterCallsQuery.data?.waiterCalls ?? emptyRecords,
    [waiterCallsQuery.data?.waiterCalls]
  );
  const attentionQueue = useMemo(
    () => attentionQueueQuery.data?.attentionQueue ?? emptyRecords,
    [attentionQueueQuery.data?.attentionQueue]
  );
  const visibleValues = orders.map(getOwnerOrderValueMinor);
  const hasVisibleValue =
    orders.length === 0 || visibleValues.some((value) => value > 0);
  const visibleValueMinor = visibleValues.reduce(
    (sum, value) => sum + value,
    0
  );
  const currency =
    orders.map(getOwnerOrderCurrency).find(Boolean) ?? "EGP";
  const activeOrders = countBy(orders, (order) =>
    activeOrderStatuses.has(getOwnerOrderStatus(order))
  );
  const submittedOrders = safeCountByStatus(
    orders,
    getOwnerOrderStatus,
    "submitted"
  );
  const readyOrders = safeCountByStatus(orders, getOwnerOrderStatus, "ready");
  const pendingTasks = safeCountByStatus(
    preparationTasks,
    getOwnerTaskStatus,
    "pending"
  );
  const preparingTasks = safeCountByStatus(
    preparationTasks,
    getOwnerTaskStatus,
    "preparing"
  );
  const openWaiterCalls = safeCountByStatus(
    waiterCalls,
    getOwnerWaiterCallStatus,
    "open"
  );
  const urgentWaiterCalls = countBy(
    waiterCalls,
    (call) =>
      (getOwnerWaiterCallStatus(call) === "open" ||
        getOwnerWaiterCallStatus(call) === "acknowledged") &&
      getOwnerWaiterCallPriority(call) >= 3
  );
  const openBillRequests = countBy(billRequests, (billRequest) =>
    activeBillStatuses.has(getOwnerBillStatus(billRequest))
  );
  const urgentAttention = countBy(
    attentionQueue,
    (attention) =>
      getOwnerAttentionStatus(attention) === "urgent" ||
      getOwnerAttentionPriority(attention) === "urgent"
  );
  const needsAttention = safeCountByStatus(
    attentionQueue,
    getOwnerAttentionStatus,
    "needs_attention"
  );
  const health = buildOwnerHealthSummary({
    activeOrders,
    submittedOrders,
    readyOrders,
    pendingTasks,
    preparingTasks,
    openWaiterCalls,
    urgentWaiterCalls,
    openBillRequests,
    urgentAttention,
    needsAttention
  });
  const topAttention = attentionQueue
    .filter((attention) => getOwnerAttentionScore(attention) > 0)
    .slice()
    .sort((first, second) => getOwnerAttentionScore(second) - getOwnerAttentionScore(first));
  const topReasons = topAttention
    .flatMap(getAttentionReasons)
    .slice(0, 3)
    .map((reason) => getAttentionReasonMessage(reason));
  const topActions = topAttention
    .flatMap(getAttentionRecommendedActions)
    .slice(0, 3)
    .map(getAttentionActionLabel);
  const refreshAll = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerBillRequests(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerPreparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerWaiterCalls(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerAttentionQueue(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerExperience(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffOwnerMenu(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });
  };
  const dataLoading =
    ordersQuery.isPending ||
    billRequestsQuery.isPending ||
    preparationTasksQuery.isPending ||
    waiterCallsQuery.isPending ||
    attentionQueueQuery.isPending;

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="No accessible branch"
        description="This staff account does not expose a branch for owner operations yet."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <OwnerPulseMetrics
        activeOrders={activeOrders}
        submittedOrders={submittedOrders}
        preparingTasks={preparingTasks}
        readyOrders={readyOrders}
        openWaiterCalls={openWaiterCalls}
        openBillRequests={openBillRequests}
        urgentAttention={urgentAttention}
        visibleOrderValue={formatVisibleValue(
          visibleValueMinor,
          currency,
          hasVisibleValue
        )}
        realtimeState={realtime.state}
        isLoading={dataLoading}
      />

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Owner / Manager</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {staffUser?.name || staffUser?.email || "Staff user"} is viewing
              a client-side branch pulse from existing operational endpoints.
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={refreshAll}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh all
          </Button>
        </CardHeader>
      </Card>

      <OwnerDataWarnings
        warnings={[
          { label: "Orders", error: ordersQuery.error },
          { label: "Bill requests", error: billRequestsQuery.error },
          { label: "Preparation tasks", error: preparationTasksQuery.error },
          { label: "Waiter calls", error: waiterCallsQuery.error },
          { label: "Attention queue", error: attentionQueueQuery.error }
        ]}
      />

      <OwnerHealthPanel health={health} branchName={selectedBranch.name} />

      <OwnerOperationsSnapshot
        lanes={[
          {
            title: "Cashier",
            description: "Order intake and decisions",
            href: "/staff/cashier",
            icon: <Receipt className="size-4" aria-hidden="true" />,
            metrics: [
              { label: "Submitted", value: submittedOrders },
              {
                label: "Accepted",
                value: safeCountByStatus(
                  orders,
                  getOwnerOrderStatus,
                  "cashier_accepted"
                )
              },
              {
                label: "Rejected",
                value: safeCountByStatus(
                  orders,
                  getOwnerOrderStatus,
                  "cashier_rejected"
                )
              },
              {
                label: "Cancelled",
                value: safeCountByStatus(
                  orders,
                  getOwnerOrderStatus,
                  "cancelled"
                )
              }
            ]
          },
          {
            title: "Preparation",
            description: "Kitchen, barista, and dessert flow",
            href: "/staff/kitchen",
            icon: <ChefHat className="size-4" aria-hidden="true" />,
            metrics: [
              { label: "Pending", value: pendingTasks },
              { label: "Preparing", value: preparingTasks },
              {
                label: "Ready",
                value: safeCountByStatus(
                  preparationTasks,
                  getOwnerTaskStatus,
                  "ready"
                )
              },
              {
                label: "Cancelled",
                value: safeCountByStatus(
                  preparationTasks,
                  getOwnerTaskStatus,
                  "cancelled"
                )
              }
            ]
          },
          {
            title: "Waiter",
            description: "Service requests and table recovery",
            href: "/staff/waiter",
            icon: <BellRing className="size-4" aria-hidden="true" />,
            metrics: [
              { label: "Open", value: openWaiterCalls },
              {
                label: "Ack",
                value: safeCountByStatus(
                  waiterCalls,
                  getOwnerWaiterCallStatus,
                  "acknowledged"
                )
              },
              {
                label: "Resolved",
                value: safeCountByStatus(
                  waiterCalls,
                  getOwnerWaiterCallStatus,
                  "resolved"
                )
              },
              { label: "Urgent", value: urgentWaiterCalls }
            ]
          },
          {
            title: "Bills",
            description: "Bill requests and presentation",
            href: "/staff/cashier",
            icon: <WalletCards className="size-4" aria-hidden="true" />,
            metrics: [
              {
                label: "Open",
                value: safeCountByStatus(
                  billRequests,
                  getOwnerBillStatus,
                  "open"
                )
              },
              {
                label: "Ack",
                value: safeCountByStatus(
                  billRequests,
                  getOwnerBillStatus,
                  "acknowledged"
                )
              },
              {
                label: "Presented",
                value: safeCountByStatus(
                  billRequests,
                  getOwnerBillStatus,
                  "presented"
                )
              },
              {
                label: "Closed",
                value: safeCountByStatus(
                  billRequests,
                  getOwnerBillStatus,
                  "closed"
                )
              }
            ]
          }
        ]}
      />

      <section className="grid gap-5 xl:grid-cols-[1fr_24rem]">
        <OwnerAttentionSummary
          attentionItems={attentionQueue}
          isLoading={attentionQueueQuery.isPending}
          error={attentionQueueQuery.error ?? undefined}
        />
        <Card variant="quiet">
          <CardHeader>
            <CardTitle>Risk notes</CardTitle>
            <CardDescription>
              Top attention reasons and actions visible to managers.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                Top reasons
              </p>
              <div className="mt-3 grid gap-2">
                {(topReasons.length > 0
                  ? topReasons
                  : ["No active attention reasons returned"]
                ).map((reason) => (
                  <p key={reason} className="text-sm text-muted-foreground">
                    {reason}
                  </p>
                ))}
              </div>
            </div>
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                Suggested actions
              </p>
              <div className="mt-3 grid gap-2">
                {(topActions.length > 0
                  ? topActions
                  : ["Keep monitoring realtime branch activity"]
                ).map((action) => (
                  <p key={action} className="text-sm text-muted-foreground">
                    {humanizeStatus(action)}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <OwnerExperienceReadiness
        experience={experienceQuery.data}
        menu={menuQuery.data}
        experienceLoading={experienceQuery.isPending}
        menuLoading={menuQuery.isPending}
        experienceError={experienceQuery.error ?? undefined}
        menuError={menuQuery.error ?? undefined}
      />

      <ManagerQuickActions onRefresh={refreshAll} />

      <OwnerRecentActivity
        events={realtimeEventsQuery.data?.events ?? emptyRecords}
        isLoading={realtimeEventsQuery.isPending}
        error={realtimeEventsQuery.error ?? undefined}
      />

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>Station mix</CardTitle>
          <CardDescription>
            Preparation task count by returned station.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {["barista", "kitchen", "dessert"].map((station) => (
            <div key={station} className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                {humanizeStatus(station)}
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {countBy(
                  preparationTasks,
                  (task) => getOwnerTaskStation(task) === station
                )}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function OwnerDashboardPage() {
  return (
    <StaffPageShell
      title="Owner command center"
      description="Executive branch pulse for live orders, preparation, waiter calls, bills, attention risks, and realtime activity."
      actions={<OwnerDashboardActions />}
    >
      <StaffAuthGate>
        <OwnerDashboardContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
