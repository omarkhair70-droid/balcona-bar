import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiWaiterLanguage } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import {
  aiLanguageOptions,
  type AiLanguageOption
} from "./ai-waiter-helpers";

type AiMessageComposerProps = {
  value: string;
  language: AiLanguageOption;
  onChange: (value: string) => void;
  onLanguageChange: (value: AiWaiterLanguage) => void;
  onSubmit: () => void;
  isSending?: boolean;
  errorMessage?: string;
};

export function AiMessageComposer({
  value,
  language,
  onChange,
  onLanguageChange,
  onSubmit,
  isSending,
  errorMessage
}: AiMessageComposerProps) {
  const t = useTranslations("customer.ai");
  const isEmpty = value.trim().length === 0;

  return (
    <div
      className="sticky bottom-24 z-20 rounded-[22px] border border-border bg-background/95 p-3 shadow-xl backdrop-blur"
      dir={language.dir}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[10px] font-black text-primary">
          {t("composer.safety")}
        </p>
        <div className="flex rounded-full border border-border bg-muted p-1">
          {aiLanguageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onLanguageChange(option.value)}
              className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${
                language.value === option.value
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <label className="sr-only" htmlFor="ai-waiter-message">
        {t("composer.label")}
      </label>
      <textarea
        id="ai-waiter-message"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          language.value === "ar-EG"
            ? t("composer.placeholderAr")
            : t("composer.placeholderEn")
        }
        className="min-h-20 w-full resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/25"
      />

      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[10px] leading-4 text-muted-foreground">
          {t("composer.helper")}
        </p>
        <Button
          onClick={onSubmit}
          disabled={isSending || isEmpty}
          className="shrink-0 rounded-full"
        >
          <SendHorizontal className="size-4" aria-hidden="true" />
          {isSending ? t("composer.sending") : t("composer.send")}
        </Button>
      </div>
    </div>
  );
}
