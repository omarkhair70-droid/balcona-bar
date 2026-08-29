"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Flame,
  Gauge,
  LayoutDashboard,
  LogIn,
  LogOut,
  Printer,
  Receipt,
  RefreshCw,
  RotateCcw,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
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
    <div className="flex flex-wrap gap-2">
      {modes.map((entry) => {
        const Icon = entry.icon;
        const active = mode === entry.value;

        return (
          <Button
            key={entry.value}
            type="button"
            variant={active ? "primary" : "secondary"}
            onClick={() => onChange(entry.value)}
          >
            <Icon className="size-4" aria-hidden="true" />
            {t(entry.labelKey)}
          </Button>
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
  const printFailed = printJobs.some(
    (printJob) => getPrintJobStatus(printJob) === "failed"
  );
  const printPending = printJobs.some(
    (printJob) => getPrintJobStatus(printJob) === "pending"
  );

  return (
    <Card variant="glass" padding="sm">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{getTicketDisplayCode(ticket)}</Badge>
              <Badge variant={printFailed ? "danger" : "muted"}>
                {printFailed
                  ? t("kitchen.printFailed")
                  : printPending
                    ? t("kitchen.printPending")
                    : t("kitchen.printTracked")}
              </Badge>
            </div>
            <CardTitle className="mt-3 text-base">
              {getTicketOrderNumber(ticket) || t("kitchen.stationTicket")}
            </CardTitle>
            <CardDescription>
              {humanizeStatus(getTicketStation(ticket))} /{" "}
              {formatDateTime(getTicketCreatedAt(ticket))}
            </CardDescription>
          </div>
          <Badge variant="default">{humanizeStatus(getTicketStatus(ticket))}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          {getTicketLocationLabel(ticket)}
        </p>
        <div className="grid gap-2">
          {items.map((item, index) => {
            const modifiers = getTicketItemModifiers(item);
            const notes = getTicketItemNotes(item);

            return (
              <div
                key={getRecordString(item, "id") || String(index)}
                className="rounded-card border bg-surface/75 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {getTicketItemQuantity(item)}x {getTicketItemName(item)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {humanizeStatus(getRecordString(item, "status", "queued"))}
                  </span>
                </div>
                {modifiers.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {modifiers.map((modifier, modifierIndex) => (
                      <Badge
                        key={
                          getRecordString(modifier, "optionId") ||
                          String(modifierIndex)
                        }
                        variant="muted"
                      >
                        {getRecordString(
                          modifier,
                          "optionName",
                          t("tasks.modifierFallback")
                        )}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {notes ? (
                  <p className="mt-2 rounded-card border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                    {notes}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        {getTicketCustomerNote(ticket) ? (
          <p className="rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            {getTicketCustomerNote(ticket)}
          </p>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={!ticketId || reprintPending}
          onClick={() => ticketId && onReprint(ticketId)}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t("actions.reprint")}
        </Button>
      </CardContent>
    </Card>
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
  const printableText = getPrintJobPrintableText(printJob);
  const canPrint = status === "pending" || status === "printing";
  const canRetry =
    status === "failed" ||
    status === "cancelled" ||
    status === "reprint_requested";

  return (
    <Card variant="quiet" padding="sm">
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {humanizeStatus(getPrintJobKind(printJob))}
            </CardTitle>
            <CardDescription>
              {getPrinterStationName(getPrintJobPrinterStation(printJob))} /{" "}
              {formatDateTime(getPrintJobCreatedAt(printJob))}
            </CardDescription>
          </div>
          <Badge variant={status === "failed" ? "danger" : "muted"}>
            {humanizeStatus(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        {getPrintJobError(printJob) ? (
          <p className="rounded-card border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
            {getPrintJobError(printJob)}
          </p>
        ) : null}
        <details className="rounded-card border bg-surface/75 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-semibold text-foreground">
            {t("kitchen.printablePayload")}
          </summary>
          <pre className="mt-3 whitespace-pre-wrap font-mono text-[0.7rem] leading-relaxed">
            {printableText || t("kitchen.printablePayloadEmpty")}
          </pre>
        </details>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!printJobId || !canPrint || actionPending}
            onClick={() => printJobId && onMarkPrinted(printJobId)}
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
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            {t("actions.retry")}
          </Button>
        </div>
      </CardContent>
    </Card>
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
  const stationOptions: PreparationStation[] = [
    "all",
    "barista",
    "kitchen",
    "dessert"
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border bg-surface/75 p-3">
      <div className="flex flex-wrap gap-2">
        {stationOptions.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={station === option ? "primary" : "secondary"}
            onClick={() => onStationChange(option)}
          >
            {humanizeStatus(option)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {statusOptions.map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={status === option ? "primary" : "ghost"}
            onClick={() => onStatusChange(option)}
          >
            {humanizeStatus(option)}
          </Button>
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
      <Link href="/staff" className={buttonVariants({ variant: "ghost" })}>
        <LayoutDashboard className="size-4" aria-hidden="true" />
        {t("actions.overview")}
      </Link>
      <Link
        href="/staff/cashier"
        className={buttonVariants({ variant: "ghost" })}
      >
        <Receipt className="size-4" aria-hidden="true" />
        {t("actions.cashier")}
      </Link>
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
  const [status, setStatus] = useState<PreparationTaskStatus>("pending");
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
      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard
          label={t("kitchen.pendingLabel")}
          value={String(
            countTasksByStatus(allTasks, (taskStatus) => taskStatus === "pending")
          )}
          description={t("kitchen.pendingDescription")}
          icon={<ChefHat className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label={t("kitchen.preparingLabel")}
          value={String(
            countTasksByStatus(
              allTasks,
              (taskStatus) => taskStatus === "preparing"
            )
          )}
          description={t("kitchen.preparingDescription")}
          icon={<Flame className="size-4" aria-hidden="true" />}
          tone="primary"
        />
        <MetricCard
          label={t("kitchen.readyTicketsLabel")}
          value={String(
            countRecordsByStatus(
              allTickets,
              getTicketStatus,
              (ticketStatusValue) => ticketStatusValue === "ready"
            )
          )}
          description={t("kitchen.readyTicketsDescription")}
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
        <MetricCard
          label={t("kitchen.failedPrintLabel")}
          value={String(
            countRecordsByStatus(
              allPrintJobs,
              getPrintJobStatus,
              (printJobStatusValue) => printJobStatusValue === "failed"
            )
          )}
          description={t("kitchen.failedPrintDescription")}
          icon={<Printer className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label={t("realtime.metricLabel")}
          value={
            realtime.state === "connected"
              ? t("kitchen.realtimeLive")
              : t("kitchen.realtimeWatch")
          }
          description={humanizeStatus(realtime.state)}
          icon={<Gauge className="size-4" aria-hidden="true" />}
          tone={realtime.state === "connected" ? "success" : "warning"}
        />
      </section>

      <Card variant="quiet">
        <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{t("kitchen.badge")}</Badge>
              <StaffRealtimeStatus
                state={realtime.state}
                lastEventType={realtime.lastEventType}
              />
            </div>
            <CardTitle className="mt-3">{selectedBranch.name}</CardTitle>
            <CardDescription>
              {t("kitchen.viewingDescription", {
                name:
                  staffUser?.name ||
                  staffUser?.email ||
                  t("cashier.staffUserFallback"),
              })}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <KdsModeTabs mode={mode} onChange={setMode} />
            <Button variant="secondary" onClick={refreshBranch}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("actions.refreshBranch")}
            </Button>
          </div>
        </CardHeader>
      </Card>

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
