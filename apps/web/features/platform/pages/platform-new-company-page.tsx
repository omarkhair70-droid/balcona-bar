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
  return (
    <Card variant="accent">
      <CardHeader>
        <div className="flex size-11 items-center justify-center rounded-button bg-success/20 text-success">
          <BadgeCheck className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Company workspace created</CardTitle>
        <CardDescription>
          {result.company.name} is ready for owner password setup, launch
          readiness, billing review, and QR handoff.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">Owner</p>
            <p className="mt-1 font-semibold text-foreground">
              {result.passwordSetup.ownerEmail}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">Plan</p>
            <p className="mt-1 font-semibold text-foreground">
              {result.plan.name}
            </p>
          </div>
          <div className="rounded-button border bg-surface/70 p-3">
            <p className="text-xs uppercase text-muted-foreground">Branch</p>
            <p className="mt-1 font-semibold text-foreground">
              {result.branch.name}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Link href={result.setupUrl} className={buttonVariants()}>
            <CopyCheck className="size-4" aria-hidden="true" />
            Staff setup
          </Link>
          <Link
            href={result.billingUrl}
            className={buttonVariants({ variant: "secondary" })}
          >
            Billing
          </Link>
          <Link
            href={`/platform/companies/${result.companyId}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Company detail
          </Link>
        </div>

        <div className="rounded-card border bg-surface/70 p-4">
          <p className="font-semibold text-foreground">Password handoff</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {result.passwordSetup.instructions}
          </p>
        </div>

        {result.customerQrExamples.length > 0 ? (
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <QrCode className="size-4 text-primary" aria-hidden="true" />
              <p className="font-semibold text-foreground">QR examples</p>
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
  const [floorLabel, setFloorLabel] = useState("Ground Floor");
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
                <Badge variant="muted">Cafe workspace</Badge>
                <CardTitle>Company</CardTitle>
                <CardDescription>
                  This creates the active tenant company record and unique
                  platform slug.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Company name
                  <Input
                    value={companyName}
                    onChange={(event) => setCompanyName(event.target.value)}
                    onBlur={() =>
                      setCompanySlug((value) => value || slugify(companyName))
                    }
                    placeholder="Cafe Nile"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Company slug
                  <Input
                    value={companySlug}
                    onChange={(event) => setCompanySlug(event.target.value)}
                    placeholder="cafe-nile"
                  />
                </label>
              </CardContent>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">Owner handoff</Badge>
                <CardTitle>Owner account</CardTitle>
                <CardDescription>
                  Creates or reuses a tenant staff user, then assigns an owner
                  company-level membership.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Owner name
                  <Input
                    value={ownerName}
                    onChange={(event) => setOwnerName(event.target.value)}
                    placeholder="Mona Hassan"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Owner email
                  <Input
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    type="email"
                    placeholder="owner@example.com"
                    required
                  />
                </label>
              </CardContent>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">First branch</Badge>
                <CardTitle>Branch</CardTitle>
                <CardDescription>
                  Creates the first active branch used by staff setup, billing,
                  tables, QR, and customer routes.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Branch name
                  <Input
                    value={branchName}
                    onChange={(event) => setBranchName(event.target.value)}
                    onBlur={() =>
                      setBranchSlug((value) => value || slugify(branchName))
                    }
                    placeholder="Main Branch"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Branch slug
                  <Input
                    value={branchSlug}
                    onChange={(event) => setBranchSlug(event.target.value)}
                    placeholder="main"
                  />
                </label>
                <label className="grid gap-2 text-sm font-medium text-foreground md:col-span-2">
                  Address
                  <Input
                    value={branchAddress}
                    onChange={(event) => setBranchAddress(event.target.value)}
                    placeholder="Street, city, country"
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
                <CardTitle>Create Cafe Workspace</CardTitle>
                <CardDescription>
                  The backend transaction is the source of truth for slugs,
                  plan limits, owner membership, starter tables, and audit
                  events.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Plan
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
                              ? "Custom"
                              : `${formatMoney(
                                  plan.monthlyPriceMinor,
                                  plan.currency
                                )}/mo`}
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
                  Subscription status
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
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
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
                  Create starter floor, tables, and QR tokens
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
                    ? "Creating workspace..."
                    : "Create Cafe Workspace"}
                </Button>
              </CardFooter>
            </Card>

            <Card variant="quiet" padding="lg">
              <CardHeader>
                <Badge variant="muted">Starter QR</Badge>
                <CardTitle>Tables</CardTitle>
                <CardDescription>
                  Deterministic codes are skipped if they already exist, so the
                  same setup can be rerun safely.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <label className="grid gap-2 text-sm font-medium text-foreground">
                  Floor label
                  <Input
                    value={floorLabel}
                    onChange={(event) => setFloorLabel(event.target.value)}
                    disabled={!starterEnabled}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    Prefix
                    <Input
                      value={tablePrefix}
                      onChange={(event) => setTablePrefix(event.target.value)}
                      disabled={!starterEnabled}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-foreground">
                    Start
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
                    Count
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
                    Seats
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
                <CardTitle>Boundaries</CardTitle>
                <CardDescription>
                  No public signup, billing checkout, or email delivery is
                  triggered from this internal bootstrap.
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
  return (
    <PlatformShell
      title="Add Cafe"
      description="Create a tenant workspace, first branch, owner access, plan assignment, and optional starter QR tables in one platform-admin transaction."
      actions={
        <Link href="/platform" className={buttonVariants({ variant: "ghost" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Platform dashboard
        </Link>
      }
    >
      <PlatformAuthGate>
        <PlatformNewCompanyContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
