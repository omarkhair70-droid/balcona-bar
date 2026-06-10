"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getTaskId,
  getTaskStation,
  getTaskStatus
} from "@/features/staff/preparation-data";
import type {
  PreparationStation,
  PreparationTaskStatus
} from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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

function stationStatusGroups(tasks: Record<string, unknown>[]) {
  const groups = new Map<string, Record<string, unknown>[]>();

  tasks.forEach((task) => {
    const key = `${getTaskStation(task) || "station"} / ${
      getTaskStatus(task) || "status"
    }`;
    const group = groups.get(key) ?? [];

    group.push(task);
    groups.set(key, group);
  });

  return Array.from(groups.entries());
}

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
  const groups = stationStatusGroups(tasks);

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>{t("tasks.queueTitle")}</CardTitle>
          <CardDescription>{t("tasks.queueDescription")}</CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("actions.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <KitchenStationFilter
            station={station}
            status={status}
            onStationChange={onStationChange}
            onStatusChange={onStatusChange}
          />
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
        {!isLoading && !error && tasks.length === 0 ? (
          <EmptyState
            title={t("tasks.emptyTitle")}
            description={t("tasks.emptyDescription")}
          />
        ) : null}
        {!isLoading && !error && tasks.length > 0 ? (
          <div className="grid gap-5">
            {groups.map(([groupName, groupTasks]) => (
              <section key={groupName}>
                <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
                  {groupName}
                </p>
                <div className="grid gap-3">
                  {groupTasks.map((task, index) => {
                    const taskId = getTaskId(task) || String(index);

                    return (
                      <KitchenTaskCard
                        key={taskId}
                        task={task}
                        selected={selectedTaskId === taskId}
                        onSelect={onSelectTask}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
