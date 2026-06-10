"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CopyCheck,
  KeyRound,
  PlusCircle,
  QrCode
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import {
  bootstrapPlatformCompany,
  getPlatformPlans
} from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import type {
  BootstrapCompanyInput,
  BootstrapCompanyResult
} from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { formatMoney } from "@/features/staff/staff-format";

const selectClassName =
  "min-h-11 w-full rounded-button border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function planLabel(planCode: string) {
  return planCode
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function SuccessPanel({ result }: { result: BootstrapCompanyResult }) {
  const t = useTranslations("platform");

  return (
    <Card variant="accent">
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-button bg-success/20 text-success">
          <BadgeCheck className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>{t("onboarding.createdTitle")}</CardTitle>
        <CardDescription>
          {t("onboarding.createdDescription", {
            companyName: result.company.name
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {t("onboarding.owner")}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {result.passwordSetup.ownerEmail}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {t("onboarding.plan")}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {result.plan.name}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              {t("onboarding.branch")}
            </p>
            <p className="mt-1 font-semibold text-foreground">
              {result.branch.name}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Link href={result.setupUrl} className={buttonVariants()}>
            <CopyCheck className="size-4" aria-hidden="true" />
            {t("actions.staffSetup")}
          </Link>
          <Link
            href={result.billingUrl}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("actions.billing")}
          </Link>
          <Link
            href={`/platform/companies/${result.companyId}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            {t("actions.companyDetail")}
          </Link>
        </div>

        <div className="rounded-card border bg-surface/70 p-4">
          <p className="font-semibold text-foreground">
            {t("onboarding.passwordHandoff")}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {result.passwordSetup.instructions}
          </p>
        </div>

        {result.customerQrExamples.length > 0 ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground">
                {t("onboarding.qrExamples")}
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {result.customerQrExamples.map((example) => (
                <Link
                  key={example.tableId}
                  href={example.customerUrl}
                  className="rounded-button border bg-surface/70 p-3 text-sm transition hover:bg-muted"
                >
                  <p className="font-semibold text-foreground">
                    {example.code}
                  </p>
                  <p className="mt-1 break-all text-muted-foreground">
                    {example.qrToken}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function PlatformNewCompanyContent() {
  const t = useTranslations("platform");
  const queryClient = useQueryClient();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const [createdResult, setCreatedResult] =
    useState<BootstrapCompanyResult | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [branchName, setBranchName] = useState("");
  const [branchSlug, setBranchSlug] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [planCode, setPlanCode] =
    useState<BootstrapCompanyInput["subscription"]["planCode"]>("starter");
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<NonNullable<BootstrapCompanyInput["subscription"]["status"]>>(
      "trialing"
    );
  const [starterEnabled, setStarterEnabled] = useState(true);
  const [floorLabel, setFloorLabel] = useState(
    t("onboarding.defaultFloorLabel")
  );
  const [tablePrefix, setTablePrefix] = useState("T");
  const [startNumber, setStartNumber] = useState(1);
  const [tableCount, setTableCount] = useState(6);
  const [seats, setSeats] = useState(4);
  const plansQuery = useQuery({
    queryKey: platformQueryKeys.plans(),
    queryFn: () => getPlatformPlans(accessToken ?? ""),
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000
  });
  const createMutation = useMutation({
    mutationFn: (payload: BootstrapCompanyInput) =>
      bootstrapPlatformCompany(payload, accessToken ?? ""),
    onSuccess: (result) => {
      setCreatedResult(result);
      queryClient.invalidateQueries({
        queryKey: platformQueryKeys.companies()
      });
    }
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatedResult(null);
    createMutation.mutate({
      company: {
        name: companyName.trim(),
        slug: slugify(companySlug || companyName)
      },
      owner: {
        name: ownerName.trim(),
        email: ownerEmail.trim()
      },
      branch: {
        name: branchName.trim(),
        slug: slugify(branchSlug || branchName),
        address: branchAddress.trim() || null
      },
      subscription: {
        planCode,
        status: subscriptionStatus
      },
      starterTables: {
        enabled: starterEnabled,
        floorLabel: floorLabel.trim(),
        tablePrefix: tablePrefix.trim(),
        startNumber,
        count: tableCount,
        seats
      }
    });
  };

  return (
    <div className="grid gap-5">
      {createdResult ? <SuccessPanel result={createdResult} /> : null}

      <form onSubmit={submit} className="grid gap-5">
        <section className="grid gap-5 xl:grid-cols-[1fr_22rem]">
          <div className="grid gap-5">
            <Card variant="glass" padding="lg">
              <CardHeader>
                <Badge variant="muted">{t("onboarding.workspaceBadge")}</Badge>
                <CardTitle>{t("onboarding.companyTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.companyDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.companyName")}
                  <Input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onBlur={() =>
                      setCompanySlug((value) => value || slugify(companyName))
                    }
                    placeholder={t("onboarding.companyNamePlaceholder")}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.companySlug")}
                  <Input
                    value={companySlug}
                    onChange={(event) => setCompanySlug(event.target.value)}
                    placeholder={t("onboarding.companySlugPlaceholder")}
                  />
                </label>
              </CardContent>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">{t("onboarding.ownerHandoffBadge")}</Badge>
                <CardTitle>{t("onboarding.ownerAccountTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.ownerAccountDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.ownerName")}
                  <Input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder={t("onboarding.ownerNamePlaceholder")}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.ownerEmail")}
                  <Input
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    type="email"
                    placeholder={t("onboarding.ownerEmailPlaceholder")}
                    required
                  />
                </label>
              </CardContent>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">{t("onboarding.firstBranchBadge")}</Badge>
                <CardTitle>{t("onboarding.branchTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.branchDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.branchName")}
                  <Input
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    onBlur={() =>
                      setBranchSlug((value) => value || slugify(branchName))
                    }
                    placeholder={t("onboarding.branchNamePlaceholder")}
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.branchSlug")}
                  <Input
                    value={branchSlug}
                    onChange={(event) => setBranchSlug(event.target.value)}
                    placeholder={t("onboarding.branchSlugPlaceholder")}
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                  {t("onboarding.address")}
                  <Input
                    value={branchAddress}
                    onChange={(event) => setBranchAddress(event.target.value)}
                    placeholder={t("onboarding.addressPlaceholder")}
                  />
                </label>
              </CardContent>
            </Card>
          </div>

          <div className="grid h-fit gap-5">
            <Card variant="accent" padding="lg">
              <CardHeader>
                <div className="flex size-11 items-center justify-center rounded-button bg-primary text-primary-foreground">
                  <Building2 className="size-5" aria-hidden="true" />
                </div>
                <CardTitle>{t("onboarding.createWorkspaceTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.createWorkspaceDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.plan")}
                  <select
                    value={planCode}
                    onChange={(event) =>
                      setPlanCode(
                        event.target
                          .value as BootstrapCompanyInput["subscription"]["planCode"]
                      )
                    }
                    className={selectClassName}
                  >
                    {(plansQuery.data?.plans ?? []).length > 0
                      ? plansQuery.data?.plans.map((plan) => (
                          <option key={plan.code} value={plan.code}>
                            {plan.name} ·{" "}
                            {plan.monthlyPriceMinor === null ||
                            plan.monthlyPriceMinor === undefined
                              ? t("company.customPrice")
                              : t("company.pricePerMonth", {
                                  price: formatMoney(
                                    plan.monthlyPriceMinor,
                                    plan.currency
                                  )
                                })}
                          </option>
                        ))
                      : ["pilot", "starter", "growth", "enterprise"].map(
                          (code) => (
                            <option key={code} value={code}>
                              {planLabel(code)}
                            </option>
                          )
                        )}
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.subscriptionStatus")}
                  <select
                    value={subscriptionStatus}
                    onChange={(event) =>
                      setSubscriptionStatus(
                        event.target
                          .value as NonNullable<
                          BootstrapCompanyInput["subscription"]["status"]
                        >
                      )
                    }
                    className={selectClassName}
                  >
                    <option value="trialing">{t("onboarding.trialing")}</option>
                    <option value="active">{t("onboarding.active")}</option>
                  </select>
                </label>
                <label className="flex items-center gap-3 rounded-button border bg-surface/70 p-3 text-sm font-medium text-foreground">
                  <input
                    checked={starterEnabled}
                    onChange={(event) =>
                      setStarterEnabled(event.target.checked)
                    }
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                  />
                  {t("onboarding.createStarterTables")}
                </label>
                {createMutation.isError ? (
                  <div
                    role="alert"
                    className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                  >
                    {formatErrorMessage(createMutation.error)}
                  </div>
                ) : null}
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  <PlusCircle className="size-4" aria-hidden="true" />
                  {createMutation.isPending
                    ? t("onboarding.creatingWorkspace")
                    : t("onboarding.createWorkspace")}
                </Button>
              </CardFooter>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">{t("onboarding.starterQrBadge")}</Badge>
                <CardTitle>{t("onboarding.tablesTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.tablesDescription")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  {t("onboarding.floorLabel")}
                  <Input
                    value={floorLabel}
                    onChange={(event) => setFloorLabel(event.target.value)}
                    disabled={!starterEnabled}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    {t("onboarding.prefix")}
                    <Input
                      value={tablePrefix}
                      onChange={(event) => setTablePrefix(event.target.value)}
                      disabled={!starterEnabled}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    {t("onboarding.start")}
                    <Input
                      value={startNumber}
                      onChange={(event) =>
                        setStartNumber(Number(event.target.value))
                      }
                      type="number"
                      min={1}
                      disabled={!starterEnabled}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    {t("onboarding.count")}
                    <Input
                      value={tableCount}
                      onChange={(event) =>
                        setTableCount(Number(event.target.value))
                      }
                      type="number"
                      min={1}
                      max={100}
                      disabled={!starterEnabled}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    {t("onboarding.seats")}
                    <Input
                      value={seats}
                      onChange={(event) => setSeats(Number(event.target.value))}
                      type="number"
                      min={1}
                      max={50}
                      disabled={!starterEnabled}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-button bg-muted text-primary">
                  <KeyRound className="size-4" aria-hidden="true" />
                </div>
                <CardTitle>{t("onboarding.boundariesTitle")}</CardTitle>
                <CardDescription>
                  {t("onboarding.boundariesDescription")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </form>
    </div>
  );
}

export function PlatformNewCompanyPage() {
  const t = useTranslations("platform");

  return (
    <PlatformShell
      title={t("onboarding.title")}
      description={t("onboarding.description")}
      actions={
        <Link href="/platform" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t("actions.platformDashboard")}
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformNewCompanyContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
