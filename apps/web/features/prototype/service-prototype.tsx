"use client";

import {
  AlertTriangle,
  Banknote,
  BellRing,
  CreditCard,
  LayoutGrid,
  ListChecks,
  Radio,
  Receipt,
  RefreshCw
} from "lucide-react";
import { useState } from "react";

type Locale = "en" | "ar";
type Mode = "cashier" | "waiter";
type View = "floor" | "orders" | "attention" | "bills" | "shift";

type Order = {
  id: string;
  table: string;
  total: string;
  age: string;
  status: "review" | "accepted" | "preparing" | "ready";
  reason?: string;
  items: string[];
};

type Attention = {
  id: string;
  table: string;
  age: string;
  level: "urgent" | "due" | "active";
  reasonEn: string;
  reasonAr: string;
  source: "waiter" | "computed" | "ready" | "ai";
};

type Bill = {
  id: string;
  table: string;
  total: string;
  age: string;
  state: "requested" | "presented" | "unknown" | "paid";
};

const orders: Order[] = [
  {
    id: "#ORD-10428",
    table: "T12",
    total: "385 EGP",
    age: "7m",
    status: "review",
    reason: "Payment state uncertain",
    items: ["2× Spanish Latte", "1× Basque Cheesecake"]
  },
  {
    id: "#ORD-10427",
    table: "T08",
    total: "240 EGP",
    age: "4m",
    status: "accepted",
    items: ["1× Iced Matcha", "1× Croissant"]
  },
  {
    id: "#ORD-10425",
    table: "T03",
    total: "190 EGP",
    age: "10m",
    status: "preparing",
    items: ["2× Cappuccino"]
  },
  {
    id: "#ORD-10422",
    table: "T16",
    total: "460 EGP",
    age: "13m",
    status: "ready",
    items: ["2× Burger", "1× Fries", "2× Cola"]
  }
];

const attention: Attention[] = [
  {
    id: "ATT-91",
    table: "T12",
    age: "6m",
    level: "urgent",
    reasonEn: "Guest requested waiter",
    reasonAr: "الضيف طلب نادل",
    source: "waiter"
  },
  {
    id: "ATT-88",
    table: "T16",
    age: "4m",
    level: "due",
    reasonEn: "Order ready to serve",
    reasonAr: "الطلب جاهز للتقديم",
    source: "ready"
  },
  {
    id: "ATT-84",
    table: "T07",
    age: "3m",
    level: "due",
    reasonEn: "Bill request waiting",
    reasonAr: "طلب الفاتورة ينتظر",
    source: "computed"
  },
  {
    id: "ATT-79",
    table: "T03",
    age: "2m",
    level: "active",
    reasonEn: "AI Waiter escalated to staff",
    reasonAr: "النادل الذكي صعّد الطلب للموظف",
    source: "ai"
  }
];

const bills: Bill[] = [
  { id: "#B-8821", table: "T12", total: "385 EGP", age: "5m", state: "requested" },
  { id: "#B-8819", table: "T07", total: "220 EGP", age: "9m", state: "unknown" },
  { id: "#B-8814", table: "T03", total: "145 EGP", age: "2m", state: "presented" },
  { id: "#B-8808", table: "T16", total: "460 EGP", age: "—", state: "paid" }
];

const tables = [
  { id: "T01", area: "dining", state: "free", meta: "—", x: 7, y: 12, w: 17, h: 19, shape: "round" },
  { id: "T02", area: "dining", state: "active", meta: "18m", x: 31, y: 10, w: 18, h: 20, shape: "square" },
  { id: "T03", area: "dining", state: "attention", meta: "10m", x: 61, y: 9, w: 18, h: 20, shape: "round" },
  { id: "T04", area: "dining", state: "free", meta: "—", x: 10, y: 43, w: 22, h: 17, shape: "wide" },
  { id: "T05", area: "dining", state: "active", meta: "31m", x: 42, y: 42, w: 17, h: 19, shape: "round" },
  { id: "T06", area: "dining", state: "free", meta: "—", x: 70, y: 43, w: 17, h: 19, shape: "square" },
  { id: "T07", area: "dining", state: "bill", meta: "3m", x: 33, y: 72, w: 25, h: 15, shape: "wide" },
  { id: "T08", area: "terrace", state: "active", meta: "4m", x: 8, y: 12, w: 18, h: 20, shape: "round" },
  { id: "T09", area: "terrace", state: "free", meta: "—", x: 38, y: 10, w: 18, h: 20, shape: "square" },
  { id: "T10", area: "terrace", state: "active", meta: "15m", x: 68, y: 11, w: 18, h: 20, shape: "round" },
  { id: "T11", area: "terrace", state: "free", meta: "—", x: 13, y: 51, w: 23, h: 16, shape: "wide" },
  { id: "T12", area: "terrace", state: "urgent", meta: "6m", x: 45, y: 45, w: 18, h: 20, shape: "round" },
  { id: "T16", area: "terrace", state: "attention", meta: "4m", x: 70, y: 57, w: 18, h: 20, shape: "square" }
] as const;

function L(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function toneForOrder(status: Order["status"]) {
  if (status === "review") return "danger";
  if (status === "ready") return "success";
  if (status === "preparing") return "warning";
  return "neutral";
}

function Status({
  tone = "neutral",
  children
}: {
  tone?: "neutral" | "warning" | "danger" | "success";
  children: React.ReactNode;
}) {
  const cls = {
    neutral: "border-[#4D4036] bg-[#2B221C] text-[#D9CCC0]",
    warning: "border-[#7D5D2C] bg-[#392B18] text-[#F0C66E]",
    danger: "border-[#7A3F3A] bg-[#3A211F] text-[#F09C94]",
    success: "border-[#456144] bg-[#213022] text-[#A8D5A6]"
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cls[tone]}`}>
      {children}
    </span>
  );
}

function TopBar({
  locale,
  mode,
  onLocale,
  onMode
}: {
  locale: Locale;
  mode: Mode;
  onLocale: () => void;
  onMode: (mode: Mode) => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-[#352B24] bg-[#18130F]/96 px-3 backdrop-blur">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#1B120C]">
          B
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-[#FFF6E9]">Balcona Service</p>
          <p className="text-[10px] text-[#9F9184]">{L(locale, "Balkona Main", "بلكونة الرئيسي")}</p>
        </div>
      </div>

      <div className="mx-auto flex items-center rounded-md border border-[#3E332B] bg-[#211A15] p-1">
        {(["cashier", "waiter"] as Mode[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onMode(value)}
            className={`min-h-8 rounded px-3 text-xs font-semibold transition ${
              mode === value
                ? "bg-[#C68A4A] text-[#1B120C]"
                : "text-[#BFB0A2] hover:bg-[#2B221C]"
            }`}
          >
            {value === "cashier"
              ? L(locale, "Cashier", "كاشير")
              : L(locale, "Waiter / Floor", "ويتر / الصالة")}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="hidden items-center gap-1.5 rounded-md border border-[#3E332B] bg-[#211A15] px-2.5 py-2 text-[10px] font-semibold text-[#CDBFB1] lg:flex">
          <Banknote className="size-3.5 text-[#C68A4A]" />
          {L(locale, "Shift open", "الوردية مفتوحة")}
        </div>
        <div className="hidden items-center gap-1.5 text-[11px] text-[#AFA195] md:flex">
          <Radio className="size-3.5 text-[#7FC37E]" />
          {L(locale, "Live", "متصل")}
        </div>
        <button
          type="button"
          onClick={onLocale}
          className="min-h-9 rounded-md border border-[#41362E] bg-[#211A15] px-3 text-xs font-bold text-[#F5EBDD]"
        >
          {locale === "en" ? "العربية" : "EN"}
        </button>
      </div>
    </header>
  );
}

function Nav({
  locale,
  mode,
  view,
  onView
}: {
  locale: Locale;
  mode: Mode;
  view: View;
  onView: (view: View) => void;
}) {
  const items: Array<{ id: View; en: string; ar: string; icon: typeof LayoutGrid }> = [
    { id: "floor", en: "Floor", ar: "الصالة", icon: LayoutGrid },
    { id: "orders", en: "Orders", ar: "الطلبات", icon: ListChecks },
    { id: "attention", en: "Attention", ar: "التنبيهات", icon: BellRing },
    { id: "bills", en: "Bills", ar: "الفواتير", icon: Receipt },
    { id: "shift", en: "Shift", ar: "الوردية", icon: Banknote }
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-[#342A23] bg-[#1C1612] px-2 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.id === view;
        const preferred =
          (mode === "cashier" && item.id === "orders") ||
          (mode === "waiter" && (item.id === "attention" || item.id === "floor"));
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onView(item.id)}
            className={`flex min-h-11 min-w-[112px] items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold transition ${
              active
                ? "bg-[#33271F] text-[#FFF5E7]"
                : "text-[#B3A496] hover:bg-[#292019]"
            }`}
          >
            <Icon className={`size-4 ${active ? "text-[#E0A764]" : "text-[#8F8176]"}`} />
            {L(locale, item.en, item.ar)}
            {preferred && !active ? <span className="size-1.5 rounded-full bg-[#C68A4A]" /> : null}
          </button>
        );
      })}
    </nav>
  );
}

function QueueButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-start transition ${
        active
          ? "border-[#8A6239] bg-[#34271E]"
          : "border-[#3B3028] bg-[#211A15] hover:border-[#554238] hover:bg-[#292019]"
      }`}
    >
      {children}
    </button>
  );
}

function OrdersView({ locale }: { locale: Locale }) {
  const [selectedId, setSelectedId] = useState(orders[0].id);
  const selected = orders.find((order) => order.id === selectedId) ?? orders[0];

  return (
    <div className="grid min-h-[calc(100vh-7rem)] lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="border-e border-[#342A23] bg-[#17120F] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-[#FFF5E8]">{L(locale, "Orders", "الطلبات")}</h1>
            <p className="mt-1 text-xs text-[#95887D]">{L(locale, "Process what needs action first", "ابدأ بما يحتاج إجراء")}</p>
          </div>
          <button type="button" className="flex size-9 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195]">
            <RefreshCw className="size-4" />
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <button type="button" className="min-h-9 rounded-md bg-[#C68A4A] px-3 text-xs font-semibold text-[#1B120C]">
            {L(locale, "Needs action", "يحتاج إجراء")} 1
          </button>
          <button type="button" className="min-h-9 rounded-md border border-[#3B3028] px-3 text-xs text-[#BFB0A2]">
            {L(locale, "Active", "نشط")} 3
          </button>
        </div>

        <div className="mt-3 grid gap-2">
          {orders.map((order) => (
            <QueueButton key={order.id} active={order.id === selected.id} onClick={() => setSelectedId(order.id)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#FFF4E6]">{order.id}</p>
                  <p className="mt-1 text-xs text-[#A99B8E]">
                    {L(locale, "Table", "ترابيزة")} {order.table} · {order.age}
                  </p>
                </div>
                <Status tone={toneForOrder(order.status)}>
                  {order.status === "review"
                    ? L(locale, "Review", "مراجعة")
                    : order.status === "ready"
                      ? L(locale, "Ready", "جاهز")
                      : order.status === "preparing"
                        ? L(locale, "Preparing", "تحضير")
                        : L(locale, "Accepted", "مقبول")}
                </Status>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-xs text-[#96897E]">{order.items[0]}</p>
                <strong className="text-sm text-[#FFF4E6]">{order.total}</strong>
              </div>
            </QueueButton>
          ))}
        </div>
      </section>

      <section className="min-w-0 bg-[#1E1814] p-4 lg:p-5">
        <div className="mx-auto max-w-3xl">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#3A3028] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[#A68B70]">
                {L(locale, "Selected order", "الطلب المحدد")}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#FFF5E8]">{selected.id}</h2>
              <p className="mt-1 text-sm text-[#A99B8E]">{L(locale, "Table", "ترابيزة")} {selected.table} · {selected.age}</p>
            </div>
            <strong className="text-2xl text-[#FFF5E8]">{selected.total}</strong>
          </div>

          {selected.reason ? (
            <div className="mt-4 flex gap-3 rounded-md border border-[#71413A] bg-[#321F1C] p-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#E78E84]" />
              <div>
                <p className="text-sm font-semibold text-[#F2B0A9]">{L(locale, "Needs review", "يحتاج مراجعة")}</p>
                <p className="mt-1 text-xs leading-5 text-[#CDA49E]">{selected.reason}</p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-md border border-[#3C3129] bg-[#211A15]">
            <div className="border-b border-[#3A3028] px-4 py-3">
              <h3 className="text-sm font-semibold text-[#F8EDDF]">{L(locale, "Items", "المنتجات")}</h3>
            </div>
            <div className="divide-y divide-[#342B24]">
              {selected.items.map((item) => (
                <div key={item} className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-[#D9CCC0]">
                  <span>{item}</span>
                  <span className="text-xs text-[#8F8176]">{L(locale, "No change", "بدون تعديل")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-[#3A3028] bg-[#211A15] p-3">
              <p className="text-[11px] text-[#91857A]">{L(locale, "Source", "المصدر")}</p>
              <p className="mt-1 text-sm font-semibold text-[#F6EBDD]">QR Session</p>
            </div>
            <div className="rounded-md border border-[#3A3028] bg-[#211A15] p-3">
              <p className="text-[11px] text-[#91857A]">{L(locale, "Preparation", "التحضير")}</p>
              <p className="mt-1 text-sm font-semibold text-[#F6EBDD]">
                {selected.status === "ready" ? L(locale, "Ready", "جاهز") : L(locale, "Not ready", "غير جاهز")}
              </p>
            </div>
            <div className="rounded-md border border-[#3A3028] bg-[#211A15] p-3">
              <p className="text-[11px] text-[#91857A]">{L(locale, "Next role", "الدور التالي")}</p>
              <p className="mt-1 text-sm font-semibold text-[#F6EBDD]">
                {selected.status === "ready" ? L(locale, "Waiter", "ويتر") : L(locale, "Kitchen / Bar", "مطبخ / بار")}
              </p>
            </div>
          </div>

          <div className="sticky bottom-3 mt-5 flex flex-wrap gap-2 rounded-lg border border-[#47392E] bg-[#18130F]/96 p-3 shadow-[0_-12px_40px_rgba(0,0,0,.25)] backdrop-blur">
            {selected.status === "review" ? (
              <>
                <button type="button" className="min-h-11 flex-1 rounded-md bg-[#C68A4A] px-4 text-sm font-bold text-[#1A110B]">
                  {L(locale, "Accept order", "قبول الطلب")}
                </button>
                <button type="button" className="min-h-11 rounded-md border border-[#76413C] bg-[#321F1D] px-4 text-sm font-semibold text-[#F0A39B]">
                  {L(locale, "Reject", "رفض")}
                </button>
              </>
            ) : selected.status === "ready" ? (
              <button type="button" className="min-h-11 flex-1 rounded-md bg-[#4F704E] px-4 text-sm font-bold text-white">
                {L(locale, "Mark served", "تم التقديم")}
              </button>
            ) : (
              <button type="button" className="min-h-11 flex-1 rounded-md border border-[#524237] bg-[#2A211B] px-4 text-sm font-semibold text-[#E9DACB]">
                {L(locale, "Open lifecycle", "فتح دورة الطلب")}
              </button>
            )}
            <button type="button" className="min-h-11 rounded-md border border-[#4A3C32] bg-[#211A15] px-4 text-sm font-semibold text-[#CBBCAF]">
              {L(locale, "Cancel", "إلغاء")}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AttentionView({ locale }: { locale: Locale }) {
  const [selectedId, setSelectedId] = useState(attention[0].id);
  const selected =
    attention.find((item) => item.id === selectedId) ?? attention[0];

  return (
    <div className="grid min-h-[calc(100vh-7rem)] lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 bg-[#1E1814] p-3 lg:p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
              {L(locale, "Waiter queue", "طابور الويتر")}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[#FFF4E6]">
              {L(locale, "Attention", "التنبيهات")}
            </h1>
            <p className="mt-1 text-xs text-[#9E9084]">
              {L(
                locale,
                "Oldest and highest-impact service work first",
                "الأقدم والأهم في الخدمة يظهر الأول"
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Status tone="danger">
              1 {L(locale, "urgent", "عاجل")}
            </Status>
            <Status tone="warning">
              2 {L(locale, "due", "مستحق")}
            </Status>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-[#3A3028] bg-[#18130F]">
          <div className="hidden grid-cols-[82px_80px_minmax(0,1fr)_82px] gap-3 border-b border-[#342B24] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#80746A] md:grid">
            <span>{L(locale, "Table", "ترابيزة")}</span>
            <span>{L(locale, "Age", "الوقت")}</span>
            <span>{L(locale, "Need", "المطلوب")}</span>
            <span>{L(locale, "Source", "المصدر")}</span>
          </div>

          <div className="divide-y divide-[#342B24]">
            {attention.map((item) => {
              const active = item.id === selected.id;
              const accent =
                item.level === "urgent"
                  ? "bg-[#C85E52]"
                  : item.level === "due"
                    ? "bg-[#D6A34C]"
                    : "bg-[#6D7A72]";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`relative grid w-full gap-2 px-3 py-3 text-start transition md:grid-cols-[82px_80px_minmax(0,1fr)_82px] md:items-center md:gap-3 ${
                    active
                      ? "bg-[#34271E]"
                      : "bg-[#211A15] hover:bg-[#292019]"
                  }`}
                >
                  <span className={`absolute inset-y-0 start-0 w-1 ${accent}`} />
                  <div className="flex items-center justify-between gap-3 md:block">
                    <span className="text-xl font-bold text-[#FFF5E8]">
                      {item.table}
                    </span>
                    <span className="md:hidden">
                      <Status
                        tone={
                          item.level === "urgent"
                            ? "danger"
                            : item.level === "due"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {item.age}
                      </Status>
                    </span>
                  </div>
                  <span className="hidden text-xs font-semibold text-[#C9BAAC] md:block">
                    {item.age}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-5 text-[#F3E6D8]">
                      {locale === "ar" ? item.reasonAr : item.reasonEn}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.08em] text-[#82766C] md:hidden">
                      {item.source}
                    </p>
                  </div>
                  <span className="hidden text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8E8176] md:block">
                    {item.source}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
          {L(locale, "Current task", "المهمة الحالية")}
        </p>
        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-4xl font-bold text-[#FFF5E8]">
              {selected.table}
            </p>
            <p className="mt-2 text-sm text-[#A99B8E]">
              {selected.age} · {selected.source}
            </p>
          </div>
          <Status
            tone={
              selected.level === "urgent"
                ? "danger"
                : selected.level === "due"
                  ? "warning"
                  : "neutral"
            }
          >
            {selected.level === "urgent"
              ? L(locale, "Urgent", "عاجل")
              : selected.level === "due"
                ? L(locale, "Due", "مستحق")
                : L(locale, "Active", "نشط")}
          </Status>
        </div>

        <div className="mt-5 rounded-md border border-[#3B3028] bg-[#211A15] p-4">
          <p className="text-xs text-[#8F8176]">
            {L(locale, "Reason", "السبب")}
          </p>
          <p className="mt-2 text-base font-semibold leading-6 text-[#F4E7D8]">
            {locale === "ar" ? selected.reasonAr : selected.reasonEn}
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            className="min-h-12 rounded-md bg-[#C68A4A] px-4 text-sm font-bold text-[#1A110B]"
          >
            {selected.source === "ready"
              ? L(locale, "Serve order", "تقديم الطلب")
              : L(locale, "Acknowledge / claim", "استلام الطلب")}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-md border border-[#4A3B31] bg-[#241C17] px-4 text-sm font-semibold text-[#E9DACB]"
          >
            {L(locale, "Resolve", "حل")}
          </button>
          {selected.source === "computed" ? (
            <button
              type="button"
              className="min-h-11 rounded-md border border-[#4A3B31] bg-transparent px-4 text-xs font-semibold text-[#BDAEA1]"
            >
              {L(locale, "Mute / recalculate", "كتم / إعادة حساب")}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function FloorView({
  locale,
  onView
}: {
  locale: Locale;
  onView: (view: View) => void;
}) {
  const [area, setArea] = useState<"dining" | "terrace">("dining");
  const [selectedId, setSelectedId] = useState("T03");

  const visibleTables = tables.filter((table) => table.area === area);
  const selected =
    tables.find((table) => table.id === selectedId) ?? visibleTables[0];
  const selectedOrder = orders.find((order) => order.table === selected.id);
  const selectedBill = bills.find((bill) => bill.table === selected.id);
  const selectedAttention = attention.find(
    (item) => item.table === selected.id
  );

  const selectArea = (next: "dining" | "terrace") => {
    setArea(next);
    setSelectedId(
      tables.find((table) => table.area === next)?.id ?? selectedId
    );
  };

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[#1E1814]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#352B24] bg-[#17120F] px-3 py-2.5">
        <div className="flex items-center gap-1">
          {[
            ["dining", L(locale, "Main dining", "الصالة الرئيسية")],
            ["terrace", L(locale, "Terrace", "التراس")]
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectArea(id as "dining" | "terrace")}
              className={`min-h-9 rounded-md px-3 text-xs font-semibold ${
                area === id
                  ? "bg-[#E8DED4] text-[#241A14]"
                  : "text-[#AFA195] hover:bg-[#292019]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1.5 text-[#A89A8E]">
            <span className="size-2 rounded-full bg-[#5E6254]" />
            {L(locale, "Active", "نشطة")}
          </span>
          <span className="flex items-center gap-1.5 text-[#A89A8E]">
            <span className="size-2 rounded-full bg-[#B48634]" />
            {L(locale, "Attention", "تنبيه")}
          </span>
          <span className="flex items-center gap-1.5 text-[#A89A8E]">
            <span className="size-2 rounded-full bg-[#B75349]" />
            {L(locale, "Urgent", "عاجل")}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 p-3 lg:p-4">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
                {L(locale, "Live floor", "الصالة مباشرة")}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-[#FFF5E8]">
                {area === "dining"
                  ? L(locale, "Main dining", "الصالة الرئيسية")
                  : L(locale, "Terrace", "التراس")}
              </h1>
            </div>
            <p className="text-[11px] text-[#8F8176]">
              {visibleTables.filter((table) => table.state !== "free").length}{" "}
              {L(locale, "active tables", "ترابيزات نشطة")}
            </p>
          </div>

          <div className="relative min-h-[560px] overflow-hidden rounded-xl border border-[#38302A] bg-[#11100F] shadow-inner">
            <div className="absolute inset-4 rounded-lg border border-dashed border-[#2E2925]" />
            <div className="absolute inset-x-[8%] top-[36%] border-t border-dashed border-[#28231F]" />
            <div className="absolute bottom-[22%] top-[7%] start-[31%] border-s border-dashed border-[#28231F]" />
            <div className="absolute bottom-3 start-4 rounded bg-[#1B1815] px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5F5954]">
              {area === "dining"
                ? L(locale, "Floor plan · Ground", "مخطط الصالة · الأرضي")
                : L(locale, "Floor plan · Terrace", "مخطط الصالة · التراس")}
            </div>

            {visibleTables.map((table) => {
              const active = table.id === selected.id;
              const tone =
                table.state === "urgent"
                  ? "border-[#C55D52] bg-[#5A2925] text-[#FFE7E3]"
                  : table.state === "attention" || table.state === "bill"
                    ? "border-[#C18C37] bg-[#554018] text-[#FFF0C7]"
                    : table.state === "active"
                      ? "border-[#667061] bg-[#33382F] text-[#F0F0E7]"
                      : "border-[#4A4540] bg-[#292724] text-[#C7C1BB]";

              const shape =
                table.shape === "round"
                  ? "rounded-full"
                  : table.shape === "wide"
                    ? "rounded-[22px]"
                    : "rounded-xl";

              return (
                <button
                  key={table.id}
                  type="button"
                  onClick={() => setSelectedId(table.id)}
                  style={{
                    left: `${table.x}%`,
                    top: `${table.y}%`,
                    width: `${table.w}%`,
                    height: `${table.h}%`
                  }}
                  className={`absolute flex min-h-[76px] min-w-[76px] flex-col items-center justify-center border-2 p-2 text-center transition ${shape} ${tone} ${
                    active
                      ? "ring-2 ring-[#E5A65E] ring-offset-2 ring-offset-[#11100F]"
                      : "hover:brightness-110"
                  }`}
                >
                  {table.state !== "free" ? (
                    <span className="text-[10px] font-bold opacity-80">
                      {table.meta}
                    </span>
                  ) : null}
                  <span className="mt-0.5 text-2xl font-black leading-none">
                    {table.id.replace("T", "")}
                  </span>
                  <span className="mt-1 max-w-full truncate text-[9px] font-semibold uppercase tracking-[0.05em] opacity-80">
                    {table.state === "free"
                      ? L(locale, "Free", "فاضية")
                      : table.state === "bill"
                        ? L(locale, "Bill", "فاتورة")
                        : table.state === "urgent"
                          ? L(locale, "Waiter", "ويتر")
                          : table.state === "attention"
                            ? L(locale, "Attention", "تنبيه")
                            : L(locale, "Active", "نشطة")}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
            {L(locale, "Table details", "تفاصيل الترابيزة")}
          </p>

          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-4xl font-black text-[#FFF5E8]">
                {selected.id}
              </p>
              <p className="mt-1 text-xs text-[#93867B]">
                {selected.state === "free"
                  ? L(locale, "No active session", "لا توجد جلسة نشطة")
                  : L(locale, "Active table session", "جلسة ترابيزة نشطة")}
              </p>
            </div>
            {selected.state !== "free" ? (
              <Status
                tone={
                  selected.state === "urgent"
                    ? "danger"
                    : selected.state === "attention" ||
                        selected.state === "bill"
                      ? "warning"
                      : "neutral"
                }
              >
                {selected.meta}
              </Status>
            ) : (
              <Status>{L(locale, "Free", "فاضية")}</Status>
            )}
          </div>

          {selected.state !== "free" ? (
            <div className="mt-5 grid gap-2">
              {selectedAttention ? (
                <button
                  type="button"
                  onClick={() => onView("attention")}
                  className="rounded-md border border-[#714D34] bg-[#2D2319] p-3 text-start"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#B68C64]">
                    {L(locale, "Attention", "تنبيه")}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-5 text-[#F1DDC8]">
                    {locale === "ar"
                      ? selectedAttention.reasonAr
                      : selectedAttention.reasonEn}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold text-[#A78D78]">
                    {L(locale, "Open queue →", "افتح الطابور ←")}
                  </p>
                </button>
              ) : null}

              {selectedOrder ? (
                <button
                  type="button"
                  onClick={() => onView("orders")}
                  className="rounded-md border border-[#3D342D] bg-[#211A15] p-3 text-start"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8D8075]">
                        {L(locale, "Order", "الطلب")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#F4E8DA]">
                        {selectedOrder.id}
                      </p>
                    </div>
                    <Status tone={toneForOrder(selectedOrder.status)}>
                      {selectedOrder.status}
                    </Status>
                  </div>
                  <p className="mt-2 text-xs text-[#A99B8E]">
                    {selectedOrder.items[0]}
                  </p>
                </button>
              ) : null}

              {selectedBill ? (
                <button
                  type="button"
                  onClick={() => onView("bills")}
                  className="rounded-md border border-[#3D342D] bg-[#211A15] p-3 text-start"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8D8075]">
                        {L(locale, "Bill", "الفاتورة")}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#F4E8DA]">
                        {selectedBill.id}
                      </p>
                    </div>
                    <strong className="text-sm text-[#FFF5E8]">
                      {selectedBill.total}
                    </strong>
                  </div>
                </button>
              ) : null}

              {!selectedAttention && !selectedOrder && !selectedBill ? (
                <div className="rounded-md border border-[#3D342D] bg-[#211A15] p-3">
                  <p className="text-sm font-semibold text-[#E8DBCE]">
                    {L(locale, "Session active", "الجلسة نشطة")}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#93867B]">
                    {L(
                      locale,
                      "No active attention, order exception, or bill request.",
                      "لا يوجد تنبيه أو استثناء طلب أو فاتورة نشطة."
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-5 rounded-md border border-dashed border-[#3C342D] p-4 text-xs leading-5 text-[#847970]">
              {L(
                locale,
                "Select an occupied table to see its live service context.",
                "اختار ترابيزة مشغولة علشان تشوف سياق الخدمة الحالي."
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BillsView({ locale }: { locale: Locale }) {
  const [selected, setSelected] = useState(bills[0]);
  return (
    <div className="grid min-h-[calc(100vh-7rem)] lg:grid-cols-[350px_minmax(0,1fr)]">
      <section className="border-e border-[#342A23] bg-[#17120F] p-3">
        <h1 className="text-base font-semibold text-[#FFF5E8]">{L(locale, "Bills", "الفواتير")}</h1>
        <p className="mt-1 text-xs text-[#95887D]">{L(locale, "Requests and immediate settlement", "طلبات الفاتورة والتحصيل المباشر")}</p>
        <div className="mt-4 grid gap-2">
          {bills.map((bill) => (
            <QueueButton key={bill.id} active={selected.id === bill.id} onClick={() => setSelected(bill)}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#FFF4E6]">{bill.id}</p>
                  <p className="mt-1 text-xs text-[#9A8D81]">{L(locale, "Table", "ترابيزة")} {bill.table} · {bill.age}</p>
                </div>
                <Status tone={bill.state === "unknown" ? "danger" : bill.state === "requested" ? "warning" : bill.state === "paid" ? "success" : "neutral"}>
                  {bill.state === "unknown"
                    ? L(locale, "Needs review", "يحتاج مراجعة")
                    : bill.state === "requested"
                      ? L(locale, "Requested", "مطلوبة")
                      : bill.state === "paid"
                        ? L(locale, "Paid", "مدفوعة")
                        : L(locale, "Presented", "مقدمة")}
                </Status>
              </div>
              <p className="mt-3 text-lg font-semibold text-[#FFF4E6]">{bill.total}</p>
            </QueueButton>
          ))}
        </div>
      </section>

      <section className="bg-[#1E1814] p-4 lg:p-5">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#3A3028] pb-4">
            <div>
              <p className="text-xs text-[#9B8E82]">{L(locale, "Table", "ترابيزة")} {selected.table}</p>
              <h2 className="mt-1 text-2xl font-semibold text-[#FFF5E8]">{selected.id}</h2>
            </div>
            <strong className="text-3xl text-[#FFF5E8]">{selected.total}</strong>
          </div>

          {selected.state === "unknown" ? (
            <div className="mt-4 flex gap-3 rounded-md border border-[#71413A] bg-[#321F1C] p-4">
              <AlertTriangle className="size-4 shrink-0 text-[#E78E84]" />
              <div>
                <p className="text-sm font-semibold text-[#F2B0A9]">{L(locale, "Payment status unknown", "حالة الدفع غير محسومة")}</p>
                <p className="mt-1 text-xs leading-5 text-[#CDA49E]">
                  {L(locale, "Do not record another payment until the current state is reviewed.", "لا تسجل دفعة جديدة قبل مراجعة الحالة الحالية.")}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-md border border-[#3C3129] bg-[#211A15]">
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#372D26] px-4 py-3 text-sm">
              <span className="text-[#CDBFB1]">2× Spanish Latte</span><span className="text-[#F5EBDD]">190 EGP</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 border-b border-[#372D26] px-4 py-3 text-sm">
              <span className="text-[#CDBFB1]">1× Basque Cheesecake</span><span className="text-[#F5EBDD]">135 EGP</span>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
              <span className="font-semibold text-[#F5EBDD]">{L(locale, "Total", "الإجمالي")}</span><span className="font-bold text-[#FFF5E8]">{selected.total}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {selected.state === "requested" ? (
              <>
                <button type="button" className="min-h-12 rounded-md bg-[#C68A4A] px-4 text-sm font-bold text-[#1B120C]">{L(locale, "Acknowledge", "استلام الطلب")}</button>
                <button type="button" className="min-h-12 rounded-md border border-[#4B3D32] bg-[#241C17] px-4 text-sm font-semibold text-[#E9DACB]">{L(locale, "Present bill", "تقديم الفاتورة")}</button>
              </>
            ) : selected.state === "paid" ? (
              <button type="button" className="min-h-12 rounded-md bg-[#456546] px-4 text-sm font-bold text-white sm:col-span-2">{L(locale, "View receipt", "عرض الإيصال")}</button>
            ) : selected.state !== "unknown" ? (
              <>
                <button type="button" className="min-h-12 rounded-md bg-[#C68A4A] px-4 text-sm font-bold text-[#1B120C]"><Banknote className="me-2 inline size-4" />{L(locale, "Cash", "كاش")}</button>
                <button type="button" className="min-h-12 rounded-md border border-[#4B3D32] bg-[#241C17] px-4 text-sm font-semibold text-[#E9DACB]"><CreditCard className="me-2 inline size-4" />{L(locale, "External POS / other", "POS خارجي / أخرى")}</button>
              </>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function ShiftView({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(true);
  const [closeMode, setCloseMode] = useState(false);

  if (!open) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center bg-[#1E1814] p-4">
        <div className="w-full max-w-lg rounded-lg border border-[#40342B] bg-[#211A15] p-5">
          <Banknote className="size-6 text-[#C68A4A]" />
          <h1 className="mt-4 text-xl font-semibold text-[#FFF5E8]">{L(locale, "Open cashier shift", "فتح وردية كاشير")}</h1>
          <p className="mt-2 text-sm leading-6 text-[#A99B8E]">{L(locale, "Manual payments and drawer activity require an open shift.", "المدفوعات اليدوية وحركة الصندوق تحتاج وردية مفتوحة.")}</p>
          <label className="mt-5 block text-xs text-[#A99B8E]">
            {L(locale, "Opening float", "رصيد البداية")}
            <input defaultValue="500.00" className="mt-2 min-h-11 w-full rounded-md border border-[#4A3C32] bg-[#18130F] px-3 text-sm text-[#FFF5E8] outline-none" />
          </label>
          <button type="button" onClick={() => setOpen(true)} className="mt-4 min-h-12 w-full rounded-md bg-[#C68A4A] text-sm font-bold text-[#1B120C]">{L(locale, "Open shift", "فتح الوردية")}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[#1E1814] p-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Status tone="success">{L(locale, "Shift open", "الوردية مفتوحة")}</Status>
            <h1 className="mt-2 text-xl font-semibold text-[#FFF5E8]">{L(locale, "Cashier shift", "وردية الكاشير")}</h1>
            <p className="mt-1 text-xs text-[#9B8E82]">{L(locale, "Opened 09:02 · Balkona Main", "بدأت 09:02 · بلكونة الرئيسي")}</p>
          </div>
          <button type="button" className="min-h-10 rounded-md border border-[#4A3C32] bg-[#241C17] px-4 text-xs font-semibold text-[#E6D7C8]">{L(locale, "X report", "تقرير X")}</button>
        </div>

        <div className="mt-4 grid overflow-hidden rounded-lg border border-[#3D322A] bg-[#211A15] sm:grid-cols-2 lg:grid-cols-4">
          {[
            [L(locale, "Opening float", "رصيد البداية"), "500 EGP"],
            [L(locale, "Expected cash", "الكاش المتوقع"), "13,840 EGP"],
            [L(locale, "Collected", "المحصّل"), "31,420 EGP"],
            [L(locale, "Bills", "الفواتير"), "184"]
          ].map(([label, value], index) => (
            <div key={label} className={`p-4 ${index ? "border-t border-[#362C25] sm:border-s sm:border-t-0" : ""}`}>
              <p className="text-xs text-[#91857A]">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-[#FFF5E8]">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-[#3D322A] bg-[#211A15] p-4">
            <h2 className="text-sm font-semibold text-[#F4E7D8]">{L(locale, "Drawer adjustment", "تعديل الصندوق")}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <input placeholder="0.00" className="min-h-11 rounded-md border border-[#493B31] bg-[#18130F] px-3 text-sm text-[#FFF5E8] outline-none" />
              <input placeholder={L(locale, "Required note", "ملاحظة مطلوبة")} className="min-h-11 rounded-md border border-[#493B31] bg-[#18130F] px-3 text-sm text-[#FFF5E8] outline-none" />
              <button type="button" className="min-h-11 rounded-md bg-[#342A23] px-4 text-xs font-semibold text-[#E7D8C9]">{L(locale, "Cash in", "إدخال كاش")}</button>
            </div>
          </section>

          <section className="rounded-lg border border-[#3D322A] bg-[#211A15] p-4">
            <h2 className="text-sm font-semibold text-[#F4E7D8]">{L(locale, "Close readiness", "جاهزية الإغلاق")}</h2>
            <div className="mt-3 grid gap-2 text-xs">
              <div className="flex items-center justify-between"><span className="text-[#B7A99C]">{L(locale, "Open orders", "طلبات مفتوحة")}</span><strong className="text-[#F4C06D]">2</strong></div>
              <div className="flex items-center justify-between"><span className="text-[#B7A99C]">{L(locale, "Unpaid bills", "فواتير غير مدفوعة")}</span><strong className="text-[#F4C06D]">1</strong></div>
              <div className="flex items-center justify-between"><span className="text-[#B7A99C]">{L(locale, "Unknown payments", "مدفوعات غير محسومة")}</span><strong className="text-[#ED958C]">1</strong></div>
            </div>
          </section>
        </div>

        {closeMode ? (
          <section className="mt-4 rounded-lg border border-[#74453E] bg-[#2E1E1B] p-4">
            <h2 className="text-sm font-semibold text-[#F2B1A9]">{L(locale, "Close blockers", "عوائق الإغلاق")}</h2>
            <p className="mt-2 text-xs leading-5 text-[#CFA49E]">{L(locale, "Resolve open orders, unpaid bills, and unknown payment state before final close.", "حل الطلبات المفتوحة والفواتير غير المدفوعة وحالة الدفع غير المحسومة قبل الإغلاق النهائي.")}</p>
          </section>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => setCloseMode(true)} className="min-h-11 rounded-md border border-[#6E443D] bg-[#2F211D] px-4 text-sm font-semibold text-[#F0A59E]">{L(locale, "Begin close", "بدء الإغلاق")}</button>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-md border border-[#4A3C32] bg-[#241C17] px-4 text-sm font-semibold text-[#DCCDBF]">{L(locale, "Preview no-open-shift state", "معاينة حالة بدون وردية")}</button>
        </div>
      </div>
    </div>
  );
}

export function ServicePrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [mode, setMode] = useState<Mode>("cashier");
  const [view, setView] = useState<View>("orders");

  const switchMode = (next: Mode) => {
    setMode(next);
    setView(next === "cashier" ? "orders" : "attention");
  };

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#18130F] text-[#FFF5E8]">
      <TopBar
        locale={locale}
        mode={mode}
        onLocale={() => setLocale((value) => value === "en" ? "ar" : "en")}
        onMode={switchMode}
      />
      <Nav locale={locale} mode={mode} view={view} onView={setView} />

      {view === "orders" ? <OrdersView locale={locale} /> : null}
      {view === "attention" ? <AttentionView locale={locale} /> : null}
      {view === "floor" ? <FloorView locale={locale} onView={setView} /> : null}
      {view === "bills" ? <BillsView locale={locale} /> : null}
      {view === "shift" ? <ShiftView locale={locale} /> : null}
    </div>
  );
}
