"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, QrCode, RotateCcw, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CustomerShell } from "@/features/customer/customer-shell";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";

const demoQrToken = "balcona-main-t01";

export function CustomerEntryPage() {
  const router = useRouter();
  const [qrToken, setQrToken] = useState("");
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const clearSession = useCustomerSessionStore((state) => state.clearSession);
  const tokenToOpen = qrToken.trim() || demoQrToken;

  function openTable() {
    router.push(`/customer/table/${encodeURIComponent(tokenToOpen)}`);
  }

  return (
    <CustomerShell
      eyebrow="Customer PWA core"
      title="Start your table experience"
      description="Open from a QR code, resume your table session, browse the live branch menu, and keep service requests in one warm mobile surface."
      actions={
        <>
          <Button onClick={openTable}>
            <QrCode className="size-4" aria-hidden="true" />
            Open table
          </Button>
          {storedSessionId ? (
            <Button
              variant="secondary"
              onClick={() => router.push(`/customer/session/${storedSessionId}`)}
            >
              <ArrowRight className="size-4" aria-hidden="true" />
              Resume
            </Button>
          ) : null}
        </>
      }
    >
      <section className="grid gap-4 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <Badge variant="muted" className="w-fit">
              Table link
            </Badge>
            <CardTitle>Enter or scan a table token</CardTitle>
            <CardDescription>
              Use the demo token to try the customer flow with the backend
              seed data, or paste a QR token from another table.
            </CardDescription>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-6">
            <Input
              value={qrToken}
              onChange={(event) => setQrToken(event.target.value)}
              placeholder={demoQrToken}
              aria-label="Table QR token"
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={openTable}>
                <QrCode className="size-4" aria-hidden="true" />
                Continue
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  clearSession();
                  setQrToken("");
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset
              </Button>
            </div>
          </div>
        </Card>

        <Card variant="elevated" padding="lg">
          <CardHeader>
            <div className="text-primary">
              <Utensils className="size-7" aria-hidden="true" />
            </div>
            <CardTitle>What opens next</CardTitle>
            <CardDescription>
              Session start, branch theme, menu, cart, order status, service
              calls, bill request, and realtime refresh hooks.
            </CardDescription>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-6">
            {["Menu", "Cart", "Status", "Service"].map((label) => (
              <div key={label} className="rounded-card border bg-surface/70 p-3">
                <p className="text-sm font-semibold text-foreground">{label}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </CustomerShell>
  );
}
