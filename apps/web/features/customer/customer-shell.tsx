"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Badge } from "@/components/ui/badge";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { cn } from "@/lib/utils/cn";
import { guestThemeStyle } from "./customer-theme";

type CustomerShellProps = {
  title: string;
  description: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

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
    <div
      data-customer-theme-root
      style={guestThemeStyle}
      className="min-h-screen w-full bg-background text-foreground"
    >
      <main
        className={cn(
          "mx-auto min-h-screen w-full max-w-md bg-background px-4 pb-10",
          className
        )}
      >
        <header className="sticky top-0 z-30 -mx-4 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <Link href="/customer" className="min-w-0">
            <span className="block truncate text-sm font-black tracking-[-0.02em] text-foreground">
              Balcona
            </span>
            <span className="mt-0.5 block truncate text-[10px] font-semibold text-muted-foreground">
              {t("shell.guestOrdering")}
            </span>
          </Link>
          <LanguageSwitcher />
        </header>

        <section className="pb-5 pt-7">
          {eyebrow ? (
            <Badge
              variant="muted"
              className="mb-2 w-fit text-[10px] font-bold uppercase tracking-[0.12em]"
            >
              {eyebrow}
            </Badge>
          ) : null}
          <h1 className="text-[32px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {actions ? <div className="mt-5 grid gap-2">{actions}</div> : null}
        </section>

        {children}
      </main>
    </div>
  );
}
