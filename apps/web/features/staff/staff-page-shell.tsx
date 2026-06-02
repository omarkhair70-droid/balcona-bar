import { type ReactNode } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { staffNavItems } from "./staff-navigation";

type StaffPageShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function StaffPageShell({
  title,
  description,
  children,
  actions
}: StaffPageShellProps) {
  return (
    <AppShell
      eyebrow="Staff operations foundation"
      title={title}
      description={description}
      navItems={staffNavItems}
      actions={actions}
    >
      {children}
    </AppShell>
  );
}
