"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { getBranchEffectiveExperience } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { applyThemeTokens } from "@/lib/theme/apply-theme";
import type { ThemeTokenInput } from "@/lib/theme/theme-tokens";
import { mergeGuestThemeTokens } from "./customer-theme";

type CustomerThemeLoaderProps = {
  branchId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringRecord(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function toThemeInput(
  designTokens?: Record<string, unknown> | null
): ThemeTokenInput | null {
  if (!designTokens) {
    return null;
  }

  return {
    colors: toStringRecord(designTokens.colors),
    radii: toStringRecord(designTokens.radii),
    shadows: toStringRecord(designTokens.shadows)
  };
}

export function CustomerThemeLoader({ branchId }: CustomerThemeLoaderProps) {
  const experienceQuery = useQuery({
    queryKey: customerQueryKeys.experience(branchId),
    queryFn: () => getBranchEffectiveExperience(branchId ?? ""),
    enabled: Boolean(branchId),
    staleTime: 60_000,
    retry: 1
  });

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(
      "[data-customer-theme-root]"
    );

    if (!target) {
      return;
    }

    const themeInput = toThemeInput(experienceQuery.data?.designTokens);
    applyThemeTokens(mergeGuestThemeTokens(themeInput), target);
  }, [experienceQuery.data?.designTokens]);

  return null;
}
