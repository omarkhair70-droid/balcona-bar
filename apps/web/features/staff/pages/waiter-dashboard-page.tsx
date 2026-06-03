"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChefHat,
  Footprints,
  HandPlatter,
  LayoutDashboard,
  LogIn,
  LogOut,
  Radio,
  Receipt,
  RefreshCw
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
  getAttentionPriority,
  getAttentionSessionId,
  getAttentionStatus
} from "@/features/staff/attention-data";
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import {
  getWaiterCallId,
  getWaiterCallStatus,
  getWaiterCallTableSession
} from "@/features/staff/waiter-data";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  acknowledgeWaiterCall,
  cancelWaiterCall,
  getBranchAttentionQueue,
  getBranchRealtimeEvents,
  getBranchWaiterCalls,
  getTableSessionAttention,
  getWaiterCallDetail,
  muteTableSessionAttention,
  rebuildBranchAttention,
  recalculateTableSessionAttention,
  resolveTableSessionAttention,
  resolveWaiterCall,
  staffLogout
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  TableAttentionPriority,
  WaiterCallStatus,
  WaiterCallType
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import {
  AttentionQueue,
  type AttentionStatusFilter
} from "../components/attention-queue";
import { AttentionDetailPanel } from "../components/attention-detail-panel";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";
import { WaiterCallDetailPanel } from "../components/waiter-call-detail-panel";
import { WaiterCallQueue } from "../components/waiter-call-queue";

type Notice = {
  tone: "success" | "error";
  message: string;
};

type ResolveWaiterCallAction = {
  waiterCallId: string;
  resolutionNote?: string | null;
};

type CancelWaiterCallAction = {
  waiterCallId: string;
  reason?: string | null;
};

type ResolveAttentionAction = {
  sessionId: string;
  note?: string | null;
};

type MuteAttentionAction = ResolveAttentionAction & {
  minutes: number;
};

const emptyRecords: Record<string, unknown>[] = [];
const terminalWaiterCallStatuses = new Set(["resolved", "cancelled"]);

function attentionQueryStatus(status: AttentionStatusFilter) {
  return status === "active" ? undefined : status;
}

function countWaiterCallsByStatus(
  waiterCalls: Record<string, unknown>[],
  predicate: (status: string) => boolean
) {
  return waiterCalls.filter((waiterCall) =>
    predicate(getWaiterCallStatus(waiterCall))
  ).length;
}

function countAttentionByStatus(
  attentionQueue: Record<string, unknown>[],
  predicate: (status: string, priority: string) => boolean
) {
  return attentionQueue.filter((attention) =>
    predicate(getAttentionStatus(attention), getAttentionPriority(attention))
  ).length;
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

function WaiterDashboardActions() {
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

function WaiterDashboardContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const [waiterCallStatus, setWaiterCallStatus] =
    useState<WaiterCallStatus>("open");
  const [waiterCallType, setWaiterCallType] =
    useState<WaiterCallType>("all");
  const [attentionStatus, setAttentionStatus] =
    useState<AttentionStatusFilter>("active");
  const [attentionPriority, setAttentionPriority] =
    useState<TableAttentionPriority>("all");
  const [userSelectedWaiterCallId, setUserSelectedWaiterCallId] =
    useState<string>();
  const [userSelectedSessionId, setUserSelectedSessionId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const allWaiterCallsQuery = useQuery({
    queryKey: staffQueryKeys.staffWaiterCalls(selectedBranchId, "all", "all"),
    queryFn: () =>
      getBranchWaiterCalls(
        selectedBranchId ?? "",
        { status: "all", type: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const waiterCallsQuery = useQuery({
    queryKey: staffQueryKeys.staffWaiterCalls(
      selectedBranchId,
      waiterCallStatus,
      waiterCallType
    ),
    queryFn: () =>
      getBranchWaiterCalls(
        selectedBranchId ?? "",
        { status: waiterCallStatus, type: waiterCallType },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const allAttentionQuery = useQuery({
    queryKey: staffQueryKeys.staffAttentionQueue(
      selectedBranchId,
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchAttentionQueue(
        selectedBranchId ?? "",
        { status: "all", priority: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const attentionQueueQuery = useQuery({
    queryKey: staffQueryKeys.staffAttentionQueue(
      selectedBranchId,
      attentionStatus,
      attentionPriority
    ),
    queryFn: () =>
      getBranchAttentionQueue(
        selectedBranchId ?? "",
        {
          status: attentionQueryStatus(attentionStatus),
          priority: attentionPriority,
          limit: 50
        },
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
        { channel: "all", limit: 10 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const waiterCalls = useMemo(
    () => waiterCallsQuery.data?.waiterCalls ?? emptyRecords,
    [waiterCallsQuery.data?.waiterCalls]
  );
  const allWaiterCalls = useMemo(
    () => allWaiterCallsQuery.data?.waiterCalls ?? waiterCalls,
    [allWaiterCallsQuery.data?.waiterCalls, waiterCalls]
  );
  const attentionQueue = useMemo(
    () => attentionQueueQuery.data?.attentionQueue ?? emptyRecords,
    [attentionQueueQuery.data?.attentionQueue]
  );
  const allAttentionQueue = useMemo(
    () => allAttentionQuery.data?.attentionQueue ?? attentionQueue,
    [allAttentionQuery.data?.attentionQueue, attentionQueue]
  );
  const selectedWaiterCallStillVisible = useMemo(
    () =>
      waiterCalls.some(
        (waiterCall) => getWaiterCallId(waiterCall) === userSelectedWaiterCallId
      ),
    [waiterCalls, userSelectedWaiterCallId]
  );
  const selectedWaiterCallId =
    selectedWaiterCallStillVisible && userSelectedWaiterCallId
      ? userSelectedWaiterCallId
      : getWaiterCallId(waiterCalls[0]);
  const selectedAttentionStillVisible = useMemo(
    () =>
      attentionQueue.some(
        (attention) => getAttentionSessionId(attention) === userSelectedSessionId
      ),
    [attentionQueue, userSelectedSessionId]
  );
  const selectedSessionId =
    selectedAttentionStillVisible && userSelectedSessionId
      ? userSelectedSessionId
      : getAttentionSessionId(attentionQueue[0]);
  const waiterCallDetailQuery = useQuery({
    queryKey: staffQueryKeys.staffWaiterCall(selectedWaiterCallId),
    queryFn: () => getWaiterCallDetail(selectedWaiterCallId ?? "", accessToken),
    enabled: Boolean(selectedWaiterCallId && accessToken),
    staleTime: 5_000
  });
  const attentionDetailQuery = useQuery({
    queryKey: staffQueryKeys.staffTableSessionAttention(selectedSessionId),
    queryFn: () =>
      getTableSessionAttention(selectedSessionId ?? "", accessToken),
    enabled: Boolean(selectedSessionId && accessToken),
    staleTime: 5_000
  });
  const refreshBranch = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffWaiterCalls(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffAttentionQueue(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });
  };
  const invalidateWaiterState = (
    waiterCallId?: string,
    sessionId?: string
  ) => {
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffWaiterCalls(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffAttentionQueue(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });

    if (waiterCallId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.staffWaiterCall(waiterCallId)
      });
    }

    if (sessionId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.staffTableSessionAttention(sessionId)
      });
    }
  };
  const invalidateAttentionState = (sessionId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffAttentionQueue(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.staffWaiterCalls(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });

    if (sessionId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.staffTableSessionAttention(sessionId)
      });
    }
  };
  const acknowledgeMutation = useMutation({
    mutationFn: (waiterCallId: string) =>
      acknowledgeWaiterCall(
        waiterCallId,
        { staffUserId: staffUser?.id },
        accessToken
      ),
    onSuccess: (result, waiterCallId) => {
      setNotice({ tone: "success", message: "Waiter call acknowledged." });
      invalidateWaiterState(
        waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Waiter call could not be acknowledged. ${error.message}`
      });
    }
  });
  const resolveWaiterCallMutation = useMutation({
    mutationFn: ({ waiterCallId, resolutionNote }: ResolveWaiterCallAction) =>
      resolveWaiterCall(
        waiterCallId,
        { staffUserId: staffUser?.id, resolutionNote },
        accessToken
      ),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: "Waiter call resolved." });
      invalidateWaiterState(
        variables.waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Waiter call could not be resolved. ${error.message}`
      });
    }
  });
  const cancelWaiterCallMutation = useMutation({
    mutationFn: ({ waiterCallId, reason }: CancelWaiterCallAction) =>
      cancelWaiterCall(waiterCallId, { reason }, accessToken),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: "Waiter call cancelled." });
      invalidateWaiterState(
        variables.waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Waiter call could not be cancelled. ${error.message}`
      });
    }
  });
  const resolveAttentionMutation = useMutation({
    mutationFn: ({ sessionId, note }: ResolveAttentionAction) =>
      resolveTableSessionAttention(
        sessionId,
        { staffUserId: staffUser?.id, note },
        accessToken
      ),
    onSuccess: (_, variables) => {
      setNotice({ tone: "success", message: "Table attention resolved." });
      invalidateAttentionState(variables.sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Attention could not be resolved. ${error.message}`
      });
    }
  });
  const muteAttentionMutation = useMutation({
    mutationFn: ({ sessionId, minutes, note }: MuteAttentionAction) =>
      muteTableSessionAttention(
        sessionId,
        { staffUserId: staffUser?.id, minutes, note },
        accessToken
      ),
    onSuccess: (_, variables) => {
      setNotice({
        tone: "success",
        message: `Table attention muted for ${variables.minutes} minutes.`
      });
      invalidateAttentionState(variables.sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Attention could not be muted. ${error.message}`
      });
    }
  });
  const recalculateAttentionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      recalculateTableSessionAttention(
        sessionId,
        { source: "staff_waiter_dashboard" },
        accessToken
      ),
    onSuccess: (_, sessionId) => {
      setNotice({ tone: "success", message: "Attention recalculated." });
      invalidateAttentionState(sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Attention could not be recalculated. ${error.message}`
      });
    }
  });
  const rebuildAttentionMutation = useMutation({
    mutationFn: (branchId: string) => rebuildBranchAttention(branchId, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: "Branch attention rebuilt." });
      invalidateAttentionState(selectedSessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Branch attention could not be rebuilt. ${error.message}`
      });
    }
  });

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="No accessible branch"
        description="This staff account does not expose a branch for waiter operations yet."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Open calls"
          value={String(
            countWaiterCallsByStatus(
              allWaiterCalls,
              (status) => status === "open"
            )
          )}
          description="Waiting for staff"
          icon={<BellRing className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Acknowledged"
          value={String(
            countWaiterCallsByStatus(
              allWaiterCalls,
              (status) => status === "acknowledged"
            )
          )}
          description="Staff is handling"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label="Urgent"
          value={String(
            countAttentionByStatus(
              allAttentionQueue,
              (status, priority) => status === "urgent" || priority === "urgent"
            )
          )}
          description="Immediate attention"
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Needs attention"
          value={String(
            countAttentionByStatus(
              allAttentionQueue,
              (status) => status === "needs_attention"
            )
          )}
          description="Active floor signals"
          icon={<Footprints className="size-4" aria-hidden="true" />}
          tone="accent"
        />
        <MetricCard
          label="Closed signals"
          value={String(
            countAttentionByStatus(allAttentionQueue, (status) =>
              terminalWaiterCallStatuses.has(status) || status === "muted"
            )
          )}
          description="Muted or resolved"
          icon={<HandPlatter className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label="Realtime"
          value={realtime.state === "connected" ? "Live" : "Watch"}
          description={humanizeStatus(realtime.state)}
          icon={<Radio className="size-4" aria-hidden="true" />}
          tone={realtime.state === "connected" ? "success" : "warning"}
        />
      </section>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Waiter / Floor</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {staffUser?.name || staffUser?.email || "Staff user"} is viewing
              live waiter calls and table attention for the selected branch.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={refreshBranch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh branch
            </Button>
            <Button
              variant="secondary"
              onClick={() => rebuildAttentionMutation.mutate(selectedBranchId)}
              disabled={rebuildAttentionMutation.isPending}
            >
              <RefreshCw
                className={
                  rebuildAttentionMutation.isPending
                    ? "size-4 animate-spin"
                    : "size-4"
                }
                aria-hidden="true"
              />
              {rebuildAttentionMutation.isPending
                ? "Rebuilding..."
                : "Rebuild attention"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <NoticeBanner notice={notice} />

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,28rem)_1fr]">
        <WaiterCallQueue
          waiterCalls={waiterCalls}
          status={waiterCallStatus}
          type={waiterCallType}
          selectedWaiterCallId={selectedWaiterCallId}
          isLoading={waiterCallsQuery.isPending}
          error={waiterCallsQuery.error ?? undefined}
          onStatusChange={setWaiterCallStatus}
          onTypeChange={setWaiterCallType}
          onSelectWaiterCall={setUserSelectedWaiterCallId}
          onRefresh={refreshBranch}
        />
        <WaiterCallDetailPanel
          waiterCall={waiterCallDetailQuery.data}
          isLoading={waiterCallDetailQuery.isPending && Boolean(selectedWaiterCallId)}
          error={waiterCallDetailQuery.error ?? undefined}
          acknowledgePending={acknowledgeMutation.isPending}
          resolvePending={resolveWaiterCallMutation.isPending}
          cancelPending={cancelWaiterCallMutation.isPending}
          onAcknowledge={() => {
            if (selectedWaiterCallId) {
              acknowledgeMutation.mutate(selectedWaiterCallId);
            }
          }}
          onResolve={(resolutionNote) => {
            if (selectedWaiterCallId) {
              resolveWaiterCallMutation.mutate({
                waiterCallId: selectedWaiterCallId,
                resolutionNote
              });
            }
          }}
          onCancel={(reason) => {
            if (selectedWaiterCallId) {
              cancelWaiterCallMutation.mutate({
                waiterCallId: selectedWaiterCallId,
                reason
              });
            }
          }}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,28rem)_1fr]">
        <AttentionQueue
          attentionQueue={attentionQueue}
          status={attentionStatus}
          priority={attentionPriority}
          selectedSessionId={selectedSessionId}
          isLoading={attentionQueueQuery.isPending}
          error={attentionQueueQuery.error ?? undefined}
          onStatusChange={setAttentionStatus}
          onPriorityChange={setAttentionPriority}
          onSelectAttention={setUserSelectedSessionId}
          onRefresh={refreshBranch}
        />
        <AttentionDetailPanel
          attention={attentionDetailQuery.data}
          isLoading={attentionDetailQuery.isPending && Boolean(selectedSessionId)}
          error={attentionDetailQuery.error ?? undefined}
          resolvePending={resolveAttentionMutation.isPending}
          mutePending={muteAttentionMutation.isPending}
          recalculatePending={recalculateAttentionMutation.isPending}
          onResolve={(note) => {
            if (selectedSessionId) {
              resolveAttentionMutation.mutate({ sessionId: selectedSessionId, note });
            }
          }}
          onMute={(minutes, note) => {
            if (selectedSessionId) {
              muteAttentionMutation.mutate({
                sessionId: selectedSessionId,
                minutes,
                note
              });
            }
          }}
          onRecalculate={() => {
            if (selectedSessionId) {
              recalculateAttentionMutation.mutate(selectedSessionId);
            }
          }}
        />
      </section>

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>
            Recent branch realtime events for waiter calls, bills, preparation,
            and attention updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {realtimeEventsQuery.isError ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
              {realtimeEventsQuery.error.message}
            </div>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
            <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
              Activity will appear here after service requests, attention
              changes, or branch workflow events reach the stream.
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
              {getRecordString(event, "waiterCallId") ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Call {shortId(getRecordString(event, "waiterCallId"))}
                </p>
              ) : null}
              {getRecordString(event, "tableSessionId") ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Session {shortId(getRecordString(event, "tableSessionId"))}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function WaiterDashboardPage() {
  return (
    <StaffPageShell
      title="Waiter dashboard"
      description="Live floor operations for waiter calls, table attention, realtime refresh, and service recovery actions."
      actions={<WaiterDashboardActions />}
    >
      <StaffAuthGate>
        <WaiterDashboardContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
