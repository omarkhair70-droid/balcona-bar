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

export function hasCompanyStaffPermission(
  access: StaffEffectiveAccess | undefined,
  permission: StaffPermission,
  companyId?: string
) {
  if (!access || !companyId) {
    return false;
  }

  return Boolean(
    access.companies
      .find(
        (entry) =>
          entry.company.id === companyId && entry.branchScope === "all_branches"
      )
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

export function getMenuAdminAccessMode(input: {
  access?: StaffEffectiveAccess;
  companyId?: string;
  branchId?: string;
}) {
  const canReadBranchMenu = hasStaffPermission(
    input.access,
    "menu.read",
    input.branchId
  );
  const canManageBranchOverrides = hasStaffPermission(
    input.access,
    "menu.manage_branch_overrides",
    input.branchId
  );
  const canManageCompanyCategories = hasCompanyStaffPermission(
    input.access,
    "menu.manage_categories",
    input.companyId
  );
  const canManageCompanyItems = hasCompanyStaffPermission(
    input.access,
    "menu.manage_items",
    input.companyId
  );
  const canManageCompanyModifiers = hasCompanyStaffPermission(
    input.access,
    "menu.manage_modifiers",
    input.companyId
  );
  const canManageFullMenu =
    canManageCompanyCategories &&
    canManageCompanyItems &&
    canManageCompanyModifiers;

  return {
    canReadBranchMenu,
    canManageBranchOverrides,
    canManageCompanyCategories,
    canManageCompanyItems,
    canManageCompanyModifiers,
    canManageFullMenu,
    mode: canManageFullMenu
      ? "full_menu_management"
      : canManageBranchOverrides
        ? "branch_availability"
        : "read_only"
  } as const;
}

export function getInventoryAccessMode(input: {
  access?: StaffEffectiveAccess;
  companyId?: string;
  branchId?: string;
}) {
  const canReadBranchInventory = hasStaffPermission(
    input.access,
    "inventory.read",
    input.branchId
  );
  const canManageBranchStock = hasStaffPermission(
    input.access,
    "inventory.manage",
    input.branchId
  );
  const canReadCompanyInventory = hasCompanyStaffPermission(
    input.access,
    "inventory.read",
    input.companyId
  );
  const canManageCompanyInventory = hasCompanyStaffPermission(
    input.access,
    "inventory.manage",
    input.companyId
  );

  return {
    canReadBranchInventory,
    canManageBranchStock,
    canReadCompanyInventory,
    canManageCompanyInventory,
    mode: canManageCompanyInventory
      ? "company_inventory_management"
      : canManageBranchStock
        ? "branch_stock_management"
        : canReadBranchInventory
          ? "read_only"
          : "no_access"
  } as const;
}
