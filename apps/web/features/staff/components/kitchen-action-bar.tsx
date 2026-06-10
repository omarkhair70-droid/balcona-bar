"use client";

import { Check, Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n/i18n-provider";

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
  const t = useTranslations("staff");

  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onStart} disabled={!canStart || startPending}>
          <Play className="size-4" aria-hidden="true" />
          {startPending ? t("actions.starting") : t("actions.start")}
        </Button>
        <Button
          variant="secondary"
          onClick={onReady}
          disabled={!canReady || readyPending}
        >
          <Check className="size-4" aria-hidden="true" />
          {readyPending ? t("actions.markingReady") : t("actions.markReady")}
        </Button>
        <Button
          variant="danger"
          onClick={onCancel}
          disabled={!canCancel || cancelPending}
        >
          <X className="size-4" aria-hidden="true" />
          {cancelPending ? t("actions.cancelling") : t("actions.cancel")}
        </Button>
      </div>
      {!canStart && !canReady && !canCancel ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t("tasks.locked")}
        </p>
      ) : null}
      <label className="mt-4 grid gap-2 text-sm font-medium text-foreground">
        {t("tasks.cancelReason")}
        <textarea
          value={cancelReason}
          onChange={(event) => onCancelReasonChange(event.target.value)}
          rows={3}
          placeholder={t("tasks.cancelReasonPlaceholder")}
          className="w-full resize-none rounded-button border bg-surface px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canCancel || cancelPending}
        />
      </label>
    </div>
  );
}
