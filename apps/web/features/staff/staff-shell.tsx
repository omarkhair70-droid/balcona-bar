import { Activity, Radio, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { staffNavItems } from "./staff-navigation";

type StaffShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function StaffShell({
  title,
  description,
  actions,
  children
}: StaffShellProps) {
  return (
    <DashboardShell
      productLabel="Balkona Staff"
      eyebrow="Operator shell"
      title={title}
      description={description}
      navItems={staffNavItems}
      actions={actions}
      supporting={
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
            value="Preview"
            description="Static operational state"
            icon={<Activity className="size-4" aria-hidden="true" />}
          />
        </div>
      }
    >
      {children}
    </DashboardShell>
  );
}
