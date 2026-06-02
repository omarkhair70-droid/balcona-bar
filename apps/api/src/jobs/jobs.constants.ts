export const JOB_QUEUE_NAMES = [
  'notifications',
  'attention',
  'analytics',
  'cleanup',
  'ai_waiter',
] as const;

export type JobQueueName = (typeof JOB_QUEUE_NAMES)[number];

