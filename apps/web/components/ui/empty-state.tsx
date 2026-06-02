import { Inbox } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <section
      className={cn(
        "rounded-card border border-dashed bg-surface/70 p-6 text-center",
        className
      )}
    >
      <Inbox
        className="mx-auto size-8 text-primary"
        aria-hidden="true"
        strokeWidth={1.8}
      />
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
