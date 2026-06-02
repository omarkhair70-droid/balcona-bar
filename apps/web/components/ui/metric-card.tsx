import { type ReactNode } from "react";
import { Card } from "./card";
import { cn } from "@/lib/utils/cn";

type MetricTone = "primary" | "success" | "warning" | "accent" | "muted";

const toneClasses: Record<MetricTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  accent: "text-accent-foreground",
  muted: "text-muted-foreground"
};

type MetricCardProps = {
  label: string;
  value: string;
  description?: string;
  icon?: ReactNode;
  tone?: MetricTone;
  className?: string;
};

export function MetricCard({
  label,
  value,
  description,
  icon,
  tone = "primary",
  className
}: MetricCardProps) {
  return (
    <Card variant="quiet" className={cn("min-h-32", className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold tracking-normal text-foreground">
            {value}
          </p>
        </div>
        {icon ? (
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-button bg-muted",
              toneClasses[tone]
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {description ? (
        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </Card>
  );
}
