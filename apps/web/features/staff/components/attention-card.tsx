"use client";

import { AlertTriangle, Clock3, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getAttentionActionLabel,
  getAttentionFloor,
  getAttentionLastEvaluatedAt,
  getAttentionPriority,
  getAttentionReasons,
  getAttentionRecommendedActions,
  getAttentionReasonMessage,
  getAttentionScore,
  getAttentionSessionId,
  getAttentionStatus,
  getAttentionTable
} from "@/features/staff/attention-data";
import {
  formatDateTime,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { AttentionPriorityPill } from "./attention-priority-pill";
import { AttentionStatusPill } from "./attention-status-pill";

type AttentionCardProps = {
  attention: Record<string, unknown>;
  selected?: boolean;
  onSelect: (sessionId: string) => void;
};

export function AttentionCard({
  attention,
  selected,
  onSelect
}: AttentionCardProps) {
  const t = useTranslations("staff");
  const sessionId = getAttentionSessionId(attention);
  const status = getAttentionStatus(attention);
  const priority = getAttentionPriority(attention);
  const score = getAttentionScore(attention);
  const reasons = getAttentionReasons(attention);
  const actions = getAttentionRecommendedActions(attention);
  const isUrgent = status === "urgent" || priority === "urgent";
  const isDue =
    !isUrgent && (priority === "high" || status === "needs_attention");

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => sessionId && onSelect(sessionId)}
      className={cn(
        "relative w-full overflow-hidden rounded-md border p-3 text-start transition",
        selected
          ? "border-[#8A6239] bg-[#34271E]"
          : "border-[#3B3028] bg-[#211A15] hover:border-[#554238] hover:bg-[#292019]"
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

      <div className="flex items-start justify-between gap-3 ps-1">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <AlertTriangle
              className={cn(
                "size-4 shrink-0",
                isUrgent
                  ? "text-[#F09C94]"
                  : isDue
                    ? "text-[#F0C66E]"
                    : "text-[#AFA195]"
              )}
              aria-hidden="true"
            />
            <p className="truncate text-sm font-semibold text-[#FFF4E6]">
              {getTableLabel(
                getAttentionTable(attention),
                getAttentionFloor(attention)
              )}
            </p>
          </div>
          <p className="mt-1 text-[11px] text-[#91857A]">
            {t("attention.cardSession", {
              sessionId: shortId(sessionId),
              status: humanizeStatus(status)
            })}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          <AttentionStatusPill status={status} />
          <AttentionPriorityPill priority={priority} />
        </div>
      </div>

      {reasons[0] ? (
        <p className="mt-3 line-clamp-2 ps-1 text-xs leading-5 text-[#D9CCC0]">
          {getAttentionReasonMessage(reasons[0])}
        </p>
      ) : null}

      <div className="mt-3 flex items-end justify-between gap-3 ps-1">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#8F8176]">
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-3.5" aria-hidden="true" />
            {t("attention.score")} {score}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDateTime(getAttentionLastEvaluatedAt(attention))}
          </span>
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5 ps-1">
          {actions.slice(0, 3).map((action, index) => (
            <Badge
              key={`${getAttentionActionLabel(action)}-${index}`}
              variant="muted"
            >
              {getAttentionActionLabel(action)}
            </Badge>
          ))}
        </div>
      ) : null}
    </button>
  );
}
