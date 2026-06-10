"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, MonitorPlay, QrCode, RotateCcw, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/features/customer/customer-shell";
import { balkonaDemoQrToken } from "@/features/demo/balkona-demo";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";

export function CustomerEntryPage() {
  const router = useRouter();
  const t = useTranslations("customer");
  const [qrToken, setQrToken] = useState("");
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const clearSession = useCustomerSessionStore((state) => state.clearSession);
  const tokenToOpen = qrToken.trim() || balkonaDemoQrToken;

  function openTable() {
    router.push(`/customer/table/${encodeURIComponent(tokenToOpen)}`);
  }

  return (
    <CustomerShell
      eyebrow={t("entry.eyebrow")}
      title={t("entry.title")}
      description={t("entry.description")}
      actions={
        <>
          <Button onClick={openTable}>
            <QrCode className="size-4" aria-hidden="true" />
            {t("actions.openTable")}
          </Button>
          {storedSessionId ? (
            <Button
              variant="secondary"
              onClick={() => router.push(`/customer/session/${storedSessionId}`)}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              {t("actions.resume")}
            </Button>
          ) : null}
        </>
      }
    >
      <section className="grid gap-4 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              {t("entry.tableLinkBadge")}
            </Badge>
            <CardTitle>{t("entry.tableTokenTitle")}</CardTitle>
            <CardDescription>
              {t("entry.tableTokenDescription")}
            </CardDescription>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-6">
            <Input
              value={qrToken}
              onChange={(event) => setQrToken(event.target.value)}
              placeholder={balkonaDemoQrToken}
              aria-label={t("aria.tableQrToken")}
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={openTable}>
                <QrCode className="size-4" aria-hidden="true" />
                {t("actions.continue")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearSession();
                  setQrToken("");
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                {t("actions.reset")}
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardHeader>
            <div className="text-primary">
              <Utensils className="size-7" aria-hidden="true" />
            </div>
            <CardTitle>{t("entry.whatOpensNext")}</CardTitle>
            <CardDescription>
              {t("entry.nextDescription")}
            </CardDescription>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-6">
            {[
              t("entry.nextMenu"),
              t("entry.nextCart"),
              t("entry.nextStatus"),
              t("entry.nextService")
            ].map((label) => (
              <div key={label} className="rounded-card border bg-surface/70 p-3">
                <p className="text-sm font-semibold text-foreground">{label}</p>
              </div>
            ))}
            <Link
              href="/demo/balkona"
              className={buttonVariants({ variant: "secondary" })}
            >
              <MonitorPlay className="size-4" aria-hidden="true" />
              {t("actions.fullDemoLauncher")}
            </Link>
          </div>
        </Card>
      </section>
    </CustomerShell>
  );
}
