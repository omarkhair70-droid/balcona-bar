"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BookOpenText,
  Building2,
  Check,
  ChefHat,
  Circle,
  CreditCard,
  Languages,
  MapPinned,
  QrCode,
  Rocket,
  Settings2,
  Sparkles,
  UsersRound
} from "lucide-react";
import { type ReactNode } from "react";
import type {
  BranchOnboardingResult,
  TenantOnboardingLaunchSummary,
  TenantOnboardingReadinessStatus
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";

type PhaseState = "ready" | "needs_attention" | "blocked" | "missing";

type SetupReadinessFrameProps = {
  onboarding: BranchOnboardingResult;
  launchSummary?: TenantOnboardingLaunchSummary;
  children: ReactNode;
};

function L(locale: "en" | "ar", en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function normalizeState(status?: TenantOnboardingReadinessStatus): PhaseState {
  if (status === "ready" || status === "blocked" || status === "needs_attention") {
    return status;
  }

  return "missing";
}

function aggregateStatuses(statuses: Array<TenantOnboardingReadinessStatus | undefined>): PhaseState {
  const normalized = statuses.map(normalizeState);

  if (normalized.includes("blocked")) {
    return "blocked";
  }

  if (normalized.every((status) => status === "ready")) {
    return "ready";
  }

  if (normalized.includes("needs_attention")) {
    return "needs_attention";
  }

  return "missing";
}

function StateMark({ state }: { state: PhaseState }) {
  if (state === "ready") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-[#365B3B] text-white">
        <Check className="size-3" aria-hidden="true" />
      </span>
    );
  }

  if (state === "blocked") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-[#8B4038] text-white">
        <AlertTriangle className="size-3" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-[#B88943] bg-[#FFF8EB]">
      <Circle className="size-2.5 fill-[#B88943] text-[#B88943]" aria-hidden="true" />
    </span>
  );
}

function phaseStatusFromKeys(
  onboarding: BranchOnboardingResult,
  keys: string[]
): PhaseState {
  const items = keys
    .map((key) => onboarding.launchChecklist.find((item) => item.key === key))
    .filter(Boolean);

  if (items.length === 0) {
    return "missing";
  }

  return aggregateStatuses(items.map((item) => item?.status));
}

export function SetupReadinessFrame({
  onboarding,
  launchSummary,
  children
}: SetupReadinessFrameProps) {
  const { locale, setLocale, dir } = useI18n();

  const phases = [
    {
      label: L(locale, "Business", "الشركة"),
      href: "#setup-foundation",
      icon: Building2,
      state: phaseStatusFromKeys(onboarding, ["company_profile", "branch_profile"])
    },
    {
      label: L(locale, "Locations", "الفروع"),
      href: "#setup-foundation",
      icon: MapPinned,
      state: onboarding.tables.floorCount > 0 ? "ready" as const : "needs_attention" as const
    },
    {
      label: L(locale, "Menu", "المنيو"),
      href: "/staff/menu",
      icon: BookOpenText,
      state: phaseStatusFromKeys(onboarding, [
        "menu_categories_ready",
        "menu_items_ready",
        "modifiers_ready",
        "inventory_foundation_ready"
      ])
    },
    {
      label: L(locale, "Tables & QR", "الترابيزات وQR"),
      href: "#setup-tables",
      icon: QrCode,
      state: phaseStatusFromKeys(onboarding, [
        "floors_created",
        "tables_created",
        "qr_links_ready"
      ])
    },
    {
      label: L(locale, "Team", "الفريق"),
      href: "#setup-team",
      icon: UsersRound,
      state: phaseStatusFromKeys(onboarding, [
        "owner_staff_ready",
        "cashier_staff_ready",
        "kitchen_staff_ready",
        "waiter_staff_ready"
      ])
    },
    {
      label: L(locale, "Kitchen / Devices", "المطبخ والأجهزة"),
      href: "/staff/kitchen",
      icon: ChefHat,
      state: phaseStatusFromKeys(onboarding, ["kds_ready", "printer_foundation_ready"])
    },
    {
      label: L(locale, "Payments", "الدفع"),
      href: "/staff/cashier",
      icon: CreditCard,
      state: phaseStatusFromKeys(onboarding, [
        "bills_payment_ready",
        "online_payment_provider_ready"
      ])
    },
    {
      label: L(locale, "Experience", "التجربة"),
      href: "/staff/owner#experience",
      icon: Sparkles,
      state:
        onboarding.menu.aiWaiterMenuGroundingReady &&
        Boolean(onboarding.operations.operatingSettings)
          ? "ready" as const
          : "needs_attention" as const
    },
    {
      label: L(locale, "Operations", "التشغيل"),
      href: "/staff/owner#operations",
      icon: Settings2,
      state: phaseStatusFromKeys(onboarding, [
        "cashier_shift_ready",
        "kds_ready",
        "analytics_ready"
      ])
    },
    {
      label: L(locale, "Final readiness", "الجاهزية النهائية"),
      href: "#setup-final",
      icon: Rocket,
      state: launchSummary?.readyForPilot
        ? "ready" as const
        : launchSummary?.status === "blocked"
          ? "blocked" as const
          : "needs_attention" as const
    }
  ];

  const readyCount = phases.filter((phase) => phase.state === "ready").length;
  const blockedCount = phases.filter((phase) => phase.state === "blocked").length;
  const attentionCount = phases.length - readyCount - blockedCount;
  const progress = Math.round((readyCount / phases.length) * 100);

  return (
    <div dir={dir} className="rounded-xl bg-[#F4F0EA] p-3 text-[#2B2520] sm:p-4 lg:p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#D8D1C8] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B765F]">
            BALCONA SETUP · {onboarding.branch.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
            {L(locale, "Get this location live", "جهّز الفرع للتشغيل")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#766B61]">
            {L(
              locale,
              "A finite readiness project across the capabilities required before handoff.",
              "مشروع جاهزية محدد يجمع كل المطلوب قبل تسليم الفرع للتشغيل."
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLocale(locale === "en" ? "ar" : "en")}
          className="inline-flex min-h-10 w-fit items-center gap-2 rounded-md border border-[#D8D1C8] bg-white px-3 text-xs font-semibold"
        >
          <Languages className="size-4" aria-hidden="true" />
          {locale === "en" ? "العربية" : "EN"}
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <div className="rounded-xl border border-[#D8D2C9] bg-[#FFFDF9] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#82756A]">
                  {L(locale, "Launch progress", "تقدم التجهيز")}
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {readyCount}/{phases.length} {L(locale, "phases ready", "مراحل جاهزة")}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-[#73562D]">{progress}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDE8E1]">
              <div
                className="h-full rounded-full bg-[#B17A3D]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#756B62]">
              <span>{readyCount} {L(locale, "ready", "جاهز")}</span>
              <span>{attentionCount} {L(locale, "attention", "انتباه")}</span>
              <span className="font-semibold text-[#8B4038]">{blockedCount} {L(locale, "blocked", "متوقف")}</span>
            </div>
          </div>

          <nav
            className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0"
            aria-label={L(locale, "Setup phases", "مراحل التجهيز")}
          >
            {phases.map((phase, index) => {
              const Icon = phase.icon;
              return (
                <Link
                  key={phase.label}
                  href={phase.href}
                  className="flex min-h-12 shrink-0 items-center gap-3 rounded-lg border border-transparent px-3 text-start text-[#6F665D] transition hover:border-[#D8D1C8] hover:bg-[#FFFDF9] lg:w-full lg:shrink"
                >
                  <span className="text-[10px] font-semibold tabular-nums text-[#9A8D82]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Icon className="size-4 shrink-0 text-[#776A5E]" aria-hidden="true" />
                  <span className="whitespace-nowrap text-xs font-semibold">{phase.label}</span>
                  <span className="ms-auto">
                    <StateMark state={phase.state} />
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-[#D8D2C9] bg-white p-4">
            <p className="text-xs font-semibold">
              {L(locale, "Setup owns readiness, not ongoing admin.", "Setup مسؤول عن الجاهزية، مش الإدارة اليومية.")}
            </p>
            <p className="mt-1.5 text-[11px] leading-5 text-[#81766C]">
              {L(
                locale,
                "After handoff, ongoing changes move to the owning Office domain.",
                "بعد التسليم، التعديلات المستمرة تروح للجزء المسؤول داخل Office."
              )}
            </p>
          </div>
        </aside>

        <section className="min-w-0">
          {children}
        </section>
      </div>
    </div>
  );
}
