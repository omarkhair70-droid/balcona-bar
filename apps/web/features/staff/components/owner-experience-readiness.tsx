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
import { useTranslations } from "@/lib/i18n/i18n-provider";

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
  const t = useTranslations("owner");
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
          <Badge variant="muted">{t("readiness.badge")}</Badge>
          <Badge variant={themeLoaded ? "success" : "warning"}>
            {themeLoaded
              ? t("readiness.experienceLoaded")
              : t("readiness.experiencePending")}
          </Badge>
        </div>
        <CardTitle>{t("readiness.title")}</CardTitle>
        <CardDescription>
          {t("readiness.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {experienceLoading || menuLoading ? (
          <LoadingState label={t("readiness.loading")} />
        ) : null}
        <section className="rounded-card border bg-surface/75 p-4">
          <Palette className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t("readiness.experience")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {themeLoaded
              ? t("readiness.profileAvailable", {
                  source: experience?.source ?? t("readiness.branchSource")
                })
              : t("readiness.noEffectiveProfile")}
          </p>
        </section>
        <section className="rounded-card border bg-surface/75 p-4">
          <Utensils className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t("readiness.menuCategories")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {categories.length}
          </p>
        </section>
        <section className="rounded-card border bg-surface/75 p-4">
          <Utensils className="size-4 text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-foreground">
            {t("readiness.visibleMenuItems")}
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {itemCount}
          </p>
        </section>
        {experienceError ? (
          <p className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning md:col-span-3">
            <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
            {t("errors.experienceLoad", { message: experienceError.message })}
          </p>
        ) : null}
        {menuError ? (
          <p className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning md:col-span-3">
            <AlertTriangle className="mr-2 inline size-4" aria-hidden="true" />
            {t("errors.menuLoad", { message: menuError.message })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
