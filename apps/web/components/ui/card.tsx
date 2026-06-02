import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

const cardVariants = cva("rounded-card border shadow-card", {
  variants: {
    variant: {
      default: "bg-surface",
      elevated: "bg-surface-raised shadow-elevated",
      glass: "premium-surface",
      quiet: "border-border/70 bg-surface/60 shadow-none",
      accent: "border-primary/45 bg-primary/10 shadow-glow"
    },
    padding: {
      none: "p-0",
      sm: "p-4",
      md: "p-5",
      lg: "p-6"
    }
  },
  defaultVariants: {
    variant: "default",
    padding: "md"
  }
});

export type CardProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants>;

export function Card({ className, variant, padding, ...props }: CardProps) {
  return (
    <div
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("space-y-2", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex flex-wrap items-center gap-3", className)}
      {...props}
    />
  );
}
