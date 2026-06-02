import { StaffRole } from '@prisma/client';

export const STAFF_PERMISSIONS = [
  'companies.read',
  'branches.read',
  'tables.read',
  'sessions.read',
  'sessions.manage',
  'menu.read',
  'menu.manage',
  'cart.read',
  'orders.read',
  'orders.cashier_review',
  'orders.accept',
  'orders.reject',
  'smart_cashier.read',
  'smart_cashier.manage',
  'smart_cashier.evaluate',
  'smart_cashier.auto_accept',
  'preparation.read',
  'preparation.start',
  'preparation.ready',
  'preparation.cancel',
  'waiter_calls.read',
  'waiter_calls.acknowledge',
  'waiter_calls.resolve',
  'waiter_calls.cancel',
  'notifications.read',
  'presence.read',
  'staff.read',
  'staff.manage',
  'analytics.read',
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_PERMISSION_SET = new Set<string>(STAFF_PERMISSIONS);

export const ROLE_PERMISSIONS: Record<StaffRole, readonly StaffPermission[]> = {
  [StaffRole.owner]: STAFF_PERMISSIONS,
  [StaffRole.branch_manager]: [
    'companies.read',
    'branches.read',
    'tables.read',
    'sessions.read',
    'sessions.manage',
    'menu.read',
    'menu.manage',
    'cart.read',
    'orders.read',
    'orders.cashier_review',
    'orders.accept',
    'orders.reject',
    'smart_cashier.read',
    'smart_cashier.manage',
    'smart_cashier.evaluate',
    'smart_cashier.auto_accept',
    'preparation.read',
    'preparation.start',
    'preparation.ready',
    'preparation.cancel',
    'waiter_calls.read',
    'waiter_calls.acknowledge',
    'waiter_calls.resolve',
    'waiter_calls.cancel',
    'notifications.read',
    'presence.read',
    'staff.read',
    'analytics.read',
  ],
  [StaffRole.cashier]: [
    'orders.read',
    'orders.cashier_review',
    'orders.accept',
    'orders.reject',
    'smart_cashier.read',
    'smart_cashier.evaluate',
    'smart_cashier.auto_accept',
    'tables.read',
    'sessions.read',
    'waiter_calls.read',
  ],
  [StaffRole.waiter]: [
    'tables.read',
    'sessions.read',
    'waiter_calls.read',
    'waiter_calls.acknowledge',
    'waiter_calls.resolve',
    'notifications.read',
  ],
  [StaffRole.kitchen]: [
    'preparation.read',
    'preparation.start',
    'preparation.ready',
    'preparation.cancel',
  ],
  [StaffRole.barista]: [
    'preparation.read',
    'preparation.start',
    'preparation.ready',
    'preparation.cancel',
  ],
  [StaffRole.menu_admin]: [
    'companies.read',
    'branches.read',
    'menu.read',
    'menu.manage',
  ],
};

export function isStaffPermission(value: string): value is StaffPermission {
  return STAFF_PERMISSION_SET.has(value);
}

export function getRolePermissions(
  role: StaffRole,
): readonly StaffPermission[] {
  return ROLE_PERMISSIONS[role];
}
