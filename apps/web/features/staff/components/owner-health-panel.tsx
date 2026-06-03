"use client";

import Link from "next/link";
import { AlertTriangle, ChefHat, Receipt, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import type { OwnerHealthSummary } from "@/features/staff/owner-data";

type OwnerHealthPanelProps = {
  health: OwnerHealthSummary;
  branchName: string;
};

const healthVariant: Record<OwnerHealthSummary["level"], "success" | "warning" | "danger" | "default"> = {
  calm: "success",
  busy: "default",
  needs_manager_attention: "warning",
  critical: "danger"
};

export function OwnerHealthPanel({ health, branchName }: OwnerHealthPanelProps) {
  return (
    <Card variant={health.level === "critical" ? "accent" : "quiet"}>
      <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={healthVariant[health.level]}>{health.label}</Badge>
            <Badge variant="muted">Owner / Manager</Badge>
          </div>
          <CardTitle className="mt-3">{branchName} health</CardTitle>
          <CardDescription>{health.description}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/staff/cashier" className={buttonVariants({ variant: "secondary" })}>
            <Receipt className="size-4" aria-hidden="true" />
            Go to Cashier
          </Link>
          <Link href="/staff/kitchen" className={buttonVariants({ variant: "secondary" })}>
            <ChefHat className="size-4" aria-hidden="true" />
            Go to Kitchen
          </Link>
          <Link href="/staff/waiter" className={buttonVariants()}>
            <UserRoundCheck className="size-4" aria-hidden="true" />
            Go to Waiter
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <section className="rounded-card border bg-surface/75 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
            Signals
          </h3>
          <div className="mt-3 grid gap-2">
            {health.reasons.map((reason) => (
              <p key={reason} className="text-sm text-muted-foreground">
                {reason}
              </p>
            ))}
          </div>
        </section>
        <section className="rounded-card border bg-surface/75 p-4">
          <h3 className="text-sm font-semibold text-foreground">
            Recommended manager actions
          </h3>
          <div className="mt-3 grid gap-2">
            {health.recommendedActions.map((action) => (
              <p key={action} className="text-sm text-muted-foreground">
                {action}
              </p>
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
