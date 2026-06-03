"use client";

import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";

type AttentionPriorityPillProps = {
  priority?: string;
};

export function AttentionPriorityPill({
  priority
}: AttentionPriorityPillProps) {
  const variant =
    priority === "urgent"
      ? "danger"
      : priority === "high"
        ? "warning"
        : priority === "medium"
          ? "default"
          : "muted";

  return <Badge variant={variant}>{humanizeStatus(priority)}</Badge>;
}
