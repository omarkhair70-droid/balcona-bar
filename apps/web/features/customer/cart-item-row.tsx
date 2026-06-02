"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CartItemSummary } from "@/lib/api/types";
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
  return (
    <div className="rounded-card border bg-surface/75 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {item.itemNameSnapshot}
          </h3>
          {item.modifierOptions.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {item.modifierOptions
                .map((option) => option.modifierOptionNameSnapshot)
                .join(", ")}
            </p>
          ) : null}
          {item.notes ? (
            <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>
          ) : null}
        </div>
        <p className="text-sm font-semibold text-primary">
          {formatMoney(item.lineTotalMinorSnapshot, item.currency)}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
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
          aria-label={`Remove ${item.itemNameSnapshot}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
