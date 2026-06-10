"use client";

import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { humanizeStatus } from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type KitchenStationFilterProps = {
  station: PreparationStation;
  status: PreparationTaskStatus;
  onStationChange: (station: PreparationStation) => void;
  onStatusChange: (status: PreparationTaskStatus) => void;
};

const stationOptions: PreparationStation[] = [
  "all",
  "barista",
  "kitchen",
  "dessert"
];

const statusOptions: PreparationTaskStatus[] = [
  "pending",
  "preparing",
  "ready",
  "cancelled",
  "all"
];

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 whitespace-nowrap rounded-button border px-3 text-xs font-semibold transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export function KitchenStationFilter({
  station,
  status,
  onStationChange,
  onStatusChange
}: KitchenStationFilterProps) {
  const t = useTranslations("staff");

  return (
    <div className="grid gap-3">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("tasks.filterStation")}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {stationOptions.map((option) => (
            <FilterButton
              key={option}
              active={station === option}
              label={humanizeStatus(option)}
              onClick={() => onStationChange(option)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
          {t("tasks.filterStatus")}
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <FilterButton
              key={option}
              active={status === option}
              label={humanizeStatus(option)}
              onClick={() => onStatusChange(option)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
