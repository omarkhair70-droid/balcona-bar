"use client";

import { ChefHat, Clock3, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getTaskCreatedAt,
  getTaskFloor,
  getTaskId,
  getTaskItemName,
  getTaskModifierOptions,
  getTaskNotes,
  getTaskOrderNumber,
  getTaskQuantity,
  getTaskStation,
  getTaskStatus,
  getTaskTable
} from "@/features/staff/preparation-data";
import {
  formatDateTime,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { KitchenTaskStatusPill } from "./kitchen-task-status-pill";

type KitchenTaskCardProps = {
  task: Record<string, unknown>;
  selected?: boolean;
  onSelect: (taskId: string) => void;
};

export function KitchenTaskCard({
  task,
  selected,
  onSelect
}: KitchenTaskCardProps) {
  const t = useTranslations("staff");
  const taskId = getTaskId(task);
  const modifiers = getTaskModifierOptions(task);
  const notes = getTaskNotes(task);
  const orderNumber = getTaskOrderNumber(task);

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => taskId && onSelect(taskId)}
      className={cn(
        "w-full rounded-card border bg-surface/75 p-4 text-start shadow-card transition hover:border-primary/55 hover:bg-surface",
        selected ? "border-primary/70 bg-primary/10" : "border-border"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <ChefHat className="size-4 text-primary" aria-hidden="true" />
            <p className="text-base font-semibold text-foreground">
              {getTaskItemName(task)}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {getTableLabel(getTaskTable(task), getTaskFloor(task))}
          </p>
        </div>
        <KitchenTaskStatusPill status={getTaskStatus(task)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("tasks.station")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {humanizeStatus(getTaskStation(task))}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("tasks.quantity")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {getTaskQuantity(task)}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatDateTime(getTaskCreatedAt(task))}
        </span>
        {orderNumber ? (
          <span className="inline-flex items-center gap-1.5">
            <Hash className="size-3.5" aria-hidden="true" />
            {orderNumber}
          </span>
        ) : (
          <span>{t("tasks.taskFallback", { taskId: shortId(taskId) })}</span>
        )}
      </div>

      {modifiers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {modifiers.slice(0, 4).map((modifier, index) => (
            <Badge
              key={getRecordString(modifier, "id") || String(index)}
              variant="muted"
            >
              {getRecordString(
                modifier,
                "modifierOptionNameSnapshot",
                t("tasks.modifierFallback")
              )}
            </Badge>
          ))}
        </div>
      ) : null}

      {notes ? (
        <p className="mt-3 line-clamp-2 rounded-card border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
          {notes}
        </p>
      ) : null}
    </button>
  );
}
