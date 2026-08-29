"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import {
  BellRing,
  CreditCard,
  Droplets,
  HelpCircle,
  ReceiptText,
  Sparkles
} from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createOnlinePaymentIntent,
  createWaiterCall,
  getBill,
  getWaiterCalls,
  mockSucceedOnlinePayment,
  requestBill
} from "@/lib/api/endpoints";
import { formatErrorMessage } from "@/lib/api/error-message";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { WaiterCallPayload } from "@/lib/api/types";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney, getRecordString } from "../customer-format";
import { ServiceActionCard } from "../service-action-card";

type CustomerServicePageProps = {
  sessionId: string;
};

const serviceActions: Array<{
  titleKey: string;
  descriptionKey: string;
  actionLabelKey: string;
  payload: WaiterCallPayload;
  icon: ReactNode;
}> = [
  {
    titleKey: "service.callTitle",
    descriptionKey: "service.callDescription",
    actionLabelKey: "service.callAction",
    payload: { type: "call_waiter", priority: 2 },
    icon: <BellRing className="size-6" aria-hidden="true" />
  },
  {
    titleKey: "service.waterTitle",
    descriptionKey: "service.waterDescription",
    actionLabelKey: "service.waterAction",
    payload: { type: "need_water", priority: 1 },
    icon: <Droplets className="size-6" aria-hidden="true" />
  },
  {
    titleKey: "service.helpTitle",
    descriptionKey: "service.helpDescription",
    actionLabelKey: "service.helpAction",
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
  const t = useTranslations("customer");
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
  const onlinePaymentMutation = useMutation({
    mutationFn: (billId: string) =>
      createOnlinePaymentIntent(sessionId, billId, {}, token),
    onSuccess: (result) => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
      const intent = getRecord(result.onlinePaymentIntent);
      const intentId = getRecordString(intent, "id", "");

      if (intentId) {
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.onlinePaymentIntent(sessionId, intentId)
        });
      }
    },
    onError: () => vibrateWarning()
  });
  const mockOnlinePaymentMutation = useMutation({
    mutationFn: (intentId: string) => mockSucceedOnlinePayment(intentId, token),
    onSuccess: (result) => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
      const intent = getRecord(result.onlinePaymentIntent);
      const intentId = getRecordString(intent, "id", "");

      if (intentId) {
        void queryClient.invalidateQueries({
          queryKey: customerQueryKeys.onlinePaymentIntent(sessionId, intentId)
        });
      }
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
  const billHasResolvedState = Boolean(
    activeBillRequest || activeBillRecord || activeBillReceipt
  );
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
  const activeBillRawStatus = getRecordString(activeBillRecord, "status", "");
  const activeBillId = getRecordString(activeBillRecord, "id", "");
  const activeBillNumber = getRecordString(
    activeBillRecord,
    "billNumber",
    t("bill.currentBillFallback")
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
  const activeOnlinePaymentIntents = getRecords(
    activeBillEnvelope?.onlinePaymentIntents ??
      activeBillRecord?.onlinePaymentIntents ??
      billQuery.data?.onlinePaymentIntents
  );
  const latestOnlinePaymentIntent =
    activeOnlinePaymentIntents[activeOnlinePaymentIntents.length - 1];
  const latestOnlinePaymentId = getRecordString(
    latestOnlinePaymentIntent,
    "id",
    ""
  );
  const latestOnlinePaymentStatus = getRecordString(
    latestOnlinePaymentIntent,
    "status",
    ""
  );
  const latestOnlinePaymentProvider = getRecordString(
    latestOnlinePaymentIntent,
    "provider",
    "mock"
  );
  const latestOnlinePaymentCheckoutUrl = getRecordString(
    latestOnlinePaymentIntent,
    "providerCheckoutUrl",
    ""
  );
  const hasActiveOnlinePayment =
    latestOnlinePaymentStatus === "pending" ||
    latestOnlinePaymentStatus === "requires_action";
  const hasSucceededOnlinePayment = latestOnlinePaymentStatus === "succeeded";
  const hasNoBillableOrders = billQuery.isSuccess && billOrderCount === 0;
  const isBillRequestDisabled =
    billMutation.isPending ||
    Boolean(activeBillRequest) ||
    Boolean(activeBillRecord) ||
    hasNoBillableOrders;
  const billSummary = t(
    billOrderCount === 1 ? "bill.billSummaryOne" : "bill.billSummary",
    {
      count: billOrderCount,
      price: formatMoney(billSubtotalMinor, billCurrency)
    }
  );
  const billStateDescription = activeBillRecord
    ? activeBillLifecycleStatus
      ? t("bill.stateWithBalance", {
          billNumber: activeBillNumber,
          status: activeBillLifecycleStatus,
          price: formatMoney(activeBillBalanceDueMinor, billCurrency)
        })
      : t("bill.stateWithFallback", {
          billNumber: activeBillNumber,
          price: formatMoney(activeBillBalanceDueMinor, billCurrency)
        })
    : activeBillRequest
      ? t("bill.activeBillRequest", { status: activeBillStatus })
      : hasNoBillableOrders
        ? t("bill.billNotAvailable")
        : billQuery.data
          ? billSummary
          : t("bill.noActiveRequest");
  const billButtonLabel = billMutation.isPending
    ? t("bill.requesting")
    : activeBillReceipt
      ? t("bill.receiptReady")
      : activeBillRecord
        ? t("bill.billInProgress")
        : activeBillRequest
      ? t("bill.billRequested")
      : hasNoBillableOrders
        ? t("bill.notAvailableYet")
        : t("bill.requestBill");
  const billButtonVariant =
    activeBillRequest || hasNoBillableOrders ? "secondary" : "primary";
  const showBillRequestError =
    billMutation.isError &&
    !activeBillReceipt &&
    !activeBillRecord &&
    !activeBillRequest;
  const canPayOnline =
    Boolean(activeBillId) &&
    !activeBillReceipt &&
    activeBillBalanceDueMinor > 0 &&
    (activeBillRawStatus === "presented" ||
      activeBillRawStatus === "payment_pending");
  const onlinePaymentButtonLabel = onlinePaymentMutation.isPending
    ? t("bill.preparingCheckout")
    : hasActiveOnlinePayment
      ? t("bill.checkoutReady")
      : t("bill.payOnline");
  const mockSettleButtonLabel = mockOnlinePaymentMutation.isPending
    ? t("bill.confirming")
    : t("bill.confirmMockPayment");

  useEffect(() => {
    if (billHasResolvedState && billMutation.isError) {
      billMutation.reset();
    }
  }, [billHasResolvedState, billMutation]);

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow={t("service.eyebrow")}
      title={t("service.title")}
      description={t("service.description")}
    >
      <div className="mb-4 min-w-0 rounded-[18px] border border-border bg-muted p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {t("service.aiHelpTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("service.aiHelpDescription")}
              </p>
            </div>
          </div>
          <Link
            href={`/customer/session/${sessionId}/ai-waiter`}
            className={`${buttonVariants({ variant: "secondary" })} max-w-[42%] shrink-0 whitespace-normal text-center`}
          >
            {t("actions.openAiWaiter")}
          </Link>
        </div>
      </div>
      <section className="grid min-w-0 gap-3">
        {serviceActions.map((action) => (
          <ServiceActionCard
            key={action.titleKey}
            title={t(action.titleKey)}
            description={t(action.descriptionKey)}
            actionLabel={t(action.actionLabelKey)}
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
          {t("errors.serviceRequest", {
            message: formatErrorMessage(callMutation.error)
          })}
          <div className="mt-3">
            <CopyDebugReportButton
              action="waiter_call_create"
              flow="customer_service"
              sessionId={sessionId}
              error={callMutation.error}
            />
          </div>
        </div>
      ) : null}

      <section className="mt-5 grid min-w-0 gap-4">
        <Card variant="glass" padding="lg" className="min-w-0">
          <CardHeader>
            <CardTitle>{t("service.recentCallsTitle")}</CardTitle>
            <CardDescription>
              {t("service.recentCallsDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-3">
            {waiterCallsQuery.isPending ? (
              <LoadingState label={t("service.loadingCalls")} />
            ) : null}
            {waiterCallsQuery.isError ? (
              <EmptyState
                title={t("errors.serviceCallsLoad")}
                description={formatErrorMessage(waiterCallsQuery.error)}
                debug={{
                  action: "waiter_call_list",
                  flow: "customer_service",
                  sessionId,
                  error: waiterCallsQuery.error
                }}
              />
            ) : null}
            {waiterCalls.length === 0 && waiterCallsQuery.isSuccess ? (
              <EmptyState
                title={t("empty.serviceCallsTitle")}
                description={t("empty.serviceCallsDescription")}
              />
            ) : null}
            {waiterCalls.slice(0, 5).map((call, index) => (
              <div key={`${String(call.id ?? index)}`} className="rounded-[18px] border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">
                  {String(call.type ?? t("service.requestFallback"))}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {String(call.status ?? "open")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="bill" variant="glass" padding="lg" className="min-w-0 scroll-mt-20">
          <CardHeader>
            <div className="text-primary">
              <ReceiptText className="size-6" aria-hidden="true" />
            </div>
            <CardTitle>{t("bill.title")}</CardTitle>
            <CardDescription>
              {t("bill.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-4">
            {billQuery.isPending ? (
              <LoadingState label={t("service.loadingBill")} />
            ) : null}
            {billQuery.isError ? (
              <EmptyState
                title={t("errors.billLoad")}
                description={formatErrorMessage(billQuery.error)}
                debug={{
                  action: "bill_get",
                  flow: "customer_billing",
                  sessionId,
                  error: billQuery.error
                }}
              />
            ) : null}
            <div className="rounded-[18px] border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("bill.currentBillState")}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {billStateDescription}
              </p>
              {activeBillRequest ? (
                <div className="mt-3 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
                  {t("bill.yourRequestActive", { status: activeBillStatus })}
                </div>
              ) : null}
              {activeBillRecord ? (
                <div className="mt-3 min-w-0 rounded-xl border border-border bg-background/40 p-3">
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
                          className="flex min-w-0 items-start justify-between gap-3 text-sm"
                        >
                          <p className="min-w-0 break-words text-foreground">
                            {getRecordNumber(line, "quantity", 1)} x{" "}
                            {getRecordString(
                              line,
                              "itemNameSnapshot",
                              t("bill.billLineFallback")
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
                  <div className="mt-3 rounded-xl border border-border bg-muted p-3 text-xs text-muted-foreground">
                    {t("bill.balanceDue", {
                      price: formatMoney(activeBillBalanceDueMinor, billCurrency)
                    })}{" "}
                    {t("bill.cashierManualPaymentAvailable")}
                  </div>
                  {canPayOnline ? (
                    <div className="mt-3 rounded-card border border-primary/35 bg-primary/10 p-3">
                      <div className="flex items-start gap-3">
                        <CreditCard
                          className="mt-0.5 size-5 text-primary"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground">
                            {t("bill.payOnline")}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("bill.payOnlineDescription")}
                          </p>
                          {latestOnlinePaymentIntent ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {t("bill.latestOnlinePayment", {
                                status: latestOnlinePaymentStatus.replaceAll(
                                  "_",
                                  " "
                                ),
                                provider: latestOnlinePaymentProvider
                                  ? t("bill.latestOnlinePaymentProvider", {
                                      provider: latestOnlinePaymentProvider
                                    })
                                  : ""
                              })}
                            </p>
                          ) : null}
                          {latestOnlinePaymentCheckoutUrl &&
                          hasActiveOnlinePayment ? (
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                              {t("bill.mockCheckoutUrl", {
                                url: latestOnlinePaymentCheckoutUrl
                              })}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="max-w-full whitespace-normal"
                              onClick={() => {
                                if (activeBillId) {
                                  onlinePaymentMutation.mutate(activeBillId);
                                }
                              }}
                              disabled={
                                onlinePaymentMutation.isPending ||
                                mockOnlinePaymentMutation.isPending ||
                                hasActiveOnlinePayment ||
                                hasSucceededOnlinePayment
                              }
                            >
                              {onlinePaymentButtonLabel}
                            </Button>
                            {hasActiveOnlinePayment && latestOnlinePaymentId ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  mockOnlinePaymentMutation.mutate(
                                    latestOnlinePaymentId
                                  )
                                }
                                disabled={mockOnlinePaymentMutation.isPending}
                              >
                                {mockSettleButtonLabel}
                              </Button>
                            ) : null}
                          </div>
                          {onlinePaymentMutation.isError ? (
                            <div
                              role="alert"
                              className="mt-3 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                            >
                              {t("bill.onlineCheckoutError", {
                                message: formatErrorMessage(
                                  onlinePaymentMutation.error
                                )
                              })}
                              <div className="mt-3">
                                <CopyDebugReportButton
                                  action="online_payment_intent_create"
                                  flow="customer_billing"
                                  sessionId={sessionId}
                                  error={onlinePaymentMutation.error}
                                />
                              </div>
                            </div>
                          ) : null}
                          {mockOnlinePaymentMutation.isError ? (
                            <div
                              role="alert"
                              className="mt-3 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                            >
                              {t("bill.mockPaymentError", {
                                message: formatErrorMessage(
                                  mockOnlinePaymentMutation.error
                                )
                              })}
                              <div className="mt-3">
                                <CopyDebugReportButton
                                  action="mock_online_payment_confirm"
                                  flow="customer_billing"
                                  sessionId={sessionId}
                                  error={mockOnlinePaymentMutation.error}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {hasSucceededOnlinePayment && !activeBillReceipt ? (
                    <div className="mt-3 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
                      {t("bill.onlineConfirmed")}
                    </div>
                  ) : null}
                </div>
              ) : null}
              {activeBillReceipt ? (
                <div className="mt-3 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
                  {t("bill.receiptReadyMessage", {
                    receiptNumber: getRecordString(
                      activeBillReceipt,
                      "receiptNumber",
                      t("bill.receiptReady")
                    )
                  })}
                </div>
              ) : null}
              {hasNoBillableOrders ? (
                <div className="mt-3 rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
                  {t("bill.billNotAvailable")}
                </div>
              ) : null}
              {showBillRequestError ? (
                <div
                  role="alert"
                  className="mt-3 rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
                >
                  {t("bill.requestError", {
                    message: formatErrorMessage(billMutation.error)
                  })}
                  <div className="mt-3">
                    <CopyDebugReportButton
                      action="bill_request_create"
                      flow="customer_billing"
                      sessionId={sessionId}
                      error={billMutation.error}
                    />
                  </div>
                </div>
              ) : null}
              <Button
                className="mt-4 max-w-full whitespace-normal"
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
