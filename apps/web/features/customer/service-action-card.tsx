"use client";

import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type ServiceActionCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  pending?: boolean;
};

export function ServiceActionCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  disabled,
  pending
}: ServiceActionCardProps) {
  const t = useTranslations("customer");

  return (
    <button
      type="button"
      onClick={onAction}
      disabled={disabled || pending}
      className="flex min-h-24 w-full items-center gap-4 rounded-[22px] border border-border bg-card p-4 text-start transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-base font-black text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
          {pending ? t("service.sending") : description}
        </span>
      </span>

      <span className="sr-only">{actionLabel}</span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground rtl:rotate-180"
        aria-hidden="true"
      />
    </button>
  );
}
