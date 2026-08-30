"use client";

import { useState } from "react";
import {
  Check,
  Clock3,
  Hash,
  MessageSquareText,
  Send,
  X
} from "lucide-react";
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
  getWaiterCallAcknowledgedAt,
  getWaiterCallCancelledAt,
  getWaiterCallCreatedAt,
  getWaiterCallEvents,
  getWaiterCallFloor,
  getWaiterCallId,
  getWaiterCallMessage,
  getWaiterCallOrderNumber,
  getWaiterCallOrderStatus,
  getWaiterCallPriority,
  getWaiterCallResolvedAt,
  getWaiterCallSessionStatus,
  getWaiterCallStatus,
  getWaiterCallTable,
  getWaiterCallType
} from "@/features/staff/waiter-data";
import {
  formatDateTime,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import type { WaiterCallDetailResult } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { WaiterCallStatusPill } from "./waiter-call-status-pill";

type WaiterCallDetailPanelProps = {
  waiterCall?: WaiterCallDetailResult;
  isLoading?: boolean;
  isRefreshing?: boolean;
  error?: Error;
  acknowledgePending?: boolean;
  resolvePending?: boolean;
  cancelPending?: boolean;
  onAcknowledge: () => void;
  onResolve: (resolutionNote?: string | null) => void;
  onCancel: (reason?: string | null) => void;
};

export function WaiterCallDetailPanel({
  waiterCall,
  isLoading,
  isRefreshing,
  error,
  acknowledgePending,
  resolvePending,
  cancelPending,
  onAcknowledge,
  onResolve,
  onCancel
}: WaiterCallDetailPanelProps) {
  const t = useTranslations("staff");
  const [resolutionNote, setResolutionNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const status = waiterCall ? getWaiterCallStatus(waiterCall) : undefined;
  const events = waiterCall ? getWaiterCallEvents(waiterCall) : [];
  const canAcknowledge = status === "open";
  const canResolve = status === "open" || status === "acknowledged";
  const canCancel = status === "open" || status === "acknowledged";

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem] min-w-0 border-[#3B3028] bg-[#1E1814] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>{t("waiter.callDetailTitle")}</CardTitle>
            <CardDescription>{t("waiter.callDetailDescription")}</CardDescription>
          </div>
          {status ? <WaiterCallStatusPill status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!waiterCall && !isLoading && !error ? (
          <EmptyState
            title={t("waiter.selectCallTitle")}
            description={t("waiter.selectCallDescription")}
          />
        ) : null}
        {isLoading ? <LoadingState label={t("waiter.loadingDetail")} /> : null}
        {isRefreshing ? (
          <p role="status" className="rounded-md border border-[#5A483A] bg-[#292019] p-3 text-xs text-[#CDBEAF]">
            {t("waiter.loadingDetail")}
          </p>
        ) : null}
        {error ? (
          <EmptyState
            title={t("waiter.callDetailLoadError")}
            description={error.message}
          />
        ) : null}
        {waiterCall ? (
          <>
            <div className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[#F8EDDF]">
                    {getTableLabel(
                      getWaiterCallTable(waiterCall),
                      getWaiterCallFloor(waiterCall)
                    )}
                  </p>
                  <p className="mt-1 text-sm text-[#91857A]">
                    {humanizeStatus(getWaiterCallType(waiterCall))} /{" "}
                    {t("waiter.sessionStatus", {
                      status: humanizeStatus(
                        getWaiterCallSessionStatus(waiterCall)
                      ),
                    })}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-sm font-semibold text-[#F8EDDF]">
                    {t("waiter.priority")}{" "}
                    {getWaiterCallPriority(waiterCall) ||
                      t("waiter.priorityStandard")}
                  </p>
                  <p className="mt-1 text-xs text-[#91857A]">
                    {t("waiter.callFallback", {
                      callId: shortId(getWaiterCallId(waiterCall)),
                    })}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-xs text-[#91857A] sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {t("tasks.createdAt", {
                    date: formatDateTime(getWaiterCallCreatedAt(waiterCall)),
                  })}
                </span>
                <span>
                  {t("waiter.acknowledgedAt", {
                    date: formatDateTime(getWaiterCallAcknowledgedAt(waiterCall)),
                  })}
                </span>
                <span>
                  {t("attention.resolvedAt", {
                    date: formatDateTime(getWaiterCallResolvedAt(waiterCall)),
                  })}
                </span>
                <span>
                  {t("waiter.cancelledAt", {
                    date: formatDateTime(getWaiterCallCancelledAt(waiterCall)),
                  })}
                </span>
              </div>

              {getWaiterCallOrderNumber(waiterCall) ? (
                <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-[#91857A]">
                  <Hash className="size-3.5" aria-hidden="true" />
                  {t("tasks.orderStatus", {
                    status: `${getWaiterCallOrderNumber(waiterCall)} / ${humanizeStatus(
                      getWaiterCallOrderStatus(waiterCall)
                    )}`,
                  })}
                </p>
              ) : null}

              {getWaiterCallMessage(waiterCall) ? (
                <div className="mt-4 rounded-md border border-[#71413A] bg-[#321F1C] p-3 text-sm text-[#E4A199]">
                  <MessageSquareText
                    className="me-2 inline size-4 text-primary"
                    aria-hidden="true"
                  />
                  {getWaiterCallMessage(waiterCall)}
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={onAcknowledge}
                  disabled={!canAcknowledge || acknowledgePending || isRefreshing}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {acknowledgePending
                    ? t("actions.acknowledging")
                    : t("actions.acknowledge")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onResolve(resolutionNote.trim() || null)}
                  disabled={!canResolve || resolvePending || isRefreshing}
                >
                  <Send className="size-4" aria-hidden="true" />
                  {resolvePending ? t("actions.resolving") : t("actions.resolve")}
                </Button>
                <Button
                  variant="danger"
                  onClick={() => onCancel(cancelReason.trim() || null)}
                  disabled={!canCancel || cancelPending || isRefreshing}
                >
                  <X className="size-4" aria-hidden="true" />
                  {cancelPending ? t("actions.cancelling") : t("actions.cancel")}
                </Button>
              </div>
              {!canAcknowledge && !canResolve && !canCancel ? (
                <p className="mt-3 text-xs text-[#91857A]">
                  {t("waiter.closedWorkflow")}
                </p>
              ) : null}
              <label className="mt-4 grid gap-2 text-sm font-medium text-[#F8EDDF]">
                {t("waiter.resolutionNote")}
                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  rows={3}
                  placeholder={t("waiter.resolutionNotePlaceholder")}
                  className="w-full resize-none rounded-md border border-[#3B3028] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A] focus:ring-2 focus:ring-[#C68A4A]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canResolve || resolvePending || isRefreshing}
                />
              </label>
              <label className="mt-4 grid gap-2 text-sm font-medium text-[#F8EDDF]">
                {t("waiter.cancelReason")}
                <textarea
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={2}
                  placeholder={t("waiter.cancelReasonPlaceholder")}
                  className="w-full resize-none rounded-md border border-[#3B3028] bg-[#211A15] px-3 py-2 text-sm text-[#F6EBDD] outline-none transition placeholder:text-[#756A61] focus:border-[#C68A4A] focus:ring-2 focus:ring-[#C68A4A]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canCancel || cancelPending || isRefreshing}
                />
              </label>
            </div>

            <section className="grid gap-3">
              <h3 className="text-sm font-semibold text-[#F8EDDF]">
                {t("orders.timeline")}
              </h3>
              {events.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("waiter.emptyEvents")}
                </p>
              ) : null}
              {events.map((event, index) => (
                <div
                  key={getRecordString(event, "id") || String(index)}
                  className="flex items-start justify-between gap-3 rounded-md border border-[#3A3028] bg-[#211A15] p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-[#F8EDDF]">
                      {humanizeStatus(getRecordString(event, "type", "event"))}
                    </p>
                    <p className="mt-1 text-xs text-[#91857A]">
                      {getRecordString(event, "actorType", "system")}
                    </p>
                  </div>
                  <p className="text-xs text-[#91857A]">
                    {formatDateTime(getRecordString(event, "createdAt"))}
                  </p>
                </div>
              ))}
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
