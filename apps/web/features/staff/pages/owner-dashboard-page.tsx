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
  LayoutDashboard,
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
import { StaffPageShell } from "@/features/staff/staff-page-shell";
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

const presetOptions: Array<{ label: string; value: OwnerAnalyticsPreset }> = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "last_7_days" },
  { label: "Last 30 days", value: "last_30_days" }
];

function OwnerDashboardActions() {
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
        href="/staff/billing"
        className={buttonVariants({ variant: "ghost" })}
      >
        <CreditCard className="size-4" aria-hidden="true" />
        Billing
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
      <Link
        href="/staff/waiter"
        className={buttonVariants({ variant: "ghost" })}
      >
        <UserRoundCheck className="size-4" aria-hidden="true" />
        Waiter
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

function RangeSelector({
  preset,
  onChange
}: {
  preset: OwnerAnalyticsPreset;
  onChange: (preset: OwnerAnalyticsPreset) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presetOptions.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant={option.value === preset ? "primary" : "secondary"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
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
  if (!error) {
    return null;
  }

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{label} warning</CardTitle>
        <CardDescription>{formatErrorMessage(error)}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function EmptyRangeState() {
  return (
    <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
      No data in this range yet.
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
                  {row.count.toLocaleString("en")} payments
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
  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Historical paid bill line snapshots.</CardDescription>
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
                {item.quantity.toLocaleString("en")} sold
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
  return (
    <div className="rounded-card border bg-surface/70 p-4">
      <p className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-xl font-semibold text-foreground">
        {formatDuration(seconds)}
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
  const currentShift = data.currentOpenShift;
  const latestZReport = data.latestZReport;

  return (
    <Card variant="quiet">
      <CardHeader>
        <Badge variant="muted" className="w-fit">
          Cashier shifts
        </Badge>
        <CardTitle>Drawer and Z report control</CardTitle>
        <CardDescription>
          Current shift, recent closed shifts, over/short, and drawer movement.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            Current shift
          </p>
          {currentShift ? (
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>{humanizeStatus(currentShift.status)}</p>
              <p>Opened {formatDateTime(currentShift.openedAt)}</p>
              <p>
                Expected cash{" "}
                {formatMoney(currentShift.expectedCashMinor, currency)}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No open cashier shift.
            </p>
          )}
        </div>
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            Latest Z report
          </p>
          {latestZReport ? (
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>{latestZReport.reportNumber}</p>
              <p>{formatDateTime(latestZReport.generatedAt)}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No Z report in this range yet.
            </p>
          )}
        </div>
        <div className="rounded-card border bg-surface/70 p-4">
          <p className="text-sm font-semibold text-foreground">
            Drawer movement
          </p>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
            <p>
              Cash in{" "}
              {formatMoney(data.cashDrawerTransactions.cashInMinor, currency)}
            </p>
            <p>
              Cash out{" "}
              {formatMoney(data.cashDrawerTransactions.cashOutMinor, currency)}
            </p>
            <p>
              Corrections{" "}
              {formatMoney(data.cashDrawerTransactions.correctionMinor, currency)}
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
  if (!report) {
    return (
      <Card variant="quiet">
        <CardHeader>
          <CardTitle>Daily report</CardTitle>
          <CardDescription>No report data loaded yet.</CardDescription>
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
        <CardTitle>Readable daily report snapshot</CardTitle>
        <CardDescription>
          Generated {formatDateTime(report.generatedAt)} for{" "}
          {formatDateTime(report.range.from)} to {formatDateTime(report.range.to)}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReportValue
          label="Collected"
          value={formatMoney(report.summary.collectedMinor, currency)}
        />
        <ReportValue
          label="Paid bills"
          value={report.summary.paidBillCount.toLocaleString("en")}
        />
        <ReportValue
          label="Top item"
          value={report.items.topItemsByQuantity[0]?.name ?? "No data"}
        />
        <ReportValue
          label="Latest Z"
          value={report.cashierShifts.latestZReport?.reportNumber ?? "No data"}
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

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return "No data";
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
        title="No accessible branch"
        description="This staff account does not expose a branch for owner analytics yet."
      />
    );
  }

  if (dashboardQuery.isPending) {
    return <LoadingState label="Loading owner analytics" />;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    return (
      <EmptyState
        title="Owner analytics could not load"
        description={formatErrorMessage(dashboardQuery.error)}
        action={
          <Button variant="secondary" onClick={refreshAll}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
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
  const topItemName = items.topItemsByQuantity[0]?.name ?? "No data";
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
              <Badge variant="muted">Owner analytics</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {staffUser?.name || staffUser?.email || "Staff user"} is viewing
              recorded branch management analytics from orders, bills, payments,
              operations, shifts, and AI waiter usage.
            </CardDescription>
          </div>
          <div className="grid gap-3">
            <RangeSelector preset={preset} onChange={setPreset} />
            <Button variant="secondary" onClick={refreshAll}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <OwnerDataWarning label="Daily report" error={reportQuery.error} />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Revenue"
          value={formatMoney(summary.paidRevenueMinor, currency)}
          description="Paid revenue from recorded manual payments."
          icon={<BarChart3 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label="Collected"
          value={formatMoney(summary.collectedMinor, currency)}
          description="Cash, card, wallet, and other manual tender recorded."
          icon={<WalletCards className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label="Average ticket"
          value={formatMoney(summary.averageTicketMinor, currency)}
          description={`${summary.paidBillCount.toLocaleString("en")} paid bills`}
          icon={<Receipt className="size-4" aria-hidden="true" />}
          tone="accent"
        />
        <MetricCard
          label="Orders"
          value={orders.submittedOrderCount.toLocaleString("en")}
          description={`${summary.servedOrderCount.toLocaleString("en")} served, ${summary.completedOrderCount.toLocaleString("en")} completed`}
          icon={<ShoppingBag className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label="Cash over/short"
          value={formatMoney(cashierShifts.totalOverShortMinor, currency)}
          description={`${cashierShifts.shiftCount.toLocaleString("en")} closed shifts in range`}
          icon={<WalletCards className="size-4" aria-hidden="true" />}
          tone={cashOverShortTone}
        />
        <MetricCard
          label="Open waiter calls"
          value={summary.openWaiterCallCount.toLocaleString("en")}
          description={`${summary.activeBillRequestCount.toLocaleString("en")} active bill requests`}
          icon={<UserRoundCheck className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Stock risk"
          value={`${summary.lowStockCount ?? 0}/${summary.outOfStockCount ?? 0}`}
          description={`${summary.stockBlockedMenuItemCount ?? 0} menu items stock-blocked`}
          icon={<Boxes className="size-4" aria-hidden="true" />}
          tone={
            (summary.outOfStockCount ?? 0) > 0 ||
            (summary.stockBlockedMenuItemCount ?? 0) > 0
              ? "warning"
              : "success"
          }
        />
        <MetricCard
          label="AI sessions"
          value={aiWaiter.aiSessionCount.toLocaleString("en")}
          description={`${aiWaiter.aiMessageCount.toLocaleString("en")} messages, ${aiWaiter.escalatedCount.toLocaleString("en")} escalations`}
          icon={<Bot className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label="Top item"
          value={topItemName}
          description="Best seller by paid quantity."
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          tone="success"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <MoneyRowsCard
          title="Tender breakdown"
          description="Recorded manual payment methods."
          rows={sales.tenderBreakdown}
          currency={currency}
        />
        <MoneyRowsCard
          title="Revenue by day"
          description="Manual collections bucketed by recording date."
          rows={sales.revenueByDay}
          currency={currency}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <CountRowsCard
          title="Order status"
          description="Submitted orders grouped by lifecycle status."
          rows={orders.orderCountByStatus}
        />
        <CountRowsCard
          title="Bill status"
          description="Bills created in the selected range."
          rows={sales.billCountByStatus}
        />
        <CountRowsCard
          title="Waiter calls"
          description="Service pressure by waiter call status."
          rows={operations.waiterCallCountsByStatus}
        />
      </section>

      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Lifecycle
          </Badge>
          <CardTitle>Order timing</CardTitle>
          <CardDescription>
            Averages skip orders where a timestamp is not recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <DurationMetric
            label="Submit to accept"
            seconds={orders.lifecycleAverages.submittedToAcceptedSeconds}
          />
          <DurationMetric
            label="Accept to prep"
            seconds={orders.lifecycleAverages.acceptedToPreparingSeconds}
          />
          <DurationMetric
            label="Prep to ready"
            seconds={orders.lifecycleAverages.preparingToReadySeconds}
          />
          <DurationMetric
            label="Ready to served"
            seconds={orders.lifecycleAverages.readyToServedSeconds}
          />
          <DurationMetric
            label="Submit to served"
            seconds={orders.lifecycleAverages.submittedToServedSeconds}
          />
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-2">
        <TopItemsCard
          title="Top items by quantity"
          rows={items.topItemsByQuantity}
          currency={currency}
        />
        <TopItemsCard
          title="Top items by revenue"
          rows={items.topItemsByRevenue}
          currency={currency}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <CountRowsCard
          title="Preparation tasks"
          description="Kitchen, barista, dessert, and cashier preparation status."
          rows={operations.preparationTaskCountsByStatus}
        />
        <CountRowsCard
          title="Kitchen tickets"
          description="Ticket status across preparation stations."
          rows={operations.kitchenTicketCountsByStatus}
        />
        <CountRowsCard
          title="Print jobs"
          description={`${operations.failedPrintJobCount.toLocaleString("en")} failed print jobs in range.`}
          rows={operations.printJobCountsByStatus}
        />
      </section>

      <CashierShiftPanel data={cashierShifts} currency={currency} />

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_1fr]">
        <Card variant="quiet">
          <CardHeader>
            <CardTitle>AI waiter</CardTitle>
            <CardDescription>
              Sessions, proposals, escalation reasons, and estimated usage.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ReportValue
              label="Proposals"
              value={`${aiWaiter.appliedProposalCount.toLocaleString("en")} applied / ${aiWaiter.proposalCount.toLocaleString("en")} total`}
            />
            <ReportValue
              label="Tokens"
              value={`${aiWaiter.inputTokens.toLocaleString("en")} in / ${aiWaiter.outputTokens.toLocaleString("en")} out`}
            />
            <ReportValue
              label="Estimated cost"
              value={formatAiCost(aiWaiter.estimatedCostMicros)}
            />
          </CardContent>
        </Card>
        <CountRowsCard
          title="AI escalation reasons"
          description="Only reasons recorded by the backend are shown."
          rows={aiWaiter.topEscalationReasons}
        />
        <Card variant="quiet">
          <CardHeader>
            <CardTitle>Latest paid bill</CardTitle>
            <CardDescription>Top paid bill by recorded total.</CardDescription>
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
            <CardTitle>Manager navigation</CardTitle>
            <CardDescription>
              Continue operational work in the existing live staff surfaces.
            </CardDescription>
          </div>
          <Badge variant="muted">
            Generated {formatDateTime(dashboard.generatedAt)}
          </Badge>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link
            href="/staff/billing"
            className={buttonVariants({ variant: "secondary" })}
          >
            <CreditCard className="size-4" aria-hidden="true" />
            Plan and limits
          </Link>
          <Link
            href="/staff/cashier"
            className={buttonVariants({ variant: "secondary" })}
          >
            <Receipt className="size-4" aria-hidden="true" />
            Open cashier
          </Link>
          <Link
            href="/staff/kitchen"
            className={buttonVariants({ variant: "secondary" })}
          >
            <ChefHat className="size-4" aria-hidden="true" />
            Open kitchen
          </Link>
          <Link
            href="/staff/waiter"
            className={buttonVariants({ variant: "secondary" })}
          >
            <UserRoundCheck className="size-4" aria-hidden="true" />
            Open waiter
          </Link>
          <Button variant="secondary" onClick={refreshAll}>
            <Download className="size-4" aria-hidden="true" />
            Refresh report
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export function OwnerDashboardPage() {
  return (
    <StaffPageShell
      title="Owner command center"
      description="Branch owner analytics for revenue, orders, items, operations, cashier shifts, and AI waiter usage."
      actions={<OwnerDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["owner_analytics.read"]} branchScoped>
        <OwnerDashboardContent />
      </StaffAuthGate>
    </StaffPageShell>
  );
}
