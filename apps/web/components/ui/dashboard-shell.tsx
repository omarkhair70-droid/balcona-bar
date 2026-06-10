"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Badge } from "./badge";
import type { AppShellNavItem } from "./app-shell";
import { cn } from "@/lib/utils/cn";

type DashboardShellProps = {
  productLabel: string;
  title: string;
  description: string;
  productSubtitle?: string;
  eyebrow?: string;
  navItems?: AppShellNavItem[];
  actions?: ReactNode;
  supporting?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function DashboardShell({
  productLabel,
  title,
  description,
  productSubtitle = "Smart cafe OS",
  eyebrow,
  navItems = [],
  actions,
  supporting,
  children,
  className
}: DashboardShellProps) {
  return (
    <div
      className={cn(
        "mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[17rem_1fr] lg:px-8",
        className
      )}
    >
      <aside className="hidden rounded-card border bg-surface/70 p-4 shadow-card lg:block">
        <div className="flex items-center gap-3 border-b pb-4">
          <div className="flex size-10 items-center justify-center rounded-button bg-primary text-primary-foreground">
            B
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {productLabel}
            </p>
            <p className="text-xs text-muted-foreground">{productSubtitle}</p>
          </div>
        </div>
        {navItems.length > 0 ? (
          <nav className="mt-4 grid gap-1" aria-label="Dashboard sections">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center gap-3 rounded-button px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
        {supporting ? <div className="mt-5">{supporting}</div> : null}
      </aside>

      <div className="min-w-0">
        <header className="premium-surface rounded-card p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              {eyebrow ? (
                <Badge variant="muted" className="mb-3">
                  {eyebrow}
                </Badge>
              ) : null}
              <h1 className="max-w-3xl text-3xl font-semibold text-foreground md:text-5xl">
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                {description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {actions}
              <LanguageSwitcher />
            </div>
          </div>

          {navItems.length > 0 ? (
            <nav
              className="mt-5 flex gap-2 overflow-x-auto border-t pt-4 lg:hidden"
              aria-label="Dashboard sections"
            >
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-button bg-muted px-3 text-sm text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </header>

        <main className="py-6">{children}</main>
      </div>
    </div>
  );
}
