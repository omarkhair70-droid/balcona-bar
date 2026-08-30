"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building2,
  Copy,
  CreditCard,
  History,
  ShieldCheck,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  UserPlus,
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
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/loading-state";
import { MetricCard } from "@/components/ui/metric-card";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  createPlatformStaffInvite,
  getPlatformCompany,
  getPlatformPlans,
  updatePlatformCompanySubscription
} from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type {
  CreatePlatformStaffInvitePayload,
  PlatformCompanyDetail,
  SaasUsageMetric,
  StaffInviteSummary,
  TenantOnboardingStaffRole,
  UpdatePlatformSubscriptionPayload
} from "@/lib/api/types";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatMoney, humanizeStatus } from "@/features/staff/staff-format";

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60";
const platformSubscriptionStatuses = [
  "trialing",
  "active",
  "past_due",
  "suspended",
  "cancelled"
] as const;
const platformStaffRoles: TenantOnboardingStaffRole[] = [
  "owner",
  "branch_manager",
  "cashier",
  "waiter",
  "kitchen",
  "barista",
  "menu_admin"
];

function buildInviteUrl(invitePath: string) {
  if (typeof window === "undefined") {
    return invitePath;
  }

  return new URL(invitePath, window.location.origin).toString();
}

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

function formatUsage(
  metric: SaasUsageMetric,
  t: ReturnType<typeof useTranslations>
) {
  if (metric.limit === null) {
    return t("company.usageUnlimited", {
      used: metric.used.toLocaleString("en")
    });
  }

  return t("company.usageWithLimit", {
    used: metric.used.toLocaleString("en"),
    limit: metric.limit.toLocaleString("en")
  });
}

function inviteStatusBadge(
  invite: StaffInviteSummary | null | undefined,
  t: ReturnType<typeof useTranslations>
) {
  if (!invite) {
    return <Badge variant="warning">{t("company.inviteNeeded")}</Badge>;
  }

  return (
    <Badge variant={badgeVariant(invite.status)}>
      {humanizeStatus(invite.status)}
    </Badge>
  );
}

function normalizePlanCode(value?: string | null) {
  return ["pilot", "starter", "growth", "enterprise"].includes(value ?? "")
    ? (value as NonNullable<UpdatePlatformSubscriptionPayload["planCode"]>)
    : "starter";
}

function normalizeSubscriptionStatus(value?: string | null) {
  return platformSubscriptionStatuses.includes(
    value as (typeof platformSubscriptionStatuses)[number]
  )
    ? (value as NonNullable<UpdatePlatformSubscriptionPayload["status"]>)
    : "trialing";
}

function UsageGrid({ company }: { company: PlatformCompanyDetail }) {
  const t = useTranslations("platform");
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
                <CardDescription>{formatUsage(metric, t)}</CardDescription>
              </div>
              <Badge variant={badgeVariant(metric.status)}>
                {humanizeStatus(metric.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {metric.limit === null
                ? t("company.unlimitedOnPlan")
                : t("company.remaining", {
                    count: (metric.remaining ?? 0).toLocaleString("en")
                  })}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function AuditActivity({ company }: { company: PlatformCompanyDetail }) {
  const { locale } = useI18n();
  const events = company.auditEvents ?? [];

  return (
    <Card variant="quiet" padding="lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{locale === "ar" ? "نشاط Platform" : "Platform activity"}</CardTitle>
            <CardDescription>
              {locale === "ar"
                ? "أحدث تغييرات الإدارة المسجلة على هذه الشركة."
                : "Recent recorded administration changes for this company."}
            </CardDescription>
          </div>
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="grid gap-2">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {locale === "ar" ? "لا يوجد نشاط مسجل بعد." : "No recorded activity yet."}
          </p>
        ) : (
          events.map((event) => {
            const metadata = event.metadata ?? {};
            const details = [
              typeof metadata.planCode === "string" ? `plan ${metadata.planCode}` : null,
              typeof metadata.status === "string" ? humanizeStatus(metadata.status) : null,
              typeof metadata.branchSlug === "string" ? `branch ${metadata.branchSlug}` : null,
              typeof metadata.starterTableCount === "number"
                ? `${metadata.starterTableCount} starter tables`
                : null
            ].filter(Boolean);

            return (
              <div
                key={event.id}
                className="grid gap-1 rounded-button border bg-surface/70 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {humanizeStatus(event.action)}
                  </p>
                  <time className="text-xs text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString(
                      locale === "ar" ? "ar-EG" : "en-US"
                    )}
                  </time>
                </div>
                <p className="text-xs text-muted-foreground">
                  {event.platformAdminUser
                    ? `${event.platformAdminUser.name} · ${event.platformAdminUser.email}`
                    : locale === "ar"
                      ? "Platform system"
                      : "Platform system"}
                </p>
                {details.length > 0 ? (
                  <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function SubscriptionPanel({ company }: { company: PlatformCompanyDetail }) {
  const t = useTranslations("platform");
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
            <CardTitle className="mt-3">
              {t("company.subscriptionTitle")}
            </CardTitle>
            <CardDescription>
              {t("company.subscriptionDescription")}
            </CardDescription>
          </div>
          <CreditCard className="size-5 text-primary" aria-hidden="true" />
        </div>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-4">
          <div className="rounded-button border bg-surface/70 p-4">
            <p className="text-sm text-muted-foreground">
              {t("company.currentPlan")}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {company.plan?.name ?? t("company.noPlan")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {company.plan?.monthlyPriceMinor === null ||
              company.plan?.monthlyPriceMinor === undefined
                ? t("company.customPricing")
                : t("company.pricePerMonth", {
                    price: formatMoney(
                      company.plan.monthlyPriceMinor,
                      company.plan.currency
                    )
                  })}
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("company.plan")}
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
            {t("company.status")}
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
              {platformSubscriptionStatuses.map((subscriptionStatus) => (
                <option key={subscriptionStatus} value={subscriptionStatus}>
                  {humanizeStatus(subscriptionStatus)}
                </option>
              ))}
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
            {mutation.isPending
              ? t("actions.saving")
              : t("actions.saveSubscription")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function StaffInvitePanel({ company }: { company: PlatformCompanyDetail }) {
  const t = useTranslations("platform");
  const queryClient = useQueryClient();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [inviteForm, setInviteForm] =
    useState<CreatePlatformStaffInvitePayload>({
      name: "",
      email: "",
      role: "owner",
      branchId: company.branches[0]?.id ?? ""
    });
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const roleRequiresBranch = inviteForm.role !== "owner";
  const inviteMutation = useMutation({
    mutationFn: (payload: CreatePlatformStaffInvitePayload) =>
      createPlatformStaffInvite(company.company.id, payload, accessToken ?? ""),
    onSuccess: (result) => {
      setLastInviteUrl(buildInviteUrl(result.invitePath));
      setCopied(false);
      setInviteForm({
        name: "",
        email: "",
        role: "owner",
        branchId: company.branches[0]?.id ?? ""
      });
      queryClient.invalidateQueries({
        queryKey: platformQueryKeys.company(company.company.id)
      });
      queryClient.invalidateQueries({
        queryKey: platformQueryKeys.companies()
      });
    }
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    inviteMutation.mutate({
      ...inviteForm,
      branchId: roleRequiresBranch ? inviteForm.branchId : undefined
    });
  }

  async function copyInviteUrl() {
    if (!lastInviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(lastInviteUrl);
    setCopied(true);
  }

  return (
    <Card variant="glass" padding="lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge variant="muted" className="mb-3">
              {t("company.staffHandoffBadge")}
            </Badge>
            <CardTitle>{t("company.createInviteTitle")}</CardTitle>
            <CardDescription>
              {t("company.createInviteDescription")}
            </CardDescription>
          </div>
          <UserPlus className="size-5 text-primary" aria-hidden="true" />
        </div>
      </CardHeader>
      <form onSubmit={submit}>
        <CardContent className="grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("company.name")}
            <Input
              value={inviteForm.name}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  name: event.target.value
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("company.email")}
            <Input
              type="email"
              value={inviteForm.email}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  email: event.target.value
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("company.role")}
            <select
              value={inviteForm.role}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  role: event.target.value as TenantOnboardingStaffRole
                }))
              }
              className={selectClassName}
            >
              {platformStaffRoles.map((role) => (
                <option key={role} value={role}>
                  {humanizeStatus(role)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            {t("company.branch")}
            <select
              value={inviteForm.branchId ?? ""}
              disabled={!roleRequiresBranch}
              onChange={(event) =>
                setInviteForm((current) => ({
                  ...current,
                  branchId: event.target.value
                }))
              }
              className={selectClassName}
            >
              {company.branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </label>
          {inviteMutation.isError ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {formatErrorMessage(inviteMutation.error)}
            </div>
          ) : null}
          {lastInviteUrl ? (
            <div className="grid gap-2 rounded-button border bg-surface/70 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("company.inviteLink")}
              </p>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input value={lastInviteUrl} readOnly />
                <Button type="button" variant="secondary" onClick={copyInviteUrl}>
                  <Copy className="size-4" aria-hidden="true" />
                  {copied ? t("actions.copied") : t("actions.copy")}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            disabled={
              inviteMutation.isPending ||
              inviteForm.name.trim().length === 0 ||
              inviteForm.email.trim().length === 0 ||
              (roleRequiresBranch && !inviteForm.branchId)
            }
          >
            {inviteMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <KeyRound className="size-4" aria-hidden="true" />
            )}
            {t("actions.createInvite")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function CompanyDetailContent({ companyId }: { companyId: string }) {
  const t = useTranslations("platform");
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const companyQuery = useQuery({
    queryKey: platformQueryKeys.company(companyId),
    queryFn: () => getPlatformCompany(companyId, accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (companyQuery.isPending) {
    return <LoadingState label={t("company.loadingDetail")} />;
  }

  if (companyQuery.isError) {
    return (
      <EmptyState
        title={t("errors.companyDetailLoadTitle")}
        description={formatErrorMessage(companyQuery.error)}
        action={
          <Button onClick={() => companyQuery.refetch()} variant="secondary">
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.retry")}
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
          label={t("company.metricCompany")}
          value={data.company.status ?? t("company.active")}
          description={data.company.slug}
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("company.metricPlan")}
          value={data.plan?.name ?? t("company.none")}
          description={humanizeStatus(data.subscription?.status)}
          icon={<CreditCard className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("company.metricBranches")}
          value={String(data.branches.length)}
          description={t("company.metricBranchesDescription")}
          icon={<Building2 className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("company.metricOwners")}
          value={String(data.owners.length)}
          description={t("company.metricOwnersDescription")}
          icon={<UsersRound className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="grid gap-5">
          <Card variant="glass" padding="lg">
            <CardHeader>
              <Badge variant="muted">{t("company.companyBadge")}</Badge>
              <CardTitle>{data.company.name}</CardTitle>
              <CardDescription>
                {t("company.workspaceId", { companyId: data.company.id })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 rounded-button border bg-surface/70 p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <p className="text-sm leading-6 text-muted-foreground">
                  {t("company.identityBoundary")}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="quiet" padding="lg">
            <CardHeader>
              <CardTitle>{t("company.branchesTitle")}</CardTitle>
              <CardDescription>
                {t("company.branchesDescription")}
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
                      {t("company.branchDescription", {
                        slug: branch.slug,
                        address: branch.address ?? t("company.noAddress")
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2 text-sm">
                    <Badge variant={badgeVariant(branch.status)}>
                      {humanizeStatus(branch.status)}
                    </Badge>
                    <Badge variant="muted">
                      {t("company.tablesCount", {
                        count: branch.tablesCount
                      })}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card variant="quiet" padding="lg">
            <CardHeader>
              <CardTitle>{t("company.ownersTitle")}</CardTitle>
              <CardDescription>
                {t("company.ownersDescription")}
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
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="muted">{humanizeStatus(owner.role)}</Badge>
                      {owner.staffUser.passwordSetAt ? (
                        <Badge variant="success">
                          {t("company.passwordSet")}
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          {t("company.passwordPending")}
                        </Badge>
                      )}
                      {inviteStatusBadge(owner.recentInvite, t)}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <UsageGrid company={data} />
          <AuditActivity company={data} />
        </div>

        <div className="grid gap-5">
          <SubscriptionPanel
            key={`${data.company.id}-${data.plan?.code ?? "none"}-${
              data.subscription?.status ?? "none"
            }`}
            company={data}
          />
          <StaffInvitePanel
            key={`${data.company.id}-staff-invite`}
            company={data}
          />
        </div>
      </section>
    </div>
  );
}

export function PlatformCompanyDetailPage({ companyId }: { companyId: string }) {
  const t = useTranslations("platform");

  return (
    <PlatformShell
      title={t("company.title")}
      description={t("company.description")}
      actions={
        <Link href="/platform" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("actions.platformDashboard")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <CompanyDetailContent companyId={companyId} />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
