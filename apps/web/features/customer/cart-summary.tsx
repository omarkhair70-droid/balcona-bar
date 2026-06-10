"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CartResponse } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { formatMoney, getCartItemCount } from "./customer-format";

type CartSummaryProps = {
  sessionId: string;
  cart?: CartResponse | null;
};

export function CartSummary({ sessionId, cart }: CartSummaryProps) {
  const t = useTranslations("customer");
  const count = getCartItemCount(cart);

  return (
    <Card variant="accent" className="sticky bottom-24 z-10">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">
            {count > 0
              ? t(count === 1 ? "cart.itemCountOne" : "cart.itemCount", {
                  count
                })
              : t("cart.ready")}
          </CardTitle>
          <CardDescription>
            {formatMoney(cart?.totals.subtotalMinor ?? 0, cart?.totals.currency ?? "EGP")}
          </CardDescription>
        </div>
        <Link
          href={`/customer/session/${sessionId}/cart`}
          className={buttonVariants({ size: "sm" })}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          {t("actions.review")}
        </Link>
      </CardHeader>
    </Card>
  );
}
