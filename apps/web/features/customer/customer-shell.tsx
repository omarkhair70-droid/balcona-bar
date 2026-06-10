"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { BellRing, Coffee, ConciergeBell, QrCode, Sparkles } from "lucide-react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";

type CustomerShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

const ambientItems = [
  {
    label: "Table",
    value: "18",
    icon: <QrCode className="size-4" aria-hidden="true" />
  },
  {
    label: "Mood",
    value: "Evening",
    icon: <Coffee className="size-4" aria-hidden="true" />
  },
  {
    label: "Service",
    value: "Calm",
    icon: <ConciergeBell className="size-4" aria-hidden="true" />
  }
];

export function CustomerShell({
  title,
  description,
  eyebrow,
  actions,
  children,
  className
}: CustomerShellProps) {
  const t = useTranslations("customer");

  return (
    <main
      className={cn(
        "mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8",
        className
      )}
    >
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-button bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Balkona
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("smartTable")}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="muted">{t("previewService")}</Badge>
          <LanguageSwitcher />
        </div>
      </header>

      <section className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1fr_22rem]">
        <div>
          {eyebrow ? (
            <Badge className="mb-5 w-fit">{eyebrow}</Badge>
          ) : null}
          <h1 className="max-w-3xl text-4xl font-semibold text-foreground md:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            {description}
          </p>
          {actions ? (
            <div className="mt-8 flex flex-wrap gap-3">{actions}</div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/staff"
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("staffView")}
              </Link>
            </div>
          )}
        </div>

        <Card variant="glass" className="overflow-hidden">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Tonight
              </p>
              <p className="mt-1 text-lg font-semibold text-foreground">
                Balcony lounge
              </p>
            </div>
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {ambientItems.map((item) => (
              <div key={item.label} className="rounded-card bg-muted p-3">
                <div className="text-primary">{item.icon}</div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {item.label}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-card border bg-surface/80 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-button bg-accent text-accent-foreground">
                <BellRing className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Evening service pace
                </p>
                <p className="text-xs text-muted-foreground">
                  Warm contrast, calm spacing, table-first layout
                </p>
              </div>
            </div>
          </div>
        </Card>
      </section>

      {children}
    </main>
  );
}
