"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartItemSummary } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { formatMoney } from "./customer-format";
import { QuantityStepper } from "./quantity-stepper";

type CartItemRowProps = {
  item: CartItemSummary;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  isPending?: boolean;
};

export function CartItemRow({
  item,
  onQuantityChange,
  onRemove,
  isPending
}: CartItemRowProps) {
  const t = useTranslations("customer");

  return (
    <div className="flex gap-3 py-3">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-black text-muted-foreground">
        {item.quantity}×
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-black text-foreground">
              {item.itemNameSnapshot}
            </h3>
            {item.modifierOptions.length > 0 ? (
              <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
                {item.modifierOptions
                  .map((option) => option.modifierOptionNameSnapshot)
                  .join(", ")}
              </p>
            ) : null}
            {item.notes ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-primary">
                {item.notes}
              </p>
            ) : null}
          </div>
          <strong className="shrink-0 text-xs text-foreground">
            {formatMoney(item.lineTotalMinorSnapshot, item.currency)}
          </strong>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <QuantityStepper
            value={item.quantity}
            onChange={onQuantityChange}
            disabled={isPending}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            disabled={isPending}
            aria-label={t("cart.removeItem", { name: item.itemNameSnapshot })}
            className="size-9 rounded-full text-muted-foreground"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
