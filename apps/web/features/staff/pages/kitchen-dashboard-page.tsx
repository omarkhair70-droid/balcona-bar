"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Flame,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  Receipt,
  RefreshCw,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { MetricCard } from "@/components/ui/metric-card";
import {
  getTaskId,
  getTaskOrderId,
  getTaskStatus
} from "@/features/staff/preparation-data";
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  cancelPreparationTask,
  getBranchPreparationTasks,
  getBranchRealtimeEvents,
  getPreparationTaskDetail,
  markPreparationTaskReady,
  staffLogout,
  startPreparationTask
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { KitchenTaskBoard } from "../components/kitchen-task-board";
import { KitchenTaskDetailPanel } from "../components/kitchen-task-detail-panel";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";

type Notice = {
  tone: "success" | "error";
  message: string;
};

type TaskAction = {
  taskId: string;
};

type CancelTaskAction = TaskAction & {
  reason?: string | null;
};

const activeTaskStatuses = new Set(["pending", "preparing"]);
const emptyRecords: Record<string, unknown>[] = [];

function countTasksByStatus(
  tasks: Record<string, unknown>[],
  predicate: (status: string) => boolean
) {
  return tasks.filter((task) => predicate(getTaskStatus(task))).length;
}

function NoticeBanner({ notice }: { notice?: Notice }) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.tone === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={
        isSuccess
          ? "rounded-card border border-success bg-success/10 p-4 text-sm text-success"
          : "rounded-card border border-danger bg-danger/10 p-4 text-sm text-danger"
      }
    >
      {notice.message}
    </div>
  );
}

function KitchenDashboardActions() {
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

function KitchenDashboardContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const [station, setStation] = useState<PreparationStation>("all");
  const [status, setStatus] = useState<PreparationTaskStatus>("pending");
  const [userSelectedTaskId, setUserSelectedTaskId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const allTasksQuery = useQuery({
    queryKey: staffQueryKeys.preparationTasks(
      selectedBranchId,
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station: "all", status: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const tasksQuery = useQuery({
    queryKey: staffQueryKeys.preparationTasks(selectedBranchId, station, status),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station, status },
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
        { channel: "all", limit: 8 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const tasks = useMemo(
    () => tasksQuery.data?.tasks ?? emptyRecords,
    [tasksQuery.data?.tasks]
  );
  const allTasks = useMemo(
    () => allTasksQuery.data?.tasks ?? tasks,
    [allTasksQuery.data?.tasks, tasks]
  );
  const selectedTaskStillVisible = useMemo(
    () => tasks.some((task) => getTaskId(task) === userSelectedTaskId),
    [tasks, userSelectedTaskId]
  );
  const selectedTaskId =
    selectedTaskStillVisible && userSelectedTaskId
      ? userSelectedTaskId
      : getTaskId(tasks[0]);
  const taskDetailQuery = useQuery({
    queryKey: staffQueryKeys.preparationTask(selectedTaskId),
    queryFn: () => getPreparationTaskDetail(selectedTaskId ?? "", accessToken),
    enabled: Boolean(selectedTaskId && accessToken),
    staleTime: 5_000
  });
  const refreshBranch = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });
  };
  const invalidateTaskState = (taskId: string, orderId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTask(taskId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });

    if (orderId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.orderPreparationTasks(orderId)
      });
    }
  };
  const startMutation = useMutation({
    mutationFn: ({ taskId }: TaskAction) =>
      startPreparationTask(taskId, { staffUserId: staffUser?.id }, accessToken),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: "Preparation task started." });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Task could not be started. ${error.message}`
      });
    }
  });
  const readyMutation = useMutation({
    mutationFn: ({ taskId }: TaskAction) =>
      markPreparationTaskReady(
        taskId,
        { staffUserId: staffUser?.id },
        accessToken
      ),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: "Preparation task marked ready." });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Task could not be marked ready. ${error.message}`
      });
    }
  });
  const cancelMutation = useMutation({
    mutationFn: ({ taskId, reason }: CancelTaskAction) =>
      cancelPreparationTask(
        taskId,
        { reason, staffUserId: staffUser?.id },
        accessToken
      ),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: "Preparation task cancelled." });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Task could not be cancelled. ${error.message}`
      });
    }
  });

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="No accessible branch"
        description="This staff account does not expose a branch for kitchen operations yet."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard
          label="Pending"
          value={String(
            countTasksByStatus(allTasks, (taskStatus) => taskStatus === "pending")
          )}
          description="Waiting to start"
          icon={<ChefHat className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Preparing"
          value={String(
            countTasksByStatus(
              allTasks,
              (taskStatus) => taskStatus === "preparing"
            )
          )}
          description="Currently active"
          icon={<Flame className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label="Ready"
          value={String(
            countTasksByStatus(allTasks, (taskStatus) => taskStatus === "ready")
          )}
          description="Finished station work"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label="Closed"
          value={String(
            countTasksByStatus(
              allTasks,
              (taskStatus) => !activeTaskStatuses.has(taskStatus)
            )
          )}
          description="Ready or cancelled"
          icon={<XCircle className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label="Realtime"
          value={realtime.state === "connected" ? "Live" : "Watch"}
          description={humanizeStatus(realtime.state)}
          icon={<Gauge className="size-4" aria-hidden="true" />}
          tone={realtime.state === "connected" ? "success" : "warning"}
        />
      </section>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Kitchen / Barista</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {staffUser?.name || staffUser?.email || "Staff user"} is viewing
              station tasks created from cashier-accepted orders.
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={refreshBranch}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh branch
          </Button>
        </CardHeader>
      </Card>

      <NoticeBanner notice={notice} />

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,27rem)_1fr]">
        <KitchenTaskBoard
          tasks={tasks}
          station={station}
          status={status}
          selectedTaskId={selectedTaskId}
          isLoading={tasksQuery.isPending}
          error={tasksQuery.error ?? undefined}
          onStationChange={setStation}
          onStatusChange={setStatus}
          onSelectTask={setUserSelectedTaskId}
          onRefresh={refreshBranch}
        />
        <KitchenTaskDetailPanel
          task={taskDetailQuery.data}
          isLoading={taskDetailQuery.isPending && Boolean(selectedTaskId)}
          error={taskDetailQuery.error ?? undefined}
          startPending={startMutation.isPending}
          readyPending={readyMutation.isPending}
          cancelPending={cancelMutation.isPending}
          onStart={() => {
            if (selectedTaskId) {
              startMutation.mutate({ taskId: selectedTaskId });
            }
          }}
          onReady={() => {
            if (selectedTaskId) {
              readyMutation.mutate({ taskId: selectedTaskId });
            }
          }}
          onCancel={(reason) => {
            if (selectedTaskId) {
              cancelMutation.mutate({ taskId: selectedTaskId, reason });
            }
          }}
        />
      </section>

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Recent branch realtime events for orders and preparation.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {realtimeEventsQuery.isError ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
              {realtimeEventsQuery.error.message}
            </div>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
            <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
              Activity will appear here after preparation or order events reach
              the branch stream.
            </p>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).map((event, index) => (
            <div
              key={getRecordString(event, "id") || String(index)}
              className="rounded-card border bg-surface/75 p-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {humanizeStatus(getRecordString(event, "type", "event"))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getRecordString(event, "channel", "system")} /{" "}
                {formatDateTime(getRecordString(event, "createdAt"))}
              </p>
              {getRecordString(event, "preparationTaskId") ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Task {shortId(getRecordString(event, "preparationTaskId"))}
                </p>
              ) : null}
              {getRecordString(event, "orderId") ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Order {shortId(getRecordString(event, "orderId"))}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function KitchenDashboardPage() {
  return (
    <StaffPageShell
      title="Kitchen / Barista dashboard"
      description="Live station task board for accepted orders, with preparation state actions and branch realtime refresh."
      actions={<KitchenDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["preparation.read"]} branchScoped>
        <KitchenDashboardContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
