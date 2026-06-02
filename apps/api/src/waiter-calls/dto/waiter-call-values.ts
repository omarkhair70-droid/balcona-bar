export const WAITER_CALL_TYPES = [
  'call_waiter',
  'need_bill',
  'need_water',
  'need_help',
  'order_problem',
  'clean_table',
  'other',
] as const;

export const WAITER_CALL_STATUSES = [
  'open',
  'acknowledged',
  'resolved',
  'cancelled',
  'all',
] as const;
