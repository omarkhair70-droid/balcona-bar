import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AiWaiterLanguage } from "@/lib/api/types";
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
  const isEmpty = value.trim().length === 0;

  return (
    <div
      className="sticky bottom-24 z-10 rounded-card border bg-background/95 p-3 shadow-elevated backdrop-blur"
      dir={language.dir}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-primary">
          AI suggests. You confirm.
        </p>
        <div className="flex rounded-button border bg-surface p-1">
          {aiLanguageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onLanguageChange(option.value)}
              className={`rounded-button px-3 py-1 text-xs font-semibold transition ${
                language.value === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <label className="sr-only" htmlFor="ai-waiter-message">
        Message AI waiter
      </label>
      <textarea
        id="ai-waiter-message"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          language.value === "ar-EG"
            ? "اكتب اللي نفسك فيه..."
            : "Tell the waiter what you like..."
        }
        className="min-h-24 w-full resize-none rounded-card border bg-surface px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/35"
      />
      {errorMessage ? (
        <div
          role="alert"
          className="mt-3 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
        >
          {errorMessage}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Suggestions use this branch menu and availability. Final order
          submission stays in the cart.
        </p>
        <Button onClick={onSubmit} disabled={isSending || isEmpty}>
          <SendHorizontal className="size-4" aria-hidden="true" />
          {isSending ? "Sending..." : "Send"}
        </Button>
      </div>
    </div>
  );
}
