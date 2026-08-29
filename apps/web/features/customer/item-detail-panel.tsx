"use client";

import { useMemo, useState } from "react";
import { ShoppingBag, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const canOrder =
    item.canOrder !== false &&
    item.isAvailable !== false &&
    item.status === "active";
  const stockBlocked = item.stockStatus === "out_of_stock";
  const missingRequiredGroups = useMemo(
    () => getMissingRequiredGroups(modifierGroups, selections),
    [modifierGroups, selections]
  );
  const totalPrice = getMenuItemPrice(item) * quantity;

  async function handleAdd() {
    if (!canOrder || isAddDisabled) {
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
    <>
      <button
        type="button"
        aria-label={t("item.close")}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/35"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-[30px] bg-background p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="h-1 w-12 rounded-full bg-border" />
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={t("item.close")}
            className="rounded-full border border-border bg-card"
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {item.imageUrl ? (
          <div
            className="mt-3 aspect-[4/3] w-full rounded-[24px] bg-cover bg-center"
            style={{ backgroundImage: `url(${item.imageUrl})` }}
            aria-hidden="true"
          />
        ) : (
          <div className="mt-3 aspect-[4/3] w-full rounded-[24px] bg-gradient-to-br from-primary/25 via-muted to-accent/20" />
        )}

        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-[-0.03em] text-foreground">
              {item.name}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {item.description ?? t("item.descriptionFallback")}
            </p>
          </div>
          <strong className="shrink-0 text-sm text-foreground">
            {formatMoney(getMenuItemPrice(item), item.currency)}
          </strong>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {stockBlocked ? (
            <Badge variant="danger">{t("item.soldOut")}</Badge>
          ) : item.stockStatus === "low_stock" ? (
            <Badge variant="warning">{t("item.lowStock")}</Badge>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
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

          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.08em] text-muted-foreground">
            {t("item.noteLabel")}
            <Input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t("item.notePlaceholder")}
              maxLength={500}
              className="min-h-11 rounded-xl bg-card text-sm font-normal normal-case tracking-normal"
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
            <div className="rounded-xl border border-warning bg-warning/10 p-3 text-sm text-warning">
              {t("item.unavailableMessage")}
            </div>
          ) : null}

          {isAddDisabled && disabledMessage ? (
            <div className="rounded-xl border border-warning bg-warning/10 p-3 text-sm text-warning">
              {disabledMessage}
            </div>
          ) : null}

          {errorMessage ? (
            <div
              role="alert"
              className="rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
            <span className="text-sm font-black text-foreground">
              {t("item.quantity")}
            </span>
            <QuantityStepper value={quantity} onChange={setQuantity} />
          </div>
        </div>

        <Button
          onClick={handleAdd}
          disabled={isAdding || isAddDisabled || !canOrder}
          className="mt-5 min-h-14 w-full rounded-2xl text-sm font-black"
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          {isAdding
            ? t("item.adding")
            : canOrder
              ? `${t("item.addToCart")} · ${formatMoney(totalPrice, item.currency)}`
              : t("item.unavailable")}
        </Button>
      </section>
    </>
  );
}
