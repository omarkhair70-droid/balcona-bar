"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api/client";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { connectSse } from "@/lib/realtime/sse-client";
import { playNotificationSound } from "@/lib/sound/sound";
import { getRecordString, isRecord } from "./staff-format";

export type StaffRealtimeState = "idle" | "connecting" | "connected" | "error";

type ActiveRealtimeState = Exclude<StaffRealtimeState, "idle">;
type StaffBranchRealtimeStatus = {
  branchId?: string;
  state: StaffRealtimeState;
  lastEventType?: string;
};

const SOUND_EVENT_TYPES = new Set([
  "order_submitted",
  "bill_requested",
  "preparation_task_created",
  "preparation_task_ready",
  "waiter_call_created",
  "table_attention_updated",
  "table_attention_resolved",
  "branch_attention_queue_updated",
  "smart_cashier_manual_review_required"
]);

function parseRealtimeData(data: string) {
  try {
    const parsed = JSON.parse(data);

    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function useStaffBranchRealtime(
  branchId?: string,
  token?: string
): StaffBranchRealtimeStatus {
  const queryClient = useQueryClient();
  const lastSoundAtRef = useRef(0);
  const [connectionState, setConnectionState] = useState<{
    branchId?: string;
    state: ActiveRealtimeState;
    lastEventType?: string;
  }>({ state: "connecting" });

  useEffect(() => {
    if (!branchId || !token) {
      return;
    }

    const connection = connectSse({
      url: buildApiUrl(`/realtime/branches/${branchId}/stream`),
      token,
      onMessage: (message) => {
        const event = parseRealtimeData(message.data);
        const eventType =
          getRecordString(event, "type") || message.event || "system";

        setConnectionState({
          branchId,
          state: "connected",
          lastEventType: eventType
        });

        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.branchOrders(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.branchBillRequests(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.branchBills(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.preparationTasks(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffWaiterCalls(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffAttentionQueue(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffOwnerOrders(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffOwnerBillRequests(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffOwnerPreparationTasks(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffOwnerWaiterCalls(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.staffOwnerAttentionQueue(branchId)
        });
        void queryClient.invalidateQueries({
          queryKey: staffQueryKeys.branchRealtime(branchId)
        });

        if (SOUND_EVENT_TYPES.has(eventType)) {
          const now = Date.now();

          if (now - lastSoundAtRef.current > 2500) {
            lastSoundAtRef.current = now;
            void playNotificationSound().catch(() => undefined);
          }
        }
      },
      onError: () => {
        setConnectionState({ branchId, state: "error" });
      }
    });

    return () => {
      connection.abort();
    };
  }, [branchId, queryClient, token]);

  if (!branchId || !token) {
    return { state: "idle" };
  }

  return connectionState.branchId === branchId
    ? connectionState
    : { branchId, state: "connecting" };
}
