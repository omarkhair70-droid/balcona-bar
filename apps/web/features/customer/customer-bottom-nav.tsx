import Link from "next/link";
import { Bell, ClipboardList, Home, ShoppingBag, Utensils } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type CustomerBottomNavProps = {
  sessionId: string;
  active: "home" | "menu" | "cart" | "status" | "service";
  cartCount?: number;
};

const navItems = [
  { key: "home", label: "Table", icon: Home, href: "" },
  { key: "menu", label: "Menu", icon: Utensils, href: "/menu" },
  { key: "cart", label: "Cart", icon: ShoppingBag, href: "/cart" },
  { key: "status", label: "Status", icon: ClipboardList, href: "/status" },
  { key: "service", label: "Service", icon: Bell, href: "/service" }
] as const;

export function CustomerBottomNav({
  sessionId,
  active,
  cartCount = 0
}: CustomerBottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur md:left-1/2 md:max-w-3xl md:-translate-x-1/2 md:rounded-t-card md:border"
      aria-label="Customer session navigation"
    >
      <div className="grid grid-cols-5 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;

          return (
            <Link
              key={item.key}
              href={`/customer/session/${sessionId}${item.href}`}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-button text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive && "bg-primary text-primary-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{item.label}</span>
              {item.key === "cart" && cartCount > 0 ? (
                <span className="absolute right-2 top-1 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                  {cartCount}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
