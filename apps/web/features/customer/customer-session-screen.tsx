"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCart } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { CustomerBottomNav } from "./customer-bottom-nav";
import { CustomerSessionGate } from "./customer-session-gate";
import { CustomerThemeLoader } from "./customer-theme-loader";
import { getCartItemCount } from "./customer-format";
import { RealtimeStatus } from "./realtime-status";
import { useCustomerRealtime } from "./use-customer-realtime";

type CustomerSessionScreenProps = {
  sessionId: string;
  active: "home" | "menu" | "cart" | "status" | "service";
  title: string;
  description: string;
  children: ReactNode;
  eyebrow?: string;
};

export function CustomerSessionScreen({
  sessionId,
  active,
  title,
  description,
  children,
  eyebrow
}: CustomerSessionScreenProps) {
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const qrToken = useCustomerSessionStore((state) => state.qrToken);
  const realtimeState = useCustomerRealtime(sessionId, token);
  const cartQuery = useQuery({
    queryKey: customerQueryKeys.cart(sessionId),
    queryFn: () => getCart(sessionId, token),
    enabled: Boolean(sessionId),
    staleTime: 10_000,
    retry: 1
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <CustomerThemeLoader branchId={branchId} />
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
              {qrToken ? `Table ${qrToken}` : "Smart table"}
            </span>
          </span>
        </Link>
        <RealtimeStatus state={realtimeState} />
      </header>

      <section className="py-6">
        <Card variant="glass" padding="lg">
          <CardHeader>
            {eyebrow ? <Badge className="w-fit">{eyebrow}</Badge> : null}
            <CardTitle className="text-3xl md:text-4xl">{title}</CardTitle>
            <CardDescription className="max-w-2xl">
              {description}
            </CardDescription>
          </CardHeader>
        </Card>
      </section>

      <CustomerSessionGate sessionId={sessionId}>{children}</CustomerSessionGate>
      <CustomerBottomNav
        sessionId={sessionId}
        active={active}
        cartCount={getCartItemCount(cartQuery.data)}
      />
    </main>
  );
}
