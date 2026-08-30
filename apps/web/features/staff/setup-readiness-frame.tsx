"use client";

import {
  AlertTriangle,
  BookOpenText,
  Building2,
  ClipboardCheck,
  Check,
  ChefHat,
  Circle,
  CreditCard,
  Languages,
  MapPinned,
  Rocket,
  Settings2,
  Sparkles,
  UsersRound
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type {
  BranchOnboardingResult,
  TenantOnboardingLaunchSummary,
  TenantOnboardingReadinessStatus
} from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n-provider";

export type SetupPhaseId =
  | "home"
  | "business"
  | "menu"
  | "locations"
  | "team"
  | "kitchen"
  | "payments"
  | "experience"
  | "operations"
  | "final";

type PhaseState = "ready" | "needs_attention" | "blocked" | "missing";

type SetupReadinessFrameProps = {
  onboarding: BranchOnboardingResult;
  launchSummary?: TenantOnboardingLaunchSummary;
  controls?: ReactNode;
  children: (phase: SetupPhaseId) => ReactNode;
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

function aggregateStatuses(
  statuses: Array<TenantOnboardingReadinessStatus | undefined>
): PhaseState {
  const normalized = statuses.map(normalizeState);

  if (normalized.includes("blocked")) return "blocked";
  if (normalized.length > 0 && normalized.every((status) => status === "ready")) {
    return "ready";
  }
  if (normalized.includes("needs_attention")) return "needs_attention";

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

  if (items.length === 0) return "missing";

  return aggregateStatuses(items.map((item) => item?.status));
}

export function SetupReadinessFrame({
  onboarding,
  launchSummary,
  controls,
  children
}: SetupReadinessFrameProps) {
  const { locale, setLocale, dir } = useI18n();
  const [activePhase, setActivePhase] = useState<SetupPhaseId>("home");

  const phases = useMemo(
    () => [
      {
        id: "home" as const,
        label: L(locale, "Setup Home", "الرئيسية"),
        icon: ClipboardCheck,
        state: launchSummary?.status === "blocked"
          ? ("blocked" as const)
          : phaseStatusFromKeys(onboarding, [
                "online_payment_provider_ready",
                "physical_printer_hardware_ready"
              ]) === "blocked"
            ? ("blocked" as const)
            : launchSummary?.readyForPilot
              ? ("ready" as const)
              : ("needs_attention" as const)
      },
      {
        id: "business" as const,
        label: L(locale, "Business", "الشركة"),
        icon: Building2,
        state: phaseStatusFromKeys(onboarding, ["company_profile", "branch_profile"])
      },
      {
        id: "menu" as const,
        label: L(locale, "Menu", "المنيو"),
        icon: BookOpenText,
        state: phaseStatusFromKeys(onboarding, [
          "menu_categories_ready",
          "menu_items_ready",
          "modifiers_ready",
          "inventory_foundation_ready"
        ])
      },
      {
        id: "locations" as const,
        label: L(locale, "Locations / Tables / QR", "الفروع / الترابيزات / QR"),
        icon: MapPinned,
        state: phaseStatusFromKeys(onboarding, [
          "floors_created",
          "tables_created",
          "qr_links_ready"
        ])
      },
      {
        id: "team" as const,
        label: L(locale, "Team", "الفريق"),
        icon: UsersRound,
        state: phaseStatusFromKeys(onboarding, [
          "owner_staff_ready",
          "cashier_staff_ready",
          "kitchen_staff_ready",
          "waiter_staff_ready"
        ])
      },
      {
        id: "kitchen" as const,
        label: L(locale, "Kitchen / Devices", "المطبخ والأجهزة"),
        icon: ChefHat,
        state: phaseStatusFromKeys(onboarding, [
          "kds_ready",
          "printer_foundation_ready",
          "physical_printer_hardware_ready"
        ])
      },
      {
        id: "payments" as const,
        label: L(locale, "Payments", "الدفع"),
        icon: CreditCard,
        state: phaseStatusFromKeys(onboarding, [
          "bills_payment_ready",
          "online_payment_provider_ready"
        ])
      },
      {
        id: "experience" as const,
        label: L(locale, "Experience", "التجربة"),
        icon: Sparkles,
        state:
          onboarding.menu.aiWaiterMenuGroundingReady &&
          Boolean(onboarding.operations.operatingSettings)
            ? ("ready" as const)
            : ("needs_attention" as const)
      },
      {
        id: "operations" as const,
        label: L(locale, "Operations", "التشغيل"),
        icon: Settings2,
        state: phaseStatusFromKeys(onboarding, [
          "cashier_shift_ready",
          "kds_ready",
          "analytics_ready"
        ])
      },
      {
        id: "final" as const,
        label: L(locale, "Final readiness", "الجاهزية النهائية"),
        icon: Rocket,
        state: launchSummary?.status === "blocked"
          ? ("blocked" as const)
          : phaseStatusFromKeys(onboarding, [
                "online_payment_provider_ready",
                "physical_printer_hardware_ready"
              ]) === "blocked"
            ? ("blocked" as const)
            : launchSummary?.readyForPilot &&
                phaseStatusFromKeys(onboarding, [
                  "online_payment_provider_ready",
                  "physical_printer_hardware_ready"
                ]) === "ready"
              ? ("ready" as const)
              : ("needs_attention" as const)
      }
    ],
    [locale, onboarding, launchSummary]
  );

  useEffect(() => {
    const resumeKey = `balcona_setup_resume:${onboarding.branch.id}`;
    const hashPhase = window.location.hash.replace(/^#/, "");
    const storedPhase = window.localStorage.getItem(resumeKey);
    const candidate = hashPhase || storedPhase;

    if (!phases.some((phase) => phase.id === candidate)) return;

    const frame = window.requestAnimationFrame(() => {
      setActivePhase(candidate as SetupPhaseId);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [onboarding.branch.id, phases]);

  useEffect(() => {
    if (!phases.some((phase) => phase.id === activePhase)) return;
    window.localStorage.setItem(
      `balcona_setup_resume:${onboarding.branch.id}`,
      activePhase
    );
  }, [activePhase, onboarding.branch.id, phases]);

  const readyCount = phases.filter((phase) => phase.state === "ready").length;
  const blockedCount = phases.filter((phase) => phase.state === "blocked").length;
  const attentionCount = phases.length - readyCount - blockedCount;
  const progress = Math.round((readyCount / phases.length) * 100);
  const activeIndex = phases.findIndex((phase) => phase.id === activePhase);
  const active = phases[activeIndex] ?? phases[0];

  return (
    <div dir={dir} className="min-h-screen bg-[#F4F0EA] text-[#2B2520]">
      <header className="border-b border-[#D8D1C8] bg-[#F8F5F0]">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex size-9 items-center justify-center rounded-md bg-[#2D2823] text-xs font-black text-white">
            B
          </div>
          <div>
            <p className="text-sm font-semibold">Balcona Setup</p>
            <p className="text-[10px] text-[#82776D]">
              {L(locale, "Implementation workspace", "مساحة تجهيز وتشغيل")}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-2">
            {controls}
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8D1C8] bg-white px-3 text-xs font-semibold"
            >
              <Languages className="size-4" aria-hidden="true" />
              {locale === "en" ? "العربية" : "EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
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
                <span className="text-sm font-semibold tabular-nums text-[#73562D]">
                  {progress}%
                </span>
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
                <span className="font-semibold text-[#8B4038]">
                  {blockedCount} {L(locale, "blocked", "متوقف")}
                </span>
              </div>
            </div>

            <nav
              className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0"
              aria-label={L(locale, "Setup phases", "مراحل التجهيز")}
            >
              {phases.map((phase, index) => {
                const Icon = phase.icon;
                const selected = phase.id === activePhase;

                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => {
                      setActivePhase(phase.id);
                      window.history.replaceState(
                        null,
                        "",
                        `${window.location.pathname}${window.location.search}#${phase.id}`
                      );
                    }}
                    aria-current={selected ? "step" : undefined}
                    className={`flex min-h-12 shrink-0 items-center gap-3 rounded-lg border px-3 text-start transition lg:w-full lg:shrink ${
                      selected
                        ? "border-[#B89363] bg-[#FFFDF9] shadow-[0_1px_0_rgba(0,0,0,.03)]"
                        : "border-transparent text-[#6F665D] hover:bg-[#ECE7E0]"
                    }`}
                  >
                    <span className="text-[10px] font-semibold tabular-nums text-[#9A8D82]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon className="size-4 shrink-0 text-[#776A5E]" aria-hidden="true" />
                    <span className="whitespace-nowrap text-xs font-semibold">
                      {phase.label}
                    </span>
                    <span className="ms-auto">
                      <StateMark state={phase.state} />
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-4 rounded-xl border border-[#D8D2C9] bg-white p-4">
              <p className="text-xs font-semibold">
                {L(
                  locale,
                  "Setup owns readiness, not ongoing admin.",
                  "Setup مسؤول عن الجاهزية، مش الإدارة اليومية."
                )}
              </p>
              <p className="mt-1.5 text-[11px] leading-5 text-[#81766C]">
                {L(
                  locale,
                  "After handoff, ongoing changes move to the owning Office domain. Your last viewed Setup step is saved on this device.",
                  "بعد التسليم، التعديلات المستمرة تروح للجزء المسؤول داخل Office. آخر خطوة فتحتها في Setup محفوظة على هذا الجهاز."
                )}
              </p>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 border-b border-[#D8D1C8] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B765F]">
                  {L(locale, "LOCATION IMPLEMENTATION", "تجهيز الفرع")} · {onboarding.branch.name}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  {L(locale, "Get this location live", "جهّز الفرع للتشغيل")}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#766B61]">
                  {L(
                    locale,
                    "One finite project across the capabilities that must be ready before handoff.",
                    "مشروع محدد يجمع كل الجاهزيات المطلوبة قبل تسليم الفرع للتشغيل."
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StateMark state={active.state} />
                <span className="text-xs font-semibold text-[#756B62]">
                  {L(locale, "Step", "خطوة")} {activeIndex + 1}/10
                </span>
              </div>
            </div>

            {children(activePhase)}

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#D8D1C8] pt-3 text-[10px] text-[#8B8076]">
              <span>
                {L(
                  locale,
                  "Production Setup · live readiness truth",
                  "Setup الإنتاج · جاهزية من البيانات الحقيقية"
                )}
              </span>
              <span>
                {L(
                  locale,
                  "External provider and venue hardware gates stay explicit",
                  "بوابات مزود الدفع والهاردوير الخارجي تظل واضحة"
                )}
              </span>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
