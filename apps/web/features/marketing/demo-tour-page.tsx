"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, PlayCircle } from "lucide-react";
import { getDemoSandboxHref } from "@/lib/config/env";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";
import { ProductVisual } from "./product-visual";

const tour = [
  ["/product/guest-experience", "Guest", "الضيف", "Scan, menu, order, service and bill.", "QR والمنيو والطلب والخدمة والفاتورة."],
  ["/product/service", "Service", "الخدمة", "The floor receives the same order and attention state.", "الصالة تستقبل نفس الطلب وحالة التنبيه."],
  ["/product/kitchen", "Kitchen", "المطبخ", "Preparation becomes explicit production work.", "الطلب يتحول لمهام تحضير واضحة."],
  ["/product/office", "Office", "الإدارة", "Operations, money and decisions close the loop.", "التشغيل والأموال والقرارات تقفل الدائرة."],
  ["/product/setup", "Setup", "التجهيز", "Readiness makes the branch launchable.", "الجاهزية تجعل الفرع قابلًا للتشغيل."]
] as const;

export function DemoTourPage() {
  const { locale } = useI18n();
  const sandboxHref = getDemoSandboxHref();

  return (
    <MarketingShell>
      <main>
        <section className="border-b border-[#D6CFC3]">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">
                <PlayCircle className="size-4" />
                {ML("Product tour", "جولة المنتج", locale)}
              </div>
              <h1 className="mt-5 font-serif text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.9] tracking-[-.06em]">
                {ML("Follow one order through the whole operation.", "تابع طلبًا واحدًا عبر التشغيل كله.", locale)}
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#655E56] sm:text-lg">
                {ML(
                  "See how Guest, Service, Kitchen, Office and Setup share one operating truth. The preview uses approved Balcona product screens and does not pretend to be an isolated sandbox.",
                  "شوف إزاي الضيف والخدمة والمطبخ والإدارة والتجهيز بيشاركوا نفس حقيقة التشغيل. المعاينة تستخدم شاشات بلكونة المعتمدة ومش بتدّعي إنها Sandbox معزول.",
                  locale
                )}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {sandboxHref ? (
                  <a
                    href={sandboxHref}
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]"
                  >
                    {ML("Try Balcona Demo", "جرّب Demo بلكونة", locale)}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </a>
                ) : (
                  <Link
                    href="/request-demo"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]"
                  >
                    {ML("Request a live demo", "اطلب عرضًا مباشرًا", locale)}
                    <ArrowRight className="size-4 rtl:rotate-180" />
                  </Link>
                )}
                <Link
                  href="/product"
                  className="inline-flex min-h-12 items-center rounded-xl border border-[#CFC6B8] bg-[#FBF8F1] px-5 text-sm font-black hover:bg-white"
                >
                  {ML("Explore the product", "استكشف المنتج", locale)}
                </Link>
              </div>

              {!sandboxHref ? (
                <div className="mt-6 flex max-w-xl gap-3 rounded-xl border border-[#D7CDBF] bg-[#EAE3D8] p-4 text-xs leading-6 text-[#61584F]">
                  <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[#8C512D]" />
                  <p>
                    {ML(
                      "Self-serve access appears only after an isolated seeded demo tenant is provisioned. Until then, the public route stays a truthful product tour.",
                      "الدخول الذاتي يظهر فقط بعد تجهيز Demo tenant معزول ومعبأ ببيانات تجريبية. لحد وقتها المسار العام يفضل جولة منتج صادقة.",
                      locale
                    )}
                  </p>
                </div>
              ) : null}
            </div>

            <ProductVisual initialSurface="guest" />
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <div className="grid gap-8 lg:grid-cols-[.62fr_1.38fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">
                {ML("One connected journey", "رحلة واحدة مترابطة", locale)}
              </p>
              <h2 className="mt-4 font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em]">
                {ML("Five surfaces. One operating state.", "خمس واجهات. حالة تشغيل واحدة.", locale)}
              </h2>
            </div>

            <div className="border-y border-[#D6CFC3]">
              {tour.map(([href, enTitle, arTitle, enBody, arBody], index) => (
                <Link
                  key={href}
                  href={href}
                  className="group grid gap-4 border-b border-[#D6CFC3] px-1 py-6 last:border-b-0 sm:grid-cols-[56px_150px_1fr_auto] sm:items-center"
                >
                  <span className="font-serif text-3xl text-[#B2A696]">0{index + 1}</span>
                  <strong className="text-base">{ML(enTitle, arTitle, locale)}</strong>
                  <span className="text-sm leading-6 text-[#6B635B]">{ML(enBody, arBody, locale)}</span>
                  <CheckCircle2 className="size-4 text-[#8C512D] transition group-hover:scale-110" />
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
