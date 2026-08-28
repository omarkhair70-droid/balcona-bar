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
import { useState } from "react";

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

function makeModel(domain: Domain, sectionKey: string, sectionTitle: string, locale: Locale, scope: Scope): SectionModel {
  const scopeName = scope === "all" ? L("All locations", "كل الفروع", locale) : L("Balkona Main", "بلكونة الرئيسي", locale);
  const commonMetrics = [
    { label: L("Collected", "المحصّل", locale), value: scope === "all" ? "101,830 EGP" : "42,680 EGP", hint: L("today", "اليوم", locale) },
    { label: L("Orders", "الطلبات", locale), value: scope === "all" ? "921" : "391", hint: "+5.1%" },
    { label: L("Average ticket", "متوسط الفاتورة", locale), value: "111 EGP", hint: "+3.2%" },
    { label: L("Open attention", "تنبيهات مفتوحة", locale), value: scope === "all" ? "4" : "3", hint: L("live operational signals", "تنبيهات تشغيل مباشرة", locale) }
  ];

  const models: Partial<Record<Domain, SectionModel>> = {
    operations: {
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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
      title: sectionTitle,
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

  const base = models[domain] ?? models.operations!;

  const specific = getSectionSpecificModel(
    domain,
    sectionKey,
    sectionTitle,
    locale,
    scope,
    base
  );

  return specific;
}

function getSectionSpecificModel(
  domain: Domain,
  sectionKey: string,
  sectionTitle: string,
  locale: Locale,
  scope: Scope,
  base: SectionModel
): SectionModel {
  const scopeName =
    scope === "all"
      ? L("All locations", "كل الفروع", locale)
      : L("Balkona Main", "بلكونة الرئيسي", locale);

  const withBase = (override: Partial<SectionModel>): SectionModel => ({
    ...base,
    ...override,
    title: sectionTitle
  });

  if (domain === "operations") {
    switch (sectionKey) {
      case "Orders":
        return withBase({
          description: L(
            `Order lifecycle across ${scopeName}; investigate exceptions here while live handling stays in Service.`,
            `دورة حياة الطلبات عبر ${scopeName}؛ التحقيق هنا بينما التنفيذ اللحظي يظل في Service.`,
            locale
          ),
          metrics: [
            { label: L("Submitted", "مُرسل", locale), value: "54" },
            { label: L("Accepted", "مقبول", locale), value: "47" },
            { label: L("Ready", "جاهز", locale), value: "12" },
            { label: L("Rejected / cancelled", "مرفوض / ملغي", locale), value: "3" }
          ],
          columns: [
            L("Order", "الطلب", locale),
            L("Location", "الفرع", locale),
            L("Total", "الإجمالي", locale),
            L("Age", "العمر", locale)
          ],
          rows: [
            { primary: "#ORD-10428", secondary: L("Table T12", "ترابيزة T12", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "385 EGP", "7m"], tone: "warn" },
            { primary: "#ORD-10427", secondary: L("Table T08", "ترابيزة T08", locale), values: [L("Branch 02", "فرع 02", locale), "240 EGP", "4m"], tone: "ok" },
            { primary: "#ORD-10421", secondary: L("Table T04", "ترابيزة T04", locale), values: [L("Branch 03", "فرع 03", locale), "190 EGP", "16m"], tone: "danger" }
          ]
        });
      case "Service & Attention":
        return withBase({
          description: L(
            "Explicit waiter requests and computed attention signals, grouped for manager investigation.",
            "طلبات النادل الصريحة وتنبيهات الانتباه المحسوبة للمراجعة الإدارية.",
            locale
          ),
          metrics: [
            { label: L("Active attention", "تنبيهات نشطة", locale), value: "4" },
            { label: L("Urgent", "عاجل", locale), value: "1" },
            { label: L("Open waiter calls", "طلبات نادل مفتوحة", locale), value: "3" },
            { label: L("Avg resolution", "متوسط الحل", locale), value: "2m 14s" }
          ],
          columns: [
            L("Attention", "التنبيه", locale),
            L("Table", "الترابيزة", locale),
            L("Location", "الفرع", locale),
            L("Age", "العمر", locale)
          ],
          rows: [
            { primary: L("Guest requested waiter", "الضيف طلب نادل", locale), secondary: L("Explicit waiter call", "طلب نادل مباشر", locale), values: ["T12", L("Balkona Main", "بلكونة الرئيسي", locale), "6m"], tone: "danger" },
            { primary: L("Bill request waiting", "طلب فاتورة ينتظر", locale), secondary: L("Computed attention", "تنبيه محسوب", locale), values: ["T07", L("Branch 03", "فرع 03", locale), "4m"], tone: "warn" },
            { primary: L("Ready order not served", "طلب جاهز لم يُقدّم", locale), secondary: L("Computed attention", "تنبيه محسوب", locale), values: ["T03", L("Branch 02", "فرع 02", locale), "3m"], tone: "warn" }
          ]
        });
      case "Shifts & Cash":
        return withBase({
          description: L(
            "Open/closed cashier shifts, cash movement, X/Z reporting, and over/short investigation.",
            "ورديات الكاشير وحركة الكاش وتقارير X/Z ومراجعة فروق الصندوق.",
            locale
          ),
          metrics: [
            { label: L("Open shifts", "ورديات مفتوحة", locale), value: "3" },
            { label: L("Cash collected", "كاش محصل", locale), value: "41,250 EGP" },
            { label: L("Over / short", "زيادة / عجز", locale), value: "0 EGP" },
            { label: L("Latest Z", "آخر Z", locale), value: "Z-00984" }
          ],
          columns: [
            L("Shift", "الوردية", locale),
            L("Location", "الفرع", locale),
            L("Opened", "بدأت", locale),
            L("Expected cash", "الكاش المتوقع", locale)
          ],
          rows: [
            { primary: "#SHIFT-884", secondary: L("Open", "مفتوحة", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "09:02", "13,840 EGP"], tone: "ok" },
            { primary: "#SHIFT-883", secondary: L("Open", "مفتوحة", locale), values: [L("Branch 02", "فرع 02", locale), "09:18", "11,260 EGP"], tone: "ok" },
            { primary: "#SHIFT-879", secondary: "Z-00984", values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Closed 01:08", "أغلقت 01:08", locale), "0 EGP diff"], tone: "neutral" }
          ]
        });
      case "Kitchen Operations":
        return withBase({
          description: L(
            "Production exceptions, ticket/station state, and print reliability without replacing the live KDS.",
            "استثناءات الإنتاج وحالة التذاكر والمحطات والطباعة بدون استبدال KDS اللحظي.",
            locale
          ),
          metrics: [
            { label: L("Prep tasks", "مهام تحضير", locale), value: "18" },
            { label: L("Kitchen tickets", "تذاكر مطبخ", locale), value: "12" },
            { label: L("Late", "متأخر", locale), value: "2" },
            { label: L("Failed print jobs", "طباعة فاشلة", locale), value: "1" }
          ],
          columns: [
            L("Production item", "عنصر إنتاج", locale),
            L("Station", "المحطة", locale),
            L("Location", "الفرع", locale),
            L("Age", "العمر", locale)
          ],
          rows: [
            { primary: "#KT-8821", secondary: L("3 items", "3 منتجات", locale), values: [L("Hot kitchen", "المطبخ الساخن", locale), L("Balkona Main", "بلكونة الرئيسي", locale), "14m"], tone: "danger" },
            { primary: "#KT-8818", secondary: L("2 drinks", "مشروبان", locale), values: [L("Bar", "البار", locale), L("Branch 02", "فرع 02", locale), "7m"], tone: "warn" },
            { primary: "#PRINT-441", secondary: L("Ticket print", "طباعة تذكرة", locale), values: [L("Bar printer", "طابعة البار", locale), L("Branch 02", "فرع 02", locale), "5m"], tone: "danger" }
          ]
        });
      case "Smart Cashier":
        return withBase({
          description: L(
            "Automation settings, review reasons, and auto-accept behavior. Live cashier work stays in Service.",
            "إعدادات الأتمتة وأسباب المراجعة وسلوك القبول التلقائي. عمل الكاشير اللحظي يظل في Service.",
            locale
          ),
          metrics: [
            { label: L("Evaluated", "تم تقييمه", locale), value: "312" },
            { label: L("Auto-accepted", "مقبول تلقائيًا", locale), value: "84%" },
            { label: L("Needs review", "يحتاج مراجعة", locale), value: "6" },
            { label: L("Active rules", "قواعد نشطة", locale), value: "4" }
          ],
          columns: [
            L("Review / rule", "المراجعة / القاعدة", locale),
            L("Scope", "النطاق", locale),
            L("Decision", "القرار", locale),
            L("Reason", "السبب", locale)
          ],
          rows: [
            { primary: "#SC-2081", secondary: L("Order review", "مراجعة طلب", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Manual review", "مراجعة يدوية", locale), L("Payment state uncertain", "حالة الدفع غير محسومة", locale)], tone: "danger" },
            { primary: L("Auto-accept standard dine-in", "قبول تلقائي للطلبات العادية", locale), secondary: L("Rule", "قاعدة", locale), values: [L("Company default", "إعداد الشركة", locale), L("Enabled", "مفعل", locale), L("Eligible orders", "طلبات مؤهلة", locale)], tone: "ok" },
            { primary: "#SC-2072", secondary: L("Order review", "مراجعة طلب", locale), values: [L("Branch 03", "فرع 03", locale), L("Accepted", "مقبول", locale), L("Staff confirmed exception", "الموظف أكد الاستثناء", locale)], tone: "neutral" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "catalog") {
    switch (sectionKey) {
      case "Categories":
        return withBase({
          description: L("Category structure and ordering across the company catalog.", "هيكل أقسام المنيو وترتيبها على مستوى الشركة.", locale),
          columns: [L("Category", "القسم", locale), L("Items", "المنتجات", locale), L("Active", "نشط", locale), L("Sort order", "الترتيب", locale)],
          rows: [
            { primary: L("Coffee", "قهوة", locale), values: ["28", "28", "10"], tone: "ok" },
            { primary: L("Cold drinks", "مشروبات باردة", locale), values: ["21", "19", "20"], tone: "warn" },
            { primary: L("Desserts", "حلويات", locale), values: ["14", "13", "30"], tone: "warn" }
          ]
        });
      case "Modifiers":
        return withBase({
          description: L("Modifier groups, selection rules, options, and item links.", "مجموعات الإضافات وقواعد الاختيار والخيارات وربطها بالمنتجات.", locale),
          metrics: [
            { label: L("Groups", "مجموعات", locale), value: "18" },
            { label: L("Required", "إجباري", locale), value: "5" },
            { label: L("Options", "خيارات", locale), value: "63" },
            { label: L("Linked items", "منتجات مرتبطة", locale), value: "24" }
          ],
          columns: [L("Modifier group", "مجموعة الإضافة", locale), L("Selection", "الاختيار", locale), L("Options", "الخيارات", locale), L("Linked items", "منتجات مرتبطة", locale)],
          rows: [
            { primary: L("Milk choice", "اختيار اللبن", locale), values: [L("Single · required", "واحد · إجباري", locale), "4", "12"], tone: "ok" },
            { primary: L("Extra shot", "شوت إضافي", locale), values: [L("Single · optional", "واحد · اختياري", locale), "3", "18"], tone: "ok" },
            { primary: L("Dessert add-ons", "إضافات الحلويات", locale), values: [L("Multiple · optional", "متعدد · اختياري", locale), "5", "6"], tone: "neutral" }
          ]
        });
      case "Availability":
        return withBase({
          description: L("Effective sellability after catalog state, branch overrides, and inventory truth.", "الإتاحة الفعلية بعد حالة المنيو وتعديلات الفروع وحقيقة المخزون.", locale),
          metrics: [
            { label: L("Available", "متاح", locale), value: "79" },
            { label: L("Unavailable", "غير متاح", locale), value: "7" },
            { label: L("Stock blocked", "موقوف بالمخزون", locale), value: "4" },
            { label: L("Manual override", "تعديل يدوي", locale), value: "3" }
          ],
          columns: [L("Item", "المنتج", locale), L("Location", "الفرع", locale), L("Stock", "المخزون", locale), L("Effective availability", "الإتاحة الفعلية", locale)],
          rows: [
            { primary: L("Spanish Latte", "سبانيش لاتيه", locale), values: [L("All locations", "كل الفروع", locale), L("In stock", "متوفر", locale), L("Sellable", "متاح للبيع", locale)], tone: "ok" },
            { primary: L("Basque Cheesecake", "باسك تشيزكيك", locale), values: [L("Branch 02", "فرع 02", locale), L("Out of stock", "نفد المخزون", locale), L("Blocked", "موقوف", locale)], tone: "danger" },
            { primary: L("Iced Matcha", "آيس ماتشا", locale), values: [L("Branch 03", "فرع 03", locale), L("Low stock", "منخفض", locale), L("Sellable", "متاح للبيع", locale)], tone: "warn" }
          ]
        });
      case "Branch Overrides":
        return withBase({
          description: L("Company defaults with explicit branch-level price, visibility, and availability overrides.", "إعدادات الشركة مع تعديلات سعر وظهور وإتاحة واضحة لكل فرع.", locale),
          columns: [L("Item", "المنتج", locale), L("Branch", "الفرع", locale), L("Company default", "إعداد الشركة", locale), L("Override", "تعديل الفرع", locale)],
          rows: [
            { primary: L("Spanish Latte", "سبانيش لاتيه", locale), values: [L("Branch 02", "فرع 02", locale), "95 EGP", "100 EGP"], tone: "neutral" },
            { primary: L("Basque Cheesecake", "باسك تشيزكيك", locale), values: [L("Branch 02", "فرع 02", locale), L("Visible", "ظاهر", locale), L("Hidden", "مخفي", locale)], tone: "warn" },
            { primary: L("Iced Matcha", "آيس ماتشا", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Inherited", "موروث", locale), L("Available", "متاح", locale)], tone: "ok" }
          ]
        });
      case "Preview":
        return withBase({
          description: L("Guest-facing catalog preview checks before changes reach the live experience.", "فحوصات معاينة المنيو للضيف قبل وصول التغييرات للتجربة الحية.", locale),
          metrics: [
            { label: L("Preview issues", "مشاكل المعاينة", locale), value: "1" },
            { label: L("Missing images", "صور ناقصة", locale), value: "1" },
            { label: L("Missing prices", "أسعار ناقصة", locale), value: "0" },
            { label: L("Grounding ready", "جاهزية AI", locale), value: "Yes" }
          ],
          columns: [L("Check", "الفحص", locale), L("Object", "العنصر", locale), L("Location", "الفرع", locale), L("Detail", "التفصيل", locale)],
          rows: [
            { primary: L("Missing image", "صورة ناقصة", locale), values: [L("Basque Cheesecake", "باسك تشيزكيك", locale), L("Company catalog", "منيو الشركة", locale), L("Guest card has no media", "كارت الضيف بلا صورة", locale)], tone: "warn" },
            { primary: L("AI grounding", "ربط AI", locale), values: [L("Active menu", "المنيو النشطة", locale), L("All locations", "كل الفروع", locale), L("Ready", "جاهز", locale)], tone: "ok" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "inventory") {
    switch (sectionKey) {
      case "Alerts":
        return withBase({
          description: L("Low/out-of-stock exceptions prioritized by sellability impact.", "استثناءات المخزون المنخفض والنافد مرتبة حسب تأثيرها على البيع.", locale),
          columns: [L("Item", "العنصر", locale), L("Location", "الفرع", locale), L("On hand", "المتاح", locale), L("Threshold", "الحد", locale)],
          rows: [
            { primary: L("Espresso beans", "حبوب إسبريسو", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "2.4 kg", "4 kg"], tone: "danger" },
            { primary: L("Oat milk", "لبن شوفان", locale), values: [L("Branch 02", "فرع 02", locale), "9 L", "12 L"], tone: "warn" },
            { primary: L("Basque base", "خليط الباسك", locale), values: [L("Branch 02", "فرع 02", locale), "0", "3"], tone: "danger" }
          ]
        });
      case "Movements":
        return withBase({
          description: L("Auditable stock movement history: sales consumption, receiving, waste, and corrections.", "سجل حركة مخزون قابل للمراجعة: استهلاك مبيعات واستلام وهالك وتصحيحات.", locale),
          columns: [L("Movement", "الحركة", locale), L("Item", "العنصر", locale), L("Location", "الفرع", locale), L("Quantity", "الكمية", locale)],
          rows: [
            { primary: "#MOV-4821", secondary: L("Sale consumption", "استهلاك بيع", locale), values: [L("Espresso beans", "حبوب إسبريسو", locale), L("Balkona Main", "بلكونة الرئيسي", locale), "-0.018 kg"], tone: "neutral" },
            { primary: "#MOV-4819", secondary: L("Receiving", "استلام", locale), values: [L("Oat milk", "لبن شوفان", locale), L("Branch 02", "فرع 02", locale), "+24 L"], tone: "ok" },
            { primary: "#MOV-4804", secondary: L("Waste", "هالك", locale), values: [L("Basque base", "خليط الباسك", locale), L("Branch 02", "فرع 02", locale), "-2"], tone: "warn" }
          ]
        });
      case "Requirements":
        return withBase({
          description: L("Menu-to-inventory requirements that determine whether items can be sold.", "متطلبات ربط المنيو بالمخزون التي تحدد إمكانية بيع المنتجات.", locale),
          columns: [L("Menu item", "منتج المنيو", locale), L("Inventory item", "عنصر المخزون", locale), L("Per item", "لكل منتج", locale), L("Impact", "التأثير", locale)],
          rows: [
            { primary: L("Spanish Latte", "سبانيش لاتيه", locale), values: [L("Espresso beans", "حبوب إسبريسو", locale), "18 g", L("Required", "إجباري", locale)], tone: "ok" },
            { primary: L("Iced Matcha", "آيس ماتشا", locale), values: [L("Oat milk", "لبن شوفان", locale), "220 ml", L("Required", "إجباري", locale)], tone: "warn" },
            { primary: L("Basque Cheesecake", "باسك تشيزكيك", locale), values: [L("Basque base", "خليط الباسك", locale), "1 piece", L("Blocked", "موقوف", locale)], tone: "danger" }
          ]
        });
      case "Suppliers":
        return withBase({
          description: L("Supplier master data and procurement relationship status.", "بيانات الموردين وحالة علاقة الشراء.", locale),
          columns: [L("Supplier", "المورد", locale), L("Items", "العناصر", locale), L("Open POs", "أوامر شراء مفتوحة", locale), L("Last receipt", "آخر استلام", locale)],
          rows: [
            { primary: L("Coffee Supply Co.", "مورد القهوة", locale), values: ["8", "1", L("Today", "اليوم", locale)], tone: "ok" },
            { primary: L("Fresh Dairy", "فريش ديري", locale), values: ["12", "2", L("Yesterday", "أمس", locale)], tone: "ok" },
            { primary: L("Bakery Partner", "مورد المخبوزات", locale), values: ["6", "1", L("3 days ago", "منذ 3 أيام", locale)], tone: "warn" }
          ]
        });
      case "Purchase Orders":
        return withBase({
          description: L("Purchase order lifecycle from draft to submitted, receiving, and cancellation.", "دورة أمر الشراء من المسودة للإرسال والاستلام والإلغاء.", locale),
          metrics: [
            { label: L("Open POs", "أوامر مفتوحة", locale), value: "4" },
            { label: L("Draft", "مسودة", locale), value: "1" },
            { label: L("Submitted", "مُرسل", locale), value: "2" },
            { label: L("Partially received", "مستلم جزئيًا", locale), value: "1" }
          ],
          columns: [L("Purchase order", "أمر الشراء", locale), L("Supplier", "المورد", locale), L("Location", "الفرع", locale), L("Lines", "البنود", locale)],
          rows: [
            { primary: "#PO-00841", values: [L("Coffee Supply Co.", "مورد القهوة", locale), L("Balkona Main", "بلكونة الرئيسي", locale), "7"], tone: "warn" },
            { primary: "#PO-00839", values: [L("Fresh Dairy", "فريش ديري", locale), L("Branch 02", "فرع 02", locale), "5"], tone: "neutral" },
            { primary: "#PO-00832", values: [L("Bakery Partner", "مورد المخبوزات", locale), L("Branch 03", "فرع 03", locale), "4"], tone: "ok" }
          ]
        });
      case "Receiving":
        return withBase({
          description: L("Receive against purchase orders and surface quantity discrepancies immediately.", "استلام مقابل أوامر الشراء وإظهار فروق الكميات فورًا.", locale),
          columns: [L("Receipt", "الاستلام", locale), L("PO", "أمر الشراء", locale), L("Supplier", "المورد", locale), L("Result", "النتيجة", locale)],
          rows: [
            { primary: "#REC-00391", values: ["#PO-00832", L("Bakery Partner", "مورد المخبوزات", locale), L("4/4 lines received", "4/4 بنود مستلمة", locale)], tone: "ok" },
            { primary: "#REC-00389", values: ["#PO-00841", L("Coffee Supply Co.", "مورد القهوة", locale), L("5/7 lines · discrepancy", "5/7 بنود · فرق", locale)], tone: "warn" },
            { primary: L("Awaiting receipt", "بانتظار الاستلام", locale), values: ["#PO-00839", L("Fresh Dairy", "فريش ديري", locale), L("Not received", "لم يُستلم", locale)], tone: "neutral" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "locations") {
    switch (sectionKey) {
      case "Floors & Tables":
        return withBase({
          description: L("Administrative floor/table structure plus live session context where useful.", "هيكل الأدوار والترابيزات إداريًا مع سياق الجلسات النشطة عند الحاجة.", locale),
          columns: [L("Table", "الترابيزة", locale), L("Floor", "الدور", locale), L("Location", "الفرع", locale), L("Session", "الجلسة", locale)],
          rows: [
            { primary: "T12", secondary: L("4 seats", "4 مقاعد", locale), values: [L("Ground", "الأرضي", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Active · 38m", "نشطة · 38د", locale)], tone: "warn" },
            { primary: "T08", secondary: L("2 seats", "مقعدان", locale), values: [L("Ground", "الأرضي", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("No active session", "لا توجد جلسة", locale)], tone: "ok" },
            { primary: "T04", secondary: L("6 seats", "6 مقاعد", locale), values: [L("Terrace", "التراس", locale), L("Branch 02", "فرع 02", locale), L("Maintenance", "صيانة", locale)], tone: "danger" }
          ]
        });
      case "QR":
        return withBase({
          description: L("Table QR identity, readiness, preview, and recovery actions.", "هوية QR للترابيزة وجاهزيته ومعاينته وإجراءات الاستعادة.", locale),
          columns: [L("Table", "الترابيزة", locale), L("Location", "الفرع", locale), L("QR token", "رمز QR", locale), L("Preview", "المعاينة", locale)],
          rows: [
            { primary: "T12", values: [L("Balkona Main", "بلكونة الرئيسي", locale), "…A91F", L("Ready", "جاهز", locale)], tone: "ok" },
            { primary: "T08", values: [L("Balkona Main", "بلكونة الرئيسي", locale), "…C24B", L("Ready", "جاهز", locale)], tone: "ok" },
            { primary: "T21", values: [L("Branch 02", "فرع 02", locale), "—", L("Missing QR", "QR ناقص", locale)], tone: "danger" }
          ]
        });
      case "Zones":
        return withBase({
          description: L("Venue zones used by experience/content logic without turning locations into a creative editor.", "مناطق المكان المستخدمة في منطق التجربة والمحتوى بدون تحويل الفروع لأداة تصميم.", locale),
          columns: [L("Zone", "المنطقة", locale), L("Location", "الفرع", locale), L("Tables", "الترابيزات", locale), L("Usage", "الاستخدام", locale)],
          rows: [
            { primary: L("Terrace", "التراس", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "12", L("Experience profile", "ملف تجربة", locale)], tone: "ok" },
            { primary: L("Main hall", "الصالة الرئيسية", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "16", L("Default", "افتراضي", locale)], tone: "neutral" },
            { primary: L("Quiet zone", "المنطقة الهادئة", locale), values: [L("Branch 03", "فرع 03", locale), "8", L("Content trigger", "محفز محتوى", locale)], tone: "ok" }
          ]
        });
      case "Devices & Stations":
        return withBase({
          description: L("Operational device and printer-station configuration outside the live KDS.", "إعداد الأجهزة ومحطات الطباعة بعيدًا عن KDS اللحظي.", locale),
          columns: [L("Device / station", "الجهاز / المحطة", locale), L("Kind", "النوع", locale), L("Location", "الفرع", locale), L("Route", "المسار", locale)],
          rows: [
            { primary: L("Main kitchen", "المطبخ الرئيسي", locale), values: [L("Printer station", "محطة طباعة", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Kitchen tickets", "تذاكر مطبخ", locale)], tone: "ok" },
            { primary: L("Bar printer", "طابعة البار", locale), values: [L("Printer station", "محطة طباعة", locale), L("Branch 02", "فرع 02", locale), L("Bar tickets", "تذاكر البار", locale)], tone: "danger" },
            { primary: L("Kitchen display", "شاشة المطبخ", locale), values: [L("KDS device", "جهاز KDS", locale), L("Branch 03", "فرع 03", locale), L("Hot kitchen", "المطبخ الساخن", locale)], tone: "ok" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "team") {
    switch (sectionKey) {
      case "Roles & Access":
        return withBase({
          description: L("Human-readable role/access summaries first; granular permissions remain secondary.", "ملخصات أدوار وصلاحيات مفهومة أولًا، والتفاصيل الدقيقة ثانوية.", locale),
          columns: [L("Person", "الشخص", locale), L("Role", "الدور", locale), L("Scope", "النطاق", locale), L("Access summary", "ملخص الصلاحية", locale)],
          rows: [
            { primary: "Omar Khair", values: [L("Owner", "مالك", locale), L("Company", "الشركة", locale), L("All Office + Service oversight", "كل الإدارة + متابعة التشغيل", locale)], tone: "ok" },
            { primary: "Mariam Hassan", values: [L("Branch manager", "مدير فرع", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Operations, inventory, team", "عمليات ومخزون وفريق", locale)], tone: "ok" },
            { primary: "Youssef Ali", values: [L("Cashier", "كاشير", locale), L("Branch 02", "فرع 02", locale), L("Service only", "Service فقط", locale)], tone: "neutral" }
          ]
        });
      case "Invites":
        return withBase({
          description: L("Pending staff invites and their intended role/location access.", "دعوات الموظفين المعلقة والدور وصلاحية الفرع المقصودة.", locale),
          columns: [L("Invite", "الدعوة", locale), L("Role", "الدور", locale), L("Location", "الفرع", locale), L("Created", "أُنشئت", locale)],
          rows: [
            { primary: "nour@example.com", values: [L("Waiter", "ويتر", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Today", "اليوم", locale)], tone: "warn" },
            { primary: "ali@example.com", values: [L("Kitchen", "مطبخ", locale), L("Branch 02", "فرع 02", locale), L("Yesterday", "أمس", locale)], tone: "warn" },
            { primary: "salma@example.com", values: [L("Menu admin", "مسؤول منيو", locale), L("Company", "الشركة", locale), L("2 days ago", "منذ يومين", locale)], tone: "neutral" }
          ]
        });
      case "Location Access":
        return withBase({
          description: L("Which locations each person can act in, independent of the navigation structure.", "الفروع التي يستطيع كل شخص العمل فيها بعيدًا عن بنية التنقل.", locale),
          columns: [L("Person", "الشخص", locale), L("Role", "الدور", locale), L("Locations", "الفروع", locale), L("Mode", "النمط", locale)],
          rows: [
            { primary: "Omar Khair", values: [L("Owner", "مالك", locale), L("3 locations", "3 فروع", locale), L("Company-wide", "كل الشركة", locale)], tone: "ok" },
            { primary: "Mariam Hassan", values: [L("Branch manager", "مدير فرع", locale), L("Balkona Main", "بلكونة الرئيسي", locale), L("Assigned", "مُعيّن", locale)], tone: "ok" },
            { primary: "Youssef Ali", values: [L("Cashier", "كاشير", locale), L("Branch 02", "فرع 02", locale), L("Assigned", "مُعيّن", locale)], tone: "neutral" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "money") {
    switch (sectionKey) {
      case "Transactions":
        return base;
      case "Bills":
        return withBase({
          description: L("Bill lifecycle and collection state across locations.", "دورة حياة الفاتورة وحالة التحصيل عبر الفروع.", locale),
          columns: [L("Bill", "الفاتورة", locale), L("Location", "الفرع", locale), L("Total", "الإجمالي", locale), L("Collection", "التحصيل", locale)],
          rows: [
            { primary: "#B-8821", secondary: L("Table T12", "ترابيزة T12", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "385 EGP", L("Paid", "مدفوعة", locale)], tone: "ok" },
            { primary: "#B-8819", secondary: L("Table T07", "ترابيزة T07", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), "220 EGP", L("Payment unknown", "الدفع غير محسوم", locale)], tone: "danger" },
            { primary: "#B-8812", secondary: L("Table T03", "ترابيزة T03", locale), values: [L("Branch 02", "فرع 02", locale), "145 EGP", L("Cash", "كاش", locale)], tone: "ok" }
          ]
        });
      case "Refunds & Operations":
        return withBase({
          description: L("Refund, void, capture, and provider-operation lifecycle with explicit high-risk state.", "دورة الاسترجاع والإلغاء والتحصيل وعمليات شركة الدفع بحالة واضحة للمخاطر.", locale),
          columns: [L("Operation", "العملية", locale), L("Payment", "الدفع", locale), L("Amount", "المبلغ", locale), L("Result", "النتيجة", locale)],
          rows: [
            { primary: "#OP-381", secondary: L("Refund", "استرجاع", locale), values: ["#PAY-24061", "120 EGP", L("Succeeded", "نجحت", locale)], tone: "ok" },
            { primary: "#OP-379", secondary: L("Recovery inquiry", "استعلام استعادة", locale), values: ["#PAY-24079", "220 EGP", L("Provider unknown", "شركة الدفع غير محسومة", locale)], tone: "danger" },
            { primary: "#OP-372", secondary: L("Capture", "تحصيل", locale), values: ["#PAY-24044", "410 EGP", L("Succeeded", "نجحت", locale)], tone: "ok" }
          ]
        });
      case "Settlements":
        return withBase({
          description: L("Imported settlement batches and payout-level financial truth.", "دفعات التسوية المستوردة وحقيقة المدفوعات على مستوى التسوية.", locale),
          columns: [L("Settlement", "التسوية", locale), L("Period", "الفترة", locale), L("Transactions", "المعاملات", locale), L("Net", "الصافي", locale)],
          rows: [
            { primary: "#SET-2026-0828", values: ["28 Aug", "184", "38,420 EGP"], tone: "ok" },
            { primary: "#SET-2026-0827", values: ["27 Aug", "171", "34,980 EGP"], tone: "ok" },
            { primary: "#SET-2026-0826", values: ["26 Aug", "166", "33,710 EGP"], tone: "warn" }
          ]
        });
      case "Reconciliation":
        return withBase({
          description: L("Compare Balcona payment truth with provider settlement records and resolve mismatches.", "مطابقة حقيقة الدفع في بلكونة مع سجلات التسوية وحل الاختلافات.", locale),
          metrics: [
            { label: L("Latest run", "آخر تشغيل", locale), value: "08:42" },
            { label: L("Matched", "متطابق", locale), value: "181" },
            { label: L("Open issues", "مشاكل مفتوحة", locale), value: "1" },
            { label: L("Mismatch amount", "قيمة الاختلاف", locale), value: "1,840 EGP" }
          ],
          columns: [L("Run / entry", "التشغيل / البند", locale), L("Period", "الفترة", locale), L("Matched", "متطابق", locale), L("Issues", "المشاكل", locale)],
          rows: [
            { primary: "#REC-RUN-182", values: ["28 Aug", "181", "1"], tone: "warn" },
            { primary: "#REC-RUN-181", values: ["27 Aug", "171", "0"], tone: "ok" },
            { primary: "#REC-RUN-180", values: ["26 Aug", "165", "1 resolved"], tone: "ok" }
          ]
        });
      case "Issues":
        return withBase({
          description: L("Financial exceptions requiring acknowledgement, investigation, or resolution.", "استثناءات مالية تحتاج إقرارًا أو تحقيقًا أو حلًا.", locale),
          columns: [L("Issue", "المشكلة", locale), L("Type", "النوع", locale), L("Amount", "المبلغ", locale), L("Age", "العمر", locale)],
          rows: [
            { primary: "#FIN-ISS-91", values: [L("Reconciliation mismatch", "اختلاف مطابقة", locale), "1,840 EGP", "22m"], tone: "danger" },
            { primary: "#FIN-ISS-88", values: [L("Payment unknown", "دفع غير محسوم", locale), "220 EGP", "17m"], tone: "danger" },
            { primary: "#FIN-ISS-76", values: [L("Settlement variance", "فرق تسوية", locale), "0 EGP", L("Resolved", "محلولة", locale)], tone: "ok" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "insights") {
    switch (sectionKey) {
      case "Sales":
        return withBase({
          columns: [L("Period / location", "الفترة / الفرع", locale), L("Collected", "المحصّل", locale), L("Bills", "الفواتير", locale), L("Avg ticket", "متوسط الفاتورة", locale)],
          rows: [
            { primary: L("Today", "اليوم", locale), values: ["101,830 EGP", "918", "111 EGP"], tone: "ok" },
            { primary: L("Yesterday", "أمس", locale), values: ["93,940 EGP", "874", "107 EGP"], tone: "neutral" },
            { primary: L("Balkona Main", "بلكونة الرئيسي", locale), values: ["42,680 EGP", "389", "109 EGP"], tone: "ok" }
          ]
        });
      case "Orders":
        return withBase({
          columns: [L("Order metric", "مقياس الطلبات", locale), L("Current", "الحالي", locale), L("Previous", "السابق", locale), L("Change", "التغيير", locale)],
          rows: [
            { primary: L("Submitted", "مُرسل", locale), values: ["921", "876", "+5.1%"], tone: "ok" },
            { primary: L("Rejected", "مرفوض", locale), values: ["7", "5", "+2"], tone: "warn" },
            { primary: L("Submitted → served", "من الإرسال للتقديم", locale), values: ["11m 18s", "10m 44s", "+34s"], tone: "warn" }
          ]
        });
      case "Items":
        return withBase({
          columns: [L("Item", "المنتج", locale), L("Quantity", "الكمية", locale), L("Revenue", "الإيراد", locale), L("Share", "النسبة", locale)],
          rows: [
            { primary: L("Spanish Latte", "سبانيش لاتيه", locale), values: ["128", "12,160 EGP", "11.9%"], tone: "ok" },
            { primary: L("Iced Matcha", "آيس ماتشا", locale), values: ["96", "10,560 EGP", "10.4%"], tone: "ok" },
            { primary: L("Basque Cheesecake", "باسك تشيزكيك", locale), values: ["61", "8,235 EGP", "8.1%"], tone: "warn" }
          ]
        });
      case "Operations":
        return withBase({
          columns: [L("Operational metric", "مقياس تشغيلي", locale), L("Current", "الحالي", locale), L("Previous", "السابق", locale), L("Change", "التغيير", locale)],
          rows: [
            { primary: L("Active attention", "تنبيهات نشطة", locale), values: ["4", "6", "-2"], tone: "ok" },
            { primary: L("Urgent attention", "تنبيهات عاجلة", locale), values: ["1", "1", "—"], tone: "warn" },
            { primary: L("Failed print jobs", "طباعة فاشلة", locale), values: ["1", "0", "+1"], tone: "danger" }
          ]
        });
      case "Shifts & Cash":
        return withBase({
          columns: [L("Shift metric", "مقياس الوردية", locale), L("Current", "الحالي", locale), L("Previous", "السابق", locale), L("Change", "التغيير", locale)],
          rows: [
            { primary: L("Cash collected", "كاش محصل", locale), values: ["41,250 EGP", "39,820 EGP", "+3.6%"], tone: "ok" },
            { primary: L("Cash in/out", "إدخال/إخراج كاش", locale), values: ["2,100 / 1,450", "1,800 / 1,320", "—"], tone: "neutral" },
            { primary: L("Over / short", "زيادة / عجز", locale), values: ["0 EGP", "-90 EGP", "+90"], tone: "ok" }
          ]
        });
      case "AI & Automation":
        return withBase({
          columns: [L("AI metric", "مقياس AI", locale), L("Current", "الحالي", locale), L("Applied / result", "التطبيق / النتيجة", locale), L("Cost / rate", "التكلفة / المعدل", locale)],
          rows: [
            { primary: L("AI Waiter sessions", "جلسات النادل الذكي", locale), values: ["146", "—", "—"], tone: "ok" },
            { primary: L("Proposals", "اقتراحات", locale), values: ["38", "31 applied", "81.6%"], tone: "ok" },
            { primary: L("Escalations", "تصعيدات", locale), values: ["9", L("Staff handled", "عالجها الموظفون", locale), "6.2%"], tone: "warn" }
          ]
        });
      case "Activity":
        return withBase({
          description: L("Audit-oriented activity for meaningful administrative and financial changes.", "نشاط قابل للمراجعة للتغييرات الإدارية والمالية المهمة.", locale),
          columns: [L("Event", "الحدث", locale), L("Object", "العنصر", locale), L("Actor", "المنفذ", locale), L("When", "متى", locale)],
          rows: [
            { primary: L("Feature flag changed", "تم تعديل خاصية", locale), values: [L("Online payments", "الدفع أونلاين", locale), "Omar Khair", "08:31"], tone: "neutral" },
            { primary: L("Reconciliation issue resolved", "تم حل مشكلة مطابقة", locale), values: ["#FIN-ISS-76", "Mariam Hassan", "08:12"], tone: "ok" },
            { primary: L("Branch override changed", "تم تعديل إعداد فرع", locale), values: [L("Service mode", "نمط الخدمة", locale), "Omar Khair", "07:48"], tone: "neutral" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "experience") {
    switch (sectionKey) {
      case "AI Waiter":
        return withBase({
          description: L("AI Waiter experience configuration and escalation behavior, not a separate guest destination.", "إعداد تجربة النادل الذكي وسلوك التصعيد، وليس وجهة منفصلة للضيف.", locale),
          columns: [L("Configuration", "الإعداد", locale), L("Scope", "النطاق", locale), L("Effective source", "المصدر الفعلي", locale), L("Usage", "الاستخدام", locale)],
          rows: [
            { primary: L("Tone & voice", "النبرة والصوت", locale), values: [L("Company", "الشركة", locale), L("Company default", "إعداد الشركة", locale), L("3 locations", "3 فروع", locale)], tone: "ok" },
            { primary: L("Escalation behavior", "سلوك التصعيد", locale), values: [L("Company", "الشركة", locale), L("Company default", "إعداد الشركة", locale), L("Staff handoff", "تحويل للموظف", locale)], tone: "ok" },
            { primary: L("Evening profile", "ملف المساء", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Branch override", "تعديل فرع", locale), L("Guest assistant", "مساعد الضيف", locale)], tone: "neutral" }
          ]
        });
      case "Content":
        return withBase({
          description: L("Structured guest content blocks and their placements.", "بلوكات محتوى الضيف المنظمة ومواقع ظهورها.", locale),
          columns: [L("Content block", "بلوك المحتوى", locale), L("Scope", "النطاق", locale), L("Placement", "المكان", locale), L("Usage", "الاستخدام", locale)],
          rows: [
            { primary: L("Welcome message", "رسالة الترحيب", locale), values: [L("Company", "الشركة", locale), L("Session home", "رئيسية الجلسة", locale), L("3 locations", "3 فروع", locale)], tone: "ok" },
            { primary: L("Evening recommendation", "اقتراح المساء", locale), values: [L("Balkona Main", "بلكونة الرئيسي", locale), L("Menu", "المنيو", locale), L("Terrace zone", "منطقة التراس", locale)], tone: "neutral" },
            { primary: L("Payment help", "مساعدة الدفع", locale), values: [L("Company", "الشركة", locale), L("Bill / Pay", "الفاتورة / الدفع", locale), L("3 locations", "3 فروع", locale)], tone: "ok" }
          ]
        });
      case "Media":
        return withBase({
          description: L("Media library with explicit usage rather than orphaned uploads.", "مكتبة وسائط مع استخدام واضح بدل الملفات غير المرتبطة.", locale),
          columns: [L("Asset", "الملف", locale), L("Type", "النوع", locale), L("Usages", "الاستخدامات", locale), L("Scope", "النطاق", locale)],
          rows: [
            { primary: "spanish-latte.webp", values: [L("Image", "صورة", locale), "2", L("Catalog", "المنيو", locale)], tone: "ok" },
            { primary: "evening-hero.webp", values: [L("Image", "صورة", locale), "1", L("Balkona Main", "بلكونة الرئيسي", locale)], tone: "ok" },
            { primary: "old-banner.webp", values: [L("Image", "صورة", locale), "0", L("Unused", "غير مستخدم", locale)], tone: "warn" }
          ]
        });
      case "Notifications":
        return withBase({
          description: L("Notification templates and operational delivery intent.", "قوالب الإشعارات وغرض الإرسال التشغيلي.", locale),
          columns: [L("Template", "القالب", locale), L("Event", "الحدث", locale), L("Audience", "الجمهور", locale), L("Language", "اللغة", locale)],
          rows: [
            { primary: L("Order ready", "الطلب جاهز", locale), values: [L("Order state", "حالة الطلب", locale), L("Guest", "الضيف", locale), "AR / EN"], tone: "ok" },
            { primary: L("Waiter escalation", "تصعيد للنادل", locale), values: [L("Attention", "تنبيه", locale), L("Staff", "الموظفون", locale), "AR / EN"], tone: "ok" },
            { primary: L("Payment status unknown", "حالة الدفع غير محسومة", locale), values: [L("Payment", "الدفع", locale), L("Guest + staff", "الضيف + الموظف", locale), "AR / EN"], tone: "warn" }
          ]
        });
      default:
        return base;
    }
  }

  if (domain === "settings") {
    switch (sectionKey) {
      case "Business":
        return withBase({
          description: L("Company-level business identity and defaults.", "هوية الشركة والإعدادات الافتراضية على مستوى الشركة.", locale),
          columns: [L("Setting", "الإعداد", locale), L("Value", "القيمة", locale), L("Scope", "النطاق", locale), L("Source", "المصدر", locale)],
          rows: [
            { primary: L("Business name", "اسم النشاط", locale), values: ["Balcona", L("Company", "الشركة", locale), L("Company default", "إعداد الشركة", locale)], tone: "ok" },
            { primary: L("Default currency", "العملة الافتراضية", locale), values: ["EGP", L("Company", "الشركة", locale), L("Company default", "إعداد الشركة", locale)], tone: "ok" },
            { primary: L("Default experience", "التجربة الافتراضية", locale), values: [L("Company Default", "إعداد الشركة", locale), L("Company", "الشركة", locale), L("Experience profile", "ملف تجربة", locale)], tone: "neutral" }
          ]
        });
      case "Branch Operations":
        return withBase({
          description: L("Branch operating settings with explicit inheritance and overrides.", "إعدادات تشغيل الفرع مع وراثة وتعديلات واضحة.", locale),
          columns: [L("Setting", "الإعداد", locale), L("Company default", "إعداد الشركة", locale), L("Branch override", "تعديل الفرع", locale), L("Effective", "الفعلي", locale)],
          rows: [
            { primary: L("Service mode", "نمط الخدمة", locale), values: [L("Table service", "خدمة ترابيزات", locale), "—", L("Table service", "خدمة ترابيزات", locale)], tone: "ok" },
            { primary: L("Cashier shift required", "وردية الكاشير مطلوبة", locale), values: [L("Enabled", "مفعل", locale), "—", L("Enabled", "مفعل", locale)], tone: "ok" },
            { primary: L("Auto-accept", "القبول التلقائي", locale), values: [L("Disabled", "غير مفعل", locale), L("Enabled", "مفعل", locale), L("Enabled", "مفعل", locale)], tone: "neutral" }
          ]
        });
      case "Service Mode":
        return withBase({
          description: L("Service behavior and operational defaults without mixing them into live Service navigation.", "سلوك الخدمة وإعداداتها بدون خلطها مع تنقل Service اللحظي.", locale),
          columns: [L("Behavior", "السلوك", locale), L("Effective value", "القيمة الفعلية", locale), L("Source", "المصدر", locale), L("Applies to", "ينطبق على", locale)],
          rows: [
            { primary: L("Guest ordering", "طلب الضيف", locale), values: [L("Enabled", "مفعل", locale), L("Company default", "إعداد الشركة", locale), L("All locations", "كل الفروع", locale)], tone: "ok" },
            { primary: L("Waiter calls", "طلبات النادل", locale), values: [L("Enabled", "مفعل", locale), L("Company default", "إعداد الشركة", locale), L("All locations", "كل الفروع", locale)], tone: "ok" },
            { primary: L("Bill request", "طلب الفاتورة", locale), values: [L("Enabled", "مفعل", locale), L("Branch override", "تعديل فرع", locale), L("Balkona Main", "بلكونة الرئيسي", locale)], tone: "neutral" }
          ]
        });
      case "Feature Flags":
        return withBase({
          description: L("Feature availability with company defaults and branch-specific overrides.", "إتاحة الخصائص مع إعدادات الشركة وتعديلات الفروع.", locale),
          columns: [L("Feature", "الخاصية", locale), L("Company", "الشركة", locale), L("Branch override", "تعديل الفرع", locale), L("Effective", "الفعلي", locale)],
          rows: [
            { primary: L("Online payments", "الدفع أونلاين", locale), values: [L("On", "مفعل", locale), "—", L("On", "مفعل", locale)], tone: "ok" },
            { primary: L("AI Waiter", "النادل الذكي", locale), values: [L("On", "مفعل", locale), "—", L("On", "مفعل", locale)], tone: "ok" },
            { primary: L("Smart Cashier", "الكاشير الذكي", locale), values: [L("Off", "غير مفعل", locale), L("On", "مفعل", locale), L("On", "مفعل", locale)], tone: "neutral" }
          ]
        });
      case "Integrations":
        return withBase({
          description: L("Configured external/service integrations represented at business level, not raw secrets.", "التكاملات المهيأة على مستوى العمل بدون عرض الأسرار أو الإعدادات الخام.", locale),
          columns: [L("Integration", "التكامل", locale), L("Scope", "النطاق", locale), L("Purpose", "الغرض", locale), L("Config state", "حالة الإعداد", locale)],
          rows: [
            { primary: L("Payment provider", "شركة الدفع", locale), values: [L("Company", "الشركة", locale), L("Online payments", "الدفع أونلاين", locale), L("Configured", "مهيأ", locale)], tone: "ok" },
            { primary: L("Realtime notifications", "الإشعارات الفورية", locale), values: [L("Company", "الشركة", locale), L("Guest + staff updates", "تحديثات الضيف والموظف", locale), L("Configured", "مهيأ", locale)], tone: "ok" },
            { primary: L("Printer routing", "توجيه الطباعة", locale), values: [L("Branch", "الفرع", locale), L("Kitchen / bar", "المطبخ / البار", locale), L("1 issue", "مشكلة واحدة", locale)], tone: "warn" }
          ]
        });
      case "Security":
        return withBase({
          description: L("Access-oriented security signals backed by staff authentication, memberships, invites, and audit.", "إشارات أمان مبنية على دخول الموظفين والعضويات والدعوات وسجل المراجعة.", locale),
          columns: [L("Security object", "عنصر الأمان", locale), L("Scope", "النطاق", locale), L("Signal", "الإشارة", locale), L("Last activity", "آخر نشاط", locale)],
          rows: [
            { primary: L("Owner access", "صلاحية المالك", locale), values: [L("Company", "الشركة", locale), L("Active", "نشطة", locale), L("Today", "اليوم", locale)], tone: "ok" },
            { primary: L("Pending staff invites", "دعوات موظفين معلقة", locale), values: [L("Company", "الشركة", locale), "3", L("Today", "اليوم", locale)], tone: "warn" },
            { primary: L("Audit activity", "نشاط المراجعة", locale), values: [L("Company", "الشركة", locale), L("Available", "متاح", locale), L("08:31", "08:31", locale)], tone: "ok" }
          ]
        });
      case "Advanced":
        return withBase({
          description: L("Only supported advanced configuration is exposed. Unsupported controls are intentionally absent.", "يظهر فقط الإعداد المتقدم المدعوم. أي تحكم غير مدعوم لا يتم اختراعه.", locale),
          metrics: [
            { label: L("Feature overrides", "تعديلات الخصائص", locale), value: "7" },
            { label: L("Experience overrides", "تعديلات التجربة", locale), value: "2" },
            { label: L("Printer stations", "محطات طباعة", locale), value: "6" },
            { label: L("Unsupported controls", "تحكمات غير مدعومة", locale), value: "0" }
          ],
          columns: [L("Advanced object", "عنصر متقدم", locale), L("Scope", "النطاق", locale), L("Source", "المصدر", locale), L("Effective state", "الحالة الفعلية", locale)],
          rows: [
            { primary: L("Feature flag inheritance", "وراثة الخصائص", locale), values: [L("Company → branch", "الشركة ← الفرع", locale), L("Feature flags", "الخصائص", locale), L("7 overrides", "7 تعديلات", locale)], tone: "neutral" },
            { primary: L("Experience inheritance", "وراثة التجربة", locale), values: [L("Company → branch", "الشركة ← الفرع", locale), L("Experience profiles", "ملفات التجربة", locale), L("2 overrides", "تعديلان", locale)], tone: "neutral" },
            { primary: L("Printer station routing", "توجيه محطات الطباعة", locale), values: [L("Branch", "الفرع", locale), L("Printer stations", "محطات الطباعة", locale), L("1 issue", "مشكلة واحدة", locale)], tone: "warn" }
          ]
        });
      default:
        return base;
    }
  }

  return base;
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

  const model =
    domain === "home"
      ? null
      : makeModel(
          domain,
          section.en,
          L(section.en, section.ar, locale),
          locale,
          scope
        );

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
