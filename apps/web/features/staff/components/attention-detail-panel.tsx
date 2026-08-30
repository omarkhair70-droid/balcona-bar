"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Gauge,
  RefreshCw,
  VolumeX
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getAttentionActionKey,
  getAttentionActionLabel,
  getAttentionFloor,
  getAttentionLastEvaluatedAt,
  getAttentionMutedUntil,
  getAttentionPriority,
  getAttentionReasonLabel,
  getAttentionReasonMessage,
  getAttentionReasons,
  getAttentionRecommendedActions,
  getAttentionRecord,
  getAttentionResolvedAt,
  getAttentionScore,
  getAttentionSessionId,
  getAttentionStatus,
  getAttentionTable,
  getAttentionTableSession
} from "@/features/staff/attention-data";
import {
  formatDateTime,
  getRecord,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import type { TableSessionAttentionResult } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { AttentionPriorityPill } from "./attention-priority-pill";
import { AttentionStatusPill } from "./attention-status-pill";

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
  const status = attention ? getAttentionStatus(attention) : undefined;
  const priority = attention ? getAttentionPriority(attention) : undefined;
  const reasons = attention ? getAttentionReasons(attention) : [];
  const actions = attention ? getAttentionRecommendedActions(attention) : [];
  const tableSession = attention
    ? getAttentionTableSession(attention)
    : undefined;
  const metadata = attention
    ? getRecord(getAttentionRecord(attention).metadata)
    : undefined;
  const canResolve = status !== "resolved";
  const canMute = status !== "resolved";

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem] min-w-0 border-[#3B3028] bg-[#1E1814] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[#FFF5E8]">{t("attention.detailTitle")}</CardTitle>
            <CardDescription className="text-[#95887D]">{t("attention.detailDescription")}</CardDescription>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {status ? <AttentionStatusPill status={status} /> : null}
            {priority ? <AttentionPriorityPill priority={priority} /> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!attention && !isLoading && !error ? (
          <EmptyState
            title={t("attention.selectTitle")}
            description={t("attention.selectDescription")}
          />
        ) : null}
        {isLoading ? <LoadingState label={t("attention.loading")} /> : null}
        {isRefreshing ? (
          <p role="status" className="rounded-md border border-[#5A483A] bg-[#292019] p-3 text-xs text-[#CDBEAF]">
            {t("attention.loading")}
          </p>
        ) : null}
        {error ? (
          <EmptyState
            title={t("attention.detailLoadError")}
            description={error.message}
          />
        ) : null}
        {attention ? (
          <>
            <div className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[#FFF5E8]">
                    {getTableLabel(
                      getAttentionTable(attention),
                      getAttentionFloor(attention)
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[#A99B8E]">
                    {t("attention.cardSession", {
                      sessionId: shortId(getAttentionSessionId(attention)),
                      status: humanizeStatus(
                        getRecordString(tableSession, "status")
                      ),
                    })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F8EDDF]">
                    <Gauge className="size-4 text-primary" aria-hidden="true" />
                    {t("attention.score")} {getAttentionScore(attention)}
                  </p>
                  <p className="mt-1 text-xs text-[#91857A]">
                    {humanizeStatus(priority)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-[#91857A] sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {t("attention.evaluatedAt", {
                    date: formatDateTime(getAttentionLastEvaluatedAt(attention)),
                  })}
                </span>
                <span>
                  {t("attention.mutedUntil", {
                    date: formatDateTime(getAttentionMutedUntil(attention)),
                  })}
                </span>
                <span>
                  {t("attention.resolvedAt", {
                    date: formatDateTime(getAttentionResolvedAt(attention)),
                  })}
                </span>
                <span>
                  {t("attention.partySize", {
                    count:
                      getRecordNumber(tableSession, "partySize") ||
                      t("attention.partySizeUnknown"),
                  })}
                </span>
              </div>
            </div>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F8EDDF]">
                <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
                {t("attention.reasonsTitle")}
              </h3>
              {reasons.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("attention.emptyReasons")}
                </p>
              ) : null}
              {reasons.map((reason, index) => {
                const reasonRecord = getRecord(reason);

                return (
                  <div
                    key={`${getAttentionReasonLabel(reason)}-${index}`}
                    className="rounded-md border border-[#3A3028] bg-[#211A15] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8EDDF]">
                          {getAttentionReasonLabel(reason)}
                        </p>
                        <p className="mt-1 text-xs text-[#91857A]">
                          {getAttentionReasonMessage(reason)}
                        </p>
                      </div>
                      {reasonRecord ? (
                        <Badge variant="muted">
                          {t("attention.scoreDelta", {
                            count: getRecordNumber(reasonRecord, "scoreDelta"),
                          })}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-[#F8EDDF]">
                {t("attention.actionsTitle")}
              </h3>
              {actions.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("attention.emptyActions")}
                </p>
              ) : null}
              {actions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, index) => {
                    const actionKey = getAttentionActionKey(action);
                    const key = `${actionKey || getAttentionActionLabel(action)}-${index}`;

                    if (
                      actionKey === "acknowledge_waiter_call" &&
                      onAcknowledgeWaiterCall
                    ) {
                      return (
                        <Button
                          key={key}
                          size="sm"
                          onClick={onAcknowledgeWaiterCall}
                          disabled={acknowledgeWaiterCallPending || isRefreshing}
                        >
                          <Check className="size-4" aria-hidden="true" />
                          {acknowledgeWaiterCallPending
                            ? t("actions.acknowledging")
                            : t("actions.acknowledge")}
                        </Button>
                      );
                    }

                    if (
                      actionKey === "serve_ready_order" &&
                      onServeReadyOrder
                    ) {
                      return (
                        <Button
                          key={key}
                          size="sm"
                          onClick={onServeReadyOrder}
                          disabled={serveReadyOrderPending || isRefreshing}
                        >
                          <Check className="size-4" aria-hidden="true" />
                          {serveReadyOrderPending
                            ? t("actions.serving")
                            : t("actions.serve")}
                        </Button>
                      );
                    }

                    if (
                      actionKey === "review_bill_request" &&
                      onReviewBillRequest
                    ) {
                      return (
                        <Button
                          key={key}
                          size="sm"
                          variant="secondary"
                          onClick={onReviewBillRequest}
                          disabled={isRefreshing}
                        >
                          {t("actions.review")}
                        </Button>
                      );
                    }

                    return (
                      <Badge key={key} variant="default">
                        {getAttentionActionLabel(action)}
                      </Badge>
                    );
                  })}
                </div>
              ) : null}
            </section>

            <div className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => onResolve(note.trim() || null)}
                  disabled={!canResolve || resolvePending || isRefreshing}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {resolvePending ? t("actions.resolving") : t("actions.resolve")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onMute(muteMinutes, note.trim() || null)}
                  disabled={!canMute || mutePending || isRefreshing}
                >
                  <VolumeX className="size-4" aria-hidden="true" />
                  {mutePending ? t("actions.muting") : t("actions.mute")}
                </Button>
                <Button
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
              <div className="mt-4 flex flex-wrap gap-2">
                {muteOptions.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setMuteMinutes(minutes)}
                    className={cn(
                      "min-h-9 rounded-button border px-3 text-xs font-semibold transition",
                      muteMinutes === minutes
                        ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                        : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
                    )}
                  >
                    {t("attention.minutesShort", { minutes })}
                  </button>
                ))}
              </div>
              <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
                {t("attention.noteLabel")}
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder={t("attention.notePlaceholder")}
                  className="w-full resize-none rounded-md border border-[#3B3028] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A] focus:ring-2 focus:ring-[#C68A4A]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resolvePending || mutePending || isRefreshing}
                />
              </label>
            </div>

            {metadata && Object.keys(metadata).length > 0 ? (
              <section className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
                <h3 className="text-sm font-semibold text-[#F8EDDF]">
                  {t("attention.metadata")}
                </h3>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-[#91857A]">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              </section>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
