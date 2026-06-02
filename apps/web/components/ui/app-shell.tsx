import Link from "next/link";
import { type ReactNode } from "react";
import { Badge } from "./badge";
import { cn } from "@/lib/utils/cn";

export type AppShellNavItem = {
  href: string;
  label: string;
  icon?: ReactNode;
};

type AppShellProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  navItems?: AppShellNavItem[];
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppShell({
  title,
  eyebrow,
  description,
  navItems = [],
  actions,
  children,
  className
}: AppShellProps) {
  return (
    <div className={cn("mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8", className)}>
      <header className="flex flex-col gap-5 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <Badge variant="muted" className="mb-3">
              {eyebrow}
            </Badge>
          ) : null}
          <h1 className="text-3xl font-semibold text-foreground md:text-4xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </header>

      {navItems.length > 0 ? (
        <nav
          className="flex gap-2 overflow-x-auto border-b py-3"
          aria-label="App sections"
        >
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-button px-3 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      <main className="flex-1 py-6">{children}</main>
    </div>
  );
}
