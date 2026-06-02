import { Bot, CircleAlert, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getString,
  type AiLanguageOption
} from "./ai-waiter-helpers";

type AiWaiterStatusPillProps = {
  session?: Record<string, unknown> | null;
  language: AiLanguageOption;
  isLoading?: boolean;
  isError?: boolean;
};

export function AiWaiterStatusPill({
  session,
  language,
  isLoading,
  isError
}: AiWaiterStatusPillProps) {
  if (isError) {
    return (
      <Badge variant="danger" className="gap-2">
        <CircleAlert className="size-3.5" aria-hidden="true" />
        Offline
      </Badge>
    );
  }

  if (isLoading) {
    return (
      <Badge variant="muted" className="gap-2">
        <Bot className="size-3.5" aria-hidden="true" />
        Waking
      </Badge>
    );
  }

  const status = session
    ? getString(session, "status", "active").replaceAll("_", " ")
    : "ready";

  return (
    <Badge variant={session ? "success" : "muted"} className="gap-2">
      <Sparkles className="size-3.5" aria-hidden="true" />
      {status} · {language.label}
    </Badge>
  );
}
