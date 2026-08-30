"use client";

import { Bell, ChefHat, Clock3, CreditCard, Sparkles, Utensils } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { ML } from "./marketing-shell";

export function ProductVisual() {
  const { locale } = useI18n();

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[#49372A] bg-[#17120F] p-3 text-[#FFF8ED] shadow-[0_36px_90px_rgba(43,32,24,.28)] sm:p-5">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#78B77A] shadow-[0_0_12px_#78B77A]" />
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">{ML("Live service", "خدمة مباشرة", locale)}</span>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/55">Zamalek · 08:42 PM</span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[.8fr_1.2fr_.85fr]">
        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold">{ML("Attention", "التنبيهات", locale)}</p>
            <Bell className="size-4 text-[#E0A45F]" />
          </div>
          <div className="mt-4 space-y-2">
            {[["T12", ML("Bill requested", "طلب الفاتورة", locale), "2m"], ["T04", ML("Order ready", "الطلب جاهز", locale), "1m"], ["T09", ML("Needs a waiter", "يحتاج نادلًا", locale), "now"]].map(([table, label, time], index) => (
              <div key={table} className={`rounded-xl border p-3 ${index === 0 ? "border-[#B66E3D]/70 bg-[#8C512D]/20" : "border-white/10 bg-black/15"}`}>
                <div className="flex items-center justify-between"><span className="text-sm font-black">{table}</span><span className="text-[10px] text-white/45">{time}</span></div>
                <p className="mt-2 text-[11px] text-white/65">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#201914] p-4">
          <div className="flex items-center justify-between">
            <div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#D99B60]">{ML("Kitchen", "المطبخ", locale)}</p><h2 className="mt-1 text-xl font-black">{ML("Production board", "لوحة التحضير", locale)}</h2></div>
            <ChefHat className="size-5 text-white/55" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[ML("New", "جديد", locale), ML("Preparing", "قيد التحضير", locale), ML("Ready", "جاهز", locale)].map((column, columnIndex) => (
              <div key={column}>
                <div className="mb-2 flex items-center justify-between text-[10px] font-bold text-white/55"><span>{column}</span><span>{columnIndex + 1}</span></div>
                {[0, 1].slice(0, columnIndex === 1 ? 2 : 1).map((item) => (
                  <article key={item} className={`mb-2 rounded-xl border p-3 ${columnIndex === 1 ? "border-[#D09050]/70 bg-[#3B281B]" : "border-white/10 bg-black/20"}`}>
                    <div className="flex justify-between gap-2"><strong className="text-xs">#{117 + item}</strong><Clock3 className="size-3.5 text-white/45" /></div>
                    <p className="mt-3 text-sm font-bold">{item ? "Spanish Latte" : "Flat White"}</p>
                    <p className="mt-1 text-[10px] text-white/45">{ML("Oat milk · hot", "حليب شوفان · ساخن", locale)}</p>
                  </article>
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[.035] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[.13em] text-white/45">{ML("Today", "اليوم", locale)}</p>
          <p className="mt-2 text-3xl font-black tracking-[-.05em]">EGP 18,420</p>
          <p className="mt-1 text-[11px] text-[#88C489]">+12.4% {ML("vs. last Sunday", "مقابل الأحد الماضي", locale)}</p>
          <div className="mt-5 grid gap-2">
            {[[Utensils, ML("Orders", "الطلبات", locale), "86"], [CreditCard, ML("Paid bills", "فواتير مدفوعة", locale), "73"], [Sparkles, ML("AI assists", "مساعدات AI", locale), "21"]].map(([Icon, label, value]) => {
              const RowIcon = Icon as typeof Utensils;
              return <div key={String(label)} className="flex items-center justify-between rounded-xl border border-white/10 p-3"><span className="flex items-center gap-2 text-[11px] text-white/60"><RowIcon className="size-3.5" />{label as string}</span><strong className="text-sm">{value as string}</strong></div>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
