import type {
  AddCartItemPayload,
  CartItemModifierOption,
  CartItemSummary,
  CartResponse,
  MenuItemSummary,
} from "@/lib/api/types";

function normalizedNotes(value?: string | null) {
  return value?.trim() ?? "";
}

function optionIdentity(options: CartItemModifierOption[]) {
  return options
    .map((option) => `${option.modifierGroupId}:${option.modifierOptionId}`)
    .sort()
    .join("|");
}

function recalculateCart(
  cart: CartResponse,
  items: CartItemSummary[],
): CartResponse {
  return {
    ...cart,
    items,
    totals: {
      ...cart.totals,
      subtotalMinor: items.reduce(
        (total, item) => total + item.lineTotalMinorSnapshot,
        0,
      ),
      totalQuantity: items.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
      itemCount: items.length,
    },
  };
}

function selectedModifierOptions(
  item: MenuItemSummary,
  payload: AddCartItemPayload,
): CartItemModifierOption[] {
  const selectedByGroup = new Map(
    (payload.selectedModifiers ?? []).map((selection) => [
      selection.modifierGroupId,
      new Set(selection.optionIds),
    ]),
  );

  return (item.modifiers ?? []).flatMap((group) => {
    const selectedIds = selectedByGroup.get(group.id);
    if (!selectedIds) {
      return [];
    }

    return group.options
      .filter((option) => selectedIds.has(option.id))
      .map((option) => ({
        modifierGroupId: group.id,
        modifierOptionId: option.id,
        modifierGroupNameSnapshot: group.name,
        modifierOptionNameSnapshot: option.name,
        priceDeltaMinorSnapshot: option.priceDeltaMinor,
      }));
  });
}

export function findMatchingCartItem(
  current: CartResponse | undefined,
  item: MenuItemSummary,
  payload: AddCartItemPayload,
) {
  const modifierOptions = selectedModifierOptions(item, payload);
  return current?.items.find(
    (candidate) =>
      candidate.menuItemId === item.id &&
      normalizedNotes(candidate.notes) === normalizedNotes(payload.notes) &&
      optionIdentity(candidate.modifierOptions) ===
        optionIdentity(modifierOptions),
  );
}

export function optimisticAddCartItem(
  current: CartResponse | undefined,
  sessionId: string,
  item: MenuItemSummary,
  payload: AddCartItemPayload,
  optimisticId: string,
): CartResponse {
  const modifierOptions = selectedModifierOptions(item, payload);
  const basePrice = item.effectivePriceMinor ?? item.basePriceMinor;
  const modifiersTotal = modifierOptions.reduce(
    (total, option) => total + option.priceDeltaMinorSnapshot,
    0,
  );
  const unitPrice = basePrice + modifiersTotal;
  const optimisticItem: CartItemSummary = {
    id: optimisticId,
    menuItemId: item.id,
    quantity: payload.quantity,
    notes: payload.notes ?? null,
    itemNameSnapshot: item.name,
    itemSlugSnapshot: item.slug,
    effectiveBasePriceMinorSnapshot: basePrice,
    modifiersTotalMinorSnapshot: modifiersTotal,
    unitPriceMinorSnapshot: unitPrice,
    lineTotalMinorSnapshot: unitPrice * payload.quantity,
    currency: item.currency,
    modifierOptions,
  };
  const cart =
    current ??
    ({
      cart: {
        id: null,
        tableSessionId: sessionId,
        status: "active",
        currency: item.currency,
      },
      items: [],
      totals: {
        subtotalMinor: 0,
        totalQuantity: 0,
        itemCount: 0,
        currency: item.currency,
      },
    } satisfies CartResponse);
  const matchingItem = findMatchingCartItem(cart, item, payload);
  const matchingIndex = matchingItem
    ? cart.items.findIndex((candidate) => candidate.id === matchingItem.id)
    : -1;
  const items = [...cart.items];

  if (matchingIndex >= 0) {
    const matchingItem = items[matchingIndex];
    const quantity = matchingItem.quantity + payload.quantity;
    items[matchingIndex] = {
      ...matchingItem,
      quantity,
      lineTotalMinorSnapshot:
        matchingItem.unitPriceMinorSnapshot * quantity,
    };
  } else {
    items.push(optimisticItem);
  }

  return recalculateCart(cart, items);
}

export function optimisticUpdateCartItem(
  current: CartResponse | undefined,
  itemId: string,
  quantity: number,
) {
  if (!current) {
    return current;
  }

  return recalculateCart(
    current,
    current.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            quantity,
            lineTotalMinorSnapshot: item.unitPriceMinorSnapshot * quantity,
          }
        : item,
    ),
  );
}

export function optimisticRemoveCartItem(
  current: CartResponse | undefined,
  itemId: string,
) {
  if (!current) {
    return current;
  }

  return recalculateCart(
    current,
    current.items.filter((item) => item.id !== itemId),
  );
}

export function optimisticClearCart(current: CartResponse | undefined) {
  return current ? recalculateCart(current, []) : current;
}

export function restoreCartItem(
  current: CartResponse | undefined,
  item: CartItemSummary,
  originalIndex: number,
) {
  if (!current) {
    return current;
  }

  const withoutItem = current.items.filter(
    (candidate) => candidate.id !== item.id,
  );
  const nextItems = [...withoutItem];
  nextItems.splice(Math.min(originalIndex, nextItems.length), 0, item);
  return recalculateCart(current, nextItems);
}

export function restoreCartItems(
  current: CartResponse | undefined,
  previous: CartResponse | undefined,
) {
  return previous ?? current;
}
