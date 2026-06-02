import { ChartNoAxesCombined, Landmark, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { StaffPageShell } from "@/features/staff/staff-page-shell";

const ownerRows = ["Branch pulse", "Experience profile", "Staff access"];

export default function StaffOwnerPage() {
  return (
    <StaffPageShell
      title="Owner surface"
      description="A premium management frame for future analytics, permissions, branch settings, and audit insight."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Insight"
          value="Pulse"
          description="Analytics space"
          icon={<ChartNoAxesCombined className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Branch"
          value="Balkona"
          description="SaaS-ready scope"
          icon={<Landmark className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Access"
          value="Roles"
          description="Permission surface"
          icon={<ShieldCheck className="size-4" aria-hidden="true" />}
        />
      </section>

      <Card className="mt-5" variant="glass" padding="lg">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Management
          </Badge>
          <CardTitle>Owner console frame</CardTitle>
          <CardDescription>
            Static preview sections reserve space for branch operations without
            connecting live analytics.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {ownerRows.map((row) => (
            <div key={row} className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">{row}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Preview section
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </StaffPageShell>
  );
}
