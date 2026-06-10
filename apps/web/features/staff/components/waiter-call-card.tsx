"use client";

import { BellRing, Clock3, Hash, MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getWaiterCallCreatedAt,
  getWaiterCallFloor,
  getWaiterCallId,
  getWaiterCallMessage,
  getWaiterCallOrderNumber,
  getWaiterCallOrderStatus,
  getWaiterCallPriority,
  getWaiterCallSessionStatus,
  getWaiterCallStatus,
  getWaiterCallTable,
  getWaiterCallType
} from "@/features/staff/waiter-data";
import {
  formatDateTime,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { WaiterCallStatusPill } from "./waiter-call-status-pill";

type WaiterCallCardProps = {
  waiterCall: Record<string, unknown>;
  selected?: boolean;
  onSelect: (waiterCallId: string) => void;
};

export function WaiterCallCard({
  waiterCall,
  selected,
  onSelect
}: WaiterCallCardProps) {
  const t = useTranslations("staff");
  const waiterCallId = getWaiterCallId(waiterCall);
  const priority = getWaiterCallPriority(waiterCall);
  const orderNumber = getWaiterCallOrderNumber(waiterCall);
  const orderStatus = getWaiterCallOrderStatus(waiterCall);
  const message = getWaiterCallMessage(waiterCall);
  const isHighPriority = priority >= 3;

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => waiterCallId && onSelect(waiterCallId)}
      className={cn(
        "w-full rounded-card border bg-surface/75 p-4 text-start shadow-card transition hover:border-primary/55 hover:bg-surface",
        selected ? "border-primary/70 bg-primary/10" : "border-border",
        isHighPriority && !selected ? "border-warning/60" : ""
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <BellRing
              className={cn(
                "size-4",
                isHighPriority ? "text-warning" : "text-primary"
              )}
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-foreground">
              {getTableLabel(
                getWaiterCallTable(waiterCall),
                getWaiterCallFloor(waiterCall)
              )}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {humanizeStatus(getWaiterCallType(waiterCall))} /{" "}
            {humanizeStatus(getWaiterCallSessionStatus(waiterCall))}
          </p>
        </div>
        <WaiterCallStatusPill status={getWaiterCallStatus(waiterCall)} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("waiter.priority")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {priority > 0 ? priority : t("waiter.standardPriority")}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("waiter.request")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {humanizeStatus(getWaiterCallType(waiterCall))}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="size-3.5" aria-hidden="true" />
          {formatDateTime(getWaiterCallCreatedAt(waiterCall))}
        </span>
        {orderNumber ? (
          <span className="inline-flex items-center gap-1.5">
            <Hash className="size-3.5" aria-hidden="true" />
            {orderNumber}
          </span>
        ) : (
          <span>
            {t("waiter.callFallback", { callId: shortId(waiterCallId) })}
          </span>
        )}
      </div>

      {orderStatus ? (
        <Badge variant="muted" className="mt-3">
          {t("tasks.orderStatus", { status: humanizeStatus(orderStatus) })}
        </Badge>
      ) : null}

      {message ? (
        <p className="mt-3 line-clamp-2 rounded-card border border-primary/30 bg-primary/10 p-2 text-xs text-foreground">
          <MessageSquareText
            className="me-1.5 inline size-3.5 text-primary"
            aria-hidden="true"
          />
          {message}
        </p>
      ) : null}
    </button>
  );
}
