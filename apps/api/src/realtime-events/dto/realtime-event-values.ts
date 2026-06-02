export const BRANCH_REALTIME_STREAM_CHANNELS = [
  'all',
  'orders',
  'preparation',
  'waiter_calls',
  'notifications',
] as const;

export const SESSION_REALTIME_STREAM_CHANNELS = [
  'all',
  'status',
  'notifications',
  'waiter_calls',
] as const;

export const REALTIME_EVENT_TYPES = [
  'connection_opened',
  'table_session_started',
  'table_session_resumed',
  'notification_created',
  'notification_read',
  'notification_dismissed',
  'order_submitted',
  'order_accepted',
  'order_rejected',
  'order_preparation_started',
  'order_preparation_ready',
  'order_served',
  'order_completed',
  'bill_requested',
  'bill_acknowledged',
  'bill_presented',
  'bill_closed',
  'bill_cancelled',
  'preparation_task_created',
  'preparation_task_started',
  'preparation_task_ready',
  'preparation_task_cancelled',
  'waiter_call_created',
  'waiter_call_acknowledged',
  'waiter_call_resolved',
  'waiter_call_cancelled',
  'smart_cashier_evaluated',
  'smart_cashier_auto_accepted',
  'smart_cashier_manual_review_required',
  'system',
] as const;

export type BranchRealtimeStreamChannel =
  (typeof BRANCH_REALTIME_STREAM_CHANNELS)[number];
export type SessionRealtimeStreamChannel =
  (typeof SESSION_REALTIME_STREAM_CHANNELS)[number];
export type RealtimeEventTypeValue = (typeof REALTIME_EVENT_TYPES)[number];
