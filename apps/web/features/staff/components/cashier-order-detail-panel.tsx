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
    return { label: "Print failed", variant: "danger" as const };
  }

  if (statuses.includes("pending") || statuses.includes("printing")) {
    return { label: "Print pending", variant: "warning" as const };
  }

  if (statuses.includes("printed")) {
    return { label: "Printed", variant: "success" as const };
  }

  return { label: "No print job", variant: "muted" as const };
}

function getCashierDisabledReason(
  status: string | undefined,
  progressStep: string,
  nextExpectedRole: string
) {
  const details = [
    status ? `status ${humanizeStatus(status)}` : "",
    progressStep ? `progress ${humanizeStatus(progressStep)}` : "",
    nextExpectedRole ? `next expected role ${humanizeStatus(nextExpectedRole)}` : ""
  ].filter(Boolean);

  if (details.length === 0) {
    return "Cashier actions will unlock when the backend exposes the next lifecycle step.";
  }

  return `Cashier actions are locked for ${details.join(", ")}.`;
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
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const status = order ? getOrderStatus(order) : undefined;
  const totals = order ? getOrderTotals(order) : undefined;
  const items = order ? getOrderItems(order) : [];
  const events = order ? getOrderEvents(order) : [];
  const kitchenTickets = order ? getOrderKitchenTickets(order) : [];
  const canAccept = order ? orderAllowsAction(order, "accept") : false;
  const canReject = order ? orderAllowsAction(order, "reject") : false;
  const canCancel = order ? orderAllowsAction(order, "cancel") : false;
  const canComplete = order ? orderAllowsAction(order, "complete") : false;
  const progressStep = order ? getOrderProgressStep(order) : "";
  const nextExpectedRole = order ? getOrderNextExpectedRole(order) : "";
  const disabledReason = getCashierDisabledReason(
    status,
    progressStep,
    nextExpectedRole
  );

  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Order detail</CardTitle>
            <CardDescription>
              Inspect the returned backend order before making a cashier
              decision.
            </CardDescription>
          </div>
          {status ? <CashierOrderStatusPill status={status} /> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!order && !isLoading && !error ? (
          <EmptyState
            title="Select an order"
            description="Choose an order from the queue to inspect items, notes, events, and cashier actions."
          />
        ) : null}
        {isLoading ? <LoadingState label="Loading order detail" /> : null}
        {error ? (
          <EmptyState
            title="Order detail could not load"
            description={formatErrorMessage(error)}
          />
        ) : null}
        {order ? (
          <>
            <div className="rounded-card border bg-surface/75 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-foreground">
                    {getOrderNumber(order)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {getTableLabel(getOrderTable(order), getOrderFloor(order))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">
                    {formatMoney(getMinorTotal(totals), getCurrency(totals))}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getRecordNumber(totals, "itemCount")} items /{" "}
                    {getRecordNumber(totals, "totalQuantity")} qty
                  </p>
                </div>
              </div>
              <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="size-3.5" aria-hidden="true" />
                Submitted {formatDateTime(getOrderSubmittedAt(order))}
              </p>
              {getOrderCustomerNote(order) ? (
                <div className="mt-4 rounded-card border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
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
                      Next: {humanizeStatus(nextExpectedRole)}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>

            <section className="grid gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ListChecks className="size-4 text-primary" aria-hidden="true" />
                Items
              </h3>
              {items.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No item rows were returned for this order.
                </p>
              ) : null}
              {items.map((item, index) => {
                const modifiers = getRecordArray(item.modifierOptions);
                const itemName =
                  getRecordString(item, "itemNameSnapshot") ||
                  `Item ${index + 1}`;

                return (
                  <div
                    key={getRecordString(item, "id") || itemName}
                    className="rounded-card border bg-surface/75 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {itemName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Qty {getRecordNumber(item, "quantity", 1)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-foreground">
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
                            className="rounded-button border bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                          >
                            {getRecordString(
                              modifier,
                              "modifierOptionNameSnapshot",
                              "Modifier"
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
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ClipboardList className="size-4 text-primary" aria-hidden="true" />
                Kitchen tickets
              </h3>
              {kitchenTickets.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  Ticket rows appear here after the order is accepted and routed
                  to barista, kitchen, or dessert stations.
                </p>
              ) : null}
              {kitchenTickets.map((ticket, index) => {
                const ticketStatus = getTicketStatus(ticket);
                const printSummary = getTicketPrintSummary(ticket);

                return (
                  <div
                    key={getRecordString(ticket, "id") || String(index)}
                    className="rounded-card border bg-surface/75 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {getTicketDisplayCode(ticket)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {humanizeStatus(getTicketStation(ticket))} /{" "}
                          {getTicketLocationLabel(ticket)}
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <Badge variant={getTicketStatusVariant(ticketStatus)}>
                          {humanizeStatus(ticketStatus)}
                        </Badge>
                        <Badge variant={printSummary.variant}>
                          <Printer className="mr-1 size-3" aria-hidden="true" />
                          {printSummary.label}
                        </Badge>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {getTicketItems(ticket).length} ticket item
                      {getTicketItems(ticket).length === 1 ? "" : "s"}
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
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <AlertTriangle className="size-4 text-primary" aria-hidden="true" />
                Timeline
              </h3>
              {events.length === 0 ? (
                <p className="rounded-card border border-dashed bg-surface/70 p-4 text-sm text-muted-foreground">
                  No order events were returned yet.
                </p>
              ) : null}
              {events.map((event, index) => (
                <div
                  key={getRecordString(event, "id") || String(index)}
                  className="flex items-start justify-between gap-3 rounded-card border bg-surface/75 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {humanizeStatus(getRecordString(event, "type", "event"))}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getRecordString(event, "actorType", "system")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
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
