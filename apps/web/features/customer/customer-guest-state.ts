export type GuestOrderStage =
  | "submitted"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "issue";

export function getGuestOrderStage(value?: string | null): GuestOrderStage {
  const status = (value ?? "").trim().toLowerCase().replaceAll("-", "_");

  if (
    ["served", "completed", "closed", "fulfilled"].includes(status)
  ) {
    return "served";
  }

  if (["ready", "ready_for_service", "ready_to_serve"].includes(status)) {
    return "ready";
  }

  if (
    ["preparing", "in_progress", "in_preparation", "kitchen_preparing"].includes(
      status
    )
  ) {
    return "preparing";
  }

  if (
    ["accepted", "cashier_accepted", "confirmed", "acknowledged"].includes(
      status
    )
  ) {
    return "accepted";
  }

  if (
    ["cancelled", "canceled", "rejected", "failed", "problem"].includes(status)
  ) {
    return "issue";
  }

  return "submitted";
}

export function getGuestTimelineStage(type?: string | null): GuestOrderStage | "service" | "bill" | "payment" | "update" {
  const normalized = (type ?? "").toLowerCase().replaceAll("-", "_");

  if (normalized.includes("payment") || normalized.includes("paid")) {
    return "payment";
  }

  if (normalized.includes("bill")) {
    return "bill";
  }

  if (
    normalized.includes("waiter") ||
    normalized.includes("service") ||
    normalized.includes("call")
  ) {
    return "service";
  }

  const orderStage = getGuestOrderStage(normalized);
  if (
    ["submitted", "accepted", "preparing", "ready", "served"].includes(
      orderStage
    ) &&
    /(submit|accept|prepar|ready|serv|complete|fulfill)/.test(normalized)
  ) {
    return orderStage;
  }

  return "update";
}
