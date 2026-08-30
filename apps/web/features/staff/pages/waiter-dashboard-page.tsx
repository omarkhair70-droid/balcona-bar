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
  LogIn,
  LogOut,
  RefreshCw
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getAttentionSessionId } from "@/features/staff/attention-data";
import {
  getOrderId,
  getOrderTableSessionId
} from "@/features/staff/cashier-data";
import { ServiceStaffShell, useServiceView } from "@/features/staff/service-staff-shell";
import { getRecordString } from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import {
  getWaiterCallId,
  getWaiterCallTableSession
} from "@/features/staff/waiter-data";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  acknowledgeWaiterCall,
  getBranchAttentionQueue,
  getBranchTableAdminOverview,
  getBranchWaiterCalls,
  getBill,
  getReadyToServeOrders,
  getTableSessionAttention,
  getTableSessionOrders,
  muteTableSessionAttention,
  recalculateTableSessionAttention,
  resolveTableSessionAttention,
  serveOrder,
  staffLogout
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type { TableAttentionPriority } from "@/lib/api/types";
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

type Notice = {
  tone: "success" | "error";
  message: string;
};

type ResolveAttentionAction = {
  sessionId: string;
  note?: string | null;
};

type MuteAttentionAction = ResolveAttentionAction & {
  minutes: number;
};

const emptyRecords: Record<string, unknown>[] = [];

function attentionQueryStatus(status: AttentionStatusFilter) {
  return status === "active" ? undefined : status;
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
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
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
      <StaffRealtimeStatus
        state={realtime.state}
        lastEventType={realtime.lastEventType}
      />
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const serviceView = useServiceView("waiter");
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const [attentionStatus, setAttentionStatus] =
    useState<AttentionStatusFilter>("active");
  const [attentionPriority, setAttentionPriority] =
    useState<TableAttentionPriority>("all");
  const [userSelectedSessionId, setUserSelectedSessionId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [pendingWaiterCallActions, setPendingWaiterCallActions] = useState<
    Record<string, "acknowledge">
  >({});
  const [pendingAttentionActions, setPendingAttentionActions] = useState<
    Record<string, "resolve" | "mute" | "recalculate">
  >({});
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const selectedCompanyId = selectedBranchAccess?.company.id;
  const waiterCallsQuery = useQuery({
    queryKey: staffQueryKeys.staffWaiterCalls(
      selectedBranchId,
      "open",
      "all"
    ),
    queryFn: () =>
      getBranchWaiterCalls(
        selectedBranchId ?? "",
        { status: "open", type: "all" },
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
  const attentionQueue = useMemo(
    () => attentionQueueQuery.data?.attentionQueue ?? emptyRecords,
    [attentionQueueQuery.data?.attentionQueue]
  );
  const readyOrders = useMemo(
    () => readyOrdersQuery.data?.orders ?? emptyRecords,
    [readyOrdersQuery.data?.orders]
  );
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
  const floorSessionOrdersQuery = useQuery({
    queryKey: ["staff", "service", "floor", "session-orders", selectedSessionId],
    queryFn: () =>
      getTableSessionOrders(selectedSessionId ?? "", accessToken),
    enabled: Boolean(
      serviceView === "floor" && selectedSessionId && accessToken
    ),
    staleTime: 5_000,
    placeholderData: keepPreviousData
  });
  const floorSessionBillQuery = useQuery({
    queryKey: ["staff", "service", "floor", "session-bill", selectedSessionId],
    queryFn: () => getBill(selectedSessionId ?? "", accessToken),
    enabled: Boolean(
      serviceView === "floor" && selectedSessionId && accessToken
    ),
    staleTime: 5_000,
    placeholderData: keepPreviousData
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
  const prefetchAttention = (sessionId: string) => {
    if (!accessToken) return;
    void queryClient.prefetchQuery({
      queryKey: staffQueryKeys.staffTableSessionAttention(sessionId),
      queryFn: () => getTableSessionAttention(sessionId, accessToken),
      staleTime: 5_000,
    });
  };
  const relatedWaiterCall = useMemo(
    () =>
      waiterCalls.find(
        (waiterCall) =>
          getRecordString(getWaiterCallTableSession(waiterCall), "id") ===
          selectedSessionId
      ),
    [selectedSessionId, waiterCalls]
  );
  const relatedWaiterCallId = getWaiterCallId(relatedWaiterCall);
  const relatedReadyOrder = useMemo(
    () =>
      readyOrders.find(
        (order) => getOrderTableSessionId(order) === selectedSessionId
      ),
    [readyOrders, selectedSessionId]
  );
  const relatedReadyOrderId = getOrderId(relatedReadyOrder);
  const relatedWaiterCallPending = relatedWaiterCallId
    ? pendingWaiterCallActions[relatedWaiterCallId] === "acknowledge"
    : false;
  const relatedReadyOrderPending = relatedReadyOrderId
    ? pendingOrderIds.has(relatedReadyOrderId)
    : false;
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
      <NoticeBanner notice={notice} />

      {serviceView === "floor" ? (
      <div id="floor" className="min-h-[calc(100vh-8rem)]">
        <ServiceFloorBoard
          overview={floorOverviewQuery.data}
          isLoading={floorOverviewQuery.isPending}
          error={floorOverviewQuery.error ?? undefined}
          selectedSessionId={selectedSessionId}
          onSelectSession={setUserSelectedSessionId}
          sessionOrders={floorSessionOrdersQuery.data?.orders ?? emptyRecords}
          sessionBill={floorSessionBillQuery.data}
          contextLoading={
            floorSessionOrdersQuery.isPending || floorSessionBillQuery.isPending
          }
          onOpenOrders={() => router.push("/service/cashier#orders")}
          onOpenAttention={() => router.push("/service/waiter#attention")}
          onOpenBills={() => router.push("/service/cashier#bills")}
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
          acknowledgeWaiterCallPending={relatedWaiterCallPending}
          serveReadyOrderPending={relatedReadyOrderPending}
          onAcknowledgeWaiterCall={
            relatedWaiterCallId
              ? () => acknowledgeMutation.mutate(relatedWaiterCallId)
              : undefined
          }
          onServeReadyOrder={
            relatedReadyOrderId
              ? () => serveOrderMutation.mutate(relatedReadyOrderId)
              : undefined
          }
          onReviewBillRequest={() => router.push("/service/cashier#bills")}
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
