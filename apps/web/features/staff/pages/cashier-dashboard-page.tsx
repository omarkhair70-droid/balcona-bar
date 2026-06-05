"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
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
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import {
  getBillRequestStatus,
  getOrderId,
  getOrderStatus
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  acceptOrder,
  acknowledgeBillRequest,
  cancelOrder,
  completeOrder,
  getBranchBillRequests,
  getBranchRealtimeEvents,
  getCashierOrders,
  getOrderDetail,
  presentBillRequest,
  recordManualPayment,
  rejectOrder,
  staffLogout
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  BranchBillRequestStatusFilter,
  CashierOrderStatus,
  RecordManualPaymentPayload
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { BillRequestQueue } from "../components/bill-request-queue";
import { CashierOrderDetailPanel } from "../components/cashier-order-detail-panel";
import { CashierOrderQueue } from "../components/cashier-order-queue";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";

type Notice = {
  tone: "success" | "error";
  message: string;
};

type BillAction = {
  billRequestId: string;
  action: "acknowledge" | "present";
};

type ManualPaymentAction = {
  billId: string;
  payload: RecordManualPaymentPayload;
};

const activeOrderStatuses = new Set([
  "cashier_accepted",
  "preparing",
  "ready"
]);
const terminalOrderStatuses = new Set(["cashier_rejected", "cancelled"]);
const activeBillStatuses = new Set(["open", "acknowledged", "presented"]);
const emptyRecords: Record<string, unknown>[] = [];

function countOrdersByStatus(
  orders: Record<string, unknown>[],
  predicate: (status: string) => boolean
) {
  return orders.filter((order) => predicate(getOrderStatus(order))).length;
}

function countBillsByStatus(
  billRequests: Record<string, unknown>[],
  predicate: (status: string) => boolean
) {
  return billRequests.filter((billRequest) =>
    predicate(getBillRequestStatus(billRequest))
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

function CashierDashboardActions() {
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

function CashierDashboardContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const [orderStatus, setOrderStatus] =
    useState<CashierOrderStatus>("submitted");
  const [billStatus, setBillStatus] =
    useState<BranchBillRequestStatusFilter>("active");
  const [userSelectedOrderId, setUserSelectedOrderId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const allOrdersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, "all"),
    queryFn: () =>
      getCashierOrders(selectedBranchId ?? "", { status: "all" }, accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const ordersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, orderStatus),
    queryFn: () =>
      getCashierOrders(
        selectedBranchId ?? "",
        { status: orderStatus },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const activeBillRequestsQuery = useQuery({
    queryKey: staffQueryKeys.branchBillRequests(selectedBranchId, "active"),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: "active", limit: 30 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const billRequestsQuery = useQuery({
    queryKey: staffQueryKeys.branchBillRequests(selectedBranchId, billStatus),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: billStatus, limit: 30 },
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
  const orders = useMemo(
    () => ordersQuery.data?.orders ?? emptyRecords,
    [ordersQuery.data?.orders]
  );
  const allOrders = useMemo(
    () => allOrdersQuery.data?.orders ?? orders,
    [allOrdersQuery.data?.orders, orders]
  );
  const billRequests = useMemo(
    () => billRequestsQuery.data?.billRequests ?? emptyRecords,
    [billRequestsQuery.data?.billRequests]
  );
  const activeBillRequests = useMemo(
    () => activeBillRequestsQuery.data?.billRequests ?? billRequests,
    [activeBillRequestsQuery.data?.billRequests, billRequests]
  );
  const selectedOrderStillVisible = useMemo(
    () => orders.some((order) => getOrderId(order) === userSelectedOrderId),
    [orders, userSelectedOrderId]
  );
  const selectedOrderId =
    selectedOrderStillVisible && userSelectedOrderId
      ? userSelectedOrderId
      : getOrderId(orders[0]);
  const orderDetailQuery = useQuery({
    queryKey: staffQueryKeys.order(selectedOrderId),
    queryFn: () => getOrderDetail(selectedOrderId ?? "", accessToken),
    enabled: Boolean(selectedOrderId && accessToken),
    staleTime: 5_000
  });
  const refreshBranch = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchBillRequests(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchBills(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
    });
  };
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) =>
      acceptOrder(orderId, {}, accessToken),
    onSuccess: (_, orderId) => {
      setNotice({ tone: "success", message: "Order accepted." });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(orderId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Order could not be accepted. ${formatErrorMessage(error)}`
      });
    }
  });
  const rejectMutation = useMutation({
    mutationFn: ({
      orderId,
      reason
    }: {
      orderId: string;
      reason?: string | null;
    }) =>
      rejectOrder(
        orderId,
        { reason },
        accessToken
      ),
    onSuccess: (_, variables) => {
      setNotice({ tone: "success", message: "Order rejected." });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(variables.orderId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Order could not be rejected. ${formatErrorMessage(error)}`
      });
    }
  });
  const completeOrderMutation = useMutation({
    mutationFn: (orderId: string) => completeOrder(orderId, {}, accessToken),
    onSuccess: (_, orderId) => {
      setNotice({ tone: "success", message: "Order completed." });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(orderId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Order could not be completed. ${formatErrorMessage(error)}`
      });
    }
  });
  const cancelOrderMutation = useMutation({
    mutationFn: ({
      orderId,
      reason
    }: {
      orderId: string;
      reason: string;
    }) => cancelOrder(orderId, { reason }, accessToken),
    onSuccess: (_, variables) => {
      setNotice({ tone: "success", message: "Order cancelled." });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(variables.orderId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Order could not be cancelled. ${formatErrorMessage(error)}`
      });
    }
  });
  const billActionMutation = useMutation({
    mutationFn: ({ billRequestId, action }: BillAction) => {
      const payload = { staffUserId: staffUser?.id };

      if (action === "acknowledge") {
        return acknowledgeBillRequest(billRequestId, payload, accessToken);
      }

      if (action === "present") {
        return presentBillRequest(billRequestId, payload, accessToken);
      }

      return acknowledgeBillRequest(billRequestId, payload, accessToken);
    },
    onSuccess: (_, variables) => {
      setNotice({
        tone: "success",
        message: `Bill request ${humanizeStatus(variables.action)} complete.`
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBillRequests(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBills(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.billRequest(variables.billRequestId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Bill request action failed. ${formatErrorMessage(error)}`
      });
    }
  });
  const manualPaymentMutation = useMutation({
    mutationFn: ({ billId, payload }: ManualPaymentAction) =>
      recordManualPayment(billId, payload, accessToken),
    onSuccess: (_, variables) => {
      setNotice({
        tone: "success",
        message: "Manual payment recorded and receipt generated."
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBillRequests(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBills(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.bill(variables.billId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.billReceipt(variables.billId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Manual payment could not be recorded. ${formatErrorMessage(error)}`
      });
    }
  });

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="No accessible branch"
        description="This staff account does not expose a branch for cashier operations yet."
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard
          label="Submitted"
          value={String(
            countOrdersByStatus(allOrders, (status) => status === "submitted")
          )}
          description="Needs cashier decision"
          icon={<Receipt className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="In service"
          value={String(
            countOrdersByStatus(allOrders, (status) =>
              activeOrderStatuses.has(status)
            )
          )}
          description="Accepted, preparing, or ready"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label="Bill requests"
          value={String(
            countBillsByStatus(activeBillRequests, (status) =>
              activeBillStatuses.has(status)
            )
          )}
          description="Open cashier bill flow"
          icon={<BellRing className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label="Rejected"
          value={String(
            countOrdersByStatus(allOrders, (status) =>
              terminalOrderStatuses.has(status)
            )
          )}
          description="Rejected or cancelled"
          icon={<XCircle className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label="Realtime"
          value={realtime.state === "connected" ? "Live" : "Watch"}
          description={humanizeStatus(realtime.state)}
          icon={<RefreshCw className="size-4" aria-hidden="true" />}
          tone={realtime.state === "connected" ? "success" : "warning"}
        />
      </section>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">Cashier</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {staffUser?.name || staffUser?.email || "Staff user"} is viewing
              branch orders and active bill requests.
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={refreshBranch}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh branch
          </Button>
        </CardHeader>
      </Card>

      <NoticeBanner notice={notice} />

      <section className="grid gap-5 xl:grid-cols-[minmax(20rem,26rem)_1fr]">
        <CashierOrderQueue
          orders={orders}
          status={orderStatus}
          selectedOrderId={selectedOrderId}
          isLoading={ordersQuery.isPending}
          error={ordersQuery.error ?? undefined}
          onStatusChange={setOrderStatus}
          onSelectOrder={setUserSelectedOrderId}
          onRefresh={refreshBranch}
        />
        <CashierOrderDetailPanel
          order={orderDetailQuery.data}
          isLoading={orderDetailQuery.isPending && Boolean(selectedOrderId)}
          error={orderDetailQuery.error ?? undefined}
          acceptPending={acceptMutation.isPending}
          rejectPending={rejectMutation.isPending}
          cancelPending={cancelOrderMutation.isPending}
          completePending={completeOrderMutation.isPending}
          onAccept={() => {
            if (selectedOrderId) {
              acceptMutation.mutate(selectedOrderId);
            }
          }}
          onReject={(reason) => {
            if (selectedOrderId) {
              rejectMutation.mutate({ orderId: selectedOrderId, reason });
            }
          }}
          onCancel={(reason) => {
            if (selectedOrderId) {
              cancelOrderMutation.mutate({ orderId: selectedOrderId, reason });
            }
          }}
          onComplete={() => {
            if (selectedOrderId) {
              completeOrderMutation.mutate(selectedOrderId);
            }
          }}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <BillRequestQueue
          billRequests={billRequests}
          status={billStatus}
          isLoading={billRequestsQuery.isPending}
          error={billRequestsQuery.error ?? undefined}
          pendingActionId={billActionMutation.variables?.billRequestId}
          pendingPaymentId={manualPaymentMutation.variables?.billId}
          paymentError={
            manualPaymentMutation.isError
              ? manualPaymentMutation.error
              : undefined
          }
          onStatusChange={setBillStatus}
          onRefresh={refreshBranch}
          onAcknowledge={(billRequestId) =>
            billActionMutation.mutate({ billRequestId, action: "acknowledge" })
          }
          onPresent={(billRequestId) =>
            billActionMutation.mutate({ billRequestId, action: "present" })
          }
          onRecordManualPayment={(billId, payload) =>
            manualPaymentMutation.mutate({ billId, payload })
          }
        />

        <Card variant="quiet">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
            <CardDescription>
              Latest branch realtime events returned by the API.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {realtimeEventsQuery.isError ? (
              <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
                {formatErrorMessage(realtimeEventsQuery.error)}
              </div>
            ) : null}
            {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
              <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                Activity will appear here after orders, bills, or service events
                reach the branch stream.
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
                {getRecordString(event, "orderId") ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Order {shortId(getRecordString(event, "orderId"))}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export function CashierDashboardPage() {
  return (
    <StaffPageShell
      title="Cashier dashboard"
      description="Live branch order intake, cashier decisions, bill request handling, and branch realtime refresh for staff operations."
      actions={<CashierDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["orders.cashier_review"]} branchScoped>
        <CashierDashboardContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
