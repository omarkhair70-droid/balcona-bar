"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Database,
  KeyRound,
  PlayCircle
} from "lucide-react";
import {
  balkonaDemoQrToken,
  balkonaReviewerJourney
} from "@/features/demo/balkona-demo";
import { env, getDemoSandboxHref } from "@/lib/config/env";
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
  const liveReviewerHref =
    sandboxHref ??
    (env.NEXT_PUBLIC_APP_ENV === "staging"
      ? `/guest/table/${balkonaDemoQrToken}`
      : null);

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
                {ML("One order. One system.", "طلب واحد. نظام واحد.", locale)}
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#655E56] sm:text-lg">
                {ML(
                  "See how Guest, Service, Kitchen, Office and Setup share one operating truth. The preview uses approved Balcona product screens and does not pretend to be an isolated sandbox.",
                  "شوف إزاي الضيف والخدمة والمطبخ والإدارة والتجهيز بيشاركوا نفس حقيقة التشغيل. المعاينة تستخدم شاشات بلكونة المعتمدة ومش بتدّعي إنها Sandbox معزول.",
                  locale
                )}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {liveReviewerHref ? (
                  <a
                    href={liveReviewerHref}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]"
                  >
                    {ML("Start the live order", "ابدأ الطلب المباشر", locale)}
                    <ArrowUpRight className="size-4" />
                  </a>
                ) : (
                  <Link
                    href="/request-demo"
                    className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]"
                  >
                    {ML("Request a live demo", "اطلب عرضًا مباشرًا", locale)}
                    <ArrowUpRight className="size-4" />
                  </Link>
                )}
                <a
                  href="#reviewer-journey"
                  className="inline-flex min-h-12 items-center rounded-xl border border-[#CFC6B8] bg-[#FBF8F1] px-5 text-sm font-black hover:bg-white"
                >
                  {ML("Open the reviewer guide", "افتح دليل المراجعة", locale)}
                </a>
              </div>

              {!liveReviewerHref ? (
                <div className="mt-6 flex max-w-xl gap-3 rounded-xl border border-[#D7CDBF] bg-[#EAE3D8] p-4 text-xs leading-6 text-[#61584F]">
                  <KeyRound className="mt-0.5 size-4 shrink-0 text-[#8C512D]" />
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

        <section
          id="reviewer-journey"
          className="scroll-mt-20 border-b border-[#D6CFC3] bg-[#EDE6DB]"
        >
          <div className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[.62fr_1.38fr]">
              <div className="lg:sticky lg:top-8 lg:self-start">
                <p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">
                  {ML("LaunchPad reviewer journey", "رحلة مراجعة LaunchPad", locale)}
                </p>
                <h2 className="mt-4 max-w-md font-serif text-5xl font-semibold leading-[.95] tracking-[-.045em] sm:text-6xl">
                  {ML("Run one real order. See the whole system.", "نفّذ طلبًا حقيقيًا. وشاهد النظام كله.", locale)}
                </h2>
                <p className="mt-6 max-w-md text-sm leading-7 text-[#655E56] sm:text-base">
                  {ML(
                    "Keep this page open and launch each operational surface in a new tab. Every step uses the same seeded Balcona branch and table state.",
                    "اترك هذه الصفحة مفتوحة وافتح كل واجهة تشغيل في تبويب جديد. كل خطوة تستخدم نفس فرع وترابيزة بلكونة التجريبية.",
                    locale
                  )}
                </p>

                <div className="mt-8 grid gap-3 text-xs leading-5 text-[#5D554D]">
                  <div className="flex gap-3 border-t border-[#CFC4B5] pt-4">
                    <Database className="mt-0.5 size-4 shrink-0 text-[#8C512D]" />
                    <p>
                      <strong className="block text-[#211D18]">
                        {ML("Seeded demonstration data", "بيانات عرض تجريبية", locale)}
                      </strong>
                      {ML("Real product records, not customer traction.", "سجلات منتج حقيقية وليست بيانات عملاء أو traction.", locale)}
                    </p>
                  </div>
                  <div className="flex gap-3 border-t border-[#CFC4B5] pt-4">
                    <KeyRound className="mt-0.5 size-4 shrink-0 text-[#8C512D]" />
                    <div>
                      <p>
                        <strong className="block text-[#211D18]">
                          {ML("Private staff access", "دخول فريق خاص", locale)}
                        </strong>
                        {ML("Sign in once with the reviewer credentials supplied privately.", "سجل الدخول مرة واحدة ببيانات المراجع المرسلة بشكل خاص.", locale)}
                      </p>
                      <Link
                        href="/staff/login"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-[#BDAF9E] px-3 font-black text-[#211D18] hover:border-[#8C512D] hover:text-[#8C512D]"
                      >
                        {ML("Open staff sign-in", "افتح دخول الفريق", locale)}
                        <ArrowUpRight className="size-3.5" />
                      </Link>
                    </div>
                  </div>
                  <div className="flex gap-3 border-t border-[#CFC4B5] pt-4">
                    <CircleDollarSign className="mt-0.5 size-4 shrink-0 text-[#8C512D]" />
                    <p>
                      <strong className="block text-[#211D18]">
                        {ML("Test payment only", "دفع تجريبي فقط", locale)}
                      </strong>
                      {ML("No real money is processed in this environment.", "لا يتم خصم أي أموال حقيقية في هذه البيئة.", locale)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-y border-[#CFC4B5]">
                {balkonaReviewerJourney.map((step) => (
                  <article
                    key={step.key}
                    className="group grid gap-4 border-b border-[#CFC4B5] py-6 last:border-b-0 sm:grid-cols-[64px_150px_1fr_auto] sm:items-start sm:gap-5"
                  >
                    <span className="font-serif text-3xl text-[#A3917E]">
                      {step.number}
                    </span>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[.12em] text-[#8C512D]">
                        {ML(step.role[0], step.role[1], locale)}
                      </p>
                      <p className="mt-2 text-[11px] font-bold text-[#7A7066]">
                        {ML(step.outcome[0], step.outcome[1], locale)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-[-.02em] text-[#211D18]">
                        {ML(step.title[0], step.title[1], locale)}
                      </h3>
                      <p className="mt-2 max-w-xl text-sm leading-6 text-[#655E56]">
                        {ML(step.description[0], step.description[1], locale)}
                      </p>
                    </div>
                    <Link
                      href={step.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={ML(
                        `Open step ${step.number}: ${step.title[0]}`,
                        `افتح الخطوة ${step.number}: ${step.title[1]}`,
                        locale
                      )}
                      className="inline-flex size-11 items-center justify-center rounded-full border border-[#BDAF9E] text-[#211D18] transition hover:border-[#8C512D] hover:bg-[#8C512D] hover:text-white"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </article>
                ))}
              </div>
            </div>
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
