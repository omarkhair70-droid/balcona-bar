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
import { cn } from "@/lib/utils/cn";
import { AttentionPriorityPill } from "./attention-priority-pill";
import { AttentionStatusPill } from "./attention-status-pill";

type AttentionDetailPanelProps = {
  attention?: TableSessionAttentionResult;
  isLoading?: boolean;
  error?: Error;
  resolvePending?: boolean;
  mutePending?: boolean;
  recalculatePending?: boolean;
  onResolve: (note?: string | null) => void;
  onMute: (minutes: number, note?: string | null) => void;
  onRecalculate: () => void;
};

const muteOptions = [15, 30, 60];

export function AttentionDetailPanel({
  attention,
  isLoading,
  error,
  resolvePending,
  mutePending,
  recalculatePending,
  onResolve,
  onMute,
  onRecalculate
}: AttentionDetailPanelProps) {
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
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Attention detail</CardTitle>
            <CardDescription>
              Review table signals, reasons, and recommended floor actions.
            </CardDescription>
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
            title="Select an attention item"
            description="Choose a table signal to resolve, mute, or recalculate the backend attention state."
          />
        ) : null}
        {isLoading ? <LoadingState label="Loading attention detail" /> : null}
        {error ? (
          <EmptyState
            title="Attention detail could not load"
            description={error.message}
          />
        ) : null}
        {attention ? (
          <>
            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {getTableLabel(
                      getAttentionTable(attention),
                      getAttentionFloor(attention)
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Session {shortId(getAttentionSessionId(attention))} /{" "}
                    {humanizeStatus(getRecordString(tableSession, "status"))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Gauge className="size-4 text-primary" aria-hidden="true" />
                    Score {getAttentionScore(attention)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {humanizeStatus(priority)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Evaluated {formatDateTime(getAttentionLastEvaluatedAt(attention))}
                </span>
                <span>Muted until {formatDateTime(getAttentionMutedUntil(attention))}</span>
                <span>Resolved {formatDateTime(getAttentionResolvedAt(attention))}</span>
                <span>Party size {getRecordNumber(tableSession, "partySize") || "unknown"}</span>
              </div>
            </div>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
                Reasons
              </h3>
              {reasons.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No reason records were returned for this snapshot.
                </p>
              ) : null}
              {reasons.map((reason, index) => {
                const reasonRecord = getRecord(reason);

                return (
                  <div
                    key={`${getAttentionReasonLabel(reason)}-${index}`}
                    className="rounded-card border bg-surface/75 p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {getAttentionReasonLabel(reason)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {getAttentionReasonMessage(reason)}
                        </p>
                      </div>
                      {reasonRecord ? (
                        <Badge variant="muted">
                          +{getRecordNumber(reasonRecord, "scoreDelta")} score
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Recommended actions
              </h3>
              {actions.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No recommended actions were returned for this table.
                </p>
              ) : null}
              {actions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action, index) => (
                    <Badge
                      key={`${getAttentionActionLabel(action)}-${index}`}
                      variant="default"
                    >
                      {getAttentionActionLabel(action)}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => onResolve(note.trim() || null)}
                  disabled={!canResolve || resolvePending}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {resolvePending ? "Resolving..." : "Resolve"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onMute(muteMinutes, note.trim() || null)}
                  disabled={!canMute || mutePending}
                >
                  <VolumeX className="size-4" aria-hidden="true" />
                  {mutePending ? "Muting..." : "Mute"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={onRecalculate}
                  disabled={recalculatePending}
                >
                  <RefreshCw
                    className={cn(
                      "size-4",
                      recalculatePending ? "animate-spin" : ""
                    )}
                    aria-hidden="true"
                  />
                  {recalculatePending ? "Recalculating..." : "Recalculate"}
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
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {minutes} min
                  </button>
                ))}
              </div>
              <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
                Staff note
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Optional note for resolve or mute"
                  className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={resolvePending || mutePending}
                />
              </label>
            </div>

            {metadata && Object.keys(metadata).length > 0 ? (
              <section className="rounded-card border bg-surface/75 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Metadata
                </h3>
                <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
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
