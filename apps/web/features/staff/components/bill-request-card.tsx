"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, HandCoins, ReceiptText } from "lucide-react";
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
    !paymentBlockedReason &&
    !hasUnresolvedOnlinePayment;
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
  const problemOnlinePaymentCount = onlinePaymentIntents.filter((payment) =>
    ["failed", "cancelled", "expired"].includes(
      getRecordString(payment, "status"),
    ),
  ).length;
  const unknownOnlinePaymentCount = onlinePaymentIntents.filter((payment) => {
    const status = getRecordString(payment, "status");

    return (
      !status ||
      ![
        "pending",
        "requires_action",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
      ].includes(status)
    );
  }).length;
  const hasUnresolvedOnlinePayment =
    activeOnlinePaymentCount > 0 || unknownOnlinePaymentCount > 0;
  const onlinePaymentBadge =
    succeededOnlinePaymentCount > 0
      ? t("billRequests.onlinePaid")
      : activeOnlinePaymentCount > 0
        ? t("billRequests.onlinePending")
        : problemOnlinePaymentCount > 0
          ? t("billRequests.onlineProblem")
          : unknownOnlinePaymentCount > 0
            ? t("billRequests.onlineUnknown")
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
          : hasUnresolvedOnlinePayment
            ? t("billRequests.paymentUnresolvedOnlineRequired")
            : !paymentAmountMatchesBalance
              ? t("billRequests.paymentExactBalanceRequired")
              : "";

  return (
    <div className="rounded-md border border-[#3B3028] bg-[#211A15] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#F8EDDF]">
              {billId
                ? t("billRequests.billFallback", {
                    billNumber: getBillNumber(billRequest),
                  })
                : t("billRequests.requestFallback", {
                    requestId: shortId(billRequestId),
                  })}
            </p>
          </div>
          <p className="mt-2 text-xs text-[#91857A]">
            {getTableLabel(table, floor)}
          </p>
        </div>
        <Badge variant={statusVariant(displayStatus)}>
          {humanizeStatus(displayStatus)}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <div>
          <dt className="text-[#91857A]">{t("billRequests.subtotal")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(subtotalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("billRequests.total")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(totalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("billRequests.paid")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(paidMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[#91857A]">{t("billRequests.balance")}</dt>
          <dd className="mt-1 font-semibold text-[#F8EDDF]">
            {formatMoney(balanceDueMinor, currency)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-[#91857A]">
        {t(orderCount === 1 ? "billRequests.requestedAtOne" : "billRequests.requestedAt", {
          date: formatDateTime(getBillRequestCreatedAt(billRequest)),
          count: orderCount,
        })}
      </p>

      {lines.length > 0 ? (
        <div className="mt-4 rounded-md border border-[#3A3028] bg-[#18130F] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#91857A]">
            {t("billRequests.billLines")}
          </p>
          <div className="mt-3 grid gap-2">
            {lines.map((line, index) => (
              <div
                key={getRecordString(line, "id", `line-${index}`)}
                className="flex items-start justify-between gap-3 text-sm"
              >
                <div>
                  <p className="font-medium text-[#F8EDDF]">
                    {getRecordNumber(line, "quantity", 1)} x{" "}
                    {getRecordString(
                      line,
                      "itemNameSnapshot",
                      t("billRequests.menuItemFallback"),
                    )}
                  </p>
                  {getRecordNumber(line, "modifiersTotalMinor") > 0 ? (
                    <p className="mt-1 text-xs text-[#91857A]">
                      {t("billRequests.includesModifiers", {
                        price: formatMoney(
                          getRecordNumber(line, "modifiersTotalMinor"),
                          getRecordString(line, "currency", currency),
                        ),
                      })}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-[#F8EDDF]">
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
        <div className="mt-4 rounded-md border border-[#456144] bg-[#213022] p-3 text-sm text-success">
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
        <div className="mt-3 text-xs text-[#91857A]">
          {t(
            manualPayments.length === 1
              ? "billRequests.manualPaymentsRecordedOne"
              : "billRequests.manualPaymentsRecorded",
            { count: manualPayments.length },
          )}
        </div>
      ) : null}

      {onlinePaymentIntents.length > 0 ? (
        <div className="mt-3 rounded-md border border-[#3A3028] bg-[#18130F] p-3 text-xs text-[#91857A]">
          <p className="font-semibold text-[#F8EDDF]">
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

      {activeOnlinePaymentCount > 0 ? (
        <div
          role="status"
          className="mt-3 flex gap-2 rounded-md border border-[#7D5D2C] bg-[#392B18] p-3 text-xs leading-5 text-warning"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {t("billRequests.onlinePendingDetail", {
              count: activeOnlinePaymentCount,
            })}
          </span>
        </div>
      ) : null}

      {problemOnlinePaymentCount > 0 || unknownOnlinePaymentCount > 0 ? (
        <div
          role="alert"
          className="mt-3 flex gap-2 rounded-md border border-[#7A3F3A] bg-[#3A211F] p-3 text-xs leading-5 text-[#F0A39B]"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {problemOnlinePaymentCount > 0
              ? t("billRequests.onlineProblemDetail", {
                  count: problemOnlinePaymentCount,
                })
              : t("billRequests.onlineUnknownDetail", {
                  count: unknownOnlinePaymentCount,
                })}
          </span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#342A23] pt-3">
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
        <div className="mt-3 grid gap-1 text-xs text-[#91857A]">
          {acknowledgeDisabledReason ? (
            <p>{acknowledgeDisabledReason}</p>
          ) : null}
          {presentDisabledReason ? <p>{presentDisabledReason}</p> : null}
        </div>
      ) : null}
      {paymentDisabledReason &&
      (!billId || balanceDueMinor <= 0 || !canRecordPayment) ? (
        <div className="mt-3 rounded-md border border-[#3A3028] bg-[#18130F] p-3 text-xs text-[#91857A]">
          {paymentDisabledReason}
        </div>
      ) : null}

      {billId && balanceDueMinor > 0 ? (
        <form
          className="mt-4 grid gap-3 rounded-md border border-[#47392E] bg-[#18130F] p-3"
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
            <p className="text-sm font-semibold text-[#F8EDDF]">
              {t("billRequests.manualPayment")}
            </p>
            <Badge
              variant={
                succeededOnlinePaymentCount > 0
                  ? "success"
                  : activeOnlinePaymentCount > 0
                    ? "warning"
                    : problemOnlinePaymentCount > 0 ||
                        unknownOnlinePaymentCount > 0
                      ? "danger"
                      : "muted"
              }
            >
              {onlinePaymentBadge}
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-[#91857A]">
              {t("billRequests.method")}
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as RecordManualPaymentPayload["method"],
                  )
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm text-[#F8EDDF]"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {t(method.labelKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#91857A]">
              {t("billRequests.amount")}
              <Input
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder={minorToInput(balanceDueMinor)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[#91857A]">
              {t("billRequests.reference")}
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder={t("billRequests.optional")}
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-[#91857A]">
            {t("billRequests.note")}
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("billRequests.optionalCashierNote")}
            />
          </label>
          {!paymentAmountMatchesBalance ? (
            <div className="rounded-md border border-[#7D5D2C] bg-[#392B18] p-3 text-xs text-warning">
              {t("billRequests.exactBalanceWarning")}
            </div>
          ) : null}
          {paymentError && isPaymentPending ? (
            <div
              role="alert"
              className="rounded-md border border-[#7A3F3A] bg-[#3A211F] p-3 text-xs text-danger"
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
