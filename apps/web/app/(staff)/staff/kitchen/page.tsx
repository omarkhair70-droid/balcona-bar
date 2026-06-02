import { ChefHat, Flame, Timer } from "lucide-react";
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

const stationRows = ["Barista station", "Hot kitchen", "Expo handoff"];

export default function StaffKitchenPage() {
  return (
    <StaffPageShell
      title="Preparation surface"
      description="A premium preparation frame for future station views and realtime production signals."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Station"
          value="3"
          description="Preview sections"
          icon={<ChefHat className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Heat"
          value="Low"
          description="Calm service state"
          icon={<Flame className="size-4" aria-hidden="true" />}
          tone="warning"
        />
        <MetricCard
          label="Pace"
          value="8m"
          description="Target prep rhythm"
          icon={<Timer className="size-4" aria-hidden="true" />}
        />
      </section>

      <Card className="mt-5" variant="glass" padding="lg">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Preparation
          </Badge>
          <CardTitle>Station board frame</CardTitle>
          <CardDescription>
            The layout is ready for operational cards while remaining static in
            this phase.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {stationRows.map((row) => (
            <div key={row} className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">{row}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                Preview lane
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </StaffPageShell>
  );
}
