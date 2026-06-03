import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";

type CashierOrderStatusPillProps = {
  status?: string;
};

function statusVariant(status?: string) {
  switch (status) {
    case "submitted":
      return "warning";
    case "cashier_accepted":
    case "preparing":
    case "ready":
    case "served":
    case "completed":
      return "success";
    case "cashier_rejected":
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

export function CashierOrderStatusPill({
  status
}: CashierOrderStatusPillProps) {
  return <Badge variant={statusVariant(status)}>{humanizeStatus(status)}</Badge>;
}
