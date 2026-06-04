"use client";

import { Activity, Radio, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { getVisibleStaffNavItems } from "./staff-navigation";

type StaffShellFrameProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  supporting?: ReactNode;
  children: ReactNode;
};

export function StaffShellFrame({
  title,
  description,
  actions,
  supporting,
  children
}: StaffShellFrameProps) {
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const navItems = getVisibleStaffNavItems({
    access: effectiveAccess,
    selectedBranchId,
    isAuthenticated: Boolean(accessToken)
  });

  return (
    <DashboardShell
      productLabel="Balkona Staff"
      eyebrow="Operator shell"
      title={title}
      description={description}
      navItems={navItems}
      actions={actions}
      supporting={
        supporting ?? (
          <div className="grid gap-3">
            <MetricCard
              label="Signal"
              value="SSE"
              description="Realtime channel surface"
              icon={<Radio className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Access"
              value="RBAC"
              description="Permission-aware routes"
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Mode"
              value="Staff"
              description="Operational surfaces"
              icon={<Activity className="size-4" aria-hidden="true" />}
            />
          </div>
        )
      }
    >
      {children}
    </DashboardShell>
  );
}
