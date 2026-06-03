"use client";

import { CheckCircle2, HandCoins, ReceiptText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getBillRequestCreatedAt,
  getBillRequestId,
  getBillRequestFloor,
  getBillRequestRecord,
  getBillRequestStatus,
  getBillRequestTable
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

type BillRequestCardProps = {
  billRequest: Record<string, unknown>;
  pendingActionId?: string;
  onAcknowledge: (billRequestId: string) => void;
  onPresent: (billRequestId: string) => void;
  onClose: (billRequestId: string) => void;
};

function statusVariant(status?: string) {
  switch (status) {
    case "open":
      return "warning";
    case "acknowledged":
    case "presented":
      return "success";
    case "closed":
      return "muted";
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

export function BillRequestCard({
  billRequest,
  pendingActionId,
  onAcknowledge,
  onPresent,
  onClose
}: BillRequestCardProps) {
  const bill = getBillRequestRecord(billRequest);
  const billRequestId = getBillRequestId(billRequest);
  const status = getBillRequestStatus(billRequest);
  const table = getBillRequestTable(billRequest);
  const floor = getBillRequestFloor(billRequest);
  const isPending = pendingActionId === billRequestId;
  const canAcknowledge = Boolean(billRequestId) && status === "open";
  const canPresent =
    Boolean(billRequestId) && (status === "open" || status === "acknowledged");
  const canClose = Boolean(billRequestId) && status === "presented";

  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              Bill {shortId(billRequestId)}
            </p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {getTableLabel(table, floor)}
          </p>
        </div>
        <Badge variant={statusVariant(status)}>{humanizeStatus(status)}</Badge>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {formatMoney(
              getRecordNumber(bill, "subtotalMinor"),
              getRecordString(bill, "currency", "EGP")
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Orders</dt>
          <dd className="mt-1 font-semibold text-foreground">
            {getRecordNumber(bill, "orderCount")}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-muted-foreground">
        Requested {formatDateTime(getBillRequestCreatedAt(billRequest))}
      </p>

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
        <Button
          size="sm"
          disabled={!canClose || isPending}
          onClick={() => onClose(billRequestId)}
        >
          Close
        </Button>
      </div>
    </div>
  );
}
