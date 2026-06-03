"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Hash,
  MessageSquareText,
  Send,
  X
} from "lucide-react";
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
  getWaiterCallAcknowledgedAt,
  getWaiterCallCancelledAt,
  getWaiterCallCreatedAt,
  getWaiterCallEvents,
  getWaiterCallFloor,
  getWaiterCallId,
  getWaiterCallMessage,
  getWaiterCallOrderNumber,
  getWaiterCallOrderStatus,
  getWaiterCallPriority,
  getWaiterCallResolvedAt,
  getWaiterCallSessionStatus,
  getWaiterCallStatus,
  getWaiterCallTable,
  getWaiterCallType
} from "@/features/staff/waiter-data";
import {
  formatDateTime,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import type { WaiterCallDetailResult } from "@/lib/api/types";
import { WaiterCallStatusPill } from "./waiter-call-status-pill";

type WaiterCallDetailPanelProps = {
  waiterCall?: WaiterCallDetailResult;
  isLoading?: boolean;
  error?: Error;
  acknowledgePending?: boolean;
  resolvePending?: boolean;
  cancelPending?: boolean;
  onAcknowledge: () => void;
  onResolve: (resolutionNote?: string | null) => void;
  onCancel: (reason?: string | null) => void;
};

export function WaiterCallDetailPanel({
  waiterCall,
  isLoading,
  error,
  acknowledgePending,
  resolvePending,
  cancelPending,
  onAcknowledge,
  onResolve,
  onCancel
}: WaiterCallDetailPanelProps) {
  const [resolutionNote, setResolutionNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const status = waiterCall ? getWaiterCallStatus(waiterCall) : undefined;
  const events = waiterCall ? getWaiterCallEvents(waiterCall) : [];
  const canAcknowledge = status === "open";
  const canResolve = status === "open" || status === "acknowledged";
  const canCancel = status === "open" || status === "acknowledged";

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Call detail</CardTitle>
            <CardDescription>
              Inspect table, session, order context, and staff timeline before
              changing service state.
            </CardDescription>
          </div>
          {status ? <WaiterCallStatusPill status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!waiterCall && !isLoading && !error ? (
          <EmptyState
            title="Select a waiter call"
            description="Choose a request from the queue to acknowledge, resolve, or review its timeline."
          />
        ) : null}
        {isLoading ? <LoadingState label="Loading waiter call detail" /> : null}
        {error ? (
          <EmptyState
            title="Waiter call detail could not load"
            description={error.message}
          />
        ) : null}
        {waiterCall ? (
          <>
            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {getTableLabel(
                      getWaiterCallTable(waiterCall),
                      getWaiterCallFloor(waiterCall)
                    )}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {humanizeStatus(getWaiterCallType(waiterCall))} / Session{" "}
                    {humanizeStatus(getWaiterCallSessionStatus(waiterCall))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    Priority {getWaiterCallPriority(waiterCall) || "standard"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Call {shortId(getWaiterCallId(waiterCall))}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Created {formatDateTime(getWaiterCallCreatedAt(waiterCall))}
                </span>
                <span>Acknowledged {formatDateTime(getWaiterCallAcknowledgedAt(waiterCall))}</span>
                <span>Resolved {formatDateTime(getWaiterCallResolvedAt(waiterCall))}</span>
                <span>Cancelled {formatDateTime(getWaiterCallCancelledAt(waiterCall))}</span>
              </div>

              {getWaiterCallOrderNumber(waiterCall) ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Hash className="size-3.5" aria-hidden="true" />
                  Order {getWaiterCallOrderNumber(waiterCall)} /{" "}
                  {humanizeStatus(getWaiterCallOrderStatus(waiterCall))}
                </p>
              ) : null}

              {getWaiterCallMessage(waiterCall) ? (
                <div className="mt-4 rounded-card border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
                  <MessageSquareText
                    className="mr-2 inline size-4 text-primary"
                    aria-hidden="true"
                  />
                  {getWaiterCallMessage(waiterCall)}
                </div>
              ) : null}
            </div>

            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={onAcknowledge}
                  disabled={!canAcknowledge || acknowledgePending}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {acknowledgePending ? "Acknowledging..." : "Acknowledge"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onResolve(resolutionNote.trim() || null)}
                  disabled={!canResolve || resolvePending}
                >
                  <Send className="size-4" aria-hidden="true" />
                  {resolvePending ? "Resolving..." : "Resolve"}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onCancel(cancelReason.trim() || null)}
                  disabled={!canCancel || cancelPending}
                >
                  <X className="size-4" aria-hidden="true" />
                  {cancelPending ? "Cancelling..." : "Cancel"}
                </Button>
              </div>
              {!canAcknowledge && !canResolve && !canCancel ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Resolved and cancelled waiter calls are locked by the backend
                  workflow.
                </p>
              ) : null}
              <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
                Resolution note
                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  rows={3}
                  placeholder="Optional note after speaking with the table"
                  className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canResolve || resolvePending}
                />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
                Cancel reason
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={2}
                  placeholder="Optional reason if the request is no longer needed"
                  className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canCancel || cancelPending}
                />
              </label>
            </div>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Timeline
              </h3>
              {events.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No waiter call events were returned yet.
                </p>
              ) : null}
              {events.map((event, index) => (
                <div
                  key={getRecordString(event, "id") || String(index)}
                  className="flex items-start justify-between gap-3 rounded-card border bg-surface/75 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {humanizeStatus(getRecordString(event, "type", "event"))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRecordString(event, "actorType", "system")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(getRecordString(event, "createdAt"))}
                  </p>
                </div>
              ))}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
