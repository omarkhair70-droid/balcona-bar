import { type ReactNode } from "react";
import { Bot, MenuSquare, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

type AiChatShellProps = {
  title: string;
  description: string;
  tone: string;
  status: ReactNode;
  children: ReactNode;
  side: ReactNode;
};

export function AiChatShell({
  title,
  description,
  tone,
  status,
  children,
  side
}: AiChatShellProps) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-primary">
                <Bot className="size-7" aria-hidden="true" />
              </div>
              {status}
            </div>
            <Badge variant="muted" className="w-fit">
              {tone}
            </Badge>
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-card border bg-surface/75 p-3">
                <ShieldCheck className="size-4 text-success" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  AI suggests. You confirm.
                </p>
              </div>
              <div className="rounded-card border bg-surface/75 p-3">
                <MenuSquare className="size-4 text-primary" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  Based on branch menu and availability.
                </p>
              </div>
              <div className="rounded-card border bg-surface/75 p-3">
                <ShieldCheck className="size-4 text-warning" aria-hidden="true" />
                <p className="mt-2 text-xs font-semibold text-foreground">
                  Cart validation keeps price authority.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="mt-5">{children}</div>
      </div>
      <aside className="grid h-fit gap-5">{side}</aside>
    </section>
  );
}
