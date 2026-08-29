"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChefHat,
  ClipboardList,
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
import {
  getOrderId,
  getOrderKitchenTickets,
  getOrderNumber,
  getOrderStatus
} from "@/features/staff/cashier-data";
import {
  getPrintJobStatus,
  getTicketDisplayCode,
  getTicketPrintJobs,
  getTicketStation,
  getTicketStatus
} from "@/features/staff/kds-data";
import { ServiceStaffShell } from "@/features/staff/service-staff-shell";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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
  getBranchTableAdminOverview,
  getBranchWaiterCalls,
  getReadyToServeOrders,
  getTableSessionAttention,
  getWaiterCallDetail,
  muteTableSessionAttention,
  rebuildBranchAttention,
  recalculateTableSessionAttention,
  resolveTableSessionAttention,
  resolveWaiterCall,
  serveOrder,
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
import { ServiceFloorBoard } from "../components/service-floor-board";
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

type BadgeVariant = "default" | "muted" | "success" | "warning" | "danger";

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

function getReadyTicketVariant(status: string): BadgeVariant {
  if (status === "ready" || status === "served") {
    return "success";
  }

  if (status === "cancelled" || status === "voided") {
    return "danger";
  }

  return status === "queued" || status === "in_progress" ? "warning" : "muted";
}

function hasFailedPrint(ticket: Record<string, unknown>) {
  return getTicketPrintJobs(ticket).some(
    (printJob) => getPrintJobStatus(printJob) === "failed"
  );
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
  const t = useTranslations("staff");
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
        {t("actions.staffLogin")}
      </Link>
    );
  }

  return (
    <>
      <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        {t("actions.overview")}
      </Link>
      <Link
        href="/staff/cashier"
        className={buttonVariants({ variant: "ghost" })}
      >
        <Receipt className="size-4" aria-hidden="true" />
        {t("actions.cashier")}
      </Link>
      <Link
        href="/staff/kitchen"
        className={buttonVariants({ variant: "ghost" })}
      >
        <ChefHat className="size-4" aria-hidden="true" />
        {t("actions.kitchen")}
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
        {t("actions.logout")}
      </Button>
    </>
  );
}

function WaiterDashboardContent() {
  const t = useTranslations("staff");
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
  const selectedCompanyId = selectedBranchAccess?.company.id;
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
  const floorOverviewQuery = useQuery({
    queryKey: staffQueryKeys.branchTableAdminOverview(
      selectedCompanyId,
      selectedBranchId
    ),
    queryFn: () =>
      getBranchTableAdminOverview(
        selectedCompanyId ?? "",
        selectedBranchId,
        accessToken
      ),
    enabled: Boolean(selectedCompanyId && selectedBranchId && accessToken),
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
  const readyOrdersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, "ready"),
    queryFn: () => getReadyToServeOrders(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
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
  const readyOrders = useMemo(
    () => readyOrdersQuery.data?.orders ?? emptyRecords,
    [readyOrdersQuery.data?.orders]
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
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchTableAdminOverview(
        selectedCompanyId,
        selectedBranchId
      )
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
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchTableAdminOverview(
        selectedCompanyId,
        selectedBranchId
      )
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
  const invalidateOrderState = (orderId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchTableAdminOverview(
        selectedCompanyId,
        selectedBranchId
      )
    });

    if (orderId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(orderId)
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
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchTableAdminOverview(
        selectedCompanyId,
        selectedBranchId
      )
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
      setNotice({ tone: "success", message: t("waiter.acknowledged") });
      invalidateWaiterState(
        waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("waiter.acknowledgeError", { message: error.message })
      });
    }
  });
  const serveOrderMutation = useMutation({
    mutationFn: (orderId: string) => serveOrder(orderId, {}, accessToken),
    onSuccess: (_, orderId) => {
      setNotice({ tone: "success", message: t("waiter.orderMarkedServed") });
      invalidateOrderState(orderId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("waiter.orderServeError", { message: error.message })
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
      setNotice({ tone: "success", message: t("waiter.callResolved") });
      invalidateWaiterState(
        variables.waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("waiter.callResolveError", { message: error.message })
      });
    }
  });
  const cancelWaiterCallMutation = useMutation({
    mutationFn: ({ waiterCallId, reason }: CancelWaiterCallAction) =>
      cancelWaiterCall(waiterCallId, { reason }, accessToken),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: t("waiter.callCancelled") });
      invalidateWaiterState(
        variables.waiterCallId,
        getRecordString(getWaiterCallTableSession(result), "id")
      );
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("waiter.callCancelError", { message: error.message })
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
      setNotice({ tone: "success", message: t("attention.resolved") });
      invalidateAttentionState(variables.sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.resolveError", { message: error.message })
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
        message: t("attention.mutedFor", { minutes: variables.minutes })
      });
      invalidateAttentionState(variables.sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.muteError", { message: error.message })
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
      setNotice({ tone: "success", message: t("attention.recalculated") });
      invalidateAttentionState(sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.recalculateError", { message: error.message })
      });
    }
  });
  const rebuildAttentionMutation = useMutation({
    mutationFn: (branchId: string) => rebuildBranchAttention(branchId, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: t("attention.branchRebuilt") });
      invalidateAttentionState(selectedSessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.branchRebuildError", { message: error.message })
      });
    }
  });

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title={t("waiter.emptyBranchTitle")}
        description={t("waiter.emptyBranchDescription")}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label={t("waiter.openCallsLabel")}
          value={String(
            countWaiterCallsByStatus(
              allWaiterCalls,
              (status) => status === "open"
            )
          )}
          description={t("waiter.openCallsDescription")}
          icon={<BellRing className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label={t("waiter.acknowledgedLabel")}
          value={String(
            countWaiterCallsByStatus(
              allWaiterCalls,
              (status) => status === "acknowledged"
            )
          )}
          description={t("waiter.acknowledgedDescription")}
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label={t("attention.immediateAttentionLabel")}
          value={String(
            countAttentionByStatus(
              allAttentionQueue,
              (status, priority) => status === "urgent" || priority === "urgent"
            )
          )}
          description={t("attention.immediateAttentionDescription")}
          icon={<AlertTriangle className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label={t("attention.needsAttentionLabel")}
          value={String(
            countAttentionByStatus(
              allAttentionQueue,
              (status) => status === "needs_attention"
            )
          )}
          description={t("attention.needsAttentionDescription")}
          icon={<Footprints className="size-4" aria-hidden="true" />}
          tone="accent"
        />
        <MetricCard
          label={t("attention.closedSignalsLabel")}
          value={String(
            countAttentionByStatus(allAttentionQueue, (status) =>
              terminalWaiterCallStatuses.has(status) || status === "muted"
            )
          )}
          description={t("attention.closedSignalsDescription")}
          icon={<HandPlatter className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label={t("realtime.metricLabel")}
          value={
            realtime.state === "connected"
              ? t("cashier.realtimeValueLive")
              : t("cashier.realtimeValueWatch")
          }
          description={humanizeStatus(realtime.state)}
          icon={<Radio className="size-4" aria-hidden="true" />}
          tone={realtime.state === "connected" ? "success" : "warning"}
        />
      </section>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{t("waiter.badge")}</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {t("waiter.viewingDescription", {
                name:
                  staffUser?.name ||
                  staffUser?.email ||
                  t("cashier.staffUserFallback"),
              })}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={refreshBranch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("actions.refreshBranch")}
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
                ? t("actions.rebuilding")
                : t("actions.rebuildAttention")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <NoticeBanner notice={notice} />

      <ServiceFloorBoard
        overview={floorOverviewQuery.data}
        isLoading={floorOverviewQuery.isPending}
        error={floorOverviewQuery.error ?? undefined}
        selectedSessionId={selectedSessionId}
        onSelectSession={setUserSelectedSessionId}
      />

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

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>{t("waiter.readyOrdersTitle")}</CardTitle>
          <CardDescription>{t("waiter.readyOrdersDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {readyOrders.length === 0 ? (
            <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
              {t("waiter.readyOrdersEmpty")}
            </p>
          ) : null}
          {readyOrders.map((order, index) => {
            const orderId = getOrderId(order);
            const status = getOrderStatus(order);
            const kitchenTickets = getOrderKitchenTickets(order);

            return (
              <div
                key={orderId || String(index)}
                className="rounded-card border bg-surface/75 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {getOrderNumber(order)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {humanizeStatus(status)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => orderId && serveOrderMutation.mutate(orderId)}
                    disabled={
                      !orderId ||
                      status !== "ready" ||
                      serveOrderMutation.isPending
                    }
                  >
                    <HandPlatter className="size-4" aria-hidden="true" />
                    {t("actions.serve")}
                  </Button>
                </div>
                {kitchenTickets.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {kitchenTickets.map((ticket, ticketIndex) => {
                      const ticketStatus = getTicketStatus(ticket);

                      return (
                        <Badge
                          key={getTicketDisplayCode(ticket) || String(ticketIndex)}
                          variant={
                            hasFailedPrint(ticket)
                              ? "warning"
                              : getReadyTicketVariant(ticketStatus)
                          }
                        >
                          <ClipboardList
                            className="me-1 size-3"
                            aria-hidden="true"
                          />
                          {humanizeStatus(getTicketStation(ticket))}:{" "}
                          {humanizeStatus(ticketStatus)}
                        </Badge>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {t("waiter.readyOrdersNoTickets")}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>{t("waiter.activityTitle")}</CardTitle>
          <CardDescription>{t("waiter.activityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {realtimeEventsQuery.isError ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="me-2 inline size-4" aria-hidden="true" />
              {realtimeEventsQuery.error.message}
            </div>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
            <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
              {t("waiter.activityEmpty")}
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
                  {t("waiter.callFallback", {
                    callId: shortId(getRecordString(event, "waiterCallId")),
                  })}
                </p>
              ) : null}
              {getRecordString(event, "tableSessionId") ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("attention.sessionFallback", {
                    sessionId: shortId(getRecordString(event, "tableSessionId")),
                  })}
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
  const t = useTranslations("staff");

  return (
    <ServiceStaffShell
      mode="waiter"
      title={t("waiter.dashboardTitle")}
      description={t("waiter.dashboardDescription")}
      actions={<WaiterDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["waiter_calls.read"]} branchScoped>
        <WaiterDashboardContent />
      </StaffAuthGate>
    </ServiceStaffShell>
  );
}
