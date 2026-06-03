"use client";

import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";

type WaiterCallStatusPillProps = {
  status?: string;
};

export function WaiterCallStatusPill({ status }: WaiterCallStatusPillProps) {
  const variant =
    status === "open"
      ? "warning"
      : status === "acknowledged"
        ? "default"
        : status === "resolved"
          ? "success"
          : status === "cancelled"
            ? "muted"
            : "muted";

  return <Badge variant={variant}>{humanizeStatus(status)}</Badge>;
}
