"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  Boxes,
  ChefHat,
  CreditCard,
  Download,
  LogIn,
  LogOut,
  Receipt,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  UserRoundCheck,
  WalletCards
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
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import {
  formatDateTime,
  formatMoney,
  getRecordNumber,
  getRecordString,
  humanizeStatus
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  getOwnerAnalyticsDashboard,
  getOwnerDailyReport,
  staffLogout
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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
                {humanizeStatus(row.key)}
              </span>
              <span className="text-muted-foreground">
                {row.count.toLocaleString("en")}
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
              "method" in row ? humanizeStatus(row.method) : row.key;

            return (
              <div
                key={label}
                className="grid gap-2 rounded-card border bg-surface/70 px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">
                  {t("analytics.paymentsCount", {
                    count: row.count.toLocaleString("en")
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
              <p>{humanizeStatus(currentShift.status)}</p>
              <p>
                {t("analytics.openedAt", {
                  date: formatDateTime(currentShift.openedAt)
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
              <p>{formatDateTime(latestZReport.generatedAt)}</p>
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
          {humanizeStatus(report.reportType)}
        </Badge>
        <CardTitle>{t("analytics.dailyReportSnapshot")}</CardTitle>
        <CardDescription>
          {t("analytics.generatedReportRange", {
            date: formatDateTime(report.generatedAt),
            from: formatDateTime(report.range.from),
            to: formatDateTime(report.range.to)
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
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }

  return `${(seconds / 3600).toFixed(1)}h`;
}

function formatAiCost(micros: number) {
  if (micros <= 0) {
    return "0";
  }

  return (micros / 1_000_000).toFixed(4);
}

function getDashboardCurrency(data: OwnerAnalyticsDashboardResult) {
  return (
    data.summary.activeCashierShift?.currency ??
    data.summary.latestClosedShift?.currency ??
    data.items.topItemsByQuantity.find((row) => row.currency)?.currency ??
    "EGP"
  );
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
  const [preset, setPreset] = useState<OwnerAnalyticsPreset>("today");
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
  const cashOverShortTone =
    cashierShifts.totalOverShortMinor === 0
      ? "success"
      : cashierShifts.totalOverShortMinor > 0
        ? "warning"
        : "accent";

  return (
    <div className="grid gap-5">
      <Card variant="quiet">
        <CardHeader className="gap-4 xl:flex xl:flex-row xl:items-start xl:justify-between xl:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{t("dashboard.badge")}</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {t("dashboard.viewingDescription", {
                name: staffUser?.name || staffUser?.email || t("dashboard.staffUserFallback")
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

      <OwnerDataWarning label={t("analytics.dailyReport")} error={reportQuery.error} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <MetricCard
          label={t("analytics.cashOverShort")}
          value={formatMoney(cashierShifts.totalOverShortMinor, currency)}
          description={t("analytics.closedShiftsCount", {
            count: cashierShifts.shiftCount.toLocaleString("en")
          })}
          icon={<WalletCards className="size-4" aria-hidden="true" />}
          tone={cashOverShortTone}
        />
        <MetricCard
          label={t("analytics.openWaiterCalls")}
          value={summary.openWaiterCallCount.toLocaleString("en")}
          description={t("analytics.activeBillRequestsCount", {
            count: summary.activeBillRequestCount.toLocaleString("en")
          })}
          icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
          tone="warning"
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
          label={t("analytics.aiSessions")}
          value={aiWaiter.aiSessionCount.toLocaleString("en")}
          description={t("analytics.aiSessionsDescription", {
            messages: aiWaiter.aiMessageCount.toLocaleString("en"),
            escalations: aiWaiter.escalatedCount.toLocaleString("en")
          })}
          icon={<Bot className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label={t("analytics.topItem")}
          value={topItemName}
          description={t("analytics.topItemDescription")}
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          tone="success"
        />
      </section>

      <section id="money" className="scroll-mt-24 grid gap-3">
        <div className="border-b border-[#DADAD5] pb-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#20201D]">
            {officeT("office.moneyTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#74746E]">
            {officeT("office.moneyDescription")}
          </p>
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
      </section>

      <section id="operations" className="scroll-mt-24 grid gap-3">
        <div className="border-b border-[#DADAD5] pb-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#20201D]">
            {officeT("office.operationsTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#74746E]">
            {officeT("office.operationsDescription")}
          </p>
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
          <CardDescription>
            {t("orders.timingDescription")}
          </CardDescription>
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
      </section>

      <section id="insights" className="scroll-mt-24 grid gap-3">
        <div className="border-b border-[#DADAD5] pb-3">
          <h2 className="text-lg font-semibold tracking-[-0.02em] text-[#20201D]">
            {officeT("office.insightsTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#74746E]">
            {officeT("office.insightsDescription")}
          </p>
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
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
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
      </section>

      <CashierShiftPanel data={cashierShifts} currency={currency} />

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <Card variant="quiet">
          <CardHeader>
            <CardTitle>{t("analytics.aiWaiterTitle")}</CardTitle>
            <CardDescription>
              {t("analytics.aiWaiterDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ReportValue
              label={t("analytics.proposals")}
              value={t("analytics.proposalsValue", {
                applied: aiWaiter.appliedProposalCount.toLocaleString("en"),
                total: aiWaiter.proposalCount.toLocaleString("en")
              })}
            />
            <ReportValue
              label={t("analytics.tokens")}
              value={t("analytics.tokensValue", {
                input: aiWaiter.inputTokens.toLocaleString("en"),
                output: aiWaiter.outputTokens.toLocaleString("en")
              })}
            />
            <ReportValue
              label={t("analytics.estimatedCost")}
              value={formatAiCost(aiWaiter.estimatedCostMicros)}
            />
          </CardContent>
        </Card>
        <CountRowsCard
          title={t("analytics.aiEscalationReasons")}
          description={t("analytics.aiEscalationReasonsDescription")}
          rows={aiWaiter.topEscalationReasons}
        />
        <Card variant="quiet">
          <CardHeader>
            <CardTitle>{t("analytics.latestPaidBill")}</CardTitle>
            <CardDescription>
              {t("analytics.latestPaidBillDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sales.topPaidBills[0] ? (
              <div className="grid gap-2 rounded-card border bg-surface/70 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  {getRecordString(sales.topPaidBills[0], "billNumber", "Bill")}
                </p>
                <p>
                  {formatMoney(
                    getRecordNumber(sales.topPaidBills[0], "totalMinor"),
                    currency
                  )}
                </p>
                <p>
                  {humanizeStatus(
                    getRecordString(sales.topPaidBills[0], "status")
                  )}
                </p>
              </div>
            ) : (
              <EmptyRangeState />
            )}
          </CardContent>
        </Card>
      </section>

      <DailyReportPanel report={reportQuery.data} currency={currency} />

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <CardTitle>{t("dashboard.managerNavigation")}</CardTitle>
            <CardDescription>
              {t("dashboard.managerNavigationDescription")}
            </CardDescription>
          </div>
          <Badge variant="muted">
            {t("dashboard.generatedAt", {
              date: formatDateTime(dashboard.generatedAt)
            })}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/staff/billing"
            className={buttonVariants({ variant: "secondary" })}
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {t("actions.planAndLimits")}
          </Link>
          <Link
            href="/staff/cashier"
            className={buttonVariants({ variant: "secondary" })}
          >
            <Receipt className="size-4" aria-hidden="true" />
            {t("actions.openCashier")}
          </Link>
          <Link
            href="/staff/kitchen"
            className={buttonVariants({ variant: "secondary" })}
          >
            <ChefHat className="size-4" aria-hidden="true" />
            {t("actions.openKitchen")}
          </Link>
          <Link
            href="/staff/waiter"
            className={buttonVariants({ variant: "secondary" })}
          >
            <UserRoundCheck className="size-4" aria-hidden="true" />
            {t("actions.openWaiter")}
          </Link>
          <Button variant="secondary" onClick={refreshAll}>
            <Download className="size-4" aria-hidden="true" />
            {t("actions.refreshReport")}
          </Button>
        </CardContent>
      </Card>
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
