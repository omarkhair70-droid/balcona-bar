import type { StaffEffectiveAccess } from "@/lib/api/types";

export type StaffPermission = string;

export function getAccessibleStaffBranchIds(access?: StaffEffectiveAccess) {
  return new Set(access?.branches.map((entry) => entry.branch.id) ?? []);
}

export function hasStaffPermission(
  access: StaffEffectiveAccess | undefined,
  permission: StaffPermission,
  branchId?: string
) {
  if (!access) {
    return false;
  }

  if (!branchId) {
    return access.permissions.includes(permission);
  }

  return Boolean(
    access.branches
      .find((entry) => entry.branch.id === branchId)
      ?.permissions.includes(permission)
  );
}

export function hasAnyStaffPermission(
  access: StaffEffectiveAccess | undefined,
  permissions: StaffPermission[],
  branchId?: string
) {
  return permissions.some((permission) =>
    hasStaffPermission(access, permission, branchId)
  );
}

export function canAccessStaffRoute(input: {
  access?: StaffEffectiveAccess;
  permissions?: StaffPermission[];
  branchId?: string;
  branchScoped?: boolean;
}) {
  if (!input.permissions || input.permissions.length === 0) {
    return true;
  }

  return hasAnyStaffPermission(
    input.access,
    input.permissions,
    input.branchScoped ? input.branchId : undefined
  );
}

export function getDefaultStaffRoute(
  access?: StaffEffectiveAccess,
  branchId?: string | null
) {
  const branchRoles = branchId
    ? access?.branches.find((entry) => entry.branch.id === branchId)?.roles
    : undefined;
  const roles = branchRoles && branchRoles.length > 0 ? branchRoles : access?.roles;

  if (roles?.includes("owner") || roles?.includes("branch_manager")) {
    return "/staff/owner";
  }

  if (roles?.includes("cashier")) {
    return "/staff/cashier";
  }

  if (roles?.includes("kitchen") || roles?.includes("barista")) {
    return "/staff/kitchen";
  }

  if (roles?.includes("waiter")) {
    return "/staff/waiter";
  }

  if (roles?.includes("menu_admin")) {
    return "/staff/menu";
  }

  return "/staff";
}
