"use client";

import {
  getAttentionActionKey,
  getAttentionFloor,
  getAttentionLastEvaluatedAt,
  getAttentionPriority,
  getAttentionReasons,
  getAttentionRecommendedActions,
  getAttentionReasonMessage,
  getAttentionSessionId,
  getAttentionStatus,
  getAttentionTable
} from "@/features/staff/attention-data";
import { getRecordString, humanizeStatus } from "@/features/staff/staff-format";
import { cn } from "@/lib/utils/cn";

type AttentionCardProps = {
  attention: Record<string, unknown>;
  selected?: boolean;
  onSelect: (sessionId: string) => void;
  onPrefetch?: (sessionId: string) => void;
};

function formatAge(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60_000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function sourceForAttention(attention: Record<string, unknown>) {
  const actionKeys = getAttentionRecommendedActions(attention).map(
    getAttentionActionKey
  );
  const reason = getAttentionReasonMessage(getAttentionReasons(attention)[0])
    .toLowerCase();

  if (actionKeys.includes("acknowledge_waiter_call") || reason.includes("waiter")) {
    return "waiter";
  }

  if (actionKeys.includes("serve_ready_order") || reason.includes("ready")) {
    return "ready";
  }

  if (/\bai\b/.test(reason)) {
    return "ai";
  }

  return "computed";
}

export function AttentionCard({
  attention,
  selected,
  onSelect,
  onPrefetch,
}: AttentionCardProps) {
  const sessionId = getAttentionSessionId(attention);
  const status = getAttentionStatus(attention);
  const priority = getAttentionPriority(attention);
  const reasons = getAttentionReasons(attention);
  const table = getAttentionTable(attention);
  const floor = getAttentionFloor(attention);
  const tableCode =
    getRecordString(table, "code") ||
    getRecordString(table, "displayName") ||
    "—";
  const isUrgent = status === "urgent" || priority === "urgent";
  const isDue =
    !isUrgent &&
    (status === "needs_attention" ||
      priority === "high" ||
      priority === "medium");
  const source = sourceForAttention(attention);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => sessionId && onSelect(sessionId)}
      onPointerEnter={() => sessionId && onPrefetch?.(sessionId)}
      onFocus={() => sessionId && onPrefetch?.(sessionId)}
      className={cn(
        "relative grid w-full gap-2 px-3 py-3 text-start transition md:grid-cols-[82px_80px_minmax(0,1fr)_82px] md:items-center md:gap-3",
        selected ? "bg-[#34271E]" : "bg-[#211A15] hover:bg-[#292019]"
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 start-0 w-1",
          isUrgent
            ? "bg-[#C85E52]"
            : isDue
              ? "bg-[#D6A34C]"
              : "bg-[#6D7A72]"
        )}
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-3 md:block">
        <span className="text-xl font-bold text-[#FFF5E8]">
          {tableCode}
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-semibold md:hidden",
            isUrgent
              ? "border-[#7A3F3A] bg-[#3A211F] text-[#F09C94]"
              : isDue
                ? "border-[#7D5D2C] bg-[#392B18] text-[#F0C66E]"
                : "border-[#4D4036] bg-[#2B221C] text-[#D9CCC0]"
          )}
        >
          {formatAge(getAttentionLastEvaluatedAt(attention))}
        </span>
      </div>

      <span className="hidden text-xs font-semibold text-[#C9BAAC] md:block">
        {formatAge(getAttentionLastEvaluatedAt(attention))}
      </span>

      <div className="min-w-0">
        <p className="text-sm font-semibold leading-5 text-[#F3E6D8]">
          {reasons[0]
            ? getAttentionReasonMessage(reasons[0])
            : humanizeStatus(status)}
        </p>
        <p className="mt-1 text-[10px] text-[#82766C] md:hidden">
          {getRecordString(floor, "name")} · {humanizeStatus(source)}
        </p>
      </div>

      <span className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8176] md:block">
        {humanizeStatus(source)}
      </span>
    </button>
  );
}
