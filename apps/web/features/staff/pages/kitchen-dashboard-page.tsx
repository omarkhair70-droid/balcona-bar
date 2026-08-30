"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChefHat,
  Clock3,
  Coffee,
  Dessert,
  Flame,
  ListChecks,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  RotateCcw,
  UtensilsCrossed,
  XCircle
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getPrintJobCreatedAt,
  getPrintJobError,
  getPrintJobId,
  getPrintJobKind,
  getPrintJobPrintableText,
  getPrintJobPrinterStation,
  getPrintJobStatus,
  getPrinterStationName,
  getTicketCreatedAt,
  getTicketCustomerNote,
  getTicketDisplayCode,
  getTicketId,
  getTicketItemModifiers,
  getTicketItemName,
  getTicketItemNotes,
  getTicketItemQuantity,
  getTicketItems,
  getTicketLocationLabel,
  getTicketOrderNumber,
  getTicketPrintJobs,
  getTicketStation,
  getTicketStatus
} from "@/features/staff/kds-data";
import { KitchenStaffShell } from "@/features/staff/kitchen-staff-shell";
import {
  getTaskCreatedAt,
  getTaskFloor,
  getTaskId,
  getTaskItemName,
  getTaskModifierOptions,
  getTaskNotes,
  getTaskOrderId,
  getTaskOrderNumber,
  getTaskOrderStatus,
  getTaskQuantity,
  getTaskStation,
  getTaskStatus,
  getTaskTable
} from "@/features/staff/preparation-data";
import {
  getRecordString,
  getTableLabel
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import {
  getBranchKitchenTickets,
  getBranchPrintJobs,
  getBranchPreparationTasks,
  markPrintJobFailed,
  markPreparationTaskReady,
  reprintKitchenTicket,
  retryPrintJob,
  staffLogout,
  startPreparationTask
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import type { DebugReportInput } from "@/lib/observability/debug-report";
import { hasStaffPermission } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { cn } from "@/lib/utils/cn";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";

type KdsStation = "kitchen" | "barista" | "dessert" | "expediter";
type KdsView = "board" | "tickets" | "print";
type TaskStatus = "pending" | "preparing" | "ready";

type Notice = {
  tone: "success" | "error";
  message: string;
  debug?: DebugReportInput;
};

type TaskAction = {
  taskId: string;
};

type ReprintTicketAction = {
  ticketId: string;
};

type PrintJobAction = {
  printJobId: string;
};

type PrintJobFailedAction = PrintJobAction & {
  errorMessage?: string | null;
};

type PillTone = "neutral" | "warn" | "late" | "ready" | "danger";

const STATION_STORAGE_KEY = "balcona.kitchen.station";
const validStations = new Set<KdsStation>([
  "kitchen",
  "barista",
  "dessert",
  "expediter"
]);
const emptyRecords: Record<string, unknown>[] = [];

function ageMinutes(createdAt: string, now: number) {
  const created = Date.parse(createdAt);

  if (!Number.isFinite(created)) {
    return 0;
  }

  return Math.max(0, Math.floor((now - created) / 60_000));
}

function stationLabelKey(station: KdsStation) {
  if (station === "barista") return "kitchen.stationBarista";
  if (station === "dessert") return "kitchen.stationDessert";
  if (station === "expediter") return "kitchen.stationExpediter";
  return "kitchen.stationKitchen";
}

function stationIcon(station: KdsStation) {
  if (station === "barista") return Coffee;
  if (station === "dessert") return Dessert;
  if (station === "expediter") return UtensilsCrossed;
  return ChefHat;
}

function stationApiValue(station: KdsStation) {
  return station === "expediter" ? "all" : station;
}

function taskTone(age: number, status: TaskStatus): PillTone {
  if (status === "ready") return "ready";
  if (age >= 15) return "late";
  if (age >= 10) return "warn";
  return "neutral";
}

function Pill({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: PillTone;
}) {
  const classes: Record<PillTone, string> = {
    neutral: "border-[#44413D] bg-[#23211F] text-[#C8C2BC]",
    warn: "border-[#8A682A] bg-[#352B16] text-[#F7CD73]",
    late: "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]",
    ready: "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]",
    danger: "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black",
        classes[tone]
      )}
    >
      {children}
    </span>
  );
}

function StationTabs({
  station,
  onChange
}: {
  station: KdsStation;
  onChange: (station: KdsStation) => void;
}) {
  const t = useTranslations("staff");
  const stations: KdsStation[] = [
    "kitchen",
    "barista",
    "dessert",
    "expediter"
  ];

  return (
    <div className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto">
      {stations.map((entry) => {
        const Icon = stationIcon(entry);
        const active = station === entry;

        return (
          <button
            key={entry}
            type="button"
            onClick={() => onChange(entry)}
            aria-pressed={active}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-black transition",
              active
                ? "bg-[#2D2925] text-[#FFF7ED]"
                : "text-[#958F88] hover:bg-[#211F1C] hover:text-[#E6DED6]"
            )}
          >
            <Icon
              className={cn(
                "size-4",
                active ? "text-[#D9A263]" : "text-[#77716B]"
              )}
              aria-hidden="true"
            />
            <span>{t(stationLabelKey(entry))}</span>
          </button>
        );
      })}
    </div>
  );
}

function ViewTabs({
  view,
  onChange
}: {
  view: KdsView;
  onChange: (view: KdsView) => void;
}) {
  const t = useTranslations("staff");
  const entries: Array<{
    value: KdsView;
    labelKey: string;
    icon: typeof ListChecks;
  }> = [
    { value: "board", labelKey: "kitchen.modeTasks", icon: ListChecks },
    { value: "tickets", labelKey: "kitchen.modeTickets", icon: ChefHat },
    { value: "print", labelKey: "kitchen.modePrint", icon: Printer }
  ];

  return (
    <div className="flex min-w-0 gap-1 overflow-x-auto">
      {entries.map((entry) => {
        const Icon = entry.icon;
        const active = view === entry.value;

        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => onChange(entry.value)}
            aria-pressed={active}
            className={cn(
              "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-xs font-black transition",
              active
                ? "bg-[#C68A4A] text-[#17110C]"
                : "text-[#AAA39C] hover:bg-[#24211E] hover:text-[#F1EAE3]"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(entry.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

function KitchenDashboardActions() {
  const t = useTranslations("staff");
  const router = useRouter();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const logoutMutation = useMutation({
    mutationFn: () =>
      accessToken ? staffLogout(accessToken) : Promise.resolve({}),
    onSettled: () => {
      clearSession();
      router.push("/staff/login");
    }
  });

  if (!accessToken) {
    return (
      <Link href="/staff/login" className={buttonVariants()}>
        <LogIn className="size-4" aria-hidden="true" />
        {t("actions.staffLogin")}
      </Link>
    );
  }

  return (
    <>
      <StaffBranchSelector
        access={effectiveAccess}
        selectedBranchId={selectedBranchId}
        onChange={setSelectedBranchId}
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
        aria-label={t("actions.logout")}
      >
        <LogOut className="size-4" aria-hidden="true" />
        <span className="hidden xl:inline">{t("actions.logout")}</span>
      </Button>
    </>
  );
}

function NoticeBanner({ notice }: { notice?: Notice }) {
  if (!notice) {
    return null;
  }

  const success = notice.tone === "success";

  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "border p-3 text-sm font-bold",
        success
          ? "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]"
          : "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{notice.message}</span>
        {!success && notice.debug ? (
          <CopyDebugReportButton {...notice.debug} />
        ) : null}
      </div>
    </div>
  );
}

function taskTableLabel(task: Record<string, unknown>) {
  const table = getTaskTable(task);

  return (
    getRecordString(table, "code") ||
    getRecordString(table, "displayName") ||
    getTableLabel(table, getTaskFloor(task))
  );
}

function TaskCard({
  task,
  now,
  expediter,
  canStartPermission,
  canReadyPermission,
  actionPending,
  onStart,
  onReady
}: {
  task: Record<string, unknown>;
  now: number;
  expediter: boolean;
  canStartPermission: boolean;
  canReadyPermission: boolean;
  actionPending: boolean;
  onStart: (taskId: string) => void;
  onReady: (taskId: string) => void;
}) {
  const t = useTranslations("staff");
  const taskId = getTaskId(task);
  const status = getTaskStatus(task) as TaskStatus;
  const age = ageMinutes(getTaskCreatedAt(task), now);
  const tone = taskTone(age, status);
  const station = getTaskStation(task) as KdsStation;
  const modifiers = getTaskModifierOptions(task);
  const notes = getTaskNotes(task);
  const orderNumber = getTaskOrderNumber(task);
  const orderStatus = getTaskOrderStatus(task);
  const parentAllowsPreparation =
    orderStatus === "cashier_accepted" || orderStatus === "preparing";
  const canStart =
    status === "pending" &&
    parentAllowsPreparation &&
    canStartPermission &&
    Boolean(taskId);
  const canReady =
    status === "preparing" &&
    parentAllowsPreparation &&
    canReadyPermission &&
    Boolean(taskId);
  const cardClass =
    tone === "late"
      ? "border-[#7D3932] bg-[#2B1D1B]"
      : tone === "warn"
        ? "border-[#6F572A] bg-[#282317]"
        : status === "ready"
          ? "border-[#36583D] bg-[#19261D]"
          : "border-[#3A3632] bg-[#1C1A18]";

  return (
    <article
      className={cn("rounded-lg border p-3", cardClass)}
      data-kds-task-status={status}
      data-kds-task-age={age}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-black tracking-[-0.04em] text-[#FFF8F0]">
              {taskTableLabel(task)}
            </span>
            {orderNumber ? (
              <span className="text-xs font-bold text-[#8F8982]">
                {"#" + orderNumber}
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{t("kitchen.ageMinutes", { count: age })}</Pill>
            {expediter ? (
              <Pill>{t(stationLabelKey(station))}</Pill>
            ) : null}
          </div>
        </div>
        {tone === "late" ? (
          <Flame className="size-5 shrink-0 text-[#E66D5F]" aria-hidden="true" />
        ) : null}
        {status === "ready" ? (
          <Check className="size-5 shrink-0 text-[#79B983]" aria-hidden="true" />
        ) : null}
      </div>

      <div className="mt-4">
        <p className="text-[22px] font-black leading-7 tracking-[-0.03em] text-[#FFF9F2]">
          {getTaskQuantity(task)}× {getTaskItemName(task)}
        </p>

        {modifiers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {modifiers.map((modifier, index) => (
              <span
                key={getRecordString(modifier, "id") || String(index)}
                className="rounded bg-[#302C28] px-2 py-1 text-xs font-bold text-[#D7CEC6]"
              >
                {getRecordString(
                  modifier,
                  "modifierOptionNameSnapshot",
                  t("tasks.modifierFallback")
                )}
              </span>
            ))}
          </div>
        ) : null}

        {notes ? (
          <div className="mt-3 flex gap-2 rounded-md border border-[#7A5F2E] bg-[#312716] p-2.5 text-xs font-black leading-5 text-[#F3CC79]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{notes}</span>
          </div>
        ) : null}
      </div>

      {status === "pending" ? (
        <button
          type="button"
          disabled={!canStart || actionPending}
          onClick={() => taskId && onStart(taskId)}
          className="mt-4 min-h-12 w-full rounded-md border border-[#57514B] bg-[#25221F] text-sm font-black text-[#F1EAE3] transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {actionPending ? t("actions.starting") : t("actions.start")}
        </button>
      ) : null}

      {status === "preparing" ? (
        <button
          type="button"
          disabled={!canReady || actionPending}
          onClick={() => taskId && onReady(taskId)}
          className="mt-4 min-h-12 w-full rounded-md bg-[#C68A4A] text-sm font-black text-[#17110C] transition enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {actionPending ? t("actions.markingReady") : t("actions.markReady")}
        </button>
      ) : null}

      {status === "ready" ? (
        <div className="mt-4 flex min-h-12 items-center justify-center rounded-md bg-[#29412F] text-sm font-black text-[#9DCEA5]">
          <Check className="me-2 size-4" aria-hidden="true" />
          {t("kitchen.statusReady")}
        </div>
      ) : null}

      {((status === "pending" && !canStartPermission) ||
        (status === "preparing" && !canReadyPermission)) ? (
        <p className="mt-2 text-center text-[10px] font-bold text-[#817B75]">
          {t("kitchen.readOnlyStation")}
        </p>
      ) : null}
    </article>
  );
}

function ProductionBoard({
  tasks,
  now,
  station,
  isLoading,
  error,
  canStartPermission,
  canReadyPermission,
  actionPending,
  onStart,
  onReady,
  onRefresh
}: {
  tasks: Record<string, unknown>[];
  now: number;
  station: KdsStation;
  isLoading: boolean;
  error?: Error;
  canStartPermission: boolean;
  canReadyPermission: boolean;
  actionPending: boolean;
  onStart: (taskId: string) => void;
  onReady: (taskId: string) => void;
  onRefresh: () => void;
}) {
  const t = useTranslations("staff");
  const groups: Array<{ status: TaskStatus; labelKey: string }> = [
    { status: "pending", labelKey: "kitchen.statusPending" },
    { status: "preparing", labelKey: "kitchen.statusPreparing" },
    { status: "ready", labelKey: "kitchen.statusReady" }
  ];
  const visibleTasks = tasks.filter((task) =>
    groups.some((group) => group.status === getTaskStatus(task))
  );
  const lateCount = visibleTasks.filter((task) => {
    const status = getTaskStatus(task);
    return (
      status !== "ready" &&
      ageMinutes(getTaskCreatedAt(task), now) >= 15
    );
  }).length;
  const readyCount = visibleTasks.filter(
    (task) => getTaskStatus(task) === "ready"
  ).length;
  const activeCount = visibleTasks.filter(
    (task) => getTaskStatus(task) !== "ready"
  ).length;
  const rush = activeCount >= 6 || lateCount >= 2;

  return (
    <main
      className="min-h-[calc(100vh-10rem)] bg-[#151412] p-3 lg:p-4"
      data-kds-board-state={visibleTasks.length === 0 ? "empty" : rush ? "rush" : "active"}
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8E8780]">
            {t("kitchen.productionBoard")}
          </p>
          <h2 className="mt-1 text-xl font-black text-[#FFF8F0]">
            {t(stationLabelKey(station))}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {rush ? <Pill tone="late">{t("kitchen.rushLabel")}</Pill> : null}
          <Pill tone="late">
            {lateCount} {t("kitchen.lateLabel")}
          </Pill>
          <Pill tone="ready">
            {readyCount} {t("kitchen.readyLabel")}
          </Pill>
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 items-center justify-center rounded-md border border-[#3E3A36] bg-[#1B1917] text-[#AAA39C] hover:text-[#F1EAE3]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? <LoadingState label={t("tasks.loading")} /> : null}
      {error ? (
        <EmptyState
          title={t("tasks.loadError")}
          description={error.message}
          debug={{
            action: "preparation_task_list",
            flow: "staff_kds",
            error
          }}
        />
      ) : null}

      {!isLoading && !error ? (
        <div className="grid gap-3 xl:grid-cols-3">
          {groups.map((group) => {
            const items = visibleTasks
              .filter((task) => getTaskStatus(task) === group.status)
              .sort(
                (a, b) =>
                  ageMinutes(getTaskCreatedAt(b), now) -
                  ageMinutes(getTaskCreatedAt(a), now)
              );

            return (
              <section
                key={group.status}
                className="min-w-0 rounded-lg border border-[#302D29] bg-[#11100F]"
              >
                <div className="flex min-h-11 items-center justify-between border-b border-[#2D2A27] px-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        group.status === "ready"
                          ? "bg-[#69AE73]"
                          : group.status === "preparing"
                            ? "bg-[#D6A24F]"
                            : "bg-[#8C8781]"
                      )}
                    />
                    <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#DAD3CC]">
                      {t(group.labelKey)}
                    </h3>
                  </div>
                  <span className="text-xs font-black text-[#8E8882]">
                    {items.length}
                  </span>
                </div>
                <div className="grid gap-2 p-2">
                  {items.length > 0 ? (
                    items.map((task, index) => (
                      <TaskCard
                        key={getTaskId(task) || String(index)}
                        task={task}
                        now={now}
                        expediter={station === "expediter"}
                        canStartPermission={canStartPermission}
                        canReadyPermission={canReadyPermission}
                        actionPending={actionPending}
                        onStart={onStart}
                        onReady={onReady}
                      />
                    ))
                  ) : (
                    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-[#34302D] p-4 text-center text-xs font-bold text-[#6F6963]">
                      {t("kitchen.nothingHere")}
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}

function ticketStatusLabelKey(status: string) {
  if (status === "queued") return "kitchen.ticketStatusQueued";
  if (status === "in_progress") return "kitchen.ticketStatusInProgress";
  if (status === "ready") return "kitchen.ticketStatusReady";
  if (status === "served") return "kitchen.ticketStatusServed";
  if (status === "cancelled") return "kitchen.ticketStatusCancelled";
  return "";
}

function TicketCard({
  ticket,
  now,
  reprintPending,
  onReprint
}: {
  ticket: Record<string, unknown>;
  now: number;
  reprintPending: boolean;
  onReprint: (ticketId: string) => void;
}) {
  const t = useTranslations("staff");
  const ticketId = getTicketId(ticket);
  const status = getTicketStatus(ticket);
  const station = getTicketStation(ticket) as KdsStation;
  const items = getTicketItems(ticket);
  const printJobs = getTicketPrintJobs(ticket);
  const age = ageMinutes(getTicketCreatedAt(ticket), now);
  const printFailed = printJobs.some(
    (job) => getPrintJobStatus(job) === "failed"
  );
  const printPending = printJobs.some((job) => {
    const state = getPrintJobStatus(job);
    return state === "pending" || state === "printing" || state === "reprint_requested";
  });
  const noPrintRoute = printJobs.length === 0;
  const labelKey = ticketStatusLabelKey(status);

  return (
    <article
      className="overflow-hidden rounded-lg border border-[#3A3632] bg-[#1B1917]"
      data-kds-ticket-status={status}
      data-kds-ticket-age={age}
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#302D29] p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#E7E0D8] px-2 py-1 text-xs font-black text-[#171513]">
              {getTicketDisplayCode(ticket)}
            </span>
            <span className="text-xs font-bold text-[#8F8982]">
              {getTicketOrderNumber(ticket)}
            </span>
          </div>
          <p className="mt-3 text-xl font-black text-[#FFF8F0]">
            {getTicketLocationLabel(ticket)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Pill tone={age >= 12 ? "late" : age >= 8 ? "warn" : "neutral"}>
            {t("kitchen.ageMinutes", { count: age })}
          </Pill>
          <span className="text-[10px] font-black uppercase tracking-wide text-[#817B75]">
            {t(stationLabelKey(station))}
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#302D29]">
        {items.map((item, index) => {
          const modifiers = getTicketItemModifiers(item);
          const notes = getTicketItemNotes(item);
          const itemStatus = getRecordString(item, "status", "queued");
          const itemLabelKey = ticketStatusLabelKey(itemStatus);

          return (
            <div key={getRecordString(item, "id") || String(index)} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-black text-[#FFF9F2]">
                  {getTicketItemQuantity(item)}× {getTicketItemName(item)}
                </p>
                <span className="shrink-0 text-[10px] font-black uppercase text-[#817B75]">
                  {itemLabelKey ? t(itemLabelKey) : itemStatus}
                </span>
              </div>
              {modifiers.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {modifiers.map((modifier, modifierIndex) => (
                    <span
                      key={
                        getRecordString(modifier, "optionId") ||
                        String(modifierIndex)
                      }
                      className="rounded bg-[#2A2724] px-2 py-1 text-xs font-bold text-[#D0C8C1]"
                    >
                      {getRecordString(
                        modifier,
                        "optionName",
                        t("tasks.modifierFallback")
                      )}
                    </span>
                  ))}
                </div>
              ) : null}
              {notes ? (
                <p className="mt-2 rounded-md border border-[#71582A] bg-[#2E2516] p-2 text-xs font-black text-[#F0C876]">
                  {notes}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {getTicketCustomerNote(ticket) ? (
        <p className="mx-3 mt-3 rounded-md border border-[#71582A] bg-[#2E2516] p-3 text-sm font-black text-[#F0C876]">
          {getTicketCustomerNote(ticket)}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-[#302D29] p-3">
        <Pill
          tone={
            printFailed || noPrintRoute
              ? "danger"
              : printPending
                ? "warn"
                : "ready"
          }
        >
          <Printer className="me-1.5 size-3" aria-hidden="true" />
          {noPrintRoute
            ? t("kitchen.printRoutingMissing")
            : printFailed
              ? t("kitchen.printFailed")
              : printPending
                ? t("kitchen.printPending")
                : t("kitchen.printTracked")}
        </Pill>
        <div className="flex items-center gap-2">
          {labelKey ? (
            <Pill tone={status === "ready" || status === "served" ? "ready" : "neutral"}>
              {t(labelKey)}
            </Pill>
          ) : null}
          <button
            type="button"
            disabled={!ticketId || reprintPending}
            onClick={() => ticketId && onReprint(ticketId)}
            className="flex min-h-10 items-center gap-2 rounded-md border border-[#46413C] bg-[#23211F] px-3 text-xs font-black text-[#E7E0D8] disabled:opacity-45"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            {t("actions.reprint")}
          </button>
        </div>
      </div>
    </article>
  );
}

function printStatusLabelKey(status: string) {
  if (status === "pending") return "kitchen.printStatusPending";
  if (status === "printing") return "kitchen.printStatusPrinting";
  if (status === "printed") return "kitchen.printStatusPrinted";
  if (status === "failed") return "kitchen.printStatusFailed";
  if (status === "cancelled") return "kitchen.printStatusCancelled";
  return "";
}

function printKindLabelKey(kind: string) {
  if (kind === "kitchen_ticket") return "kitchen.printKindKitchenTicket";
  if (kind === "barista_ticket") return "kitchen.printKindBaristaTicket";
  if (kind === "dessert_ticket") return "kitchen.printKindDessertTicket";
  if (kind === "receipt") return "kitchen.printKindReceipt";
  if (kind === "void_ticket") return "kitchen.printKindVoidTicket";
  return "";
}

function PrintJobCard({
  printJob,
  now,
  actionPending,
  onMarkFailed,
  onRetry
}: {
  printJob: Record<string, unknown>;
  now: number;
  actionPending: boolean;
  onMarkFailed: (printJobId: string) => void;
  onRetry: (printJobId: string) => void;
}) {
  const t = useTranslations("staff");
  const printJobId = getPrintJobId(printJob);
  const status = getPrintJobStatus(printJob);
  const kind = getPrintJobKind(printJob);
  const statusKey = printStatusLabelKey(status);
  const kindKey = printKindLabelKey(kind);
  const printerStation = getPrintJobPrinterStation(printJob);
  const age = ageMinutes(getPrintJobCreatedAt(printJob), now);
  const canReportFailed = status === "pending" || status === "printing";
  const canRetry =
    status === "failed" ||
    status === "cancelled" ||
    status === "reprint_requested";
  const routingMissing = !printerStation;
  const printableText = getPrintJobPrintableText(printJob);

  return (
    <article
      className={cn(
        "rounded-lg border p-4",
        status === "failed" || routingMissing
          ? "border-[#773C35] bg-[#2B1C1A]"
          : "border-[#393531] bg-[#1B1917]"
      )}
      data-kds-print-status={status}
      data-kds-print-route={routingMissing ? "missing" : "assigned"}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-black text-[#FFF8F0]">
            {kindKey ? t(kindKey) : kind}
          </p>
          <p className="mt-1 text-xs font-bold text-[#918B84]">
            {routingMissing
              ? t("kitchen.printerStationMissing")
              : getPrinterStationName(printerStation)}
            {" · "}
            {t("kitchen.ageMinutes", { count: age })}
          </p>
        </div>
        <Pill
          tone={
            status === "failed" || routingMissing
              ? "danger"
              : status === "printed"
                ? "ready"
                : "warn"
          }
        >
          {statusKey ? t(statusKey) : status}
        </Pill>
      </div>

      {getPrintJobError(printJob) ? (
        <div className="mt-4 flex gap-2 rounded-md border border-[#7A4038] bg-[#351F1C] p-3 text-xs font-black leading-5 text-[#F1A198]">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{getPrintJobError(printJob)}</span>
        </div>
      ) : null}

      {printableText ? (
        <details className="mt-3 rounded-md border border-[#34302D] bg-[#151412] p-3 text-xs text-[#8E8882]">
          <summary className="cursor-pointer font-bold text-[#DAD3CC]">
            {t("kitchen.printablePayload")}
          </summary>
          <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] leading-relaxed text-[#BFB7AF]">
            {printableText}
          </pre>
        </details>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {canRetry ? (
          <button
            type="button"
            disabled={!printJobId || actionPending}
            onClick={() => printJobId && onRetry(printJobId)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-[#C68A4A] px-3 text-xs font-black text-[#17110C] disabled:opacity-45"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.retry")}
          </button>
        ) : null}
        {canReportFailed ? (
          <button
            type="button"
            disabled={!printJobId || actionPending}
            onClick={() => printJobId && onMarkFailed(printJobId)}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-[#704139] bg-[#2E1F1C] px-3 text-xs font-black text-[#F0A39B] disabled:opacity-45"
          >
            <XCircle className="size-4" aria-hidden="true" />
            {t("actions.failed")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function TicketsView({
  tickets,
  now,
  station,
  isLoading,
  error,
  reprintPending,
  onReprint
}: {
  tickets: Record<string, unknown>[];
  now: number;
  station: KdsStation;
  isLoading: boolean;
  error?: Error;
  reprintPending: boolean;
  onReprint: (ticketId: string) => void;
}) {
  const t = useTranslations("staff");

  return (
    <main className="min-h-[calc(100vh-10rem)] bg-[#151412] p-3 lg:p-4">
      <div className="mb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8E8780]">
          {t("kitchen.ticketsEyebrow")}
        </p>
        <h2 className="mt-1 text-xl font-black text-[#FFF8F0]">
          {t(stationLabelKey(station))}
        </h2>
      </div>

      {isLoading ? <LoadingState label={t("kitchen.modeTickets")} /> : null}
      {error ? (
        <EmptyState
          title={t("kitchen.ticketsError")}
          description={error.message}
          debug={{ action: "kitchen_ticket_list", flow: "staff_kds", error }}
        />
      ) : null}
      {!isLoading && !error && tickets.length === 0 ? (
        <EmptyState
          title={t("kitchen.ticketsEmptyTitle")}
          description={t("kitchen.acceptedEmpty")}
        />
      ) : null}

      {!isLoading && !error && tickets.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...tickets]
            .sort(
              (a, b) =>
                ageMinutes(getTicketCreatedAt(b), now) -
                ageMinutes(getTicketCreatedAt(a), now)
            )
            .map((ticket, index) => (
              <TicketCard
                key={getTicketId(ticket) || String(index)}
                ticket={ticket}
                now={now}
                reprintPending={reprintPending}
                onReprint={onReprint}
              />
            ))}
        </div>
      ) : null}
    </main>
  );
}

function PrintView({
  printJobs,
  now,
  station,
  isLoading,
  error,
  actionPending,
  onMarkFailed,
  onRetry
}: {
  printJobs: Record<string, unknown>[];
  now: number;
  station: KdsStation;
  isLoading: boolean;
  error?: Error;
  actionPending: boolean;
  onMarkFailed: (printJobId: string) => void;
  onRetry: (printJobId: string) => void;
}) {
  const t = useTranslations("staff");
  const failedCount = printJobs.filter(
    (job) =>
      getPrintJobStatus(job) === "failed" ||
      !getPrintJobPrinterStation(job)
  ).length;
  const statusRank = (job: Record<string, unknown>) => {
    if (!getPrintJobPrinterStation(job)) return 0;
    const status = getPrintJobStatus(job);
    if (status === "failed") return 0;
    if (status === "pending" || status === "printing") return 1;
    return 2;
  };

  return (
    <main className="min-h-[calc(100vh-10rem)] bg-[#151412] p-3 lg:p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8E8780]">
            {t("kitchen.printOperationalEyebrow")}
          </p>
          <h2 className="mt-1 text-xl font-black text-[#FFF8F0]">
            {t(stationLabelKey(station))}
          </h2>
        </div>
        <Pill tone={failedCount > 0 ? "danger" : "ready"}>
          {failedCount} {t("kitchen.failedPrintLabel")}
        </Pill>
      </div>

      {isLoading ? <LoadingState label={t("kitchen.modePrint")} /> : null}
      {error ? (
        <EmptyState
          title={t("kitchen.printQueueError")}
          description={error.message}
          debug={{ action: "print_job_list", flow: "staff_kds", error }}
        />
      ) : null}
      {!isLoading && !error && printJobs.length === 0 ? (
        <EmptyState
          title={t("kitchen.printQueueEmptyTitle")}
          description={t("kitchen.printQueueEmpty")}
        />
      ) : null}

      {!isLoading && !error && printJobs.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {[...printJobs]
            .sort((a, b) => {
              const rank = statusRank(a) - statusRank(b);
              return rank !== 0
                ? rank
                : ageMinutes(getPrintJobCreatedAt(b), now) -
                    ageMinutes(getPrintJobCreatedAt(a), now);
            })
            .map((job, index) => (
              <PrintJobCard
                key={getPrintJobId(job) || String(index)}
                printJob={job}
                now={now}
                actionPending={actionPending}
                onMarkFailed={onMarkFailed}
                onRetry={onRetry}
              />
            ))}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 rounded-lg border border-[#34302D] bg-[#181614] p-3 text-xs font-semibold leading-5 text-[#858078]">
        <p>{t("kitchen.printConfigBoundary")}</p>
        <p>{t("kitchen.printSuccessExternal")}</p>
      </div>
    </main>
  );
}

function KitchenDashboardContent() {
  const t = useTranslations("staff");
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const [station, setStation] = useState<KdsStation>("kitchen");
  const [view, setView] = useState<KdsView>("board");
  const [notice, setNotice] = useState<Notice>();
  const [now, setNow] = useState(() => Date.now());
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const apiStation = stationApiValue(station);

  useEffect(() => {
    const stored = window.localStorage.getItem(STATION_STORAGE_KEY);

    if (stored && validStations.has(stored as KdsStation)) {
      setStation(stored as KdsStation);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const changeStation = (nextStation: KdsStation) => {
    setStation(nextStation);
    window.localStorage.setItem(STATION_STORAGE_KEY, nextStation);
  };

  const tasksQuery = useQuery({
    queryKey: staffQueryKeys.preparationTasks(
      selectedBranchId,
      apiStation,
      "all"
    ),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station: apiStation, status: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });

  const ticketsQuery = useQuery({
    queryKey: staffQueryKeys.kitchenTickets(
      selectedBranchId,
      apiStation,
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchKitchenTickets(
        selectedBranchId ?? "",
        { station: apiStation, status: "all", type: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });

  const printJobsQuery = useQuery({
    queryKey: staffQueryKeys.printJobs(
      selectedBranchId,
      apiStation,
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchPrintJobs(
        selectedBranchId ?? "",
        { station: apiStation, status: "all", kind: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });

  const tasks = useMemo(
    () => tasksQuery.data?.tasks ?? emptyRecords,
    [tasksQuery.data?.tasks]
  );
  const tickets = useMemo(
    () => ticketsQuery.data?.tickets ?? emptyRecords,
    [ticketsQuery.data?.tickets]
  );
  const printJobs = useMemo(
    () => printJobsQuery.data?.printJobs ?? emptyRecords,
    [printJobsQuery.data?.printJobs]
  );

  const canStartPermission = hasStaffPermission(
    effectiveAccess,
    "preparation.start",
    selectedBranchId
  );
  const canReadyPermission = hasStaffPermission(
    effectiveAccess,
    "preparation.ready",
    selectedBranchId
  );

  const refreshBranch = () => {
    if (!selectedBranchId) return;

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.kitchenTickets(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.printJobs(selectedBranchId)
    });
  };

  const invalidateTaskState = (taskId: string, orderId?: string) => {
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTask(taskId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.kitchenTickets(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.printJobs(selectedBranchId)
    });

    if (orderId) {
      void queryClient.invalidateQueries({
        queryKey: staffQueryKeys.orderPreparationTasks(orderId)
      });
    }
  };

  const startMutation = useMutation({
    mutationFn: ({ taskId }: TaskAction) =>
      startPreparationTask(taskId, { staffUserId: staffUser?.id }, accessToken),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: t("kitchen.taskStarted") });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error, variables) => {
      setNotice({
        tone: "error",
        message: t("kitchen.taskStartedError", { message: error.message }),
        debug: {
          action: "preparation_task_start",
          flow: "staff_kds",
          taskId: variables.taskId,
          error
        }
      });
    }
  });

  const readyMutation = useMutation({
    mutationFn: ({ taskId }: TaskAction) =>
      markPreparationTaskReady(
        taskId,
        { staffUserId: staffUser?.id },
        accessToken
      ),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: t("kitchen.taskMarkedReady") });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error, variables) => {
      setNotice({
        tone: "error",
        message: t("kitchen.taskReadyError", { message: error.message }),
        debug: {
          action: "preparation_task_ready",
          flow: "staff_kds",
          taskId: variables.taskId,
          error
        }
      });
    }
  });

  const reprintMutation = useMutation({
    mutationFn: ({ ticketId }: ReprintTicketAction) =>
      reprintKitchenTicket(
        ticketId,
        { reason: "KDS manual reprint" },
        accessToken
      ),
    onSuccess: () => {
      setNotice({ tone: "success", message: t("kitchen.ticketReprintQueued") });
      refreshBranch();
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("kitchen.ticketReprintError", { message: error.message })
      });
    }
  });

  const printJobFailedMutation = useMutation({
    mutationFn: ({ printJobId, errorMessage }: PrintJobFailedAction) =>
      markPrintJobFailed(printJobId, { errorMessage }, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: t("kitchen.printJobFailed") });
      refreshBranch();
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("kitchen.printJobFailedError", { message: error.message })
      });
    }
  });

  const printJobRetryMutation = useMutation({
    mutationFn: ({ printJobId }: PrintJobAction) =>
      retryPrintJob(printJobId, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: t("kitchen.printJobRetry") });
      refreshBranch();
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("kitchen.printJobRetryError", { message: error.message })
      });
    }
  });

  if (!selectedBranchId || !selectedBranch) {
    return (
      <div className="p-4">
        <EmptyState
          title={t("kitchen.emptyBranchTitle")}
          description={t("kitchen.emptyBranchDescription")}
        />
      </div>
    );
  }

  const activeTasks = tasks.filter((task) => {
    const status = getTaskStatus(task);
    return status === "pending" || status === "preparing";
  });
  const lateCount = activeTasks.filter(
    (task) => ageMinutes(getTaskCreatedAt(task), now) >= 15
  ).length;
  const readyCount = tasks.filter(
    (task) => getTaskStatus(task) === "ready"
  ).length;
  const oldestActive = activeTasks.reduce(
    (oldest, task) =>
      Math.max(oldest, ageMinutes(getTaskCreatedAt(task), now)),
    0
  );
  const failedPrintCount = printJobs.filter(
    (job) =>
      getPrintJobStatus(job) === "failed" ||
      !getPrintJobPrinterStation(job)
  ).length;

  return (
    <div
      className="min-h-[calc(100vh-3.5rem)]"
      data-kds-station={station}
      data-kds-view={view}
      data-kds-realtime={realtime.state}
    >
      <section className="sticky top-14 z-30 border-b border-[#34312E] bg-[#12110F]/96 backdrop-blur">
        <div className="flex min-h-14 flex-wrap items-center gap-3 px-3 py-2">
          <div className="min-w-0 shrink-0">
            <p className="max-w-36 truncate text-xs font-black text-[#FFF8F0] sm:max-w-48">
              {selectedBranch.name}
            </p>
            <p className="text-[10px] font-bold text-[#77716B]">
              {t(stationLabelKey(station))}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <StationTabs station={station} onChange={changeStation} />
          </div>

          <div className="shrink-0">
            <StaffRealtimeStatus
              state={realtime.state}
              lastEventType={realtime.lastEventType}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#282522] px-3 py-2">
          <ViewTabs view={view} onChange={setView} />

          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
            <span className="text-[#C8C0B8]">
              {activeTasks.length} {t("kitchen.activeLabel")}
            </span>
            <span className={lateCount > 0 ? "text-[#F08074]" : "text-[#77716B]"}>
              {lateCount} {t("kitchen.lateLabel")}
            </span>
            <span className="text-[#80BB87]">
              {readyCount} {t("kitchen.readyLabel")}
            </span>
            {failedPrintCount > 0 ? (
              <span className="text-[#F08074]">
                {failedPrintCount} {t("kitchen.failedPrintLabel")}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-[#8D8780]">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {t("kitchen.oldestActive")}{" "}
              <strong className={oldestActive >= 15 ? "text-[#F08074]" : "text-[#F0B55F]"}>
                {t("kitchen.ageMinutes", { count: oldestActive })}
              </strong>
            </span>
          </div>
        </div>
      </section>

      {realtime.state === "error" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-[#7A5F2E] bg-[#312716] px-3 py-2 text-xs font-black text-[#F3CC79]"
          data-kds-reconnect="active"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {t("kitchen.realtimeInterrupted")}
          </span>
          <button
            type="button"
            onClick={refreshBranch}
            className="flex min-h-9 items-center gap-2 rounded-md border border-[#7A5F2E] px-3"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t("actions.refresh")}
          </button>
        </div>
      ) : null}

      {notice ? (
        <div className="p-3 pb-0">
          <NoticeBanner notice={notice} />
        </div>
      ) : null}

      {view === "board" ? (
        <ProductionBoard
          tasks={tasks}
          now={now}
          station={station}
          isLoading={tasksQuery.isPending}
          error={tasksQuery.error ?? undefined}
          canStartPermission={canStartPermission}
          canReadyPermission={canReadyPermission}
          actionPending={startMutation.isPending || readyMutation.isPending}
          onStart={(taskId) => startMutation.mutate({ taskId })}
          onReady={(taskId) => readyMutation.mutate({ taskId })}
          onRefresh={refreshBranch}
        />
      ) : null}

      {view === "tickets" ? (
        <TicketsView
          tickets={tickets}
          now={now}
          station={station}
          isLoading={ticketsQuery.isPending}
          error={ticketsQuery.error ?? undefined}
          reprintPending={reprintMutation.isPending}
          onReprint={(ticketId) => reprintMutation.mutate({ ticketId })}
        />
      ) : null}

      {view === "print" ? (
        <PrintView
          printJobs={printJobs}
          now={now}
          station={station}
          isLoading={printJobsQuery.isPending}
          error={printJobsQuery.error ?? undefined}
          actionPending={
            printJobFailedMutation.isPending || printJobRetryMutation.isPending
          }
          onMarkFailed={(printJobId) =>
            printJobFailedMutation.mutate({
              printJobId,
              errorMessage: "Reported failed from KDS"
            })
          }
          onRetry={(printJobId) =>
            printJobRetryMutation.mutate({ printJobId })
          }
        />
      ) : null}
    </div>
  );
}

export function KitchenDashboardPage() {
  const t = useTranslations("staff");

  return (
    <KitchenStaffShell
      title={t("kitchen.dashboardTitle")}
      description={t("kitchen.dashboardDescription")}
      actions={<KitchenDashboardActions />}
    >
      <StaffAuthGate requiredPermissions={["preparation.read"]} branchScoped>
        <KitchenDashboardContent />
      </StaffAuthGate>
    </KitchenStaffShell>
  );
}
