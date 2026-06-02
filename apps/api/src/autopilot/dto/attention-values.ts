export const TABLE_ATTENTION_STATUSES = [
  'normal',
  'needs_attention',
  'urgent',
  'resolved',
  'muted',
] as const;

export const TABLE_ATTENTION_STATUS_FILTERS = [
  ...TABLE_ATTENTION_STATUSES,
  'all',
] as const;

export const TABLE_ATTENTION_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

export const TABLE_ATTENTION_PRIORITY_FILTERS = [
  ...TABLE_ATTENTION_PRIORITIES,
  'all',
] as const;

