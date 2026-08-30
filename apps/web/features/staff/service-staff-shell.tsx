"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { Banknote, BellRing, LayoutGrid, ListChecks, Receipt } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

export type ServiceMode = "cashier" | "waiter";
export type ServiceView = "floor" | "orders" | "attention" | "bills" | "shift";

type ServiceStaffShellProps = {
  mode: ServiceMode;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

const modes: Array<{
  id: ServiceMode;
  href: string;
  labelKey: "serviceShell.cashier" | "serviceShell.waiter";
}> = [
  {
    id: "cashier",
    href: "/service/cashier?mode=cashier#orders",
    labelKey: "serviceShell.cashier"
  },
  {
    id: "waiter",
    href: "/service/waiter?mode=waiter#floor",
    labelKey: "serviceShell.waiter"
  }
];

const serviceViewIds = new Set<ServiceView>([
  "floor",
  "orders",
  "attention",
  "bills",
  "shift"
]);

export function useServiceMode(routeMode: ServiceMode): ServiceMode {
  const searchParams = useSearchParams();
  const requestedMode = searchParams.get("mode");

  return requestedMode === "cashier" || requestedMode === "waiter"
    ? requestedMode
    : routeMode;
}

export function useServiceView(mode: ServiceMode): ServiceView {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const raw = hash.replace(/^#/, "");

  if (serviceViewIds.has(raw as ServiceView)) {
    return raw as ServiceView;
  }

  return mode === "cashier" ? "orders" : "floor";
}

const serviceViews = [
  {
    href: "/service/waiter#floor",
    labelKey: "serviceShell.floor" as const,
    icon: LayoutGrid
  },
  {
    href: "/service/cashier#orders",
    labelKey: "serviceShell.orders" as const,
    icon: ListChecks
  },
  {
    href: "/service/waiter#attention",
    labelKey: "serviceShell.attention" as const,
    icon: BellRing
  },
  {
    href: "/service/cashier#bills",
    labelKey: "serviceShell.bills" as const,
    icon: Receipt
  },
  {
    href: "/service/cashier#shift",
    labelKey: "serviceShell.shift" as const,
    icon: Banknote
  }
];

export function ServiceStaffShell({
  mode,
  title,
  description,
  actions,
  children
}: ServiceStaffShellProps) {
  const t = useTranslations("staff");
  const pathname = usePathname();
  const activeView = useServiceView(mode);
  const activeMode = useServiceMode(mode);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeView, pathname]);

  return (
    <main className="min-h-screen bg-[#17120F] text-[#FFF5E8]">
      <header className="sticky top-0 z-40 border-b border-[#352B24] bg-[#18130F]/96 backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 px-3">
          <Link
            href="/staff"
            className="flex shrink-0 items-center gap-2"
            aria-label="Balcona staff home"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#1B120C]">
              B
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold text-[#FFF6E9]">
                {t("serviceShell.productLabel")}
              </span>
              <span className="block text-[10px] text-[#9F9184]">
                {t("serviceShell.subtitle")}
              </span>
            </span>
          </Link>

          <nav
            className="mx-auto flex min-w-0 items-center rounded-md border border-[#3E332B] bg-[#211A15] p-1"
            aria-label="Service mode"
          >
            {modes.map((entry) => {
              const active = entry.id === activeMode;

              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "min-h-8 rounded px-3 text-center text-xs font-semibold transition",
                    active
                      ? "bg-[#C68A4A] text-[#1B120C]"
                      : "text-[#BFB0A2] hover:bg-[#2B221C] hover:text-[#F6EBDD]"
                  )}
                >
                  {t(entry.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {actions ? (
              <div className="hidden items-center gap-2 lg:flex">{actions}</div>
            ) : null}
            <LanguageSwitcher className="shrink-0 border-[#41362E] bg-[#211A15]" />
          </div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2E251F] px-3 py-2 lg:hidden">
            {actions}
          </div>
        ) : null}

        <nav
          className="flex gap-1 overflow-x-auto border-t border-[#2E251F] bg-[#1C1612] px-2 py-2"
          aria-label={t("serviceShell.viewNavigation")}
        >
          {serviceViews.map((entry) => {
            const Icon = entry.icon;
            const [entryPath, entryHash = ""] = entry.href.split("#");
            const active = activeView === entryHash;
            const href = `${entryPath}?mode=${activeMode}#${entryHash}`;

            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-10 min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition",
                  active
                    ? "bg-[#33271F] text-[#FFF5E7]"
                    : "text-[#B3A496] hover:bg-[#292019] hover:text-[#FFF5E7]"
                )}
              >
                <Icon
                  className={cn(
                    "size-4",
                    active ? "text-[#E0A764]" : "text-[#8F8176]"
                  )}
                  aria-hidden="true"
                />
                {t(entry.labelKey)}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="sr-only">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <div className="mx-auto max-w-[1600px]">{children}</div>
    </main>
  );
}
