import { BellRing, Coffee, QrCode, Sparkles, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/features/customer/customer-shell";

const tableMoments = [
  "Welcome drink suggested",
  "Dinner menu surfaced",
  "Service bell available",
  "Bill handoff reserved"
];

const customerStats = [
  {
    label: "Table",
    value: "18",
    description: "Window lounge",
    icon: <QrCode className="size-4" aria-hidden="true" />
  },
  {
    label: "Pace",
    value: "Calm",
    description: "Evening profile",
    icon: <Coffee className="size-4" aria-hidden="true" />
  },
  {
    label: "Signal",
    value: "Ready",
    description: "Service channel",
    icon: <BellRing className="size-4" aria-hidden="true" />
  }
];

export default function CustomerPage() {
  return (
    <CustomerShell
      eyebrow="Balkona table preview"
      title="Your table has its own smart waiter"
      description="A polished mobile-first table surface for menus, service requests, ambience, and guided ordering once the customer phases begin."
      actions={
        <>
          <Button disabled>
            <QrCode className="size-4" aria-hidden="true" />
            Scan table
          </Button>
          <Button variant="secondary" disabled>
            <Utensils className="size-4" aria-hidden="true" />
            View menu
          </Button>
        </>
      }
    >
      <section className="grid gap-4 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <Badge variant="muted">Table session</Badge>
              <Sparkles className="size-5 text-primary" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">Evening service card</CardTitle>
            <CardDescription>
              A real product surface for table identity, branch theme, and
              guest intent before live menu data is connected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="qr-token"
            >
              Table access
            </label>
            <Input
              id="qr-token"
              className="mt-2"
              value="Table link reserved"
              readOnly
              disabled
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {customerStats.map((item) => (
                <div
                  key={item.label}
                  className="rounded-card border bg-surface/70 p-4"
                >
                  <div className="text-primary">{item.icon}</div>
                  <p className="mt-4 text-xs font-semibold uppercase text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {item.value}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button disabled>Start session</Button>
            <Button variant="ghost" disabled>
              Ask for service
            </Button>
          </CardFooter>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              Guest rhythm
            </Badge>
            <CardTitle>Tonight at Balkona</CardTitle>
            <CardDescription>
              Static preview content shaped like the live customer experience.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-3">
              {tableMoments.map((moment, index) => (
                <li
                  key={moment}
                  className="flex items-center gap-3 rounded-card border bg-surface/70 p-3"
                >
                  <span className="flex size-8 items-center justify-center rounded-button bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="text-sm text-foreground">{moment}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </section>
    </CustomerShell>
  );
}
