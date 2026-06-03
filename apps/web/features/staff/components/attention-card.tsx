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
  const sessionId = getAttentionSessionId(attention);
  const status = getAttentionStatus(attention);
  const priority = getAttentionPriority(attention);
  const score = getAttentionScore(attention);
  const reasons = getAttentionReasons(attention);
  const actions = getAttentionRecommendedActions(attention);
  const isUrgent = status === "urgent" || priority === "urgent";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => sessionId && onSelect(sessionId)}
      className={cn(
        "w-full rounded-card border bg-surface/75 p-4 text-left shadow-card transition hover:border-primary/55 hover:bg-surface",
        selected ? "border-primary/70 bg-primary/10" : "border-border",
        isUrgent && !selected ? "border-danger/70 bg-danger/10" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle
              className={cn(
                "size-4",
                isUrgent ? "text-danger" : "text-primary"
              )}
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-foreground">
              {getTableLabel(
                getAttentionTable(attention),
                getAttentionFloor(attention)
              )}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Session {shortId(sessionId)} / {humanizeStatus(status)}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <AttentionStatusPill status={status} />
          <AttentionPriorityPill priority={priority} />
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Score</dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Gauge className="size-3.5" aria-hidden="true" />
            {score}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Updated</dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 font-semibold text-foreground">
            <Clock3 className="size-3.5" aria-hidden="true" />
            {formatDateTime(getAttentionLastEvaluatedAt(attention))}
          </dd>
        </div>
      </dl>

      {reasons[0] ? (
        <p className="mt-3 line-clamp-2 rounded-card border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {getAttentionReasonMessage(reasons[0])}
        </p>
      ) : null}

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.slice(0, 3).map((action, index) => (
            <Badge key={`${getAttentionActionLabel(action)}-${index}`} variant="muted">
              {getAttentionActionLabel(action)}
            </Badge>
          ))}
        </div>
      ) : null}
    </button>
  );
}
