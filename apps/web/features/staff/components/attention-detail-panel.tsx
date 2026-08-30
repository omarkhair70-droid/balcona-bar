"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Gauge,
  RefreshCw,
  VolumeX
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getAttentionActionKey,
  getAttentionLastEvaluatedAt,
  getAttentionPriority,
  getAttentionReasonMessage,
  getAttentionReasons,
  getAttentionRecommendedActions,
  getAttentionScore,
  getAttentionSessionId,
  getAttentionStatus,
  getAttentionTable
} from "@/features/staff/attention-data";
import {
  getRecordString,
  humanizeStatus
} from "@/features/staff/staff-format";
import type { TableSessionAttentionResult } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { AttentionPriorityPill } from "./attention-priority-pill";

type AttentionDetailPanelProps = {
  attention?: TableSessionAttentionResult;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error;
  resolvePending?: boolean;
  mutePending?: boolean;
  recalculatePending?: boolean;
  acknowledgeWaiterCallPending?: boolean;
  serveReadyOrderPending?: boolean;
  onAcknowledgeWaiterCall?: () => void;
  onServeReadyOrder?: () => void;
  onReviewBillRequest?: () => void;
  onResolve: (note?: string | null) => void;
  onMute: (minutes: number, note?: string | null) => void;
  onRecalculate: () => void;
};

const muteOptions = [15, 30, 60];

function formatAge(value: string) {
  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return "—";
  }

  const minutes = Math.max(0, Math.floor((Date.now() - parsed) / 60_000));

  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

function sourceForAttention(attention: TableSessionAttentionResult) {
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

export function AttentionDetailPanel({
  attention,
  isLoading,
  isRefreshing,
  error,
  resolvePending,
  mutePending,
  recalculatePending,
  acknowledgeWaiterCallPending,
  serveReadyOrderPending,
  onAcknowledgeWaiterCall,
  onServeReadyOrder,
  onReviewBillRequest,
  onResolve,
  onMute,
  onRecalculate
}: AttentionDetailPanelProps) {
  const t = useTranslations("staff");
  const [note, setNote] = useState("");
  const [muteMinutes, setMuteMinutes] = useState(30);

  if (isLoading) {
    return (
      <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
        <LoadingState label={t("attention.loading")} />
      </aside>
    );
  }

  if (error) {
    return (
      <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
        <EmptyState
          title={t("attention.detailLoadError")}
          description={error.message}
        />
      </aside>
    );
  }

  if (!attention) {
    return (
      <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
        <EmptyState
          title={t("attention.selectTitle")}
          description={t("attention.selectDescription")}
        />
      </aside>
    );
  }

  const status = getAttentionStatus(attention);
  const priority = getAttentionPriority(attention);
  const reasons = getAttentionReasons(attention);
  const actions = getAttentionRecommendedActions(attention);
  const table = getAttentionTable(attention);
  const tableCode =
    getRecordString(table, "code") ||
    getRecordString(table, "displayName") ||
    getAttentionSessionId(attention);
  const source = sourceForAttention(attention);
  const age = formatAge(getAttentionLastEvaluatedAt(attention));
  const canResolve = status !== "resolved";
  const canMute = status !== "resolved";

  const primaryActionKey =
    source === "waiter"
      ? "acknowledge_waiter_call"
      : source === "ready"
        ? "serve_ready_order"
        : source === "computed"
          ? "review_bill_request"
          : undefined;
  const primaryAction =
    actions.find((action) => getAttentionActionKey(action) === primaryActionKey) ??
    actions[0];
  const primaryActionKeyResolved = primaryAction
    ? getAttentionActionKey(primaryAction)
    : "";

  const actionable =
    primaryActionKeyResolved === "acknowledge_waiter_call" &&
    onAcknowledgeWaiterCall ? (
      <Button
        className="min-h-12"
        onClick={onAcknowledgeWaiterCall}
        disabled={acknowledgeWaiterCallPending || isRefreshing}
      >
        <Check className="size-4" aria-hidden="true" />
        {acknowledgeWaiterCallPending
          ? t("actions.acknowledging")
          : t("attention.acknowledgeClaim")}
      </Button>
    ) : primaryActionKeyResolved === "serve_ready_order" &&
      onServeReadyOrder ? (
      <Button
        className="min-h-12"
        onClick={onServeReadyOrder}
        disabled={serveReadyOrderPending || isRefreshing}
      >
        <Check className="size-4" aria-hidden="true" />
        {serveReadyOrderPending ? t("actions.serving") : t("actions.serve")}
      </Button>
    ) : primaryActionKeyResolved === "review_bill_request" &&
      onReviewBillRequest ? (
      <Button
        className="min-h-12"
        onClick={onReviewBillRequest}
        disabled={isRefreshing}
      >
        {t("attention.reviewBillRequest")}
      </Button>
    ) : null;

  return (
    <aside className="min-w-0 border-s border-[#352B24] bg-[#17120F] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
        {t("attention.currentTask")}
      </p>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-4xl font-bold text-[#FFF5E8]">
            {tableCode}
          </p>
          <p className="mt-2 text-sm text-[#A99B8E]">
            {age} · {humanizeStatus(source)}
          </p>
        </div>
        <AttentionPriorityPill priority={priority || status} />
      </div>

      {isRefreshing ? (
        <p className="mt-3 text-xs text-[#9D9186]">
          {t("attention.loading")}
        </p>
      ) : null}

      <div className="mt-5 rounded-md border border-[#3B3028] bg-[#211A15] p-4">
        <p className="text-xs text-[#8F8176]">
          {t("attention.reasonLabel")}
        </p>
        <p className="mt-2 text-base font-semibold leading-6 text-[#F4E7D8]">
          {reasons[0]
            ? getAttentionReasonMessage(reasons[0])
            : humanizeStatus(status)}
        </p>
      </div>

      <div className="mt-4 grid gap-2">
        {actionable}
        <Button
          type="button"
          variant="secondary"
          className="min-h-12"
          onClick={() => onResolve(note.trim() || null)}
          disabled={!canResolve || resolvePending || isRefreshing}
        >
          <Check className="size-4" aria-hidden="true" />
          {resolvePending ? t("actions.resolving") : t("actions.resolve")}
        </Button>
      </div>

      <details className="mt-4 rounded-md border border-[#3B3028] bg-[#1E1814]">
        <summary className="cursor-pointer list-none px-3 py-3 text-xs font-semibold text-[#BDAEA1]">
          {t("attention.moreControls")}
        </summary>
        <div className="border-t border-[#342A23] p-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#93867B]">
            <Badge variant="muted">
              <Gauge className="me-1 size-3" aria-hidden="true" />
              {t("attention.score")} {getAttentionScore(attention)}
            </Badge>
            <Badge variant="muted">{humanizeStatus(status)}</Badge>
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3" aria-hidden="true" />
              {age}
            </span>
          </div>

          {reasons.length > 1 ? (
            <div className="mt-3 grid gap-2">
              {reasons.slice(1).map((reason, index) => (
                <div
                  key={`${getAttentionReasonMessage(reason)}-${index}`}
                  className="rounded-md border border-[#342A23] bg-[#211A15] p-3 text-xs text-[#BFAFA0]"
                >
                  {getAttentionReasonMessage(reason)}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onMute(muteMinutes, note.trim() || null)}
              disabled={!canMute || mutePending || isRefreshing}
            >
              <VolumeX className="size-4" aria-hidden="true" />
              {mutePending ? t("actions.muting") : t("actions.mute")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={onRecalculate}
              disabled={recalculatePending || isRefreshing}
            >
              <RefreshCw
                className={cn(
                  "size-4",
                  recalculatePending ? "animate-spin" : ""
                )}
                aria-hidden="true"
              />
              {recalculatePending
                ? t("actions.recalculating")
                : t("actions.recalculate")}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {muteOptions.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => setMuteMinutes(minutes)}
                className={cn(
                  "min-h-9 rounded-md border px-3 text-xs font-semibold transition",
                  muteMinutes === minutes
                    ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                    : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2]"
                )}
              >
                {t("attention.minutesShort", { minutes })}
              </button>
            ))}
          </div>

          <label className="mt-3 grid gap-2 text-xs font-medium text-[#BDAEA1]">
            {t("attention.noteLabel")}
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={2}
              placeholder={t("attention.notePlaceholder")}
              className="w-full resize-none rounded-md border border-[#3B3028] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A]"
              disabled={resolvePending || mutePending || isRefreshing}
            />
          </label>
        </div>
      </details>
    </aside>
  );
}
