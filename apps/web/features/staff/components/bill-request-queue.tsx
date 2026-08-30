"use client";

import { useState } from "react";
import { RefreshCw, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type {
  BranchBillRequestStatusFilter,
  RecordManualPaymentPayload
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import {
  getBillId,
  getBillNumber,
  getBillRequestFloor,
  getBillRequestId,
  getBillRequestStatus,
  getBillRequestTable,
  getBillStatus,
  getBillTotals
} from "@/features/staff/cashier-data";
import {
  formatMoney,
  getRecordNumber,
  getRecordString,
  getTableLabel,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { BillRequestCard } from "./bill-request-card";

type BillRequestQueueProps = {
  billRequests: Record<string, unknown>[];
  status: BranchBillRequestStatusFilter;
  isLoading?: boolean;
  error?: Error;
  pendingActionId?: string;
  pendingPaymentId?: string;
  paymentBlockedReason?: string;
  paymentError?: Error;
  onStatusChange: (status: BranchBillRequestStatusFilter) => void;
  onRefresh: () => void;
  onAcknowledge: (billRequestId: string) => void;
  onPresent: (billRequestId: string) => void;
  onRecordManualPayment: (
    billId: string,
    payload: RecordManualPaymentPayload
  ) => void;
};

const statusOptions: BranchBillRequestStatusFilter[] = [
  "active",
  "open",
  "acknowledged",
  "presented",
  "all"
];

function statusVariant(status: string) {
  if (status === "paid" || status === "presented" || status === "acknowledged") {
    return "success" as const;
  }

  if (status === "open" || status === "requested" || status === "payment_pending") {
    return "warning" as const;
  }

  if (status === "cancelled" || status === "failed" || status === "unknown") {
    return "danger" as const;
  }

  return "muted" as const;
}

export function BillRequestQueue({
  billRequests,
  status,
  isLoading,
  error,
  pendingActionId,
  pendingPaymentId,
  paymentBlockedReason,
  paymentError,
  onStatusChange,
  onRefresh,
  onAcknowledge,
  onPresent,
  onRecordManualPayment
}: BillRequestQueueProps) {
  const t = useTranslations("staff");
  const [selectedId, setSelectedId] = useState<string>();
  const selected =
    billRequests.find((entry) => getBillRequestId(entry) === selectedId) ??
    billRequests[0];

  return (
    <div className="grid min-h-[calc(100vh-8rem)] min-w-0 lg:grid-cols-[350px_minmax(0,1fr)]">
      <section className="min-w-0 border-e border-[#342A23] bg-[#17120F] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#FFF5E8]">
              {t("serviceShell.bills")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#95887D]">
              {t("billRequests.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195] transition hover:border-[#5A483A] hover:text-[#F6EBDD]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onStatusChange(option)}
              className={cn(
                "min-h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-xs font-semibold transition",
                status === option
                  ? "border-[#C68A4A] bg-[#C68A4A] text-[#1B120C]"
                  : "border-[#3B3028] bg-[#211A15] text-[#BFB0A2] hover:border-[#554238] hover:bg-[#292019]"
              )}
            >
              {humanizeStatus(option)}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {isLoading ? <LoadingState label={t("billRequests.loading")} /> : null}
          {error ? (
            <EmptyState
              title={t("billRequests.errorTitle")}
              description={error.message}
              debug={{
                action: "bill_request_list",
                flow: "staff_cashier",
                error
              }}
            />
          ) : null}
          {!isLoading && !error && billRequests.length === 0 ? (
            <EmptyState
              title={t("billRequests.emptyTitle")}
              description={t("billRequests.emptyDescription")}
            />
          ) : null}

          {!isLoading && !error && billRequests.length > 0 ? (
            <div className="grid gap-2">
              {billRequests.map((billRequest, index) => {
                const requestId = getBillRequestId(billRequest);
                const billId = getBillId(billRequest);
                const displayId =
                  (billId && getBillNumber(billRequest)) ||
                  shortId(requestId) ||
                  String(index + 1);
                const displayStatus =
                  getBillStatus(billRequest) ||
                  getBillRequestStatus(billRequest) ||
                  "open";
                const totals = getBillTotals(billRequest);
                const totalMinor = getRecordNumber(
                  totals,
                  "totalMinor",
                  getRecordNumber(totals, "subtotalMinor")
                );
                const currency = getRecordString(totals, "currency", "EGP");
                const tableLabel = getTableLabel(
                  getBillRequestTable(billRequest),
                  getBillRequestFloor(billRequest)
                );
                const active = selected === billRequest;

                return (
                  <button
                    key={requestId || billId || String(index)}
                    type="button"
                    onClick={() => setSelectedId(requestId)}
                    className={cn(
                      "w-full rounded-md border p-3 text-start transition",
                      active
                        ? "border-[#8A6239] bg-[#34271E]"
                        : "border-[#3B3028] bg-[#211A15] hover:border-[#554238] hover:bg-[#292019]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-[#FFF4E6]">
                          <ReceiptText className="size-4 shrink-0 text-[#C68A4A]" aria-hidden="true" />
                          {displayId}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#9A8D81]">
                          {tableLabel}
                        </p>
                      </div>
                      <Badge variant={statusVariant(displayStatus)}>
                        {humanizeStatus(displayStatus)}
                      </Badge>
                    </div>
                    <p className="mt-3 text-lg font-semibold text-[#FFF4E6]">
                      {formatMoney(totalMinor, currency)}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <section className="min-w-0 bg-[#1E1814] p-3 sm:p-4 lg:p-5">
        <div className="mx-auto max-w-3xl">
          {selected ? (
            <BillRequestCard
              billRequest={selected}
              pendingActionId={pendingActionId}
              pendingPaymentId={pendingPaymentId}
              paymentBlockedReason={paymentBlockedReason}
              paymentError={paymentError}
              onAcknowledge={onAcknowledge}
              onPresent={onPresent}
              onRecordManualPayment={onRecordManualPayment}
            />
          ) : !isLoading && !error ? (
            <EmptyState
              title={t("billRequests.emptyTitle")}
              description={t("billRequests.emptyDescription")}
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
