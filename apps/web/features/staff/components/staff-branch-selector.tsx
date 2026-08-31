"use client";

import type { StaffEffectiveAccess } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type StaffBranchSelectorProps = {
  access?: StaffEffectiveAccess;
  selectedBranchId?: string;
  onChange: (branchId: string) => void;
  className?: string;
  showLabel?: boolean;
};

export function StaffBranchSelector({
  access,
  selectedBranchId,
  onChange,
  className,
  showLabel = true
}: StaffBranchSelectorProps) {
  const t = useTranslations("staff");
  const branches = access?.branches ?? [];

  return (
    <label
      className={cn(
        "grid gap-1 text-xs font-semibold uppercase text-muted-foreground",
        className
      )}
    >
      {showLabel ? <span>{t("selectors.branch")}</span> : null}
      <select
        value={selectedBranchId ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-10 rounded-button border bg-surface px-3 text-sm font-medium normal-case text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/35"
      >
        {branches.length === 0 ? (
          <option value="">{t("selectors.noBranchAccess")}</option>
        ) : null}
        {branches.map((entry) => (
          <option key={entry.branch.id} value={entry.branch.id}>
            {entry.branch.name}
          </option>
        ))}
      </select>
    </label>
  );
}
