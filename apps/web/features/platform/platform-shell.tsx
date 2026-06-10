"use client";

import { Building2, KeyRound, ShieldCheck } from "lucide-react";
import { type ReactNode } from "react";
import { DashboardShell } from "@/components/ui/dashboard-shell";
import { MetricCard } from "@/components/ui/metric-card";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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
  const t = useTranslations("platform");
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const navItems = getPlatformNavItems(Boolean(accessToken)).map((item) => ({
    ...item,
    label: item.labelKey ? t(item.labelKey) : item.label
  }));

  return (
    <DashboardShell
      productLabel={t("productLabel")}
      productSubtitle={t("platformConsole")}
      eyebrow={t("internalOnboarding")}
      title={title}
      description={description}
      navItems={navItems}
      actions={actions}
      supporting={
        supporting ?? (
          <div className="grid gap-3">
            <MetricCard
              label={t("shell.scopeLabel")}
              value={t("shell.scopeValue")}
              description={t("shell.scopeDescription")}
              icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label={t("shell.flowLabel")}
              value={t("shell.flowValue")}
              description={t("shell.flowDescription")}
              icon={<Building2 className="size-4" aria-hidden="true" />}
            />
            <MetricCard
              label={t("shell.authLabel")}
              value={t("shell.authValue")}
              description={t("shell.authDescription")}
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
