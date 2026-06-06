import { Building2, LayoutDashboard, LogIn, PlusCircle } from "lucide-react";
import type { AppShellNavItem } from "@/components/ui/app-shell";

export function getPlatformNavItems(isAuthenticated?: boolean): AppShellNavItem[] {
  const items: AppShellNavItem[] = [
    {
      href: "/platform",
      label: "Companies",
      icon: <Building2 className="size-4" aria-hidden="true" />
    },
    {
      href: "/platform/companies/new",
      label: "Add Cafe",
      icon: <PlusCircle className="size-4" aria-hidden="true" />
    }
  ];

  if (!isAuthenticated) {
    return [
      {
        href: "/platform/login",
        label: "Login",
        icon: <LogIn className="size-4" aria-hidden="true" />
      }
    ];
  }

  return [
    {
      href: "/platform",
      label: "Dashboard",
      icon: <LayoutDashboard className="size-4" aria-hidden="true" />
    },
    ...items
  ];
}
