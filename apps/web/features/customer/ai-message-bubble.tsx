import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import {
  getMessageContent,
  getMessageRole,
  getRecordDateLabel,
  getString
} from "./ai-waiter-helpers";

type AiMessageBubbleProps = {
  message: Record<string, unknown>;
  dir?: "ltr" | "rtl";
};

export function AiMessageBubble({ message, dir = "ltr" }: AiMessageBubbleProps) {
  const role = getMessageRole(message);
  const isCustomer = role === "customer";
  const isSystem = role === "system";
  const kind = getString(message, "kind", "text").replaceAll("_", " ");
  const time = getRecordDateLabel(message);

  return (
    <li
      className={cn(
        "flex",
        isCustomer ? "justify-end" : "justify-start"
      )}
      dir={dir}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-card border p-4 shadow-card",
          isCustomer &&
            "border-primary/45 bg-primary text-primary-foreground",
          !isCustomer &&
            !isSystem &&
            "border-border bg-surface-raised text-foreground",
          isSystem && "border-warning/40 bg-warning/10 text-warning"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isCustomer ? "muted" : isSystem ? "warning" : "default"}>
            {isCustomer ? "You" : isSystem ? "System" : "AI waiter"}
          </Badge>
          <span className="text-xs opacity-75">{kind}</span>
          {time ? <span className="text-xs opacity-65">{time}</span> : null}
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
          {getMessageContent(message)}
        </p>
      </div>
    </li>
  );
}
