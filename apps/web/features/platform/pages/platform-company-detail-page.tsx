"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  ExternalLink,
  RefreshCw,
  Save,
  UsersRound
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  getPlatformCompany,
  getPlatformPlans,
  updatePlatformCompanySubscription
} from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type {
  PlatformCompanyDetail,
  SaasUsageMetric,
  UpdatePlatformSubscriptionPayload
} from "@/lib/api/types";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatMoney, humanizeStatus } from "@/features/staff/staff-format";

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60";

function badgeVariant(value?: string | null): NonNullable<BadgeProps["variant"]> {
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

function formatUsage(metric: SaasUsageMetric) {
  if (metric.limit === null) {
    return `${metric.used.toLocaleString("en")} / unlimited`;
  }

  return `${metric.used.toLocaleString("en")} / ${metric.limit.toLocaleString(
    "en"
  )}`;
}

function normalizePlanCode(value?: string | null) {
  return ["pilot", "starter", "growth", "enterprise"].includes(value ?? "")
    ? (value as NonNullable<UpdatePlatformSubscriptionPayload["planCode"]>)
    : "starter";
}

function normalizeSubscriptionStatus(value?: string | null) {
  return value === "active" || value === "trialing" ? value : "trialing";
}

function UsageGrid({ company }: { company: PlatformCompanyDetail }) {
  const usage = Object.values(company.saas.usage ?? {});

  if (usage.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {usage.map((metric) => (
        <Card key={metric.key} variant="quiet">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{metric.label}</CardTitle>
                <CardDescription>{formatUsage(metric)}</CardDescription>
              </div>
              <Badge variant={badgeVariant(metric.status)}>
                {humanizeStatus(metric.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {metric.limit === null
                ? "Unlimited on this plan"
                : `${(metric.remaining ?? 0).toLocaleString("en")} remaining`}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function SubscriptionPanel({ company }: { company: PlatformCompanyDetail }) {
  const queryClient = useQueryClient();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [planCode, setPlanCode] = useState<
    NonNullable<UpdatePlatformSubscriptionPayload["planCode"]>
  >(normalizePlanCode(company.plan?.code));
  const [status, setStatus] = useState<
    NonNullable<UpdatePlatformSubscriptionPayload["status"]>
  >(normalizeSubscriptionStatus(company.subscription?.status));
  const plansQuery = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => getPlatformPlans(accessToken ?? ""),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000
  });
  const mutation = useMutation({
    mutationFn: (payload: UpdatePlatformSubscriptionPayload) =>
      updatePlatformCompanySubscription(company.company.id, payload, accessToken ?? ""),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: platformQueryKeys.company(company.company.id)
      });
      queryClient.invalidateQueries({
        queryKey: platformQueryKeys.companies()
      });
    }
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate({ planCode, status });
  };

  return (
    <Card variant="accent" padding="lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant={badgeVariant(company.subscription?.status)}>
              {humanizeStatus(company.subscription?.status ?? "unconfigured")}
            </Badge>
            <CardTitle className="mt-3">Subscription</CardTitle>
            <CardDescription>
              Internal plan and subscription status only. No SaaS billing
              checkout runs in this phase.
            </CardDescription>
          </div>
          <CreditCard className="size-5 text-primary" aria-hidden="true" />
        </div>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-4">
          <div className="rounded-button border bg-surface/70 p-4">
            <p className="text-sm text-muted-foreground">Current plan</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.plan?.name ?? "No plan"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.plan?.monthlyPriceMinor === null ||
              company.plan?.monthlyPriceMinor === undefined
                ? "Custom pricing"
                : `${formatMoney(
                    company.plan.monthlyPriceMinor,
                    company.plan.currency
                  )}/mo`}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Plan
            <select
              value={planCode}
              onChange={(event) =>
                setPlanCode(
                  event.target
                    .value as NonNullable<
                    UpdatePlatformSubscriptionPayload["planCode"]
                  >
                )
              }
              className={selectClassName}
            >
              {(plansQuery.data?.plans ?? []).map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target
                    .value as NonNullable<
                    UpdatePlatformSubscriptionPayload["status"]
                  >
                )
              }
              className={selectClassName}
            >
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
            </select>
          </label>
          {mutation.isError ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {formatErrorMessage(mutation.error)}
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={mutation.isPending}>
            <Save className="size-4" aria-hidden="true" />
            {mutation.isPending ? "Saving..." : "Save subscription"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function CompanyDetailContent({ companyId }: { companyId: string }) {
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const companyQuery = useQuery({
    queryKey: platformQueryKeys.company(companyId),
    queryFn: () => getPlatformCompany(companyId, accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (companyQuery.isPending) {
    return <LoadingState label="Loading company detail" />;
  }

  if (companyQuery.isError) {
    return (
      <EmptyState
        title="Company detail could not be loaded"
        description={formatErrorMessage(companyQuery.error)}
        action={
          <Button onClick={() => companyQuery.refetch()} variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const data = companyQuery.data;

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Company"
          value={data.company.status ?? "Active"}
          description={data.company.slug}
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Plan"
          value={data.plan?.name ?? "None"}
          description={humanizeStatus(data.subscription?.status)}
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Branches"
          value={String(data.branches.length)}
          description="Configured tenant branches"
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Owners"
          value={String(data.owners.length)}
          description="Owner or manager assignments"
          icon={<UsersRound className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <Card variant="glass" padding="lg">
            <CardHeader>
              <Badge variant="muted">Company</Badge>
              <CardTitle>{data.company.name}</CardTitle>
              <CardDescription>
                Tenant workspace ID {data.company.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <Link href="/staff/setup" className={buttonVariants()}>
                <ExternalLink className="size-4" aria-hidden="true" />
                Staff setup
              </Link>
              <Link
                href="/staff/billing"
                className={buttonVariants({ variant: "secondary" })}
              >
                Staff billing
              </Link>
              <Link
                href="/staff/owner"
                className={buttonVariants({ variant: "secondary" })}
              >
                Owner dashboard
              </Link>
            </CardContent>
          </Card>

          <Card variant="quiet" padding="lg">
            <CardHeader>
              <CardTitle>Branches</CardTitle>
              <CardDescription>
                Active branches created by platform bootstrap or later staff
                setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.branches.map((branch) => (
                <div
                  key={branch.id}
                  className="grid gap-3 rounded-button border bg-surface/70 p-4 md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {branch.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {branch.slug} · {branch.address ?? "No address"}
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Badge variant={badgeVariant(branch.status)}>
                      {humanizeStatus(branch.status)}
                    </Badge>
                    <Badge variant="muted">{branch.tablesCount} tables</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="quiet" padding="lg">
            <CardHeader>
              <CardTitle>Owners and managers</CardTitle>
              <CardDescription>
                Company-level owner membership is created by bootstrap. Branch
                managers can be invited later from staff setup.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {data.owners.map((owner) => (
                <div
                  key={owner.id}
                  className="rounded-button border bg-surface/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {owner.staffUser.name}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {owner.staffUser.email}
                      </p>
                    </div>
                    <Badge variant="muted">{humanizeStatus(owner.role)}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <UsageGrid company={data} />
        </div>

        <SubscriptionPanel
          key={`${data.company.id}-${data.plan?.code ?? "none"}-${
            data.subscription?.status ?? "none"
          }`}
          company={data}
        />
      </section>
    </div>
  );
}

export function PlatformCompanyDetailPage({ companyId }: { companyId: string }) {
  return (
    <PlatformShell
      title="Company detail"
      description="Review plan status, limits, branches, owners, and staff handoff links for this tenant workspace."
      actions={
        <Link href="/platform" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Platform dashboard
        </Link>
      }
    >
      <PlatformAuthGate>
        <CompanyDetailContent companyId={companyId} />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
