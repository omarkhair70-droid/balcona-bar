"use client";

import { useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  HandCoins,
  ReceiptText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBillId,
  getBillLines,
  getBillManualPayments,
  getBillNumber,
  getBillReceipt,
  getBillRequestCreatedAt,
  getBillRequestId,
  getBillRequestFloor,
  getBillRequestRecord,
  getBillRequestStatus,
  getBillRequestTable,
  getBillStatus,
  getBillTotals
} from "@/features/staff/cashier-data";
import {
  formatDateTime,
  formatMoney,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import type { RecordManualPaymentPayload } from "@/lib/api/types";

type BillRequestCardProps = {
  billRequest: Record<string, unknown>;
  pendingActionId?: string;
  pendingPaymentId?: string;
  paymentError?: Error;
  onAcknowledge: (billRequestId: string) => void;
  onPresent: (billRequestId: string) => void;
  onRecordManualPayment: (
    billId: string,
    payload: RecordManualPaymentPayload
  ) => void;
};

const paymentMethods: Array<{
  value: RecordManualPaymentPayload["method"];
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "card_pos", label: "Card POS" },
  { value: "wallet_manual", label: "Wallet" },
  { value: "other", label: "Other" }
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
  paymentError,
  onAcknowledge,
  onPresent,
  onRecordManualPayment
}: BillRequestCardProps) {
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
  const receipt = getBillReceipt(billRequest);
  const currency = getRecordString(totals, "currency", "EGP");
  const subtotalMinor = getRecordNumber(
    totals,
    "subtotalMinor",
    getRecordNumber(request, "subtotalMinor")
  );
  const totalMinor = getRecordNumber(totals, "totalMinor", subtotalMinor);
  const paidMinor = getRecordNumber(totals, "paidMinor");
  const balanceDueMinor = getRecordNumber(totals, "balanceDueMinor", totalMinor);
  const orderCount = getRecordNumber(
    totals,
    "orderCount",
    getRecordNumber(request, "orderCount")
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
    balanceDueMinor > 0;
  const [paymentMethod, setPaymentMethod] =
    useState<RecordManualPaymentPayload["method"]>("cash");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const paymentAmountMinor = amountInputToMinor(
    paymentAmount,
    balanceDueMinor
  );
  const paymentAmountMatchesBalance = paymentAmountMinor === balanceDueMinor;

  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              {billId ? `Bill ${getBillNumber(billRequest)}` : `Bill request ${shortId(billRequestId)}`}
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
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(subtotalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(totalMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(paidMinor, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(balanceDueMinor, currency)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Requested {formatDateTime(getBillRequestCreatedAt(billRequest))} ·{" "}
        {orderCount} order{orderCount === 1 ? "" : "s"}
      </p>

      {lines.length > 0 ? (
        <div className="mt-4 rounded-card border bg-background/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bill lines
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
                    {getRecordString(line, "itemNameSnapshot", "Menu item")}
                  </p>
                  {getRecordNumber(line, "modifiersTotalMinor") > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Includes modifiers{" "}
                      {formatMoney(
                        getRecordNumber(line, "modifiersTotalMinor"),
                        getRecordString(line, "currency", currency)
                      )}
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-foreground">
                  {formatMoney(
                    getRecordNumber(line, "lineTotalMinor"),
                    getRecordString(line, "currency", currency)
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {receipt ? (
        <div className="mt-4 rounded-card border border-success bg-success/10 p-3 text-sm text-success">
          Receipt {getRecordString(receipt, "receiptNumber", "generated")} is
          ready. Manual payment has been recorded by the cashier.
        </div>
      ) : null}

      {manualPayments.length > 0 ? (
        <div className="mt-3 text-xs text-muted-foreground">
          {manualPayments.length} manual payment
          {manualPayments.length === 1 ? "" : "s"} recorded.
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
          Acknowledge
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canPresent || isPending}
          onClick={() => onPresent(billRequestId)}
        >
          <HandCoins className="size-4" aria-hidden="true" />
          Present
        </Button>
      </div>

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
              note: note.trim() || undefined
            });
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Manual payment
            </p>
            <Badge variant="warning">No online payment</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Method
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as RecordManualPaymentPayload["method"]
                  )
                }
                className="h-10 rounded-button border border-input bg-background px-3 text-sm text-foreground"
              >
                {paymentMethods.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Amount
              <Input
                inputMode="decimal"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                placeholder={minorToInput(balanceDueMinor)}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Reference
              <Input
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Optional"
              />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Note
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional cashier note"
            />
          </label>
          {!paymentAmountMatchesBalance ? (
            <div className="rounded-card border border-warning bg-warning/10 p-3 text-xs text-warning">
              Manual payment must exactly match the balance due for this phase.
            </div>
          ) : null}
          {paymentError && isPaymentPending ? (
            <div
              role="alert"
              className="rounded-card border border-danger bg-danger/10 p-3 text-xs text-danger"
            >
              {paymentError.message}
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
            Record payment
          </Button>
        </form>
      ) : null}
    </div>
  );
}
