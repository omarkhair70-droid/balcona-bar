"use client";

import { useState } from "react";
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
  const [cancelMode, setCancelMode] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const anyActionPending =
    actionPending ||
    Boolean(acceptPending || rejectPending || cancelPending || completePending);

  return (
    <div className="rounded-lg border border-[#47392E] bg-[#18130F] p-3">
      <div className="flex flex-wrap items-center gap-2">
        {canAccept ? (
          <Button
            onClick={onAccept}
            disabled={anyActionPending}
            className="min-h-11 flex-1 bg-[#C68A4A] font-bold text-[#1A110B] hover:bg-[#D39A5B]"
          >
            <Check className="size-4" aria-hidden="true" />
            {acceptPending ? t("actions.accepting") : t("actions.accept")}
          </Button>
        ) : null}

        {canReject ? (
          <Button
            variant="danger"
            onClick={() => setRejectMode(true)}
            disabled={anyActionPending}
            className="min-h-11 border border-[#76413C] bg-[#321F1D] text-[#F0A39B] hover:bg-[#3B2522]"
          >
            <X className="size-4" aria-hidden="true" />
            {rejectPending ? t("actions.rejecting") : t("actions.reject")}
          </Button>
        ) : null}

        {canComplete ? (
          <Button
            variant="secondary"
            onClick={onComplete}
            disabled={anyActionPending}
            className="min-h-11 flex-1 border-[#456144] bg-[#213022] text-[#A8D5A6] hover:bg-[#293B2A]"
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {completePending ? t("actions.completing") : t("actions.complete")}
          </Button>
        ) : null}

        {canCancel ? (
          <Button
            variant="danger"
            onClick={() => setCancelMode(true)}
            disabled={anyActionPending}
            className="min-h-11 border border-[#4A3C32] bg-[#211A15] text-[#CBBCAF] hover:bg-[#292019]"
          >
            <Ban className="size-4" aria-hidden="true" />
            {t("actions.cancel")}
          </Button>
        ) : null}

        {!canAccept && !canReject && !canCancel && !canComplete ? (
          <span className="w-full text-xs text-[#91857A]">{disabledReason}</span>
        ) : null}
        {anyActionPending ? (
          <span className="w-full text-xs font-medium text-[#91857A]">
            {t("orders.updating")}
          </span>
        ) : null}
      </div>

      {cancelMode && canCancel ? (
        <div className="mt-3 rounded-md border border-[#5A3B34] bg-[#241915] p-3">
          <label className="grid gap-1.5 text-xs font-medium text-[#D4B9B1]">
            {t("orders.cancelReason")}
            <textarea
              value={cancelReason}
              onChange={(event) => onCancelReasonChange(event.target.value)}
              rows={2}
              placeholder={t("orders.cancelReasonPlaceholder")}
              className="w-full resize-none rounded-md border border-[#5A3B34] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A]"
              disabled={anyActionPending}
              autoFocus
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={onCancel}
              disabled={anyActionPending || cancelReason.trim().length === 0}
            >
              <Ban className="size-4" aria-hidden="true" />
              {cancelPending ? t("actions.cancelling") : t("actions.cancel")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setCancelMode(false)}
              disabled={anyActionPending}
            >
              {t("actions.back")}
            </Button>
          </div>
        </div>
      ) : null}

      {rejectMode && canReject ? (
        <div className="mt-3 rounded-md border border-[#5A3B34] bg-[#241915] p-3">
          <label className="grid gap-1.5 text-xs font-medium text-[#D4B9B1]">
            {t("orders.rejectReason")}
            <textarea
              value={rejectReason}
              onChange={(event) => onRejectReasonChange(event.target.value)}
              rows={2}
              placeholder={t("orders.rejectReasonPlaceholder")}
              className="w-full resize-none rounded-md border border-[#5A3B34] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A]"
              disabled={anyActionPending}
              autoFocus
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={onReject}
              disabled={anyActionPending}
            >
              <X className="size-4" aria-hidden="true" />
              {rejectPending ? t("actions.rejecting") : t("actions.reject")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setRejectMode(false)}
              disabled={anyActionPending}
            >
              {t("actions.back")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
