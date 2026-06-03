"use client";

import { Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type KitchenActionBarProps = {
  canStart: boolean;
  canReady: boolean;
  canCancel: boolean;
  cancelReason: string;
  startPending?: boolean;
  readyPending?: boolean;
  cancelPending?: boolean;
  onCancelReasonChange: (value: string) => void;
  onStart: () => void;
  onReady: () => void;
  onCancel: () => void;
};

export function KitchenActionBar({
  canStart,
  canReady,
  canCancel,
  cancelReason,
  startPending,
  readyPending,
  cancelPending,
  onCancelReasonChange,
  onStart,
  onReady,
  onCancel
}: KitchenActionBarProps) {
  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onStart} disabled={!canStart || startPending}>
          <Play className="size-4" aria-hidden="true" />
          {startPending ? "Starting..." : "Start"}
        </Button>
        <Button
          variant="secondary"
          onClick={onReady}
          disabled={!canReady || readyPending}
        >
          <Check className="size-4" aria-hidden="true" />
          {readyPending ? "Marking ready..." : "Mark ready"}
        </Button>
        <Button
          variant="danger"
          onClick={onCancel}
          disabled={!canCancel || cancelPending}
        >
          <X className="size-4" aria-hidden="true" />
          {cancelPending ? "Cancelling..." : "Cancel"}
        </Button>
      </div>
      {!canStart && !canReady && !canCancel ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Ready and cancelled tasks are locked by the backend workflow.
        </p>
      ) : null}
      <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
        Cancel reason
        <textarea
          value={cancelReason}
          onChange={(event) => onCancelReasonChange(event.target.value)}
          rows={3}
          placeholder="Optional reason for station handoff"
          className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canCancel || cancelPending}
        />
      </label>
    </div>
  );
}
