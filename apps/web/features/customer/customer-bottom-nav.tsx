"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, ClipboardList, ReceiptText, Utensils } from "lucide-react";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type CustomerBottomNavProps = {
  sessionId: string;
  active: "home" | "menu" | "cart" | "status" | "service";
  cartCount?: number;
};

type GuestNavKey = "menu" | "order" | "service" | "bill";

const navItems = [
  { key: "menu", labelKey: "menu", icon: Utensils, href: "/menu" },
  { key: "order", labelKey: "order", icon: ClipboardList, href: "/status" },
  { key: "service", labelKey: "service", icon: Bell, href: "/service" },
  { key: "bill", labelKey: "bill", icon: ReceiptText, href: "/service#bill" }
] as const;

function getActiveKey(
  active: CustomerBottomNavProps["active"],
  hash: string
): GuestNavKey | null {
  if (active === "menu") {
    return "menu";
  }

  if (active === "status") {
    return "order";
  }

  if (active === "service") {
    return hash === "#bill" ? "bill" : "service";
  }

  return null;
}

export function CustomerBottomNav({
  sessionId,
  active,
  cartCount = 0
}: CustomerBottomNavProps) {
  const t = useTranslations("navigation");
  const tCustomer = useTranslations("customer");
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const activeKey = getActiveKey(active, hash);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md border-t border-border bg-background/95 px-2 pb-[calc(0.55rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur"
      aria-label={tCustomer("aria.customerSessionNavigation")}
    >
      <div className="grid grid-cols-4 gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeKey === item.key;

          return (
            <Link
              key={item.key}
              href={`/customer/session/${sessionId}${item.href}`}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground",
                isActive &&
                  "!bg-primary !text-primary-foreground hover:!bg-primary hover:!text-primary-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span>{t(item.labelKey)}</span>
              {item.key === "menu" && cartCount > 0 ? (
                <span className="absolute end-2 top-1 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-black text-accent-foreground">
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
