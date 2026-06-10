"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type OwnerLaneMetric = {
  label: string;
  value: number;
};

type OwnerLane = {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  metrics: OwnerLaneMetric[];
};

type OwnerOperationsSnapshotProps = {
  lanes: OwnerLane[];
};

export function OwnerOperationsSnapshot({
  lanes
}: OwnerOperationsSnapshotProps) {
  const t = useTranslations("owner");

  return (
    <Card variant="glass" padding="lg">
      <CardHeader>
        <Badge variant="muted" className="w-fit">
          {t("operations.snapshotBadge")}
        </Badge>
        <CardTitle>{t("operations.liveLanesTitle")}</CardTitle>
        <CardDescription>
          {t("operations.liveLanesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {lanes.map((lane) => (
          <section key={lane.title} className="rounded-card border bg-surface/75 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-primary">
                  {lane.icon}
                  <h3 className="text-sm font-semibold text-foreground">
                    {lane.title}
                  </h3>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {lane.description}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              {lane.metrics.map((metric) => (
                <div key={metric.label} className="rounded-button bg-muted p-3">
                  <dt className="text-muted-foreground">{metric.label}</dt>
                  <dd className="mt-1 text-lg font-semibold text-foreground">
                    {metric.value}
                  </dd>
                </div>
              ))}
            </dl>
            <Link
              href={lane.href}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" }),
                "mt-4 w-full"
              )}
            >
              {t("actions.openLane")}
            </Link>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
