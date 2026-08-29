"use client";

import { AlertTriangle, Clock3, Hash } from "lucide-react";
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
  const status = getTaskStatus(task);
  const modifiers = getTaskModifierOptions(task);
  const notes = getTaskNotes(task);
  const orderNumber = getTaskOrderNumber(task);
  const station = getTaskStation(task);
  const stationLabel =
    station === "barista"
      ? t("kitchen.stationBarista")
      : station === "dessert"
        ? t("kitchen.stationDessert")
        : t("kitchen.stationKitchen");

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => taskId && onSelect(taskId)}
      className={cn(
        "w-full rounded-lg border p-3 text-start transition",
        status === "ready"
          ? "border-[#36583D] bg-[#19261D]"
          : status === "cancelled"
            ? "border-[#51332E] bg-[#231817] opacity-75"
            : "border-[#3A3632] bg-[#1C1A18]",
        selected
          ? "ring-2 ring-[#C68A4A] ring-offset-2 ring-offset-[#11100F]"
          : "hover:border-[#5C554E] hover:bg-[#211F1C]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xl font-black tracking-[-0.035em] text-[#FFF8F0]">
            {getTableLabel(getTaskTable(task), getTaskFloor(task))}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8F8982]">
            {orderNumber ? (
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3" aria-hidden="true" />
                {orderNumber}
              </span>
            ) : (
              <span>{t("tasks.taskFallback", { taskId: shortId(taskId) })}</span>
            )}
            <span className="rounded bg-[#2A2724] px-2 py-1 text-[#BFB7AF]">
              {stationLabel}
            </span>
          </div>
        </div>
        <KitchenTaskStatusPill status={status} />
      </div>

      <div className="mt-4 border-t border-[#302D29] pt-3">
        <p className="text-lg font-black leading-6 tracking-[-0.02em] text-[#FFF9F2]">
          {getTaskQuantity(task)}× {getTaskItemName(task)}
        </p>

        {modifiers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {modifiers.slice(0, 6).map((modifier, index) => (
              <span
                key={getRecordString(modifier, "id") || String(index)}
                className="rounded bg-[#302C28] px-2 py-1 text-[11px] font-bold text-[#D7CEC6]"
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
          <div className="mt-3 flex gap-2 rounded-md border border-[#7A5F2E] bg-[#312716] p-2.5 text-xs font-bold leading-5 text-[#F3CC79]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-3">{notes}</span>
          </div>
        ) : null}
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-[10px] text-[#77716B]">
        <Clock3 className="size-3" aria-hidden="true" />
        {formatDateTime(getTaskCreatedAt(task))}
      </p>
    </button>
  );
}
