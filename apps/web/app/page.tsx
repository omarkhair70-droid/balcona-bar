"use client";

import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardList,
  MonitorSmartphone,
  MonitorPlay,
  Radio,
  Sparkles,
  Store,
  SwatchBook
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
import { useTranslations } from "@/lib/i18n/i18n-provider";

export default function HomePage() {
  const t = useTranslations("home");
  const systemPillars = [
    {
      title: t("pillars.designTitle"),
      description: t("pillars.designDescription"),
      icon: <SwatchBook className="size-5" aria-hidden="true" />
    },
    {
      title: t("pillars.realtimeTitle"),
      description: t("pillars.realtimeDescription"),
      icon: <Radio className="size-5" aria-hidden="true" />
    },
    {
      title: t("pillars.splitTitle"),
      description: t("pillars.splitDescription"),
      icon: <MonitorSmartphone className="size-5" aria-hidden="true" />
    }
  ];

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <section className="flex flex-col justify-center">
        <Badge className="w-fit">{t("badge")}</Badge>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold text-foreground md:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          {t("description")}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo/balkona"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            {t("actions.demo")}
            <MonitorPlay className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/customer"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            {t("actions.customer")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/staff"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            {t("actions.staff")}
            <Store className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label={t("metricsLabel")}>
          <MetricCard
            label={t("metrics.themeLabel")}
            value={t("metrics.themeValue")}
            description={t("metrics.themeDescription")}
            icon={<Sparkles className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label={t("metrics.routesLabel")}
            value={t("metrics.routesValue")}
            description={t("metrics.routesDescription")}
            icon={<ClipboardList className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label={t("metrics.alertsLabel")}
            value={t("metrics.alertsValue")}
            description={t("metrics.alertsDescription")}
            icon={<BellRing className="size-4" aria-hidden="true" />}
          />
        </section>
      </section>

      <section className="flex items-center">
        <Card variant="glass" className="w-full" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              {t("architectureBadge")}
            </Badge>
            <CardTitle className="text-2xl">
              {t("architectureTitle")}
            </CardTitle>
            <CardDescription>
              {t("architectureDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {systemPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="grid grid-cols-[auto_1fr] gap-4 rounded-card border bg-surface/70 p-4"
              >
                <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                  {pillar.icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {pillar.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
