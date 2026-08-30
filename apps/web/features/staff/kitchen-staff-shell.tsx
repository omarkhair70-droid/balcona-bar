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
      <h1 className="sr-only">{title}</h1>
      <p className="sr-only">{description}</p>

      <header className="sticky top-0 z-40 border-b border-[#34312E] bg-[#12110F]/96 backdrop-blur">
        <div className="flex min-h-14 items-center gap-3 px-3">
          <Link
            href="/kitchen"
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

          <div className="ms-auto flex min-w-0 items-center gap-2">
            {actions}
            <LanguageSwitcher className="shrink-0 border-[#3E3A36] bg-[#1B1917]" />
          </div>
        </div>
      </header>

      {children}
    </main>
  );
}
