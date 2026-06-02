"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { buildApiUrl } from "@/lib/api/client";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { connectSse } from "@/lib/realtime/sse-client";

export type RealtimeState = "idle" | "connecting" | "connected" | "error";

type ActiveRealtimeState = Exclude<RealtimeState, "idle">;

export function useCustomerRealtime(sessionId?: string, token?: string) {
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<{
    sessionId?: string;
    state: ActiveRealtimeState;
  }>({ state: "connecting" });

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const connection = connectSse({
      url: buildApiUrl(`/realtime/table-sessions/${sessionId}/stream`),
      token,
      onMessage: () => {
        setConnectionState({ sessionId, state: "connected" });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.cart(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.orders(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.status(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.timeline(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.waiterCalls(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.bill(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.aiWaiter(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.aiWaiterMessages(sessionId)
        });
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.aiWaiterProposals(sessionId)
        });
      },
      onError: () => {
        setConnectionState({ sessionId, state: "error" });
      }
    });

    return () => {
      connection.abort();
    };
  }, [queryClient, sessionId, token]);

  if (!sessionId) {
    return "idle";
  }

  return connectionState.sessionId === sessionId
    ? connectionState.state
    : "connecting";
}
