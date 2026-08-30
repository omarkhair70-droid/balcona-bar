"use client";

import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n-provider";
import { ML } from "./marketing-shell";

export type ProductSurface =
  | "guest"
  | "service"
  | "kitchen"
  | "office"
  | "setup";

const previews: Record<
  ProductSurface,
  {
    label: [string, string];
    href: string;
    previewHref: string;
    description: [string, string];
  }
> = {
  guest: {
    label: ["Guest", "الضيف"],
    href: "/product/guest-experience",
    previewHref: "/prototype/guest",
    description: [
      "QR menu, ordering, service and bill journey",
      "رحلة QR والمنيو والطلب والخدمة والفاتورة"
    ]
  },
  service: {
    label: ["Service", "الخدمة"],
    href: "/product/service",
    previewHref: "/prototype/service",
    description: [
      "Live floor attention, orders and payments",
      "تنبيهات الصالة والطلبات والمدفوعات مباشرة"
    ]
  },
  kitchen: {
    label: ["Kitchen", "المطبخ"],
    href: "/product/kitchen",
    previewHref: "/prototype/kitchen",
    description: [
      "Production tasks and kitchen readiness",
      "مهام التحضير وجاهزية المطبخ"
    ]
  },
  office: {
    label: ["Office", "الإدارة"],
    href: "/product/office",
    previewHref: "/prototype/office/home",
    description: [
      "Operational control, money and insight",
      "التحكم التشغيلي والأموال والتحليلات"
    ]
  },
  setup: {
    label: ["Setup", "التجهيز"],
    href: "/product/setup",
    previewHref: "/prototype/setup",
    description: [
      "Finite path from tenant to service-ready branch",
      "مسار واضح من الحساب إلى فرع جاهز للخدمة"
    ]
  }
};

export function ProductVisual({
  initialSurface = "service"
}: {
  initialSurface?: ProductSurface;
}) {
  const { locale } = useI18n();
  const [surface, setSurface] = useState<ProductSurface>(initialSurface);
  const preview = previews[surface];

  return (
    <div className="overflow-hidden rounded-[28px] border border-[#49372A] bg-[#17120F] text-[#FFF8ED] shadow-[0_36px_90px_rgba(43,32,24,.28)]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <MonitorSmartphone className="size-4 shrink-0 text-[#D99B60]" />
            <span className="truncate text-[11px] font-black uppercase tracking-[.13em] text-white/65">
              {ML("Approved Balcona product preview", "معاينة معتمدة لمنتج بلكونة", locale)}
            </span>
          </div>
          <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/50">
            {ML("Read-only", "للمعاينة", locale)}
          </span>
        </div>

        <div
          className="no-scrollbar flex gap-1.5 overflow-x-auto"
          aria-label={ML("Choose product surface preview", "اختر واجهة المنتج للمعاينة", locale)}
        >
          {(Object.keys(previews) as ProductSurface[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={surface === key}
              onClick={() => setSurface(key)}
              className={`min-h-9 shrink-0 rounded-lg border px-3 text-[11px] font-bold transition ${
                surface === key
                  ? "border-[#D99B60] bg-[#D99B60] text-[#17120F]"
                  : "border-white/10 bg-white/[.035] text-white/65 hover:bg-white/[.08] hover:text-white"
              }`}
            >
              {ML(previews[key].label[0], previews[key].label[1], locale)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[430px] overflow-hidden bg-[#0F0C0A] sm:h-[500px]">
        <iframe
          key={preview.previewHref}
          src={preview.previewHref}
          title={ML(
            `Balcona ${preview.label[0]} product preview`,
            `معاينة واجهة ${preview.label[1]} في بلكونة`,
            locale
          )}
          className="h-full w-full border-0 bg-[#120D0A]"
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          style={{ pointerEvents: "none" }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#17120F] to-transparent" />
      </div>

      <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-sm font-black">
            {ML(preview.label[0], preview.label[1], locale)}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-white/50">
            {ML(preview.description[0], preview.description[1], locale)}
          </p>
        </div>
        <Link
          href={preview.href}
          className="inline-flex min-h-9 items-center justify-center rounded-lg border border-white/15 px-3 text-[11px] font-black text-white hover:bg-white/10"
        >
          {ML("Explore this surface", "استكشف الواجهة", locale)}
        </Link>
      </div>
    </div>
  );
}
