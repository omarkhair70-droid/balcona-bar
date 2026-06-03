import { BranchStatus, TableStatus } from '@prisma/client';

export const BRANCH_STATUSES = [
  BranchStatus.active,
  BranchStatus.inactive,
] as const;

export const TABLE_STATUSES = [
  TableStatus.active,
  TableStatus.inactive,
  TableStatus.maintenance,
] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const QR_TOKEN_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
