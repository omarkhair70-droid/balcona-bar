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
  Banknote,
  CheckCircle2,
  FileText,
  LogIn,
  LogOut,
  MinusCircle,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { ServiceStaffShell, useServiceView } from "@/features/staff/service-staff-shell";
import {
  getBillStatus,
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
  getBranchOnlinePayments,
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
  CashierShiftReportSnapshot,
  CloseCashierShiftPayload,
  CreateCashAdjustmentPayload,
  CurrentCashierShiftResult,
  OpenCashierShiftPayload,
  RecordManualPaymentPayload,
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { BillRequestQueue } from "../components/bill-request-queue";
import { CashierOrderDetailPanel } from "../components/cashier-order-detail-panel";
import {
  CashierOrderQueue,
  type CashierOrderLane
} from "../components/cashier-order-queue";
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
  closeReadiness,
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
  closeReadiness: {
    openOrders: number;
    unpaidBills: number;
    unknownPayments: number;
    isLoading: boolean;
  };
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
  const [closeMode, setCloseMode] = useState(false);
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
  const blockerCount =
    closeReadiness.openOrders +
    closeReadiness.unpaidBills +
    closeReadiness.unknownPayments;

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center text-sm text-[#91857A]">
        {t("serviceShift.loading")}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-3xl rounded-md border border-[#7A3F3A] bg-[#3A211F] p-4 text-sm text-danger"
      >
        {formatErrorMessage(error)}
      </div>
    );
  }

  if (!shift) {
    return (
      <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center p-3">
        <form
          className="w-full max-w-lg rounded-lg border border-[#40342B] bg-[#211A15] p-5"
          onSubmit={(event) => {
            event.preventDefault();
            onOpen({
              openingFloatMinor: amountInputToMinor(openingFloat),
              note: openingNote.trim() || undefined,
            });
          }}
        >
          <Banknote className="size-6 text-[#C68A4A]" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-semibold text-[#FFF5E8]">
            {t("serviceShift.openShift")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#A99B8E]">
            {t("cashier.shiftManualPaymentsRequireOpen")}
          </p>

          <label className="mt-5 grid gap-2 text-xs font-medium text-[#A99B8E]">
            {t("serviceShift.openingFloat")}
            <Input
              inputMode="decimal"
              value={openingFloat}
              onChange={(event) => setOpeningFloat(event.target.value)}
              className="border-[#4A3C32] bg-[#18130F]"
            />
          </label>
          <label className="mt-3 grid gap-2 text-xs font-medium text-[#A99B8E]">
            {t("serviceShift.note")}
            <Input
              value={openingNote}
              onChange={(event) => setOpeningNote(event.target.value)}
              placeholder={t("serviceShift.optionalOpeningNote")}
              className="border-[#4A3C32] bg-[#18130F]"
            />
          </label>
          <Button
            type="submit"
            className="mt-4 min-h-12 w-full"
            disabled={openPending}
          >
            <Banknote className="size-4" aria-hidden="true" />
            {t("serviceShift.openShift")}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">{t("serviceShift.shiftOpen")}</Badge>
            <Badge variant="muted">{branchName}</Badge>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-[#FFF5E8]">
            {t("serviceShift.title")}
          </h2>
          <p className="mt-1 text-xs text-[#9B8E82]">
            {t("serviceShift.opened")}{" "}
            {formatDateTime(getRecordString(shift, "openedAt"))}
            {" · "}
            {t("serviceShift.payments")} {paymentCount}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={onXReport}
          disabled={xReportPending}
        >
          <FileText className="size-4" aria-hidden="true" />
          {t("serviceShift.xReport")}
        </Button>
      </div>

      <dl className="mt-4 grid overflow-hidden rounded-lg border border-[#3D322A] bg-[#211A15] text-xs sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t("serviceShift.openingFloat"),
            value: formatMoney(
              getRecordNumber(shift, "openingFloatMinor"),
              currency,
            ),
          },
          {
            label: t("serviceShift.expectedCash"),
            value: formatMoney(expectedCashMinor, currency),
          },
          {
            label: t("serviceShift.collected"),
            value: formatMoney(totalCollectedMinor, currency),
          },
          {
            label: t("serviceShift.bills"),
            value: String(billCount),
          },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={`p-4 ${
              index
                ? "border-t border-[#362C25] sm:border-s sm:border-t-0"
                : ""
            }`}
          >
            <dt className="text-[#91857A]">{metric.label}</dt>
            <dd className="mt-2 text-2xl font-semibold text-[#FFF5E8]">
              {metric.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-xs leading-5 text-[#887B70]">
        {t("serviceShift.cash")} {formatMoney(cashMinor, currency)}
        {" · "}
        {t("serviceShift.cardPos")} {formatMoney(cardMinor, currency)}
        {" · "}
        {t("serviceShift.wallet")} {formatMoney(walletMinor, currency)}
        {" · "}
        {t("serviceShift.other")} {formatMoney(otherMinor, currency)}
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-[#3D322A] bg-[#211A15] p-4">
          <h3 className="text-sm font-semibold text-[#F4E7D8]">
            {t("serviceShift.drawerAdjustment")}
          </h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[0.8fr_1.2fr]">
            <Input
              inputMode="decimal"
              value={adjustmentAmount}
              onChange={(event) => setAdjustmentAmount(event.target.value)}
              placeholder="0.00"
              className="border-[#493B31] bg-[#18130F]"
              aria-label={t("serviceShift.drawerAmount")}
            />
            <Input
              value={adjustmentNote}
              onChange={(event) => setAdjustmentNote(event.target.value)}
              placeholder={t("serviceShift.required")}
              className="border-[#493B31] bg-[#18130F]"
              aria-label={t("serviceShift.adjustmentNote")}
            />
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="secondary"
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
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#3D322A] bg-[#211A15] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[#F4E7D8]">
              {t("serviceShift.closeReadiness")}
            </h3>
            {closeReadiness.isLoading ? (
              <span className="text-[10px] text-[#91857A]">
                {t("serviceShift.checkingCloseReadiness")}
              </span>
            ) : (
              <Badge variant={blockerCount > 0 ? "warning" : "success"}>
                {blockerCount > 0
                  ? t("serviceShift.closeBlockers")
                  : t("serviceShift.closeReady")}
              </Badge>
            )}
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            {[
              [t("serviceShift.openOrders"), closeReadiness.openOrders],
              [t("serviceShift.unpaidBills"), closeReadiness.unpaidBills],
              [t("serviceShift.unknownPayments"), closeReadiness.unknownPayments],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-[#B7A99C]">{label}</span>
                <strong
                  className={
                    Number(value) > 0 ? "text-[#F4C06D]" : "text-[#9CC69A]"
                  }
                >
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      {closeMode ? (
        <section
          className={`mt-4 rounded-lg border p-4 ${
            blockerCount > 0
              ? "border-[#74453E] bg-[#2E1E1B]"
              : "border-[#3D322A] bg-[#211A15]"
          }`}
        >
          {blockerCount > 0 ? (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-[#F2B1A9]">
                {t("serviceShift.closeBlockers")}
              </h3>
              <p className="mt-2 text-xs leading-5 text-[#CFA49E]">
                {t("serviceShift.closeBlockersDescription")}
              </p>
            </div>
          ) : null}

          <form
            className="grid gap-3 md:grid-cols-[12rem_1fr_auto]"
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
              <p className="text-xs text-[#91857A] md:col-span-3">
                {t("serviceShift.expectedOverShort", {
                  expected: formatMoney(expectedCashMinor, currency),
                  overShort: formatMoney(overShortMinor, currency),
                })}
              </p>
            ) : null}
          </form>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setCloseMode(false)}
          >
            {t("serviceShift.cancelClose")}
          </Button>
        </section>
      ) : (
        <div className="mt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setCloseMode(true)}
          >
            {t("serviceShift.beginClose")}
          </Button>
        </div>
      )}

      {report ? (
        <div className="mt-4">
          <CashierShiftReportSummary snapshot={report} onClear={onClearReport} />
        </div>
      ) : null}
    </div>
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
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
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
      <StaffRealtimeStatus
        state={realtime.state}
      />
      <StaffBranchSelector
        access={effectiveAccess}
        selectedBranchId={selectedBranchId}
        onChange={setSelectedBranchId}
        className="flex shrink-0 items-center gap-2 [&>span]:hidden [&>select]:min-h-9 [&>select]:max-w-[9rem] [&>select]:px-2 [&>select]:text-xs"
      />
      <Button
        variant="ghost"
        className="shrink-0 px-2 sm:px-3"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        aria-label={t("actions.logout")}
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{t("actions.logout")}</span>
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
  const [orderLane, setOrderLane] =
    useState<CashierOrderLane>("needs_action");
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
  const ordersQuery = useQuery({
    queryKey: staffQueryKeys.branchOrders(selectedBranchId, "all"),
    queryFn: () =>
      getCashierOrders(
        selectedBranchId ?? "",
        { status: "all" },
        accessToken,
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000,
  });
  const billRequestsQuery = useQuery({
    queryKey: staffQueryKeys.branchBillRequests(selectedBranchId, "all"),
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: "all", limit: 50 },
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
  const shiftOrdersQuery = useQuery({
    queryKey: ["service", "shift", "orders", selectedBranchId],
    queryFn: () =>
      getCashierOrders(
        selectedBranchId ?? "",
        { status: "all" },
        accessToken,
      ),
    enabled: Boolean(
      serviceView === "shift" && selectedBranchId && accessToken
    ),
    staleTime: 10_000,
  });
  const shiftBillRequestsQuery = useQuery({
    queryKey: ["service", "shift", "bill-requests", selectedBranchId],
    queryFn: () =>
      getBranchBillRequests(
        selectedBranchId ?? "",
        { status: "active", limit: 100 },
        accessToken,
      ),
    enabled: Boolean(
      serviceView === "shift" && selectedBranchId && accessToken
    ),
    staleTime: 10_000,
  });
  const shiftOnlinePaymentsQuery = useQuery({
    queryKey: ["service", "shift", "online-payments", selectedBranchId],
    queryFn: () =>
      getBranchOnlinePayments(
        selectedBranchId ?? "",
        { status: "all", provider: "all", limit: 100 },
        accessToken,
      ),
    enabled: Boolean(
      serviceView === "shift" && selectedBranchId && accessToken
    ),
    staleTime: 10_000,
  });
  const allOrders = useMemo(
    () => ordersQuery.data?.orders ?? emptyRecords,
    [ordersQuery.data?.orders],
  );
  const needsActionOrders = useMemo(
    () =>
      allOrders.filter((order) => getOrderStatus(order) === "submitted"),
    [allOrders],
  );
  const activeOrders = useMemo(
    () =>
      allOrders.filter((order) =>
        ["cashier_accepted", "preparing", "ready"].includes(
          getOrderStatus(order),
        ),
      ),
    [allOrders],
  );
  const orders =
    orderLane === "needs_action" ? needsActionOrders : activeOrders;
  const billRequests = useMemo(
    () => billRequestsQuery.data?.billRequests ?? emptyRecords,
    [billRequestsQuery.data?.billRequests],
  );
  const shiftOpenOrders = useMemo(
    () =>
      (shiftOrdersQuery.data?.orders ?? emptyRecords).filter((order) => {
        const status = getOrderStatus(order);
        return !["served", "completed", "cancelled", "rejected"].includes(status);
      }).length,
    [shiftOrdersQuery.data?.orders],
  );
  const shiftUnpaidBills = useMemo(
    () =>
      (shiftBillRequestsQuery.data?.billRequests ?? emptyRecords).filter(
        (billRequest) => {
          const status = getBillStatus(billRequest);
          return status !== "paid" && status !== "cancelled";
        },
      ).length,
    [shiftBillRequestsQuery.data?.billRequests],
  );
  const shiftUnknownPayments = useMemo(
    () =>
      (shiftOnlinePaymentsQuery.data?.onlinePaymentIntents ?? emptyRecords).filter(
        (intent) => getRecordString(intent, "status") === "unknown",
      ).length,
    [shiftOnlinePaymentsQuery.data?.onlinePaymentIntents],
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
      <NoticeBanner notice={notice} />

      {serviceView === "orders" ? (
      <section id="orders" className="grid min-h-[calc(100vh-8rem)] gap-0 lg:grid-cols-[360px_minmax(0,1fr)]">
        <CashierOrderQueue
          orders={orders}
          lane={orderLane}
          needsActionCount={needsActionOrders.length}
          activeCount={activeOrders.length}
          selectedOrderId={selectedOrderId}
          isLoading={ordersQuery.isPending}
          error={ordersQuery.error ?? undefined}
          onLaneChange={setOrderLane}
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
      <section id="bills" className="min-h-[calc(100vh-8rem)]">
        <BillRequestQueue
          billRequests={billRequests}
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
        closeReadiness={{
          openOrders: shiftOpenOrders,
          unpaidBills: shiftUnpaidBills,
          unknownPayments: shiftUnknownPayments,
          isLoading:
            shiftOrdersQuery.isPending ||
            shiftBillRequestsQuery.isPending ||
            shiftOnlinePaymentsQuery.isPending
        }}
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
