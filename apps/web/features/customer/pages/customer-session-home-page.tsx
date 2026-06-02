"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, ShoppingBag, Utensils } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { getCart, getCustomerStatus } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney, getCartItemCount, getRecordString } from "../customer-format";

type CustomerSessionHomePageProps = {
  sessionId: string;
};

const actions = [
  {
    label: "Browse menu",
    href: "menu",
    icon: <Utensils className="size-5" aria-hidden="true" />
  },
  {
    label: "Review cart",
    href: "cart",
    icon: <ShoppingBag className="size-5" aria-hidden="true" />
  },
  {
    label: "Order status",
    href: "status",
    icon: <ClipboardList className="size-5" aria-hidden="true" />
  },
  {
    label: "Service",
    href: "service",
    icon: <Bell className="size-5" aria-hidden="true" />
  }
];

export function CustomerSessionHomePage({
  sessionId
}: CustomerSessionHomePageProps) {
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const tableId = useCustomerSessionStore((state) => state.tableId);
  const cartQuery = useQuery({
    queryKey: customerQueryKeys.cart(sessionId),
    queryFn: () => getCart(sessionId, token),
    staleTime: 10_000
  });
  const statusQuery = useQuery({
    queryKey: customerQueryKeys.status(sessionId),
    queryFn: () => getCustomerStatus(sessionId, token),
    staleTime: 10_000
  });
  const customerStatus = getRecordString(
    statusQuery.data,
    "customerStatus",
    "ready"
  );

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="home"
      eyebrow="Table home"
      title="Your table is live"
      description="Browse the menu, send an order, follow the kitchen timeline, or ask the team for help."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Cart"
          value={`${getCartItemCount(cartQuery.data)}`}
          description={formatMoney(
            cartQuery.data?.totals.subtotalMinor ?? 0,
            cartQuery.data?.totals.currency ?? "EGP"
          )}
          icon={<ShoppingBag className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Status"
          value={customerStatus.replaceAll("_", " ")}
          description="Realtime refresh ready"
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label="Scope"
          value={branchId ? "Branch" : "Local"}
          description={tableId ? `Table ${tableId.slice(0, 8)}` : "Session gate"}
          icon={<Utensils className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Card key={action.href} variant="glass">
            <CardHeader>
              <div className="text-primary">{action.icon}</div>
              <CardTitle>{action.label}</CardTitle>
              <CardDescription>
                Open the {action.label.toLowerCase()} surface for this table.
              </CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <Link
                href={`/customer/session/${sessionId}/${action.href}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                Open
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </CustomerSessionScreen>
  );
}
