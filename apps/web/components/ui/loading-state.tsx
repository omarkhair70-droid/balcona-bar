import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type LoadingStateProps = {
  label?: string;
  className?: string;
};

export function LoadingState({
  label = "Loading",
  className
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-32 items-center justify-center gap-3 rounded-card border border-dashed bg-surface/70 p-6 text-sm text-muted-foreground",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
