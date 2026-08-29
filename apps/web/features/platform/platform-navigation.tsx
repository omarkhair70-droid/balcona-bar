import {
  Activity,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  LogIn,
  Plus
} from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";

export type PlatformNavItem = AppShellNavItem & {
  labelKey?: string;
};

export function getPlatformNavItems(isAuthenticated?: boolean): PlatformNavItem[] {
  if (!isAuthenticated) {
    return [
      {
        href: "/platform/login",
        label: "Login",
        labelKey: "navigation.login",
        icon: <LogIn className="size-4" aria-hidden="true" />
      }
    ];
  }

  return [
    {
      href: "/platform",
      label: "Dashboard",
      labelKey: "navigation.dashboard",
      icon: <LayoutDashboard className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/companies",
      label: "Companies",
      labelKey: "navigation.companies",
      icon: <Building2 className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/companies/new",
      label: "New Cafe",
      labelKey: "navigation.addCafe",
      icon: <Plus className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/plans",
      label: "Plans",
      labelKey: "navigation.plans",
      icon: <CircleDollarSign className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/status",
      label: "System Status",
      labelKey: "navigation.status",
      icon: <Activity className="size-4" aria-hidden="true" />
    }
  ];
}
