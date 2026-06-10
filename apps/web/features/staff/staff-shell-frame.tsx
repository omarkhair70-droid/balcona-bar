"use client";

import { Activity, Radio, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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
  const t = useTranslations("staff");
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const navItems = getVisibleStaffNavItems({
    access: effectiveAccess,
    selectedBranchId,
    isAuthenticated: Boolean(accessToken)
  }).map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label
  }));

  return (
    <DashboardShell
      productLabel={t("productLabel")}
      productSubtitle={t("smartCafeOs")}
      eyebrow={t("operatorShell")}
      title={title}
      description={description}
      navItems={navItems}
      actions={actions}
      supporting={
        supporting ?? (
          <div className="grid gap-3">
            <MetricCard
              label={t("shell.signalLabel")}
              value={t("shell.signalValue")}
              description={t("shell.signalDescription")}
              icon={<Radio className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label={t("shell.accessLabel")}
              value={t("shell.accessValue")}
              description={t("shell.accessDescription")}
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label={t("shell.modeLabel")}
              value={t("shell.modeValue")}
              description={t("shell.modeDescription")}
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
