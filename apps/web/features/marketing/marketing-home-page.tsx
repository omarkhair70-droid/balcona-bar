"use client";

import Link from "next/link";
import { ArrowRight, Bot, Building2, ChefHat, ClipboardCheck, LayoutDashboard, Radio, Smartphone, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";
import { ProductVisual } from "./product-visual";

const surfaces = [
  ["/product/guest-experience", Smartphone, "Guest", "الضيف", "QR ordering, live order status, service, bill and a menu-grounded AI waiter.", "طلب QR، حالة مباشرة، خدمة، فاتورة ونادل AI مرتبط بالمنيو."],
  ["/product/service", Radio, "Service", "الخدمة", "A shared floor for orders, attention, bills, payments and the shift.", "أرضية تشغيل موحدة للطلبات والتنبيهات والفواتير والمدفوعات والوردية."],
  ["/product/kitchen", ChefHat, "Kitchen", "المطبخ", "A high-contrast production board driven by real preparation tasks.", "لوحة تحضير عالية الوضوح مبنية على مهام تشغيل حقيقية."],
  ["/product/office", LayoutDashboard, "Office", "الإدارة", "Operations, catalog, stock, money, insights and experience control.", "العمليات والمنيو والمخزون والأموال والتحليلات والتحكم بالتجربة."],
  ["/product/setup", ClipboardCheck, "Setup", "التجهيز", "A finite readiness path from a blank tenant to a service-ready café.", "مسار جاهزية واضح من حساب جديد إلى كافيه جاهز للتشغيل."],
  ["/product/multi-location", Building2, "Multi-location", "تعدد الفروع", "Company-wide visibility with branch-scoped control and permissions.", "رؤية على مستوى الشركة وتحكم وصلاحيات محددة لكل فرع."],
] as const;

export function MarketingHomePage() {
  const { locale } = useI18n();

  return (
    <MarketingShell>
      <main>
        <section className="overflow-hidden border-b border-[#D6CFC3]">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 pb-16 pt-16 lg:grid-cols-[.82fr_1.18fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-24">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D3C6B6] bg-[#FBF8F1] px-3 py-1.5 text-[11px] font-black uppercase tracking-[.12em] text-[#76533A]">
                <span className="size-1.5 rounded-full bg-[#8C512D]" />
                {ML("Hospitality, in one operating rhythm", "الضيافة بإيقاع تشغيل واحد", locale)}
              </div>
              <h1 className="mt-7 max-w-[720px] font-serif text-[clamp(3.2rem,7vw,6.9rem)] font-semibold leading-[.86] tracking-[-.065em] text-[#211D18]">
                {ML("Run the whole café. Not six disconnected screens.", "شغّل الكافيه كله. مش ست شاشات منفصلة.", locale)}
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#655E56] sm:text-lg">
                {ML("Balcona connects the guest order, the service floor, kitchen production and management decisions in one live operating system.", "بلكونة تربط طلب الضيف بالخدمة وتحضير المطبخ وقرارات الإدارة داخل نظام تشغيل مباشر واحد.", locale)}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/request-demo" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]">
                  {ML("Request a live demo", "اطلب عرضًا مباشرًا", locale)}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
                <Link href="/demo" className="inline-flex min-h-12 items-center rounded-xl border border-[#CFC6B8] bg-[#FBF8F1] px-5 text-sm font-black hover:bg-white">
                  {ML("Explore the product", "استكشف المنتج", locale)}
                </Link>
              </div>
            </div>
            <ProductVisual />
          </div>
        </section>

        <section className="border-b border-[#D6CFC3] bg-[#211D18] text-[#FFF8ED]">
          <div className="mx-auto grid max-w-[1240px] gap-px bg-white/10 md:grid-cols-3">
            {[["6", "connected product surfaces", "أسطح منتج مترابطة"], ["2", "languages across the product", "لغتان في المنتج كله"], ["1", "live order-to-operations flow", "مسار مباشر من الطلب للتشغيل"]].map(([value, en, ar]) => (
              <div key={value + en} className="bg-[#211D18] px-6 py-8 lg:px-8"><strong className="font-serif text-5xl">{value}</strong><p className="mt-2 text-xs font-bold uppercase tracking-[.12em] text-white/55">{ML(en, ar, locale)}</p></div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-6 lg:grid-cols-[.7fr_1.3fr] lg:items-end">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">{ML("The operating system", "نظام التشغيل", locale)}</p><h2 className="mt-4 font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em]">{ML("Every role sees the work that matters now.", "كل دور يرى العمل المهم الآن.", locale)}</h2></div>
            <p className="max-w-2xl text-base leading-8 text-[#6B635B] lg:justify-self-end">{ML("Each surface has its own density, urgency and interaction grammar. They share the same orders, permissions, realtime events and business truth.", "لكل سطح كثافته وسرعته وطريقة تفاعله، لكنهم يشتركون في نفس الطلبات والصلاحيات والأحداث المباشرة وحقيقة النشاط.", locale)}</p>
          </div>
          <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {surfaces.map(([href, Icon, enTitle, arTitle, enBody, arBody], index) => (
              <Link key={href} href={href} className="group min-h-64 rounded-[22px] border border-[#D4CCBF] bg-[#FBF8F1] p-6 transition hover:-translate-y-1 hover:border-[#A98972] hover:shadow-[0_24px_60px_rgba(57,42,30,.12)]">
                <div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-[#E9DFD1] text-[#8C512D]"><Icon className="size-5" /></span><span className="font-serif text-3xl text-[#B9AD9D]">0{index + 1}</span></div>
                <h3 className="mt-8 text-xl font-black">{ML(enTitle, arTitle, locale)}</h3>
                <p className="mt-3 text-sm leading-7 text-[#6D655D]">{ML(enBody, arBody, locale)}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[.1em] text-[#8C512D]">{ML("See the surface", "شاهد السطح", locale)} <ArrowRight className="size-3.5 transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-[#DDD4C6]">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div><Sparkles className="size-6 text-[#8C512D]" /><h2 className="mt-5 font-serif text-5xl font-semibold leading-[.95] tracking-[-.04em]">{ML("Automation stays accountable to operations.", "الأتمتة تفضل مسؤولة أمام التشغيل.", locale)}</h2></div>
            <div className="grid gap-3">
              {[[Bot, "AI suggests. Your menu and rules decide.", "الـAI يقترح، والمنيو والقواعد يقرروا."], [Radio, "Realtime attention joins guest intent to the floor.", "التنبيه المباشر يربط طلب الضيف بالصالة."], [ClipboardCheck, "Readiness is measured before a café goes live.", "الجاهزية تُقاس قبل تشغيل الكافيه."]].map(([Icon, en, ar]) => {
                const ItemIcon = Icon as typeof Bot;
                return <div key={String(en)} className="flex gap-4 rounded-2xl border border-[#C9BEAF] bg-[#E8E1D6] p-5"><ItemIcon className="mt-1 size-5 shrink-0 text-[#8C512D]" /><p className="text-base font-bold leading-7">{ML(en as string, ar as string, locale)}</p></div>;
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="rounded-[30px] bg-[#8C512D] px-6 py-14 text-[#FFF8ED] sm:px-12 lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div><p className="text-xs font-black uppercase tracking-[.14em] text-white/65">{ML("See Balcona in your operation", "شاهد بلكونة في تشغيلك", locale)}</p><h2 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em]">{ML("Bring one branch. We’ll map the complete service flow.", "هات فرعًا واحدًا، ونرسم مسار الخدمة كاملًا.", locale)}</h2></div>
            <Link href="/request-demo" className="mt-8 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#FFF8ED] px-5 text-sm font-black text-[#211D18] lg:mt-0">{ML("Request a demo", "اطلب عرضًا", locale)} <ArrowRight className="size-4 rtl:rotate-180" /></Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
