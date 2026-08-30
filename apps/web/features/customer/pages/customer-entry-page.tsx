"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/features/customer/customer-shell";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";

export function CustomerEntryPage() {
  const router = useRouter();
  const t = useTranslations("customer");
  const [qrToken, setQrToken] = useState("");
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const tableCode = useCustomerSessionStore((state) => state.tableCode);
  const clearSession = useCustomerSessionStore((state) => state.clearSession);
  const tokenToOpen = qrToken.trim();

  function openTable() {
    if (!tokenToOpen) {
      return;
    }

    router.push(`/customer/table/${encodeURIComponent(tokenToOpen)}`);
  }

  return (
    <CustomerShell
      eyebrow={t("entry.eyebrow")}
      title={t("entry.title")}
      description={t("entry.description")}
    >
      {storedSessionId ? (
        <section className="mb-4 rounded-[22px] border border-border bg-card p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">
            {t("entry.savedTable")}
          </p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-black text-foreground">
                {tableCode
                  ? t("entry.savedTableCode", { table: tableCode })
                  : t("entry.savedTableFallback")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("entry.resumeDescription")}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => router.push(`/customer/session/${storedSessionId}`)}
            >
              {t("actions.resume")}
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            </Button>
          </div>
        </section>
      ) : null}

      <section className="rounded-[24px] border border-border bg-card p-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-primary">
          <QrCode className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-black tracking-[-0.02em] text-foreground">
          {t("entry.tableTokenTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("entry.tableTokenDescription")}
        </p>
        <Input
          value={qrToken}
          onChange={(event) => setQrToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              openTable();
            }
          }}
          placeholder={t("entry.tableTokenPlaceholder")}
          aria-label={t("aria.tableQrToken")}
          className="mt-4 min-h-12 rounded-xl bg-background"
        />
        <Button
          onClick={openTable}
          disabled={!tokenToOpen}
          className="mt-3 min-h-12 w-full rounded-2xl"
        >
          <QrCode className="size-4" aria-hidden="true" />
          {t("actions.openTable")}
        </Button>
        {storedSessionId ? (
          <Button
            variant="ghost"
            onClick={() => {
              clearSession();
              setQrToken("");
            }}
            className="mt-2 w-full text-muted-foreground"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("entry.forgetSavedTable")}
          </Button>
        ) : null}
      </section>

      <p className="px-2 pt-4 text-center text-[11px] leading-5 text-muted-foreground">
        {t("entry.qrHint")}
      </p>
    </CustomerShell>
  );
}
