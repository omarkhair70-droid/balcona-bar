"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  LogIn,
  LogOut,
  Printer,
  RefreshCw,
  RotateCcw,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
import {
  getTaskId,
  getTaskOrderId,
  getTaskStatus
} from "@/features/staff/preparation-data";
import { KitchenStaffShell } from "@/features/staff/kitchen-staff-shell";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useStaffBranchRealtime } from "@/features/staff/use-staff-branch-realtime";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import {
  cancelPreparationTask,
  getBranchKitchenTickets,
  getBranchPrintJobs,
  getBranchPreparationTasks,
  getBranchRealtimeEvents,
  getPreparationTaskDetail,
  markPrintJobFailed,
  markPrintJobPrinted,
  markPreparationTaskReady,
  reprintKitchenTicket,
  retryPrintJob,
  staffLogout,
  startPreparationTask
} from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { KitchenTaskBoard } from "../components/kitchen-task-board";
import { KitchenTaskDetailPanel } from "../components/kitchen-task-detail-panel";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";
import { StaffRealtimeStatus } from "../components/staff-realtime-status";
import type { DebugReportInput } from "@/lib/observability/debug-report";

type Notice = {
  tone: "success" | "error";
  message: string;
  debug?: DebugReportInput;
};

type TaskAction = {
  taskId: string;
};

type CancelTaskAction = TaskAction & {
  reason?: string | null;
};

type KdsMode = "tasks" | "tickets" | "print";

type PrintJobAction = {
  printJobId: string;
};

type PrintJobFailedAction = PrintJobAction & {
  errorMessage?: string | null;
};

type ReprintTicketAction = {
  ticketId: string;
  reason?: string | null;
};

const emptyRecords: Record<string, unknown>[] = [];

function countTasksByStatus(
  tasks: Record<string, unknown>[],
  predicate: (status: string) => boolean
) {
  return tasks.filter((task) => predicate(getTaskStatus(task))).length;
}

function countRecordsByStatus(
  records: Record<string, unknown>[],
  getStatus: (record: Record<string, unknown>) => string,
  predicate: (status: string) => boolean
) {
  return records.filter((record) => predicate(getStatus(record))).length;
}

function KdsModeTabs({
  mode,
  onChange
}: {
  mode: KdsMode;
  onChange: (mode: KdsMode) => void;
}) {
  const t = useTranslations("staff");
  const modes: Array<{ value: KdsMode; labelKey: string; icon: typeof ChefHat }> = [
    { value: "tasks", labelKey: "kitchen.modeTasks", icon: ChefHat },
    { value: "tickets", labelKey: "kitchen.modeTickets", icon: ClipboardList },
    { value: "print", labelKey: "kitchen.modePrint", icon: Printer }
  ];

  return (
    <div className="flex max-w-full min-w-0 gap-1 overflow-x-auto rounded-md border border-[#34312E] bg-[#171513] p-1">
      {modes.map((entry) => {
        const Icon = entry.icon;
        const active = mode === entry.value;

        return (
          <button
            key={entry.value}
            type="button"
            onClick={() => onChange(entry.value)}
            className={cn(
              "flex min-h-10 min-w-[108px] shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-black transition",
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

function KdsTicketCard({
  ticket,
  reprintPending,
  onReprint
}: {
  ticket: Record<string, unknown>;
  reprintPending?: boolean;
  onReprint: (ticketId: string) => void;
}) {
  const t = useTranslations("staff");
  const ticketId = getTicketId(ticket);
  const items = getTicketItems(ticket);
  const printJobs = getTicketPrintJobs(ticket);
  const status = getTicketStatus(ticket);
  const station = getTicketStation(ticket);
  const printFailed = printJobs.some(
    (printJob) => getPrintJobStatus(printJob) === "failed"
  );
  const printPending = printJobs.some(
    (printJob) => getPrintJobStatus(printJob) === "pending"
  );

  const stationLabel =
    station === "barista"
      ? t("kitchen.stationBarista")
      : station === "dessert"
        ? t("kitchen.stationDessert")
        : t("kitchen.stationKitchen");

  const statusLabel = (value: string) => {
    if (value === "queued") return t("kitchen.ticketStatusQueued");
    if (value === "in_progress") return t("kitchen.ticketStatusInProgress");
    if (value === "ready") return t("kitchen.ticketStatusReady");
    if (value === "served") return t("kitchen.ticketStatusServed");
    if (value === "cancelled") return t("kitchen.ticketStatusCancelled");
    return value;
  };

  return (
    <article className="overflow-hidden rounded-lg border border-[#3A3632] bg-[#1B1917]">
      <div className="flex items-start justify-between gap-3 border-b border-[#302D29] p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-[#E7E0D8] px-2 py-1 text-xs font-black text-[#171513]">
              {getTicketDisplayCode(ticket)}
            </span>
            <span
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-black",
                printFailed
                  ? "border-[#7D3932] bg-[#3D211E] text-[#FFAAA0]"
                  : printPending
                    ? "border-[#8A682A] bg-[#352B16] text-[#F7CD73]"
                    : "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]"
              )}
            >
              {printFailed
                ? t("kitchen.printFailed")
                : printPending
                  ? t("kitchen.printPending")
                  : t("kitchen.printTracked")}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-black text-[#FFF8F0]">
            {getTicketOrderNumber(ticket) || t("kitchen.stationTicket")}
          </h3>
          <p className="mt-1 text-xs font-semibold text-[#8F8982]">
            {stationLabel} / {formatDateTime(getTicketCreatedAt(ticket))}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase",
            status === "ready"
              ? "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]"
              : status === "cancelled"
                ? "border-[#7D3932] bg-[#3D211E] text-[#FFAAA0]"
                : "border-[#5A5045] bg-[#27231F] text-[#D9D0C7]"
          )}
        >
          {statusLabel(status)}
        </span>
      </div>

      <div className="p-3">
        <p className="text-xl font-black tracking-[-0.025em] text-[#FFF8F0]">
          {getTicketLocationLabel(ticket)}
        </p>

        <div className="mt-3 divide-y divide-[#302D29] border-y border-[#302D29]">
          {items.map((item, index) => {
            const modifiers = getTicketItemModifiers(item);
            const notes = getTicketItemNotes(item);
            const itemStatus = getRecordString(item, "status", "queued");

            return (
              <div
                key={getRecordString(item, "id") || String(index)}
                className="py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-black text-[#FFF9F2]">
                    {getTicketItemQuantity(item)}× {getTicketItemName(item)}
                  </p>
                  <span className="shrink-0 text-[10px] font-bold uppercase text-[#817B75]">
                    {statusLabel(itemStatus)}
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
                        className="rounded bg-[#2A2724] px-2 py-1 text-[11px] font-bold text-[#D0C8C1]"
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
                  <p className="mt-2 rounded-md border border-[#71582A] bg-[#2E2516] p-2 text-xs font-bold text-[#F0C876]">
                    {notes}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {getTicketCustomerNote(ticket) ? (
          <p className="mt-3 rounded-md border border-[#71582A] bg-[#2E2516] p-3 text-sm font-bold text-[#F0C876]">
            {getTicketCustomerNote(ticket)}
          </p>
        ) : null}

        <Button
          type="button"
          variant="secondary"
          className="mt-3 min-h-11 w-full border-[#4A4540] bg-[#24211E] font-black text-[#F1EAE3] hover:bg-[#2D2925]"
          disabled={!ticketId || reprintPending}
          onClick={() => ticketId && onReprint(ticketId)}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("actions.reprint")}
        </Button>
      </div>
    </article>
  );
}

function PrintJobCard({
  printJob,
  actionPending,
  onMarkPrinted,
  onMarkFailed,
  onRetry
}: {
  printJob: Record<string, unknown>;
  actionPending?: boolean;
  onMarkPrinted: (printJobId: string) => void;
  onMarkFailed: (printJobId: string) => void;
  onRetry: (printJobId: string) => void;
}) {
  const t = useTranslations("staff");
  const printJobId = getPrintJobId(printJob);
  const status = getPrintJobStatus(printJob);
  const kind = getPrintJobKind(printJob);
  const printableText = getPrintJobPrintableText(printJob);
  const canPrint = status === "pending" || status === "printing";
  const canRetry =
    status === "failed" ||
    status === "cancelled" ||
    status === "reprint_requested";

  const statusLabel =
    status === "pending"
      ? t("kitchen.printStatusPending")
      : status === "printing"
        ? t("kitchen.printStatusPrinting")
        : status === "printed"
          ? t("kitchen.printStatusPrinted")
          : status === "failed"
            ? t("kitchen.printStatusFailed")
            : status === "cancelled"
              ? t("kitchen.printStatusCancelled")
              : status;

  const kindLabel =
    kind === "kitchen_ticket"
      ? t("kitchen.printKindKitchenTicket")
      : kind === "barista_ticket"
        ? t("kitchen.printKindBaristaTicket")
        : kind === "dessert_ticket"
          ? t("kitchen.printKindDessertTicket")
          : kind === "receipt"
            ? t("kitchen.printKindReceipt")
            : kind === "void_ticket"
              ? t("kitchen.printKindVoidTicket")
              : kind;

  return (
    <article
      className={cn(
        "rounded-lg border p-3",
        status === "failed"
          ? "border-[#7D3932] bg-[#2B1D1B]"
          : "border-[#3A3632] bg-[#1B1917]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-black text-[#FFF8F0]">{kindLabel}</p>
          <p className="mt-1 text-xs font-semibold text-[#8F8982]">
            {getPrinterStationName(getPrintJobPrinterStation(printJob))}
          </p>
          <p className="mt-1 text-[10px] text-[#77716B]">
            {formatDateTime(getPrintJobCreatedAt(printJob))}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase",
            status === "failed"
              ? "border-[#8D3E35] bg-[#3D211E] text-[#FFAAA0]"
              : status === "printed"
                ? "border-[#3F6B47] bg-[#1D3323] text-[#A9D7B0]"
                : "border-[#8A682A] bg-[#352B16] text-[#F7CD73]"
          )}
        >
          {statusLabel}
        </span>
      </div>

      {getPrintJobError(printJob) ? (
        <p className="mt-3 rounded-md border border-[#8D3E35] bg-[#3D211E] p-2 text-xs font-bold text-[#FFAAA0]">
          {getPrintJobError(printJob)}
        </p>
      ) : null}

      <details className="mt-3 rounded-md border border-[#34302D] bg-[#151412] p-3 text-xs text-[#8E8882]">
        <summary className="cursor-pointer font-bold text-[#DAD3CC]">
          {t("kitchen.printablePayload")}
        </summary>
        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap font-mono text-[0.7rem] leading-relaxed text-[#BFB7AF]">
          {printableText || t("kitchen.printablePayloadEmpty")}
        </pre>
      </details>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          size="sm"
          disabled={!printJobId || !canPrint || actionPending}
          onClick={() => printJobId && onMarkPrinted(printJobId)}
          className="min-h-10 bg-[#29412F] font-black text-[#BDE2C4] hover:bg-[#34513B]"
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("actions.printed")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!printJobId || !canPrint || actionPending}
          onClick={() => printJobId && onMarkFailed(printJobId)}
          className="min-h-10 border-[#67403A] bg-[#2B1D1B] font-bold text-[#F0A49B] hover:bg-[#37211F]"
        >
          <XCircle className="size-4" aria-hidden="true" />
          {t("actions.failed")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!printJobId || !canRetry || actionPending}
          onClick={() => printJobId && onRetry(printJobId)}
          className="min-h-10 border border-[#46413C] bg-[#23211F] font-bold text-[#E7E0D8] hover:bg-[#2D2925]"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("actions.retry")}
        </Button>
      </div>
    </article>
  );
}

function KdsFilterBar({
  station,
  status,
  statusOptions,
  onStationChange,
  onStatusChange
}: {
  station: PreparationStation;
  status: string;
  statusOptions: string[];
  onStationChange: (station: PreparationStation) => void;
  onStatusChange: (status: string) => void;
}) {
  const t = useTranslations("staff");
  const stationOptions: PreparationStation[] = [
    "all",
    "barista",
    "kitchen",
    "dessert"
  ];

  const stationLabel = (value: PreparationStation) => {
    if (value === "barista") return t("kitchen.stationBarista");
    if (value === "kitchen") return t("kitchen.stationKitchen");
    if (value === "dessert") return t("kitchen.stationDessert");
    return t("kitchen.stationAll");
  };

  const statusLabel = (value: string) => {
    const labels: Record<string, string> = {
      all: t("kitchen.statusAll"),
      queued: t("kitchen.ticketStatusQueued"),
      in_progress: t("kitchen.ticketStatusInProgress"),
      ready: t("kitchen.ticketStatusReady"),
      served: t("kitchen.ticketStatusServed"),
      pending: t("kitchen.printStatusPending"),
      printing: t("kitchen.printStatusPrinting"),
      printed: t("kitchen.printStatusPrinted"),
      failed: t("kitchen.printStatusFailed"),
      cancelled: t("kitchen.printStatusCancelled")
    };

    return labels[value] ?? value;
  };

  return (
    <div className="grid min-w-0 gap-2 border border-[#302D29] bg-[#171513] p-3 lg:grid-cols-[1fr_auto]">
      <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {stationOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onStationChange(option)}
            className={cn(
              "min-h-9 shrink-0 rounded-md border px-3 text-xs font-bold transition",
              station === option
                ? "border-[#C68A4A] bg-[#C68A4A] text-[#17110C]"
                : "border-[#3E3A36] bg-[#1B1917] text-[#AAA39C] hover:border-[#5A544E] hover:text-[#F1EAE3]"
            )}
          >
            {stationLabel(option)}
          </button>
        ))}
      </div>
      <div className="flex max-w-full min-w-0 gap-2 overflow-x-auto pb-1">
        {statusOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onStatusChange(option)}
            className={cn(
              "min-h-9 shrink-0 rounded-md border px-3 text-xs font-bold transition",
              status === option
                ? "border-[#6E624F] bg-[#2B2723] text-[#FFF8F0]"
                : "border-[#34312E] bg-[#151412] text-[#8E8882] hover:border-[#4A4540] hover:text-[#DAD3CC]"
            )}
          >
            {statusLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoticeBanner({ notice }: { notice?: Notice }) {
  if (!notice) {
    return null;
  }

  const isSuccess = notice.tone === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      className={
        isSuccess
          ? "rounded-card border border-success bg-success/10 p-4 text-sm text-success"
          : "rounded-card border border-danger bg-danger/10 p-4 text-sm text-danger"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{notice.message}</span>
        {notice.tone === "error" && notice.debug ? (
          <CopyDebugReportButton {...notice.debug} />
        ) : null}
      </div>
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
        onClick={() => logoutMutation.mutate()}
        disabled={logoutMutation.isPending}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {t("actions.logout")}
      </Button>
    </>
  );
}

function KitchenDashboardContent() {
  const t = useTranslations("staff");
  const queryClient = useQueryClient();
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const [station, setStation] = useState<PreparationStation>("all");
  const [status, setStatus] = useState<PreparationTaskStatus>("all");
  const [mode, setMode] = useState<KdsMode>("tasks");
  const [ticketStatus, setTicketStatus] = useState("all");
  const [printStatus, setPrintStatus] = useState("pending");
  const [userSelectedTaskId, setUserSelectedTaskId] = useState<string>();
  const [notice, setNotice] = useState<Notice>();
  const selectedBranchAccess = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  );
  const selectedBranch = selectedBranchAccess?.branch;
  const realtime = useStaffBranchRealtime(selectedBranchId, accessToken);
  const allTasksQuery = useQuery({
    queryKey: staffQueryKeys.preparationTasks(
      selectedBranchId,
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station: "all", status: "all" },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const tasksQuery = useQuery({
    queryKey: staffQueryKeys.preparationTasks(selectedBranchId, station, status),
    queryFn: () =>
      getBranchPreparationTasks(
        selectedBranchId ?? "",
        { station, status },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 10_000
  });
  const realtimeEventsQuery = useQuery({
    queryKey: staffQueryKeys.branchRealtime(selectedBranchId),
    queryFn: () =>
      getBranchRealtimeEvents(
        selectedBranchId ?? "",
        { channel: "all", limit: 8 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 15_000
  });
  const ticketsQuery = useQuery({
    queryKey: staffQueryKeys.kitchenTickets(
      selectedBranchId,
      station,
      ticketStatus,
      "all"
    ),
    queryFn: () =>
      getBranchKitchenTickets(
        selectedBranchId ?? "",
        { station, status: ticketStatus, type: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });
  const allTicketsQuery = useQuery({
    queryKey: staffQueryKeys.kitchenTickets(
      selectedBranchId,
      "all",
      "all",
      "all"
    ),
    queryFn: () =>
      getBranchKitchenTickets(
        selectedBranchId ?? "",
        { station: "all", status: "all", type: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });
  const printJobsQuery = useQuery({
    queryKey: staffQueryKeys.printJobs(
      selectedBranchId,
      station,
      printStatus,
      "all"
    ),
    queryFn: () =>
      getBranchPrintJobs(
        selectedBranchId ?? "",
        { station, status: printStatus, kind: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });
  const allPrintJobsQuery = useQuery({
    queryKey: staffQueryKeys.printJobs(selectedBranchId, "all", "all", "all"),
    queryFn: () =>
      getBranchPrintJobs(
        selectedBranchId ?? "",
        { station: "all", status: "all", kind: "all", limit: 100 },
        accessToken
      ),
    enabled: Boolean(selectedBranchId && accessToken),
    staleTime: 8_000
  });
  const tasks = useMemo(
    () => tasksQuery.data?.tasks ?? emptyRecords,
    [tasksQuery.data?.tasks]
  );
  const allTasks = useMemo(
    () => allTasksQuery.data?.tasks ?? tasks,
    [allTasksQuery.data?.tasks, tasks]
  );
  const tickets = useMemo(
    () => ticketsQuery.data?.tickets ?? emptyRecords,
    [ticketsQuery.data?.tickets]
  );
  const allTickets = useMemo(
    () => allTicketsQuery.data?.tickets ?? tickets,
    [allTicketsQuery.data?.tickets, tickets]
  );
  const printJobs = useMemo(
    () => printJobsQuery.data?.printJobs ?? emptyRecords,
    [printJobsQuery.data?.printJobs]
  );
  const allPrintJobs = useMemo(
    () => allPrintJobsQuery.data?.printJobs ?? printJobs,
    [allPrintJobsQuery.data?.printJobs, printJobs]
  );
  const selectedTaskStillVisible = useMemo(
    () => tasks.some((task) => getTaskId(task) === userSelectedTaskId),
    [tasks, userSelectedTaskId]
  );
  const selectedTaskId =
    selectedTaskStillVisible && userSelectedTaskId
      ? userSelectedTaskId
      : getTaskId(tasks[0]);
  const taskDetailQuery = useQuery({
    queryKey: staffQueryKeys.preparationTask(selectedTaskId),
    queryFn: () => getPreparationTaskDetail(selectedTaskId ?? "", accessToken),
    enabled: Boolean(selectedTaskId && accessToken),
    staleTime: 5_000
  });
  const refreshBranch = () => {
    if (!selectedBranchId) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.preparationTasks(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
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
      queryKey: staffQueryKeys.branchOrders(selectedBranchId)
    });
    void queryClient.invalidateQueries({
      queryKey: staffQueryKeys.branchRealtime(selectedBranchId)
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
  const cancelMutation = useMutation({
    mutationFn: ({ taskId, reason }: CancelTaskAction) =>
      cancelPreparationTask(
        taskId,
        { reason, staffUserId: staffUser?.id },
        accessToken
      ),
    onSuccess: (result, variables) => {
      setNotice({ tone: "success", message: t("kitchen.taskCancelled") });
      invalidateTaskState(variables.taskId, getTaskOrderId(result));
    },
    onError: (error: Error, variables) => {
      setNotice({
        tone: "error",
        message: t("kitchen.taskCancelledError", { message: error.message }),
        debug: {
          action: "preparation_task_cancel",
          flow: "staff_kds",
          taskId: variables.taskId,
          error
        }
      });
    }
  });
  const reprintMutation = useMutation({
    mutationFn: ({ ticketId, reason }: ReprintTicketAction) =>
      reprintKitchenTicket(ticketId, { reason }, accessToken),
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
  const printJobPrintedMutation = useMutation({
    mutationFn: ({ printJobId }: PrintJobAction) =>
      markPrintJobPrinted(printJobId, accessToken),
    onSuccess: () => {
      setNotice({ tone: "success", message: t("kitchen.printJobPrinted") });
      refreshBranch();
    },
    onError: (error: Error) => {
      setNotice({
        tone: "error",
        message: t("kitchen.printJobPrintedError", { message: error.message })
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
      <EmptyState
        title={t("kitchen.emptyBranchTitle")}
        description={t("kitchen.emptyBranchDescription")}
      />
    );
  }

  return (
    <div className="grid gap-5">
      <section className="border border-[#302D29] bg-[#171513]">
        <div className="flex flex-col gap-3 border-b border-[#2D2A27] p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#45403B] bg-[#23211F] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#C8C2BC]">
                {t("kitchen.badge")}
              </span>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <h2 className="mt-2 truncate text-lg font-black text-[#FFF8F0]">
              {selectedBranch.name}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[#8E8882]">
              {t("kitchen.viewingDescription", {
                name:
                  staffUser?.name ||
                  staffUser?.email ||
                  t("cashier.staffUserFallback")
              })}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-1.5 text-[10px] font-black">
            <span className="rounded-full border border-[#8A682A] bg-[#352B16] px-2.5 py-1 text-[#F7CD73]">
              {t("kitchen.statusPending")}{" "}
              {countTasksByStatus(
                allTasks,
                (taskStatus) => taskStatus === "pending"
              )}
            </span>
            <span className="rounded-full border border-[#7A5936] bg-[#33271B] px-2.5 py-1 text-[#E7B46F]">
              {t("kitchen.statusPreparing")}{" "}
              {countTasksByStatus(
                allTasks,
                (taskStatus) => taskStatus === "preparing"
              )}
            </span>
            <span className="rounded-full border border-[#3F6B47] bg-[#1D3323] px-2.5 py-1 text-[#A9D7B0]">
              {t("kitchen.readyTicketsLabel")}{" "}
              {countRecordsByStatus(
                allTickets,
                getTicketStatus,
                (ticketStatusValue) => ticketStatusValue === "ready"
              )}
            </span>
            <span className="rounded-full border border-[#7D3932] bg-[#3D211E] px-2.5 py-1 text-[#FFAAA0]">
              {t("kitchen.failedPrintLabel")}{" "}
              {countRecordsByStatus(
                allPrintJobs,
                getPrintJobStatus,
                (printJobStatusValue) => printJobStatusValue === "failed"
              )}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 p-2 sm:flex-row sm:items-center sm:justify-between">
          <KdsModeTabs mode={mode} onChange={setMode} />
          <Button
            variant="secondary"
            onClick={refreshBranch}
            className="min-h-10 border-[#3E3A36] bg-[#1B1917] font-bold text-[#DAD3CC] hover:bg-[#24211E]"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.refreshBranch")}
          </Button>
        </div>
      </section>

      <NoticeBanner notice={notice} />

      {mode === "tasks" ? (
        <section className="grid gap-5 xl:grid-cols-[minmax(20rem,27rem)_1fr]">
          <KitchenTaskBoard
            tasks={tasks}
            station={station}
            status={status}
            selectedTaskId={selectedTaskId}
            isLoading={tasksQuery.isPending}
            error={tasksQuery.error ?? undefined}
            onStationChange={setStation}
            onStatusChange={setStatus}
            onSelectTask={setUserSelectedTaskId}
            onRefresh={refreshBranch}
          />
          <KitchenTaskDetailPanel
            task={taskDetailQuery.data}
            isLoading={taskDetailQuery.isPending && Boolean(selectedTaskId)}
            error={taskDetailQuery.error ?? undefined}
            startPending={startMutation.isPending}
            readyPending={readyMutation.isPending}
            cancelPending={cancelMutation.isPending}
            onStart={() => {
              if (selectedTaskId) {
                startMutation.mutate({ taskId: selectedTaskId });
              }
            }}
            onReady={() => {
              if (selectedTaskId) {
                readyMutation.mutate({ taskId: selectedTaskId });
              }
            }}
            onCancel={(reason) => {
              if (selectedTaskId) {
                cancelMutation.mutate({ taskId: selectedTaskId, reason });
              }
            }}
          />
        </section>
      ) : null}

      {mode === "tickets" ? (
        <section className="grid gap-4">
          <KdsFilterBar
            station={station}
            status={ticketStatus}
            statusOptions={[
              "all",
              "queued",
              "in_progress",
              "ready",
              "served",
              "cancelled"
            ]}
            onStationChange={setStation}
            onStatusChange={setTicketStatus}
          />
          {ticketsQuery.isError ? (
            <EmptyState
              title={t("kitchen.ticketsError")}
              description={ticketsQuery.error.message}
              debug={{
                action: "kitchen_ticket_list",
                flow: "staff_kds",
                error: ticketsQuery.error
              }}
            />
          ) : null}
          {!ticketsQuery.isPending && tickets.length === 0 ? (
            <EmptyState
              title={t("kitchen.ticketsEmptyTitle")}
              description={t("kitchen.acceptedEmpty")}
            />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {tickets.map((ticket, index) => (
              <KdsTicketCard
                key={getTicketId(ticket) || String(index)}
                ticket={ticket}
                reprintPending={reprintMutation.isPending}
                onReprint={(ticketId) =>
                  reprintMutation.mutate({
                    ticketId,
                    reason: "KDS manual reprint"
                  })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {mode === "print" ? (
        <section className="grid gap-4">
          <KdsFilterBar
            station={station}
            status={printStatus}
            statusOptions={[
              "all",
              "pending",
              "printing",
              "printed",
              "failed",
              "cancelled"
            ]}
            onStationChange={setStation}
            onStatusChange={setPrintStatus}
          />
          {printJobsQuery.isError ? (
            <EmptyState
              title={t("kitchen.printQueueError")}
              description={printJobsQuery.error.message}
              debug={{
                action: "print_job_list",
                flow: "staff_kds",
                error: printJobsQuery.error
              }}
            />
          ) : null}
          {!printJobsQuery.isPending && printJobs.length === 0 ? (
            <EmptyState
              title={t("kitchen.printQueueEmptyTitle")}
              description={t("kitchen.printQueueEmpty")}
            />
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {printJobs.map((printJob, index) => (
              <PrintJobCard
                key={getPrintJobId(printJob) || String(index)}
                printJob={printJob}
                actionPending={
                  printJobPrintedMutation.isPending ||
                  printJobFailedMutation.isPending ||
                  printJobRetryMutation.isPending
                }
                onMarkPrinted={(printJobId) =>
                  printJobPrintedMutation.mutate({ printJobId })
                }
                onMarkFailed={(printJobId) =>
                  printJobFailedMutation.mutate({
                    printJobId,
                    errorMessage: "Marked failed from KDS"
                  })
                }
                onRetry={(printJobId) =>
                  printJobRetryMutation.mutate({ printJobId })
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <Card variant="quiet">
        <CardHeader>
          <CardTitle>{t("kitchen.activityTitle")}</CardTitle>
          <CardDescription>{t("kitchen.activityDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {realtimeEventsQuery.isError ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="me-2 inline size-4" aria-hidden="true" />
              {realtimeEventsQuery.error.message}
            </div>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).length === 0 ? (
            <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
              {t("kitchen.activityEmpty")}
            </p>
          ) : null}
          {(realtimeEventsQuery.data?.events ?? []).map((event, index) => (
            <div
              key={getRecordString(event, "id") || String(index)}
              className="rounded-card border bg-surface/75 p-3"
            >
              <p className="text-sm font-semibold text-foreground">
                {humanizeStatus(getRecordString(event, "type", "event"))}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {getRecordString(event, "channel", "system")} /{" "}
                {formatDateTime(getRecordString(event, "createdAt"))}
              </p>
              {getRecordString(event, "preparationTaskId") ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Task {shortId(getRecordString(event, "preparationTaskId"))}
                </p>
              ) : null}
              {getRecordString(event, "orderId") ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Order {shortId(getRecordString(event, "orderId"))}
                </p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
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
