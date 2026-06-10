"use client";

import Link from "next/link";
import {
  Bell,
  BookOpenText,
  Boxes,
  Building2,
  ChefHat,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  LogIn,
  MonitorPlay,
  Receipt,
  Rocket,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { StaffPageShell } from "@/features/staff/staff-page-shell";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { canAccessStaffRoute } from "@/lib/staff/staff-access";
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

const staffAreas = [
  {
    titleKey: "overview.areaCashierTitle",
    href: "/staff/cashier",
    descriptionKey: "overview.areaCashierDescription",
    icon: <Receipt className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["orders.cashier_review"]
  },
  {
    titleKey: "overview.areaMenuTitle",
    href: "/staff/menu",
    descriptionKey: "overview.areaMenuDescription",
    icon: <BookOpenText className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["menu.read"]
  },
  {
    titleKey: "overview.areaInventoryTitle",
    href: "/staff/inventory",
    descriptionKey: "overview.areaInventoryDescription",
    icon: <Boxes className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["inventory.read"]
  },
  {
    titleKey: "overview.areaSetupTitle",
    href: "/staff/setup",
    descriptionKey: "overview.areaSetupDescription",
    icon: <Rocket className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["tenant_onboarding.read"]
  },
  {
    titleKey: "overview.areaBillingTitle",
    href: "/staff/billing",
    descriptionKey: "overview.areaBillingDescription",
    icon: <CreditCard className="size-5" aria-hidden="true" />,
    stateKey: "overview.new",
    requiredPermissions: ["saas.read"]
  },
  {
    titleKey: "overview.areaBranchesTitle",
    href: "/staff/branches",
    descriptionKey: "overview.areaBranchesDescription",
    icon: <Building2 className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["settings.manage"]
  },
  {
    titleKey: "overview.areaKitchenTitle",
    href: "/staff/kitchen",
    descriptionKey: "overview.areaKitchenDescription",
    icon: <ChefHat className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["preparation.read"]
  },
  {
    titleKey: "overview.areaWaiterTitle",
    href: "/staff/waiter",
    descriptionKey: "overview.areaWaiterDescription",
    icon: <Bell className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["waiter_calls.read"]
  },
  {
    titleKey: "overview.areaOwnerTitle",
    href: "/staff/owner",
    descriptionKey: "overview.areaOwnerDescription",
    icon: <UsersRound className="size-5" aria-hidden="true" />,
    stateKey: "overview.live",
    requiredPermissions: ["owner_analytics.read"]
  }
];

function StaffOverviewContent() {
  const t = useTranslations("staff");
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const staffUser = useStaffAuthStore((state) => state.staffUser);
  const effectiveAccess = useStaffAuthStore((state) => state.effectiveAccess);
  const selectedBranchId = useStaffAuthStore((state) => state.selectedBranchId);
  const setSelectedBranchId = useStaffAuthStore(
    (state) => state.setSelectedBranchId
  );
  const selectedBranch = effectiveAccess?.branches.find(
    (entry) => entry.branch.id === selectedBranchId
  )?.branch;
  const visibleStaffAreas = staffAreas.filter((area) =>
    canAccessStaffRoute({
      access: effectiveAccess,
      permissions: area.requiredPermissions,
      branchId: selectedBranchId,
      branchScoped: true
    })
  );

  if (!accessToken) {
    return (
      <EmptyState
        title={t("overview.notActiveTitle")}
        description={t("overview.notActiveDescription")}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/staff/login" className={buttonVariants()}>
              <LogIn className="size-4" aria-hidden="true" />
              {t("actions.staffLogin")}
            </Link>
            <Link
              href="/demo/balkona"
              className={buttonVariants({ variant: "secondary" })}
            >
              <MonitorPlay className="size-4" aria-hidden="true" />
              {t("actions.demoLauncher")}
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <StaffAuthGate>
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label={t("overview.staff")}
            value={staffUser?.name ? t("overview.active") : t("overview.signedIn")}
            description={staffUser?.email ?? t("overview.sessionRestored")}
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            tone="success"
          />
          <MetricCard
            label={t("selectors.branch")}
            value={selectedBranch?.name ?? t("overview.select")}
            description={t("overview.defaultCashierScope")}
            icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label={t("overview.operations")}
            value={t("overview.ready")}
            description={t("overview.operationsDescription")}
            icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label={t("overview.demo")}
            value={t("overview.demoOpen")}
            description={t("overview.demoDescription")}
            icon={<MonitorPlay className="size-4" aria-hidden="true" />}
            tone="accent"
          />
        </section>

        <Card variant="quiet">
          <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <Badge variant="muted" className="mb-3">
                {t("overview.branchContext")}
              </Badge>
              <CardTitle>{selectedBranch?.name ?? t("overview.chooseBranch")}</CardTitle>
              <CardDescription>{t("overview.branchDescription")}</CardDescription>
            </div>
            <StaffBranchSelector
              access={effectiveAccess}
              selectedBranchId={selectedBranchId}
              onChange={setSelectedBranchId}
              className="min-w-64"
            />
          </CardHeader>
        </Card>

        <Card variant="accent">
          <CardHeader className="gap-4 md:flex md:flex-row md:items-center md:justify-between md:space-y-0">
            <div>
              <Badge variant="muted" className="mb-3">
                Balkona demo
              </Badge>
              <CardTitle>Balkona Bar Full Operating Demo</CardTitle>
              <CardDescription>
                Launch the guided customer-to-owner flow, local credentials,
                readiness checklist, and setup diagnostics from one place.
              </CardDescription>
            </div>
            <Link href="/demo/balkona" className={buttonVariants()}>
              <MonitorPlay className="size-4" aria-hidden="true" />
              Open launcher
            </Link>
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleStaffAreas.map((area) => (
            <Card key={area.href} variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                    {area.icon}
                  </div>
                  <Badge
                    variant={
                      area.stateKey === "overview.live" ? "success" : "muted"
                    }
                  >
                    {t(area.stateKey)}
                  </Badge>
                </div>
                <CardTitle>{t(area.titleKey)}</CardTitle>
                <CardDescription>{t(area.descriptionKey)}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Link
                  href={area.href}
                  className={buttonVariants({
                    variant:
                      area.stateKey === "overview.live"
                        ? "primary"
                        : "secondary",
                    size: "sm"
                  })}
                >
                  {t("actions.openSurface")}
                </Link>
              </CardFooter>
            </Card>
          ))}
        </section>
      </div>
    </StaffAuthGate>
  );
}

export function StaffOverviewPage() {
  const t = useTranslations("staff");

  return (
    <StaffPageShell
      title={t("overview.commandTitle")}
      description={t("overview.commandDescription")}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link href="/staff/login" className={buttonVariants({ variant: "secondary" })}>
            <LogIn className="size-4" aria-hidden="true" />
            {t("actions.staffLogin")}
          </Link>
          <Link href="/demo/balkona" className={buttonVariants({ variant: "secondary" })}>
            <MonitorPlay className="size-4" aria-hidden="true" />
            {t("actions.demoLauncher")}
          </Link>
        </div>
      }
    >
      <StaffOverviewContent />
    </StaffPageShell>
  );
}
