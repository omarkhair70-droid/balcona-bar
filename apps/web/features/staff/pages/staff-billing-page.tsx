"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BadgeCheck,
  CreditCard,
  Gauge,
  Infinity as InfinityIcon,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Rocket
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { OfficeStaffShell } from "@/features/staff/office-staff-shell";
import { formatDateTime, formatMoney, humanizeStatus } from "@/features/staff/staff-format";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  cancelCompanySaasBilling,
  changeCompanySaasBillingPlan,
  getBranchSaasStatus,
  getCompanySaasBilling,
  getSaasPlans,
  startCompanySaasBillingCheckout,
  syncCompanySaasBilling
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  SaasEntitlements,
  SaasPlan,
  SaasStatusNotice,
  SaasUsageMetric
} from "@/lib/api/types";
import { canAccessStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { cn } from "@/lib/utils/cn";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

const entitlementLabels: Array<{
  key: keyof SaasEntitlements;
  label: string;
  description: string;
}> = [
  {
    key: "setup",
    label: "Setup tools",
    description: "Company, branch, staff, table, and launch readiness setup."
  },
  {
    key: "kds",
    label: "KDS",
    description: "Kitchen and preparation station workflows."
  },
  {
    key: "inventory",
    label: "Inventory",
    description: "Stock levels, adjustments, and menu stock gates."
  },
  {
    key: "onlinePayments",
    label: "Online payments",
    description: "Customer online payment intent creation."
  },
  {
    key: "ownerAnalytics",
    label: "Owner analytics",
    description: "Owner dashboard, reports, shifts, revenue, and AI usage."
  },
  {
    key: "aiWaiter",
    label: "AI waiter",
    description: "Customer AI waiter sessions and monthly message usage."
  },
  {
    key: "multiBranch",
    label: "Multi-branch",
    description: "More than one branch under the company."
  },
  {
    key: "advancedReports",
    label: "Advanced reports",
    description: "Future advanced report surfaces."
  }
];

const usageOrder = [
  "branches",
  "tables",
  "staffUsers",
  "menuItems",
  "inventoryItems",
  "aiMessagesThisMonth",
  "onlinePaymentsThisMonth"
];

function formatCount(value: number) {
  return value.toLocaleString("en");
}

function formatUsage(metric: SaasUsageMetric) {
  if (metric.limit === null) {
    return `${formatCount(metric.used)} / unlimited`;
  }

  return `${formatCount(metric.used)} / ${formatCount(metric.limit)}`;
}

function formatRemaining(metric: SaasUsageMetric) {
  if (metric.limit === null) {
    return "Unlimited on this plan";
  }

  return `${formatCount(metric.remaining ?? 0)} remaining`;
}

function getUsageTone(metric: SaasUsageMetric) {
  if (metric.status === "exceeded" || metric.status === "warning") {
    return "warning";
  }

  if (metric.status === "unlimited") {
    return "accent";
  }

  return "success";
}

function getBadgeVariant(
  value?: string | null
): NonNullable<BadgeProps["variant"]> {
  if (value === "active" || value === "trialing" || value === "ok") {
    return "success";
  }

  if (value === "past_due" || value === "warning") {
    return "warning";
  }

  if (value === "suspended" || value === "cancelled" || value === "exceeded") {
    return "danger";
  }

  return "muted";
}

function PlanPrice({ plan }: { plan: SaasPlan }) {
  if (plan.monthlyPriceMinor === null || plan.monthlyPriceMinor === undefined) {
    return <span>Custom</span>;
  }

  return <span>{formatMoney(plan.monthlyPriceMinor, plan.currency)}/mo</span>;
}

function NoticeList({
  title,
  notices,
  variant
}: {
  title: string;
  notices: SaasStatusNotice[];
  variant: "warning" | "danger";
}) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <Card variant="quiet">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-button bg-muted",
              variant === "danger" ? "text-danger" : "text-warning"
            )}
          >
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div>
            <Badge variant={variant} className="mb-3">
              {title}
            </Badge>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              These signals come from the backend subscription and usage
              service.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {notices.map((notice) => (
          <div
            key={`${notice.code}-${notice.metricKey ?? "subscription"}`}
            className="rounded-button border bg-surface/70 p-4 text-sm text-muted-foreground"
          >
            <p className="font-semibold text-foreground">
              {humanizeStatus(notice.code)}
            </p>
            <p className="mt-1 leading-6">{notice.message}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function StaffBillingContent() {
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const selectedBranch = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  )?.branch;
  const statusQuery = useQuery({
    queryKey: staffQueryKeys.branchSaasStatus(selectedBranchId),
    queryFn: () => getBranchSaasStatus(selectedBranchId ?? "", accessToken),
    enabled: Boolean(accessToken && selectedBranchId),
    staleTime: 30_000
  });
  const plansQuery = useQuery({
    queryKey: staffQueryKeys.saasPlans(),
    queryFn: () => getSaasPlans(accessToken),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000
  });
  const companyId = statusQuery.data?.company.id;
  const canManage = canAccessStaffRoute({
    access: effectiveAccess,
    permissions: ["saas.manage"],
    branchId: selectedBranchId,
    branchScoped: true
  });
  const [checkoutForm, setCheckoutForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: ""
  });
  const billingQuery = useQuery({
    queryKey: staffQueryKeys.companySaasBilling(companyId),
    queryFn: () => getCompanySaasBilling(companyId ?? "", accessToken),
    enabled: Boolean(accessToken && companyId),
    staleTime: 30_000,
    retry: false
  });
  const refreshBilling = () => {
    if (companyId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.companySaasBilling(companyId)
      });
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.companySaasStatus(companyId)
      });
    }
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchSaasStatus(selectedBranchId)
      });
    }
  };
  const checkoutMutation = useMutation({
    mutationFn: () =>
      startCompanySaasBillingCheckout(companyId ?? "", checkoutForm, accessToken),
    onSuccess: (result) => {
      refreshBilling();
      window.location.assign(result.checkout.url);
    }
  });
  const syncMutation = useMutation({
    mutationFn: () => syncCompanySaasBilling(companyId ?? "", accessToken),
    onSuccess: refreshBilling
  });
  const planMutation = useMutation({
    mutationFn: (planCode: string) =>
      changeCompanySaasBillingPlan(companyId ?? "", { planCode }, accessToken),
    onSuccess: refreshBilling
  });
  const cancelMutation = useMutation({
    mutationFn: () =>
      cancelCompanySaasBilling(
        companyId ?? "",
        { reason: "Cancelled from Balcona Account" },
        accessToken
      ),
    onSuccess: refreshBilling
  });
  const refresh = () => {
    if (selectedBranchId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.branchSaasStatus(selectedBranchId)
      });
    }

    void queryClient.invalidateQueries({ queryKey: staffQueryKeys.saasPlans() });
    refreshBilling();
  };

  if (!selectedBranchId || !selectedBranch) {
    return (
      <EmptyState
        title="No branch selected"
        description="Select an accessible branch before viewing plan status and tenant limits."
      />
    );
  }

  if (statusQuery.isPending) {
    return <LoadingState label="Loading billing status" />;
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <EmptyState
        title="Billing status could not load"
        description={formatErrorMessage(statusQuery.error)}
        action={
          <Button variant="secondary" onClick={refresh}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const status = statusQuery.data;
  const plan = status.plan;
  const subscription = status.subscription;
  const usage = usageOrder
    .map((key) => status.usage[key])
    .filter(Boolean) as SaasUsageMetric[];

  return (
    <div className="grid gap-5">
      <Card variant="accent">
        <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
          <div>
            <Badge
              variant={
                billingQuery.data?.billing.ready
                  ? billingQuery.data?.billing?.liveVerified
                    ? "success"
                    : "warning"
                  : "muted"
              }
              className="mb-3"
            >
              {billingQuery.data?.billing.liveVerified
                ? "Live billing verified"
                : billingQuery.data?.billing.ready
                  ? "Billing software ready"
                  : "Billing setup"}
            </Badge>
            <CardTitle>{status.company.name} plan and billing</CardTitle>
            <CardDescription>
              Balcona SaaS subscription money is isolated from restaurant
              customer payments and uses Balcona&apos;s own billing merchant
              account.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <StaffBranchSelector
              access={effectiveAccess}
              selectedBranchId={selectedBranchId}
              onChange={setSelectedBranchId}
              className="min-w-64"
            />
            <Button
              variant="secondary"
              onClick={refresh}
              disabled={
                statusQuery.isFetching ||
                plansQuery.isFetching ||
                billingQuery.isFetching
              }
            >
              {statusQuery.isFetching ||
              plansQuery.isFetching ||
              billingQuery.isFetching ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Plan"
          value={plan?.name ?? "Unconfigured"}
          description={plan?.description ?? "Assign a plan before production writes."}
          icon={<CreditCard className="size-4" aria-hidden="true" />}
          tone={plan ? "primary" : "warning"}
        />
        <MetricCard
          label="Subscription"
          value={humanizeStatus(subscription?.status ?? "missing")}
          description={
            subscription?.currentPeriodEnd
              ? `Period ends ${formatDateTime(subscription.currentPeriodEnd)}`
              : billingQuery.data?.billing.ready
                ? "Provider billing is ready for subscription enrollment."
                : billingQuery.data?.billing.readinessMessage ??
                  "Billing provider configuration is not ready."
          }
          icon={<BadgeCheck className="size-4" aria-hidden="true" />}
          tone={
            subscription?.status === "active" || subscription?.status === "trialing"
              ? "success"
              : "warning"
          }
        />
        <MetricCard
          label="Branch"
          value={selectedBranch.name}
          description="Status is computed from the branch company subscription."
          icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
          tone="muted"
        />
        <MetricCard
          label="Signals"
          value={`${status.warnings.length}/${status.blockers.length}`}
          description="Warnings / blockers currently reported."
          icon={<Gauge className="size-4" aria-hidden="true" />}
          tone={status.blockers.length > 0 ? "warning" : "success"}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card variant="quiet">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge
                  variant={
                    billingQuery.data?.billing.ready
                      ? billingQuery.data?.billing?.liveVerified
                        ? "success"
                        : "warning"
                      : "muted"
                  }
                  className="mb-3"
                >
                  Paymob recurring billing
                </Badge>
                <CardTitle>Subscription payment lifecycle</CardTitle>
                <CardDescription>
                  Enrollment, verified recurring payment events, invoices,
                  provider sync, plan changes, and cancellation are handled
                  separately from venue payment processing.
                </CardDescription>
              </div>
              {billingQuery.data?.billing.environment ? (
                <Badge variant="muted">
                  {billingQuery.data?.billing?.environment.toUpperCase()}
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {billingQuery.isPending ? (
              <LoadingState label="Loading subscription billing" />
            ) : billingQuery.isError ? (
              <div className="rounded-button border bg-surface/70 p-4 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Billing provider status could not load
                </p>
                <p className="mt-1 leading-6">
                  {formatErrorMessage(billingQuery.error)}
                </p>
              </div>
            ) : billingQuery.data ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-button border bg-surface/70 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Provider readiness
                    </p>
                    <p className="mt-2 font-semibold text-foreground">
                      {billingQuery.data?.billing?.ready ? "Ready" : "Blocked"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {billingQuery.data?.billing?.readinessMessage}
                    </p>
                  </div>
                  <div className="rounded-button border bg-surface/70 p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">
                      Recurring subscription
                    </p>
                    <p className="mt-2 font-semibold text-foreground">
                      {billingQuery.data?.subscription?.providerSubscriptionReference
                        ? humanizeStatus(
                            billingQuery.data?.subscription?.status
                          )
                        : "Not enrolled"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {billingQuery.data?.subscription?.providerSubscriptionReference
                        ? billingQuery.data.subscription
                            .providerSubscriptionReference
                        : "A provider subscription is created only after the first verified checkout."}
                    </p>
                  </div>
                </div>

                {billingQuery.data?.subscription?.providerSubscriptionReference ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      disabled={!canManage || syncMutation.isPending}
                      onClick={() => syncMutation.mutate()}
                    >
                      {syncMutation.isPending ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                      Sync provider
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={
                        !canManage ||
                        cancelMutation.isPending ||
                        subscription?.status === "cancelled"
                      }
                      onClick={() => cancelMutation.mutate()}
                    >
                      Cancel subscription
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-3 rounded-button border bg-surface/70 p-4">
                    <div>
                      <p className="font-semibold text-foreground">
                        Start recurring billing
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Balcona collects only billing identity here. Card data is
                        entered on Paymob&apos;s hosted checkout.
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={checkoutForm.firstName}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({
                            ...current,
                            firstName: event.target.value
                          }))
                        }
                        placeholder="First name"
                        autoComplete="given-name"
                      />
                      <Input
                        value={checkoutForm.lastName}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({
                            ...current,
                            lastName: event.target.value
                          }))
                        }
                        placeholder="Last name"
                        autoComplete="family-name"
                      />
                      <Input
                        type="email"
                        value={checkoutForm.email}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({
                            ...current,
                            email: event.target.value
                          }))
                        }
                        placeholder="Billing email"
                        autoComplete="email"
                      />
                      <Input
                        value={checkoutForm.phoneNumber}
                        onChange={(event) =>
                          setCheckoutForm((current) => ({
                            ...current,
                            phoneNumber: event.target.value
                          }))
                        }
                        placeholder="+20..."
                        autoComplete="tel"
                      />
                    </div>
                    <Button
                      disabled={
                        !canManage ||
                        !billingQuery.data?.billing?.ready ||
                        checkoutMutation.isPending ||
                        !checkoutForm.firstName.trim() ||
                        !checkoutForm.lastName.trim() ||
                        !checkoutForm.email.trim() ||
                        !checkoutForm.phoneNumber.trim()
                      }
                      onClick={() => checkoutMutation.mutate()}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <CreditCard className="size-4" aria-hidden="true" />
                      )}
                      Start secure checkout
                    </Button>
                  </div>
                )}

                {checkoutMutation.isError ||
                syncMutation.isError ||
                cancelMutation.isError ||
                planMutation.isError ? (
                  <div className="rounded-button border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
                    {formatErrorMessage(
                      checkoutMutation.error ??
                        syncMutation.error ??
                        cancelMutation.error ??
                        planMutation.error
                    )}
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted" className="mb-3">
              Billing ledger
            </Badge>
            <CardTitle>Recent invoices and attempts</CardTitle>
            <CardDescription>
              Provider callbacks do not directly unlock features. Verified
              payment state is persisted first, then subscription status is
              updated.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {billingQuery.data ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Payment attempts
                  </p>
                  <div className="grid gap-2">
                    {billingQuery.data?.paymentAttempts ?? [].slice(0, 4).length ===
                    0 ? (
                      <p className="rounded-button border bg-surface/70 p-3 text-sm text-muted-foreground">
                        No subscription payment attempts yet.
                      </p>
                    ) : (
                      billingQuery.data?.paymentAttempts ?? []
                        .slice(0, 4)
                        .map((attempt) => (
                          <div
                            key={attempt.id}
                            className="flex items-center justify-between gap-3 rounded-button border bg-surface/70 p-3"
                          >
                            <div>
                              <p className="font-medium text-foreground">
                                {formatMoney(
                                  attempt.amountMinor,
                                  attempt.currency
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(attempt.createdAt)}
                              </p>
                            </div>
                            <Badge variant={getBadgeVariant(attempt.status)}>
                              {humanizeStatus(attempt.status)}
                            </Badge>
                          </div>
                        ))
                    )}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                    Invoices
                  </p>
                  <div className="grid gap-2">
                    {billingQuery.data?.invoices ?? [].slice(0, 4).length === 0 ? (
                      <p className="rounded-button border bg-surface/70 p-3 text-sm text-muted-foreground">
                        No billing invoices yet.
                      </p>
                    ) : (
                      billingQuery.data?.invoices ?? [].slice(0, 4).map((invoice) => (
                        <div
                          key={invoice.id}
                          className="flex items-center justify-between gap-3 rounded-button border bg-surface/70 p-3"
                        >
                          <div>
                            <p className="font-medium text-foreground">
                              {formatMoney(
                                invoice.amountMinor,
                                invoice.currency
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.paidAt
                                ? `Paid ${formatDateTime(invoice.paidAt)}`
                                : invoice.dueAt
                                  ? `Due ${formatDateTime(invoice.dueAt)}`
                                  : formatDateTime(invoice.createdAt)}
                            </p>
                          </div>
                          <Badge variant={getBadgeVariant(invoice.status)}>
                            {humanizeStatus(invoice.status)}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Billing ledger appears after provider readiness can be loaded.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <NoticeList
        title="Subscription blockers"
        notices={status.blockers}
        variant="danger"
      />
      <NoticeList
        title="Subscription warnings"
        notices={status.warnings}
        variant="warning"
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {usage.map((metric) => (
          <MetricCard
            key={metric.key}
            label={metric.label}
            value={formatUsage(metric)}
            description={formatRemaining(metric)}
            icon={
              metric.limit === null ? (
                <InfinityIcon className="size-4" aria-hidden="true" />
              ) : (
                <Gauge className="size-4" aria-hidden="true" />
              )
            }
            tone={getUsageTone(metric)}
          />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card variant="quiet">
          <CardHeader>
            <Badge variant={getBadgeVariant(subscription?.status)} className="mb-3">
              {humanizeStatus(subscription?.status ?? "unconfigured")}
            </Badge>
            <CardTitle>Current subscription</CardTitle>
            <CardDescription>
              Verified provider state and the backend subscription record are
              the source of truth for feature gates and write limits.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-button border bg-surface/70 p-4">
              <p className="font-semibold text-foreground">
                {plan?.name ?? "No plan assigned"}
              </p>
              <p className="mt-1">
                {plan ? <PlanPrice plan={plan} /> : "Plan assignment required"}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-button border bg-surface/70 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Trial ends
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {subscription?.trialEndsAt
                    ? formatDateTime(subscription.trialEndsAt)
                    : "No trial date"}
                </p>
              </div>
              <div className="rounded-button border bg-surface/70 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Period
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {subscription?.currentPeriodStart
                    ? formatDateTime(subscription.currentPeriodStart)
                    : "Not started"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <Badge variant="muted" className="mb-3">
              Feature entitlements
            </Badge>
            <CardTitle>Enabled for this tenant</CardTitle>
            <CardDescription>
              These switches are read from the backend plan and company
              overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {entitlementLabels.map((entry) => {
              const enabled = status.entitlements[entry.key];

              return (
                <div
                  key={entry.key}
                  className="grid gap-2 rounded-button border bg-surface/70 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{entry.label}</p>
                    <Badge variant={enabled ? "success" : "muted"}>
                      {enabled ? "Enabled" : "Off"}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>

      <Card variant="quiet">
        <CardHeader>
          <Badge variant="muted" className="mb-3">
            Plan catalog
          </Badge>
          <CardTitle>Available Balcona plans</CardTitle>
          <CardDescription>
            Catalog pricing feeds the recurring billing amount. Provider-backed
            subscriptions can change plans from here when billing is enrolled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansQuery.isError ? (
            <p className="rounded-button border bg-surface/70 p-4 text-sm text-muted-foreground">
              {formatErrorMessage(plansQuery.error)}
            </p>
          ) : null}
          {plansQuery.isPending ? <LoadingState label="Loading plans" /> : null}
          {plansQuery.data ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {plansQuery.data.plans.map((catalogPlan) => (
                <div
                  key={catalogPlan.id}
                  className={cn(
                    "grid gap-3 rounded-button border bg-surface/70 p-4",
                    catalogPlan.id === plan?.id ? "border-primary/60" : ""
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {catalogPlan.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <PlanPrice plan={catalogPlan} />
                      </p>
                    </div>
                    <Badge
                      variant={
                        catalogPlan.id === plan?.id
                          ? "success"
                          : getBadgeVariant(catalogPlan.status)
                      }
                    >
                      {catalogPlan.id === plan?.id
                        ? "Current"
                        : humanizeStatus(catalogPlan.status)}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {catalogPlan.description ?? "Balcona plan"}
                  </p>
                  {billingQuery.data?.subscription
                    .providerSubscriptionReference &&
                  catalogPlan.id !== plan?.id ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canManage || planMutation.isPending}
                      onClick={() => planMutation.mutate(catalogPlan.code)}
                    >
                      Change to {catalogPlan.name}
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export function StaffBillingPage() {
  return (
    <OfficeStaffShell
      activeDomain="account"
      title="Account · Plan & billing"
      description="Balcona SaaS plan, subscription status, entitlements, and tenant usage limits. Restaurant/customer money is managed separately."
      actions={
        <div className="flex flex-wrap gap-3">
          <Link href="/setup" className={buttonVariants({ variant: "secondary" })}>
            <Rocket className="size-4" aria-hidden="true" />
            Setup
          </Link>
          <Link href="/office" className={buttonVariants({ variant: "secondary" })}>
            <Gauge className="size-4" aria-hidden="true" />
            Owner
          </Link>
        </div>
      }
    >
      <StaffAuthGate
        requiredPermissions={["saas.read"]}
        branchScoped
        deniedTitle="Account access required"
        deniedDescription="Plan and tenant limit status is available to owner and branch manager roles."
      >
        <StaffBillingContent />
      </StaffAuthGate>
    </OfficeStaffShell>
  );
}
