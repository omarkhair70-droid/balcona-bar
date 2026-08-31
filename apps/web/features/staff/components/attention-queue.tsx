"use client";

import { useMemo } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getAttentionLastEvaluatedAt,
  getAttentionPriority,
  getAttentionSessionId,
  getAttentionStatus
} from "@/features/staff/attention-data";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { AttentionCard } from "./attention-card";

type AttentionQueueProps = {
  attentionQueue: Record<string, unknown>[];
  selectedSessionId?: string;
  isLoading?: boolean;
  error?: Error;
  onSelectAttention: (sessionId: string) => void;
  onPrefetchAttention?: (sessionId: string) => void;
  onRefresh: () => void;
};

export function AttentionQueue({
  attentionQueue,
  selectedSessionId,
  isLoading,
  error,
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
      low: 3
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

  const urgentCount = prioritizedQueue.filter((entry) => {
    const status = getAttentionStatus(entry);
    const priority = getAttentionPriority(entry);
    return status === "urgent" || priority === "urgent";
  }).length;
  const dueCount = prioritizedQueue.filter((entry) => {
    const status = getAttentionStatus(entry);
    const priority = getAttentionPriority(entry);
    return (
      status === "needs_attention" ||
      priority === "high" ||
      priority === "medium"
    );
  }).length;

  return (
    <section className="min-w-0 bg-[#1E1814] p-3 lg:p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
            {t("attention.waiterQueue")}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#FFF4E6]">
            {t("attention.queueTitle")}
          </h2>
          <p className="mt-1 text-xs text-[#9E9084]">
            {t("attention.queuePriorityDescription")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {urgentCount > 0 ? (
            <Badge variant="danger">
              {t("attention.urgentCount", { count: urgentCount })}
            </Badge>
          ) : null}
          {dueCount > 0 ? (
            <Badge variant="warning">
              {t("attention.dueCount", { count: dueCount })}
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195] transition hover:border-[#5A483A] hover:text-[#F6EBDD]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[#3A3028] bg-[#18130F]">
        <div className="hidden grid-cols-[82px_80px_minmax(0,1fr)_82px] gap-3 border-b border-[#342B24] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#80746A] md:grid">
          <span>{t("attention.tableColumn")}</span>
          <span>{t("attention.ageColumn")}</span>
          <span>{t("attention.needColumn")}</span>
          <span>{t("attention.sourceColumn")}</span>
        </div>

        {isLoading ? (
          <div className="p-3">
            <LoadingState label={t("attention.loading")} />
          </div>
        ) : null}
        {error ? (
          <div className="p-3">
            <EmptyState
              title={t("attention.loadError")}
              description={error.message}
            />
          </div>
        ) : null}
        {!isLoading && !error && prioritizedQueue.length === 0 ? (
          <div className="p-3">
            <EmptyState
              title={t("attention.emptyTitle")}
              description={t("attention.emptyDescription")}
            />
          </div>
        ) : null}

        {!isLoading && !error && prioritizedQueue.length > 0 ? (
          <div className="divide-y divide-[#342B24]">
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
