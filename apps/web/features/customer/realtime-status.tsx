"use client";

import { Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type { RealtimeState } from "./use-customer-realtime";

type RealtimeStatusProps = {
  state: RealtimeState;
};

export function RealtimeStatus({ state }: RealtimeStatusProps) {
  const t = useTranslations("customer");
  const isConnected = state === "connected";

  return (
    <Badge variant={isConnected ? "success" : "muted"} className="gap-2">
      {isConnected ? (
        <Wifi className="size-3.5" aria-hidden="true" />
      ) : (
        <WifiOff className="size-3.5" aria-hidden="true" />
      )}
      {isConnected
        ? t("realtime.live")
        : state === "error"
          ? t("realtime.reconnecting")
          : t("realtime.quiet")}
    </Badge>
  );
}
