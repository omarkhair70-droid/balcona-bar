import {
  Activity,
  Building2,
  LayoutDashboard,
  LogIn,
  PlusCircle
} from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";

export type PlatformNavItem = AppShellNavItem & {
  labelKey?: string;
};

export function getPlatformNavItems(isAuthenticated?: boolean): PlatformNavItem[] {
  const items: PlatformNavItem[] = [
    {
      href: "/platform",
      label: "Companies",
      labelKey: "navigation.companies",
      icon: <Building2 className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/companies/new",
      label: "Add Cafe",
      labelKey: "navigation.addCafe",
      icon: <PlusCircle className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/status",
      label: "Status",
      labelKey: "navigation.status",
      icon: <Activity className="size-4" aria-hidden="true" />
    }
  ];

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
    ...items
  ];
}
