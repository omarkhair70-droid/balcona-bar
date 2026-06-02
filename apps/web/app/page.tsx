import Link from "next/link";
import {
  ArrowRight,
  MonitorSmartphone,
  Radio,
  Sparkles,
  Store
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

const foundations = [
  {
    title: "Dynamic theme shell",
    description:
      "CSS variables are ready for branch experience profiles and design tokens.",
    icon: <Sparkles className="size-5" aria-hidden="true" />
  },
  {
    title: "API and realtime clients",
    description:
      "Typed fetch helpers, React Query, and an SSE client are ready to wire.",
    icon: <Radio className="size-5" aria-hidden="true" />
  },
  {
    title: "Customer and staff routes",
    description:
      "Route groups keep guest and operator experiences together for now.",
    icon: <MonitorSmartphone className="size-5" aria-hidden="true" />
  }
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="max-w-3xl">
        <Badge>UI Phase 1</Badge>
        <h1 className="mt-5 text-4xl font-semibold text-foreground md:text-6xl">
          Balcona Bar smart cafe foundation
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          A Balkona-first, SaaS-ready web app shell for customer PWA flows,
          staff operations, dynamic theming, API calls, realtime events, and
          future experience profiles.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/customer"
            className={buttonVariants({ variant: "primary", size: "lg" })}
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
      </section>

      <section className="mt-12 grid gap-4 md:grid-cols-3" aria-label="Foundation areas">
        {foundations.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <div className="text-primary">{item.icon}</div>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>
    </main>
  );
}
