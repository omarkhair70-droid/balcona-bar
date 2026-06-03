"use client";

import { AlertTriangle, Palette, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading-state";
import type {
  BranchEffectiveExperience,
  BranchMenuResult
} from "@/lib/api/types";

type OwnerExperienceReadinessProps = {
  experience?: BranchEffectiveExperience;
  menu?: BranchMenuResult;
  experienceLoading?: boolean;
  menuLoading?: boolean;
  experienceError?: Error;
  menuError?: Error;
};

export function OwnerExperienceReadiness({
  experience,
  menu,
  experienceLoading,
  menuLoading,
  experienceError,
  menuError
}: OwnerExperienceReadinessProps) {
  const categories = menu?.categories ?? [];
  const itemCount = categories.reduce(
    (sum, category) => sum + category.items.length,
    0
  );
  const themeLoaded = Boolean(
    experience?.theme || experience?.designTokens || experience?.profile
  );

  return (
    <Card variant="quiet">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="muted">Readiness</Badge>
          <Badge variant={themeLoaded ? "success" : "warning"}>
            {themeLoaded ? "Experience loaded" : "Experience pending"}
          </Badge>
        </div>
        <CardTitle>Menu / experience readiness</CardTitle>
        <CardDescription>
          Read-only branch setup pulse. Full editing belongs to later SaaS admin
          phases.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {experienceLoading || menuLoading ? (
          <LoadingState label="Loading branch readiness" />
        ) : null}
        <section className="rounded-card border bg-surface/75 p-4">
          <Palette className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Experience
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {themeLoaded
              ? `${experience?.source ?? "branch"} profile available`
              : "No effective profile returned"}
          </p>
        </section>
        <section className="rounded-card border bg-surface/75 p-4">
          <Utensils className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Menu categories
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {categories.length}
          </p>
        </section>
        <section className="rounded-card border bg-surface/75 p-4">
          <Utensils className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            Visible menu items
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {itemCount}
          </p>
        </section>
        {experienceError ? (
          <p className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning md:col-span-3">
            <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
            Experience could not load. {experienceError.message}
          </p>
        ) : null}
        {menuError ? (
          <p className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning md:col-span-3">
            <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
            Menu could not load. {menuError.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
