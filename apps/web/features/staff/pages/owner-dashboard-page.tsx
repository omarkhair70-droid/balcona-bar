"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient
} from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  Boxes,
  LogIn,
  LogOut,
  Receipt,
  RefreshCw,
  ShoppingBag,
  UserRoundCheck,
  WalletCards
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import { formatMoney, humanizeStatus } from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  getOwnerAnalyticsDashboard,
  getOwnerDailyReport,
  staffLogout
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import type {
  OwnerAnalyticsCashierShiftsResult,
  OwnerAnalyticsCountRow,
  OwnerAnalyticsDailyReportResult,
  OwnerAnalyticsDashboardResult,
  OwnerAnalyticsItemRow,
  OwnerAnalyticsMoneyRow,
  OwnerAnalyticsPreset,
  OwnerAnalyticsTenderRow
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";

const presetOptions: Array<{ labelKey: string; value: OwnerAnalyticsPreset }> = [
  { labelKey: "dashboard.today", value: "today" },
  { labelKey: "dashboard.last7Days", value: "last_7_days" },
  { labelKey: "dashboard.last30Days", value: "last_30_days" }
];

function ownerStatusLabel(
  value: string,
  t: ReturnType<typeof useTranslations>
) {
  const labels: Record<string, string> = {
    submitted: t("statusLabels.submitted"),
    cashier_accepted: t("statusLabels.cashierAccepted"),
    preparing: t("statusLabels.preparing"),
    ready: t("statusLabels.ready"),
    served: t("statusLabels.served"),
    completed: t("statusLabels.completed"),
    paid: t("statusLabels.paid"),
    payment_pending: t("statusLabels.paymentPending"),
    open: t("statusLabels.open"),
    closed: t("statusLabels.closed"),
    resolved: t("statusLabels.resolved"),
    pending: t("statusLabels.pending"),
    in_progress: t("statusLabels.inProgress"),
    printed: t("statusLabels.printed"),
    failed: t("statusLabels.failed"),
    queued: t("statusLabels.queued"),
    cash: t("statusLabels.cash"),
    card_pos: t("statusLabels.cardPos"),
    wallet_manual: t("statusLabels.walletManual"),
    other: t("statusLabels.other"),
    customer_requested_human: t("statusLabels.customerRequestedHuman"),
    low_confidence: t("statusLabels.lowConfidence"),
    owner_daily_report: t("statusLabels.ownerDailyReport")
  };

  return labels[value] ?? humanizeStatus(value);
}

function formatOwnerDateTime(value: string | undefined, locale: "en" | "ar") {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale === "ar" ? "ar-EG" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function OwnerDashboardActions() {
  const t = useTranslations("owner");
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
        className="normal-case text-[#777771] [&_select]:rounded-md [&_select]:border-[#D6D6D1] [&_select]:bg-white [&_select]:text-[#2A2A27] [&_select]:shadow-none"
      />
      <Button
        variant="ghost"
        className="text-[#64645E] hover:bg-[#E9E9E4] hover:text-[#20201D]"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {t("actions.logout")}
      </Button>
    </>
  );
}

function RangeSelector({
  preset,
  onChange
}: {
  preset: OwnerAnalyticsPreset;
  onChange: (preset: OwnerAnalyticsPreset) => void;
}) {
  const t = useTranslations("owner");

  return (
    <div className="flex flex-wrap gap-2">
      {presetOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === preset ? "primary" : "secondary"}
          onClick={() => onChange(option.value)}
        >
          {t(option.labelKey)}
        </Button>
      ))}
    </div>
  );
}

function OwnerDataWarning({
  label,
  error
}: {
  label: string;
  error?: unknown;
}) {
  const t = useTranslations("owner");

  if (!error) {
    return null;
  }

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{t("dashboard.warningTitle", { label })}</CardTitle>
        <CardDescription>{formatErrorMessage(error)}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function EmptyRangeState() {
  const t = useTranslations("owner");

  return (
    <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
      {t("empty.range")}
    </p>
  );
}

function CountRowsCard({
  title,
  description,
  rows
}: {
  title: string;
  description?: string;
  rows: OwnerAnalyticsCountRow[];
}) {
  const t = useTranslations("owner");
  const { locale } = useI18n();

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between gap-4 rounded-card border bg-surface/70 px-4 py-3 text-sm"
            >
              <span className="font-medium text-foreground">
                {ownerStatusLabel(row.key, t)}
              </span>
              <span className="text-muted-foreground">
                {row.count.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")}
              </span>
            </div>
          ))
        ) : (
          <EmptyRangeState />
        )}
      </CardContent>
    </Card>
  );
}

function MoneyRowsCard({
  title,
  description,
  rows,
  currency = "EGP"
}: {
  title: string;
  description?: string;
  rows: Array<OwnerAnalyticsMoneyRow | OwnerAnalyticsTenderRow>;
  currency?: string;
}) {
  const t = useTranslations("owner");
  const { locale } = useI18n();

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.length > 0 ? (
          rows.map((row) => {
            const label =
              "method" in row ? ownerStatusLabel(row.method, t) : row.key;

            return (
              <div
                key={label}
                className="grid gap-2 rounded-card border bg-surface/70 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  {t("analytics.paymentsCount", {
                    count: row.count.toLocaleString(locale === "ar" ? "ar-EG" : "en-US")
                  })}
                </span>
                <span className="font-semibold text-foreground">
                  {formatMoney(row.amountMinor, currency)}
                </span>
              </div>
            );
          })
        ) : (
          <EmptyRangeState />
        )}
      </CardContent>
    </Card>
  );
}

function TopItemsCard({
  title,
  rows,
  currency = "EGP"
}: {
  title: string;
  rows: OwnerAnalyticsItemRow[];
  currency?: string;
}) {
  const t = useTranslations("owner");

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{t("analytics.topItemsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {rows.length > 0 ? (
          rows.map((item) => (
            <div
              key={`${item.menuItemId ?? item.name}-${item.quantity}-${item.revenueMinor}`}
              className="grid gap-2 rounded-card border bg-surface/70 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto]"
            >
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="text-muted-foreground">
                {t("analytics.quantitySold", {
                  count: item.quantity.toLocaleString("en")
                })}
              </span>
              <span className="font-semibold text-foreground">
                {formatMoney(item.revenueMinor, item.currency ?? currency)}
              </span>
            </div>
          ))
        ) : (
          <EmptyRangeState />
        )}
      </CardContent>
    </Card>
  );
}

function DurationMetric({
  label,
  seconds
}: {
  label: string;
  seconds: number | null;
}) {
  const t = useTranslations("owner");

  return (
    <div className="rounded-card border bg-surface/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">
        {formatDuration(seconds, t)}
      </p>
    </div>
  );
}

function CashierShiftPanel({
  data,
  currency
}: {
  data: OwnerAnalyticsCashierShiftsResult;
  currency: string;
}) {
  const t = useTranslations("owner");
  const { locale } = useI18n();
  const currentShift = data.currentOpenShift;
  const latestZReport = data.latestZReport;

  return (
    <Card variant="quiet">
      <CardHeader>
        <Badge variant="muted" className="w-fit">
          {t("analytics.cashierShiftsBadge")}
        </Badge>
        <CardTitle>{t("analytics.cashierShiftsTitle")}</CardTitle>
        <CardDescription>
          {t("analytics.cashierShiftsDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            {t("analytics.currentShift")}
          </p>
          {currentShift ? (
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>{ownerStatusLabel(currentShift.status, t)}</p>
              <p>
                {t("analytics.openedAt", {
                  date: formatOwnerDateTime(currentShift.openedAt, locale)
                })}
              </p>
              <p>
                {t("analytics.expectedCash", {
                  price: formatMoney(currentShift.expectedCashMinor, currency)
                })}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("empty.noOpenCashierShift")}
            </p>
          )}
        </div>
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            {t("analytics.latestZReport")}
          </p>
          {latestZReport ? (
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>{latestZReport.reportNumber}</p>
              <p>{formatOwnerDateTime(latestZReport.generatedAt, locale)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("empty.noZReport")}
            </p>
          )}
        </div>
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            {t("analytics.drawerMovement")}
          </p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <p>
              {t("analytics.cashIn", {
                price: formatMoney(
                  data.cashDrawerTransactions.cashInMinor,
                  currency
                )
              })}
            </p>
            <p>
              {t("analytics.cashOut", {
                price: formatMoney(
                  data.cashDrawerTransactions.cashOutMinor,
                  currency
                )
              })}
            </p>
            <p>
              {t("analytics.corrections", {
                price: formatMoney(
                  data.cashDrawerTransactions.correctionMinor,
                  currency
                )
              })}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyReportPanel({
  report,
  currency
}: {
  report?: OwnerAnalyticsDailyReportResult;
  currency: string;
}) {
  const t = useTranslations("owner");
  const { locale } = useI18n();

  if (!report) {
    return (
      <Card variant="quiet">
        <CardHeader>
          <CardTitle>{t("analytics.dailyReport")}</CardTitle>
          <CardDescription>{t("empty.noReportData")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card variant="quiet">
      <CardHeader>
        <Badge variant="muted" className="w-fit">
          {ownerStatusLabel(report.reportType, t)}
        </Badge>
        <CardTitle>{t("analytics.dailyReportSnapshot")}</CardTitle>
        <CardDescription>
          {t("analytics.generatedReportRange", {
            date: formatOwnerDateTime(report.generatedAt, locale),
            from: formatOwnerDateTime(report.range.from, locale),
            to: formatOwnerDateTime(report.range.to, locale)
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReportValue
          label={t("analytics.collected")}
          value={formatMoney(report.summary.collectedMinor, currency)}
        />
        <ReportValue
          label={t("analytics.paidBills")}
          value={report.summary.paidBillCount.toLocaleString("en")}
        />
        <ReportValue
          label={t("analytics.topItem")}
          value={report.items.topItemsByQuantity[0]?.name ?? t("empty.noData")}
        />
        <ReportValue
          label={t("analytics.latestZ")}
          value={
            report.cashierShifts.latestZReport?.reportNumber ??
            t("empty.noData")
          }
        />
      </CardContent>
    </Card>
  );
}

function ReportValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border bg-surface/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatDuration(
  seconds: number | null,
  t: ReturnType<typeof useTranslations>
) {
  if (seconds === null) {
    return t("empty.noData");
  }

  if (seconds < 60) {
    return t("orders.durationSeconds", { count: seconds });
  }

  if (seconds < 3600) {
    return t("orders.durationMinutes", {
      count: Math.round(seconds / 60)
    });
  }

  return t("orders.durationHours", {
    count: (seconds / 3600).toFixed(1)
  });
}

function getDashboardCurrency(data: OwnerAnalyticsDashboardResult) {
  return (
    data.summary.activeCashierShift?.currency ??
    data.summary.latestClosedShift?.currency ??
    data.items.topItemsByQuantity.find((row) => row.currency)?.currency ??
    "EGP"
  );
}

type OwnerOfficeView = "home" | "operations" | "insights";

function useOwnerOfficeView() {
  const [view, setView] = useState<OwnerOfficeView>("home");

  useEffect(() => {
    const syncView = () => {
      if (window.location.hash === "#operations") {
        setView("operations");
        return;
      }

      if (window.location.hash === "#insights") {
        setView("insights");
        return;
      }

      setView("home");
    };

    syncView();
    window.addEventListener("hashchange", syncView);

    return () => window.removeEventListener("hashchange", syncView);
  }, []);

  return view;
}

function OwnerDashboardContent() {
  const t = useTranslations("owner");
  const officeT = useTranslations("staff");
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const accessibleBranches = useMemo(
    () => effectiveAccess?.branches ?? [],
    [effectiveAccess]
  );
  const [preset, setPreset] = useState<OwnerAnalyticsPreset>("today");
  const [scopeMode, setScopeMode] = useState<"branch" | "company">("branch");
  const officeView = useOwnerOfficeView();
  const analyticsQuery = useMemo(() => ({ preset }), [preset]);
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const dashboardQuery = useQuery({
    queryKey: staffQueryKeys.ownerAnalyticsDashboard(
      selectedBranchId,
      analyticsQuery
    ),
    queryFn: () =>
      getOwnerAnalyticsDashboard(
        selectedBranchId ?? "",
        analyticsQuery,
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const reportQuery = useQuery({
    queryKey: staffQueryKeys.ownerDailyReport(selectedBranchId, analyticsQuery),
    queryFn: () =>
      getOwnerDailyReport(selectedBranchId ?? "", analyticsQuery, accessToken),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const companyDashboardQueries = useQueries({
    queries: accessibleBranches.map((entry) => ({
      queryKey: staffQueryKeys.ownerAnalyticsDashboard(
        entry.branch.id,
        analyticsQuery
      ),
      queryFn: () =>
        getOwnerAnalyticsDashboard(
          entry.branch.id,
          analyticsQuery,
          accessToken
        ),
      enabled: Boolean(accessToken && scopeMode === "company"),
      staleTime: 15_000
    }))
  });
  const refreshAll = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.ownerAnalyticsDashboard(
        selectedBranchId,
        analyticsQuery
      )
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.ownerDailyReport(selectedBranchId, analyticsQuery)
    });
  };

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title={t("empty.noAccessibleBranchTitle")}
        description={t("empty.noAccessibleBranchDescription")}
      />
    );
  }

  if (dashboardQuery.isPending) {
    return <LoadingState label={t("dashboard.loadingAnalytics")} />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        title={t("errors.analyticsLoadTitle")}
        description={formatErrorMessage(dashboardQuery.error)}
        action={
          <Button variant="secondary" onClick={refreshAll}>
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.retry")}
          </Button>
        }
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const summary = dashboard.summary;
  const sales = dashboard.sales;
  const orders = dashboard.orders;
  const items = dashboard.items;
  const operations = dashboard.operations;
  const cashierShifts = dashboard.cashierShifts;
  const aiWaiter = dashboard.aiWaiter;
  const currency = getDashboardCurrency(dashboard);
  const topItemName = items.topItemsByQuantity[0]?.name ?? t("empty.noData");
  const companyRows = accessibleBranches.flatMap((entry, index) => {
    const branchDashboard = companyDashboardQueries[index]?.data;

    return branchDashboard
      ? [{ branch: entry.branch, dashboard: branchDashboard }]
      : [];
  });
  const companyCurrencies = new Set(
    companyRows.map((row) => getDashboardCurrency(row.dashboard))
  );
  const companyCurrency =
    companyCurrencies.size === 1
      ? companyCurrencies.values().next().value ?? currency
      : null;
  const companyTotals = companyRows.reduce(
    (totals, row) => {
      totals.revenueMinor += row.dashboard.summary.paidRevenueMinor;
      totals.collectedMinor += row.dashboard.summary.collectedMinor;
      totals.paidBillCount += row.dashboard.summary.paidBillCount;
      totals.orders += row.dashboard.orders.submittedOrderCount;
      totals.urgentAttention += row.dashboard.operations.urgentAttentionCount;
      totals.activeAttention += row.dashboard.operations.activeAttentionCount;
      totals.waiterCalls += row.dashboard.summary.openWaiterCallCount;
      totals.lowStock += row.dashboard.summary.lowStockCount ?? 0;
      totals.outOfStock += row.dashboard.summary.outOfStockCount ?? 0;
      totals.failedPrintJobs += row.dashboard.operations.failedPrintJobCount;
      totals.blockedMenuItems +=
        row.dashboard.summary.stockBlockedMenuItemCount ?? 0;
      totals.cashOverShortMinor += row.dashboard.cashierShifts.totalOverShortMinor;
      totals.shiftCount += row.dashboard.cashierShifts.shiftCount;
      totals.aiSessions += row.dashboard.aiWaiter.aiSessionCount;
      totals.aiMessages += row.dashboard.aiWaiter.aiMessageCount;
      totals.aiEscalations += row.dashboard.aiWaiter.escalatedCount;
      return totals;
    },
    {
      revenueMinor: 0,
      collectedMinor: 0,
      paidBillCount: 0,
      orders: 0,
      urgentAttention: 0,
      activeAttention: 0,
      waiterCalls: 0,
      lowStock: 0,
      outOfStock: 0,
      failedPrintJobs: 0,
      blockedMenuItems: 0,
      cashOverShortMinor: 0,
      shiftCount: 0,
      aiSessions: 0,
      aiMessages: 0,
      aiEscalations: 0
    }
  );
  const companyScopePending =
    scopeMode === "company" &&
    companyDashboardQueries.some((query) => query.isPending);

  return (
    <div className="grid gap-5">
      <Card variant="quiet">
        <CardHeader className="gap-4 xl:flex xl:flex-row xl:items-start xl:justify-between xl:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">
                {officeView === "operations"
                  ? officeT("office.operations")
                  : officeView === "insights"
                    ? officeT("office.insights")
                    : officeT("office.home")}
              </Badge>
              <div className="flex rounded-md border border-[#D6D6D1] bg-white p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={scopeMode === "company" ? "primary" : "ghost"}
                  onClick={() => setScopeMode("company")}
                  disabled={accessibleBranches.length < 2}
                >
                  {officeT("office.sourceCompany")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={scopeMode === "branch" ? "primary" : "ghost"}
                  onClick={() => setScopeMode("branch")}
                >
                  {officeT("office.sourceBranch")}
                </Button>
              </div>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">
              {scopeMode === "company"
                ? selectedBranchAccess?.company.name ?? selectedBranch.name
                : selectedBranch.name}
            </CardTitle>
            <CardDescription>
              {scopeMode === "company"
                ? `${accessibleBranches.length.toLocaleString("en")} ${officeT("office.locations")}`
                : officeView === "operations"
                  ? officeT("office.operationsDescription")
                  : officeView === "insights"
                    ? officeT("office.insightsDescription")
                    : t("dashboard.viewingDescription", {
                        name:
                          staffUser?.name ||
                          staffUser?.email ||
                          t("dashboard.staffUserFallback")
                      })}
            </CardDescription>
          </div>
          <div className="grid gap-3">
            <RangeSelector preset={preset} onChange={setPreset} />
            <Button variant="secondary" onClick={refreshAll}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("actions.refresh")}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <OwnerDataWarning
        label={t("analytics.dailyReport")}
        error={reportQuery.error}
      />

      {officeView === "home" ? (
        <>
          {companyScopePending ? (
            <LoadingState label={t("dashboard.loadingAnalytics")} />
          ) : null}

          {scopeMode === "company" && companyRows.length > 0 ? (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label={t("pulse.urgent")}
                  value={companyTotals.urgentAttention.toLocaleString("en")}
                  description={t("pulse.urgentDescription")}
                  icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
                  tone={companyTotals.urgentAttention > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label={t("analytics.openWaiterCalls")}
                  value={companyTotals.waiterCalls.toLocaleString("en")}
                  description={t("pulse.waiterCallsDescription")}
                  icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
                  tone={companyTotals.waiterCalls > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label={t("analytics.stockRisk")}
                  value={`${companyTotals.lowStock}/${companyTotals.outOfStock}`}
                  description={t("analytics.stockRiskDescription", {
                    count: companyTotals.blockedMenuItems
                  })}
                  icon={<Boxes className="size-4" aria-hidden="true" />}
                  tone={
                    companyTotals.outOfStock > 0 ||
                    companyTotals.blockedMenuItems > 0
                      ? "warning"
                      : "success"
                  }
                />
                <MetricCard
                  label={t("orders.printJobs")}
                  value={companyTotals.failedPrintJobs.toLocaleString("en")}
                  description={t("orders.printJobsDescription", {
                    count: companyTotals.failedPrintJobs.toLocaleString("en")
                  })}
                  icon={<Receipt className="size-4" aria-hidden="true" />}
                  tone={companyTotals.failedPrintJobs > 0 ? "warning" : "success"}
                />
              </section>

              <Card variant="quiet">
                <CardHeader>
                  <CardTitle>{officeT("office.locations")}</CardTitle>
                  <CardDescription>
                    {officeT("office.insightsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {companyRows.map((row) => (
                    <div
                      key={row.branch.id}
                      className="grid gap-2 rounded-card border bg-surface/70 p-3 text-sm md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,auto))] md:items-center"
                    >
                      <span className="font-semibold">{row.branch.name}</span>
                      <span>
                        {formatMoney(
                          row.dashboard.summary.paidRevenueMinor,
                          getDashboardCurrency(row.dashboard)
                        )}
                      </span>
                      <span>
                        {row.dashboard.orders.submittedOrderCount.toLocaleString("en")}{" "}
                        {t("analytics.orders")}
                      </span>
                      <span>
                        {row.dashboard.operations.urgentAttentionCount.toLocaleString("en")}{" "}
                        {t("pulse.urgent")}
                      </span>
                      <span>
                        {(row.dashboard.summary.outOfStockCount ?? 0).toLocaleString("en")}{" "}
                        {t("analytics.stockRisk")}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card variant="quiet">
                <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-4">
                  <ReportValue
                    label={t("analytics.revenue")}
                    value={
                      companyCurrency
                        ? formatMoney(companyTotals.revenueMinor, companyCurrency)
                        : t("empty.noData")
                    }
                  />
                  <ReportValue
                    label={t("analytics.orders")}
                    value={companyTotals.orders.toLocaleString("en")}
                  />
                  <ReportValue
                    label={t("pulse.urgent")}
                    value={companyTotals.activeAttention.toLocaleString("en")}
                  />
                  <ReportValue
                    label={officeT("office.locations")}
                    value={companyRows.length.toLocaleString("en")}
                  />
                </CardContent>
              </Card>
            </>
          ) : null}

          {scopeMode === "branch" ? (
            <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("pulse.urgent")}
              value={operations.urgentAttentionCount.toLocaleString("en")}
              description={t("pulse.urgentDescription")}
              icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
              tone={operations.urgentAttentionCount > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("analytics.openWaiterCalls")}
              value={summary.openWaiterCallCount.toLocaleString("en")}
              description={t("pulse.waiterCallsDescription")}
              icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
              tone={summary.openWaiterCallCount > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("analytics.stockRisk")}
              value={`${summary.lowStockCount ?? 0}/${summary.outOfStockCount ?? 0}`}
              description={t("analytics.stockRiskDescription", {
                count: summary.stockBlockedMenuItemCount ?? 0
              })}
              icon={<Boxes className="size-4" aria-hidden="true" />}
              tone={
                (summary.outOfStockCount ?? 0) > 0 ||
                (summary.stockBlockedMenuItemCount ?? 0) > 0
                  ? "warning"
                  : "success"
              }
            />
            <MetricCard
              label={t("orders.printJobs")}
              value={operations.failedPrintJobCount.toLocaleString("en")}
              description={t("orders.printJobsDescription", {
                count: operations.failedPrintJobCount.toLocaleString("en")
              })}
              icon={<Receipt className="size-4" aria-hidden="true" />}
              tone={operations.failedPrintJobCount > 0 ? "warning" : "success"}
            />
          </section>

          <Card variant="quiet">
            <CardHeader>
              <Badge variant="muted" className="w-fit">
                {t("operations.snapshotBadge")}
              </Badge>
              <CardTitle>
                {t("health.branchHealthTitle", {
                  branchName: selectedBranch.name
                })}
              </CardTitle>
              <CardDescription>
                {operations.activeAttentionCount > 0
                  ? t("health.descriptions.needsManagerAttention")
                  : t("health.descriptions.calm")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <ReportValue
                label={t("analytics.revenue")}
                value={formatMoney(summary.paidRevenueMinor, currency)}
              />
              <ReportValue
                label={t("analytics.orders")}
                value={orders.submittedOrderCount.toLocaleString("en")}
              />
              <ReportValue
                label={t("pulse.billRequests")}
                value={summary.activeBillRequestCount.toLocaleString("en")}
              />
              <ReportValue
                label={t("analytics.topItem")}
                value={topItemName}
              />
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-2">
            <CountRowsCard
              title={t("orders.waiterCallsTitle")}
              description={t("orders.waiterCallsDescription")}
              rows={operations.waiterCallCountsByStatus}
            />
            <CountRowsCard
              title={t("orders.preparationTasks")}
              description={t("orders.preparationTasksDescription")}
              rows={operations.preparationTaskCountsByStatus}
            />
          </div>

            </>
          ) : null}
        </>
      ) : null}

      {officeView === "operations" ? (
        <section className="grid gap-5">
          {scopeMode === "company" ? (
            <>

          {companyScopePending ? (
            <LoadingState label={t("dashboard.loadingAnalytics")} />
          ) : null}
          {companyRows.length > 0 ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <MetricCard
                  label={t("pulse.urgent")}
                  value={companyTotals.urgentAttention.toLocaleString("en")}
                  description={t("pulse.urgentDescription")}
                  icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
                  tone={companyTotals.urgentAttention > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label={t("analytics.orders")}
                  value={companyTotals.orders.toLocaleString("en")}
                  description={officeT("office.operationsDescription")}
                  icon={<ShoppingBag className="size-4" aria-hidden="true" />}
                  tone="muted"
                />
                <MetricCard
                  label={t("analytics.openWaiterCalls")}
                  value={companyTotals.waiterCalls.toLocaleString("en")}
                  description={t("pulse.waiterCallsDescription")}
                  icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
                  tone={companyTotals.waiterCalls > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label={t("orders.printJobs")}
                  value={companyTotals.failedPrintJobs.toLocaleString("en")}
                  description={t("orders.printJobsDescription", {
                    count: companyTotals.failedPrintJobs.toLocaleString("en")
                  })}
                  icon={<Receipt className="size-4" aria-hidden="true" />}
                  tone={companyTotals.failedPrintJobs > 0 ? "warning" : "success"}
                />
                <MetricCard
                  label={t("analytics.aiSessions")}
                  value={companyTotals.aiSessions.toLocaleString("en")}
                  description={t("analytics.aiSessionsDescription", {
                    messages: companyTotals.aiMessages.toLocaleString("en"),
                    escalations: companyTotals.aiEscalations.toLocaleString("en")
                  })}
                  icon={<Bot className="size-4" aria-hidden="true" />}
                  tone="primary"
                />
              </div>

              <Card variant="quiet">
                <CardHeader>
                  <CardTitle>{officeT("office.locations")}</CardTitle>
                  <CardDescription>
                    {officeT("office.operationsDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {companyRows.map((row) => (
                    <div
                      key={row.branch.id}
                      className="grid gap-2 rounded-card border bg-surface/70 p-3 text-sm md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,auto))] md:items-center"
                    >
                      <span className="font-semibold">{row.branch.name}</span>
                      <span>
                        {row.dashboard.operations.urgentAttentionCount.toLocaleString("en")}{" "}
                        {t("pulse.urgent")}
                      </span>
                      <span>
                        {row.dashboard.orders.submittedOrderCount.toLocaleString("en")}{" "}
                        {t("analytics.orders")}
                      </span>
                      <span>
                        {row.dashboard.summary.openWaiterCallCount.toLocaleString("en")}{" "}
                        {t("analytics.openWaiterCalls")}
                      </span>
                      <span>
                        {row.dashboard.operations.failedPrintJobCount.toLocaleString("en")}{" "}
                        {t("orders.printJobs")}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          ) : null}

            </>
          ) : (
            <>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("pulse.urgent")}
              value={operations.urgentAttentionCount.toLocaleString("en")}
              description={t("pulse.urgentDescription")}
              icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
              tone={operations.urgentAttentionCount > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("analytics.orders")}
              value={orders.submittedOrderCount.toLocaleString("en")}
              description={t("analytics.ordersDescription", {
                served: summary.servedOrderCount.toLocaleString("en"),
                completed: summary.completedOrderCount.toLocaleString("en")
              })}
              icon={<ShoppingBag className="size-4" aria-hidden="true" />}
              tone="muted"
            />
            <MetricCard
              label={t("analytics.openWaiterCalls")}
              value={summary.openWaiterCallCount.toLocaleString("en")}
              description={t("pulse.waiterCallsDescription")}
              icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
              tone={summary.openWaiterCallCount > 0 ? "warning" : "success"}
            />
            <MetricCard
              label={t("orders.printJobs")}
              value={operations.failedPrintJobCount.toLocaleString("en")}
              description={t("orders.printJobsDescription", {
                count: operations.failedPrintJobCount.toLocaleString("en")
              })}
              icon={<Receipt className="size-4" aria-hidden="true" />}
              tone={operations.failedPrintJobCount > 0 ? "warning" : "success"}
            />

            <MetricCard
              label={t("analytics.aiSessions")}
              value={aiWaiter.aiSessionCount.toLocaleString("en")}
              description={t("analytics.aiSessionsDescription", {
                messages: aiWaiter.aiMessageCount.toLocaleString("en"),
                escalations: aiWaiter.escalatedCount.toLocaleString("en")
              })}
              icon={<Bot className="size-4" aria-hidden="true" />}
              tone="primary"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <CountRowsCard
              title={t("orders.statusTitle")}
              description={t("orders.statusDescription")}
              rows={orders.orderCountByStatus}
            />
            <CountRowsCard
              title={t("orders.billStatusTitle")}
              description={t("orders.billStatusDescription")}
              rows={sales.billCountByStatus}
            />
            <CountRowsCard
              title={t("orders.waiterCallsTitle")}
              description={t("orders.waiterCallsDescription")}
              rows={operations.waiterCallCountsByStatus}
            />
          </div>

          <Card variant="quiet">
            <CardHeader>
              <Badge variant="muted" className="w-fit">
                {t("orders.lifecycleBadge")}
              </Badge>
              <CardTitle>{t("orders.timingTitle")}</CardTitle>
              <CardDescription>{t("orders.timingDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <DurationMetric
                label={t("orders.submitToAccept")}
                seconds={orders.lifecycleAverages.submittedToAcceptedSeconds}
              />
              <DurationMetric
                label={t("orders.acceptToPrep")}
                seconds={orders.lifecycleAverages.acceptedToPreparingSeconds}
              />
              <DurationMetric
                label={t("orders.prepToReady")}
                seconds={orders.lifecycleAverages.preparingToReadySeconds}
              />
              <DurationMetric
                label={t("orders.readyToServed")}
                seconds={orders.lifecycleAverages.readyToServedSeconds}
              />
              <DurationMetric
                label={t("orders.submitToServed")}
                seconds={orders.lifecycleAverages.submittedToServedSeconds}
              />
            </CardContent>
          </Card>

          <div className="grid gap-5 xl:grid-cols-3">
            <CountRowsCard
              title={t("orders.preparationTasks")}
              description={t("orders.preparationTasksDescription")}
              rows={operations.preparationTaskCountsByStatus}
            />
            <CountRowsCard
              title={t("orders.kitchenTickets")}
              description={t("orders.kitchenTicketsDescription")}
              rows={operations.kitchenTicketCountsByStatus}
            />
            <CountRowsCard
              title={t("orders.printJobs")}
              description={t("orders.printJobsDescription", {
                count: operations.failedPrintJobCount.toLocaleString("en")
              })}
              rows={operations.printJobCountsByStatus}
            />
          </div>

          <CashierShiftPanel data={cashierShifts} currency={currency} />

            </>
          )}
        </section>
      ) : null}

      {officeView === "insights" ? (
        <section className="grid gap-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("analytics.revenue")}
              value={formatMoney(summary.paidRevenueMinor, currency)}
              description={t("analytics.revenueDescription")}
              icon={<BarChart3 className="size-4" aria-hidden="true" />}
              tone="success"
            />
            <MetricCard
              label={t("analytics.collected")}
              value={formatMoney(summary.collectedMinor, currency)}
              description={t("analytics.collectedDescription")}
              icon={<WalletCards className="size-4" aria-hidden="true" />}
              tone="primary"
            />
            <MetricCard
              label={t("analytics.averageTicket")}
              value={formatMoney(summary.averageTicketMinor, currency)}
              description={t("analytics.paidBillsCount", {
                count: summary.paidBillCount.toLocaleString("en")
              })}
              icon={<Receipt className="size-4" aria-hidden="true" />}
              tone="accent"
            />
            <MetricCard
              label={t("analytics.orders")}
              value={orders.submittedOrderCount.toLocaleString("en")}
              description={t("analytics.ordersDescription", {
                served: summary.servedOrderCount.toLocaleString("en"),
                completed: summary.completedOrderCount.toLocaleString("en")
              })}
              icon={<ShoppingBag className="size-4" aria-hidden="true" />}
              tone="muted"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label={t("analytics.cashOverShort")}
              value={formatMoney(cashierShifts.totalOverShortMinor, currency)}
              description={t("analytics.closedShiftsCount", {
                count: cashierShifts.shiftCount.toLocaleString("en")
              })}
              icon={<WalletCards className="size-4" aria-hidden="true" />}
              tone={
                cashierShifts.totalOverShortMinor === 0 ? "success" : "warning"
              }
            />
            <MetricCard
              label={t("analytics.topItem")}
              value={topItemName}
              description={t("analytics.topItemDescription")}
              icon={<ShoppingBag className="size-4" aria-hidden="true" />}
              tone="muted"
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <MoneyRowsCard
              title={t("analytics.tenderBreakdown")}
              description={t("analytics.tenderBreakdownDescription")}
              rows={sales.tenderBreakdown}
              currency={currency}
            />
            <MoneyRowsCard
              title={t("analytics.revenueByDay")}
              description={t("analytics.revenueByDayDescription")}
              rows={sales.revenueByDay}
              currency={currency}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <TopItemsCard
              title={t("menu.topItemsByQuantity")}
              rows={items.topItemsByQuantity}
              currency={currency}
            />
            <TopItemsCard
              title={t("menu.topItemsByRevenue")}
              rows={items.topItemsByRevenue}
              currency={currency}
            />
          </div>

          {scopeMode === "company" && companyRows.length > 0 ? (
            <Card variant="quiet">
              <CardHeader>
                <CardTitle>{officeT("office.locations")}</CardTitle>
                <CardDescription>
                  {officeT("office.insightsDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {companyRows.map((row) => (
                  <div
                    key={row.branch.id}
                    className="grid gap-2 rounded-card border bg-surface/70 p-3 text-sm md:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,auto))] md:items-center"
                  >
                    <span className="font-semibold">{row.branch.name}</span>
                    <span>
                      {formatMoney(
                        row.dashboard.summary.paidRevenueMinor,
                        getDashboardCurrency(row.dashboard)
                      )}
                    </span>
                    <span>
                      {row.dashboard.orders.submittedOrderCount.toLocaleString("en")}{" "}
                      {t("analytics.orders")}
                    </span>
                    <span>
                      {row.dashboard.cashierShifts.totalOverShortMinor === 0
                        ? t("health.levels.calm")
                        : formatMoney(
                            row.dashboard.cashierShifts.totalOverShortMinor,
                            getDashboardCurrency(row.dashboard)
                          )}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <DailyReportPanel report={reportQuery.data} currency={currency} />
        </section>
      ) : null}
    </div>
  );
}

export function OwnerDashboardPage() {
  const t = useTranslations("owner");

  return (
    <OfficeStaffShell
      activeDomain="home"
      title={t("dashboard.title")}
      description={t("dashboard.description")}
      actions={<OwnerDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["owner_analytics.read"]} branchScoped>
        <OwnerDashboardContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
