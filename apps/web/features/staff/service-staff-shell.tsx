"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { Banknote, BellRing, LayoutGrid, ListChecks, Receipt } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type ServiceMode = "cashier" | "waiter";

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
    href: "/staff/cashier",
    labelKey: "serviceShell.cashier"
  },
  {
    id: "waiter",
    href: "/staff/waiter",
    labelKey: "serviceShell.waiter"
  }
];

const serviceViews = [
  {
    href: "/staff/waiter#floor",
    labelKey: "serviceShell.floor" as const,
    icon: LayoutGrid
  },
  {
    href: "/staff/cashier#orders",
    labelKey: "serviceShell.orders" as const,
    icon: ListChecks
  },
  {
    href: "/staff/waiter#attention",
    labelKey: "serviceShell.attention" as const,
    icon: BellRing
  },
  {
    href: "/staff/cashier#bills",
    labelKey: "serviceShell.bills" as const,
    icon: Receipt
  },
  {
    href: "/staff/cashier#shift",
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
              const active = entry.id === mode;

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

          <LanguageSwitcher className="shrink-0 border-[#41362E] bg-[#211A15]" />
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#2E251F] px-3 py-2">
            {actions}
          </div>
        ) : null}

        <nav
          className="flex gap-1 overflow-x-auto border-t border-[#2E251F] bg-[#1C1612] px-2 py-2"
          aria-label={t("serviceShell.viewNavigation")}
        >
          {serviceViews.map((entry) => {
            const Icon = entry.icon;

            return (
              <Link
                key={entry.href}
                href={entry.href}
                className="flex min-h-10 min-w-[112px] shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-[#B3A496] transition hover:bg-[#292019] hover:text-[#FFF5E7]"
              >
                <Icon className="size-4 text-[#8F8176]" aria-hidden="true" />
                {t(entry.labelKey)}
              </Link>
            );
          })}
        </nav>
      </header>

      <section className="border-b border-[#342A23] bg-[#1C1612] px-3 py-4 sm:px-4">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
            {mode === "cashier" ? t("serviceShell.cashierEyebrow") : t("serviceShell.waiterEyebrow")}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-[#FFF4E6] sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#9E9084] sm:text-sm">
            {description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] p-3 sm:p-4">{children}</div>
    </main>
  );
}
