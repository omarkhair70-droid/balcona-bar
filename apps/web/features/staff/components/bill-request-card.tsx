"use client";

import { useState } from "react";
import { CheckCircle2, CreditCard, HandCoins, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBillId,
  getBillLines,
  getBillManualPayments,
  getBillNumber,
  getBillOnlinePaymentIntents,
  getBillReceipt,
  getBillRequestCreatedAt,
  getBillRequestId,
  getBillRequestFloor,
  getBillRequestRecord,
  getBillRequestStatus,
  getBillRequestTable,
  getBillStatus,
  getBillTotals,
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  formatMoney,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId,
} from "@/features/staff/staff-format";
import { formatErrorMessage } from "@/lib/api/error-message";
import type { RecordManualPaymentPayload } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type BillRequestCardProps = {
  billRequest: Record<string, unknown>;
  pendingActionId?: string;
  pendingPaymentId?: string;
  paymentBlockedReason?: string;
  paymentError?: Error;
  onAcknowledge: (billRequestId: string) => void;
  onPresent: (billRequestId: string) => void;
  onRecordManualPayment: (
    billId: string,
    payload: RecordManualPaymentPayload,
  ) => void;
};

const paymentMethods: Array<{
  value: RecordManualPaymentPayload["method"];
  labelKey: string;
}> = [
  { value: "cash", labelKey: "billRequests.cash" },
  { value: "card_pos", labelKey: "billRequests.cardPos" },
  { value: "wallet_manual", labelKey: "billRequests.wallet" },
  { value: "other", labelKey: "billRequests.other" },
];

function statusVariant(status?: string) {
  switch (status) {
    case "open":
    case "requested":
    case "payment_pending":
      return "warning";
    case "acknowledged":
    case "presented":
    case "paid":
      return "success";
    case "closed":
      return "muted";
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

function amountInputToMinor(value: string, fallbackMinor: number) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return fallbackMinor;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue * 100) : 0;
}

function minorToInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

export function BillRequestCard({
  billRequest,
  pendingActionId,
  pendingPaymentId,
  paymentBlockedReason,
  paymentError,
  onAcknowledge,
  onPresent,
  onRecordManualPayment,
}: BillRequestCardProps) {
  const t = useTranslations("staff");
  const request = getBillRequestRecord(billRequest);
  const billRequestId = getBillRequestId(billRequest);
  const billId = getBillId(billRequest);
  const requestStatus = getBillRequestStatus(billRequest);
  const billStatus = getBillStatus(billRequest);
  const displayStatus = billStatus || requestStatus;
  const table = getBillRequestTable(billRequest);
  const floor = getBillRequestFloor(billRequest);
  const totals = getBillTotals(billRequest);
  const lines = getBillLines(billRequest);
  const manualPayments = getBillManualPayments(billRequest);
  const onlinePaymentIntents = getBillOnlinePaymentIntents(billRequest);
  const receipt = getBillReceipt(billRequest);
  const currency = getRecordString(totals, "currency", "EGP");
  const subtotalMinor = getRecordNumber(
    totals,
    "subtotalMinor",
    getRecordNumber(request, "subtotalMinor"),
  );
  const totalMinor = getRecordNumber(totals, "totalMinor", subtotalMinor);
  const paidMinor = getRecordNumber(totals, "paidMinor");
  const balanceDueMinor = getRecordNumber(
    totals,
    "balanceDueMinor",
    totalMinor,
  );
  const orderCount = getRecordNumber(
    totals,
    "orderCount",
    getRecordNumber(request, "orderCount"),
  );
  const isPending = pendingActionId === billRequestId;
  const isPaymentPending = pendingPaymentId === billId;
  const canAcknowledge = Boolean(billRequestId) && requestStatus === "open";
  const canPresent =
    Boolean(billRequestId) &&
    (requestStatus === "open" || requestStatus === "acknowledged");
  const canRecordPayment =
    Boolean(billId) &&
    (billStatus === "presented" || billStatus === "payment_pending") &&
    balanceDueMinor > 0 &&
    !paymentBlockedReason;
  const [paymentMethod, setPaymentMethod] =
    useState<RecordManualPaymentPayload["method"]>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const paymentAmountMinor = amountInputToMinor(paymentAmount, balanceDueMinor);
  const paymentAmountMatchesBalance = paymentAmountMinor === balanceDueMinor;
  const activeOnlinePaymentCount = onlinePaymentIntents.filter((payment) => {
    const status = getRecordString(payment, "status");

    return status === "pending" || status === "requires_action";
  }).length;
  const succeededOnlinePaymentCount = onlinePaymentIntents.filter(
    (payment) => getRecordString(payment, "status") === "succeeded",
  ).length;
  const onlinePaymentBadge =
    succeededOnlinePaymentCount > 0
      ? t("billRequests.onlinePaid")
      : activeOnlinePaymentCount > 0
        ? t("billRequests.onlinePending")
        : t("billRequests.manualOnly");
  const acknowledgeDisabledReason = !billRequestId
    ? t("billRequests.acknowledgeMissingId")
    : requestStatus !== "open"
      ? t("billRequests.acknowledgeStatus", {
          status: humanizeStatus(requestStatus),
        })
      : "";
  const presentDisabledReason = !billRequestId
    ? t("billRequests.presentMissingId")
    : requestStatus !== "open" && requestStatus !== "acknowledged"
      ? t("billRequests.presentStatus", {
          status: humanizeStatus(requestStatus),
        })
      : "";
  const paymentDisabledReason = !billId
    ? t("billRequests.paymentCreatedRequired")
    : paymentBlockedReason
      ? paymentBlockedReason
      : billStatus !== "presented" && billStatus !== "payment_pending"
        ? t("billRequests.paymentPresentRequired", {
            status: humanizeStatus(billStatus),
          })
        : balanceDueMinor <= 0
          ? t("billRequests.paymentAlreadySettled")
          : !paymentAmountMatchesBalance
            ? t("billRequests.paymentExactBalanceRequired")
            : "";

  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {billId
                ? t("billRequests.billFallback", {
                    billNumber: getBillNumber(billRequest),
                  })
                : t("billRequests.requestFallback", {
                    requestId: shortId(billRequestId),
                  })}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {getTableLabel(table, floor)}
          </p>
        </div>
        <Badge variant={statusVariant(displayStatus)}>
          {humanizeStatus(displayStatus)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">{t("billRequests.subtotal")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(subtotalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("billRequests.total")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(totalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("billRequests.paid")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(paidMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("billRequests.balance")}</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(balanceDueMinor, currency)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        {t(orderCount === 1 ? "billRequests.requestedAtOne" : "billRequests.requestedAt", {
          date: formatDateTime(getBillRequestCreatedAt(billRequest)),
          count: orderCount,
        })}
      </p>

      {lines.length > 0 ? (
        <div className="mt-4 rounded-card border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("billRequests.billLines")}
          </p>
          <div className="mt-3 grid gap-2">
            {lines.map((line, index) => (
              <div
                key={getRecordString(line, "id", `line-${index}`)}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {getRecordNumber(line, "quantity", 1)} x{" "}
                    {getRecordString(
                      line,
                      "itemNameSnapshot",
                      t("billRequests.menuItemFallback"),
                    )}
                  </p>
                  {getRecordNumber(line, "modifiersTotalMinor") > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("billRequests.includesModifiers", {
                        price: formatMoney(
                          getRecordNumber(line, "modifiersTotalMinor"),
                          getRecordString(line, "currency", currency),
                        ),
                      })}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-foreground">
                  {formatMoney(
                    getRecordNumber(line, "lineTotalMinor"),
                    getRecordString(line, "currency", currency),
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="mt-4 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
          {t("billRequests.receiptReady", {
            receiptNumber: getRecordString(
              receipt,
              "receiptNumber",
              t("billRequests.receiptGeneratedFallback"),
            ),
          })}{" "}
          {succeededOnlinePaymentCount > 0
            ? t("billRequests.onlinePaymentConfirmed")
            : t("billRequests.manualPaymentRecordedByCashier")}
        </div>
      ) : null}

      {manualPayments.length > 0 ? (
        <div className="mt-3 text-xs text-muted-foreground">
          {t(
            manualPayments.length === 1
              ? "billRequests.manualPaymentsRecordedOne"
              : "billRequests.manualPaymentsRecorded",
            { count: manualPayments.length },
          )}
        </div>
      ) : null}

      {onlinePaymentIntents.length > 0 ? (
        <div className="mt-3 rounded-card border bg-background/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">
            {t("billRequests.onlinePayments")}
          </p>
          <div className="mt-2 grid gap-1">
            {onlinePaymentIntents.slice(-3).map((payment, index) => (
              <p key={getRecordString(payment, "id", `online-${index}`)}>
                {t("billRequests.onlinePaymentRow", {
                  status: humanizeStatus(getRecordString(payment, "status")),
                  provider: getRecordString(payment, "provider", "mock"),
                  price: formatMoney(
                    getRecordNumber(payment, "amountMinor"),
                    getRecordString(payment, "currency", currency),
                  ),
                })}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={!canAcknowledge || isPending}
          onClick={() => onAcknowledge(billRequestId)}
        >
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("actions.acknowledge")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canPresent || isPending}
          onClick={() => onPresent(billRequestId)}
        >
          <HandCoins className="size-4" aria-hidden="true" />
          {t("actions.present")}
        </Button>
      </div>
      {acknowledgeDisabledReason || presentDisabledReason ? (
        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
          {acknowledgeDisabledReason ? (
            <p>{acknowledgeDisabledReason}</p>
          ) : null}
          {presentDisabledReason ? <p>{presentDisabledReason}</p> : null}
        </div>
      ) : null}
      {paymentDisabledReason &&
      (!billId || balanceDueMinor <= 0 || !canRecordPayment) ? (
        <div className="mt-3 rounded-card border bg-background/40 p-3 text-xs text-muted-foreground">
          {paymentDisabledReason}
        </div>
      ) : null}

      {billId && balanceDueMinor > 0 ? (
        <form
          className="mt-4 grid gap-3 rounded-card border bg-background/40 p-3"
          onSubmit={(event) => {
            event.preventDefault();

            if (!canRecordPayment || !paymentAmountMatchesBalance) {
              return;
            }

            onRecordManualPayment(billId, {
              method: paymentMethod,
              amountMinor: paymentAmountMinor,
              reference: reference.trim() || undefined,
              note: note.trim() || undefined,
            });
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {t("billRequests.manualPayment")}
            </p>
            <Badge
              variant={
                succeededOnlinePaymentCount > 0
                  ? "success"
                  : activeOnlinePaymentCount > 0
                    ? "warning"
                    : "muted"
              }
            >
              {onlinePaymentBadge}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("billRequests.method")}
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as RecordManualPaymentPayload["method"],
                  )
                }
                className="h-10 rounded-button border border-input bg-background px-3 text-sm text-foreground"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {t(method.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("billRequests.amount")}
              <Input
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder={minorToInput(balanceDueMinor)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("billRequests.reference")}
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("billRequests.optional")}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            {t("billRequests.note")}
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("billRequests.optionalCashierNote")}
            />
          </label>
          {!paymentAmountMatchesBalance ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-xs text-warning">
              {t("billRequests.exactBalanceWarning")}
            </div>
          ) : null}
          {paymentError && isPaymentPending ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-xs text-danger"
            >
              {formatErrorMessage(paymentError)}
            </div>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={
              !canRecordPayment ||
              isPaymentPending ||
              !paymentAmountMatchesBalance
            }
          >
            <CreditCard className="size-4" aria-hidden="true" />
            {t("actions.recordPayment")}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
