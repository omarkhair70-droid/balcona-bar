"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { MarketingShell, ML } from "./marketing-shell";
import { ProductVisual } from "./product-visual";

export type MarketingStory = {
  eyebrow: [string, string];
  title: [string, string];
  description: [string, string];
  outcomes: Array<[string, string]>;
  icon?: LucideIcon;
  cta?: [string, string, string];
};

export function MarketingStoryPage({ story }: { story: MarketingStory }) {
  const { locale } = useI18n();
  const Icon = story.icon;
  const cta = story.cta ?? ["/request-demo", "Request a demo", "اطلب عرضًا"];

  return (
    <MarketingShell>
      <main>
        <section className="border-b border-[#D6CFC3]">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-16 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:px-8 lg:py-24">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">
                {Icon ? <Icon className="size-4" /> : null}
                {ML(story.eyebrow[0], story.eyebrow[1], locale)}
              </div>
              <h1 className="mt-5 font-serif text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.9] tracking-[-.06em]">
                {ML(story.title[0], story.title[1], locale)}
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#655E56] sm:text-lg">
                {ML(story.description[0], story.description[1], locale)}
              </p>
              <Link href={cta[0]} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#211D18] px-5 text-sm font-black text-white hover:bg-[#8C512D]">
                {ML(cta[1], cta[2], locale)}
                <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
            </div>
            <ProductVisual />
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 lg:px-8 lg:py-28">
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#8C512D]">{ML("What closes the loop", "ما الذي يقفل الدائرة", locale)}</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {story.outcomes.map(([en, ar]) => (
              <article key={en} className="flex min-h-36 gap-4 rounded-2xl border border-[#D4CCBF] bg-[#FBF8F1] p-6">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#8C512D]" />
                <p className="text-base font-bold leading-7">{ML(en, ar, locale)}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
