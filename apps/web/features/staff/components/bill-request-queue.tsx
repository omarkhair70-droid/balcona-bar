"use client";

import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type {
  BranchBillRequestStatusFilter,
  RecordManualPaymentPayload
} from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { getBillRequestId } from "@/features/staff/cashier-data";
import { humanizeStatus } from "@/features/staff/staff-format";
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

  return (
    <section className="min-w-0 border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9D856D]">
              {t("serviceShell.bills")}
            </p>
            <h2 className="mt-1 text-base font-semibold text-[#FFF5E8]">
              {t("billRequests.title")}
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
      </div>

      <div className="p-3">
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
            {billRequests.map((billRequest, index) => (
              <BillRequestCard
                key={getBillRequestId(billRequest) || String(index)}
                billRequest={billRequest}
                pendingActionId={pendingActionId}
                pendingPaymentId={pendingPaymentId}
                paymentBlockedReason={paymentBlockedReason}
                paymentError={paymentError}
                onAcknowledge={onAcknowledge}
                onPresent={onPresent}
                onRecordManualPayment={onRecordManualPayment}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
