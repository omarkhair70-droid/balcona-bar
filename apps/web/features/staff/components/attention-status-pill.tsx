"use client";

import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";

type AttentionStatusPillProps = {
  status?: string;
};

export function AttentionStatusPill({ status }: AttentionStatusPillProps) {
  const variant =
    status === "urgent"
      ? "danger"
      : status === "needs_attention"
        ? "warning"
        : status === "resolved" || status === "normal"
          ? "success"
          : status === "muted"
            ? "muted"
            : "muted";

  return <Badge variant={variant}>{humanizeStatus(status)}</Badge>;
}
