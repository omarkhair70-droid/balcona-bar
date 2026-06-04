"use client";

import { useState } from "react";
import { Clock3, Hash, ListChecks } from "lucide-react";
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
  getTaskCancelledAt,
  getTaskCreatedAt,
  getTaskEvents,
  getTaskFloor,
  getTaskId,
  getTaskItemName,
  getTaskModifierOptions,
  getTaskNotes,
  getTaskOrderNumber,
  getTaskOrderStatus,
  getTaskOrderSubmittedAt,
  getTaskQuantity,
  getTaskReadyAt,
  getTaskStartedAt,
  getTaskStation,
  getTaskStatus,
  getTaskTable
} from "@/features/staff/preparation-data";
import {
  formatDateTime,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import type { PreparationTaskDetailResult } from "@/lib/api/types";
import { KitchenActionBar } from "./kitchen-action-bar";
import { KitchenTaskStatusPill } from "./kitchen-task-status-pill";

type KitchenTaskDetailPanelProps = {
  task?: PreparationTaskDetailResult;
  isLoading?: boolean;
  error?: Error;
  startPending?: boolean;
  readyPending?: boolean;
  cancelPending?: boolean;
  onStart: () => void;
  onReady: () => void;
  onCancel: (reason?: string | null) => void;
};

export function KitchenTaskDetailPanel({
  task,
  isLoading,
  error,
  startPending,
  readyPending,
  cancelPending,
  onStart,
  onReady,
  onCancel
}: KitchenTaskDetailPanelProps) {
  const [cancelReason, setCancelReason] = useState("");
  const status = task ? getTaskStatus(task) : undefined;
  const orderStatus = task ? getTaskOrderStatus(task) : undefined;
  const modifiers = task ? getTaskModifierOptions(task) : [];
  const events = task ? getTaskEvents(task) : [];
  const parentAllowsPreparation =
    orderStatus === "cashier_accepted" || orderStatus === "preparing";
  const parentAllowsCancel =
    parentAllowsPreparation || orderStatus === "ready";
  const canStart = status === "pending" && parentAllowsPreparation;
  const canReady =
    (status === "pending" || status === "preparing") &&
    parentAllowsPreparation;
  const canCancel =
    (status === "pending" || status === "preparing") && parentAllowsCancel;

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Task detail</CardTitle>
            <CardDescription>
              Inspect item, order, table, modifiers, and timeline before
              changing preparation state.
            </CardDescription>
          </div>
          {status ? <KitchenTaskStatusPill status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!task && !isLoading && !error ? (
          <EmptyState
            title="Select a preparation task"
            description="Choose a task from the board to start, mark ready, or cancel it."
          />
        ) : null}
        {isLoading ? <LoadingState label="Loading task detail" /> : null}
        {error ? (
          <EmptyState
            title="Task detail could not load"
            description={error.message}
          />
        ) : null}
        {task ? (
          <>
            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {getTaskItemName(task)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getTableLabel(getTaskTable(task), getTaskFloor(task))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">
                    {humanizeStatus(getTaskStation(task))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Qty {getTaskQuantity(task)}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Hash className="size-3.5" aria-hidden="true" />
                  {getTaskOrderNumber(task) ||
                    `Task ${shortId(getTaskId(task))}`}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Created {formatDateTime(getTaskCreatedAt(task))}
                </span>
                <span>Order {humanizeStatus(getTaskOrderStatus(task))}</span>
                <span>
                  Submitted {formatDateTime(getTaskOrderSubmittedAt(task))}
                </span>
              </div>
              {getTaskNotes(task) ? (
                <div className="mt-4 rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  {getTaskNotes(task)}
                </div>
              ) : null}
            </div>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="size-4 text-primary" aria-hidden="true" />
                Modifiers
              </h3>
              {modifiers.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No modifier options were returned for this item.
                </p>
              ) : null}
              {modifiers.map((modifier, index) => (
                <div
                  key={getRecordString(modifier, "id") || String(index)}
                  className="flex items-center justify-between gap-3 rounded-card border bg-surface/75 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {getRecordString(
                        modifier,
                        "modifierOptionNameSnapshot",
                        "Modifier"
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRecordString(
                        modifier,
                        "modifierGroupNameSnapshot",
                        "Group"
                      )}
                    </p>
                  </div>
                  {getRecordNumber(modifier, "priceDeltaMinorSnapshot") > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      +{getRecordNumber(modifier, "priceDeltaMinorSnapshot")}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>

            <KitchenActionBar
              canStart={canStart}
              canReady={canReady}
              canCancel={canCancel}
              cancelReason={cancelReason}
              startPending={startPending}
              readyPending={readyPending}
              cancelPending={cancelPending}
              onCancelReasonChange={setCancelReason}
              onStart={onStart}
              onReady={onReady}
              onCancel={() => onCancel(cancelReason.trim() || null)}
            />

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Timeline
              </h3>
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <span>Started {formatDateTime(getTaskStartedAt(task))}</span>
                <span>Ready {formatDateTime(getTaskReadyAt(task))}</span>
                <span>
                  Cancelled {formatDateTime(getTaskCancelledAt(task))}
                </span>
              </div>
              {events.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No preparation events were returned yet.
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
                      {getRecordString(event, "actorStaffUserId")
                        ? "staff"
                        : "system"}
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
