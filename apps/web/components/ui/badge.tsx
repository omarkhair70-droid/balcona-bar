import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const badgeVariants = cva(
  "inline-flex items-center rounded-button border px-2.5 py-1 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary text-primary-foreground",
        muted: "border-border bg-muted text-muted-foreground",
        success: "border-success/40 bg-success text-primary-foreground",
        warning: "border-warning/40 bg-warning text-primary-foreground",
        danger: "border-danger/40 bg-danger text-primary-foreground"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
