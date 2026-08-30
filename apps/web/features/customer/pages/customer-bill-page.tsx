"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  Clock3,
  CreditCard,
  ReceiptText,
  RefreshCw
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createOnlinePaymentIntent,
  getBill,
  getCustomerOnlinePaymentIntent,
  requestBill
} from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney } from "../customer-format";

type CustomerBillPageProps = {
  sessionId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown) {
  return isRecord(value) ? value : undefined;
}

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter(isRecord)
    : [];
}

function stringValue(value: Record<string, unknown> | undefined, key: string) {
  return typeof value?.[key] === "string" ? value[key] : "";
}

function numberValue(
  value: Record<string, unknown> | undefined,
  key: string,
  fallback = 0
) {
  return typeof value?.[key] === "number" ? value[key] : fallback;
}

export function CustomerBillPage({ sessionId }: CustomerBillPageProps) {
  const t = useTranslations("customer");
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const tableCode = useCustomerSessionStore((state) => state.tableCode);

  const billQuery = useQuery({
    queryKey: customerQueryKeys.bill(sessionId),
    queryFn: () => getBill(sessionId, token),
    enabled: Boolean(token),
    staleTime: 5_000,
    refetchInterval: 8_000
  });

  const billRequest = record(billQuery.data?.activeBillRequest);
  const billEnvelope = record(billQuery.data?.activeBill);
  const bill = record(billEnvelope?.bill) ?? record(billQuery.data?.bill);
  const receipt =
    record(billEnvelope?.receipt) ?? record(billQuery.data?.receipt);
  const lines = records(billEnvelope?.lines ?? billQuery.data?.lines);
  const totals = record(billQuery.data?.totals);
  const currency =
    stringValue(bill, "currency") || stringValue(totals, "currency") || "EGP";
  const orderCount = numberValue(totals, "orderCount");
  const totalMinor = numberValue(
    bill,
    "totalMinor",
    numberValue(totals, "subtotalMinor")
  );
  const balanceMinor = numberValue(bill, "balanceDueMinor", totalMinor);
  const billId = stringValue(bill, "id");
  const billNumber = stringValue(bill, "billNumber");
  const billStatus = stringValue(bill, "status").toLowerCase();

  const persistedIntents = records(
    billEnvelope?.onlinePaymentIntents ??
      bill?.onlinePaymentIntents ??
      billQuery.data?.onlinePaymentIntents
  );
  const latestPersistedIntent =
    persistedIntents[persistedIntents.length - 1];

  const requestMutation = useMutation({
    mutationFn: () => requestBill(sessionId, {}, token),
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
    },
    onError: () => vibrateWarning()
  });

  const paymentMutation = useMutation({
    mutationFn: () => createOnlinePaymentIntent(sessionId, billId, {}, token),
    onSuccess: (result) => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
      const created = record(result.onlinePaymentIntent);
      const provider = (
        stringValue(created, "provider") || result.checkout?.provider || ""
      ).toLowerCase();
      const checkoutUrl =
        result.checkout?.url ?? stringValue(created, "providerCheckoutUrl");

      if (checkoutUrl && provider !== "mock") {
        window.location.assign(checkoutUrl);
      }
    },
    onError: () => vibrateWarning()
  });

  const mutationIntent = record(paymentMutation.data?.onlinePaymentIntent);
  const latestIntent = mutationIntent ?? latestPersistedIntent;
  const latestIntentId = stringValue(latestIntent, "id");
  const latestIntentStatus = stringValue(latestIntent, "status").toLowerCase();

  const intentQuery = useQuery({
    queryKey: customerQueryKeys.onlinePaymentIntent(sessionId, latestIntentId),
    queryFn: () =>
      getCustomerOnlinePaymentIntent(sessionId, latestIntentId, token),
    enabled:
      Boolean(token) &&
      Boolean(latestIntentId) &&
      ["pending", "requires_action", "processing", "unknown"].includes(
        latestIntentStatus
      ),
    refetchInterval: 5_000,
    staleTime: 2_000
  });

  const refreshedIntent = record(intentQuery.data?.onlinePaymentIntent);
  const currentIntent = refreshedIntent ?? latestIntent;
  const intentStatus = stringValue(currentIntent, "status").toLowerCase();
  const provider = (
    stringValue(currentIntent, "provider") ||
    paymentMutation.data?.checkout?.provider ||
    ""
  ).toLowerCase();
  const checkoutUrl =
    paymentMutation.data?.checkout?.url ??
    stringValue(currentIntent, "providerCheckoutUrl");
  const isHostedCheckout = Boolean(checkoutUrl) && provider !== "mock";

  const isPaid =
    Boolean(receipt) ||
    ["paid", "closed"].includes(billStatus) ||
    intentStatus === "succeeded";
  const isUnknown = [
    "unknown",
    "processing",
    "pending_verification",
    "requires_review"
  ].includes(intentStatus);
  const isPaymentPending =
    !isPaid &&
    (billStatus === "payment_pending" ||
      ["pending", "requires_action"].includes(intentStatus));
  const isPresented =
    Boolean(bill) &&
    ["presented", "payment_pending"].includes(billStatus);
  const canStartPayment =
    isPresented &&
    !isPaid &&
    (!latestIntent ||
      ["failed", "cancelled", "canceled", "expired"].includes(intentStatus));
  const isBillPreparing = Boolean(bill) && !isPresented && !isPaid;
  const isRequested = Boolean(billRequest) && !bill;
  const hasNoBillableOrders = billQuery.isSuccess && orderCount === 0 && !bill;
  const canRequest =
    billQuery.isSuccess &&
    orderCount > 0 &&
    !billRequest &&
    !bill &&
    !receipt &&
    !requestMutation.isSuccess;

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="bill"
      eyebrow={t("bill.eyebrow")}
      title={t("bill.pageTitle")}
      description={t("bill.description")}
    >
      {billQuery.isPending ? <LoadingState label={t("service.loadingBill")} /> : null}

      {billQuery.isError ? (
        <EmptyState
          title={t("errors.billLoad")}
          description={t("errors.tryAgain")}
        />
      ) : null}

      {billQuery.isSuccess ? (
        <section className="pb-8">
          {hasNoBillableOrders ? (
            <div className="rounded-[26px] border border-border bg-card p-5">
              <ReceiptText className="size-6 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-foreground">
                {t("bill.notAvailableYet")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("bill.billNotAvailable")}
              </p>
            </div>
          ) : null}

          {canRequest ? (
            <div className="rounded-[26px] border border-border bg-card p-5">
              <ReceiptText className="size-6 text-primary" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-foreground">
                {t("bill.readyWhenYouAre")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("bill.readyDescription")}
              </p>
              <Button
                onClick={() => requestMutation.mutate()}
                disabled={requestMutation.isPending}
                className="mt-5 min-h-12 w-full rounded-2xl"
              >
                {requestMutation.isPending
                  ? t("bill.requesting")
                  : t("bill.requestBill")}
              </Button>
            </div>
          ) : null}

          {isRequested ? (
            <div className="rounded-[26px] border border-warning/35 bg-muted p-5">
              <Clock3 className="size-6 text-warning" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-black text-foreground">
                {t("bill.billRequested")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("bill.requestedDescription")}
              </p>
              <Button
                variant="secondary"
                onClick={() => void billQuery.refetch()}
                className="mt-4"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t("bill.checkAgain")}
              </Button>
            </div>
          ) : null}

          {bill ? (
            <div className="rounded-[26px] border border-border bg-card p-5">
              {isBillPreparing ? (
                <div className="mb-5 rounded-2xl bg-muted p-4">
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-black text-foreground">
                        {t("bill.preparingBillTitle")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("bill.preparingBillDescription")}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {isUnknown ? (
                <div className="mb-5 rounded-2xl border border-danger/35 bg-danger/10 p-4">
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-black text-foreground">
                        {t("bill.unknownTitle")}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {t("bill.unknownDescription")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void intentQuery.refetch()}
                    className="mt-3 w-full"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("bill.checkPayment")}
                  </Button>
                </div>
              ) : null}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-muted-foreground">
                    {billNumber || t("bill.currentBillFallback")}
                  </p>
                  <h2 className="mt-1 text-xl font-black text-foreground">
                    {tableCode
                      ? t("bill.tableTitle", { table: tableCode })
                      : t("bill.yourTable")}
                  </h2>
                </div>
                <strong className="text-2xl font-black text-foreground">
                  {formatMoney(totalMinor, currency)}
                </strong>
              </div>

              {lines.length > 0 ? (
                <div className="mt-5 divide-y divide-border border-y border-border">
                  {lines.map((line, index) => (
                    <div key={String(line.id ?? index)} className="flex justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0 text-muted-foreground">
                        {numberValue(line, "quantity", 1)}×{" "}
                        {stringValue(line, "itemNameSnapshot") ||
                          t("bill.billLineFallback")}
                      </span>
                      <strong className="shrink-0 text-foreground">
                        {formatMoney(
                          numberValue(line, "lineTotalMinor"),
                          stringValue(line, "currency") || currency
                        )}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}

              {!isPaid && balanceMinor > 0 ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {t("bill.balanceDue", {
                    price: formatMoney(balanceMinor, currency)
                  })}
                </p>
              ) : null}

              {isPaid ? (
                <div className="mt-5 rounded-2xl bg-success/10 p-4 text-center">
                  <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-success text-white">
                    <Check className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-black text-foreground">
                    {t("bill.paymentComplete")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {receipt
                      ? t("bill.receiptReadyMessage", {
                          receiptNumber:
                            stringValue(receipt, "receiptNumber") ||
                            t("bill.receiptReady")
                        })
                      : t("bill.paymentCompleteDescription")}
                  </p>
                </div>
              ) : null}

              {canStartPayment ? (
                <Button
                  onClick={() => paymentMutation.mutate()}
                  disabled={paymentMutation.isPending || !billId}
                  className="mt-5 min-h-14 w-full rounded-2xl"
                >
                  <CreditCard className="size-4" aria-hidden="true" />
                  {paymentMutation.isPending
                    ? t("bill.preparingCheckout")
                    : t("bill.payOnline")}
                </Button>
              ) : null}

              {isPaymentPending && !isUnknown && !isPaid ? (
                <div className="mt-5 rounded-2xl bg-muted p-4 text-center">
                  <Clock3 className="mx-auto size-5 text-primary" aria-hidden="true" />
                  <p className="mt-2 text-sm font-black text-foreground">
                    {t("bill.paymentPending")}
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                    {t("bill.paymentPendingDescription")}
                  </p>
                  {isHostedCheckout ? (
                    <a
                      href={checkoutUrl}
                      className={`${buttonVariants()} mt-3 min-h-11 w-full rounded-xl`}
                    >
                      {t("bill.continuePayment")}
                    </a>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => void billQuery.refetch()}
                      className="mt-3 w-full"
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {t("bill.checkPayment")}
                    </Button>
                  )}
                </div>
              ) : null}

              {paymentMutation.isError ? (
                <div role="alert" className="mt-4 rounded-xl border border-warning/35 bg-warning/10 p-3 text-sm text-foreground">
                  {t("bill.paymentUnavailable")}
                </div>
              ) : null}
            </div>
          ) : null}

          {requestMutation.isError ? (
            <div role="alert" className="mt-4 rounded-xl border border-danger/35 bg-danger/10 p-3 text-sm text-danger">
              {t("bill.requestErrorSimple")}
            </div>
          ) : null}
        </section>
      ) : null}
    </CustomerSessionScreen>
  );
}
