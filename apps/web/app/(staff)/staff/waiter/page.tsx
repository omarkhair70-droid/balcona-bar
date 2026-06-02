import { BellRing, Footprints, HandPlatter } from "lucide-react";
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

const floorRows = ["Window lounge", "Garden edge", "Main room"];

export default function StaffWaiterPage() {
  return (
    <StaffPageShell
      title="Floor service surface"
      description="A polished frame for future waiter calls, table attention, and service presence."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Attention"
          value="Calm"
          description="Preview floor state"
          icon={<BellRing className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Sections"
          value="3"
          description="Service zones"
          icon={<Footprints className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Handoff"
          value="Open"
          description="Service surface"
          icon={<HandPlatter className="size-4" aria-hidden="true" />}
        />
      </section>

      <Card className="mt-5" variant="glass" padding="lg">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Floor map
          </Badge>
          <CardTitle>Service zone frame</CardTitle>
          <CardDescription>
            Preview zones keep the waiter surface visually ready for live table
            attention later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {floorRows.map((row) => (
            <div key={row} className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">{row}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                No active request
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </StaffPageShell>
  );
}
