"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  ExternalLink,
  MonitorPlay,
  QrCode,
  Receipt,
  ShieldCheck,
  Sparkles,
  Store,
  TerminalSquare,
  UserRoundCheck,
  UsersRound,
  Utensils
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  balkonaDemoChecklist,
  balkonaDemoCommands,
  balkonaDemoProofPoints,
  balkonaDemoQrToken,
  balkonaDemoRoutes,
  balkonaDemoStaff
} from "@/features/demo/balkona-demo";
import { env } from "@/lib/config/env";
import { useTranslations } from "@/lib/i18n/i18n-provider";

const routeIcons: Record<(typeof balkonaDemoRoutes)[number]["key"], ReactNode> = {
  customerQrDemo: <QrCode className="size-5" aria-hidden="true" />,
  customerEntry: <Utensils className="size-5" aria-hidden="true" />,
  staffLogin: <ShieldCheck className="size-5" aria-hidden="true" />,
  cashier: <Receipt className="size-5" aria-hidden="true" />,
  menuAdmin: <ClipboardList className="size-5" aria-hidden="true" />,
  branchTables: <Store className="size-5" aria-hidden="true" />,
  kitchenBarista: <ChefHat className="size-5" aria-hidden="true" />,
  waiterFloor: <UserRoundCheck className="size-5" aria-hidden="true" />,
  ownerManager: <UsersRound className="size-5" aria-hidden="true" />
};

export default function BalkonaDemoPage() {
  const t = useTranslations("demo");

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="premium-surface rounded-card p-5 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{t("badges.demo")}</Badge>
              <Badge variant="muted">{t("badges.local")}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold text-foreground md:text-6xl">
              {t("title")}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              {t("description")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/customer/table/${balkonaDemoQrToken}`}
              className={buttonVariants({ size: "lg" })}
            >
              <QrCode className="size-4" aria-hidden="true" />
              {t("actions.startCustomerQr")}
            </Link>
            <Link
              href="/staff/login"
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t("actions.staffLogin")}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label={t("metrics.demoTableLabel")}
          value="T01"
          description={t("metrics.demoTableDescription", {
            token: balkonaDemoQrToken
          })}
          icon={<QrCode className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("metrics.customerLabel")}
          value={t("metrics.customerValue")}
          description={t("metrics.customerDescription")}
          icon={<MonitorPlay className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label={t("metrics.staffLabel")}
          value={t("metrics.staffValue")}
          description={t("metrics.staffDescription")}
          icon={<Store className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label={t("metrics.realtimeLabel")}
          value={t("metrics.realtimeValue")}
          description={t("metrics.realtimeDescription")}
          icon={<Sparkles className="size-4" aria-hidden="true" />}
          tone="accent"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              {t("badges.launch")}
            </Badge>
            <CardTitle>{t("routesTitle")}</CardTitle>
            <CardDescription>
              {t("routesDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {balkonaDemoRoutes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="rounded-card border bg-surface/75 p-4 text-left shadow-card transition hover:border-primary/55 hover:bg-surface"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-primary">
                      {routeIcons[route.key]}
                      <p className="text-sm font-semibold text-foreground">
                        {t(`routes.${route.key}.label`)}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {t(`routes.${route.key}.description`)}
                    </p>
                  </div>
                  <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card variant="quiet">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">{t("badges.localOnly")}</Badge>
                <Badge variant="muted">{t("badges.doNotUseProduction")}</Badge>
              </div>
              <CardTitle>{t("credentialsTitle")}</CardTitle>
              <CardDescription>
                {t("credentialsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="rounded-card border bg-surface/75 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("email")}
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-foreground">
                  {balkonaDemoStaff.email}
                </p>
              </div>
              <div className="rounded-card border bg-surface/75 p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {t("password")}
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-foreground">
                  {balkonaDemoStaff.password}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card variant="quiet">
            <CardHeader>
              <CardTitle>{t("reminderTitle")}</CardTitle>
              <CardDescription>
                {t("reminderDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-card border border-warning bg-warning/10 p-4 text-sm text-warning">
                <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
                {t("reminderWarning")}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              {t("badges.presentationFlow")}
            </Badge>
            <CardTitle>{t("checklistTitle")}</CardTitle>
            <CardDescription>
              {t("checklistDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {balkonaDemoChecklist.map((item, index) => (
              <div
                key={item}
                className="grid grid-cols-[auto_1fr] gap-3 rounded-card border bg-surface/75 p-3"
              >
                <span className="flex size-7 items-center justify-center rounded-button bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <p className="text-sm text-foreground">{t(`checklist.${item}`)}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="quiet">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              {t("badges.proofPoints")}
            </Badge>
            <CardTitle>{t("proofTitle")}</CardTitle>
            <CardDescription>
              {t("proofDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            {balkonaDemoProofPoints.map((point) => (
              <div key={point} className="rounded-card border bg-surface/75 p-3">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium text-foreground">
                  {t(`proof.${point}`)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card variant="quiet">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="muted">{t("badges.diagnostics")}</Badge>
            <Badge variant="success">{t("badges.frontendOnly")}</Badge>
          </div>
          <CardTitle>{t("diagnosticsTitle")}</CardTitle>
          <CardDescription>
            {t("diagnosticsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="grid gap-3">
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("apiBaseUrl")}
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-foreground">
                {env.NEXT_PUBLIC_API_BASE_URL}
              </p>
            </div>
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("routesLabel")}
              </p>
              <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                {balkonaDemoRoutes.map((route) => (
                  <p key={route.href} className="break-all">
                    {route.href}
                  </p>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded-card border bg-surface/75 p-4">
            <div className="flex items-center gap-2 text-primary">
              <TerminalSquare className="size-4" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                {t("commandReference")}
              </p>
            </div>
            <div className="mt-3 grid gap-2">
              {balkonaDemoCommands.map((command) => (
                <code
                  key={command}
                  className="block overflow-x-auto rounded-button border bg-background px-3 py-2 text-xs text-muted-foreground"
                >
                  {command}
                </code>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/customer" className={buttonVariants({ variant: "secondary" })}>
          <Utensils className="size-4" aria-hidden="true" />
          {t("actions.customerEntry")}
        </Link>
        <Link href="/staff" className={buttonVariants({ variant: "secondary" })}>
          <ClipboardList className="size-4" aria-hidden="true" />
          {t("actions.staffOverview")}
        </Link>
        <Link href="/staff/owner" className={buttonVariants()}>
          <UsersRound className="size-4" aria-hidden="true" />
          {t("actions.ownerCommandCenter")}
        </Link>
      </section>
    </main>
  );
}
