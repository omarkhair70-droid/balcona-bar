"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getAttentionLastEvaluatedAt,
  getAttentionPriority,
  getAttentionSessionId,
  getAttentionStatus
} from "@/features/staff/attention-data";
import { humanizeStatus } from "@/features/staff/staff-format";
import { cn } from "@/lib/utils/cn";
import type { TableAttentionPriority, TableAttentionStatus } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { AttentionCard } from "./attention-card";

export type AttentionStatusFilter = "active" | TableAttentionStatus;

type AttentionQueueProps = {
  attentionQueue: Record<string, unknown>[];
  status: AttentionStatusFilter;
  priority: TableAttentionPriority;
  selectedSessionId?: string;
  isLoading?: boolean;
  error?: Error;
  onStatusChange: (status: AttentionStatusFilter) => void;
  onPriorityChange: (priority: TableAttentionPriority) => void;
  onSelectAttention: (sessionId: string) => void;
  onPrefetchAttention?: (sessionId: string) => void;
  onRefresh: () => void;
};

const statusOptions: AttentionStatusFilter[] = [
  "active",
  "urgent",
  "needs_attention",
  "muted",
  "resolved",
  "normal",
  "all"
];

const priorityOptions: TableAttentionPriority[] = [
  "all",
  "urgent",
  "high",
  "medium",
  "low"
];

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition",
        active
          ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
          : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
      )}
    >
      {label}
    </button>
  );
}

export function AttentionQueue({
  attentionQueue,
  status,
  priority,
  selectedSessionId,
  isLoading,
  error,
  onStatusChange,
  onPriorityChange,
  onSelectAttention,
  onPrefetchAttention,
  onRefresh
}: AttentionQueueProps) {
  const t = useTranslations("staff");
  const prioritizedQueue = useMemo(() => {
    const statusRank: Record<string, number> = {
      urgent: 0,
      needs_attention: 1,
      normal: 2,
      muted: 3,
      resolved: 4
    };
    const priorityRank: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
      all: 4
    };

    return attentionQueue
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => {
        const leftStatus = statusRank[getAttentionStatus(left.entry)] ?? 5;
        const rightStatus = statusRank[getAttentionStatus(right.entry)] ?? 5;

        if (leftStatus !== rightStatus) {
          return leftStatus - rightStatus;
        }

        const leftPriority = priorityRank[getAttentionPriority(left.entry)] ?? 5;
        const rightPriority = priorityRank[getAttentionPriority(right.entry)] ?? 5;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        const leftTime = Date.parse(getAttentionLastEvaluatedAt(left.entry)) || 0;
        const rightTime = Date.parse(getAttentionLastEvaluatedAt(right.entry)) || 0;

        return leftTime === rightTime
          ? left.index - right.index
          : leftTime - rightTime;
      })
      .map(({ entry }) => entry);
  }, [attentionQueue]);

  return (
    <section className="min-h-[34rem] min-w-0 border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
              {t("waiter.badge")}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#FFF5E8]">
              {t("attention.queueTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#95887D]">
              {t("attention.queueDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195] transition hover:border-[#5A483A] hover:text-[#F6EBDD]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((option) => (
              <FilterButton
                key={option}
                active={status === option}
                label={
                  option === "active"
                    ? t("attention.active")
                    : humanizeStatus(option)
                }
                onClick={() => onStatusChange(option)}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {priorityOptions.map((option) => (
              <FilterButton
                key={option}
                active={priority === option}
                label={humanizeStatus(option)}
                onClick={() => onPriorityChange(option)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="p-3">
        {isLoading ? <LoadingState label={t("attention.loading")} /> : null}
        {error ? (
          <EmptyState
            title={t("attention.loadError")}
            description={error.message}
          />
        ) : null}
        {!isLoading && !error && attentionQueue.length === 0 ? (
          <EmptyState
            title={t("attention.emptyTitle")}
            description={t("attention.emptyDescription")}
          />
        ) : null}
        {!isLoading && !error && prioritizedQueue.length > 0 ? (
          <div className="grid gap-2">
            {prioritizedQueue.map((attention, index) => {
              const sessionId = getAttentionSessionId(attention) || String(index);

              return (
                <AttentionCard
                  key={sessionId}
                  attention={attention}
                  selected={selectedSessionId === sessionId}
                  onSelect={onSelectAttention}
                  onPrefetch={onPrefetchAttention}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
