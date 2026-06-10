"use client";

import { Languages } from "lucide-react";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/config";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type LanguageSwitcherProps = {
  className?: string;
};

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("common");

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-button border bg-surface/80 p-1 text-xs shadow-sm",
        className
      )}
      aria-label={t("language")}
    >
      <Languages
        className="ms-2 size-4 text-muted-foreground"
        aria-hidden="true"
      />
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.locale}
          type="button"
          className={cn(
            "min-h-8 rounded-button px-2.5 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            locale === option.locale && "bg-primary text-primary-foreground"
          )}
          aria-pressed={locale === option.locale}
          onClick={() => setLocale(option.locale)}
        >
          {option.nativeLabel}
        </button>
      ))}
    </div>
  );
}
