import { Radio } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";
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

function realtimeLabel(state: StaffRealtimeState) {
  switch (state) {
    case "connected":
      return "Live";
    case "connecting":
      return "Connecting";
    case "error":
      return "Reconnecting";
    default:
      return "Idle";
  }
}

export function StaffRealtimeStatus({
  state,
  lastEventType
}: StaffRealtimeStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={realtimeVariant(state)} className="gap-2">
        <Radio className="size-3.5" aria-hidden="true" />
        {realtimeLabel(state)}
      </Badge>
      {lastEventType ? (
        <span className="text-xs text-muted-foreground">
          Last: {humanizeStatus(lastEventType)}
        </span>
      ) : null}
    </div>
  );
}
