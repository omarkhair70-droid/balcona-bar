import { Badge } from "@/components/ui/badge";
import { humanizeStatus } from "@/features/staff/staff-format";

type KitchenTaskStatusPillProps = {
  status?: string;
};

function statusVariant(status?: string) {
  switch (status) {
    case "pending":
      return "warning";
    case "preparing":
      return "default";
    case "ready":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

export function KitchenTaskStatusPill({ status }: KitchenTaskStatusPillProps) {
  return <Badge variant={statusVariant(status)}>{humanizeStatus(status)}</Badge>;
}
