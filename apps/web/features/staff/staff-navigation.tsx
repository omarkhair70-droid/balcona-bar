import {
  Bell,
  ChartNoAxesCombined,
  ChefHat,
  LayoutDashboard,
  LogIn,
  Receipt
} from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";

export const staffNavItems: AppShellNavItem[] = [
  {
    href: "/staff",
    label: "Overview",
    icon: <LayoutDashboard className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/cashier",
    label: "Cashier",
    icon: <Receipt className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/login",
    label: "Login",
    icon: <LogIn className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/kitchen",
    label: "Kitchen",
    icon: <ChefHat className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/waiter",
    label: "Waiter",
    icon: <Bell className="size-4" aria-hidden="true" />
  },
  {
    href: "/staff/owner",
    label: "Owner",
    icon: <ChartNoAxesCombined className="size-4" aria-hidden="true" />
  }
];
