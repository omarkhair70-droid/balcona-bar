"use client";

import { Ban, Check, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/i18n-provider";

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
  actionPending?: boolean;
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
  actionPending,
  disabledReason,
  onRejectReasonChange,
  onCancelReasonChange,
  onAccept,
  onReject,
  onCancel,
  onComplete
}: CashierActionBarProps) {
  const t = useTranslations("staff");
  const anyActionPending =
    actionPending ||
    Boolean(acceptPending || rejectPending || cancelPending || completePending);

  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onAccept} disabled={!canAccept || anyActionPending}>
          <Check className="size-4" aria-hidden="true" />
          {acceptPending ? t("actions.accepting") : t("actions.accept")}
        </Button>
        <Button
          variant="danger"
          onClick={onReject}
          disabled={!canReject || anyActionPending}
        >
          <X className="size-4" aria-hidden="true" />
          {rejectPending ? t("actions.rejecting") : t("actions.reject")}
        </Button>
        <Button
          variant="secondary"
          onClick={onComplete}
          disabled={!canComplete || anyActionPending}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {completePending ? t("actions.completing") : t("actions.complete")}
        </Button>
        <Button
          variant="danger"
          onClick={onCancel}
          disabled={!canCancel || anyActionPending || cancelReason.trim().length === 0}
        >
          <Ban className="size-4" aria-hidden="true" />
          {cancelPending ? t("actions.cancelling") : t("actions.cancel")}
        </Button>
        {!canAccept && !canReject && !canCancel && !canComplete ? (
          <span className="text-xs text-muted-foreground">
            {disabledReason}
          </span>
        ) : null}
        {anyActionPending ? (
          <span className="text-xs font-medium text-muted-foreground">
            {t("orders.updating")}
          </span>
        ) : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-foreground">
          {t("orders.rejectReason")}
          <textarea
            value={rejectReason}
            onChange={(event) => onRejectReasonChange(event.target.value)}
            rows={3}
            placeholder={t("orders.rejectReasonPlaceholder")}
            className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canReject || anyActionPending}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-foreground">
          {t("orders.cancelReason")}
          <textarea
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            rows={3}
            placeholder={t("orders.cancelReasonPlaceholder")}
            className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canCancel || anyActionPending}
          />
        </label>
      </div>
    </div>
  );
}
