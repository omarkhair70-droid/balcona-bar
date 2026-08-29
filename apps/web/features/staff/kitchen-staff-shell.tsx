"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type KitchenStaffShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function KitchenStaffShell({
  title,
  description,
  actions,
  children
}: KitchenStaffShellProps) {
  const t = useTranslations("staff");

  return (
    <main className="min-h-screen bg-[#151412] text-[#FFF8F0]">
      <header className="sticky top-0 z-40 border-b border-[#34312E] bg-[#12110F]/96 backdrop-blur">
        <div className="flex min-h-14 items-center gap-2 px-3">
          <Link
            href="/staff/kitchen"
            className="flex shrink-0 items-center gap-2"
            aria-label={t("kitchen.shellProductLabel")}
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#17110C]">
              B
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold text-[#FFF8F0]">
                {t("kitchen.shellProductLabel")}
              </span>
              <span className="block text-[10px] text-[#8E8882]">
                {t("kitchen.shellSubtitle")}
              </span>
            </span>
          </Link>

          <div className="ms-auto flex items-center gap-2">
            <LanguageSwitcher className="shrink-0 border-[#3E3A36] bg-[#1B1917]" />
          </div>
        </div>

        {actions ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#282522] px-3 py-2">
            {actions}
          </div>
        ) : null}
      </header>

      <section className="border-b border-[#302D29] bg-[#171614] px-3 py-4 sm:px-4">
        <div className="mx-auto max-w-[1600px]">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E8780]">
            {t("kitchen.shellEyebrow")}
          </p>
          <h1 className="mt-1 text-xl font-black tracking-[-0.025em] text-[#FFF8F0] sm:text-2xl">
            {title}
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#9B958E] sm:text-sm">
            {description}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-[1600px] p-3 sm:p-4">{children}</div>
    </main>
  );
}
