"use client";

import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type { StaffRealtimeState } from "@/features/staff/use-staff-branch-realtime";

type StaffRealtimeStatusProps = {
  state: StaffRealtimeState;
  lastEventType?: string;
};

function realtimeVariant(state: StaffRealtimeState) {
  if (state === "connected") {
    return "success";
  }

  if (state === "error") {
    return "warning";
  }

  return "muted";
}

function realtimeLabelKey(state: StaffRealtimeState) {
  switch (state) {
    case "connected":
      return "realtime.connected";
    case "connecting":
      return "realtime.connecting";
    case "error":
      return "realtime.error";
    default:
      return "realtime.idle";
  }
}

export function StaffRealtimeStatus({
  state,
  lastEventType
}: StaffRealtimeStatusProps) {
  const t = useTranslations("staff");

  return (
    <div className="flex shrink-0 flex-nowrap items-center gap-2">
      <Badge variant={realtimeVariant(state)} className="gap-2">
        <Radio className="size-3.5" aria-hidden="true" />
        {t(realtimeLabelKey(state))}
      </Badge>
      {lastEventType ? (
        <span className="hidden text-xs text-muted-foreground md:inline">
          {t("realtime.lastEvent", { event: humanizeStatus(lastEventType) })}
        </span>
      ) : null}
    </div>
  );
}
