"use client";

import { useState } from "react";
import { AlertTriangle, Clock3, ListChecks } from "lucide-react";
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
  onAccept: () => void;
  onReject: (reason?: string | null) => void;
  onCancel: (reason: string) => void;
  onComplete: () => void;
};

export function CashierOrderDetailPanel({
  order,
  isLoading,
  error,
  acceptPending,
  rejectPending,
  cancelPending,
  completePending,
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
  const canAccept = order ? orderAllowsAction(order, "accept") : false;
  const canReject = order ? orderAllowsAction(order, "reject") : false;
  const canCancel = order ? orderAllowsAction(order, "cancel") : false;
  const canComplete = order ? orderAllowsAction(order, "complete") : false;
  const progressStep = order ? getOrderProgressStep(order) : "";
  const nextExpectedRole = order ? getOrderNextExpectedRole(order) : "";

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
            description={error.message}
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
