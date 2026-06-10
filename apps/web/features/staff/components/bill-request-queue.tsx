"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import type { BranchBillRequestStatusFilter } from "@/lib/api/types";
import { cn } from "@/lib/utils/cn";
import { getBillRequestId } from "@/features/staff/cashier-data";
import { humanizeStatus } from "@/features/staff/staff-format";
import type { RecordManualPaymentPayload } from "@/lib/api/types";
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
    payload: RecordManualPaymentPayload,
  ) => void;
};

const statusOptions: BranchBillRequestStatusFilter[] = [
  "active",
  "open",
  "acknowledged",
  "presented",
  "all",
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
  onRecordManualPayment,
}: BillRequestQueueProps) {
  const t = useTranslations("staff");

  return (
    <Card variant="glass" padding="lg">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>{t("billRequests.title")}</CardTitle>
          <CardDescription>{t("billRequests.description")}</CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("actions.refresh")}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {statusOptions.map((option) => (
            <button
              type="button"
              key={option}
              onClick={() => onStatusChange(option)}
              className={cn(
                "min-h-9 whitespace-nowrap rounded-button border px-3 text-xs font-semibold transition",
                status === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {humanizeStatus(option)}
            </button>
          ))}
        </div>

        {isLoading ? <LoadingState label={t("billRequests.loading")} /> : null}
        {error ? (
          <EmptyState
            title={t("billRequests.errorTitle")}
            description={error.message}
            debug={{
              action: "bill_request_list",
              flow: "staff_cashier",
              error,
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
          <div className="grid gap-3">
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
      </CardContent>
    </Card>
  );
}
