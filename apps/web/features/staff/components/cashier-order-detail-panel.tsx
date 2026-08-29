"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardList, Clock3, ListChecks, Printer } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  getCurrency,
  getMinorTotal,
  getOrderCustomerNote,
  getOrderEvents,
  getOrderFloor,
  getOrderItems,
  getOrderKitchenTickets,
  getOrderNextExpectedRole,
  getOrderNumber,
  getOrderProgressStep,
  getOrderStatus,
  getOrderSubmittedAt,
  getOrderTable,
  getOrderTotals,
  orderNeedsKdsRoutingAttention,
  orderAllowsAction
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  formatMoney,
  getRecordArray,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus
} from "@/features/staff/staff-format";
import {
  getPrintJobStatus,
  getTicketDisplayCode,
  getTicketItems,
  getTicketLocationLabel,
  getTicketPrintJobs,
  getTicketStation,
  getTicketStatus
} from "@/features/staff/kds-data";
import { formatErrorMessage } from "@/lib/api/error-message";
import type { OrderDetailResult } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CashierActionBar } from "./cashier-action-bar";
import { CashierOrderStatusPill } from "./cashier-order-status-pill";

type CashierOrderDetailPanelProps = {
  order?: OrderDetailResult;
  isLoading?: boolean;
  error?: Error;
  acceptPending?: boolean;
  rejectPending?: boolean;
  cancelPending?: boolean;
  completePending?: boolean;
  actionPending?: boolean;
  onAccept: () => void;
  onReject: (reason?: string | null) => void;
  onCancel: (reason: string) => void;
  onComplete: () => void;
};

type BadgeVariant = "default" | "muted" | "success" | "warning" | "danger";

function getTicketStatusVariant(status: string): BadgeVariant {
  if (status === "ready" || status === "served") {
    return "success";
  }

  if (status === "cancelled" || status === "voided") {
    return "danger";
  }

  return status === "queued" ? "warning" : "default";
}

function getTicketPrintSummary(ticket: Record<string, unknown>) {
  const printJobs = getTicketPrintJobs(ticket);
  const statuses = printJobs.map(getPrintJobStatus);

  if (statuses.includes("failed")) {
    return { labelKey: "tickets.printFailed", variant: "danger" as const };
  }

  if (statuses.includes("pending") || statuses.includes("printing")) {
    return { labelKey: "tickets.printPending", variant: "warning" as const };
  }

  if (statuses.includes("printed")) {
    return { labelKey: "tickets.printed", variant: "success" as const };
  }

  return { labelKey: "tickets.noPrintJob", variant: "muted" as const };
}

function getCashierDisabledReason(
  status: string | undefined,
  progressStep: string,
  nextExpectedRole: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const details = [
    status
      ? t("orders.disabledDetailStatus", { status: humanizeStatus(status) })
      : "",
    progressStep
      ? t("orders.disabledDetailProgress", {
          status: humanizeStatus(progressStep)
        })
      : "",
    nextExpectedRole
      ? t("orders.disabledDetailNextRole", {
          role: humanizeStatus(nextExpectedRole)
        })
      : ""
  ].filter(Boolean);

  if (details.length === 0) {
    return t("orders.disabledFallback");
  }

  return t("orders.disabledWithDetails", { details: details.join(", ") });
}

export function CashierOrderDetailPanel({
  order,
  isLoading,
  error,
  acceptPending,
  rejectPending,
  cancelPending,
  completePending,
  actionPending,
  onAccept,
  onReject,
  onCancel,
  onComplete
}: CashierOrderDetailPanelProps) {
  const t = useTranslations("staff");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const status = order ? getOrderStatus(order) : undefined;
  const totals = order ? getOrderTotals(order) : undefined;
  const items = order ? getOrderItems(order) : [];
  const events = order ? getOrderEvents(order) : [];
  const kitchenTickets = order ? getOrderKitchenTickets(order) : [];
  const needsKdsRoutingAttention = order
    ? orderNeedsKdsRoutingAttention(order)
    : false;
  const canAccept = order ? orderAllowsAction(order, "accept") : false;
  const canReject = order ? orderAllowsAction(order, "reject") : false;
  const canCancel = order ? orderAllowsAction(order, "cancel") : false;
  const canComplete = order ? orderAllowsAction(order, "complete") : false;
  const progressStep = order ? getOrderProgressStep(order) : "";
  const nextExpectedRole = order ? getOrderNextExpectedRole(order) : "";
  const disabledReason = getCashierDisabledReason(
    status,
    progressStep,
    nextExpectedRole,
    t
  );

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem] min-w-0 border-[#3B3028] bg-[#1E1814] shadow-none">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-[#FFF5E8]">{t("orders.orderDetailTitle")}</CardTitle>
            <CardDescription className="text-[#95887D]">{t("orders.orderDetailDescription")}</CardDescription>
          </div>
          {status ? <CashierOrderStatusPill status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!order && !isLoading && !error ? (
          <EmptyState
            title={t("orders.selectTitle")}
            description={t("orders.selectDescription")}
          />
        ) : null}
        {isLoading ? <LoadingState label={t("orders.loadingDetail")} /> : null}
        {error ? (
          <EmptyState
            title={t("orders.orderDetailError")}
            description={formatErrorMessage(error)}
          />
        ) : null}
        {order ? (
          <>
            <div className="rounded-md border border-[#3C3129] bg-[#211A15] p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-[#FFF5E8]">
                    {getOrderNumber(order)}
                  </p>
                  <p className="mt-1 text-sm text-[#A99B8E]">
                    {getTableLabel(getOrderTable(order), getOrderFloor(order))}
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-lg font-semibold text-[#FFF5E8]">
                    {formatMoney(getMinorTotal(totals), getCurrency(totals))}
                  </p>
                  <p className="mt-1 text-xs text-[#91857A]">
                    {t("orders.itemsQuantity", {
                      count: getRecordNumber(totals, "itemCount"),
                      quantity: getRecordNumber(totals, "totalQuantity")
                    })}
                  </p>
                </div>
              </div>
              <p className="mt-4 inline-flex items-center gap-2 text-xs text-[#91857A]">
                <Clock3 className="size-3.5" aria-hidden="true" />
                {t("orders.submittedAt", {
                  date: formatDateTime(getOrderSubmittedAt(order))
                })}
              </p>
              {getOrderCustomerNote(order) ? (
                <div className="mt-4 rounded-md border border-[#71413A] bg-[#321F1C] p-3 text-sm text-[#E4A199]">
                  {getOrderCustomerNote(order)}
                </div>
              ) : null}
              {progressStep || nextExpectedRole ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {progressStep ? (
                    <Badge variant="default">
                      {humanizeStatus(progressStep)}
                    </Badge>
                  ) : null}
                  {nextExpectedRole ? (
                    <Badge variant="muted">
                      {t("orders.nextRole", {
                        role: humanizeStatus(nextExpectedRole)
                      })}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F8EDDF]">
                <ListChecks className="size-4 text-primary" aria-hidden="true" />
                {t("orders.items")}
              </h3>
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("orders.emptyItems")}
                </p>
              ) : null}
              {items.map((item, index) => {
                const modifiers = getRecordArray(item.modifierOptions);
                const itemName =
                  getRecordString(item, "itemNameSnapshot") ||
                  t("orders.itemFallback", { index: index + 1 });

                return (
                  <div
                    key={getRecordString(item, "id") || itemName}
                    className="rounded-md border border-[#3C3129] bg-[#211A15] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8EDDF]">
                          {itemName}
                        </p>
                        <p className="mt-1 text-xs text-[#91857A]">
                          {t("orders.qty", {
                            count: getRecordNumber(item, "quantity", 1)
                          })}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-[#F8EDDF]">
                        {formatMoney(
                          getMinorTotal(item),
                          getCurrency(item)
                        )}
                      </p>
                    </div>
                    {getRecordString(item, "notes") ? (
                      <p className="mt-3 text-xs text-warning">
                        {getRecordString(item, "notes")}
                      </p>
                    ) : null}
                    {modifiers.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {modifiers.map((modifier, modifierIndex) => (
                          <span
                            key={
                              getRecordString(modifier, "id") ||
                              `${itemName}-${modifierIndex}`
                            }
                            className="rounded-button border bg-muted px-2.5 py-1 text-xs text-[#91857A]"
                          >
                            {getRecordString(
                              modifier,
                              "modifierOptionNameSnapshot",
                              t("orders.modifierFallback")
                            )}
                            {getRecordNumber(
                              modifier,
                              "priceDeltaMinorSnapshot"
                            ) > 0
                              ? ` +${formatMoney(
                                  getRecordNumber(
                                    modifier,
                                    "priceDeltaMinorSnapshot"
                                  ),
                                  getCurrency(item)
                                )}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </section>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F8EDDF]">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                {t("orders.kitchenTickets")}
              </h3>
              {needsKdsRoutingAttention ? (
                <div className="rounded-md border border-[#7D5D2C] bg-[#392B18] p-4 text-sm text-[#F0C66E]">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold">
                        {t("orders.kdsAttentionTitle")}
                      </p>
                      <p className="mt-1 text-xs">
                        {t("orders.kdsAttentionDescription")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {kitchenTickets.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("orders.ticketsEmpty")}
                </p>
              ) : null}
              {kitchenTickets.map((ticket, index) => {
                const ticketStatus = getTicketStatus(ticket);
                const printSummary = getTicketPrintSummary(ticket);

                return (
                  <div
                    key={getRecordString(ticket, "id") || String(index)}
                    className="rounded-md border border-[#3C3129] bg-[#211A15] p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#F8EDDF]">
                          {getTicketDisplayCode(ticket)}
                        </p>
                        <p className="mt-1 text-xs text-[#91857A]">
                          {humanizeStatus(getTicketStation(ticket))} /{" "}
                          {getTicketLocationLabel(ticket)}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={getTicketStatusVariant(ticketStatus)}>
                          {humanizeStatus(ticketStatus)}
                        </Badge>
                        <Badge variant={printSummary.variant}>
                          <Printer className="me-1 size-3" aria-hidden="true" />
                          {t(printSummary.labelKey)}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[#91857A]">
                      {t(
                        getTicketItems(ticket).length === 1
                          ? "orders.ticketItemsOne"
                          : "orders.ticketItems",
                        { count: getTicketItems(ticket).length }
                      )}
                    </p>
                  </div>
                );
              })}
            </section>

            <CashierActionBar
              canAccept={canAccept}
              canReject={canReject}
              canCancel={canCancel}
              canComplete={canComplete}
              rejectReason={rejectReason}
              cancelReason={cancelReason}
              acceptPending={acceptPending}
              rejectPending={rejectPending}
              cancelPending={cancelPending}
              completePending={completePending}
              actionPending={actionPending}
              disabledReason={disabledReason}
              onRejectReasonChange={setRejectReason}
              onCancelReasonChange={setCancelReason}
              onAccept={onAccept}
              onReject={() => onReject(rejectReason.trim() || null)}
              onCancel={() => onCancel(cancelReason.trim())}
              onComplete={onComplete}
            />

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-[#F8EDDF]">
                <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
                {t("orders.timeline")}
              </h3>
              {events.length === 0 ? (
                <p className="rounded-md border border-dashed border-[#3A3028] bg-[#18130F] p-4 text-sm text-[#91857A]">
                  {t("orders.emptyTimeline")}
                </p>
              ) : null}
              {events.map((event, index) => (
                <div
                  key={getRecordString(event, "id") || String(index)}
                  className="flex items-start justify-between gap-3 rounded-md border border-[#3A3028] bg-[#211A15] p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {humanizeStatus(
                        getRecordString(event, "type", t("orders.eventTypeFallback"))
                      )}
                    </p>
                    <p className="mt-1 text-xs text-[#91857A]">
                      {getRecordString(
                        event,
                        "actorType",
                        t("orders.eventActorFallback")
                      )}
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
