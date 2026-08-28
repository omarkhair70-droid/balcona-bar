"use client";

import {
  AlertTriangle,
  Banknote,
  BellRing,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  HandPlatter,
  LayoutGrid,
  ListChecks,
  Radio,
  Receipt,
  RefreshCw,
  Search,
  Users,
  WalletCards,
  X
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
  { id: "T01", state: "free", meta: "—" },
  { id: "T02", state: "active", meta: "18m" },
  { id: "T03", state: "attention", meta: "2m" },
  { id: "T04", state: "free", meta: "—" },
  { id: "T05", state: "active", meta: "31m" },
  { id: "T06", state: "free", meta: "—" },
  { id: "T07", state: "bill", meta: "3m" },
  { id: "T08", state: "active", meta: "22m" },
  { id: "T09", state: "free", meta: "—" },
  { id: "T10", state: "active", meta: "15m" },
  { id: "T11", state: "free", meta: "—" },
  { id: "T12", state: "urgent", meta: "6m" }
];

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
  const selected = attention.find((item) => item.id === selectedId) ?? attention[0];

  return (
    <div className="grid min-h-[calc(100vh-7rem)] lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="bg-[#1E1814] p-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#FFF4E6]">{L(locale, "Attention", "التنبيهات")}</h1>
            <p className="mt-1 text-xs text-[#9E9084]">{L(locale, "Who needs service right now?", "مين محتاج خدمة دلوقتي؟")}</p>
          </div>
          <Status tone="danger">1 {L(locale, "urgent", "عاجل")}</Status>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {attention.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`min-h-[150px] rounded-lg border p-4 text-start transition ${
                item.id === selected.id
                  ? "border-[#9A6B3D] bg-[#34271E]"
                  : "border-[#3A3028] bg-[#211A15] hover:border-[#58463A]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-[#FFF5E8]">{item.table}</p>
                  <p className="mt-1 text-xs text-[#9F9184]">{item.age}</p>
                </div>
                <Status tone={item.level === "urgent" ? "danger" : item.level === "due" ? "warning" : "neutral"}>
                  {item.level === "urgent"
                    ? L(locale, "Urgent", "عاجل")
                    : item.level === "due"
                      ? L(locale, "Due", "مستحق")
                      : L(locale, "Active", "نشط")}
                </Status>
              </div>
              <p className="mt-5 text-sm font-semibold leading-5 text-[#F3E6D8]">
                {locale === "ar" ? item.reasonAr : item.reasonEn}
              </p>
              <p className="mt-2 text-[11px] text-[#8E8176]">{item.source}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="border-s border-[#352B24] bg-[#17120F] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">{L(locale, "Selected table", "الترابيزة المحددة")}</p>
        <p className="mt-2 text-4xl font-bold text-[#FFF5E8]">{selected.table}</p>
        <p className="mt-2 text-sm text-[#A99B8E]">{selected.age} · {selected.source}</p>

        <div className="mt-5 rounded-md border border-[#3B3028] bg-[#211A15] p-4">
          <p className="text-xs text-[#8F8176]">{L(locale, "Reason", "السبب")}</p>
          <p className="mt-2 text-base font-semibold leading-6 text-[#F4E7D8]">
            {locale === "ar" ? selected.reasonAr : selected.reasonEn}
          </p>
        </div>

        <div className="mt-4 grid gap-2">
          <button type="button" className="min-h-12 rounded-md bg-[#C68A4A] px-4 text-sm font-bold text-[#1A110B]">
            {selected.source === "ready"
              ? L(locale, "Serve order", "تقديم الطلب")
              : L(locale, "Acknowledge / claim", "استلام الطلب")}
          </button>
          <button type="button" className="min-h-12 rounded-md border border-[#4A3B31] bg-[#241C17] px-4 text-sm font-semibold text-[#E9DACB]">
            {L(locale, "Resolve", "حل")}
          </button>
          {selected.source === "computed" ? (
            <button type="button" className="min-h-11 rounded-md border border-[#4A3B31] bg-transparent px-4 text-xs font-semibold text-[#BDAEA1]">
              {L(locale, "Mute / recalculate", "كتم / إعادة حساب")}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function FloorView({ locale }: { locale: Locale }) {
  return (
    <div className="min-h-[calc(100vh-7rem)] bg-[#1E1814] p-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#FFF5E8]">{L(locale, "Floor", "الصالة")}</h1>
          <p className="mt-1 text-xs text-[#9E9084]">{L(locale, "Ground floor · live table state", "الدور الأرضي · حالة الترابيزات مباشرة")}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Status>{L(locale, "Free", "فاضية")}</Status>
          <Status tone="warning">{L(locale, "Attention", "تنبيه")}</Status>
          <Status tone="danger">{L(locale, "Urgent", "عاجل")}</Status>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {tables.map((table) => {
          const tone =
            table.state === "urgent"
              ? "border-[#7F443D] bg-[#38211E]"
              : table.state === "attention" || table.state === "bill"
                ? "border-[#70552D] bg-[#302719]"
                : table.state === "active"
                  ? "border-[#4B4937] bg-[#25241B]"
                  : "border-[#3A3028] bg-[#211A15]";
          return (
            <button
              key={table.id}
              type="button"
              className={`aspect-square min-h-[138px] rounded-xl border p-4 text-start transition hover:scale-[1.01] ${tone}`}
            >
              <div className="flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <span className="text-2xl font-bold text-[#FFF5E8]">{table.id}</span>
                  {table.state === "urgent" ? <BellRing className="size-4 text-[#ED9187]" /> : null}
                  {table.state === "bill" ? <Receipt className="size-4 text-[#E5BA64]" /> : null}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#D3C5B8]">
                    {table.state === "free"
                      ? L(locale, "Free", "فاضية")
                      : table.state === "active"
                        ? L(locale, "Active session", "جلسة نشطة")
                        : table.state === "bill"
                          ? L(locale, "Bill waiting", "فاتورة تنتظر")
                          : L(locale, "Needs attention", "تحتاج انتباه")}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8F8176]">{table.meta}</p>
                </div>
              </div>
            </button>
          );
        })}
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
      {view === "floor" ? <FloorView locale={locale} /> : null}
      {view === "bills" ? <BillsView locale={locale} /> : null}
      {view === "shift" ? <ShiftView locale={locale} /> : null}
    </div>
  );
}
