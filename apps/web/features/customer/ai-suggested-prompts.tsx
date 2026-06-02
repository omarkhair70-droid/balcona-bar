import type { AiWaiterLanguage } from "@/lib/api/types";
import { aiSuggestedPrompts } from "./ai-waiter-helpers";

type AiSuggestedPromptsProps = {
  language: AiWaiterLanguage;
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function AiSuggestedPrompts({
  language,
  onSelect,
  disabled
}: AiSuggestedPromptsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Suggested prompts">
      {aiSuggestedPrompts[language].map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="min-h-9 shrink-0 rounded-button border bg-surface px-3 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
