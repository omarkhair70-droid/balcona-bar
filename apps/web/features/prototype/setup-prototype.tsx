"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  ChefHat,
  Circle,
  CreditCard,
  Languages,
  MapPinned,
  MenuSquare,
  MonitorCog,
  QrCode,
  Rocket,
  Settings2,
  Sparkles,
  UsersRound
} from "lucide-react";
import { useMemo, useState } from "react";

type Locale = "en" | "ar";
type PhaseState = "complete" | "attention" | "blocked";
type PhaseId =
  | "business"
  | "locations"
  | "menu"
  | "tables"
  | "team"
  | "kitchen"
  | "payments"
  | "experience"
  | "operations"
  | "final";

type Phase = {
  id: PhaseId;
  en: string;
  ar: string;
  icon: typeof Building2;
  state: PhaseState;
};

const phases: Phase[] = [
  { id: "business", en: "Business", ar: "الشركة", icon: Building2, state: "complete" },
  { id: "locations", en: "Locations", ar: "الفروع", icon: MapPinned, state: "complete" },
  { id: "menu", en: "Menu", ar: "المنيو", icon: MenuSquare, state: "attention" },
  { id: "tables", en: "Tables & QR", ar: "الترابيزات وQR", icon: QrCode, state: "complete" },
  { id: "team", en: "Team", ar: "الفريق", icon: UsersRound, state: "attention" },
  { id: "kitchen", en: "Kitchen / Devices", ar: "المطبخ والأجهزة", icon: ChefHat, state: "attention" },
  { id: "payments", en: "Payments", ar: "الدفع", icon: CreditCard, state: "blocked" },
  { id: "experience", en: "Experience", ar: "التجربة", icon: Sparkles, state: "complete" },
  { id: "operations", en: "Operations", ar: "التشغيل", icon: Settings2, state: "complete" },
  { id: "final", en: "Final readiness", ar: "الجاهزية النهائية", icon: Rocket, state: "blocked" }
];

function L(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function StateMark({ state }: { state: PhaseState }) {
  if (state === "complete") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-[#365B3B] text-white">
        <Check className="size-3" />
      </span>
    );
  }
  if (state === "blocked") {
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-[#8B4038] text-white">
        <AlertTriangle className="size-3" />
      </span>
    );
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-full border border-[#B88943] bg-[#FFF8EB]">
      <Circle className="size-2.5 fill-[#B88943] text-[#B88943]" />
    </span>
  );
}

function StatusPill({ state, locale }: { state: PhaseState; locale: Locale }) {
  const label =
    state === "complete"
      ? L(locale, "Complete", "مكتمل")
      : state === "blocked"
        ? L(locale, "Blocked", "متوقف")
        : L(locale, "Needs attention", "يحتاج انتباه");

  const cls =
    state === "complete"
      ? "border-[#CAD7C9] bg-[#F0F6EF] text-[#365B3B]"
      : state === "blocked"
        ? "border-[#E0C5C1] bg-[#FAEEEE] text-[#8B4038]"
        : "border-[#E4D2AF] bg-[#FFF8EB] text-[#79561D]";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

type StepData = {
  eyebrow: string;
  title: string;
  description: string;
  progress: string;
  primaryAction: string;
  officeLink: string;
  checks: Array<{ label: string; detail: string; state: PhaseState }>;
  side: Array<{ label: string; value: string; state?: PhaseState }>;
  note?: string;
};

function getStep(locale: Locale, phase: PhaseId): StepData {
  const data: Record<PhaseId, StepData> = {
    business: {
      eyebrow: L(locale, "FOUNDATION", "الأساس"),
      title: L(locale, "Business identity is ready.", "هوية الشركة جاهزة."),
      description: L(locale, "Company and branch identity are active and available to the operating surfaces.", "بيانات الشركة والفرع نشطة وجاهزة لباقي أجزاء التشغيل."),
      progress: "2/2",
      primaryAction: L(locale, "Review business", "راجع بيانات الشركة"),
      officeLink: L(locale, "Open Business in Office", "افتح الشركة في Office"),
      checks: [
        { label: L(locale, "Company profile", "بيانات الشركة"), detail: "Balcona Bar · active", state: "complete" },
        { label: L(locale, "Branch profile", "بيانات الفرع"), detail: L(locale, "Balkona Main · active", "بلكونة الرئيسي · نشط"), state: "complete" }
      ],
      side: [
        { label: L(locale, "Company", "الشركة"), value: "Balcona Bar" },
        { label: L(locale, "Branch", "الفرع"), value: L(locale, "Balkona Main", "بلكونة الرئيسي") }
      ]
    },
    locations: {
      eyebrow: L(locale, "LOCATION", "الموقع"),
      title: L(locale, "The first location has a usable structure.", "الفرع الأول له هيكل قابل للتشغيل."),
      description: L(locale, "Floors and branch context exist. Ongoing location administration belongs in Office.", "الأدوار وسياق الفرع موجودين. إدارة الفروع المستمرة مكانها Office."),
      progress: "2/2",
      primaryAction: L(locale, "Review location", "راجع الفرع"),
      officeLink: L(locale, "Open Locations in Office", "افتح الفروع في Office"),
      checks: [
        { label: L(locale, "Branch active", "الفرع نشط"), detail: L(locale, "Balkona Main", "بلكونة الرئيسي"), state: "complete" },
        { label: L(locale, "Floor structure", "هيكل الأدوار"), detail: L(locale, "Ground Floor configured", "الدور الأرضي متجهز"), state: "complete" }
      ],
      side: [
        { label: L(locale, "Floors", "الأدوار"), value: "1" },
        { label: L(locale, "Location status", "حالة الفرع"), value: L(locale, "Active", "نشط"), state: "complete" }
      ]
    },
    menu: {
      eyebrow: L(locale, "CATALOG READINESS", "جاهزية المنيو"),
      title: L(locale, "The menu works, but one readiness issue remains.", "المنيو شغالة، لكن لسه فيه نقطة جاهزية."),
      description: L(locale, "Core catalog and modifier structures are present. Resolve the remaining availability/readiness issue before rehearsal.", "الكتالوج والإضافات موجودين. اقفل مشكلة الإتاحة المتبقية قبل تجربة التشغيل."),
      progress: "3/4",
      primaryAction: L(locale, "Resolve menu issue", "اقفل مشكلة المنيو"),
      officeLink: L(locale, "Open Catalog in Office", "افتح المنيو في Office"),
      checks: [
        { label: L(locale, "Categories", "الأقسام"), detail: L(locale, "4 active categories", "4 أقسام نشطة"), state: "complete" },
        { label: L(locale, "Active items", "المنتجات النشطة"), detail: L(locale, "14 seeded items", "14 منتجًا نشطًا"), state: "complete" },
        { label: L(locale, "Required modifiers", "الإضافات الإجبارية"), detail: L(locale, "Configured and valid", "متجهزة وصحيحة"), state: "complete" },
        { label: L(locale, "Availability review", "مراجعة الإتاحة"), detail: L(locale, "1 item needs attention", "منتج واحد يحتاج مراجعة"), state: "attention" }
      ],
      side: [
        { label: L(locale, "Available items", "المنتجات المتاحة"), value: "13/14" },
        { label: L(locale, "Modifier groups", "مجموعات الإضافات"), value: "5" },
        { label: L(locale, "AI grounding", "جاهزية AI"), value: L(locale, "Ready", "جاهز"), state: "complete" }
      ]
    },
    tables: {
      eyebrow: L(locale, "TABLE SERVICE", "خدمة الترابيزات"),
      title: L(locale, "Tables and QR entry are ready.", "الترابيزات وQR جاهزين."),
      description: L(locale, "Active tables have customer entry tokens and can open the Guest session flow.", "كل الترابيزات النشطة لها QR ويمكنها فتح رحلة الضيف."),
      progress: "8/8",
      primaryAction: L(locale, "Open guest preview", "افتح معاينة الضيف"),
      officeLink: L(locale, "Manage Tables & QR in Office", "إدارة الترابيزات وQR في Office"),
      checks: [
        { label: L(locale, "Active tables", "ترابيزات نشطة"), detail: "8", state: "complete" },
        { label: L(locale, "QR readiness", "جاهزية QR"), detail: "8/8", state: "complete" },
        { label: L(locale, "Customer preview", "معاينة العميل"), detail: "/guest/table/…", state: "complete" }
      ],
      side: [
        { label: L(locale, "QR missing", "QR ناقص"), value: "0", state: "complete" },
        { label: L(locale, "Seats default", "السعة الافتراضية"), value: "2" }
      ]
    },
    team: {
      eyebrow: L(locale, "ROLE COVERAGE", "تغطية الأدوار"),
      title: L(locale, "Core operators exist. One role still needs handoff.", "الفريق الأساسي موجود، ودور واحد لسه محتاج تسليم."),
      description: L(locale, "Setup checks launch coverage. Ongoing access changes live in Office → Team.", "Setup يراجع تغطية التشغيل فقط. إدارة الصلاحيات المستمرة مكانها Office → Team."),
      progress: "5/6",
      primaryAction: L(locale, "Invite missing operator", "ادعُ الموظف الناقص"),
      officeLink: L(locale, "Open Team in Office", "افتح الفريق في Office"),
      checks: [
        { label: L(locale, "Owner / manager", "المالك / المدير"), detail: L(locale, "Covered", "موجود"), state: "complete" },
        { label: L(locale, "Cashier", "الكاشير"), detail: L(locale, "Covered", "موجود"), state: "complete" },
        { label: L(locale, "Waiter", "الويتر"), detail: L(locale, "Covered", "موجود"), state: "complete" },
        { label: L(locale, "Kitchen", "المطبخ"), detail: L(locale, "Covered", "موجود"), state: "complete" },
        { label: L(locale, "Barista", "الباريستا"), detail: L(locale, "Invite pending", "الدعوة معلقة"), state: "attention" }
      ],
      side: [
        { label: L(locale, "Assigned staff", "الموظفون"), value: "5" },
        { label: L(locale, "Pending invites", "دعوات معلقة"), value: "1", state: "attention" }
      ]
    },
    kitchen: {
      eyebrow: L(locale, "PRODUCTION READINESS", "جاهزية الإنتاج"),
      title: L(locale, "KDS is ready; physical print remains a venue check.", "KDS جاهز؛ الطباعة الفعلية ما زالت اختبار موقع."),
      description: L(locale, "Kitchen stations and print-job lifecycle exist. Physical printer transport is intentionally a later venue-ops gate.", "محطات المطبخ ودورة الطباعة موجودة. الربط بطابعة فعلية بوابة تشغيل منفصلة."),
      progress: "2/3",
      primaryAction: L(locale, "Test production flow", "اختبر رحلة المطبخ"),
      officeLink: L(locale, "Open Devices & Stations", "افتح الأجهزة والمحطات"),
      checks: [
        { label: L(locale, "Kitchen station", "محطة المطبخ"), detail: L(locale, "Configured", "متجهزة"), state: "complete" },
        { label: L(locale, "KDS workflow", "رحلة KDS"), detail: L(locale, "Tasks / Tickets / Print", "مهام / تذاكر / طباعة"), state: "complete" },
        { label: L(locale, "Physical printer", "الطابعة الفعلية"), detail: L(locale, "Venue hardware gate", "بوابة هاردوير"), state: "attention" }
      ],
      side: [
        { label: L(locale, "Printer adapter", "نوع الطابعة"), value: "mock" },
        { label: L(locale, "KDS software", "سوفتوير KDS"), value: L(locale, "Ready", "جاهز"), state: "complete" }
      ]
    },
    payments: {
      eyebrow: L(locale, "EXTERNAL GATE", "بوابة خارجية"),
      title: L(locale, "Payment software is present; live merchant certification is not.", "سوفتوير الدفع موجود؛ الاعتماد التجاري الحي غير مكتمل."),
      description: L(locale, "Do not treat merchant credentials or provider certification as a design checkbox. Keep live activation blocked until the external gate is real.", "بيانات التاجر واعتماد شركة الدفع مش checkbox تصميم. التفعيل الحي يفضل متوقف لحد البوابة الخارجية."),
      progress: "2/3",
      primaryAction: L(locale, "Review payment readiness", "راجع جاهزية الدفع"),
      officeLink: L(locale, "Open Money in Office", "افتح Money في Office"),
      checks: [
        { label: L(locale, "Payment architecture", "معمار الدفع"), detail: L(locale, "Provider-neutral lifecycle", "دورة دفع مستقلة عن المزود"), state: "complete" },
        { label: L(locale, "Recovery / reconciliation", "الاسترجاع والمطابقة"), detail: L(locale, "Software path present", "مسار السوفتوير موجود"), state: "complete" },
        { label: L(locale, "Live merchant certification", "اعتماد التاجر الحي"), detail: L(locale, "External provider gate", "بوابة شركة الدفع"), state: "blocked" }
      ],
      side: [
        { label: L(locale, "Live state", "الحالة الحية"), value: L(locale, "Blocked", "متوقفة"), state: "blocked" },
        { label: L(locale, "Secrets shown here", "أسرار ظاهرة هنا"), value: "0" }
      ],
      note: L(locale, "A blocked live provider must not block the rest of the software pilot when manual/staging settlement is explicitly selected.", "تعطل مزود الدفع الحي لا يوقف باقي تجربة السوفتوير لو تم اختيار تسوية يدوية/تجريبية بوضوح.")
    },
    experience: {
      eyebrow: L(locale, "GUEST EXPERIENCE", "تجربة الضيف"),
      title: L(locale, "The guest experience baseline is active.", "الهوية الأساسية لتجربة الضيف نشطة."),
      description: L(locale, "Experience profile, AI Waiter and content foundations are present for the first location.", "ملف التجربة والـAI والمحتوى الأساسي موجودين للفرع الأول."),
      progress: "3/3",
      primaryAction: L(locale, "Preview Guest", "عاين تجربة الضيف"),
      officeLink: L(locale, "Open Experience in Office", "افتح Experience في Office"),
      checks: [
        { label: L(locale, "Experience profile", "ملف التجربة"), detail: "Balkona warm", state: "complete" },
        { label: L(locale, "AI Waiter", "النادل الذكي"), detail: L(locale, "Enabled for pilot context", "مفعل لسياق التجربة"), state: "complete" },
        { label: L(locale, "Content blocks", "بلوكات المحتوى"), detail: L(locale, "Active", "نشطة"), state: "complete" }
      ],
      side: [
        { label: L(locale, "Language", "اللغة"), value: "ar-EG" },
        { label: L(locale, "AI fallback", "Fallback للـAI"), value: L(locale, "Human available", "بشري متاح"), state: "complete" }
      ]
    },
    operations: {
      eyebrow: L(locale, "OPERATING MODEL", "نمط التشغيل"),
      title: L(locale, "Service defaults are ready for rehearsal.", "إعدادات التشغيل جاهزة للتجربة."),
      description: L(locale, "Service mode, automation settings and core launch signals are configured without turning Setup into the permanent settings screen.", "نمط الخدمة والأتمتة وإشارات الإطلاق متجهزة بدون تحويل Setup لصفحة Settings دائمة."),
      progress: "3/3",
      primaryAction: L(locale, "Run service rehearsal", "اختبر التشغيل"),
      officeLink: L(locale, "Open Operations in Office", "افتح Operations في Office"),
      checks: [
        { label: L(locale, "Service mode", "نمط الخدمة"), detail: L(locale, "Dine-in", "داخل المكان"), state: "complete" },
        { label: L(locale, "Smart Cashier", "الكاشير الذكي"), detail: L(locale, "Configured", "متجهز"), state: "complete" },
        { label: L(locale, "Realtime / attention", "الـRealtime والتنبيهات"), detail: L(locale, "Enabled", "مفعل"), state: "complete" }
      ],
      side: [
        { label: L(locale, "Operating mode", "نمط التشغيل"), value: L(locale, "Assisted", "مساعد") },
        { label: L(locale, "Launch rehearsal", "اختبار الإطلاق"), value: L(locale, "Not run", "لم يُشغل"), state: "attention" }
      ]
    },
    final: {
      eyebrow: L(locale, "GO / NO-GO", "قرار الإطلاق"),
      title: L(locale, "Not ready for live activation yet.", "لسه مش جاهز للتفعيل الحي."),
      description: L(locale, "The location is close to software-pilot readiness, but unresolved blockers remain visible by design.", "الفرع قريب من جاهزية تجربة السوفتوير، لكن العوائق المتبقية ظاهرة عمدًا."),
      progress: "7/10",
      primaryAction: L(locale, "Run full rehearsal", "شغّل التجربة الكاملة"),
      officeLink: L(locale, "Review launch blockers", "راجع عوائق الإطلاق"),
      checks: [
        { label: L(locale, "Menu readiness", "جاهزية المنيو"), detail: L(locale, "1 issue", "مشكلة واحدة"), state: "attention" },
        { label: L(locale, "Role coverage", "تغطية الأدوار"), detail: L(locale, "1 pending invite", "دعوة معلقة"), state: "attention" },
        { label: L(locale, "Physical print", "الطباعة الفعلية"), detail: L(locale, "Venue gate", "بوابة موقع"), state: "attention" },
        { label: L(locale, "Live payment", "الدفع الحي"), detail: L(locale, "External provider gate", "بوابة مزود خارجي"), state: "blocked" },
        { label: L(locale, "End-to-end rehearsal", "التجربة من أول لآخر"), detail: L(locale, "Required before handoff", "مطلوبة قبل التسليم"), state: "blocked" }
      ],
      side: [
        { label: L(locale, "Completed phases", "المراحل المكتملة"), value: "5/10" },
        { label: L(locale, "Attention", "يحتاج انتباه"), value: "4", state: "attention" },
        { label: L(locale, "Hard blockers", "عوائق صريحة"), value: "2", state: "blocked" }
      ],
      note: L(locale, "The final screen never converts an external merchant or hardware gate into a fake green check.", "الشاشة النهائية لا تحول بوابة مزود دفع أو هاردوير خارجي إلى علامة خضراء وهمية.")
    }
  };

  return data[phase];
}

function ReadinessBar({ locale }: { locale: Locale }) {
  return (
    <div className="rounded-xl border border-[#D8D2C9] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#7A7065]">{L(locale, "Launch progress", "تقدم الإطلاق")}</p>
          <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-[#29231F]">70%</p>
        </div>
        <span className="text-xs font-semibold text-[#73562D]">{L(locale, "7 of 10 phases", "7 من 10 مراحل")}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EDE8E1]">
        <div className="h-full w-[70%] rounded-full bg-[#B17A3D]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#756B62]">
        <span>{L(locale, "5 complete", "5 مكتملة")}</span>
        <span>{L(locale, "4 need attention", "4 تحتاج انتباه")}</span>
        <span className="font-semibold text-[#8B4038]">{L(locale, "2 blockers", "2 عوائق")}</span>
      </div>
    </div>
  );
}

function DetailPanel({ locale, phase }: { locale: Locale; phase: Phase }) {
  const step = useMemo(() => getStep(locale, phase.id), [locale, phase.id]);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <section className="min-w-0 rounded-xl border border-[#D8D2C9] bg-white">
        <div className="border-b border-[#E9E3DB] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#98704A]">{step.eyebrow}</p>
            <StatusPill state={phase.state} locale={locale} />
          </div>
          <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-[-0.035em] text-[#2A241F] sm:text-3xl">{step.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#71675E]">{step.description}</p>
        </div>

        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between border-b border-[#EEE8E0] pb-3">
            <p className="text-xs font-semibold text-[#38312B]">{L(locale, "Readiness checks", "فحوص الجاهزية")}</p>
            <span className="text-xs font-semibold tabular-nums text-[#756A60]">{step.progress}</span>
          </div>

          <div className="divide-y divide-[#EEE8E0]">
            {step.checks.map((item) => (
              <div key={item.label} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="flex gap-3">
                  <StateMark state={item.state} />
                  <div>
                    <p className="text-sm font-semibold text-[#302A25]">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#80756B]">{item.detail}</p>
                  </div>
                </div>
                <StatusPill state={item.state} locale={locale} />
              </div>
            ))}
          </div>

          {step.note ? (
            <div className="mt-4 border-s-2 border-[#B17A3D] bg-[#FBF7F0] px-4 py-3 text-xs leading-6 text-[#6F6256]">
              {step.note}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-md bg-[#2D2823] px-4 text-sm font-semibold text-white">
              {step.primaryAction}
            </button>
            <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[#D8D1C8] bg-white px-4 text-sm font-semibold text-[#4C433B]">
              {step.officeLink}
              <ArrowUpRight className="size-4" />
            </button>
          </div>
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <div className="rounded-xl border border-[#D8D2C9] bg-[#F8F4EE] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#82756A]">{L(locale, "Current branch", "الفرع الحالي")}</p>
          <p className="mt-2 text-lg font-semibold text-[#2C2722]">{L(locale, "Balkona Main", "بلكونة الرئيسي")}</p>
          <p className="mt-1 text-xs text-[#81766C]">Cairo · EGP</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#D8D2C9] bg-white">
          <div className="border-b border-[#E9E3DB] px-4 py-3">
            <p className="text-xs font-semibold">{L(locale, "At this step", "ملخص الخطوة")}</p>
          </div>
          <div className="divide-y divide-[#EEE8E0]">
            {step.side.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-xs text-[#756B62]">{row.label}</span>
                <span className={`text-xs font-semibold ${row.state === "blocked" ? "text-[#8B4038]" : row.state === "attention" ? "text-[#805C22]" : "text-[#302A25]"}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#D8D2C9] bg-white p-4">
          <div className="flex items-start gap-3">
            <MonitorCog className="mt-0.5 size-4 text-[#87623A]" />
            <div>
              <p className="text-xs font-semibold">{L(locale, "Setup owns readiness, not ongoing admin.", "Setup مسؤول عن الجاهزية، مش الإدارة اليومية.")}</p>
              <p className="mt-1.5 text-[11px] leading-5 text-[#81766C]">{L(locale, "After handoff, ongoing changes move to the owning Office domain.", "بعد التسليم، التعديلات المستمرة تروح للجزء المسؤول داخل Office.")}</p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function SetupPrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [active, setActive] = useState<PhaseId>("menu");
  const current = phases.find((phase) => phase.id === active) ?? phases[0];

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#F4F0EA] text-[#2B2520]">
      <header className="border-b border-[#D8D1C8] bg-[#F8F5F0]">
        <div className="mx-auto flex min-h-16 max-w-[1500px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-[#2D2823] text-xs font-black text-white">B</div>
            <div>
              <p className="text-sm font-semibold">Balcona Setup</p>
              <p className="text-[10px] text-[#82776D]">{L(locale, "Implementation workspace", "مساحة تجهيز وتشغيل")}</p>
            </div>
          </div>
          <div className="ms-auto flex items-center gap-2">
            <span className="hidden rounded-md border border-[#D8D1C8] bg-white px-3 py-2 text-xs font-semibold text-[#62574E] sm:inline-flex">
              {L(locale, "Balkona Main", "بلكونة الرئيسي")}
            </span>
            <button
              type="button"
              onClick={() => setLocale((value) => value === "en" ? "ar" : "en")}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#D8D1C8] bg-white px-3 text-xs font-semibold"
            >
              <Languages className="size-4" />
              {locale === "en" ? "العربية" : "EN"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="min-w-0">
            <ReadinessBar locale={locale} />
            <nav className="mt-4 flex gap-2 overflow-x-auto pb-1 lg:grid lg:gap-1 lg:overflow-visible lg:pb-0" aria-label={L(locale, "Setup phases", "مراحل التجهيز")}>
              {phases.map((phase, index) => {
                const Icon = phase.icon;
                const selected = phase.id === active;
                return (
                  <button
                    key={phase.id}
                    type="button"
                    onClick={() => setActive(phase.id)}
                    className={`flex min-h-12 shrink-0 items-center gap-3 rounded-lg border px-3 text-start transition lg:w-full lg:shrink ${selected ? "border-[#B89363] bg-[#FFFDF9] shadow-[0_1px_0_rgba(0,0,0,.03)]" : "border-transparent text-[#6F665D] hover:bg-[#ECE7E0]"}`}
                  >
                    <span className="text-[10px] font-semibold tabular-nums text-[#9A8D82]">{String(index + 1).padStart(2, "0")}</span>
                    <Icon className="size-4 shrink-0 text-[#776A5E]" />
                    <span className="whitespace-nowrap text-xs font-semibold">{L(locale, phase.en, phase.ar)}</span>
                    <span className="ms-auto"><StateMark state={phase.state} /></span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <section className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 border-b border-[#D8D1C8] pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#8B765F]">
                  {L(locale, "LOCATION IMPLEMENTATION", "تجهيز الفرع")} · {L(locale, "Balkona Main", "بلكونة الرئيسي")}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{L(locale, "Get this location live", "جهّز الفرع للتشغيل")}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#766B61]">
                  {L(locale, "One finite project across the capabilities that must be ready before handoff.", "مشروع محدد يجمع كل الجاهزيات المطلوبة قبل تسليم الفرع للتشغيل.")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill state={current.state} locale={locale} />
                <span className="text-xs font-semibold text-[#756B62]">{L(locale, "Step", "خطوة")} {phases.findIndex((phase) => phase.id === active) + 1}/10</span>
              </div>
            </div>

            <DetailPanel locale={locale} phase={current} />

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#D8D1C8] pt-3 text-[10px] text-[#8B8076]">
              <span>{L(locale, "Setup prototype · readiness truth only", "نموذج Setup · مبني على حقيقة الجاهزية")}</span>
              <span>{L(locale, "No production mutation behavior changed", "لم يتم تغيير سلوك الإنتاج")}</span>
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}
