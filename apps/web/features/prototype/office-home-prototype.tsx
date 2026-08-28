"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Boxes,
  Building2,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Command,
  CreditCard,
  Gauge,
  LayoutDashboard,
  MapPin,
  MenuSquare,
  PackageSearch,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  WandSparkles
} from "lucide-react";
import { useMemo, useState } from "react";

type Locale = "en" | "ar";
type Domain =
  | "home"
  | "operations"
  | "catalog"
  | "inventory"
  | "locations"
  | "team"
  | "money"
  | "insights"
  | "experience"
  | "settings";

type Scope = "all" | "main";

type Row = {
  primary: string;
  secondary?: string;
  values: string[];
  tone?: "ok" | "warn" | "danger" | "neutral";
};

type SectionModel = {
  title: string;
  description: string;
  metrics: Array<{ label: string; value: string; hint?: string }>;
  columns: string[];
  rows: Row[];
  aside?: Array<{ label: string; value: string; tone?: "ok" | "warn" | "danger" }>;
};

const domains: Array<{
  id: Domain;
  en: string;
  ar: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: "home", en: "Home", ar: "الرئيسية", icon: LayoutDashboard },
  { id: "operations", en: "Operations", ar: "العمليات", icon: Sparkles },
  { id: "catalog", en: "Catalog", ar: "المنيو", icon: MenuSquare },
  { id: "inventory", en: "Inventory", ar: "المخزون", icon: Boxes },
  { id: "locations", en: "Locations", ar: "الفروع", icon: MapPin },
  { id: "team", en: "Team", ar: "الفريق", icon: Users },
  { id: "money", en: "Money", ar: "المدفوعات", icon: CreditCard },
  { id: "insights", en: "Insights", ar: "التحليلات", icon: PackageSearch },
  { id: "experience", en: "Experience", ar: "التجربة", icon: WandSparkles },
  { id: "settings", en: "Settings", ar: "الإعدادات", icon: Settings }
];

const subnav: Record<Exclude<Domain, "home">, Array<{ en: string; ar: string }>> = {
  operations: [
    { en: "Overview", ar: "نظرة عامة" },
    { en: "Orders", ar: "الطلبات" },
    { en: "Service & Attention", ar: "الخدمة والتنبيهات" },
    { en: "Shifts & Cash", ar: "الورديات والكاش" },
    { en: "Kitchen Operations", ar: "تشغيل المطبخ" },
    { en: "Smart Cashier", ar: "الكاشير الذكي" }
  ],
  catalog: [
    { en: "Items", ar: "المنتجات" },
    { en: "Categories", ar: "الأقسام" },
    { en: "Modifiers", ar: "الإضافات" },
    { en: "Availability", ar: "الإتاحة" },
    { en: "Branch Overrides", ar: "تعديلات الفروع" },
    { en: "Preview", ar: "المعاينة" }
  ],
  inventory: [
    { en: "Stock", ar: "المخزون" },
    { en: "Alerts", ar: "التنبيهات" },
    { en: "Movements", ar: "الحركات" },
    { en: "Requirements", ar: "المتطلبات" },
    { en: "Suppliers", ar: "الموردون" },
    { en: "Purchase Orders", ar: "أوامر الشراء" },
    { en: "Receiving", ar: "الاستلام" }
  ],
  locations: [
    { en: "Branches", ar: "الفروع" },
    { en: "Floors & Tables", ar: "الأدوار والترابيزات" },
    { en: "QR", ar: "QR" },
    { en: "Zones", ar: "المناطق" },
    { en: "Devices & Stations", ar: "الأجهزة والمحطات" }
  ],
  team: [
    { en: "People", ar: "الأشخاص" },
    { en: "Roles & Access", ar: "الأدوار والصلاحيات" },
    { en: "Invites", ar: "الدعوات" },
    { en: "Location Access", ar: "صلاحيات الفروع" }
  ],
  money: [
    { en: "Overview", ar: "نظرة عامة" },
    { en: "Transactions", ar: "المعاملات" },
    { en: "Bills", ar: "الفواتير" },
    { en: "Refunds & Operations", ar: "الاسترجاع والعمليات" },
    { en: "Settlements", ar: "التسويات" },
    { en: "Reconciliation", ar: "المطابقة" },
    { en: "Issues", ar: "المشاكل" }
  ],
  insights: [
    { en: "Overview", ar: "نظرة عامة" },
    { en: "Sales", ar: "المبيعات" },
    { en: "Orders", ar: "الطلبات" },
    { en: "Items", ar: "المنتجات" },
    { en: "Operations", ar: "العمليات" },
    { en: "Shifts & Cash", ar: "الورديات والكاش" },
    { en: "AI & Automation", ar: "الذكاء والأتمتة" },
    { en: "Activity", ar: "النشاط" }
  ],
  experience: [
    { en: "Profiles", ar: "الملفات" },
    { en: "AI Waiter", ar: "النادل الذكي" },
    { en: "Content", ar: "المحتوى" },
    { en: "Media", ar: "الوسائط" },
    { en: "Notifications", ar: "الإشعارات" }
  ],
  settings: [
    { en: "Business", ar: "الشركة" },
    { en: "Branch Operations", ar: "تشغيل الفرع" },
    { en: "Service Mode", ar: "نمط الخدمة" },
    { en: "Feature Flags", ar: "الخصائص" },
    { en: "Integrations", ar: "التكاملات" },
    { en: "Security", ar: "الأمان" },
    { en: "Advanced", ar: "متقدم" }
  ]
};

function L(en: string, ar: string, locale: Locale) {
  return locale === "ar" ? ar : en;
}

function SectionStatus({
  tone = "neutral",
  children
}: {
  tone?: "ok" | "warn" | "danger" | "neutral";
  children: React.ReactNode;
}) {
  const classes = {
    ok: "border-[#D5DDD3] bg-[#F1F5EF] text-[#3B5F3D]",
    warn: "border-[#E4D7BE] bg-[#FAF5E9] text-[#78581F]",
    danger: "border-[#E2C9C5] bg-[#FAEEEE] text-[#8D3F37]",
    neutral: "border-[#D9D9D4] bg-[#F5F5F2] text-[#5E5E58]"
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function MetricBand({
  metrics
}: {
  metrics: Array<{ label: string; value: string; hint?: string }>;
}) {
  return (
    <div className="grid overflow-hidden rounded-lg border border-[#D9D9D4] bg-white md:grid-cols-4">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className={`px-4 py-4 ${index > 0 ? "border-t border-[#E9E9E5] md:border-s md:border-t-0" : ""}`}
        >
          <p className="text-xs font-medium text-[#74746E]">{metric.label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.035em] text-[#22221F]">
            {metric.value}
          </p>
          {metric.hint ? (
            <p className="mt-1 text-[11px] text-[#777770]">{metric.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DataPanel({
  model,
  locale
}: {
  model: SectionModel;
  locale: Locale;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
        <div className="flex items-start justify-between gap-4 border-b border-[#E6E6E1] px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-[#252522]">{model.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#777771]">{model.description}</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#D8D8D3] bg-white px-3 text-xs font-semibold text-[#55554F] hover:bg-[#F5F5F2]"
          >
            {L("Open detail", "فتح التفاصيل", locale)}
            <ArrowUpRight className="size-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E8E8E4] bg-[#F7F7F4] text-[11px] text-[#6F6F69]">
                <th className="px-4 py-2.5 text-start font-medium">{model.columns[0]}</th>
                {model.columns.slice(1).map((column) => (
                  <th key={column} className="px-4 py-2.5 text-start font-medium">
                    {column}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-start font-medium">{L("State", "الحالة", locale)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECECE8]">
              {model.rows.map((row) => (
                <tr key={row.primary} className="hover:bg-[#FAFAF8]">
                  <td className="px-4 py-3.5">
                    <button type="button" className="text-start font-semibold text-[#2A2A27] hover:underline">
                      {row.primary}
                    </button>
                    {row.secondary ? (
                      <p className="mt-0.5 text-[11px] text-[#85857F]">{row.secondary}</p>
                    ) : null}
                  </td>
                  {row.values.map((value, index) => (
                    <td key={`${row.primary}-${index}`} className="px-4 py-3.5 text-[#5F5F59]">
                      {value}
                    </td>
                  ))}
                  <td className="px-4 py-3.5">
                    <SectionStatus tone={row.tone}>{row.tone === "danger"
                      ? L("Needs review", "يحتاج مراجعة", locale)
                      : row.tone === "warn"
                        ? L("Attention", "تنبيه", locale)
                        : row.tone === "ok"
                          ? L("Healthy", "سليم", locale)
                          : L("Active", "نشط", locale)}</SectionStatus>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-lg border border-[#D9D9D4] bg-white">
        <div className="border-b border-[#E7E7E2] px-4 py-3.5">
          <h3 className="text-sm font-semibold">{L("At a glance", "ملخص سريع", locale)}</h3>
        </div>
        <div className="divide-y divide-[#ECECE8]">
          {(model.aside ?? []).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-xs text-[#696963]">{item.label}</span>
              <span className="text-sm font-semibold text-[#2A2A27]">{item.value}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function makeModel(domain: Domain, section: string, locale: Locale, scope: Scope): SectionModel {
  const scopeName = scope === "all" ? L("All locations", "كل الفروع", locale) : L("Balkona Main", "بلكونة الرئيسي", locale);
  const commonMetrics = [
    { label: L("Collected", "المحصّل", locale), value: scope === "all" ? "101,830 EGP" : "42,680 EGP", hint: L("today", "اليوم", locale) },
    { label: L("Orders", "الطلبات", locale), value: scope === "all" ? "921" : "391", hint: "+5.1%" },
    { label: L("Average ticket", "متوسط الفاتورة", locale), value: "111 EGP", hint: "+3.2%" },
    { label: L("Open attention", "تنبيهات مفتوحة", locale), value: scope === "all" ? "4" : "3", hint: L("live operational signals", "تنبيهات تشغيل مباشرة", locale) }
  ];

  const models: Partial<Record<Domain, SectionModel>> = {
    operations: {
      title: section,
      description: L(`Operational work across ${scopeName}. Live queues stay in Service/Kitchen; Office summarizes, investigates, and configures.`, `تشغيل ${scopeName}. العمل اللحظي يظل في الخدمة والمطبخ، وOffice للمراجعة والتحليل والإعداد.`, locale),
      metrics: commonMetrics,
      columns: [L("Work item", "البند", locale), L("Location", "الفرع", locale), L("Owner", "المسؤول", locale), L("Age / count", "العمر / العدد", locale)],
      rows: [
        { primary: L("Unresolved table attention", "تنبيهات ترابيزات غير محلولة", locale), secondary: L("Service & Attention", "الخدمة والتنبيهات", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Floor team", "فريق الصالة", locale), "3"], tone: "warn" },
        { primary: L("Failed print jobs", "مهام طباعة فاشلة", locale), secondary: L("Kitchen Operations", "تشغيل المطبخ", locale), values: [L("Branch 02", "فرع 02", locale), L("Manager", "المدير", locale), "1"], tone: "danger" },
        { primary: L("Smart Cashier reviews", "مراجعات الكاشير الذكي", locale), secondary: L("Automation review queue", "قائمة مراجعة الأتمتة", locale), values: [scopeName, L("Cashier lead", "مسؤول الكاشير", locale), "6"], tone: "neutral" }
      ],
      aside: [
        { label: L("Urgent attention", "تنبيهات عاجلة", locale), value: "1", tone: "danger" },
        { label: L("Open shifts", "ورديات مفتوحة", locale), value: scope === "all" ? "3" : "1" },
        { label: L("Print failures", "فشل طباعة", locale), value: "1" },
        { label: L("Auto-accepted", "قبول تلقائي", locale), value: "84%" }
      ]
    },
    catalog: {
      title: section,
      description: L(`Company catalog with branch-aware availability and overrides for ${scopeName}.`, `منيو الشركة مع الإتاحة وتعديلات الفروع ضمن ${scopeName}.`, locale),
      metrics: [
        { label: L("Active items", "منتجات نشطة", locale), value: "86" },
        { label: L("Available now", "متاح الآن", locale), value: "79" },
        { label: L("Branch overrides", "تعديلات الفروع", locale), value: "7" },
        { label: L("Modifier groups", "مجموعات إضافات", locale), value: "18" }
      ],
      columns: [L("Item", "المنتج", locale), L("Category", "القسم", locale), L("Price", "السعر", locale), L("Availability", "الإتاحة", locale)],
      rows: [
        { primary: L("Spanish Latte", "سبانيش لاتيه", locale), secondary: "BAR-014", values: [L("Coffee", "قهوة", locale), "95 EGP", L("3/3 locations", "3/3 فروع", locale)], tone: "ok" },
        { primary: L("Iced Matcha", "آيس ماتشا", locale), secondary: "BAR-031", values: [L("Cold drinks", "مشروبات باردة", locale), "110 EGP", L("2/3 locations", "2/3 فروع", locale)], tone: "warn" },
        { primary: L("Basque Cheesecake", "باسك تشيزكيك", locale), secondary: "DES-008", values: [L("Desserts", "حلويات", locale), "135 EGP", L("Unavailable at Branch 02", "غير متاح في فرع 02", locale)], tone: "danger" }
      ],
      aside: [
        { label: L("Missing prices", "أسعار ناقصة", locale), value: "0" },
        { label: L("Unavailable", "غير متاح", locale), value: "7" },
        { label: L("With modifiers", "بإضافات", locale), value: "24" },
        { label: L("Preview issues", "مشاكل المعاينة", locale), value: "1" }
      ]
    },
    inventory: {
      title: section,
      description: L(`Stock truth and procurement exceptions across ${scopeName}.`, `حقيقة المخزون واستثناءات المشتريات عبر ${scopeName}.`, locale),
      metrics: [
        { label: L("Tracked items", "عناصر متتبعة", locale), value: "64" },
        { label: L("Low stock", "مخزون منخفض", locale), value: "6" },
        { label: L("Out of stock", "نفد المخزون", locale), value: "2" },
        { label: L("Open POs", "أوامر شراء مفتوحة", locale), value: "4" }
      ],
      columns: [L("Inventory item", "عنصر المخزون", locale), L("On hand", "المتاح", locale), L("Par", "الحد", locale), L("Impact", "التأثير", locale)],
      rows: [
        { primary: L("Espresso beans", "حبوب إسبريسو", locale), secondary: "COF-001", values: ["2.4 kg", "6 kg", L("4 menu items", "4 منتجات", locale)], tone: "danger" },
        { primary: L("Oat milk", "لبن شوفان", locale), secondary: "MIL-004", values: ["9 L", "12 L", L("2 menu items", "منتجان", locale)], tone: "warn" },
        { primary: L("Vanilla syrup", "سيرب فانيليا", locale), secondary: "SYR-002", values: ["14 L", "8 L", L("No block", "لا يوجد تعطيل", locale)], tone: "ok" }
      ],
      aside: [
        { label: L("Stock alerts", "تنبيهات مخزون", locale), value: "8" },
        { label: L("Blocked menu items", "منتجات موقوفة", locale), value: "4" },
        { label: L("Suppliers", "موردون", locale), value: "11" },
        { label: L("Awaiting receiving", "بانتظار الاستلام", locale), value: "2" }
      ]
    },
    locations: {
      title: section,
      description: L("Company scope, branch configuration, tables, QR, zones, and operational devices.", "نطاق الشركة وإعداد الفروع والترابيزات وQR والمناطق والأجهزة.", locale),
      metrics: [
        { label: L("Locations", "الفروع", locale), value: "3" },
        { label: L("Tables", "الترابيزات", locale), value: "74" },
        { label: L("Active sessions", "جلسات نشطة", locale), value: "19" },
        { label: L("Devices online", "أجهزة متصلة", locale), value: "11/12" }
      ],
      columns: [L("Location", "الفرع", locale), L("Tables", "الترابيزات", locale), L("Sessions", "الجلسات", locale), L("Readiness", "الجاهزية", locale)],
      rows: [
        { primary: L("Balkona Main", "بلكونة الرئيسي", locale), secondary: L("Company default", "الإعداد الافتراضي", locale), values: ["28", "8", "100%"], tone: "ok" },
        { primary: L("Branch 02", "فرع 02", locale), secondary: L("2 branch overrides", "تعديلان للفرع", locale), values: ["24", "6", "92%"], tone: "warn" },
        { primary: L("Branch 03", "فرع 03", locale), secondary: L("Inherited settings", "إعدادات موروثة", locale), values: ["22", "5", "100%"], tone: "ok" }
      ],
      aside: [
        { label: L("Missing QR", "QR ناقص", locale), value: "0" },
        { label: L("Maintenance tables", "ترابيزات صيانة", locale), value: "2" },
        { label: L("Printer stations", "محطات طباعة", locale), value: "6" },
        { label: L("Offline devices", "أجهزة غير متصلة", locale), value: "1" }
      ]
    },
    team: {
      title: section,
      description: L("People, roles, invites, and location-scoped access. Roles authorize; they do not define the product IA.", "الأشخاص والأدوار والدعوات وصلاحيات الفروع. الدور يحدد الصلاحية وليس بنية المنتج.", locale),
      metrics: [
        { label: L("Active people", "أشخاص نشطون", locale), value: "27" },
        { label: L("Pending invites", "دعوات معلقة", locale), value: "3" },
        { label: L("Multi-location", "متعدد الفروع", locale), value: "6" },
        { label: L("Access reviews", "مراجعات صلاحيات", locale), value: "2" }
      ],
      columns: [L("Person", "الشخص", locale), L("Role", "الدور", locale), L("Locations", "الفروع", locale), L("Access", "الصلاحية", locale)],
      rows: [
        { primary: "Omar Khair", secondary: "omar@balcona.example", values: [L("Owner", "مالك", locale), L("All locations", "كل الفروع", locale), L("Full company access", "صلاحية كاملة", locale)], tone: "ok" },
        { primary: "Mariam Hassan", secondary: "mariam@balcona.example", values: [L("Branch manager", "مدير فرع", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Operations + Office", "تشغيل + إدارة", locale)], tone: "ok" },
        { primary: "Youssef Ali", secondary: "youssef@balcona.example", values: [L("Cashier", "كاشير", locale), L("Branch 02", "فرع 02", locale), L("Service only", "الخدمة فقط", locale)], tone: "neutral" }
      ],
      aside: [
        { label: L("Owners", "ملاك", locale), value: "2" },
        { label: L("Managers", "مديرون", locale), value: "4" },
        { label: L("Service staff", "فريق خدمة", locale), value: "15" },
        { label: L("Kitchen/bar", "مطبخ/بار", locale), value: "6" }
      ]
    },
    money: {
      title: section,
      description: L("Operational finance: transactions, payment lifecycle, settlements, reconciliation, and issues.", "العمليات المالية: المعاملات وحالات الدفع والتسويات والمطابقة والمشاكل.", locale),
      metrics: [
        { label: L("Collected", "المحصّل", locale), value: scope === "all" ? "101,830 EGP" : "42,680 EGP" },
        { label: L("Online payments", "مدفوعات أونلاين", locale), value: "318" },
        { label: L("Needs review", "تحتاج مراجعة", locale), value: "2" },
        { label: L("Open reconciliation", "مطابقة مفتوحة", locale), value: "1" }
      ],
      columns: [L("Transaction", "المعاملة", locale), L("Location", "الفرع", locale), L("Amount", "المبلغ", locale), L("Method", "الطريقة", locale)],
      rows: [
        { primary: "#PAY-24081", secondary: L("Bill #B-8821", "فاتورة #B-8821", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "385 EGP", L("Card online", "كارت أونلاين", locale)], tone: "ok" },
        { primary: "#PAY-24079", secondary: L("Provider state unknown", "حالة شركة الدفع غير محسومة", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "220 EGP", L("Card online", "كارت أونلاين", locale)], tone: "danger" },
        { primary: "#PAY-24073", secondary: L("Cashier shift", "وردية كاشير", locale), values: [L("Branch 02", "فرع 02", locale), "145 EGP", L("Cash", "كاش", locale)], tone: "ok" }
      ],
      aside: [
        { label: L("Payment issues", "مشاكل دفع", locale), value: "2" },
        { label: L("Refund operations", "عمليات استرجاع", locale), value: "1" },
        { label: L("Settlement batches", "دفعات تسوية", locale), value: "3" },
        { label: L("Mismatch amount", "قيمة الاختلاف", locale), value: "1,840 EGP" }
      ]
    },
    insights: {
      title: section,
      description: L("Decision-oriented analytics. Investigation belongs here; Home stays concise.", "تحليلات موجهة للقرار. التحقيق التفصيلي هنا، بينما الرئيسية تظل مختصرة.", locale),
      metrics: commonMetrics,
      columns: [L("Measure", "المقياس", locale), L("Current", "الحالي", locale), L("Previous", "السابق", locale), L("Change", "التغيير", locale)],
      rows: [
        { primary: L("Collected revenue", "الإيراد المحصل", locale), values: ["101,830 EGP", "93,940 EGP", "+8.4%"], tone: "ok" },
        { primary: L("Served orders", "طلبات تم تقديمها", locale), values: ["884", "841", "+5.1%"], tone: "ok" },
        { primary: L("Average waiter resolution", "متوسط حل طلبات النادل", locale), values: ["2m 14s", "1m 52s", "+22s"], tone: "warn" }
      ],
      aside: [
        { label: L("Top item", "أعلى منتج", locale), value: L("Spanish Latte", "سبانيش لاتيه", locale) },
        { label: L("AI sessions", "جلسات AI", locale), value: "146" },
        { label: L("Escalations", "تصعيدات", locale), value: "9" },
        { label: L("Cash over/short", "فرق الكاش", locale), value: "0 EGP" }
      ]
    },
    experience: {
      title: section,
      description: L("Guest-facing experience profiles, AI Waiter, content, media, and notifications.", "تجربة الضيف: ملفات التجربة والنادل الذكي والمحتوى والوسائط والإشعارات.", locale),
      metrics: [
        { label: L("Experience profiles", "ملفات تجربة", locale), value: "3" },
        { label: L("Content blocks", "بلوكات محتوى", locale), value: "12" },
        { label: L("Media assets", "ملفات وسائط", locale), value: "48" },
        { label: L("Notification templates", "قوالب إشعارات", locale), value: "9" }
      ],
      columns: [L("Experience object", "عنصر التجربة", locale), L("Scope", "النطاق", locale), L("Usage", "الاستخدام", locale), L("Last updated", "آخر تعديل", locale)],
      rows: [
        { primary: L("Company Default", "إعداد الشركة", locale), secondary: L("Guest visual + voice", "شكل وصوت تجربة الضيف", locale), values: [L("Company", "الشركة", locale), L("3 branches", "3 فروع", locale), L("Today", "اليوم", locale)], tone: "ok" },
        { primary: L("Balkona Main evening", "مساء بلكونة الرئيسي", locale), secondary: L("Branch override", "تعديل فرع", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Zone + content", "منطقة + محتوى", locale), L("Yesterday", "أمس", locale)], tone: "neutral" },
        { primary: L("AI Waiter tone", "نبرة النادل الذكي", locale), secondary: L("Arabic + English", "عربي + إنجليزي", locale), values: [L("Company", "الشركة", locale), L("Guest assistant", "مساعد الضيف", locale), L("2 days ago", "منذ يومين", locale)], tone: "ok" }
      ],
      aside: [
        { label: L("Active media", "وسائط نشطة", locale), value: "31" },
        { label: L("Unused assets", "وسائط غير مستخدمة", locale), value: "17" },
        { label: L("AI escalations", "تصعيدات AI", locale), value: "9" },
        { label: L("Template issues", "مشاكل قوالب", locale), value: "0" }
      ]
    },
    settings: {
      title: section,
      description: L("Company defaults and branch overrides. Scope is explicit before configuration.", "إعدادات الشركة وتعديلات الفروع. النطاق واضح قبل أي تعديل.", locale),
      metrics: [
        { label: L("Company defaults", "إعدادات الشركة", locale), value: "18" },
        { label: L("Branch overrides", "تعديلات الفروع", locale), value: "7" },
        { label: L("Feature flags", "خصائص", locale), value: "14" },
        { label: L("Integrations", "تكاملات", locale), value: "4" }
      ],
      columns: [L("Setting", "الإعداد", locale), L("Source", "المصدر", locale), L("Value", "القيمة", locale), L("Last changed", "آخر تعديل", locale)],
      rows: [
        { primary: L("Service mode", "نمط الخدمة", locale), values: [L("Company default", "إعداد الشركة", locale), L("Table service", "خدمة ترابيزات", locale), L("2 days ago", "منذ يومين", locale)], tone: "ok" },
        { primary: L("Auto-accept eligible orders", "قبول الطلبات المؤهلة تلقائيًا", locale), values: [L("Branch override", "تعديل فرع", locale), L("Enabled", "مفعل", locale), L("Today", "اليوم", locale)], tone: "neutral" },
        { primary: L("Online payments", "الدفع أونلاين", locale), values: [L("Company default", "إعداد الشركة", locale), L("Enabled", "مفعل", locale), L("5 days ago", "منذ 5 أيام", locale)], tone: "ok" }
      ],
      aside: [
        { label: L("Inherited", "موروث", locale), value: "11" },
        { label: L("Overridden", "معدل", locale), value: "7" },
        { label: L("Security alerts", "تنبيهات أمان", locale), value: "0" },
        { label: L("Advanced changes", "تعديلات متقدمة", locale), value: "2" }
      ]
    }
  };

  return models[domain] ?? models.operations!;
}

function HomeView({
  locale,
  scope
}: {
  locale: Locale;
  scope: Scope;
}) {
  const locationRows = [
    { name: L("Balkona Main", "بلكونة الرئيسي", locale), collected: "42,680 EGP", orders: "391", attention: "3", stock: "2", payments: "1", tone: "danger" as const },
    { name: L("Branch 02", "فرع 02", locale), collected: "31,240 EGP", orders: "286", attention: "0", stock: "4", payments: "0", tone: "warn" as const },
    { name: L("Branch 03", "فرع 03", locale), collected: "27,910 EGP", orders: "244", attention: "1", stock: "0", payments: "0", tone: "ok" as const }
  ];

  const metrics = scope === "all"
    ? [
        { label: L("Collected", "المحصّل", locale), value: "101,830 EGP", hint: "+8.4%" },
        { label: L("Orders", "الطلبات", locale), value: "921", hint: "+5.1%" },
        { label: L("Average ticket", "متوسط الفاتورة", locale), value: "111 EGP", hint: "+3.2%" },
        { label: L("Open attention", "تنبيهات مفتوحة", locale), value: "4", hint: L("3 locations", "3 فروع", locale) }
      ]
    : [
        { label: L("Collected", "المحصّل", locale), value: "42,680 EGP", hint: "+6.9%" },
        { label: L("Orders", "الطلبات", locale), value: "391", hint: "+4.2%" },
        { label: L("Average ticket", "متوسط الفاتورة", locale), value: "109 EGP", hint: "+2.1%" },
        { label: L("Open attention", "تنبيهات مفتوحة", locale), value: "3", hint: L("1 urgent", "1 عاجل", locale) }
      ];

  return (
    <div className="grid gap-4">
      <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
        <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-[#8A6031]" />
            <h2 className="text-sm font-semibold">{L("Needs attention", "يحتاج انتباه", locale)}</h2>
            <span className="rounded-full bg-[#2B2B27] px-2 py-0.5 text-[10px] font-bold text-white">3</span>
          </div>
          <span className="text-[11px] text-[#7E7E77]">{L("Live company exceptions", "استثناءات الشركة المباشرة", locale)}</span>
        </div>
        <div className="grid divide-y divide-[#ECECE8] lg:grid-cols-3 lg:divide-x lg:divide-y-0 rtl:lg:divide-x-reverse">
          {[
            [CreditCard, L("Payment needs review", "دفعة تحتاج مراجعة", locale), L("Balkona Main · state still unknown", "بلكونة الرئيسي · الحالة غير محسومة", locale), "danger"],
            [Boxes, L("Stock blocks menu items", "المخزون موقف منتجات", locale), L("Branch 02 · 4 sellability alerts", "فرع 02 · 4 تنبيهات بيع", locale), "warn"],
            [ChefHat, L("Urgent table attention", "تنبيه عاجل على ترابيزة", locale), L("Branch 03 · unresolved", "فرع 03 · غير محلول", locale), "warn"]
          ].map(([Icon, title, body, tone]) => {
            const I = Icon as typeof CreditCard;
            return (
              <button key={String(title)} type="button" className="flex gap-3 px-4 py-4 text-start hover:bg-[#FAFAF8]">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[#F1F1ED] text-[#5F5F59]">
                  <I className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{String(title)}</span>
                  <span className="mt-1 block text-xs leading-5 text-[#777771]">{String(body)}</span>
                  <span className="mt-2 block">
                    <SectionStatus tone={tone as "danger" | "warn"}>{tone === "danger" ? L("Review", "راجع", locale) : L("Attention", "تنبيه", locale)}</SectionStatus>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <MetricBand metrics={metrics} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_300px]">
        <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
          <div className="flex items-center justify-between border-b border-[#E7E7E2] px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">{scope === "all" ? L("Locations", "الفروع", locale) : L("Branch pulse", "حالة الفرع", locale)}</h2>
              <p className="mt-1 text-xs text-[#777771]">{scope === "all" ? L("Which location needs you?", "أي فرع يحتاجك؟", locale) : L("Balkona Main operational snapshot", "ملخص تشغيل بلكونة الرئيسي", locale)}</p>
            </div>
            <MapPin className="size-4 text-[#7A633F]" />
          </div>

          {scope === "all" ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-[#E8E8E4] bg-[#F7F7F4] text-[11px] text-[#6F6F69]">
                    {[L("Location", "الفرع", locale), L("Collected", "المحصّل", locale), L("Orders", "الطلبات", locale), L("Attention", "التنبيهات", locale), L("Stock", "المخزون", locale), L("Payments", "المدفوعات", locale), L("State", "الحالة", locale)].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-start font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECECE8]">
                  {locationRows.map((row) => (
                    <tr key={row.name} className="hover:bg-[#FAFAF8]">
                      <td className="px-4 py-3.5 font-semibold">{row.name}</td>
                      <td className="px-4 py-3.5">{row.collected}</td>
                      <td className="px-4 py-3.5">{row.orders}</td>
                      <td className="px-4 py-3.5">{row.attention}</td>
                      <td className="px-4 py-3.5">{row.stock}</td>
                      <td className="px-4 py-3.5">{row.payments}</td>
                      <td className="px-4 py-3.5"><SectionStatus tone={row.tone}>{row.tone === "danger" ? L("Needs review", "يحتاج مراجعة", locale) : row.tone === "warn" ? L("Attention", "تنبيه", locale) : L("Healthy", "سليم", locale)}</SectionStatus></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid divide-y divide-[#ECECE8] md:grid-cols-2 md:divide-x md:divide-y-0 rtl:md:divide-x-reverse">
              <div className="p-4">
                <p className="text-xs text-[#777771]">{L("Live operations", "التشغيل المباشر", locale)}</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between"><span>{L("Open shift", "وردية مفتوحة", locale)}</span><strong>1</strong></div>
                  <div className="flex justify-between"><span>{L("Active sessions", "جلسات نشطة", locale)}</span><strong>8</strong></div>
                  <div className="flex justify-between"><span>{L("Kitchen tickets", "تذاكر المطبخ", locale)}</span><strong>12</strong></div>
                </div>
              </div>
              <div className="p-4">
                <p className="text-xs text-[#777771]">{L("Exceptions", "الاستثناءات", locale)}</p>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex justify-between"><span>{L("Payment review", "مراجعة دفع", locale)}</span><strong>1</strong></div>
                  <div className="flex justify-between"><span>{L("Low stock", "مخزون منخفض", locale)}</span><strong>2</strong></div>
                  <div className="flex justify-between"><span>{L("Urgent attention", "تنبيه عاجل", locale)}</span><strong>1</strong></div>
                </div>
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-4">
          {[
            [CircleDollarSign, L("Money health", "صحة المدفوعات", locale), L("2 payments need review · 1 reconciliation issue", "دفعتان تحتاجان مراجعة · مشكلة مطابقة واحدة", locale)],
            [Gauge, L("Operations health", "صحة العمليات", locale), L("1 urgent attention · 1 print failure", "تنبيه عاجل واحد · فشل طباعة واحد", locale)],
            [Boxes, L("Stock health", "صحة المخزون", locale), L("6 alerts · 4 menu items affected", "6 تنبيهات · 4 منتجات متأثرة", locale)]
          ].map(([Icon, title, body]) => {
            const I = Icon as typeof CircleDollarSign;
            return (
              <article key={String(title)} className="rounded-lg border border-[#D9D9D4] bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold">{String(title)}</h3>
                    <p className="mt-1 text-xs leading-5 text-[#777771]">{String(body)}</p>
                  </div>
                  <I className="size-4 text-[#72634F]" />
                </div>
                <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#565650] hover:underline">
                  {L("Investigate", "فتح التفاصيل", locale)} <ArrowUpRight className="size-3.5" />
                </button>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-[#D9D9D4] bg-white p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">{L("Collected trend", "اتجاه التحصيل", locale)}</h2>
              <p className="mt-1 text-xs text-[#777771]">{L("Today · company scope", "اليوم · نطاق الشركة", locale)}</p>
            </div>
            <CircleDollarSign className="size-4 text-[#72634F]" />
          </div>
          <div className="mt-4 h-44 bg-[#F8F8F5] p-3">
            <svg viewBox="0 0 720 170" className="h-full w-full" role="img" aria-label={L("Collected trend", "اتجاه التحصيل", locale)}>
              <line x1="0" y1="140" x2="720" y2="140" stroke="#D8D8D3" />
              <line x1="0" y1="90" x2="720" y2="90" stroke="#E3E3DE" />
              <line x1="0" y1="40" x2="720" y2="40" stroke="#E3E3DE" />
              <polyline points="0,142 72,132 144,120 216,126 288,98 360,104 432,82 504,67 576,73 648,44 720,30" fill="none" stroke="#7D6A51" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-[#D9D9D4] bg-white">
          <div className="border-b border-[#E7E7E2] px-4 py-3.5">
            <h2 className="text-sm font-semibold">{L("Meaningful activity", "نشاط مهم", locale)}</h2>
          </div>
          <div className="divide-y divide-[#ECECE8]">
            {[
              [ShieldCheck, L("Reconciliation issue acknowledged", "تمت مراجعة مشكلة مطابقة", locale), L("9 min ago", "منذ 9 دقائق", locale)],
              [Boxes, L("Two items became unavailable", "منتجان أصبحا غير متاحين", locale), L("18 min ago", "منذ 18 دقيقة", locale)],
              [WandSparkles, L("Smart Cashier rule updated", "تم تعديل قاعدة الكاشير الذكي", locale), L("41 min ago", "منذ 41 دقيقة", locale)]
            ].map(([Icon, title, meta]) => {
              const I = Icon as typeof ShieldCheck;
              return (
                <div key={String(title)} className="flex gap-3 px-4 py-3">
                  <I className="mt-0.5 size-4 shrink-0 text-[#6D675E]" />
                  <div>
                    <p className="text-xs font-medium">{String(title)}</p>
                    <p className="mt-1 text-[11px] text-[#85857F]">{String(meta)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export function OfficeHomePrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [domain, setDomain] = useState<Domain>("home");
  const [scope, setScope] = useState<Scope>("all");
  const [activeSection, setActiveSection] = useState<Record<string, number>>({});

  const selected = domains.find((item) => item.id === domain)!;
  const sectionIndex = activeSection[domain] ?? 0;
  const sections = domain === "home" ? [] : subnav[domain];
  const section = sections[sectionIndex];

  const model = useMemo(() => {
    if (domain === "home") return null;
    return makeModel(domain, L(section.en, section.ar, locale), locale, scope);
  }, [domain, locale, scope, section]);

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#F5F5F2] text-[#20201D]">
      <div className="grid min-h-screen lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="border-e border-[#D8D8D3] bg-[#ECECE8] px-3 py-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-8 items-center justify-center rounded-md border border-[#CFCFC9] bg-[#F7F7F4] text-xs font-black text-[#292925]">
              B
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[-0.01em]">Balcona</p>
              <p className="text-[10px] text-[#75756F]">{L("Office", "الإدارة", locale)}</p>
            </div>
          </div>

          <nav className="mt-7 grid gap-0.5">
            {domains.map((item) => {
              const Icon = item.icon;
              const active = item.id === domain;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDomain(item.id)}
                  className={`flex min-h-9 items-center gap-2.5 rounded-md px-2.5 text-sm transition ${
                    active
                      ? "bg-white font-semibold text-[#20201D] shadow-[0_1px_0_rgba(0,0,0,.04)]"
                      : "text-[#64645E] hover:bg-[#E3E3DE] hover:text-[#20201D]"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-[#5F5F59]" : "text-[#85857F]"}`} />
                  <span>{L(item.en, item.ar, locale)}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-7 border-t border-[#D4D4CF] pt-4">
            <p className="px-2.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8A8A84]">
              {L("Prototype · product truth only", "نموذج · قدرات حقيقية فقط", locale)}
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b border-[#DDDDD8] bg-[#F7F7F4]/96 px-4 backdrop-blur md:px-6">
            <button
              type="button"
              onClick={() => setScope((value) => value === "all" ? "main" : "all")}
              className="flex min-h-9 min-w-[170px] items-center justify-between gap-3 rounded-md border border-[#D6D6D1] bg-white px-3 text-xs font-semibold"
            >
              <span className="flex items-center gap-2">
                <Building2 className="size-3.5 text-[#6A6258]" />
                {scope === "all" ? L("All locations", "كل الفروع", locale) : L("Balkona Main", "بلكونة الرئيسي", locale)}
              </span>
              <ChevronDown className="size-3.5 text-[#7B7B75]" />
            </button>

            <div className="mx-auto hidden w-full max-w-xl items-center gap-2 rounded-md border border-[#D8D8D3] bg-white px-3 md:flex">
              <Search className="size-3.5 text-[#888881]" />
              <input
                aria-label={L("Search Balcona", "ابحث في بلكونة", locale)}
                placeholder={L("Search orders, payments, items, staff…", "ابحث في الطلبات والمدفوعات والمنتجات والفريق…", locale)}
                className="min-h-9 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-[#9A9A94]"
              />
              <Command className="size-3.5 text-[#999993]" />
            </div>

            <button type="button" className="relative flex size-9 items-center justify-center rounded-md border border-[#D6D6D1] bg-white text-[#575751]">
              <Bell className="size-4" />
              <span className="absolute -end-1 -top-1 flex size-4 items-center justify-center rounded-full bg-[#3B3B36] text-[9px] font-bold text-white">3</span>
            </button>

            <button
              type="button"
              onClick={() => setLocale((value) => value === "en" ? "ar" : "en")}
              className="min-h-9 rounded-md border border-[#D6D6D1] bg-white px-3 text-[11px] font-bold"
            >
              {locale === "en" ? "العربية" : "EN"}
            </button>
          </header>

          <main className="mx-auto w-full max-w-[1480px] px-4 py-5 md:px-6 lg:px-7">
            <section className="flex flex-col gap-3 border-b border-[#DADAD5] pb-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7C746B]">
                  Balcona Office · {scope === "all" ? L("All locations", "كل الفروع", locale) : L("Balkona Main", "بلكونة الرئيسي", locale)}
                </p>
                <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.03em]">
                  {L(selected.en, selected.ar, locale)}
                </h1>
                <p className="mt-1.5 text-xs leading-5 text-[#74746E]">
                  {domain === "home"
                    ? L("Company pulse, exceptions, and the places that need a decision.", "صحة الشركة والاستثناءات والأماكن التي تحتاج قرارًا.", locale)
                    : model?.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-md border border-[#D7D7D2] bg-white px-3 py-2 text-[11px] font-semibold text-[#666660]">
                  {L("Today", "اليوم", locale)}
                </span>
                <button type="button" className="rounded-md bg-[#2A2A26] px-3 py-2 text-[11px] font-semibold text-white">
                  {L("Primary action", "إجراء رئيسي", locale)}
                </button>
              </div>
            </section>

            {domain !== "home" ? (
              <div className="mt-3 flex gap-1 overflow-x-auto border-b border-[#DEDED9] pb-2">
                {sections.map((item, index) => (
                  <button
                    key={item.en}
                    type="button"
                    onClick={() => setActiveSection((current) => ({ ...current, [domain]: index }))}
                    className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ${
                      index === sectionIndex
                        ? "bg-[#E5E5E0] text-[#262623]"
                        : "text-[#696963] hover:bg-[#EFEFEB]"
                    }`}
                  >
                    {L(item.en, item.ar, locale)}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="mt-4">
              {domain === "home" ? (
                <HomeView locale={locale} scope={scope} />
              ) : model ? (
                <div className="grid gap-4">
                  <MetricBand metrics={model.metrics} />
                  <DataPanel model={model} locale={locale} />
                </div>
              ) : null}
            </div>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-[#DADAD5] pt-3 text-[10px] text-[#84847E]">
              <span>{L("Office visual direction A · locked", "اتجاه Office A · مثبت", locale)}</span>
              <span>{L("Static prototype data · no production behavior changed", "بيانات نموذجية · بدون تغيير سلوك الإنتاج", locale)}</span>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
