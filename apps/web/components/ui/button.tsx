import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-button px-4 text-sm font-semibold outline-none transition-[color,background-color,border-color,box-shadow,filter,opacity,transform] duration-150 active:translate-y-px active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:transform-none",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground shadow-glow hover:brightness-110",
        secondary:
          "border bg-surface text-foreground hover:bg-surface-2",
        ghost: "text-muted-foreground hover:bg-muted hover:text-foreground",
        danger: "bg-danger text-primary-foreground hover:brightness-110"
      },
      size: {
        sm: "min-h-9 px-3 text-xs",
        md: "min-h-10 px-4 text-sm",
        lg: "min-h-12 px-5 text-base",
        icon: "size-10 p-0"
      }
    },
    defaultVariants: {
      variant: "primary",
      size: "md"
    }
  }
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
);

Button.displayName = "Button";
