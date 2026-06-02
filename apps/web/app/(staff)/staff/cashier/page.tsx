import { CheckCircle2, Receipt, Timer } from "lucide-react";
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

const intakeRows = ["New table order", "Bill review", "Service handoff"];

export default function StaffCashierPage() {
  return (
    <StaffPageShell
      title="Cashier surface"
      description="A polished intake frame for future smart cashier workflows, shaped around orders, bills, and service handoffs."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Lane"
          value="Intake"
          description="Order acceptance space"
          icon={<Receipt className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Pace"
          value="4m"
          description="Preview response time"
          icon={<Timer className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="State"
          value="Clear"
          description="No live data connected"
          icon={<CheckCircle2 className="size-4" aria-hidden="true" />}
          tone="success"
        />
      </section>

      <Card className="mt-5" variant="glass" padding="lg">
        <CardHeader>
          <Badge variant="muted" className="w-fit">
            Cashier lane
          </Badge>
          <CardTitle>Service-ready intake board</CardTitle>
          <CardDescription>
            Static rows show the density and rhythm expected once cashier data
            is connected.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {intakeRows.map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-4 rounded-card border bg-surface/75 p-4"
            >
              <span className="text-sm font-medium text-foreground">{row}</span>
              <Badge variant="muted">Preview</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </StaffPageShell>
  );
}
