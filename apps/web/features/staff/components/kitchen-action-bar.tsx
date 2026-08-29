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
  const actionPending = Boolean(startPending || readyPending || cancelPending);

  return (
    <div className="sticky bottom-3 z-20 rounded-lg border border-[#4A433C] bg-[#151412]/96 p-3 shadow-[0_-12px_40px_rgba(0,0,0,.28)] backdrop-blur">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          onClick={onStart}
          disabled={!canStart || actionPending}
          className="min-h-12 bg-[#2D2925] font-black text-[#FFF8F0] hover:bg-[#39342F]"
        >
          <Play className="size-4" aria-hidden="true" />
          {startPending ? t("actions.starting") : t("actions.start")}
        </Button>
        <Button
          onClick={onReady}
          disabled={!canReady || actionPending}
          className="min-h-12 bg-[#C68A4A] font-black text-[#17110C] hover:bg-[#D59B59]"
        >
          <Check className="size-4" aria-hidden="true" />
          {readyPending ? t("actions.markingReady") : t("actions.markReady")}
        </Button>
        <Button
          variant="danger"
          onClick={onCancel}
          disabled={!canCancel || actionPending}
          className="min-h-12 border border-[#6B3934] bg-[#2B1D1B] font-bold text-[#F0A49B] hover:bg-[#37211F]"
        >
          <X className="size-4" aria-hidden="true" />
          {cancelPending ? t("actions.cancelling") : t("actions.cancel")}
        </Button>
      </div>

      {!canStart && !canReady && !canCancel ? (
        <p className="mt-3 text-xs text-[#817B75]">{t("tasks.locked")}</p>
      ) : null}

      {canCancel ? (
        <label className="mt-3 grid gap-1.5 text-xs font-bold text-[#AAA39C]">
          {t("tasks.cancelReason")}
          <textarea
            value={cancelReason}
            onChange={(event) => onCancelReasonChange(event.target.value)}
            rows={2}
            placeholder={t("tasks.cancelReasonPlaceholder")}
            className="w-full resize-none rounded-md border border-[#3E3A36] bg-[#1B1917] px-3 py-2 text-sm text-[#F1EAE3] outline-none transition placeholder:text-[#706A64] focus:border-[#C68A4A] focus:ring-2 focus:ring-[#C68A4A]/20 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionPending}
          />
        </label>
      ) : null}
    </div>
  );
}
