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
import { useTranslations } from "@/lib/i18n/i18n-provider";
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

function planPrice(
  company: PlatformCompanySummary,
  t: ReturnType<typeof useTranslations>
) {
  const plan = company.subscription?.plan;

  if (!plan) {
    return t("companies.noPlan");
  }

  if (plan.monthlyPriceMinor === null || plan.monthlyPriceMinor === undefined) {
    return t("companies.customPrice");
  }

  return t("companies.pricePerMonth", {
    price: formatMoney(plan.monthlyPriceMinor, plan.currency)
  });
}

function CompanyCard({ company }: { company: PlatformCompanySummary }) {
  const t = useTranslations("platform");
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
          {t("companies.cardDescription", {
            slug: company.slug,
            plan: plan?.name ?? t("companies.planPending"),
            price: planPrice(company, t)
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {t("companies.branches")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.branchCount}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {t("companies.staff")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.staffMembershipCount}
            </p>
          </div>
        </div>
        <p>{t("companies.createdAt", { date: formatDateTime(company.createdAt) })}</p>
      </CardContent>
      <CardFooter>
        <Link
          href={`/platform/companies/${company.id}`}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t("actions.openCompany")}
        </Link>
      </CardFooter>
    </Card>
  );
}

function PlatformDashboardContent() {
  const t = useTranslations("platform");
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const companiesQuery = useQuery({
    queryKey: platformQueryKeys.companies(),
    queryFn: () => getPlatformCompanies(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (companiesQuery.isPending) {
    return <LoadingState label={t("companies.loading")} />;
  }

  if (companiesQuery.isError) {
    return (
      <EmptyState
        title={t("errors.companiesLoadTitle")}
        description={formatErrorMessage(companiesQuery.error)}
        action={
          <Button onClick={() => companiesQuery.refetch()} variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.retry")}
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
          label={t("companies.metricCompanies")}
          value={String(data.summary.totalCompanies)}
          description={t("companies.metricCompaniesDescription")}
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("companies.metricActive")}
          value={String(data.summary.activeSubscriptions)}
          description={t("companies.metricActiveDescription")}
          tone="success"
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("companies.metricTrialing")}
          value={String(data.summary.trialingSubscriptions)}
          description={t("companies.metricTrialingDescription")}
          tone="warning"
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("companies.metricSuspended")}
          value={String(data.summary.suspendedSubscriptions)}
          description={t("companies.metricSuspendedDescription")}
          tone="muted"
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
      </section>

      {recentCompanies.length === 0 ? (
        <EmptyState
          title={t("empty.noCompaniesTitle")}
          description={t("empty.noCompaniesDescription")}
          action={
            <Link href="/platform/companies/new" className={buttonVariants()}>
              <PlusCircle className="size-4" aria-hidden="true" />
              {t("actions.addCafe")}
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
  const t = useTranslations("platform");

  return (
    <PlatformShell
      title={t("companies.title")}
      description={t("companies.description")}
      actions={
        <Link href="/platform/companies/new" className={buttonVariants()}>
          <PlusCircle className="size-4" aria-hidden="true" />
          {t("actions.addCafe")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformDashboardContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
