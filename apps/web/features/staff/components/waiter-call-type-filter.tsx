"use client";

import { humanizeStatus } from "@/features/staff/staff-format";
import { cn } from "@/lib/utils/cn";
import type { WaiterCallStatus, WaiterCallType } from "@/lib/api/types";

type WaiterCallTypeFilterProps = {
  status: WaiterCallStatus;
  type: WaiterCallType;
  onStatusChange: (status: WaiterCallStatus) => void;
  onTypeChange: (type: WaiterCallType) => void;
};

const statusOptions: WaiterCallStatus[] = [
  "open",
  "acknowledged",
  "resolved",
  "cancelled",
  "all"
];

const typeOptions: WaiterCallType[] = [
  "all",
  "call_waiter",
  "need_bill",
  "need_water",
  "need_help",
  "order_problem",
  "clean_table",
  "other"
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

export function WaiterCallTypeFilter({
  status,
  type,
  onStatusChange,
  onTypeChange
}: WaiterCallTypeFilterProps) {
  return (
    <div className="grid gap-3">
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {typeOptions.map((option) => (
          <FilterButton
            key={option}
            active={type === option}
            label={humanizeStatus(option)}
            onClick={() => onTypeChange(option)}
          />
        ))}
      </div>
    </div>
  );
}
