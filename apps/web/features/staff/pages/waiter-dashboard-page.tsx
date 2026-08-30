"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  ClipboardList,
  HandPlatter,
  LogIn,
  LogOut,
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
import { ServiceStaffShell, useServiceView } from "@/features/staff/service-staff-shell";
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
import { isEntityPending } from "@/lib/interaction/pending-scope";
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
  const serviceView = useServiceView("waiter");
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
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingWaiterCallActions, setPendingWaiterCallActions] = useState<
    Record<string, "acknowledge" | "resolve" | "cancel">
  >({});
  const [pendingAttentionActions, setPendingAttentionActions] = useState<
    Record<string, "resolve" | "mute" | "recalculate">
  >({});
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
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });
  const attentionDetailQuery = useQuery({
    queryKey: staffQueryKeys.staffTableSessionAttention(selectedSessionId),
    queryFn: () =>
      getTableSessionAttention(selectedSessionId ?? "", accessToken),
    enabled: Boolean(selectedSessionId && accessToken),
    staleTime: 5_000,
    placeholderData: keepPreviousData,
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
    onMutate: (waiterCallId) => {
      setPendingWaiterCallActions((current) => ({
        ...current,
        [waiterCallId]: "acknowledge",
      }));
    },
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
    },
    onSettled: (_result, _error, waiterCallId) => {
      setPendingWaiterCallActions((current) => {
        const next = { ...current };
        delete next[waiterCallId];
        return next;
      });
    },
  });
  const serveOrderMutation = useMutation({
    mutationFn: (orderId: string) => serveOrder(orderId, {}, accessToken),
    onMutate: (orderId) => {
      setPendingOrderIds((current) => new Set(current).add(orderId));
    },
    onSuccess: (_, orderId) => {
      setNotice({ tone: "success", message: t("waiter.orderMarkedServed") });
      invalidateOrderState(orderId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("waiter.orderServeError", { message: error.message })
      });
    },
    onSettled: (_result, _error, orderId) => {
      setPendingOrderIds((current) => {
        const next = new Set(current);
        next.delete(orderId);
        return next;
      });
    },
  });
  const resolveWaiterCallMutation = useMutation({
    mutationFn: ({ waiterCallId, resolutionNote }: ResolveWaiterCallAction) =>
      resolveWaiterCall(
        waiterCallId,
        { staffUserId: staffUser?.id, resolutionNote },
        accessToken
      ),
    onMutate: ({ waiterCallId }) => {
      setPendingWaiterCallActions((current) => ({
        ...current,
        [waiterCallId]: "resolve",
      }));
    },
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
    },
    onSettled: (_result, _error, variables) => {
      setPendingWaiterCallActions((current) => {
        const next = { ...current };
        delete next[variables.waiterCallId];
        return next;
      });
    },
  });
  const cancelWaiterCallMutation = useMutation({
    mutationFn: ({ waiterCallId, reason }: CancelWaiterCallAction) =>
      cancelWaiterCall(waiterCallId, { reason }, accessToken),
    onMutate: ({ waiterCallId }) => {
      setPendingWaiterCallActions((current) => ({
        ...current,
        [waiterCallId]: "cancel",
      }));
    },
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
    },
    onSettled: (_result, _error, variables) => {
      setPendingWaiterCallActions((current) => {
        const next = { ...current };
        delete next[variables.waiterCallId];
        return next;
      });
    },
  });
  const resolveAttentionMutation = useMutation({
    mutationFn: ({ sessionId, note }: ResolveAttentionAction) =>
      resolveTableSessionAttention(
        sessionId,
        { staffUserId: staffUser?.id, note },
        accessToken
      ),
    onMutate: ({ sessionId }) => {
      setPendingAttentionActions((current) => ({
        ...current,
        [sessionId]: "resolve",
      }));
    },
    onSuccess: (_, variables) => {
      setNotice({ tone: "success", message: t("attention.resolved") });
      invalidateAttentionState(variables.sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.resolveError", { message: error.message })
      });
    },
    onSettled: (_result, _error, variables) => {
      setPendingAttentionActions((current) => {
        const next = { ...current };
        delete next[variables.sessionId];
        return next;
      });
    },
  });
  const muteAttentionMutation = useMutation({
    mutationFn: ({ sessionId, minutes, note }: MuteAttentionAction) =>
      muteTableSessionAttention(
        sessionId,
        { staffUserId: staffUser?.id, minutes, note },
        accessToken
      ),
    onMutate: ({ sessionId }) => {
      setPendingAttentionActions((current) => ({
        ...current,
        [sessionId]: "mute",
      }));
    },
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
    },
    onSettled: (_result, _error, variables) => {
      setPendingAttentionActions((current) => {
        const next = { ...current };
        delete next[variables.sessionId];
        return next;
      });
    },
  });
  const recalculateAttentionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      recalculateTableSessionAttention(
        sessionId,
        { source: "staff_waiter_dashboard" },
        accessToken
      ),
    onMutate: (sessionId) => {
      setPendingAttentionActions((current) => ({
        ...current,
        [sessionId]: "recalculate",
      }));
    },
    onSuccess: (_, sessionId) => {
      setNotice({ tone: "success", message: t("attention.recalculated") });
      invalidateAttentionState(sessionId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("attention.recalculateError", { message: error.message })
      });
    },
    onSettled: (_result, _error, sessionId) => {
      setPendingAttentionActions((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    },
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

  const prefetchWaiterCall = (waiterCallId: string) => {
    if (!accessToken) return;
    void queryClient.prefetchQuery({
      queryKey: staffQueryKeys.staffWaiterCall(waiterCallId),
      queryFn: () => getWaiterCallDetail(waiterCallId, accessToken),
      staleTime: 5_000,
    });
  };
  const prefetchAttention = (sessionId: string) => {
    if (!accessToken) return;
    void queryClient.prefetchQuery({
      queryKey: staffQueryKeys.staffTableSessionAttention(sessionId),
      queryFn: () => getTableSessionAttention(sessionId, accessToken),
      staleTime: 5_000,
    });
  };
  const selectedWaiterCallAction = selectedWaiterCallId
    ? pendingWaiterCallActions[selectedWaiterCallId]
    : undefined;
  const selectedAttentionAction = selectedSessionId
    ? pendingAttentionActions[selectedSessionId]
    : undefined;

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
      <div
        data-service-status
        className="flex flex-wrap items-center gap-2 border-b border-[#342A23] bg-[#17120F] px-3 py-2 text-xs text-[#B8AA9E]"
      >
        <Badge variant="muted">{selectedBranch.name}</Badge>
        <StaffRealtimeStatus
          state={realtime.state}
          lastEventType={realtime.lastEventType}
        />
        <Button
          size="sm"
          variant="ghost"
          className="ms-auto min-h-8 text-[#AFA195] hover:bg-[#292019] hover:text-[#F6EBDD]"
          onClick={refreshBranch}
          aria-label={t("actions.refreshBranch")}
        >
          <RefreshCw className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-8 text-[#AFA195] hover:bg-[#292019] hover:text-[#F6EBDD]"
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

      <NoticeBanner notice={notice} />

      {serviceView === "floor" ? (
      <div id="floor" className="min-h-[calc(100vh-8rem)]">
        <ServiceFloorBoard
          overview={floorOverviewQuery.data}
          isLoading={floorOverviewQuery.isPending}
          error={floorOverviewQuery.error ?? undefined}
          selectedSessionId={selectedSessionId}
          onSelectSession={setUserSelectedSessionId}
        />
      </div>
      ) : null}

      {serviceView === "attention" ? (
      <>
      <section id="attention" className="grid min-h-[calc(100vh-8rem)] gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
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
          onPrefetchAttention={prefetchAttention}
          onRefresh={refreshBranch}
        />
        <AttentionDetailPanel
          attention={attentionDetailQuery.data}
          isLoading={attentionDetailQuery.isPending && Boolean(selectedSessionId)}
          isRefreshing={attentionDetailQuery.isPlaceholderData}
          error={attentionDetailQuery.error ?? undefined}
          resolvePending={selectedAttentionAction === "resolve"}
          mutePending={selectedAttentionAction === "mute"}
          recalculatePending={selectedAttentionAction === "recalculate"}
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

      <section className="grid gap-3 xl:grid-cols-[360px_minmax(0,1fr)]">
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
          onPrefetchWaiterCall={prefetchWaiterCall}
          onRefresh={refreshBranch}
        />
        <WaiterCallDetailPanel
          waiterCall={waiterCallDetailQuery.data}
          isLoading={waiterCallDetailQuery.isPending && Boolean(selectedWaiterCallId)}
          isRefreshing={waiterCallDetailQuery.isPlaceholderData}
          error={waiterCallDetailQuery.error ?? undefined}
          acknowledgePending={selectedWaiterCallAction === "acknowledge"}
          resolvePending={selectedWaiterCallAction === "resolve"}
          cancelPending={selectedWaiterCallAction === "cancel"}
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
                    aria-busy={isEntityPending(pendingOrderIds, orderId)}
                    onClick={() => {
                      if (orderId && !isEntityPending(pendingOrderIds, orderId)) {
                        serveOrderMutation.mutate(orderId);
                      }
                    }}
                    disabled={
                      !orderId ||
                      status !== "ready" ||
                      isEntityPending(pendingOrderIds, orderId)
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
      </>
      ) : null}
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
