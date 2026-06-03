"use client";

import Link from "next/link";
import {
  Bell,
  ChefHat,
  ClipboardCheck,
  LayoutDashboard,
  LogIn,
  Receipt,
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
import { useStaffAuthStore } from "@/lib/staff/staff-auth-store";
import { StaffAuthGate } from "../components/staff-auth-gate";
import { StaffBranchSelector } from "../components/staff-branch-selector";

const staffAreas = [
  {
    title: "Cashier",
    href: "/staff/cashier",
    description: "Live order intake, bill requests, and cashier decisions.",
    icon: <Receipt className="size-5" aria-hidden="true" />,
    state: "Live"
  },
  {
    title: "Kitchen",
    href: "/staff/kitchen",
    description: "Preparation board shell for station-aware operations.",
    icon: <ChefHat className="size-5" aria-hidden="true" />,
    state: "Preview"
  },
  {
    title: "Waiter",
    href: "/staff/waiter",
    description: "Table attention, requests, and floor signal surface.",
    icon: <Bell className="size-5" aria-hidden="true" />,
    state: "Preview"
  },
  {
    title: "Owner",
    href: "/staff/owner",
    description: "Operating pulse, permissions, and branch insight surface.",
    icon: <UsersRound className="size-5" aria-hidden="true" />,
    state: "Preview"
  }
];

function StaffOverviewContent() {
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

  if (!accessToken) {
    return (
      <EmptyState
        title="Staff session is not active"
        description="Sign in to select a branch and open the cashier dashboard."
        action={
          <Link href="/staff/login" className={buttonVariants()}>
            <LogIn className="size-4" aria-hidden="true" />
            Staff login
          </Link>
        }
      />
    );
  }

  return (
    <StaffAuthGate>
      <div className="grid gap-5">
        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Staff"
            value={staffUser?.name ? "Active" : "Signed in"}
            description={staffUser?.email ?? "Session restored"}
            icon={<ShieldCheck className="size-4" aria-hidden="true" />}
            tone="success"
          />
          <MetricCard
            label="Branch"
            value={selectedBranch?.name ?? "Select"}
            description="Default cashier scope"
            icon={<LayoutDashboard className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Cashier"
            value="Ready"
            description="Orders and bills connected"
            icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
          />
        </section>

        <Card variant="quiet">
          <CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between md:space-y-0">
            <div>
              <Badge variant="muted" className="mb-3">
                Branch context
              </Badge>
              <CardTitle>{selectedBranch?.name ?? "Choose a branch"}</CardTitle>
              <CardDescription>
                The selected branch drives cashier orders, bill requests, and
                branch realtime refresh.
              </CardDescription>
            </div>
            <StaffBranchSelector
              access={effectiveAccess}
              selectedBranchId={selectedBranchId}
              onChange={setSelectedBranchId}
              className="min-w-64"
            />
          </CardHeader>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {staffAreas.map((area) => (
            <Card key={area.href} variant="glass">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                    {area.icon}
                  </div>
                  <Badge variant={area.state === "Live" ? "success" : "muted"}>
                    {area.state}
                  </Badge>
                </div>
                <CardTitle>{area.title}</CardTitle>
                <CardDescription>{area.description}</CardDescription>
              </CardHeader>
              <CardFooter>
                <Link
                  href={area.href}
                  className={buttonVariants({
                    variant: area.state === "Live" ? "primary" : "secondary",
                    size: "sm"
                  })}
                >
                  Open surface
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
  return (
    <StaffPageShell
      title="Staff command surface"
      description="Branch-aware staff operations with cashier intake connected first and the remaining staff dashboards still held as preview shells."
      actions={
        <Link href="/staff/login" className={buttonVariants({ variant: "secondary" })}>
          <LogIn className="size-4" aria-hidden="true" />
          Staff login
        </Link>
      }
    >
      <StaffOverviewContent />
    </StaffPageShell>
  );
}
