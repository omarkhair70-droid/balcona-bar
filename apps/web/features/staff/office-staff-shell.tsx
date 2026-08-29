"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MenuSquare,
  PackageSearch,
  Settings,
  Sparkles,
  Users,
  WandSparkles
} from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type OfficeDomain =
  | "home"
  | "operations"
  | "catalog"
  | "inventory"
  | "locations"
  | "team"
  | "money"
  | "insights"
  | "experience"
  | "settings";

type OfficeStaffShellProps = {
  activeDomain: OfficeDomain;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

const officeDomains: Array<{
  id: OfficeDomain;
  labelKey: string;
  icon: typeof LayoutDashboard;
  href?: string;
}> = [
  { id: "home", labelKey: "office.home", icon: LayoutDashboard, href: "/staff/owner" },
  { id: "operations", labelKey: "office.operations", icon: Sparkles, href: "/staff/owner#operations" },
  { id: "catalog", labelKey: "office.catalog", icon: MenuSquare, href: "/staff/menu" },
  { id: "inventory", labelKey: "office.inventory", icon: Boxes, href: "/staff/inventory" },
  { id: "locations", labelKey: "office.locations", icon: MapPin, href: "/staff/branches" },
  { id: "team", labelKey: "office.team", icon: Users, href: "/staff/owner#team" },
  { id: "money", labelKey: "office.money", icon: CreditCard, href: "/staff/owner#money" },
  { id: "insights", labelKey: "office.insights", icon: PackageSearch, href: "/staff/owner#insights" },
  { id: "experience", labelKey: "office.experience", icon: WandSparkles, href: "/staff/owner#experience" },
  { id: "settings", labelKey: "office.settings", icon: Settings, href: "/staff/owner#settings" }
];

const officeThemeStyle = {
  "--background": "#F5F5F2",
  "--foreground": "#22221F",
  "--surface": "#FFFFFF",
  "--surface-2": "#F7F7F4",
  "--surface-raised": "#FFFFFF",
  "--surface-overlay": "rgba(255,255,255,0.94)",
  "--primary": "#6E6256",
  "--primary-foreground": "#FFFFFF",
  "--accent": "#8A7462",
  "--accent-foreground": "#FFFFFF",
  "--muted": "#F0F0EC",
  "--muted-foreground": "#72726C",
  "--border": "#D9D9D4",
  "--ring": "#9A8B7A",
  "--danger": "#A84F46",
  "--success": "#4F7652",
  "--warning": "#8A6A2C",
  "--shadow-card": "0 1px 2px rgba(0,0,0,0.04)",
  "--shadow-elevated": "0 12px 32px rgba(31,31,28,0.08)",
  "--shadow-glow": "0 0 0 1px rgba(110,98,86,0.06)",
  colorScheme: "light"
} as CSSProperties;

export function OfficeStaffShell({
  activeDomain,
  title,
  description,
  actions,
  children
}: OfficeStaffShellProps) {
  const t = useTranslations("staff");
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);

    syncHash();
    window.addEventListener("hashchange", syncHash);

    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const hashDomain: OfficeDomain | undefined =
    pathname === "/staff/owner"
      ? hash === "#operations"
        ? "operations"
        : hash === "#money"
          ? "money"
          : hash === "#insights"
            ? "insights"
            : hash === "#team"
              ? "team"
              : hash === "#experience"
                ? "experience"
                : hash === "#settings"
                  ? "settings"
                  : undefined
      : undefined;
  const effectiveActiveDomain = hashDomain ?? activeDomain;

  return (
    <main style={officeThemeStyle} className="min-h-screen bg-[#F5F5F2] text-[#20201D]">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-[#D8D8D3] bg-[#ECECE8] px-3 py-3 lg:overflow-visible lg:border-b-0 lg:border-e lg:py-4">
          <Link
            href="/staff/owner"
            className="flex items-center gap-3 px-2"
            aria-label={t("office.productLabel")}
          >
            <span className="flex size-8 items-center justify-center rounded-md border border-[#CFCFC9] bg-[#F7F7F4] text-xs font-black text-[#292925]">
              B
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.01em]">
                {t("office.productLabel")}
              </span>
              <span className="block text-[10px] text-[#75756F]">
                {t("office.productSubtitle")}
              </span>
            </span>
          </Link>

          <nav className="mt-3 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 lg:mt-7 lg:grid lg:gap-0.5 lg:overflow-visible lg:pb-0">
            {officeDomains.map((item) => {
              const Icon = item.icon;
              const active = item.id === effectiveActiveDomain;
              const classes = cn(
                "flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs transition lg:shrink lg:gap-2.5 lg:text-sm",
                active
                  ? "bg-white font-semibold text-[#20201D] shadow-[0_1px_0_rgba(0,0,0,.04)]"
                  : item.href
                    ? "text-[#64645E] hover:bg-[#E3E3DE] hover:text-[#20201D]"
                    : "cursor-default text-[#9A9A94]"
              );

              if (!item.href) {
                return (
                  <span
                    key={item.id}
                    className={classes}
                    title={t("office.notPromoted")}
                    aria-disabled="true"
                  >
                    <Icon className="size-4 text-[#A2A29C]" aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                  </span>
                );
              }

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={classes}
                >
                  <Icon
                    className={cn(
                      "size-4",
                      active ? "text-[#5F5F59]" : "text-[#85857F]"
                    )}
                    aria-hidden="true"
                  />
                  <span>{t(item.labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center justify-end gap-2 border-b border-[#DDDDD8] bg-[#F7F7F4]/96 px-3 py-2 backdrop-blur md:px-6">
            <div className="min-w-0 flex-1">
              {actions ? (
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {actions}
                </div>
              ) : null}
            </div>
            <LanguageSwitcher className="shrink-0 border-[#D6D6D1] bg-white shadow-none" />
          </header>

          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 lg:px-7">
            <section className="border-b border-[#DADAD5] pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C746B]">
                {t("office.eyebrow")}
              </p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em]">
                {title}
              </h1>
              <p className="mt-1.5 max-w-4xl text-xs leading-5 text-[#74746E]">
                {description}
              </p>
            </section>

            <div className="mt-4">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}
