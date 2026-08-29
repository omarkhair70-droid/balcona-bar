"use client";

import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
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
        "min-h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-xs font-bold transition",
        active
          ? "border-[#C68A4A] bg-[#C68A4A] text-[#17110C]"
          : "border-[#3E3A36] bg-[#1B1917] text-[#AAA39C] hover:border-[#5A544E] hover:bg-[#24211E] hover:text-[#F1EAE3]"
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
  const stationLabel = (value: PreparationStation) => {
    switch (value) {
      case "barista":
        return t("kitchen.stationBarista");
      case "kitchen":
        return t("kitchen.stationKitchen");
      case "dessert":
        return t("kitchen.stationDessert");
      default:
        return t("kitchen.stationAll");
    }
  };
  const statusLabel = (value: PreparationTaskStatus) => {
    switch (value) {
      case "pending":
        return t("kitchen.statusPending");
      case "preparing":
        return t("kitchen.statusPreparing");
      case "ready":
        return t("kitchen.statusReady");
      case "cancelled":
        return t("kitchen.statusCancelled");
      default:
        return t("kitchen.statusAll");
    }
  };

  return (
    <div className="grid min-w-0 gap-3">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#817B75]">
          {t("tasks.filterStation")}
        </p>
        <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
          {stationOptions.map((option) => (
            <FilterButton
              key={option}
              active={station === option}
              label={stationLabel(option)}
              onClick={() => onStationChange(option)}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#817B75]">
          {t("tasks.filterStatus")}
        </p>
        <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <FilterButton
              key={option}
              active={status === option}
              label={statusLabel(option)}
              onClick={() => onStatusChange(option)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
