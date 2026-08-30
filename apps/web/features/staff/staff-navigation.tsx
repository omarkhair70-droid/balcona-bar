import {
  Bell,
  BookOpenText,
  Boxes,
  Building2,
  ChartNoAxesCombined,
  ChefHat,
  CreditCard,
  LayoutDashboard,
  LogIn,
  Receipt,
  Rocket
} from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";
import type { StaffEffectiveAccess } from "@/lib/api/types";
import {
  canAccessStaffRoute,
  type StaffPermission
} from "@/lib/staff/staff-access";

export type StaffNavItem = AppShellNavItem & {
  labelKey?: string;
  requiredPermissions?: StaffPermission[];
  branchScoped?: boolean;
  authOnly?: boolean;
};

export const staffNavItems: StaffNavItem[] = [
  {
    href: "/staff",
    label: "Overview",
    labelKey: "navigation.overview",
    icon: <LayoutDashboard className="size-4" aria-hidden="true" />
  },
  {
    href: "/service/cashier",
    label: "Cashier",
    labelKey: "navigation.cashier",
    icon: <Receipt className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["orders.cashier_review"]
  },
  {
    href: "/office/catalog",
    label: "Menu",
    labelKey: "navigation.menu",
    icon: <BookOpenText className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["menu.read"]
  },
  {
    href: "/office/inventory",
    label: "Inventory",
    labelKey: "navigation.inventory",
    icon: <Boxes className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["inventory.read"]
  },
  {
    href: "/setup",
    label: "Setup",
    labelKey: "navigation.setup",
    icon: <Rocket className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["tenant_onboarding.read"]
  },
  {
    href: "/office/account",
    label: "Billing",
    labelKey: "navigation.billing",
    icon: <CreditCard className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["saas.read"]
  },
  {
    href: "/office/locations",
    label: "Branches",
    labelKey: "navigation.branches",
    icon: <Building2 className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["settings.manage"]
  },
  {
    href: "/staff/login",
    label: "Login",
    labelKey: "navigation.login",
    icon: <LogIn className="size-4" aria-hidden="true" />
  },
  {
    href: "/kitchen",
    label: "Kitchen",
    labelKey: "navigation.kitchen",
    icon: <ChefHat className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["preparation.read"]
  },
  {
    href: "/service/waiter",
    label: "Waiter",
    labelKey: "navigation.waiter",
    icon: <Bell className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["waiter_calls.read"]
  },
  {
    href: "/office",
    label: "Owner",
    labelKey: "navigation.owner",
    icon: <ChartNoAxesCombined className="size-4" aria-hidden="true" />,
    authOnly: true,
    branchScoped: true,
    requiredPermissions: ["owner_analytics.read"]
  }
];

export function getVisibleStaffNavItems(input: {
  access?: StaffEffectiveAccess;
  selectedBranchId?: string;
  isAuthenticated?: boolean;
}): StaffNavItem[] {
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
