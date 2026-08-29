"use client";

import { Check, Circle } from "lucide-react";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type TimelineEvent = {
  type: string;
  label: string;
  occurredAt: string;
};

type StatusTimelineProps = {
  events: TimelineEvent[];
};

export function StatusTimeline({ events }: StatusTimelineProps) {
  const t = useTranslations("customer");

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {t("empty.timelineDescription")}
        </p>
      </div>
    );
  }

  return (
    <ol>
      {events.map((event, index) => {
        const isLatest = index === events.length - 1;

        return (
          <li
            key={`${event.type}-${event.occurredAt}-${index}`}
            className="flex gap-3"
          >
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span
                className={
                  isLatest
                    ? "flex size-6 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground"
                    : "flex size-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
                }
              >
                {isLatest ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <Circle className="size-2.5" aria-hidden="true" />
                )}
              </span>
              {index < events.length - 1 ? (
                <span className="h-10 w-px bg-border" />
              ) : null}
            </div>

            <div className="min-w-0 pb-5">
              <p
                className={
                  isLatest
                    ? "text-sm font-black text-foreground"
                    : "text-sm font-semibold text-muted-foreground"
                }
              >
                {event.label}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(event.occurredAt).toLocaleString()}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
