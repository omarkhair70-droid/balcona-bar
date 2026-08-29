"use client";

import { CircleDot, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getTaskId,
  getTaskStatus
} from "@/features/staff/preparation-data";
import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { KitchenStationFilter } from "./kitchen-station-filter";
import { KitchenTaskCard } from "./kitchen-task-card";

type KitchenTaskBoardProps = {
  tasks: Record<string, unknown>[];
  station: PreparationStation;
  status: PreparationTaskStatus;
  selectedTaskId?: string;
  isLoading?: boolean;
  error?: Error;
  onStationChange: (station: PreparationStation) => void;
  onStatusChange: (status: PreparationTaskStatus) => void;
  onSelectTask: (taskId: string) => void;
  onRefresh: () => void;
};

export function KitchenTaskBoard({
  tasks,
  station,
  status,
  selectedTaskId,
  isLoading,
  error,
  onStationChange,
  onStatusChange,
  onSelectTask,
  onRefresh
}: KitchenTaskBoardProps) {
  const t = useTranslations("staff");
  const groupDefinitions =
    status === "cancelled"
      ? [
          {
            status: "cancelled",
            label: t("kitchen.statusCancelled"),
            dot: "text-[#D76D62]"
          }
        ]
      : [
          {
            status: "pending",
            label: t("kitchen.statusPending"),
            dot: "text-[#8C8781]"
          },
          {
            status: "preparing",
            label: t("kitchen.statusPreparing"),
            dot: "text-[#D6A24F]"
          },
          {
            status: "ready",
            label: t("kitchen.statusReady"),
            dot: "text-[#69AE73]"
          }
        ];

  return (
    <section className="min-h-[34rem] min-w-0 border border-[#302D29] bg-[#11100F]">
      <div className="border-b border-[#2D2A27] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8E8780]">
              {t("kitchen.boardEyebrow")}
            </p>
            <h2 className="mt-1 text-base font-black text-[#FFF8F0]">
              {t("tasks.queueTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#8E8882]">
              {t("tasks.queueDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3E3A36] bg-[#1B1917] text-[#AAA39C] transition hover:border-[#5A544E] hover:text-[#F1EAE3]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          <KitchenStationFilter
            station={station}
            status={status}
            onStationChange={onStationChange}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>

      <div className="p-2 sm:p-3">
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
        {!isLoading && !error && tasks.length === 0 ? (
          <EmptyState
            title={t("tasks.emptyTitle")}
            description={t("tasks.emptyDescription")}
          />
        ) : null}

        {!isLoading && !error && tasks.length > 0 ? (
          <div
            className={cn(
              "grid gap-2",
              groupDefinitions.length === 1
                ? "grid-cols-1"
                : "xl:grid-cols-3"
            )}
          >
            {groupDefinitions.map((group) => {
              const groupTasks = tasks.filter(
                (task) => getTaskStatus(task) === group.status
              );

              return (
                <section
                  key={group.status}
                  className="min-w-0 rounded-lg border border-[#302D29] bg-[#151412]"
                >
                  <div className="flex min-h-11 items-center justify-between border-b border-[#2D2A27] px-3">
                    <div className="flex items-center gap-2">
                      <CircleDot
                        className={cn("size-3.5", group.dot)}
                        aria-hidden="true"
                      />
                      <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#DAD3CC]">
                        {group.label}
                      </h3>
                    </div>
                    <span className="text-xs font-bold text-[#8E8882]">
                      {groupTasks.length}
                    </span>
                  </div>
                  <div className="grid gap-2 p-2">
                    {groupTasks.length > 0 ? (
                      groupTasks.map((task, index) => {
                        const taskId = getTaskId(task) || String(index);

                        return (
                          <KitchenTaskCard
                            key={taskId}
                            task={task}
                            selected={selectedTaskId === taskId}
                            onSelect={onSelectTask}
                          />
                        );
                      })
                    ) : (
                      <div className="flex min-h-28 items-center justify-center rounded-md border border-dashed border-[#34302D] p-3 text-center text-xs text-[#6F6963]">
                        {t("tasks.emptyDescription")}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
