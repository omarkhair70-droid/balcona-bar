import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  ClipboardList,
  MonitorSmartphone,
  MonitorPlay,
  Radio,
  Sparkles,
  Store,
  SwatchBook
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";

const systemPillars = [
  {
    title: "Design token core",
    description:
      "Branch personality, spacing, surfaces, and state colors live behind CSS variables.",
    icon: <SwatchBook className="size-5" aria-hidden="true" />
  },
  {
    title: "Realtime-ready shell",
    description:
      "Operator screens refresh around live service signals across staff dashboards.",
    icon: <Radio className="size-5" aria-hidden="true" />
  },
  {
    title: "Customer and staff split",
    description:
      "Guest and operator routes share primitives while keeping their product rhythms distinct.",
    icon: <MonitorSmartphone className="size-5" aria-hidden="true" />
  }
];

export default function HomePage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <section className="flex flex-col justify-center">
        <Badge className="w-fit">UI Phase 8</Badge>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold text-foreground md:text-6xl">
          Premium smart cafe product shell
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          A Balkona-first visual system for table service, staff operations,
          dynamic branch theming, and future SaaS cafe experiences.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/demo/balkona"
            className={buttonVariants({ variant: "primary", size: "lg" })}
          >
            Full demo launcher
            <MonitorPlay className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/customer"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Customer shell
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
          <Link
            href="/staff"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            Staff shell
            <Store className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3" aria-label="System status">
          <MetricCard
            label="Theme"
            value="Warm"
            description="Cafe-first default"
            icon={<Sparkles className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Routes"
            value="Demo"
            description="Customer and staff flow"
            icon={<ClipboardList className="size-4" aria-hidden="true" />}
          />
          <MetricCard
            label="Alerts"
            value="Ready"
            description="Haptics and sound"
            icon={<BellRing className="size-4" aria-hidden="true" />}
          />
        </section>
      </section>

      <section className="flex items-center">
        <Card variant="glass" className="w-full" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              Product architecture
            </Badge>
            <CardTitle className="text-2xl">
              One shell, many cafe experiences
            </CardTitle>
            <CardDescription>
              The first web app carries shared primitives, route structure, and
              tokenized brand surfaces before the product grows into full flows.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {systemPillars.map((pillar) => (
              <div
                key={pillar.title}
                className="grid grid-cols-[auto_1fr] gap-4 rounded-card border bg-surface/70 p-4"
              >
                <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                  {pillar.icon}
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {pillar.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {pillar.description}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
