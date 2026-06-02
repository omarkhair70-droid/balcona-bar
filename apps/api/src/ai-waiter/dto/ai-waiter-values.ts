export const AI_WAITER_ESCALATION_REASONS = [
  "customer_requested_human",
  "unclear_request",
  "unavailable_item",
  "missing_required_options",
  "safety_or_policy",
  "system_error",
  "other",
] as const;

export const AI_WAITER_SESSION_STATUSES = [
  "active",
  "escalated",
  "closed",
] as const;

export const AI_WAITER_SESSION_STATUS_FILTERS = [
  ...AI_WAITER_SESSION_STATUSES,
  "all",
] as const;
