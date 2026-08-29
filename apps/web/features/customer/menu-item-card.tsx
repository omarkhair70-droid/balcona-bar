"use client";

import { Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MenuItemSummary } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { formatMoney, getMenuItemPrice } from "./customer-format";

type MenuItemCardProps = {
  item: MenuItemSummary;
  onSelect: (item: MenuItemSummary) => void;
  variant?: "feature" | "row";
};

export function MenuItemCard({
  item,
  onSelect,
  variant = "row"
}: MenuItemCardProps) {
  const t = useTranslations("customer");
  const isUnavailable =
    item.canOrder === false ||
    item.isAvailable === false ||
    item.status !== "active";
  const isStockBlocked = item.stockStatus === "out_of_stock";
  const price = formatMoney(getMenuItemPrice(item), item.currency);

  if (variant === "feature") {
    return (
      <button
        type="button"
        onClick={() => onSelect(item)}
        disabled={isUnavailable}
        className="w-[170px] shrink-0 overflow-hidden rounded-[20px] border border-border bg-card p-2 text-start shadow-sm transition hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {item.imageUrl ? (
          <div
            className="h-28 w-full rounded-[18px] bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="h-28 w-full rounded-[18px] bg-gradient-to-br from-primary/25 via-muted to-accent/20" />
        )}

        <div className="px-1 pb-1 pt-2.5">
          <div className="flex items-start gap-1.5">
            <p
              className="min-w-0 flex-1 truncate text-sm font-black text-foreground"
              dir="auto"
            >
              {item.name}
            </p>
            {item.isFeatured ? (
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
            ) : null}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <strong className="text-xs text-foreground" dir="ltr">
              {price}
            </strong>
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-foreground">
              <Plus className="size-3.5" aria-hidden="true" />
            </span>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      disabled={isUnavailable}
      className="flex w-full gap-3 py-3 text-start disabled:cursor-not-allowed disabled:opacity-55"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <h3
            className="text-sm font-black leading-5 text-foreground"
            dir="auto"
          >
            {item.name}
          </h3>
          {item.isFeatured ? (
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          ) : null}
        </div>

        <p
          className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground"
          dir="auto"
        >
          {item.description ?? t("item.preparedFallback")}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <strong className="text-xs text-foreground" dir="ltr">
            {price}
          </strong>
          {isStockBlocked ? (
            <Badge variant="danger">{t("item.soldOut")}</Badge>
          ) : item.stockStatus === "low_stock" ? (
            <Badge variant="warning">{t("item.lowStock")}</Badge>
          ) : isUnavailable ? (
            <Badge variant="muted">{t("item.unavailable")}</Badge>
          ) : null}
        </div>
      </div>

      <div className="relative shrink-0">
        {item.imageUrl ? (
          <div
            className="h-[76px] w-[92px] rounded-[16px] bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="h-[76px] w-[92px] rounded-[16px] bg-gradient-to-br from-primary/25 via-muted to-accent/20" />
        )}
        {!isUnavailable ? (
          <span className="absolute -bottom-1 -end-1 flex size-8 items-center justify-center rounded-full border-2 border-card bg-foreground text-background">
            <Plus className="size-3.5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
    </button>
  );
}
