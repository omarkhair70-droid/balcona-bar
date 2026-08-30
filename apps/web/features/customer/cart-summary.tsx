"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
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

  if (count <= 0) {
    return null;
  }

  return (
    <Link
      href={`/guest/session/${sessionId}/cart`}
      className="fixed bottom-[5.15rem] start-1/2 z-30 flex min-h-14 w-[calc(100%-2rem)] max-w-[416px] -translate-x-1/2 items-center gap-3 rounded-2xl bg-foreground px-4 text-start text-background shadow-xl rtl:translate-x-1/2"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background/15 text-xs font-black">
        {count}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-black">
          <ShoppingBag className="size-3.5" aria-hidden="true" />
          {t("actions.reviewCart")}
        </span>
        <span className="mt-0.5 block truncate text-[10px] text-background/70">
          {t(count === 1 ? "cart.itemCountOne" : "cart.itemCount", { count })}
        </span>
      </span>
      <strong className="ms-auto shrink-0 text-sm">
        {formatMoney(
          cart?.totals.subtotalMinor ?? 0,
          cart?.totals.currency ?? "EGP"
        )}
      </strong>
    </Link>
  );
}
