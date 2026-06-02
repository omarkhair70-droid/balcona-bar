import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RealtimeState } from "./use-customer-realtime";

type RealtimeStatusProps = {
  state: RealtimeState;
};

export function RealtimeStatus({ state }: RealtimeStatusProps) {
  const isConnected = state === "connected";

  return (
    <Badge variant={isConnected ? "success" : "muted"} className="gap-2">
      {isConnected ? (
        <Wifi className="size-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5" aria-hidden="true" />
      )}
      {isConnected ? "Live" : state === "error" ? "Reconnecting" : "Quiet"}
    </Badge>
  );
}
