"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Languages } from "lucide-react";
import { type ReactNode } from "react";
import { useI18n, useTranslations } from "@/lib/i18n/i18n-provider";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { getPlatformNavItems } from "./platform-navigation";

type PlatformShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  supporting?: ReactNode;
  children: ReactNode;
};

export function PlatformShell({
  title,
  description,
  actions,
  supporting,
  children
}: PlatformShellProps) {
  const pathname = usePathname();
  const t = useTranslations("platform");
  const { locale, setLocale, dir } = useI18n();
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const navItems = getPlatformNavItems(Boolean(accessToken)).map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label
  }));

  return (
    <div dir={dir} className="min-h-screen bg-[#F3F3F0] text-[#20201D]">
      <div className="grid min-h-screen min-w-0 lg:grid-cols-[210px_minmax(0,1fr)]">
        <aside className="min-w-0 overflow-hidden border-b border-[#D6D6D1] bg-[#EAEAE6] px-3 py-3 lg:overflow-visible lg:border-b-0 lg:border-e lg:py-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-8 items-center justify-center rounded-md bg-[#292925] text-xs font-black text-white">
              B
            </div>
            <div>
              <p className="text-sm font-semibold">Balcona</p>
              <p className="text-[10px] text-[#777771]">Platform</p>
            </div>
          </div>

          <nav
            className="mt-3 flex w-full min-w-0 max-w-full gap-1 overflow-x-auto pb-1 lg:mt-7 lg:grid lg:gap-0.5 lg:overflow-visible lg:pb-0"
            aria-label="Platform"
          >
            {navItems.map((item) => {
              const exact = item.href === "/platform";
              const active = exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-9 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition lg:shrink lg:text-sm ${
                    active
                      ? "bg-white font-semibold text-[#20201D] shadow-[0_1px_0_rgba(0,0,0,.03)]"
                      : "text-[#64645E] hover:bg-[#E1E1DC]"
                  }`}
                >
                  {item.icon}
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 hidden border-t border-[#D1D1CC] pt-4 lg:block">
            <p className="px-2 text-[9px] font-semibold uppercase tracking-[.14em] text-[#868680]">
              {locale === "ar" ? "إدارة داخلية فقط" : "INTERNAL ADMIN ONLY"}
            </p>
            <p className="mt-2 px-2 text-[10px] leading-5 text-[#777771]">
              {locale === "ar"
                ? "هوية Platform منفصلة عن حسابات موظفي المطاعم."
                : "Platform identity is separate from restaurant staff auth."}
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-[#D9D9D4] bg-[#F8F8F5] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-[1500px] flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#7A746D]">
                  BALCONA PLATFORM · {locale === "ar" ? "عمليات SaaS داخلية" : "INTERNAL SAAS OPS"}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">
                  {title}
                </h1>
                <p className="mt-1.5 max-w-3xl text-xs leading-5 text-[#777771] sm:text-sm">
                  {description}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {actions}
                <button
                  type="button"
                  onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold text-[#4D4D48]"
                >
                  <Languages className="size-4" aria-hidden="true" />
                  {locale === "en" ? "العربية" : "EN"}
                </button>
              </div>
            </div>
          </header>

          <main className="mx-auto grid max-w-[1500px] gap-4 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            {supporting ? (
              <section className="rounded-lg border border-[#D9D9D4] bg-white p-4">
                {supporting}
              </section>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
