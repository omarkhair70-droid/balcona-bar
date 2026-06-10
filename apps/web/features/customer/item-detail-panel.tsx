"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  AddCartItemPayload,
  MenuItemSummary,
  MenuModifierGroup
} from "@/lib/api/types";
import { vibrateLight, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { formatMoney, getMenuItemPrice } from "./customer-format";
import { ModifierGroupSelector } from "./modifier-group-selector";
import { QuantityStepper } from "./quantity-stepper";

type ItemDetailPanelProps = {
  item: MenuItemSummary;
  isAdding?: boolean;
  isAddDisabled?: boolean;
  disabledMessage?: string;
  errorMessage?: string;
  onClose: () => void;
  onAdd: (payload: AddCartItemPayload) => Promise<void> | void;
};

type SelectionState = Record<string, string[]>;

function getMissingRequiredGroups(
  groups: MenuModifierGroup[],
  selections: SelectionState
) {
  return groups.filter((group) => {
    const selectedCount = selections[group.id]?.length ?? 0;
    const minimum = group.isRequired ? Math.max(1, group.minSelections) : 0;

    return selectedCount < minimum;
  });
}

export function ItemDetailPanel({
  item,
  isAdding,
  isAddDisabled,
  disabledMessage,
  errorMessage,
  onClose,
  onAdd
}: ItemDetailPanelProps) {
  const t = useTranslations("customer");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SelectionState>({});
  const modifierGroups = useMemo(() => item.modifiers ?? [], [item.modifiers]);
  const canOrder = item.canOrder !== false && item.status === "active";
  const stockBlocked = item.stockStatus === "out_of_stock";
  const missingRequiredGroups = useMemo(
    () => getMissingRequiredGroups(modifierGroups, selections),
    [modifierGroups, selections]
  );

  async function handleAdd() {
    if (!canOrder) {
      vibrateWarning();
      return;
    }

    if (missingRequiredGroups.length > 0) {
      vibrateWarning();
      return;
    }

    try {
      await onAdd({
        menuItemId: item.id,
        quantity,
        notes: notes.trim() || undefined,
        selectedModifiers: Object.entries(selections).map(
          ([modifierGroupId, optionIds]) => ({
            modifierGroupId,
            optionIds
          })
        )
      });
      vibrateLight();
    } catch {
      vibrateWarning();
    }
  }

  return (
    <Card variant="glass" padding="lg" className="sticky top-4">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-2xl">{item.name}</CardTitle>
            <CardDescription className="mt-2">
              {item.description ?? t("item.descriptionFallback")}
            </CardDescription>
          </div>
          {stockBlocked ? (
            <Badge variant="danger">{t("item.soldOut")}</Badge>
          ) : item.stockStatus === "low_stock" ? (
            <Badge variant="warning">{t("item.lowStock")}</Badge>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("item.close")}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-lg font-semibold text-primary">
          {formatMoney(getMenuItemPrice(item), item.currency)}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">
            {t("item.quantity")}
          </span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>
        {modifierGroups.map((group) => (
          <ModifierGroupSelector
            key={group.id}
            group={group}
            selectedOptionIds={selections[group.id] ?? []}
            onChange={(optionIds) =>
              setSelections((current) => ({
                ...current,
                [group.id]: optionIds
              }))
            }
          />
        ))}
        <label className="grid gap-2 text-sm font-medium text-foreground">
          {t("item.noteLabel")}
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t("item.notePlaceholder")}
          />
        </label>
        {missingRequiredGroups.length > 0 ? (
          <p className="text-sm text-warning">
            {t("item.missingRequired", {
              names: missingRequiredGroups.map((group) => group.name).join(", ")
            })}
          </p>
        ) : null}
        {!canOrder ? (
          <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
            {t("item.unavailableMessage")}
          </div>
        ) : null}
        {isAddDisabled && disabledMessage ? (
          <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
            {disabledMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-card border border-danger bg-danger/10 p-3 text-sm text-danger"
          >
            {errorMessage}
          </div>
        ) : null}
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleAdd}
          disabled={isAdding || isAddDisabled || !canOrder}
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          {isAdding
            ? t("item.adding")
            : canOrder
              ? t("item.addToCart")
              : t("item.unavailable")}
        </Button>
      </CardFooter>
    </Card>
  );
}
