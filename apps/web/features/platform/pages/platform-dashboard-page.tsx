"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CreditCard,
  PlusCircle,
  RefreshCw,
  ShieldCheck
} from "lucide-react";
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
import { getPlatformCompanies } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type { PlatformCompanySummary } from "@/lib/api/types";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatDateTime, formatMoney, humanizeStatus } from "@/features/staff/staff-format";

function subscriptionBadgeVariant(
  status?: string | null
): NonNullable<BadgeProps["variant"]> {
  if (status === "active" || status === "trialing") {
    return "success";
  }

  if (status === "past_due") {
    return "warning";
  }

  if (status === "suspended" || status === "cancelled") {
    return "danger";
  }

  return "muted";
}

function planPrice(company: PlatformCompanySummary) {
  const plan = company.subscription?.plan;

  if (!plan) {
    return "No plan";
  }

  if (plan.monthlyPriceMinor === null || plan.monthlyPriceMinor === undefined) {
    return "Custom";
  }

  return `${formatMoney(plan.monthlyPriceMinor, plan.currency)}/mo`;
}

function CompanyCard({ company }: { company: PlatformCompanySummary }) {
  const subscriptionStatus = company.subscription?.status ?? "unconfigured";
  const plan = company.subscription?.plan;

  return (
    <Card variant="quiet">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
            <Building2 className="size-5" aria-hidden="true" />
          </div>
          <Badge variant={subscriptionBadgeVariant(subscriptionStatus)}>
            {humanizeStatus(subscriptionStatus)}
          </Badge>
        </div>
        <CardTitle>{company.name}</CardTitle>
        <CardDescription>
          {company.slug} · {plan?.name ?? "Plan pending"} · {planPrice(company)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">Branches</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.branchCount}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">Staff</p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.staffMembershipCount}
            </p>
          </div>
        </div>
        <p>Created {formatDateTime(company.createdAt)}</p>
      </CardContent>
      <CardFooter>
        <Link
          href={`/platform/companies/${company.id}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          Open company
        </Link>
      </CardFooter>
    </Card>
  );
}

function PlatformDashboardContent() {
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const companiesQuery = useQuery({
    queryKey: platformQueryKeys.companies(),
    queryFn: () => getPlatformCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (companiesQuery.isPending) {
    return <LoadingState label="Loading platform companies" />;
  }

  if (companiesQuery.isError) {
    return (
      <EmptyState
        title="Platform companies could not be loaded"
        description={formatErrorMessage(companiesQuery.error)}
        action={
          <Button onClick={() => companiesQuery.refetch()} variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            Retry
          </Button>
        }
      />
    );
  }

  const data = companiesQuery.data;
  const recentCompanies = data.companies.slice(0, 8);

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Companies"
          value={String(data.summary.totalCompanies)}
          description="Total tenant workspaces"
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Active"
          value={String(data.summary.activeSubscriptions)}
          description="Active subscriptions"
          tone="success"
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Trialing"
          value={String(data.summary.trialingSubscriptions)}
          description="Sales-led trials"
          tone="warning"
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Suspended"
          value={String(data.summary.suspendedSubscriptions)}
          description="Blocked plan writes"
          tone="muted"
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
      </section>

      {recentCompanies.length === 0 ? (
        <EmptyState
          title="No cafe workspaces yet"
          description="Create the first company, branch, owner, plan assignment, and starter QR tables from the Add Cafe flow."
          action={
            <Link href="/platform/companies/new" className={buttonVariants()}>
              <PlusCircle className="size-4" aria-hidden="true" />
              Add Cafe
            </Link>
          }
        />
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {recentCompanies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </section>
      )}
    </div>
  );
}

export function PlatformDashboardPage() {
  return (
    <PlatformShell
      title="Platform companies"
      description="Sales-led tenant bootstrap for cafe workspaces, plan assignment, owner handoff, and starter QR setup."
      actions={
        <Link href="/platform/companies/new" className={buttonVariants()}>
          <PlusCircle className="size-4" aria-hidden="true" />
          Add Cafe
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformDashboardContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
