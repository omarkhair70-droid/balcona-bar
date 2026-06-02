"use client";

import { Badge } from "@/components/ui/badge";
import type { MenuModifierGroup } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { formatMoney } from "./customer-format";

type ModifierGroupSelectorProps = {
  group: MenuModifierGroup;
  selectedOptionIds: string[];
  onChange: (optionIds: string[]) => void;
};

export function ModifierGroupSelector({
  group,
  selectedOptionIds,
  onChange
}: ModifierGroupSelectorProps) {
  const isSingle = group.selectionType === "single";

  function toggleOption(optionId: string) {
    if (isSingle) {
      onChange(selectedOptionIds.includes(optionId) ? [] : [optionId]);
      return;
    }

    if (selectedOptionIds.includes(optionId)) {
      onChange(selectedOptionIds.filter((id) => id !== optionId));
      return;
    }

    if (group.maxSelections > 0 && selectedOptionIds.length >= group.maxSelections) {
      return;
    }

    onChange([...selectedOptionIds, optionId]);
  }

  return (
    <section className="rounded-card border bg-surface/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {group.name}
          </h3>
          {group.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {group.description}
            </p>
          ) : null}
        </div>
        {group.isRequired ? <Badge variant="warning">Required</Badge> : null}
      </div>
      <div className="mt-3 grid gap-2">
        {group.options.map((option) => {
          const checked = selectedOptionIds.includes(option.id);

          return (
            <label
              key={option.id}
              className={cn(
                "flex cursor-pointer items-center justify-between gap-3 rounded-button border bg-surface px-3 py-2 text-sm transition",
                checked && "border-primary bg-primary/15"
              )}
            >
              <span className="flex items-center gap-3">
                <input
                  type={isSingle ? "radio" : "checkbox"}
                  name={group.id}
                  checked={checked}
                  onChange={() => toggleOption(option.id)}
                  className="accent-[var(--primary)]"
                />
                {option.name}
              </span>
              {option.priceDeltaMinor > 0 ? (
                <span className="text-xs text-primary">
                  +{formatMoney(option.priceDeltaMinor)}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
