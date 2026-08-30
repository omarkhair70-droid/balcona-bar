"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";

export function LoginChoicePage() {
  const { locale } = useI18n();
  return <MarketingShell><main className="mx-auto max-w-[900px] px-5 py-16 lg:px-8 lg:py-24"><p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">{ML("Secure access", "دخول آمن", locale)}</p><h1 className="mt-4 font-serif text-6xl font-semibold tracking-[-.055em]">{ML("Choose your workspace.", "اختار مساحة شغلك.", locale)}</h1><p className="mt-5 max-w-2xl text-base leading-8 text-[#655E56]">{ML("Restaurant staff and Balcona Platform operators use separate identities by design.", "فريق المطعم ومشغلو Balcona Platform يستخدموا هويات منفصلة بشكل مقصود.", locale)}</p><div className="mt-10 grid gap-4 md:grid-cols-2">{[["/staff/login", Users, "Restaurant staff", "فريق المطعم", "Cashier, waiter, kitchen, setup and office access.", "دخول الكاشير والويتر والمطبخ والتجهيز والإدارة."], ["/platform/login", ShieldCheck, "Balcona Platform", "Balcona Platform", "Internal tenant, plan, lead and system operations.", "تشغيل داخلي للعملاء والخطط والطلبات وحالة النظام."]].map(([href, Icon, en, ar, enBody, arBody]) => { const AccessIcon = Icon as typeof Users; return <Link key={String(href)} href={String(href)} className="group rounded-2xl border border-[#D4CCBF] bg-[#FBF8F1] p-6 hover:border-[#8C512D]"><AccessIcon className="size-6 text-[#8C512D]" /><h2 className="mt-8 text-xl font-black">{ML(String(en), String(ar), locale)}</h2><p className="mt-2 text-sm leading-7 text-[#655E56]">{ML(String(enBody), String(arBody), locale)}</p><span className="mt-6 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[.1em] text-[#8C512D]">{ML("Continue", "استمر", locale)}<ArrowRight className="size-4 rtl:rotate-180" /></span></Link>; })}</div></main></MarketingShell>;
}
