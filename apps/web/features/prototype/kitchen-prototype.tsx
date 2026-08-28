"use client";

import {
  AlertTriangle,
  Check,
  ChefHat,
  CircleDot,
  Clock3,
  Coffee,
  Dessert,
  Flame,
  Languages,
  ListChecks,
  Printer,
  Radio,
  RefreshCw,
  RotateCcw,
  UtensilsCrossed,
  XCircle
} from "lucide-react";
import { useState, type ReactNode } from "react";

type Locale = "en" | "ar";
type Station = "kitchen" | "barista" | "dessert" | "expediter";
type View = "board" | "tickets" | "print";
type TaskStatus = "new" | "in_progress" | "ready";
type PrintStatus = "pending" | "printed" | "failed";

type Task = {
  id: string;
  order: string;
  table: string;
  item: string;
  qty: number;
  station: Exclude<Station, "expediter">;
  age: number;
  status: TaskStatus;
  modifiers?: string[];
  note?: string;
};

type Ticket = {
  id: string;
  code: string;
  order: string;
  table: string;
  floor: string;
  station: Exclude<Station, "expediter">;
  age: number;
  items: Array<{
    qty: number;
    name: string;
    modifiers?: string[];
    note?: string;
  }>;
  print: PrintStatus;
};

type PrintJob = {
  id: string;
  ticket: string;
  station: Exclude<Station, "expediter">;
  printer: string;
  status: PrintStatus;
  age: string;
  error?: string;
};

const initialTasks: Task[] = [
  {
    id: "PT-841",
    order: "#10428",
    table: "T12",
    item: "Beef Burger",
    qty: 2,
    station: "kitchen",
    age: 14,
    status: "new",
    modifiers: ["No onion", "Extra cheese"],
    note: "One burger well done"
  },
  {
    id: "PT-842",
    order: "#10428",
    table: "T12",
    item: "Fries",
    qty: 1,
    station: "kitchen",
    age: 14,
    status: "in_progress"
  },
  {
    id: "PT-836",
    order: "#10425",
    table: "T03",
    item: "Cappuccino",
    qty: 2,
    station: "barista",
    age: 10,
    status: "in_progress",
    modifiers: ["Oat milk"]
  },
  {
    id: "PT-834",
    order: "#10423",
    table: "T09",
    item: "Spanish Latte",
    qty: 1,
    station: "barista",
    age: 8,
    status: "new",
    note: "Less sweet"
  },
  {
    id: "PT-829",
    order: "#10420",
    table: "T04",
    item: "Basque Cheesecake",
    qty: 2,
    station: "dessert",
    age: 7,
    status: "ready"
  },
  {
    id: "PT-827",
    order: "#10419",
    table: "T16",
    item: "Chocolate Cake",
    qty: 1,
    station: "dessert",
    age: 6,
    status: "new"
  },
  {
    id: "PT-823",
    order: "#10418",
    table: "T07",
    item: "Chicken Pasta",
    qty: 1,
    station: "kitchen",
    age: 18,
    status: "in_progress",
    note: "Allergy note: no mushrooms"
  }
];

const tickets: Ticket[] = [
  {
    id: "KT-8821",
    code: "K-128",
    order: "#10428",
    table: "T12",
    floor: "Ground",
    station: "kitchen",
    age: 14,
    print: "printed",
    items: [
      { qty: 2, name: "Beef Burger", modifiers: ["No onion", "Extra cheese"], note: "One well done" },
      { qty: 1, name: "Fries" }
    ]
  },
  {
    id: "KT-8818",
    code: "B-091",
    order: "#10425",
    table: "T03",
    floor: "Ground",
    station: "barista",
    age: 10,
    print: "failed",
    items: [{ qty: 2, name: "Cappuccino", modifiers: ["Oat milk"] }]
  },
  {
    id: "KT-8816",
    code: "D-044",
    order: "#10420",
    table: "T04",
    floor: "Terrace",
    station: "dessert",
    age: 7,
    print: "printed",
    items: [{ qty: 2, name: "Basque Cheesecake" }]
  }
];

const initialPrintJobs: PrintJob[] = [
  {
    id: "PJ-441",
    ticket: "B-091",
    station: "barista",
    printer: "Bar printer",
    status: "failed",
    age: "5m",
    error: "Printer unreachable"
  },
  {
    id: "PJ-440",
    ticket: "K-128",
    station: "kitchen",
    printer: "Main kitchen",
    status: "printed",
    age: "14m"
  },
  {
    id: "PJ-438",
    ticket: "D-044",
    station: "dessert",
    printer: "Dessert printer",
    status: "pending",
    age: "1m"
  }
];

function L(locale: Locale, en: string, ar: string) {
  return locale === "ar" ? ar : en;
}

function stationLabel(locale: Locale, station: Station) {
  if (station === "kitchen") return L(locale, "Kitchen", "المطبخ");
  if (station === "barista") return L(locale, "Barista", "البار");
  if (station === "dessert") return L(locale, "Dessert", "الحلويات");
  return L(locale, "Expediter", "الإكسبيدايتر");
}

function stationIcon(station: Station) {
  if (station === "barista") return Coffee;
  if (station === "dessert") return Dessert;
  if (station === "expediter") return UtensilsCrossed;
  return ChefHat;
}

function taskTone(age: number, status: TaskStatus) {
  if (status === "ready") return "ready";
  if (age >= 15) return "late";
  if (age >= 10) return "warn";
  return "normal";
}

function Pill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "late" | "warn" | "ready" | "danger";
}) {
  const classes = {
    neutral: "border-[#44413D] bg-[#23211F] text-[#C8C2BC]",
    late: "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]",
    warn: "border-[#8A682A] bg-[#352B16] text-[#F7CD73]",
    ready: "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]",
    danger: "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]"
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes[tone]}`}>
      {children}
    </span>
  );
}

function TopFrame({
  locale,
  station,
  view,
  onLocale,
  onStation,
  onView
}: {
  locale: Locale;
  station: Station;
  view: View;
  onLocale: () => void;
  onStation: (station: Station) => void;
  onView: (view: View) => void;
}) {
  const stations: Station[] = ["kitchen", "barista", "dessert", "expediter"];
  const views: Array<{ id: View; en: string; ar: string; icon: typeof ListChecks }> = [
    { id: "board", en: "Board", ar: "البورد", icon: ListChecks },
    { id: "tickets", en: "Tickets", ar: "التذاكر", icon: ChefHat },
    { id: "print", en: "Print", ar: "الطباعة", icon: Printer }
  ];

  return (
    <div className="sticky top-0 z-30 border-b border-[#34312E] bg-[#12110F]/96 backdrop-blur">
      <div className="flex min-h-14 items-center gap-3 px-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-[#C68A4A] text-xs font-black text-[#17110C]">
            B
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-bold text-[#FFF8F0]">Balcona Kitchen</p>
            <p className="text-[10px] text-[#8E8882]">{L(locale, "Balkona Main", "بلكونة الرئيسي")}</p>
          </div>
        </div>

        <div className="mx-auto flex items-center gap-1 overflow-x-auto">
          {stations.map((entry) => {
            const Icon = stationIcon(entry);
            const active = entry === station;
            return (
              <button
                key={entry}
                type="button"
                onClick={() => onStation(entry)}
                className={`flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${
                  active ? "bg-[#2D2925] text-[#FFF7ED]" : "text-[#958F88] hover:bg-[#211F1C]"
                }`}
              >
                <Icon className={`size-4 ${active ? "text-[#D9A263]" : "text-[#77716B]"}`} />
                <span className="hidden md:inline">{stationLabel(locale, entry)}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 text-[11px] text-[#9B958E] sm:flex">
            <Radio className="size-3.5 text-[#6DBD75]" />
            {L(locale, "Live", "متصل")}
          </div>
          <button
            type="button"
            onClick={onLocale}
            className="flex min-h-9 items-center gap-1.5 rounded-md border border-[#3E3A36] bg-[#1B1917] px-3 text-xs font-bold text-[#E6DED6]"
          >
            <Languages className="size-3.5" />
            {locale === "en" ? "AR" : "EN"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[#282522] px-3 py-2">
        <div className="flex gap-1">
          {views.map((entry) => {
            const Icon = entry.icon;
            const active = entry.id === view;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onView(entry.id)}
                className={`flex min-h-10 items-center gap-2 rounded-md px-3 text-xs font-bold transition ${
                  active ? "bg-[#C68A4A] text-[#17110C]" : "text-[#AAA39C] hover:bg-[#24211E]"
                }`}
              >
                <Icon className="size-4" />
                {L(locale, entry.en, entry.ar)}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[#8D8780]">
          <Clock3 className="size-3.5" />
          {L(locale, "Oldest active", "أقدم طلب نشط")} <strong className="text-[#F0B55F]">18m</strong>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  locale,
  onAdvance
}: {
  task: Task;
  locale: Locale;
  onAdvance: (taskId: string) => void;
}) {
  const tone = taskTone(task.age, task.status);
  const cardTone =
    tone === "late"
      ? "border-[#7D3932] bg-[#2B1D1B]"
      : tone === "warn"
        ? "border-[#6F572A] bg-[#282317]"
        : task.status === "ready"
          ? "border-[#36583D] bg-[#19261D]"
          : "border-[#3A3632] bg-[#1C1A18]";

  const nextLabel =
    task.status === "new"
      ? L(locale, "Start", "ابدأ")
      : task.status === "in_progress"
        ? L(locale, "Mark ready", "جاهز")
        : L(locale, "Ready", "جاهز");

  return (
    <article className={`rounded-lg border p-3 ${cardTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black tracking-[-0.04em] text-[#FFF8F0]">{task.table}</span>
            <span className="text-xs font-semibold text-[#8F8982]">{task.order}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Pill tone={tone === "normal" ? "neutral" : tone}>
              {task.age}m
            </Pill>
            {task.station !== "kitchen" ? <Pill>{stationLabel(locale, task.station)}</Pill> : null}
          </div>
        </div>
        {tone === "late" ? <Flame className="size-5 text-[#E66D5F]" /> : null}
        {task.status === "ready" ? <Check className="size-5 text-[#79B983]" /> : null}
      </div>

      <div className="mt-4">
        <p className="text-[22px] font-black leading-6 tracking-[-0.03em] text-[#FFF9F2]">
          {task.qty}× {task.item}
        </p>

        {task.modifiers?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {task.modifiers.map((modifier) => (
              <span key={modifier} className="rounded bg-[#302C28] px-2 py-1 text-xs font-bold text-[#D7CEC6]">
                {modifier}
              </span>
            ))}
          </div>
        ) : null}

        {task.note ? (
          <div className="mt-3 flex gap-2 rounded-md border border-[#7A5F2E] bg-[#312716] p-2.5 text-xs font-bold leading-5 text-[#F3CC79]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{task.note}</span>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={task.status === "ready"}
        onClick={() => onAdvance(task.id)}
        className={`mt-4 min-h-12 w-full rounded-md text-sm font-black transition ${
          task.status === "ready"
            ? "cursor-default bg-[#29412F] text-[#9DCEA5]"
            : task.status === "in_progress"
              ? "bg-[#C68A4A] text-[#17110C] active:scale-[0.99]"
              : "border border-[#57514B] bg-[#25221F] text-[#F1EAE3] active:scale-[0.99]"
        }`}
      >
        {nextLabel}
      </button>
    </article>
  );
}

function BoardView({
  locale,
  station,
  tasks,
  onAdvance
}: {
  locale: Locale;
  station: Station;
  tasks: Task[];
  onAdvance: (taskId: string) => void;
}) {
  const visible = station === "expediter" ? tasks : tasks.filter((task) => task.station === station);

  const groups: Array<{ status: TaskStatus; title: string; count: number }> = [
    { status: "new", title: L(locale, "NEW", "جديد"), count: visible.filter((task) => task.status === "new").length },
    { status: "in_progress", title: L(locale, "IN PROGRESS", "قيد التحضير"), count: visible.filter((task) => task.status === "in_progress").length },
    { status: "ready", title: L(locale, "READY", "جاهز"), count: visible.filter((task) => task.status === "ready").length }
  ];

  return (
    <main className="min-h-[calc(100vh-7rem)] bg-[#151412] p-3 lg:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E8780]">
            {L(locale, "Production board", "بورد الإنتاج")}
          </p>
          <h1 className="mt-1 text-xl font-black text-[#FFF8F0]">{stationLabel(locale, station)}</h1>
        </div>
        <div className="flex gap-2">
          <Pill tone="late">{visible.filter((task) => task.age >= 15 && task.status !== "ready").length} {L(locale, "late", "متأخر")}</Pill>
          <Pill tone="ready">{visible.filter((task) => task.status === "ready").length} {L(locale, "ready", "جاهز")}</Pill>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        {groups.map((group) => {
          const items = visible
            .filter((task) => task.status === group.status)
            .sort((a, b) => b.age - a.age);

          return (
            <section key={group.status} className="min-w-0 rounded-lg border border-[#302D29] bg-[#11100F]">
              <div className="flex min-h-11 items-center justify-between border-b border-[#2D2A27] px-3">
                <div className="flex items-center gap-2">
                  <CircleDot className={`size-3.5 ${
                    group.status === "ready"
                      ? "text-[#69AE73]"
                      : group.status === "in_progress"
                        ? "text-[#D6A24F]"
                        : "text-[#8C8781]"
                  }`} />
                  <h2 className="text-xs font-black tracking-[0.08em] text-[#DAD3CC]">{group.title}</h2>
                </div>
                <span className="text-xs font-bold text-[#8E8882]">{group.count}</span>
              </div>
              <div className="grid gap-2 p-2">
                {items.length ? (
                  items.map((task) => <TaskCard key={task.id} task={task} locale={locale} onAdvance={onAdvance} />)
                ) : (
                  <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-[#34302D] text-xs text-[#6F6963]">
                    {L(locale, "Nothing here", "لا يوجد شيء هنا")}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function TicketsView({
  locale,
  station
}: {
  locale: Locale;
  station: Station;
}) {
  const visible = station === "expediter" ? tickets : tickets.filter((ticket) => ticket.station === station);

  return (
    <main className="min-h-[calc(100vh-7rem)] bg-[#151412] p-3 lg:p-4">
      <div className="mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E8780]">
          {L(locale, "Kitchen tickets", "تذاكر المطبخ")}
        </p>
        <h1 className="mt-1 text-xl font-black text-[#FFF8F0]">{stationLabel(locale, station)}</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((ticket) => (
          <article key={ticket.id} className="rounded-lg border border-[#3A3632] bg-[#1B1917]">
            <div className="flex items-start justify-between gap-3 border-b border-[#302D29] p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#E7E0D8] px-2 py-1 text-xs font-black text-[#171513]">{ticket.code}</span>
                  <span className="text-xs font-bold text-[#8F8982]">{ticket.order}</span>
                </div>
                <p className="mt-2 text-xl font-black text-[#FFF8F0]">{ticket.floor} / {ticket.table}</p>
              </div>
              <div className="text-end">
                <Pill tone={ticket.age >= 12 ? "late" : ticket.age >= 8 ? "warn" : "neutral"}>{ticket.age}m</Pill>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#77716B]">{stationLabel(locale, ticket.station)}</p>
              </div>
            </div>

            <div className="divide-y divide-[#302D29]">
              {ticket.items.map((item, index) => (
                <div key={`${ticket.id}-${index}`} className="p-3">
                  <p className="text-lg font-black text-[#FFF9F2]">{item.qty}× {item.name}</p>
                  {item.modifiers?.length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.modifiers.map((modifier) => (
                        <span key={modifier} className="rounded bg-[#2A2724] px-2 py-1 text-xs font-bold text-[#D0C8C1]">{modifier}</span>
                      ))}
                    </div>
                  ) : null}
                  {item.note ? (
                    <p className="mt-2 rounded-md border border-[#71582A] bg-[#2E2516] p-2 text-xs font-bold text-[#F0C876]">{item.note}</p>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#302D29] p-3">
              <Pill tone={ticket.print === "failed" ? "danger" : ticket.print === "printed" ? "ready" : "warn"}>
                <Printer className="me-1.5 size-3" />
                {ticket.print === "failed"
                  ? L(locale, "Print failed", "فشل الطباعة")
                  : ticket.print === "printed"
                    ? L(locale, "Printed", "تمت الطباعة")
                    : L(locale, "Print pending", "طباعة معلقة")}
              </Pill>
              <button type="button" className="flex min-h-10 items-center gap-2 rounded-md border border-[#46413C] bg-[#23211F] px-3 text-xs font-black text-[#E7E0D8]">
                <RotateCcw className="size-3.5" />
                {L(locale, "Reprint", "إعادة طباعة")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

function PrintView({
  locale,
  station,
  jobs,
  onRetry,
  onPrinted,
  onFailed
}: {
  locale: Locale;
  station: Station;
  jobs: PrintJob[];
  onRetry: (id: string) => void;
  onPrinted: (id: string) => void;
  onFailed: (id: string) => void;
}) {
  const visible = station === "expediter" ? jobs : jobs.filter((job) => job.station === station);

  return (
    <main className="min-h-[calc(100vh-7rem)] bg-[#151412] p-3 lg:p-4">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8E8780]">
            {L(locale, "Operational print state", "حالة الطباعة التشغيلية")}
          </p>
          <h1 className="mt-1 text-xl font-black text-[#FFF8F0]">{stationLabel(locale, station)}</h1>
        </div>
        <Pill tone={visible.some((job) => job.status === "failed") ? "danger" : "ready"}>
          {visible.filter((job) => job.status === "failed").length} {L(locale, "failed", "فاشل")}
        </Pill>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {visible.map((job) => (
          <article key={job.id} className={`rounded-lg border p-4 ${
            job.status === "failed"
              ? "border-[#773C35] bg-[#2B1C1A]"
              : "border-[#393531] bg-[#1B1917]"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-black text-[#FFF8F0]">{job.ticket}</p>
                <p className="mt-1 text-xs text-[#918B84]">{job.printer} · {job.age}</p>
              </div>
              <Pill tone={job.status === "failed" ? "danger" : job.status === "printed" ? "ready" : "warn"}>
                {job.status === "failed"
                  ? L(locale, "Failed", "فشلت")
                  : job.status === "printed"
                    ? L(locale, "Printed", "تمت")
                    : L(locale, "Pending", "معلقة")}
              </Pill>
            </div>

            {job.error ? (
              <div className="mt-4 flex gap-2 rounded-md border border-[#7A4038] bg-[#351F1C] p-3 text-xs font-bold leading-5 text-[#F1A198]">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{job.error}</span>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {job.status === "failed" ? (
                <button type="button" onClick={() => onRetry(job.id)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#C68A4A] px-3 text-xs font-black text-[#17110C]">
                  <RefreshCw className="size-4" />
                  {L(locale, "Retry", "إعادة المحاولة")}
                </button>
              ) : null}
              {job.status === "pending" ? (
                <>
                  <button type="button" onClick={() => onPrinted(job.id)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#35543B] px-3 text-xs font-black text-[#D9F0DD]">
                    <Check className="size-4" />
                    {L(locale, "Mark printed", "تمت الطباعة")}
                  </button>
                  <button type="button" onClick={() => onFailed(job.id)} className="flex min-h-11 items-center justify-center gap-2 rounded-md border border-[#704139] bg-[#2E1F1C] px-3 text-xs font-black text-[#F0A39B]">
                    <XCircle className="size-4" />
                    {L(locale, "Failed", "فشلت")}
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-[#34302D] bg-[#181614] p-3 text-xs leading-5 text-[#858078]">
        {L(
          locale,
          "Printer setup and station configuration belong in Office → Locations → Devices & Stations. Kitchen only shows live print work and exceptions.",
          "إعداد الطابعات والمحطات موجود في Office ← Locations ← Devices & Stations. المطبخ يعرض فقط شغل الطباعة الحي والاستثناءات."
        )}
      </div>
    </main>
  );
}

export function KitchenPrototype() {
  const [locale, setLocale] = useState<Locale>("en");
  const [station, setStation] = useState<Station>("kitchen");
  const [view, setView] = useState<View>("board");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>(initialPrintJobs);

  const advanceTask = (taskId: string) => {
    setTasks((current) =>
      current.map((task) =>
        task.id !== taskId
          ? task
          : {
              ...task,
              status: task.status === "new" ? "in_progress" : task.status === "in_progress" ? "ready" : "ready"
            }
      )
    );
  };

  const retryPrint = (id: string) => {
    setPrintJobs((current) => current.map((job) => job.id === id ? { ...job, status: "pending", error: undefined } : job));
  };

  const markPrinted = (id: string) => {
    setPrintJobs((current) => current.map((job) => job.id === id ? { ...job, status: "printed", error: undefined } : job));
  };

  const markFailed = (id: string) => {
    setPrintJobs((current) => current.map((job) => job.id === id ? { ...job, status: "failed", error: "Marked failed on device" } : job));
  };

  const visibleTasks =
    station === "expediter"
      ? tasks
      : tasks.filter((task) => task.station === station);
  const stationCounts = {
    active: visibleTasks.filter((task) => task.status !== "ready").length,
    late: visibleTasks.filter((task) => task.age >= 15 && task.status !== "ready").length,
    ready: visibleTasks.filter((task) => task.status === "ready").length
  };

  return (
    <div dir={locale === "ar" ? "rtl" : "ltr"} className="min-h-screen bg-[#12110F] text-[#FFF8F0]">
      <TopFrame
        locale={locale}
        station={station}
        view={view}
        onLocale={() => setLocale((value) => value === "en" ? "ar" : "en")}
        onStation={setStation}
        onView={setView}
      />

      <div className="border-b border-[#2B2825] bg-[#171513] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="text-[#817B75]">{stationLabel(locale, station)}</span>
          <span className="text-[#4E4944]">/</span>
          <span className="text-[#C8C0B8]">{stationCounts.active} {L(locale, "active", "نشط")}</span>
          <span className="text-[#4E4944]">·</span>
          <span className={stationCounts.late ? "text-[#F08074]" : "text-[#77716B]"}>{stationCounts.late} {L(locale, "late", "متأخر")}</span>
          <span className="text-[#4E4944]">·</span>
          <span className="text-[#80BB87]">{stationCounts.ready} {L(locale, "ready", "جاهز")}</span>
        </div>
      </div>

      {view === "board" ? <BoardView locale={locale} station={station} tasks={tasks} onAdvance={advanceTask} /> : null}
      {view === "tickets" ? <TicketsView locale={locale} station={station} /> : null}
      {view === "print" ? (
        <PrintView
          locale={locale}
          station={station}
          jobs={printJobs}
          onRetry={retryPrint}
          onPrinted={markPrinted}
          onFailed={markFailed}
        />
      ) : null}
    </div>
  );
}
