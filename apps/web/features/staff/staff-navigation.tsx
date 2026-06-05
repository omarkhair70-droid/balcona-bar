import {
  Bell,
  BookOpenText,
  Building2,
  ChartNoAxesCombined,
  ChefHat,
  LayoutDashboard,
  LogIn,
  Receipt
} from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";
import type { StaffEffectiveAccess } from "@/lib/api/types";
import {
  canAccessStaffRoute,
  type StaffPermission
} from "@/lib/staff/staff-access";

export type StaffNavItem = AppShellNavItem & {
  requiredPermissions?: StaffPermission[];
  branchScoped?: boolean;
  authOnly?: boolean;
};

export const staffNavItems: StaffNavItem[] = [
  {
    href: "/staff",
    label: "Overview",
    icon: <LayoutDashboard className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/cashier",
    label: "Cashier",
    icon: <Receipt className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["orders.cashier_review"]
  },
  {
    href: "/staff/menu",
    label: "Menu",
    icon: <BookOpenText className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["menu.read"]
  },
  {
    href: "/staff/branches",
    label: "Branches",
    icon: <Building2 className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["settings.manage"]
  },
  {
    href: "/staff/login",
    label: "Login",
    icon: <LogIn className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/kitchen",
    label: "Kitchen",
    icon: <ChefHat className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["preparation.read"]
  },
  {
    href: "/staff/waiter",
    label: "Waiter",
    icon: <Bell className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["waiter_calls.read"]
  },
  {
    href: "/staff/owner",
    label: "Owner",
    icon: <ChartNoAxesCombined className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["analytics.read"]
  }
];

export function getVisibleStaffNavItems(input: {
  access?: StaffEffectiveAccess;
  selectedBranchId?: string;
  isAuthenticated?: boolean;
}): AppShellNavItem[] {
  return staffNavItems.filter((item) => {
    if (item.href === "/staff/login") {
      return !input.isAuthenticated;
    }

    if (item.authOnly && !input.isAuthenticated) {
      return false;
    }

    return canAccessStaffRoute({
      access: input.access,
      permissions: item.requiredPermissions,
      branchId: input.selectedBranchId,
      branchScoped: item.branchScoped
    });
  });
}
