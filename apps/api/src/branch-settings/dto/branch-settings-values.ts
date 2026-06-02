export const BRANCH_OPERATING_MODES = [
  'manual',
  'assisted',
  'autopilot',
] as const;

export const BRANCH_SERVICE_MODES = ['dine_in', 'takeaway', 'mixed'] as const;

export const BRANCH_FEATURE_FLAG_KEYS = [
  'ai_waiter',
  'waiter_calls',
  'smart_cashier',
  'realtime',
  'media_experience',
  'bill_flow',
  'table_attention',
  'analytics',
  'notifications',
  'presence_triggers',
] as const;
