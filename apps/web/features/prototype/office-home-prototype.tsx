"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Bell,
  Boxes,
  Building2,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Command,
  CreditCard,
  LayoutDashboard,
  MapPin,
  MenuSquare,
  PackageSearch,
  Search,
  Settings,
  ShieldAlert,
  Sparkles,
  Users,
  WandSparkles,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";

type Locale = "en" | "ar";
type Scenario = "normal" | "critical" | "healthy" | "partial";

type Copy = {
  office: string;
  allLocations: string;
  prototypeData: string;
  search: string;
  nav: string[];
  home: string;
  subtitle: string;
  today: string;
  attention: string;
  attentionHealthy: string;
  collected: string;
  orders: string;
  averageTicket: string;
  activeAttention: string;
  locations: string;
  location: string;
  payments: string;
  stock: string;
  status: string;
  moneyHealth: string;
  openMoney: string;
  operationsHealth: string;
  openOperations: string;
  stockHealth: string;
  openInventory: string;
  trend: string;
  recent: string;
  scenario: string;
  normal: string;
  critical: string;
  healthy: string;
  partial: string;
  partialError: string;
  branch: string;
};

const copy: Record<Locale, Copy> = {
  en: {
    office: "Office",
    allLocations: "All locations",
    prototypeData: "Prototype data · supported Balcona capabilities only",
    search: "Search Balcona or press ⌘K",
    nav: [
      "Home",
      "Operations",
      "Catalog",
      "Inventory",
      "Locations",
      "Team",
      "Money",
      "Insights",
      "Experience",
      "Settings"
    ],
    home: "Home",
    subtitle: "Company pulse, exceptions, and the locations that need you.",
    today: "Today",
    attention: "Needs attention",
    attentionHealthy: "No critical issues across your locations",
    collected: "Collected",
    orders: "Orders",
    averageTicket: "Average ticket",
    activeAttention: "Active attention",
    locations: "Locations",
    location: "Location",
    payments: "Payments",
    stock: "Stock",
    status: "Status",
    moneyHealth: "Money health",
    openMoney: "Open Money",
    operationsHealth: "Operations health",
    openOperations: "Open Operations",
    stockHealth: "Stock & procurement",
    openInventory: "Open Inventory",
    trend: "Collected trend",
    recent: "Meaningful activity",
    scenario: "Scenario",
    normal: "Normal",
    critical: "Critical",
    healthy: "Healthy",
    partial: "Partial error",
    partialError: "Money data is temporarily unavailable. Other company data is still live.",
    branch: "Branch"
  },
  ar: {
    office: "الإدارة",
    allLocations: "كل الفروع",
    prototypeData: "بيانات نموذجية · مبنية فقط على قدرات بلكونة الموجودة",
    search: "ابحث في بلكونة أو اضغط ⌘K",
    nav: [
      "الرئيسية",
      "العمليات",
      "المنيو",
      "المخزون",
      "الفروع",
      "الفريق",
      "المدفوعات",
      "التحليلات",
      "التجربة",
      "الإعدادات"
    ],
    home: "الرئيسية",
    subtitle: "صحة الشركة، المشاكل المهمة، والفروع التي تحتاج تدخلك.",
    today: "اليوم",
    attention: "يحتاج انتباه",
    attentionHealthy: "لا توجد مشاكل حرجة في أي فرع",
    collected: "المحصّل",
    orders: "الطلبات",
    averageTicket: "متوسط الفاتورة",
    activeAttention: "تنبيهات نشطة",
    locations: "الفروع",
    location: "الفرع",
    payments: "المدفوعات",
    stock: "المخزون",
    status: "الحالة",
    moneyHealth: "صحة المدفوعات",
    openMoney: "فتح المدفوعات",
    operationsHealth: "صحة العمليات",
    openOperations: "فتح العمليات",
    stockHealth: "المخزون والمشتريات",
    openInventory: "فتح المخزون",
    trend: "اتجاه التحصيل",
    recent: "نشاط مهم",
    scenario: "الحالة التجريبية",
    normal: "عادية",
    critical: "حرجة",
    healthy: "سليمة",
    partial: "خطأ جزئي",
    partialError: "بيانات المدفوعات غير متاحة مؤقتًا. باقي بيانات الشركة ما زالت تعمل.",
    branch: "فرع"
  }
};

const icons = [
  LayoutDashboard,
  Sparkles,
  MenuSquare,
  Boxes,
  MapPin,
  Users,
  WalletCards,
  PackageSearch,
  WandSparkles,
  Settings
];

const branches = [
  {
    nameEn: "Balkona Main",
    nameAr: "بلكونة الرئيسي",
    collected: "42,680 EGP",
    orders: 391,
    attention: 3,
    stock: 2,
    payments: 1,
    status: "Needs review"
  },
  {
    nameEn: "Branch 02",
    nameAr: "فرع 02",
    collected: "31,240 EGP",
    orders: 286,
    attention: 0,
    stock: 4,
    payments: 0,
    status: "Stock attention"
  },
  {
    nameEn: "Branch 03",
    nameAr: "فرع 03",
    collected: "27,910 EGP",
    orders: 244,
    attention: 1,
    stock: 0,
    payments: 0,
    status: "Operating normally"
  }
];

const activity = [
  {
    icon: ShieldAlert,
    en: "Reconciliation issue acknowledged",
    ar: "تمت مراجعة مشكلة مطابقة مالية",
    metaEn: "Balkona Main · 9 min ago",
    metaAr: "بلكونة الرئيسي · منذ 9 دقائق"
  },
  {
    icon: Boxes,
    en: "Two menu items became unavailable",
    ar: "منتجان أصبحا غير متاحين",
    metaEn: "Branch 02 · 18 min ago",
    metaAr: "فرع 02 · منذ 18 دقيقة"
  },
  {
    icon: WandSparkles,
    en: "Smart Cashier rule updated",
    ar: "تم تعديل قاعدة الكاشير الذكي",
    metaEn: "Company default · 41 min ago",
    metaAr: "إعداد الشركة · منذ 41 دقيقة"
  }
];

function StatusPill({ tone, children }: { tone: "ok" | "warn" | "danger"; children: React.ReactNode }) {
  const styles = {
    ok: "border-[#D8E5D6] bg-[#EEF5EC] text-[#315A35]",
    warn: "border-[#E9D7B3] bg-[#FBF3E3] text-[#76551A]",
    danger: "border-[#E7C7C3] bg-[#F8E9E7] text-[#8B352E]"
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function IconButton({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="flex size-10 items-center justify-center rounded-xl border border-[#E2DDD3] bg-white text-[#514A42] transition hover:border-[#C7BDAE] hover:bg-[#FBF8F2]"
    >
      {children}
    </button>
  );
}

export function OfficeHomePrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [scenario, setScenario] = useState<Scenario>("normal");
  const t = copy[locale];

  const issues = useMemo(() => {
    if (scenario === "healthy") {
      return [];
    }

    const base = [
      {
        icon: CreditCard,
        titleEn: "Payment needs review",
        titleAr: "دفعة تحتاج مراجعة",
        bodyEn: "Balkona Main · provider state is still unknown",
        bodyAr: "بلكونة الرئيسي · حالة شركة الدفع ما زالت غير محسومة",
        tone: "danger" as const
      },
      {
        icon: Boxes,
        titleEn: "Stock is blocking menu items",
        titleAr: "المخزون موقف منتجات في المنيو",
        bodyEn: "Branch 02 · 4 stock alerts affect sellability",
        bodyAr: "فرع 02 · 4 تنبيهات مخزون تؤثر على البيع",
        tone: "warn" as const
      },
      {
        icon: ChefHat,
        titleEn: "Service delay",
        titleAr: "تأخير في الخدمة",
        bodyEn: "Branch 03 · 1 urgent table attention signal",
        bodyAr: "فرع 03 · تنبيه عاجل على ترابيزة",
        tone: "warn" as const
      }
    ];

    if (scenario === "critical") {
      return [
        {
          icon: ShieldAlert,
          titleEn: "Reconciliation mismatch",
          titleAr: "اختلاف في المطابقة المالية",
          bodyEn: "Balkona Main · settlement issue requires finance review",
          bodyAr: "بلكونة الرئيسي · مشكلة تسوية تحتاج مراجعة مالية",
          tone: "danger" as const
        },
        ...base
      ];
    }

    return base.slice(0, 2);
  }, [scenario]);

  return (
    <div
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="min-h-screen bg-[#F3F0E9] text-[#1C1916]"
    >
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-e border-[#2C241E] bg-[#191512] px-4 py-5 text-[#F7F1E6]">
          <div className="flex items-center gap-3 px-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#C68A4A] text-sm font-black text-[#1B120C]">
              B
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide">Balcona</p>
              <p className="text-[11px] text-[#B9AB9B]">{t.office}</p>
            </div>
          </div>

          <nav className="mt-8 grid gap-1">
            {t.nav.map((label, index) => {
              const Icon = icons[index];
              const active = index === 0;

              return (
                <button
                  key={label}
                  type="button"
                  className={`flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm transition ${
                    active
                      ? "bg-[#30251D] font-semibold text-[#FFF9EF]"
                      : "text-[#CDBFB0] hover:bg-[#241D18] hover:text-white"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-[#D9A363]" : "text-[#9F9184]"}`} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 border-t border-[#332A24] pt-5">
            <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#776B61]">
              {t.prototypeData}
            </p>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex min-h-16 items-center gap-3 border-b border-[#DED8CE] bg-[#F8F5EF]/95 px-4 backdrop-blur md:px-6">
            <button
              type="button"
              className="flex min-h-10 min-w-[178px] items-center justify-between gap-3 rounded-xl border border-[#DCD5CA] bg-white px-3 text-sm font-semibold"
            >
              <span className="flex items-center gap-2">
                <Building2 className="size-4 text-[#A66A32]" />
                {t.allLocations}
              </span>
              <ChevronDown className="size-4 text-[#81766B]" />
            </button>

            <div className="mx-auto hidden w-full max-w-xl items-center gap-2 rounded-xl border border-[#DDD7CD] bg-white px-3 md:flex">
              <Search className="size-4 text-[#8D8379]" />
              <input
                aria-label={t.search}
                placeholder={t.search}
                className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9B9186]"
              />
              <Command className="size-4 text-[#A89D92]" />
            </div>

            <IconButton label={t.attention}>
              <Bell className="size-4" />
            </IconButton>

            <button
              type="button"
              onClick={() => setLocale((value) => (value === "en" ? "ar" : "en"))}
              className="min-h-10 rounded-xl border border-[#DCD5CA] bg-white px-3 text-xs font-bold"
            >
              {locale === "en" ? "العربية" : "EN"}
            </button>
          </header>

          <main className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 lg:px-8">
            <section className="flex flex-col gap-4 border-b border-[#DCD5CA] pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9A6C3F]">
                  Balcona Office · {t.allLocations}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] md:text-4xl">
                  {t.home}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6E665F]">
                  {t.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-[#DCD5CA] bg-white p-1">
                  {(["normal", "critical", "healthy", "partial"] as Scenario[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setScenario(value)}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        scenario === value
                          ? "bg-[#241D18] text-white"
                          : "text-[#756C63] hover:bg-[#F0ECE5]"
                      }`}
                    >
                      {t[value]}
                    </button>
                  ))}
                </div>
                <span className="rounded-xl border border-[#DCD5CA] bg-white px-3 py-2.5 text-xs font-semibold text-[#6C635B]">
                  {t.today}
                </span>
              </div>
            </section>

            <section className="mt-5">
              {issues.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-[#D9C9BA] bg-[#FFFDF8]">
                  <div className="flex items-center justify-between border-b border-[#E5DDD4] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-[#A86434]" />
                      <p className="text-sm font-semibold">{t.attention}</p>
                      <span className="rounded-full bg-[#2B211A] px-2 py-0.5 text-[11px] font-bold text-white">
                        {issues.length}
                      </span>
                    </div>
                  </div>
                  <div className="divide-y divide-[#ECE5DD]">
                    {issues.map((issue, index) => {
                      const IssueIcon = issue.icon;
                      return (
                        <button
                          key={index}
                          type="button"
                          className="grid w-full gap-3 px-4 py-3 text-start transition hover:bg-[#FAF5EC] sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <span
                            className={`flex size-8 items-center justify-center rounded-lg ${
                              issue.tone === "danger"
                                ? "bg-[#F6E4E1] text-[#A0463D]"
                                : "bg-[#F8EDD7] text-[#95621F]"
                            }`}
                          >
                            <IssueIcon className="size-4" />
                          </span>
                          <span>
                            <span className="block text-sm font-semibold">
                              {locale === "ar" ? issue.titleAr : issue.titleEn}
                            </span>
                            <span className="mt-0.5 block text-xs text-[#786F66]">
                              {locale === "ar" ? issue.bodyAr : issue.bodyEn}
                            </span>
                          </span>
                          <ArrowUpRight className="size-4 text-[#A59A90]" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-[#D5E2D2] bg-[#F2F7F0] px-4 py-3">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-[#DFEEDD] text-[#426647]">
                    <ShieldAlert className="size-4" />
                  </span>
                  <p className="text-sm font-semibold text-[#35543A]">{t.attentionHealthy}</p>
                </div>
              )}
            </section>

            <section className="mt-5 grid overflow-hidden rounded-2xl border border-[#DDD6CC] bg-white md:grid-cols-4">
              {[
                [t.collected, "101,830 EGP", "+8.4%", CircleDollarSign],
                [t.orders, "921", "+5.1%", MenuSquare],
                [t.averageTicket, "111 EGP", "+3.2%", Banknote],
                [t.activeAttention, "4", "3 locations", Bell]
              ].map(([label, value, delta, Icon], index) => {
                const MetricIcon = Icon as typeof CircleDollarSign;
                return (
                  <div
                    key={String(label)}
                    className={`p-4 md:p-5 ${index > 0 ? "border-t border-[#EEE8E0] md:border-s md:border-t-0" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[#81776E]">{String(label)}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{String(value)}</p>
                        <p className="mt-1 text-xs text-[#6E7A62]">{String(delta)}</p>
                      </div>
                      <MetricIcon className="size-4 text-[#A66A32]" />
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.72fr)]">
              <div className="min-w-0 rounded-2xl border border-[#DDD6CC] bg-white">
                <div className="flex items-center justify-between border-b border-[#ECE6DE] px-5 py-4">
                  <div>
                    <h2 className="text-base font-semibold">{t.locations}</h2>
                    <p className="mt-1 text-xs text-[#82786F]">{t.allLocations}</p>
                  </div>
                  <MapPin className="size-4 text-[#A66A32]" />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#ECE6DE] bg-[#FAF8F4] text-xs text-[#7D746C]">
                        <th className="px-5 py-3 text-start font-medium">{t.location}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.collected}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.orders}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.attention}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.stock}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.payments}</th>
                        <th className="px-5 py-3 text-start font-medium">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F0EBE4]">
                      {branches.map((item, index) => (
                        <tr key={item.nameEn} className="transition hover:bg-[#FBF8F2]">
                          <td className="px-5 py-4">
                            <button type="button" className="font-semibold hover:text-[#9B5F2E]">
                              {locale === "ar" ? item.nameAr : item.nameEn}
                            </button>
                          </td>
                          <td className="px-4 py-4 font-medium">{item.collected}</td>
                          <td className="px-4 py-4">{item.orders}</td>
                          <td className="px-4 py-4">{item.attention}</td>
                          <td className="px-4 py-4">{item.stock}</td>
                          <td className="px-4 py-4">{item.payments}</td>
                          <td className="px-5 py-4">
                            {index === 0 ? (
                              <StatusPill tone="danger">{locale === "ar" ? "يحتاج مراجعة" : item.status}</StatusPill>
                            ) : index === 1 ? (
                              <StatusPill tone="warn">{locale === "ar" ? "تنبيه مخزون" : item.status}</StatusPill>
                            ) : (
                              <StatusPill tone="ok">{locale === "ar" ? "يعمل بشكل طبيعي" : item.status}</StatusPill>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid gap-5">
                <article className="rounded-2xl border border-[#DDD6CC] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{t.moneyHealth}</p>
                      <p className="mt-1 text-xs text-[#82786F]">
                        {locale === "ar" ? "المدفوعات والمطابقة" : "Payments and reconciliation"}
                      </p>
                    </div>
                    <CircleDollarSign className="size-4 text-[#A66A32]" />
                  </div>

                  {scenario === "partial" ? (
                    <div className="mt-4 rounded-xl border border-[#E4C8C4] bg-[#F9EDEC] p-3">
                      <div className="flex gap-2">
                        <XCircle className="mt-0.5 size-4 shrink-0 text-[#9D4A42]" />
                        <p className="text-xs leading-5 text-[#7A3B36]">{t.partialError}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      <div className="flex items-center justify-between border-b border-[#EEE8E1] pb-3">
                        <span className="text-xs text-[#776E66]">
                          {locale === "ar" ? "دفعات تحتاج مراجعة" : "Payments needing review"}
                        </span>
                        <strong className="text-lg">2</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#776E66]">
                          {locale === "ar" ? "مشاكل مطابقة مفتوحة" : "Open reconciliation issues"}
                        </span>
                        <strong className="text-lg">1</strong>
                      </div>
                    </div>
                  )}

                  <button type="button" className="mt-5 flex items-center gap-2 text-xs font-bold text-[#935A2B]">
                    {t.openMoney}
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </article>

                <article className="rounded-2xl border border-[#DDD6CC] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{t.operationsHealth}</p>
                      <p className="mt-1 text-xs text-[#82786F]">
                        {locale === "ar" ? "الخدمة والتحضير والطباعة" : "Service, preparation, printing"}
                      </p>
                    </div>
                    <ChefHat className="size-4 text-[#A66A32]" />
                  </div>
                  <div className="mt-4 grid grid-cols-3 divide-x divide-[#EEE8E1] rtl:divide-x-reverse">
                    <div className="pe-3">
                      <p className="text-xl font-semibold">3</p>
                      <p className="mt-1 text-[11px] text-[#7B7269]">{locale === "ar" ? "تنبيهات" : "attention"}</p>
                    </div>
                    <div className="px-3">
                      <p className="text-xl font-semibold">1</p>
                      <p className="mt-1 text-[11px] text-[#7B7269]">{locale === "ar" ? "طباعة فاشلة" : "print fail"}</p>
                    </div>
                    <div className="ps-3">
                      <p className="text-xl font-semibold">1</p>
                      <p className="mt-1 text-[11px] text-[#7B7269]">{locale === "ar" ? "تأخير عاجل" : "urgent"}</p>
                    </div>
                  </div>
                  <button type="button" className="mt-5 flex items-center gap-2 text-xs font-bold text-[#935A2B]">
                    {t.openOperations}
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </article>

                <article className="rounded-2xl border border-[#DDD6CC] bg-white p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">{t.stockHealth}</p>
                      <p className="mt-1 text-xs text-[#82786F]">
                        {locale === "ar" ? "تأثير المخزون على البيع" : "Stock impact on sellability"}
                      </p>
                    </div>
                    <Boxes className="size-4 text-[#A66A32]" />
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-semibold tracking-[-0.04em]">6</p>
                      <p className="mt-1 text-xs text-[#7A7168]">
                        {locale === "ar" ? "تنبيهات مخزون عبر فرعين" : "alerts across 2 locations"}
                      </p>
                    </div>
                    <StatusPill tone="warn">{locale === "ar" ? "يحتاج انتباه" : "Attention"}</StatusPill>
                  </div>
                  <button type="button" className="mt-5 flex items-center gap-2 text-xs font-bold text-[#935A2B]">
                    {t.openInventory}
                    <ArrowUpRight className="size-3.5" />
                  </button>
                </article>
              </div>
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
              <article className="rounded-2xl border border-[#DDD6CC] bg-white p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-semibold">{t.trend}</h2>
                    <p className="mt-1 text-xs text-[#82786F]">{t.today}</p>
                  </div>
                  <CircleDollarSign className="size-4 text-[#A66A32]" />
                </div>

                <div className="mt-5 h-48 rounded-xl bg-[#FAF8F4] p-4">
                  <svg viewBox="0 0 700 180" className="h-full w-full" role="img" aria-label={t.trend}>
                    <line x1="0" y1="145" x2="700" y2="145" stroke="#DED7CE" strokeWidth="1" />
                    <line x1="0" y1="95" x2="700" y2="95" stroke="#E7E1D9" strokeWidth="1" />
                    <line x1="0" y1="45" x2="700" y2="45" stroke="#E7E1D9" strokeWidth="1" />
                    <polyline
                      points="0,142 70,132 140,120 210,126 280,98 350,103 420,82 490,66 560,72 630,45 700,30"
                      fill="none"
                      stroke="#B87439"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </article>

              <article className="rounded-2xl border border-[#DDD6CC] bg-white">
                <div className="border-b border-[#ECE6DE] px-5 py-4">
                  <h2 className="text-base font-semibold">{t.recent}</h2>
                </div>
                <div className="divide-y divide-[#EFE9E2]">
                  {activity.map((item) => {
                    const ActivityIcon = item.icon;
                    return (
                      <div key={item.en} className="flex gap-3 px-5 py-4">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#F3E9DD] text-[#9B6332]">
                          <ActivityIcon className="size-4" />
                        </span>
                        <div>
                          <p className="text-sm font-medium">{locale === "ar" ? item.ar : item.en}</p>
                          <p className="mt-1 text-xs text-[#81776E]">
                            {locale === "ar" ? item.metaAr : item.metaEn}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            </section>

            <div className="mt-6 flex items-center justify-between border-t border-[#DCD5CA] pt-4 text-xs text-[#8A8077]">
              <span>{t.prototypeData}</span>
              <span>Office Home Reference Proof · v1</span>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
