import Link from "next/link";
import {
  Bell,
  ChefHat,
  ClipboardCheck,
  Radio,
  Receipt,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

const staffAreas = [
  {
    title: "Cashier",
    href: "/staff/cashier",
    description: "Order intake, bill review, and service handoff surface.",
    icon: <Receipt className="size-5" aria-hidden="true" />
  },
  {
    title: "Kitchen",
    href: "/staff/kitchen",
    description: "Preparation board shell for station-aware operations.",
    icon: <ChefHat className="size-5" aria-hidden="true" />
  },
  {
    title: "Waiter",
    href: "/staff/waiter",
    description: "Table attention, requests, and floor signal surface.",
    icon: <Bell className="size-5" aria-hidden="true" />
  },
  {
    title: "Owner",
    href: "/staff/owner",
    description: "Operating pulse, permissions, and branch insight surface.",
    icon: <UsersRound className="size-5" aria-hidden="true" />
  }
];

const operatingPulseRows = [
  "Table service",
  "Preparation",
  "Guest attention"
];

export default function StaffPage() {
  return (
    <StaffPageShell
      title="Staff command surface"
      description="A premium dashboard shell for cafe operators, built from reusable primitives and ready for live backend data in later UI phases."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Realtime"
          value="SSE"
          description="Event stream surface"
          icon={<Radio className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Access"
          value="Scoped"
          description="Role-aware shell"
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Handoff"
          value="Bill"
          description="Review space"
          icon={<ClipboardCheck className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {staffAreas.map((area) => (
          <Card key={area.href} variant="glass">
            <CardHeader>
              <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                {area.icon}
              </div>
              <CardTitle>{area.title}</CardTitle>
              <CardDescription>{area.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Link
                href={area.href}
                className={buttonVariants({
                  variant: "secondary",
                  size: "sm"
                })}
              >
                Open surface
              </Link>
            </CardFooter>
          </Card>
        ))}
      </section>

      <Card className="mt-5" variant="elevated" padding="lg">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Operating pulse
          </Badge>
          <CardTitle>Branch overview frame</CardTitle>
          <CardDescription>
            Static preview rows reserve space for analytics and live attention
            events without connecting dashboards in this phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {operatingPulseRows.map((label) => (
            <div key={label} className="rounded-card border bg-surface/70 p-4">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <div className="mt-4 h-2 rounded-full bg-muted">
                <div className="h-2 w-2/3 rounded-full bg-primary" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Preview state
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </StaffPageShell>
  );
}
