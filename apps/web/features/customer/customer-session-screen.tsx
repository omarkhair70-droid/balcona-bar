"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Badge } from "@/components/ui/badge";
import { getBill, getCart, getTableSessionOrders } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import {
  assertCustomerSessionReady,
  getCustomerSessionReadiness
} from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerBottomNav } from "./customer-bottom-nav";
import { guestThemeStyle } from "./customer-theme";
import { CustomerSessionGate } from "./customer-session-gate";
import { CustomerThemeLoader } from "./customer-theme-loader";
import { getCartItemCount } from "./customer-format";
import { RealtimeStatus } from "./realtime-status";
import { useCustomerRealtime } from "./use-customer-realtime";

export type CustomerSessionSection =
  | "home"
  | "menu"
  | "cart"
  | "status"
  | "service"
  | "bill";

type CustomerSessionScreenProps = {
  sessionId: string;
  active: CustomerSessionSection;
  title: string;
  description: string;
  children: ReactNode;
  eyebrow?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function CustomerSessionScreen({
  sessionId,
  active,
  title,
  description,
  children,
  eyebrow
}: CustomerSessionScreenProps) {
  const t = useTranslations("customer");
  const hasHydrated = useCustomerSessionStore((state) => state.hasHydrated);
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const branchName = useCustomerSessionStore((state) => state.branchName);
  const tableCode = useCustomerSessionStore((state) => state.tableCode);
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const expiresAt = useCustomerSessionStore(
    (state) => state.customerAccessTokenExpiresAt
  );
  const qrToken = useCustomerSessionStore((state) => state.qrToken);
  const readiness = getCustomerSessionReadiness(
    {
      hasHydrated,
      sessionId: storedSessionId,
      branchId,
      customerAccessToken: token,
      customerAccessTokenExpiresAt: expiresAt
    },
    sessionId
  );
  const realtimeState = useCustomerRealtime(sessionId, token);

  const cartQuery = useQuery({
    queryKey: customerQueryKeys.cart(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getCart(ready.sessionId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 10_000,
    retry: 1
  });

  const ordersQuery = useQuery({
    queryKey: customerQueryKeys.orders(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getTableSessionOrders(ready.sessionId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 10_000,
    retry: 1
  });

  const billQuery = useQuery({
    queryKey: customerQueryKeys.bill(sessionId),
    queryFn: () => {
      const ready = assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        sessionId
      );

      return getBill(ready.sessionId, ready.customerAccessToken);
    },
    enabled: readiness.isReady,
    staleTime: 10_000,
    retry: 1
  });

  const activeBillEnvelope = isRecord(billQuery.data?.activeBill)
    ? billQuery.data?.activeBill
    : undefined;
  const hasBillSignal = Boolean(
    billQuery.data?.activeBillRequest ||
      billQuery.data?.bill ||
      activeBillEnvelope?.bill ||
      activeBillEnvelope?.receipt ||
      billQuery.data?.receipt
  );
  const tableLabel = tableCode ?? qrToken ?? t("shell.table");

  return (
    <div
      data-customer-theme-root
      style={guestThemeStyle}
      className="min-h-screen w-full bg-background text-foreground"
    >
      <main className="mx-auto min-h-screen w-full max-w-md bg-background px-4 pb-28 text-foreground">
        <CustomerThemeLoader branchId={branchId} />

        <header className="sticky top-0 z-30 -mx-4 flex min-h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
          <Link href={`/customer/session/${sessionId}/menu`} className="min-w-0">
            <span className="block truncate text-sm font-black tracking-[-0.02em] text-foreground">
              Balcona
            </span>
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
              <span className="max-w-28 truncate">{branchName ?? t("shell.currentVenue")}</span>
              <span aria-hidden="true">·</span>
              <span>{t("shell.dineIn")}</span>
              <span aria-hidden="true">·</span>
              <strong className="truncate text-foreground">{tableLabel}</strong>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <RealtimeStatus state={realtimeState} />
            <LanguageSwitcher />
          </div>
        </header>

        <section className="pb-4 pt-5">
          {eyebrow ? (
            <Badge
              variant="muted"
              className="mb-2 w-fit text-[10px] font-bold uppercase tracking-[0.12em]"
            >
              {eyebrow}
            </Badge>
          ) : null}
          <h1 className="text-[30px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {title}
          </h1>
          <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
            {description}
          </p>
        </section>

        <CustomerSessionGate sessionId={sessionId}>
          {children}
        </CustomerSessionGate>

        <CustomerBottomNav
          sessionId={sessionId}
          active={active}
          cartCount={getCartItemCount(cartQuery.data)}
          orderSignal={(ordersQuery.data?.orders.length ?? 0) > 0}
          billSignal={hasBillSignal}
        />
      </main>
    </div>
  );
}
