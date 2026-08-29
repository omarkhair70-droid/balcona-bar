import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import {
  getAiToolExecutionStatusKey,
  getMessageContent,
  getMessageRole,
  getPendingModifierQuickReplies,
  getRecordDateLabel,
  getString
} from "./ai-waiter-helpers";

type AiMessageBubbleProps = {
  message: Record<string, unknown>;
  dir?: "ltr" | "rtl";
  isReplyDisabled?: boolean;
  onQuickReply?: (value: string) => void;
};

export function AiMessageBubble({
  message,
  dir = "ltr",
  isReplyDisabled = false,
  onQuickReply
}: AiMessageBubbleProps) {
  const t = useTranslations("customer.ai");
  const role = getMessageRole(message);
  const isCustomer = role === "customer";
  const isSystem = role === "system";
  const kind = getString(message, "kind", "text").replaceAll("_", " ");
  const time = getRecordDateLabel(message);
  const toolStatus =
    !isCustomer && !isSystem
      ? getAiToolExecutionStatusKey(message)
      : undefined;
  const quickReplies =
    !isCustomer && !isSystem ? getPendingModifierQuickReplies(message) : [];

  return (
    <li
      className={cn("flex", isCustomer ? "justify-end" : "justify-start")}
      dir={dir}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-[18px] border p-3.5",
          isCustomer &&
            "border-primary/45 bg-primary text-primary-foreground",
          !isCustomer &&
            !isSystem &&
            "border-border bg-card text-foreground",
          isSystem && "border-warning/40 bg-warning/10 text-warning"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              isCustomer ? "muted" : isSystem ? "warning" : "default"
            }
          >
            {isCustomer
              ? t("messages.you")
              : isSystem
                ? t("messages.system")
                : t("messages.aiWaiter")}
          </Badge>
          <span className="text-[10px] opacity-70">{kind}</span>
          {time ? <span className="text-[10px] opacity-60">{time}</span> : null}
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
          {getMessageContent(message, t("messages.detailsUnavailable"))}
        </p>

        {toolStatus ? (
          <Badge variant="success" className="mt-3">
            {t(toolStatus)}
          </Badge>
        ) : null}

        {quickReplies.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary/60 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-55"
                disabled={isReplyDisabled}
                onClick={() => onQuickReply?.(reply)}
              >
                {reply}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}
