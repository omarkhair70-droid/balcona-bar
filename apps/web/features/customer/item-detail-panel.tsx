"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
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
import { formatMoney, getMenuItemPrice } from "./customer-format";
import { ModifierGroupSelector } from "./modifier-group-selector";
import { QuantityStepper } from "./quantity-stepper";

type ItemDetailPanelProps = {
  item: MenuItemSummary;
  isAdding?: boolean;
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
  errorMessage,
  onClose,
  onAdd
}: ItemDetailPanelProps) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SelectionState>({});
  const modifierGroups = useMemo(() => item.modifiers ?? [], [item.modifiers]);
  const missingRequiredGroups = useMemo(
    () => getMissingRequiredGroups(modifierGroups, selections),
    [modifierGroups, selections]
  );

  async function handleAdd() {
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
              {item.description ?? "A table-ready selection from the menu."}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close item detail">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
        <p className="text-lg font-semibold text-primary">
          {formatMoney(getMenuItemPrice(item), item.currency)}
        </p>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold text-foreground">Quantity</span>
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
          Note for the team
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="No onions, extra hot, seat preference"
          />
        </label>
        {missingRequiredGroups.length > 0 ? (
          <p className="text-sm text-warning">
            Choose required options for{" "}
            {missingRequiredGroups.map((group) => group.name).join(", ")}.
          </p>
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
        <Button onClick={handleAdd} disabled={isAdding}>
          <ShoppingBag className="size-4" aria-hidden="true" />
          {isAdding ? "Adding..." : "Add to cart"}
        </Button>
      </CardFooter>
    </Card>
  );
}
