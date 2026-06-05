"use client";

import { Ban, Check, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CashierActionBarProps = {
  canAccept: boolean;
  canReject: boolean;
  canCancel: boolean;
  canComplete: boolean;
  rejectReason: string;
  cancelReason: string;
  acceptPending?: boolean;
  rejectPending?: boolean;
  cancelPending?: boolean;
  completePending?: boolean;
  disabledReason?: string;
  onRejectReasonChange: (value: string) => void;
  onCancelReasonChange: (value: string) => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  onComplete: () => void;
};

export function CashierActionBar({
  canAccept,
  canReject,
  canCancel,
  canComplete,
  rejectReason,
  cancelReason,
  acceptPending,
  rejectPending,
  cancelPending,
  completePending,
  disabledReason,
  onRejectReasonChange,
  onCancelReasonChange,
  onAccept,
  onReject,
  onCancel,
  onComplete
}: CashierActionBarProps) {
  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onAccept} disabled={!canAccept || acceptPending}>
          <Check className="size-4" aria-hidden="true" />
          {acceptPending ? "Accepting..." : "Accept"}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={!canReject || rejectPending}
        >
          <X className="size-4" aria-hidden="true" />
          {rejectPending ? "Rejecting..." : "Reject"}
        </Button>
        <Button
          variant="secondary"
          onClick={onComplete}
          disabled={!canComplete || completePending}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {completePending ? "Completing..." : "Complete"}
        </Button>
        <Button
          variant="danger"
          onClick={onCancel}
          disabled={!canCancel || cancelPending || cancelReason.trim().length === 0}
        >
          <Ban className="size-4" aria-hidden="true" />
          {cancelPending ? "Cancelling..." : "Cancel"}
        </Button>
        {!canAccept && !canReject && !canCancel && !canComplete ? (
          <span className="text-xs text-muted-foreground">
            {disabledReason}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Reject reason
          <textarea
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            rows={3}
            placeholder="Optional reason for the team and audit trail"
            className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canReject || rejectPending}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          Cancel reason
          <textarea
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            rows={3}
            placeholder="Required before cancelling an active order"
            className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCancel || cancelPending}
          />
        </label>
      </div>
    </div>
  );
}
