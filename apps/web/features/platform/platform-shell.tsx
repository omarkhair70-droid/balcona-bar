"use client";

import { Building2, KeyRound, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { usePlatformAuthStore } from "@/lib/platform/platform-auth-store";
import { getPlatformNavItems } from "./platform-navigation";

type PlatformShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  supporting?: ReactNode;
  children: ReactNode;
};

export function PlatformShell({
  title,
  description,
  actions,
  supporting,
  children
}: PlatformShellProps) {
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const navItems = getPlatformNavItems(Boolean(accessToken));

  return (
    <DashboardShell
      productLabel="Balcona Platform"
      eyebrow="Internal onboarding"
      title={title}
      description={description}
      navItems={navItems}
      actions={actions}
      supporting={
        supporting ?? (
          <div className="grid gap-3">
            <MetricCard
              label="Scope"
              value="Platform"
              description="Cross-tenant admin only"
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Flow"
              value="Sales"
              description="Cafe workspace bootstrap"
              icon={<Building2 className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label="Auth"
              value="Separate"
              description="Not tenant staff auth"
              icon={<KeyRound className="size-4" aria-hidden="true" />}
            />
          </div>
        )
      }
    >
      {children}
    </DashboardShell>
  );
}
