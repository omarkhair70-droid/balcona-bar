import { CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";

type TimelineEvent = {
  type: string;
  label: string;
  occurredAt: string;
};

type StatusTimelineProps = {
  events: TimelineEvent[];
};

export function StatusTimeline({ events }: StatusTimelineProps) {
  if (events.length === 0) {
    return (
      <Card variant="quiet">
        <p className="text-sm text-muted-foreground">
          Your table timeline will appear as soon as an order or service event
          happens.
        </p>
      </Card>
    );
  }

  return (
    <ol className="grid gap-3">
      {events.map((event, index) => (
        <li key={`${event.type}-${event.occurredAt}-${index}`} className="flex gap-3">
          <span className="mt-1 text-primary">
            {index === events.length - 1 ? (
              <CheckCircle2 className="size-5" aria-hidden="true" />
            ) : (
              <Circle className="size-5" aria-hidden="true" />
            )}
          </span>
          <div className="rounded-card border bg-surface/75 p-4">
            <p className="text-sm font-semibold text-foreground">{event.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(event.occurredAt).toLocaleString()}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
