"use client";

import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/lib/i18n/i18n-provider";

export function ML(en: string, ar: string, locale: "en" | "ar") {
  return locale === "ar" ? ar : en;
}

const nav = [
  ["/product", "Product", "المنتج"],
  ["/solutions/independent-cafes", "Solutions", "الحلول"],
  ["/pricing", "Pricing", "الأسعار"],
  ["/demo", "Product tour", "جولة المنتج"],
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F2EFE7] text-[#211D18] [--accent:#8C512D] [--background:#F2EFE7] [--border:#D8D0C3] [--foreground:#211D18] [--muted:#E8E2D7] [--muted-foreground:#6E665D] [--primary:#8C512D] [--primary-foreground:#FFF9EF] [--ring:#A8643A] [--surface:#FBF8F1] [--surface-2:#EAE3D8]">
      <header className="sticky top-0 z-50 border-b border-[#D6CFC3]/90 bg-[#F2EFE7]/94 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-[1240px] items-center justify-between gap-5 px-5 lg:px-8">
          <Link href="/" className="flex items-baseline gap-2" aria-label="Balcona home">
            <span className="text-xl font-black tracking-[-.045em]">Balcona</span>
            <span className="hidden text-[9px] font-bold uppercase tracking-[0.16em] text-[#766C62] sm:inline">
              Hospitality OS
            </span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Main navigation">
            {nav.map(([href, en, ar]) => (
              <Link key={href} href={href} className="text-sm font-semibold text-[#554E47] transition hover:text-[#8C512D]">
                {ML(en, ar, locale)}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <LanguageSwitcher />
            <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-bold text-[#4B453F] hover:bg-[#E8E2D7]">
              {ML("Sign in", "تسجيل الدخول", locale)}
            </Link>
            <Link href="/request-demo" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#211D18] px-4 text-sm font-bold text-white shadow-[0_10px_28px_rgba(33,29,24,.16)] hover:bg-[#8C512D]">
              {ML("Request a demo", "اطلب عرضًا", locale)}
              <ArrowUpRight className="size-4 rtl:-scale-x-100" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-lg border border-[#D6CFC3] lg:hidden"
            aria-expanded={open}
            aria-controls="marketing-mobile-navigation"
            aria-label={ML("Toggle navigation", "فتح أو إغلاق التنقل", locale)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {open ? (
          <div id="marketing-mobile-navigation" className="border-t border-[#D6CFC3] px-5 py-4 lg:hidden">
            <nav className="mx-auto grid max-w-[1240px] gap-2" aria-label={ML("Mobile navigation", "تنقل الموبايل", locale)}>
              {nav.map(([href, en, ar]) => (
                <Link key={href} href={href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm font-bold hover:bg-[#E8E2D7]">
                  {ML(en, ar, locale)}
                </Link>
              ))}
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#D6CFC3] pt-4">
                <LanguageSwitcher />
                <Link href="/login" onClick={() => setOpen(false)} className="rounded-lg border border-[#CFC6B8] px-4 py-2 text-sm font-bold">
                  {ML("Sign in", "الدخول", locale)}
                </Link>
                <Link href="/request-demo" onClick={() => setOpen(false)} className="rounded-lg bg-[#211D18] px-4 py-2 text-sm font-bold text-white">
                  {ML("Request a demo", "اطلب عرضًا", locale)}
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      {children}

      <footer className="border-t border-[#D6CFC3] bg-[#E9E3D8]">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-10 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div>
            <p className="text-lg font-black">Balcona</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-[#6E665D]">
              {ML("One connected operating system for the guest, the floor, the kitchen and the back office.", "نظام تشغيل واحد يربط الضيف والصالة والمطبخ والإدارة.", locale)}
            </p>
          </div>
          <div className="grid content-start gap-2 text-sm font-semibold text-[#625A52]">
            <Link href="/product">{ML("Product", "المنتج", locale)}</Link>
            <Link href="/product/multi-location">{ML("Multi-location", "تعدد الفروع", locale)}</Link>
            <Link href="/solutions/multi-branch">{ML("Multi-branch operators", "مشغلو الفروع المتعددة", locale)}</Link>
            <Link href="/demo">{ML("Product tour", "جولة المنتج", locale)}</Link>
            <Link href="/pricing">{ML("Pricing", "الأسعار", locale)}</Link>
          </div>
          <div className="grid content-start gap-2 text-sm font-semibold text-[#625A52]">
            <Link href="/support">{ML("Support", "الدعم", locale)}</Link>
            <Link href="/login">{ML("Sign in", "تسجيل الدخول", locale)}</Link>
            <Link href="/request-demo">{ML("Request a demo", "اطلب عرضًا", locale)}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
