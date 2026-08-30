"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  ChefHat,
  ClipboardCheck,
  LayoutDashboard,
  Radio,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";
import { ProductVisual } from "./product-visual";

const operatingSurfaces = [
  [
    "/product/guest-experience",
    Smartphone,
    "Guest",
    "الضيف",
    "QR ordering, live order status, service, bill and a menu-grounded AI waiter.",
    "طلب QR، حالة مباشرة، خدمة، فاتورة ونادل AI مرتبط بالمنيو.",
  ],
  [
    "/product/service",
    Radio,
    "Service",
    "الخدمة",
    "A shared floor for orders, attention, bills, payments and the shift.",
    "أرضية تشغيل موحدة للطلبات والتنبيهات والفواتير والمدفوعات والوردية.",
  ],
  [
    "/product/kitchen",
    ChefHat,
    "Kitchen",
    "المطبخ",
    "A high-contrast production board driven by real preparation tasks.",
    "لوحة تحضير عالية الوضوح مبنية على مهام تشغيل حقيقية.",
  ],
  [
    "/product/office",
    LayoutDashboard,
    "Office",
    "الإدارة",
    "Operations, catalog, stock, money, insights and experience control.",
    "العمليات والمنيو والمخزون والأموال والتحليلات والتحكم بالتجربة.",
  ],
  [
    "/product/setup",
    ClipboardCheck,
    "Setup",
    "التجهيز",
    "A finite readiness path from a blank tenant to a service-ready café.",
    "مسار جاهزية واضح من حساب جديد إلى كافيه جاهز للتشغيل.",
  ],
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
                {ML(
                  "Balcona connects the guest order, the service floor, kitchen production and management decisions in one live operating system.",
                  "بلكونة تربط طلب الضيف بالخدمة وتحضير المطبخ وقرارات الإدارة داخل نظام تشغيل مباشر واحد.",
                  locale,
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/request-demo" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]">
                  {ML("Request a live demo", "اطلب عرضًا مباشرًا", locale)}
                  <ArrowRight className="size-4 rtl:rotate-180" />
                </Link>
                <Link href="/demo" className="inline-flex min-h-12 items-center rounded-xl border border-[#CFC6B8] bg-[#FBF8F1] px-5 text-sm font-black hover:bg-white">
                  {ML("Take the product tour", "شاهد جولة المنتج", locale)}
                </Link>
              </div>
            </div>
            <ProductVisual />
          </div>
        </section>

        <section className="border-b border-[#D6CFC3] bg-[#211D18] text-[#FFF8ED]">
          <div className="mx-auto max-w-[1240px] px-5 py-7 lg:px-8">
            <p className="text-[10px] font-black uppercase tracking-[.15em] text-white/45">
              {ML("One shared operating state", "حالة تشغيل واحدة مشتركة", locale)}
            </p>
            <div className="no-scrollbar mt-4 flex items-center gap-3 overflow-x-auto pb-1">
              {operatingSurfaces.map(([href, , enTitle, arTitle], index) => (
                <div key={href} className="flex shrink-0 items-center gap-3">
                  <Link href={href} className="text-sm font-black text-white hover:text-[#E0B18B]">
                    {ML(enTitle, arTitle, locale)}
                  </Link>
                  {index < operatingSurfaces.length - 1 ? (
                    <ArrowRight className="size-3.5 text-white/30 rtl:rotate-180" aria-hidden="true" />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-[.65fr_1.35fr]">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">
                {ML("The operating system", "نظام التشغيل", locale)}
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em]">
                {ML("The order moves. The context stays.", "الطلب يتحرك. والسياق يفضل واحد.", locale)}
              </h2>
              <p className="mt-6 max-w-md text-sm leading-7 text-[#6B635B]">
                {ML(
                  "Each team gets the density and controls it needs, while orders, permissions, realtime events and business state remain connected underneath.",
                  "كل فريق ياخد الكثافة والتحكم اللي محتاجهم، بينما الطلبات والصلاحيات والأحداث المباشرة وحالة النشاط تفضل مترابطة تحتهم.",
                  locale,
                )}
              </p>
            </div>

            <div className="border-y border-[#D6CFC3]">
              {operatingSurfaces.map(([href, Icon, enTitle, arTitle, enBody, arBody], index) => (
                <Link
                  key={href}
                  href={href}
                  className="group grid gap-4 border-b border-[#D6CFC3] py-7 last:border-b-0 sm:grid-cols-[54px_48px_150px_1fr_auto] sm:items-center"
                >
                  <span className="font-serif text-3xl text-[#B5A998]">0{index + 1}</span>
                  <span className="grid size-10 place-items-center rounded-xl bg-[#E9DFD1] text-[#8C512D]">
                    <Icon className="size-4.5" />
                  </span>
                  <strong className="text-base">{ML(enTitle, arTitle, locale)}</strong>
                  <span className="text-sm leading-6 text-[#6D655D]">{ML(enBody, arBody, locale)}</span>
                  <ArrowRight className="size-4 text-[#8C512D] transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
                </Link>
              ))}
            </div>
          </div>

          <Link
            href="/product/multi-location"
            className="group mt-10 grid gap-6 rounded-[24px] border border-[#CBBEAC] bg-[#E9E1D5] p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center lg:p-8"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-[#211D18] text-[#FFF8ED]">
              <Building2 className="size-5" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.13em] text-[#8C512D]">
                {ML("When one branch becomes many", "لما فرع واحد يبقى فروع", locale)}
              </p>
              <h3 className="mt-2 text-xl font-black">
                {ML("Keep company-wide truth without losing branch control.", "حافظ على حقيقة الشركة من غير ما تفقد تحكم كل فرع.", locale)}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#675E55]">
                {ML(
                  "Multi-location support keeps permissions and operations branch-scoped while company configuration and visibility stay connected.",
                  "تعدد الفروع يحافظ على صلاحيات وتشغيل كل فرع بشكل مستقل، مع بقاء إعدادات ورؤية الشركة مترابطة.",
                  locale,
                )}
              </p>
            </div>
            <ArrowRight className="size-5 text-[#8C512D] transition group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1" />
          </Link>
        </section>

        <section className="bg-[#DDD4C6]">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <Sparkles className="size-6 text-[#8C512D]" />
              <h2 className="mt-5 font-serif text-5xl font-semibold leading-[.95] tracking-[-.04em]">
                {ML("Automation stays accountable to operations.", "الأتمتة تفضل مسؤولة أمام التشغيل.", locale)}
              </h2>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#655E56]">
                {ML(
                  "Balcona only presents AI and automation where the product already has real operational grounding and controls.",
                  "بلكونة تعرض الـAI والأتمتة فقط في الأماكن اللي المنتج فيها عنده أساس تشغيلي وتحكم حقيقي.",
                  locale,
                )}
              </p>
            </div>
            <div className="grid gap-3">
              {[
                [Bot, "AI suggests. Your menu and rules decide.", "الـAI يقترح، والمنيو والقواعد يقرروا."],
                [Radio, "Realtime attention joins guest intent to the floor.", "التنبيه المباشر يربط طلب الضيف بالصالة."],
                [ClipboardCheck, "Readiness is measured before a café goes live.", "الجاهزية تُقاس قبل تشغيل الكافيه."],
              ].map(([Icon, en, ar]) => {
                const ItemIcon = Icon as typeof Bot;
                return (
                  <div key={String(en)} className="flex gap-4 rounded-2xl border border-[#C9BEAF] bg-[#E8E1D6] p-5">
                    <ItemIcon className="mt-1 size-5 shrink-0 text-[#8C512D]" />
                    <p className="text-base font-bold leading-7">{ML(en as string, ar as string, locale)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="rounded-[30px] bg-[#8C512D] px-6 py-14 text-[#FFF8ED] sm:px-12 lg:flex lg:items-end lg:justify-between lg:gap-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-white/65">
                {ML("See Balcona in your operation", "شاهد بلكونة في تشغيلك", locale)}
              </p>
              <h2 className="mt-4 max-w-3xl font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em]">
                {ML("Bring one branch. We’ll map the complete service flow.", "هات فرعًا واحدًا، ونرسم مسار الخدمة كاملًا.", locale)}
              </h2>
            </div>
            <Link href="/request-demo" className="mt-8 inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-[#FFF8ED] px-5 text-sm font-black text-[#211D18] lg:mt-0">
              {ML("Request a demo", "اطلب عرضًا", locale)}
              <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
