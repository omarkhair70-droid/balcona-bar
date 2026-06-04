"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { BellRing, Droplets, HelpCircle, ReceiptText, Sparkles } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createWaiterCall,
  getBill,
  getWaiterCalls,
  requestBill
} from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { WaiterCallPayload } from "@/lib/api/types";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney, getRecordString } from "../customer-format";
import { ServiceActionCard } from "../service-action-card";

type CustomerServicePageProps = {
  sessionId: string;
};

const serviceActions: Array<{
  title: string;
  description: string;
  actionLabel: string;
  payload: WaiterCallPayload;
  icon: ReactNode;
}> = [
  {
    title: "Call waiter",
    description: "Let the team know you need service at the table.",
    actionLabel: "Call",
    payload: { type: "call_waiter", priority: 2 },
    icon: <BellRing className="size-6" aria-hidden="true" />
  },
  {
    title: "Water",
    description: "Ask for water without leaving the table experience.",
    actionLabel: "Request water",
    payload: { type: "need_water", priority: 1 },
    icon: <Droplets className="size-6" aria-hidden="true" />
  },
  {
    title: "Need help",
    description: "For questions, special requests, or order help.",
    actionLabel: "Ask for help",
    payload: { type: "need_help", priority: 2 },
    icon: <HelpCircle className="size-6" aria-hidden="true" />
  }
];

function getRecords(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    );
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecord(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function getRecordNumber(
  record: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
) {
  const value = record?.[key];

  return typeof value === "number" ? value : fallback;
}

export function CustomerServicePage({ sessionId }: CustomerServicePageProps) {
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const waiterCallsQuery = useQuery({
    queryKey: customerQueryKeys.waiterCalls(sessionId),
    queryFn: () => getWaiterCalls(sessionId, token),
    staleTime: 10_000
  });
  const billQuery = useQuery({
    queryKey: customerQueryKeys.bill(sessionId),
    queryFn: () => getBill(sessionId, token),
    staleTime: 10_000
  });
  const callMutation = useMutation({
    mutationFn: (payload: WaiterCallPayload) =>
      createWaiterCall(sessionId, payload, token),
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.waiterCalls(sessionId)
      });
    },
    onError: () => vibrateWarning()
  });
  const billMutation = useMutation({
    mutationFn: () => requestBill(sessionId, {}, token),
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
    },
    onError: () => vibrateWarning()
  });
  const waiterCalls = getRecords(
    waiterCallsQuery.data?.waiterCalls ?? waiterCallsQuery.data?.calls
  );
  const activeBillRequest = getRecord(billQuery.data?.activeBillRequest);
  const activeBillEnvelope = getRecord(billQuery.data?.activeBill);
  const activeBillRecord =
    getRecord(activeBillEnvelope?.bill) ?? getRecord(billQuery.data?.bill);
  const activeBillLines = getRecords(
    activeBillEnvelope?.lines ?? billQuery.data?.lines
  );
  const activeBillReceipt =
    getRecord(activeBillEnvelope?.receipt) ?? getRecord(billQuery.data?.receipt);
  const billTotals = getRecord(billQuery.data?.totals);
  const billOrderCount = getRecordNumber(billTotals, "orderCount");
  const billSubtotalMinor = getRecordNumber(billTotals, "subtotalMinor");
  const billCurrency = getRecordString(billTotals, "currency", "EGP");
  const activeBillStatus = getRecordString(
    activeBillRequest,
    "status",
    "active"
  ).replaceAll("_", " ");
  const activeBillLifecycleStatus = getRecordString(
    activeBillRecord,
    "status",
    ""
  ).replaceAll("_", " ");
  const activeBillNumber = getRecordString(
    activeBillRecord,
    "billNumber",
    "current bill"
  );
  const activeBillTotalMinor = getRecordNumber(
    activeBillRecord,
    "totalMinor",
    billSubtotalMinor
  );
  const activeBillBalanceDueMinor = getRecordNumber(
    activeBillRecord,
    "balanceDueMinor",
    activeBillTotalMinor
  );
  const hasNoBillableOrders = billQuery.isSuccess && billOrderCount === 0;
  const isBillRequestDisabled =
    billMutation.isPending ||
    Boolean(activeBillRequest) ||
    Boolean(activeBillRecord) ||
    hasNoBillableOrders;
  const billSummary = `${billOrderCount} billable order${
    billOrderCount === 1 ? "" : "s"
  } totaling ${formatMoney(billSubtotalMinor, billCurrency)}.`;
  const billStateDescription = activeBillRecord
    ? `${activeBillNumber} is ${activeBillLifecycleStatus || "being prepared"} with ${formatMoney(
        activeBillBalanceDueMinor,
        billCurrency
      )} remaining.`
    : activeBillRequest
      ? `Active bill request: ${activeBillStatus}.`
      : hasNoBillableOrders
        ? "The bill will be available after your order is accepted or served."
        : billQuery.data
          ? billSummary
          : "No bill request is active yet.";
  const billButtonLabel = billMutation.isPending
    ? "Requesting..."
    : activeBillReceipt
      ? "Receipt ready"
      : activeBillRecord
        ? "Bill in progress"
        : activeBillRequest
      ? "Bill requested"
      : hasNoBillableOrders
        ? "Not available yet"
        : "Request bill";
  const billButtonVariant =
    activeBillRequest || hasNoBillableOrders ? "secondary" : "primary";

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow="Service"
      title="Ask the team without leaving your table"
      description="Call a waiter, ask for help, request water, or ask for the bill. The UI keeps active requests visible to prevent noisy repeats."
    >
      <div className="mb-5 rounded-card border border-primary/40 bg-primary/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 size-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Ask AI waiter first
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get menu-grounded help, then ask a human waiter here whenever
                you prefer.
              </p>
            </div>
          </div>
          <Link
            href={`/customer/session/${sessionId}/ai-waiter`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Open AI waiter
          </Link>
        </div>
      </div>
      <section className="grid gap-4 md:grid-cols-3">
        {serviceActions.map((action) => (
          <ServiceActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            actionLabel={action.actionLabel}
            icon={action.icon}
            pending={
              callMutation.isPending &&
              callMutation.variables?.type === action.payload.type
            }
            onAction={() => callMutation.mutate(action.payload)}
          />
        ))}
      </section>
      {callMutation.isError ? (
        <div
          role="alert"
          className="mt-4 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
        >
          We could not send that service request. Please try again from the
          table. {callMutation.error.message}
        </div>
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>Recent service calls</CardTitle>
            <CardDescription>
              Latest table requests returned by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {waiterCallsQuery.isPending ? <LoadingState label="Loading calls" /> : null}
            {waiterCallsQuery.isError ? (
              <EmptyState
                title="Service calls could not load"
                description={waiterCallsQuery.error.message}
              />
            ) : null}
            {waiterCalls.length === 0 && waiterCallsQuery.isSuccess ? (
              <EmptyState
                title="No active calls"
                description="The team has no pending request from this table."
              />
            ) : null}
            {waiterCalls.slice(0, 5).map((call, index) => (
              <div key={`${String(call.id ?? index)}`} className="rounded-card border bg-surface/75 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {String(call.type ?? "Service request")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {String(call.status ?? "open")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="text-primary">
              <ReceiptText className="size-6" aria-hidden="true" />
            </div>
            <CardTitle>Bill request</CardTitle>
            <CardDescription>
              Ask for the bill when your table is ready. Existing bill state is
              shown when the backend returns it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {billQuery.isPending ? <LoadingState label="Loading bill" /> : null}
            {billQuery.isError ? (
              <EmptyState title="Bill could not load" description={billQuery.error.message} />
            ) : null}
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                Current bill state
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {billStateDescription}
              </p>
              {activeBillRequest ? (
                <div className="mt-3 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
                  Your bill request is already active. Status:{" "}
                  {activeBillStatus}.
                </div>
              ) : null}
              {activeBillRecord ? (
                <div className="mt-3 rounded-card border bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {activeBillNumber}
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {formatMoney(activeBillTotalMinor, billCurrency)}
                    </p>
                  </div>
                  {activeBillLines.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {activeBillLines.map((line, index) => (
                        <div
                          key={String(line.id ?? `bill-line-${index}`)}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <p className="text-foreground">
                            {getRecordNumber(line, "quantity", 1)} x{" "}
                            {getRecordString(
                              line,
                              "itemNameSnapshot",
                              "Menu item"
                            )}
                          </p>
                          <p className="shrink-0 font-semibold text-foreground">
                            {formatMoney(
                              getRecordNumber(line, "lineTotalMinor"),
                              getRecordString(line, "currency", billCurrency)
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 rounded-card border bg-surface/70 p-3 text-xs text-muted-foreground">
                    Balance due:{" "}
                    <span className="font-semibold text-foreground">
                      {formatMoney(activeBillBalanceDueMinor, billCurrency)}
                    </span>
                    . Payment is handled with the cashier at the table.
                  </div>
                </div>
              ) : null}
              {activeBillReceipt ? (
                <div className="mt-3 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
                  Receipt{" "}
                  {getRecordString(activeBillReceipt, "receiptNumber", "ready")}{" "}
                  is ready. Thank you.
                </div>
              ) : null}
              {hasNoBillableOrders ? (
                <div className="mt-3 rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
                  The bill will be available after your order is accepted or
                  served.
                </div>
              ) : null}
              {billMutation.isError ? (
                <div
                  role="alert"
                  className="mt-3 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  We could not request the bill yet. The bill may not be
                  available until your order is accepted or served.{" "}
                  {billMutation.error.message}
                </div>
              ) : null}
              <Button
                className="mt-4"
                onClick={() => billMutation.mutate()}
                disabled={isBillRequestDisabled}
                variant={billButtonVariant}
              >
                {billButtonLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </CustomerSessionScreen>
  );
}
