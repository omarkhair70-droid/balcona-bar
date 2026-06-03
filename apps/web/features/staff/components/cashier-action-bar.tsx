"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type CashierActionBarProps = {
  canAct: boolean;
  rejectReason: string;
  acceptPending?: boolean;
  rejectPending?: boolean;
  onRejectReasonChange: (value: string) => void;
  onAccept: () => void;
  onReject: () => void;
};

export function CashierActionBar({
  canAct,
  rejectReason,
  acceptPending,
  rejectPending,
  onRejectReasonChange,
  onAccept,
  onReject
}: CashierActionBarProps) {
  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onAccept} disabled={!canAct || acceptPending}>
          <Check className="size-4" aria-hidden="true" />
          {acceptPending ? "Accepting..." : "Accept"}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={!canAct || rejectPending}
        >
          <X className="size-4" aria-hidden="true" />
          {rejectPending ? "Rejecting..." : "Reject"}
        </Button>
        {!canAct ? (
          <span className="text-xs text-muted-foreground">
            Only submitted orders can be accepted or rejected.
          </span>
        ) : null}
      </div>
      <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
        Reject reason
        <textarea
          value={rejectReason}
          onChange={(event) => onRejectReasonChange(event.target.value)}
          rows={3}
          placeholder="Optional reason for the team and audit trail"
          className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canAct || rejectPending}
        />
      </label>
    </div>
  );
}
