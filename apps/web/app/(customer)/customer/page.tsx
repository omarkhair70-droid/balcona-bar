import { Coffee, QrCode, Sparkles, Wifi } from "lucide-react";
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

const customerFoundations = [
  {
    title: "Experience profile ready",
    description:
      "This shell can receive backend design tokens without locking the product to one cafe.",
    icon: <Sparkles className="size-5" aria-hidden="true" />
  },
  {
    title: "Table session entry",
    description:
      "QR session start helpers exist, with the full ordering flow left for the next phase.",
    icon: <QrCode className="size-5" aria-hidden="true" />
  },
  {
    title: "PWA installation base",
    description:
      "Manifest and static asset caching are prepared without caching live order data.",
    icon: <Wifi className="size-5" aria-hidden="true" />
  }
];

export default function CustomerPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <section className="flex flex-1 flex-col justify-center py-10">
        <Badge className="w-fit">Customer PWA foundation ready</Badge>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold text-foreground md:text-6xl">
          Your table has its own smart waiter
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
          A premium mobile-first shell for table sessions, menus, waiter calls,
          and AI assistance once the next customer phases begin.
        </p>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="bg-surface/90">
            <CardHeader>
              <div className="text-primary">
                <Coffee className="size-6" aria-hidden="true" />
              </div>
              <CardTitle>Smart table entry placeholder</CardTitle>
              <CardDescription>
                The foundation keeps QR/session input separate from the full
                customer ordering implementation.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <label className="text-sm font-medium text-foreground" htmlFor="qr-token">
                Table QR token
              </label>
              <Input
                id="qr-token"
                className="mt-2"
                placeholder="Connected later through QR deep links"
                disabled
              />
            </CardContent>
            <CardFooter>
              <Button disabled>Start table session</Button>
              <Button variant="ghost" disabled>
                Preview menu
              </Button>
            </CardFooter>
          </Card>

          <div className="grid gap-4">
            {customerFoundations.map((item) => (
              <Card key={item.title} className="bg-surface/80">
                <CardHeader>
                  <div className="text-primary">{item.icon}</div>
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
