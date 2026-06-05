import { BranchStatus, CompanyStatus, StaffRole } from '@prisma/client';

export const COMPANY_STATUSES = [
  CompanyStatus.active,
  CompanyStatus.inactive,
] as const;

export const BRANCH_STATUSES = [
  BranchStatus.active,
  BranchStatus.inactive,
] as const;

export const ONBOARDING_STAFF_ROLES = [
  StaffRole.owner,
  StaffRole.branch_manager,
  StaffRole.cashier,
  StaffRole.waiter,
  StaffRole.kitchen,
  StaffRole.barista,
  StaffRole.menu_admin,
] as const;

export const READINESS_CHECK_STATUSES = [
  'pending',
  'complete',
  'blocked',
  'skipped',
] as const;

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
