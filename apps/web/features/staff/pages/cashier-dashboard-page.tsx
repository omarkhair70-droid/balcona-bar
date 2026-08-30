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
  Banknote,
  BellRing,
  CheckCircle2,
  FileText,
  LogIn,
  LogOut,
  MinusCircle,
  PlusCircle,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ServiceStaffShell, useServiceView } from "@/features/staff/service-staff-shell";
import {
  getBillRequestStatus,
  getOrderId,
  getOrderStatus,
  getOrderTableSessionId,
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  formatMoney,
  getRecordNumber,
  getRecordString,
  humanizeStatus,
  shortId,
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import { pendingActionFor } from "@/lib/interaction/pending-scope";
import {
  acceptOrder,
  acknowledgeBillRequest,
  cancelOrder,
  closeCashierShift,
  completeOrder,
  createCashAdjustment,
  getBranchBillRequests,
  getBranchPaymentTerminals,
  getBranchRealtimeEvents,
  getCashierOrders,
  getCashierShiftXReport,
  getCurrentCashierShift,
  getOrderDetail,
  openCashierShift,
  presentBillRequest,
  recordManualPayment,
  rejectOrder,
  staffLogout,
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import { customerQueryKeys, staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type {
  BranchBillRequestStatusFilter,
  CashierShiftReportSnapshot,
  CashierOrderStatus,
  CloseCashierShiftPayload,
  CreateCashAdjustmentPayload,
  CurrentCashierShiftResult,
  OpenCashierShiftPayload,
  RecordManualPaymentPayload,
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { BillRequestQueue } from "../components/bill-request-queue";
import { CashierOrderDetailPanel } from "../components/cashier-order-detail-panel";
import { CashierOrderQueue } from "../components/cashier-order-queue";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";
import type { DebugReportInput } from "@/lib/observability/debug-report";

type Notice = {
  tone: "success" | "error";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  debug?: DebugReportInput;
};

type BillAction = {
  billRequestId: string;
  action: "acknowledge" | "present";
};

type ManualPaymentAction = {
  billId: string;
  payload: RecordManualPaymentPayload;
};

type OpenShiftAction = OpenCashierShiftPayload;

type CashAdjustmentAction = {
  shiftId: string;
  payload: CreateCashAdjustmentPayload;
};

type CloseShiftAction = {
  shiftId: string;
  payload: CloseCashierShiftPayload;
};

const activeOrderStatuses = new Set(["cashier_accepted", "preparing", "ready"]);
const activeBillStatuses = new Set(["open", "acknowledged", "presented"]);
const emptyRecords: Record<string, unknown>[] = [];

function amountInputToMinor(value: string, fallbackMinor = 0) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return fallbackMinor;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) : 0;
}

function getNestedRecord(
  value: Record<string, unknown> | null | undefined,
  key: string,
) {
  const candidate = value?.[key];

  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Record<string, unknown>)
    : undefined;
}

function getSnapshotRecord(
  snapshot: CashierShiftReportSnapshot | null | undefined,
  key: string,
) {
  return getNestedRecord(snapshot, key);
}

function getSnapshotNumber(
  snapshot: CashierShiftReportSnapshot | null | undefined,
  section: string,
  key: string,
  fallback = 0,
) {
  return getRecordNumber(getSnapshotRecord(snapshot, section), key, fallback);
}

function minorToInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

function countOrdersByStatus(
  orders: Record<string, unknown>[],
  predicate: (status: string) => boolean,
) {
  return orders.filter((order) => predicate(getOrderStatus(order))).length;
}

function countBillsByStatus(
  billRequests: Record<string, unknown>[],
  predicate: (status: string) => boolean,
) {
  return billRequests.filter((billRequest) =>
    predicate(getBillRequestStatus(billRequest)),
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
          ? "rounded-md border border-success bg-success/10 p-4 text-sm text-success"
          : "rounded-md border border-[#7A3F3A] bg-[#3A211F] p-4 text-sm text-danger"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{notice.message}</span>
        {notice.onAction ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={notice.onAction}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {notice.actionLabel ?? "Refresh now"}
          </Button>
        ) : null}
        {notice.tone === "error" && notice.debug ? (
          <CopyDebugReportButton {...notice.debug} />
        ) : null}
      </div>
    </div>
  );
}

function CashierShiftReportSummary({
  snapshot,
  onClear,
}: {
  snapshot: CashierShiftReportSnapshot;
  onClear: () => void;
}) {
  const t = useTranslations("staff");
  const currency =
    getRecordString(getSnapshotRecord(snapshot, "shift"), "currency") || "EGP";
  const reportType = getRecordString(snapshot, "reportType", "x_report");
  const reportNumber = getRecordString(snapshot, "reportNumber", "");
  const expectedCashMinor = getSnapshotNumber(
    snapshot,
    "cashDrawer",
    "expectedCashMinor",
  );
  const countedCashMinor = getSnapshotNumber(
    snapshot,
    "cashDrawer",
    "countedCashMinor",
  );
  const cashOverShortMinor = getSnapshotNumber(
    snapshot,
    "cashDrawer",
    "cashOverShortMinor",
  );
  const totalCollectedMinor = getSnapshotNumber(
    snapshot,
    "tenderTotals",
    "totalCollectedMinor",
  );
  const paymentCount = getSnapshotNumber(snapshot, "counts", "paymentCount");

  return (
    <div className="rounded-md border bg-background/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#F8EDDF]">
            {reportType === "z_report" ? t("serviceShift.zReport") : t("serviceShift.xReportLower")}{" "}
            {reportNumber ? reportNumber : t("serviceShift.preview")}
          </p>
          <p className="mt-1 text-xs text-[#91857A]">
            {t("serviceShift.generated", { date: formatDateTime(getRecordString(snapshot, "generatedAt")) })}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-4">
        <div>
          <dt className="text-[#91857A]">{t("serviceShift.expectedCash")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(expectedCashMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("serviceShift.collected")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(totalCollectedMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("serviceShift.payments")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">{paymentCount}</dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("serviceShift.overShort")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {reportType === "z_report"
              ? formatMoney(cashOverShortMinor, currency)
              : t("serviceShift.zCloseOnly")}
          </dd>
        </div>
      </dl>
      {reportType === "z_report" ? (
        <p className="mt-3 text-xs text-[#91857A]">
          {t("serviceShift.countedCashSummary", { amount: formatMoney(countedCashMinor, currency) })}
        </p>
      ) : null}
    </div>
  );
}

function CashierShiftPanel({
  branchName,
  data,
  isLoading,
  error,
  report,
  openPending,
  adjustmentPending,
  xReportPending,
  closePending,
  onOpen,
  onCashAdjustment,
  onXReport,
  onClose,
  onClearReport,
}: {
  branchName: string;
  data?: CurrentCashierShiftResult;
  isLoading?: boolean;
  error?: Error | null;
  report?: CashierShiftReportSnapshot | null;
  openPending?: boolean;
  adjustmentPending?: boolean;
  xReportPending?: boolean;
  closePending?: boolean;
  onOpen: (payload: OpenCashierShiftPayload) => void;
  onCashAdjustment: (payload: CreateCashAdjustmentPayload) => void;
  onXReport: () => void;
  onClose: (payload: CloseCashierShiftPayload) => void;
  onClearReport: () => void;
}) {
  const t = useTranslations("staff");
  const shift = data?.shift ?? null;
  const summary = data?.summary ?? null;
  const [openingFloat, setOpeningFloat] = useState("0.00");
  const [openingNote, setOpeningNote] = useState("");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closingNote, setClosingNote] = useState("");
  const currency = getRecordString(shift ?? undefined, "currency", "EGP");
  const expectedCashMinor = getSnapshotNumber(
    summary,
    "cashDrawer",
    "expectedCashMinor",
    getRecordNumber(shift ?? undefined, "expectedCashMinor"),
  );
  const totalCollectedMinor = getSnapshotNumber(
    summary,
    "tenderTotals",
    "totalCollectedMinor",
  );
  const cashMinor = getSnapshotNumber(summary, "tenderTotals", "cashMinor");
  const cardMinor = getSnapshotNumber(summary, "tenderTotals", "cardPosMinor");
  const walletMinor = getSnapshotNumber(
    summary,
    "tenderTotals",
    "walletManualMinor",
  );
  const otherMinor = getSnapshotNumber(summary, "tenderTotals", "otherMinor");
  const paymentCount = getSnapshotNumber(summary, "counts", "paymentCount");
  const billCount = getSnapshotNumber(summary, "counts", "billCount");
  const countedCashMinor = amountInputToMinor(countedCash);
  const overShortMinor = countedCash.trim()
    ? countedCashMinor - expectedCashMinor
    : 0;
  const adjustmentMinor = amountInputToMinor(adjustmentAmount);
  const adjustmentReady =
    adjustmentMinor > 0 && adjustmentNote.trim().length > 0;

  return (
    <Card variant="glass" padding="lg" className="min-w-0 border-[#3B3028] bg-[#1E1814] shadow-none">
      <CardHeader className="gap-4 border-b border-[#342A23] md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={shift ? "success" : "warning"}>
              {shift ? t("serviceShift.shiftOpen") : t("serviceShift.noOpenShift")}
            </Badge>
            <Badge variant="muted">{branchName}</Badge>
          </div>
          <CardTitle className="mt-3 text-[#FFF5E8]">{t("serviceShift.title")}</CardTitle>
          <CardDescription>
            {t("cashier.shiftManualPaymentsRequireOpen")}
          </CardDescription>
        </div>
        {shift ? (
          <Button
            type="button"
            variant="secondary"
            onClick={onXReport}
            disabled={xReportPending}
          >
            <FileText className="size-4" aria-hidden="true" />{t("serviceShift.xReport")}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4">
        {isLoading ? (
          <div className="rounded-md border border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
            {t("serviceShift.loading")}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-md border border-[#7A3F3A] bg-[#3A211F] p-4 text-sm text-danger"
          >
            {formatErrorMessage(error)}
          </div>
        ) : null}

        {!isLoading && !error && !shift ? (
          <form
            className="grid gap-3 rounded-md border border-[#47392E] bg-[#18130F] p-3 md:grid-cols-[12rem_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onOpen({
                openingFloatMinor: amountInputToMinor(openingFloat),
                note: openingNote.trim() || undefined,
              });
            }}
          >
            <label className="grid gap-1 text-xs font-medium text-[#91857A]">
              {t("serviceShift.openingFloat")}
              <Input
                inputMode="decimal"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#91857A]">
              {t("serviceShift.note")}
              <Input
                value={openingNote}
                onChange={(event) => setOpeningNote(event.target.value)}
                placeholder={t("serviceShift.optionalOpeningNote")}
              />
            </label>
            <Button type="submit" className="self-end" disabled={openPending}>
              <Banknote className="size-4" aria-hidden="true" />
              {t("serviceShift.openShift")}
            </Button>
          </form>
        ) : null}

        {shift ? (
          <>
            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-6">
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.opened")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {formatDateTime(getRecordString(shift, "openedAt"))}
                </dd>
              </div>
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.openingFloat")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {formatMoney(
                    getRecordNumber(shift, "openingFloatMinor"),
                    currency,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.expectedCash")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {formatMoney(expectedCashMinor, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.collected")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {formatMoney(totalCollectedMinor, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.payments")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {paymentCount}
                </dd>
              </div>
              <div>
                <dt className="text-[#91857A]">{t("serviceShift.bills")}</dt>
                <dd className="mt-1 font-semibold text-[#F8EDDF]">
                  {billCount}
                </dd>
              </div>
            </dl>

            <div className="grid gap-3 text-xs md:grid-cols-4">
              <div className="rounded-md border border-[#3A3028] bg-[#18130F] p-3">
                {t("serviceShift.cash")} {formatMoney(cashMinor, currency)}
              </div>
              <div className="rounded-md border border-[#3A3028] bg-[#18130F] p-3">
                {t("serviceShift.cardPos")} {formatMoney(cardMinor, currency)}
              </div>
              <div className="rounded-md border border-[#3A3028] bg-[#18130F] p-3">
                {t("serviceShift.wallet")} {formatMoney(walletMinor, currency)}
              </div>
              <div className="rounded-md border border-[#3A3028] bg-[#18130F] p-3">
                {t("serviceShift.other")} {formatMoney(otherMinor, currency)}
              </div>
            </div>

            <form
              className="grid gap-3 rounded-md border border-[#47392E] bg-[#18130F] p-3 md:grid-cols-[12rem_1fr_auto_auto]"
              onSubmit={(event) => event.preventDefault()}
            >
              <label className="grid gap-1 text-xs font-medium text-[#91857A]">
                {t("serviceShift.drawerAmount")}
                <Input
                  inputMode="decimal"
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  placeholder="0.00"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#91857A]">
                {t("serviceShift.adjustmentNote")}
                <Input
                  value={adjustmentNote}
                  onChange={(event) => setAdjustmentNote(event.target.value)}
                  placeholder={t("serviceShift.required")}
                />
              </label>
              <Button
                type="button"
                variant="secondary"
                className="self-end"
                disabled={!adjustmentReady || adjustmentPending}
                onClick={() =>
                  onCashAdjustment({
                    type: "cash_in",
                    amountMinor: adjustmentMinor,
                    note: adjustmentNote.trim(),
                  })
                }
              >
                <PlusCircle className="size-4" aria-hidden="true" />
                {t("serviceShift.cashIn")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="self-end"
                disabled={!adjustmentReady || adjustmentPending}
                onClick={() =>
                  onCashAdjustment({
                    type: "cash_out",
                    amountMinor: adjustmentMinor,
                    note: adjustmentNote.trim(),
                  })
                }
              >
                <MinusCircle className="size-4" aria-hidden="true" />
                {t("serviceShift.cashOut")}
              </Button>
            </form>

            <form
              className="grid gap-3 rounded-md border border-[#3A3028] bg-[#18130F] p-3 md:grid-cols-[12rem_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();

                if (!countedCash.trim()) {
                  return;
                }

                onClose({
                  countedCashMinor,
                  note: closingNote.trim() || undefined,
                });
              }}
            >
              <label className="grid gap-1 text-xs font-medium text-[#91857A]">
                {t("serviceShift.countedCash")}
                <Input
                  inputMode="decimal"
                  value={countedCash}
                  onChange={(event) => setCountedCash(event.target.value)}
                  placeholder={minorToInput(expectedCashMinor)}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-[#91857A]">
                {t("serviceShift.closingNote")}
                <Input
                  value={closingNote}
                  onChange={(event) => setClosingNote(event.target.value)}
                  placeholder={t("serviceShift.optionalClosingNote")}
                />
              </label>
              <Button
                type="submit"
                className="self-end"
                disabled={!countedCash.trim() || closePending}
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                {t("serviceShift.closeAndGenerateZ")}
              </Button>
              {countedCash.trim() ? (
                <p className="md:col-span-3 text-xs text-[#91857A]">
                  {t("serviceShift.expectedOverShort", {
                    expected: formatMoney(expectedCashMinor, currency),
                    overShort: formatMoney(overShortMinor, currency)
                  })}
                </p>
              ) : null}
            </form>
          </>
        ) : null}

        {report ? (
          <CashierShiftReportSummary
            snapshot={report}
            onClear={onClearReport}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

function CashierDashboardActions() {
  const t = useTranslations("staff");
  const router = useRouter();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId,
  );
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const logoutMutation = useMutation({
    mutationFn: () =>
      accessToken ? staffLogout(accessToken) : Promise.resolve({}),
    onSettled: () => {
      clearSession();
      router.push("/staff/login");
    },
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

function CashierDashboardContent() {
  const t = useTranslations("staff");
  const queryClient = useQueryClient();
  const serviceView = useServiceView("cashier");
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
  const [pendingOrderActions, setPendingOrderActions] = useState<
    Record<string, "accept" | "reject" | "complete" | "cancel">
  >({});
  const [shiftReport, setShiftReport] =
    useState<CashierShiftReportSnapshot | null>(null);
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId,
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const allOrdersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, "all"),
    queryFn: () =>
      getCashierOrders(selectedBranchId ?? "", { status: "all" }, accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const ordersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, orderStatus),
    queryFn: () =>
      getCashierOrders(
        selectedBranchId ?? "",
        { status: orderStatus },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const activeBillRequestsQuery = useQuery({
    queryKey: staffQueryKeys.branchBillRequests(selectedBranchId, "active"),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: "active", limit: 30 },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const billRequestsQuery = useQuery({
    queryKey: staffQueryKeys.branchBillRequests(selectedBranchId, billStatus),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: billStatus, limit: 30 },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const currentShiftQuery = useQuery({
    queryKey: staffQueryKeys.currentCashierShift(selectedBranchId),
    queryFn: () => getCurrentCashierShift(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const paymentTerminalsQuery = useQuery({
    queryKey: ["service", "payment-terminals", selectedBranchId],
    queryFn: () =>
      getBranchPaymentTerminals(selectedBranchId ?? "", accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 30_000,
    retry: false,
  });
  const realtimeEventsQuery = useQuery({
    queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
    queryFn: () =>
      getBranchRealtimeEvents(
        selectedBranchId ?? "",
        { channel: "all", limit: 8 },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000,
  });
  const orders = useMemo(
    () => ordersQuery.data?.orders ?? emptyRecords,
    [ordersQuery.data?.orders],
  );
  const allOrders = useMemo(
    () => allOrdersQuery.data?.orders ?? orders,
    [allOrdersQuery.data?.orders, orders],
  );
  const billRequests = useMemo(
    () => billRequestsQuery.data?.billRequests ?? emptyRecords,
    [billRequestsQuery.data?.billRequests],
  );
  const activeBillRequests = useMemo(
    () => activeBillRequestsQuery.data?.billRequests ?? billRequests,
    [activeBillRequestsQuery.data?.billRequests, billRequests],
  );
  const currentShift = currentShiftQuery.data?.shift ?? null;
  const paymentBlockedReason = currentShiftQuery.isPending
    ? t("cashier.paymentBlockedChecking")
    : currentShiftQuery.isError
      ? t("cashier.paymentBlockedLoadFailed")
      : currentShift
        ? undefined
        : t("cashier.paymentBlockedShiftRequired");
  const selectedOrderStillVisible = useMemo(
    () => orders.some((order) => getOrderId(order) === userSelectedOrderId),
    [orders, userSelectedOrderId],
  );
  const selectedOrderId =
    selectedOrderStillVisible && userSelectedOrderId
      ? userSelectedOrderId
      : getOrderId(orders[0]);
  const orderDetailQuery = useQuery({
    queryKey: staffQueryKeys.order(selectedOrderId),
    queryFn: () => getOrderDetail(selectedOrderId ?? "", accessToken),
    enabled: Boolean(selectedOrderId && accessToken),
    staleTime: 5_000,
    placeholderData: keepPreviousData,
  });
  const refreshBranch = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchBillRequests(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchBills(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.currentCashierShift(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: ["service", "payment-terminals", selectedBranchId],
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchCashierShifts(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
    });
  };
  const refreshOrderActionState = (
    orderId?: string,
    actionResult?: unknown,
  ) => {
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId, "all"),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId, orderStatus),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
      });
    }

    if (orderId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.order(orderId),
      });
    }

    const tableSessionId =
      getOrderTableSessionId(actionResult) ||
      getOrderTableSessionId(orderDetailQuery.data);

    if (tableSessionId) {
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.orders(tableSessionId),
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.status(tableSessionId),
      });
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.timeline(tableSessionId),
      });
    }
  };
  const showOrderActionError = (action: string, error: Error, orderId?: string) => {
    refreshOrderActionState(orderId);
    setNotice({
      tone: "error",
      message: t("errors.orderActionFailed", {
        action,
        message: formatErrorMessage(error),
      }),
      actionLabel: t("actions.refreshNow"),
      onAction: refreshBranch,
      debug: {
        action:
          action === "accepted"
            ? "cashier_accept"
            : action === "rejected"
              ? "cashier_reject"
              : `order_${action}`,
        flow: "staff_cashier",
        orderId,
        error,
      },
    });
  };
  const showOrderActionSuccess = (
    message: string,
    orderId: string | undefined,
    actionResult: unknown,
  ) => {
    setNotice({ tone: "success", message });
    setUserSelectedOrderId(undefined);
    refreshOrderActionState(orderId, actionResult);
  };
  const invalidateShiftState = (shiftId?: string) => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.currentCashierShift(selectedBranchId),
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchCashierShifts(selectedBranchId),
    });

    if (shiftId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.cashierShift(shiftId),
      });
    }
  };
  const openShiftMutation = useMutation({
    mutationFn: (payload: OpenShiftAction) =>
      openCashierShift(selectedBranchId ?? "", payload, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: "Cashier shift opened." });
      setShiftReport(null);
      invalidateShiftState();
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Cashier shift could not be opened. ${formatErrorMessage(error)}`,
      });
    },
  });
  const cashAdjustmentMutation = useMutation({
    mutationFn: ({ shiftId, payload }: CashAdjustmentAction) =>
      createCashAdjustment(shiftId, payload, accessToken),
    onSuccess: (_, variables) => {
      setNotice({ tone: "success", message: "Cash drawer updated." });
      setShiftReport(null);
      invalidateShiftState(variables.shiftId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Cash drawer adjustment failed. ${formatErrorMessage(error)}`,
      });
    },
  });
  const xReportMutation = useMutation({
    mutationFn: (shiftId: string) =>
      getCashierShiftXReport(shiftId, accessToken),
    onSuccess: (result, shiftId) => {
      setNotice({ tone: "success", message: "X report generated." });
      setShiftReport(result.snapshot);
      invalidateShiftState(shiftId);
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `X report could not be generated. ${formatErrorMessage(error)}`,
      });
    },
  });
  const closeShiftMutation = useMutation({
    mutationFn: ({ shiftId, payload }: CloseShiftAction) =>
      closeCashierShift(shiftId, payload, accessToken),
    onSuccess: (result, variables) => {
      setNotice({
        tone: "success",
        message: "Cashier shift closed and Z report generated.",
      });
      setShiftReport(result.summary);
      invalidateShiftState(variables.shiftId);
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBills(selectedBranchId),
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: `Cashier shift could not be closed. ${formatErrorMessage(error)}`,
      });
    },
  });
  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => acceptOrder(orderId, {}, accessToken),
    onMutate: (orderId) => {
      setPendingOrderActions((current) => ({
        ...current,
        [orderId]: "accept",
      }));
    },
    onSuccess: (result, orderId) => {
      showOrderActionSuccess(t("orders.orderAccepted"), orderId, result);
    },
    onError: (error: Error, orderId) => {
      showOrderActionError("accepted", error, orderId);
    },
    onSettled: (_result, _error, orderId) => {
      setPendingOrderActions((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    },
  });
  const rejectMutation = useMutation({
    mutationFn: ({
      orderId,
      reason,
    }: {
      orderId: string;
      reason?: string | null;
    }) => rejectOrder(orderId, { reason }, accessToken),
    onMutate: ({ orderId }) => {
      setPendingOrderActions((current) => ({
        ...current,
        [orderId]: "reject",
      }));
    },
    onSuccess: (result, variables) => {
      showOrderActionSuccess(t("orders.orderRejected"), variables.orderId, result);
    },
    onError: (error: Error, variables) => {
      showOrderActionError("rejected", error, variables.orderId);
    },
    onSettled: (_result, _error, variables) => {
      setPendingOrderActions((current) => {
        const next = { ...current };
        delete next[variables.orderId];
        return next;
      });
    },
  });
  const completeOrderMutation = useMutation({
    mutationFn: (orderId: string) => completeOrder(orderId, {}, accessToken),
    onMutate: (orderId) => {
      setPendingOrderActions((current) => ({
        ...current,
        [orderId]: "complete",
      }));
    },
    onSuccess: (result, orderId) => {
      showOrderActionSuccess(t("orders.orderCompleted"), orderId, result);
    },
    onError: (error: Error, orderId) => {
      showOrderActionError("completed", error, orderId);
    },
    onSettled: (_result, _error, orderId) => {
      setPendingOrderActions((current) => {
        const next = { ...current };
        delete next[orderId];
        return next;
      });
    },
  });
  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      cancelOrder(orderId, { reason }, accessToken),
    onMutate: ({ orderId }) => {
      setPendingOrderActions((current) => ({
        ...current,
        [orderId]: "cancel",
      }));
    },
    onSuccess: (result, variables) => {
      showOrderActionSuccess(t("orders.orderCancelled"), variables.orderId, result);
    },
    onError: (error: Error, variables) => {
      showOrderActionError("cancelled", error, variables.orderId);
    },
    onSettled: (_result, _error, variables) => {
      setPendingOrderActions((current) => {
        const next = { ...current };
        delete next[variables.orderId];
        return next;
      });
    },
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
        message: t("billRequests.requestActionComplete", {
          action: humanizeStatus(variables.action),
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBillRequests(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBills(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.billRequest(variables.billRequestId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("billRequests.requestActionFailed", {
          message: formatErrorMessage(error),
        }),
        debug: {
          action: "bill_request_action",
          flow: "staff_cashier",
          error,
        },
      });
    },
  });
  const manualPaymentMutation = useMutation({
    mutationFn: ({ billId, payload }: ManualPaymentAction) =>
      recordManualPayment(billId, payload, accessToken),
    onSuccess: (_, variables) => {
      setNotice({
        tone: "success",
        message: t("billRequests.manualPaymentRecorded"),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBillRequests(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchBills(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.bill(variables.billId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.billReceipt(variables.billId),
      });
      invalidateShiftState(currentShift?.id);
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchOrders(selectedBranchId),
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
      });
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("billRequests.manualPaymentError", {
          message: formatErrorMessage(error),
        }),
        debug: {
          action: "manual_payment_record",
          flow: "staff_cashier",
          error,
        },
      });
    },
  });
  const selectedOrderAction = pendingActionFor(
    pendingOrderActions,
    selectedOrderId,
  );
  const orderActionPending = Boolean(selectedOrderAction);
  const prefetchOrder = (orderId: string) => {
    if (!accessToken) return;
    void queryClient.prefetchQuery({
      queryKey: staffQueryKeys.order(orderId),
      queryFn: () => getOrderDetail(orderId, accessToken),
      staleTime: 5_000,
    });
  };

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title={t("cashier.emptyBranchTitle")}
        description={t("cashier.emptyBranchDescription")}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <div
        data-service-status
        className="flex flex-wrap items-center gap-2 border-b border-[#342A23] pb-3 text-xs text-[#B8AA9E]"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="muted">{t("cashier.badge")}</Badge>
          <StaffRealtimeStatus
            state={realtime.state}
            lastEventType={realtime.lastEventType}
          />
          <span className="truncate font-semibold text-[#F8EDDF]">
            {selectedBranch.name}
          </span>
        </div>

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#3B3028] bg-[#211A15] px-2.5">
            <Receipt className="size-3.5 text-[#E0A764]" aria-hidden="true" />
            {t("cashier.submittedLabel")}{" "}
            <strong className="text-[#FFF5E8]">
              {countOrdersByStatus(allOrders, (status) => status === "submitted")}
            </strong>
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#3B3028] bg-[#211A15] px-2.5">
            <CheckCircle2 className="size-3.5 text-[#7FC37E]" aria-hidden="true" />
            {t("cashier.inServiceLabel")}{" "}
            <strong className="text-[#FFF5E8]">
              {countOrdersByStatus(allOrders, (status) => activeOrderStatuses.has(status))}
            </strong>
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#3B3028] bg-[#211A15] px-2.5">
            <BellRing className="size-3.5 text-[#F0C66E]" aria-hidden="true" />
            {t("cashier.billRequestsLabel")}{" "}
            <strong className="text-[#FFF5E8]">
              {countBillsByStatus(activeBillRequests, (status) => activeBillStatuses.has(status))}
            </strong>
          </span>
          <span className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#3B3028] bg-[#211A15] px-2.5">
            <Banknote className="size-3.5 text-[#C68A4A]" aria-hidden="true" />
            {currentShift
              ? t("serviceShift.shiftOpen")
              : t("serviceShift.noOpenShift")}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={refreshBranch}
            aria-label={t("actions.refreshBranch")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <NoticeBanner notice={notice} />

      {serviceView === "orders" ? (
      <section id="orders" className="grid min-h-[calc(100vh-8rem)] gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <CashierOrderQueue
          orders={orders}
          status={orderStatus}
          selectedOrderId={selectedOrderId}
          isLoading={ordersQuery.isPending}
          error={ordersQuery.error ?? undefined}
          onStatusChange={setOrderStatus}
          onSelectOrder={setUserSelectedOrderId}
          onPrefetchOrder={prefetchOrder}
          onRefresh={refreshBranch}
        />
        <CashierOrderDetailPanel
          order={orderDetailQuery.data}
          isLoading={orderDetailQuery.isPending && Boolean(selectedOrderId)}
          isRefreshing={orderDetailQuery.isPlaceholderData}
          error={orderDetailQuery.error ?? undefined}
          acceptPending={selectedOrderAction === "accept"}
          rejectPending={selectedOrderAction === "reject"}
          cancelPending={selectedOrderAction === "cancel"}
          completePending={selectedOrderAction === "complete"}
          actionPending={orderActionPending}
          onAccept={() => {
            if (selectedOrderId && !orderActionPending) {
              acceptMutation.mutate(selectedOrderId);
            }
          }}
          onReject={(reason) => {
            if (selectedOrderId && !orderActionPending) {
              rejectMutation.mutate({ orderId: selectedOrderId, reason });
            }
          }}
          onCancel={(reason) => {
            if (selectedOrderId && !orderActionPending) {
              cancelOrderMutation.mutate({ orderId: selectedOrderId, reason });
            }
          }}
          onComplete={() => {
            if (selectedOrderId && !orderActionPending) {
              completeOrderMutation.mutate(selectedOrderId);
            }
          }}
        />
      </section>
      ) : null}

      {serviceView === "bills" ? (
      <section id="bills" className="grid min-h-[calc(100vh-8rem)] gap-0 lg:grid-cols-[350px_minmax(0,1fr)]">
        <BillRequestQueue
          billRequests={billRequests}
          status={billStatus}
          isLoading={billRequestsQuery.isPending}
          error={billRequestsQuery.error ?? undefined}
          pendingActionId={
            billActionMutation.isPending
              ? billActionMutation.variables?.billRequestId
              : undefined
          }
          pendingPaymentId={
            manualPaymentMutation.isPending
              ? manualPaymentMutation.variables?.billId
              : undefined
          }
          paymentBlockedReason={paymentBlockedReason}
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
            <CardTitle>{t("cashier.activityTitle")}</CardTitle>
            <CardDescription>{t("cashier.activityDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div
              className={
                paymentTerminalsQuery.data?.execution?.available
                  ? "rounded-md border border-success bg-success/10 p-3 text-xs leading-5 text-success"
                  : "rounded-md border border-[#3A3028] bg-[#18130F] p-3 text-xs leading-5 text-[#B8AA9E]"
              }
            >
              <p className="font-semibold">
                {t("cashier.directTerminalTitle")}
              </p>
              <p className="mt-1">
                {paymentTerminalsQuery.isPending
                  ? t("cashier.directTerminalChecking")
                  : paymentTerminalsQuery.isError
                    ? t("cashier.directTerminalUnavailable")
                    : paymentTerminalsQuery.data?.execution?.available
                      ? t("cashier.directTerminalReady")
                      : t("cashier.directTerminalBlocked")}
              </p>
            </div>
            {realtimeEventsQuery.isError ? (
              <div className="rounded-md border border-warning bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle
                  className="me-2 inline size-4"
                  aria-hidden="true"
                />
                {formatErrorMessage(realtimeEventsQuery.error)}
              </div>
            ) : null}
            {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed bg-surface/70 p-4 text-sm text-[#91857A]">
                {t("cashier.activityEmpty")}
              </p>
            ) : null}
            {(realtimeEventsQuery.data?.events ?? []).map((event, index) => (
              <div
                key={getRecordString(event, "id") || String(index)}
                className="rounded-md border bg-surface/75 p-3"
              >
                <p className="text-sm font-semibold text-[#F8EDDF]">
                  {humanizeStatus(getRecordString(event, "type", "event"))}
                </p>
                <p className="mt-1 text-xs text-[#91857A]">
                  {getRecordString(event, "channel", "system")} /{" "}
                  {formatDateTime(getRecordString(event, "createdAt"))}
                </p>
                {getRecordString(event, "orderId") ? (
                  <p className="mt-2 text-xs text-[#91857A]">
                    Order {shortId(getRecordString(event, "orderId"))}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
      ) : null}

      {serviceView === "shift" ? (
      <div id="shift" className="min-h-[calc(100vh-8rem)] bg-[#1E1814] p-3 sm:p-4">
        <CashierShiftPanel
        branchName={selectedBranch.name}
        data={currentShiftQuery.data}
        isLoading={currentShiftQuery.isPending}
        error={currentShiftQuery.error ?? null}
        report={shiftReport}
        openPending={openShiftMutation.isPending}
        adjustmentPending={cashAdjustmentMutation.isPending}
        xReportPending={xReportMutation.isPending}
        closePending={closeShiftMutation.isPending}
        onOpen={(payload) => openShiftMutation.mutate(payload)}
        onCashAdjustment={(payload) => {
          if (currentShift?.id) {
            cashAdjustmentMutation.mutate({
              shiftId: currentShift.id,
              payload,
            });
          }
        }}
        onXReport={() => {
          if (currentShift?.id) {
            xReportMutation.mutate(currentShift.id);
          }
        }}
        onClose={(payload) => {
          if (currentShift?.id) {
            closeShiftMutation.mutate({
              shiftId: currentShift.id,
              payload,
            });
          }
        }}
        onClearReport={() => setShiftReport(null)}
        />
      </div>
      ) : null}

    </div>
  );
}

export function CashierDashboardPage() {
  const t = useTranslations("staff");

  return (
    <ServiceStaffShell
      mode="cashier"
      title={t("cashier.dashboardTitle")}
      description={t("cashier.dashboardDescription")}
      actions={<CashierDashboardActions />}
    >
      <StaffAuthGate
        requiredPermissions={["orders.cashier_review"]}
        branchScoped
      >
        <CashierDashboardContent />
      </StaffAuthGate>
    </ServiceStaffShell>
  );
}
