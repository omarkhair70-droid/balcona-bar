"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bell, ClipboardList, ShoppingBag, Sparkles, Utensils } from "lucide-react";
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
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { formatMoney, getCartItemCount, getRecordString } from "../customer-format";

type CustomerSessionHomePageProps = {
  sessionId: string;
};

const actions = [
  {
    labelKey: "home.actionMenuLabel",
    href: "menu",
    descriptionKey: "home.actionMenuDescription",
    icon: <Utensils className="size-5" aria-hidden="true" />
  },
  {
    labelKey: "home.actionAiWaiterLabel",
    href: "ai-waiter",
    descriptionKey: "home.actionAiWaiterDescription",
    icon: <Sparkles className="size-5" aria-hidden="true" />
  },
  {
    labelKey: "home.actionCartLabel",
    href: "cart",
    descriptionKey: "home.actionCartDescription",
    icon: <ShoppingBag className="size-5" aria-hidden="true" />
  },
  {
    labelKey: "home.actionStatusLabel",
    href: "status",
    descriptionKey: "home.actionStatusDescription",
    icon: <ClipboardList className="size-5" aria-hidden="true" />
  },
  {
    labelKey: "home.actionServiceLabel",
    href: "service",
    descriptionKey: "home.actionServiceDescription",
    icon: <Bell className="size-5" aria-hidden="true" />
  }
];

export function CustomerSessionHomePage({
  sessionId
}: CustomerSessionHomePageProps) {
  const t = useTranslations("customer");
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
      eyebrow={t("home.eyebrow")}
      title={t("home.title")}
      description={t("home.description")}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label={t("home.cartMetric")}
          value={`${getCartItemCount(cartQuery.data)}`}
          description={formatMoney(
            cartQuery.data?.totals.subtotalMinor ?? 0,
            cartQuery.data?.totals.currency ?? "EGP"
          )}
          icon={<ShoppingBag className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("home.statusMetric")}
          value={customerStatus.replaceAll("_", " ")}
          description={t("home.realtimeReady")}
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
        />
        <MetricCard
          label={t("home.scopeMetric")}
          value={branchId ? t("home.branch") : t("home.local")}
          description={
            tableId
              ? t("home.tableShort", { table: tableId.slice(0, 8) })
              : t("home.sessionGate")
          }
          icon={<Utensils className="size-4" aria-hidden="true" />}
        />
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Card key={action.href} variant="glass">
            <CardHeader>
              <div className="text-primary">{action.icon}</div>
              <CardTitle>{t(action.labelKey)}</CardTitle>
              <CardDescription>{t(action.descriptionKey)}</CardDescription>
            </CardHeader>
            <div className="px-6 pb-6">
              <Link
                href={`/customer/session/${sessionId}/${action.href}`}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("actions.open")}
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </CustomerSessionScreen>
  );
}
