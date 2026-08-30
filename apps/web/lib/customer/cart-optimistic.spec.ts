import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CartItemSummary,
  CartResponse,
  MenuItemSummary,
} from "../api/types";
import {
  optimisticAddCartItem,
  optimisticRemoveCartItem,
  optimisticUpdateCartItem,
  restoreCartItem,
} from "./cart-optimistic.ts";

const item: MenuItemSummary = {
  id: "menu-1",
  companyId: "company-1",
  categoryId: "category-1",
  name: "Latte",
  slug: "latte",
  basePriceMinor: 8_000,
  currency: "EGP",
  status: "active",
  modifiers: [
    {
      id: "milk",
      companyId: "company-1",
      name: "Milk",
      slug: "milk",
      selectionType: "single",
      isRequired: false,
      minSelections: 0,
      maxSelections: 1,
      sortOrder: 0,
      status: "active",
      options: [
        {
          id: "oat",
          groupId: "milk",
          name: "Oat",
          slug: "oat",
          priceDeltaMinor: 1_000,
          status: "active",
          sortOrder: 0,
        },
      ],
    },
  ],
};

function existingItem(overrides: Partial<CartItemSummary> = {}) {
  return {
    id: "cart-item-1",
    menuItemId: "menu-2",
    quantity: 1,
    notes: null,
    itemNameSnapshot: "Tea",
    effectiveBasePriceMinorSnapshot: 5_000,
    modifiersTotalMinorSnapshot: 0,
    unitPriceMinorSnapshot: 5_000,
    lineTotalMinorSnapshot: 5_000,
    currency: "EGP",
    modifierOptions: [],
    ...overrides,
  } satisfies CartItemSummary;
}

function cart(items: CartItemSummary[] = [existingItem()]): CartResponse {
  return {
    cart: {
      id: "cart-1",
      tableSessionId: "session-1",
      status: "active",
      currency: "EGP",
    },
    items,
    totals: {
      subtotalMinor: items.reduce(
        (total, entry) => total + entry.lineTotalMinorSnapshot,
        0,
      ),
      totalQuantity: items.reduce(
        (total, entry) => total + entry.quantity,
        0,
      ),
      itemCount: items.length,
      currency: "EGP",
    },
  };
}

describe("optimistic customer cart", () => {
  it("adds to the cache synchronously before a request can resolve", () => {
    const requestResolved = false;
    const next = optimisticAddCartItem(
      cart(),
      "session-1",
      item,
      {
        menuItemId: item.id,
        quantity: 2,
        selectedModifiers: [{ modifierGroupId: "milk", optionIds: ["oat"] }],
      },
      "optimistic-1",
    );

    assert.equal(requestResolved, false);
    assert.equal(next.items.length, 2);
    assert.equal(next.items[1].lineTotalMinorSnapshot, 18_000);
    assert.equal(next.totals.subtotalMinor, 23_000);
  });

  it("rolls back a failed add without losing a concurrent cart change", () => {
    const previous = cart();
    const optimistic = optimisticAddCartItem(
      previous,
      "session-1",
      item,
      { menuItemId: item.id, quantity: 1 },
      "optimistic-1",
    );
    const concurrentChange = optimisticUpdateCartItem(
      optimistic,
      "cart-item-1",
      2,
    );
    const rolledBack = optimisticRemoveCartItem(
      concurrentChange,
      "optimistic-1",
    );

    assert.equal(rolledBack?.items.length, 1);
    assert.equal(rolledBack?.items[0].quantity, 2);
  });

  it("updates quantity and totals immediately and restores only that item", () => {
    const previous = cart([existingItem(), existingItem({ id: "cart-item-2" })]);
    const optimistic = optimisticUpdateCartItem(previous, "cart-item-1", 3);

    assert.equal(optimistic?.items[0].quantity, 3);
    assert.equal(optimistic?.totals.subtotalMinor, 20_000);

    const concurrentOtherChange = optimisticUpdateCartItem(
      optimistic,
      "cart-item-2",
      2,
    );
    const rolledBack = restoreCartItem(
      concurrentOtherChange,
      previous.items[0],
      0,
    );
    assert.equal(rolledBack?.items[0].quantity, 1);
    assert.equal(rolledBack?.items[1].quantity, 2);
  });

  it("removes immediately and reinserts the same item on failure", () => {
    const previous = cart([existingItem(), existingItem({ id: "cart-item-2" })]);
    const optimistic = optimisticRemoveCartItem(previous, "cart-item-1");

    assert.deepEqual(
      optimistic?.items.map((entry) => entry.id),
      ["cart-item-2"],
    );
    assert.deepEqual(
      restoreCartItem(optimistic, previous.items[0], 0)?.items.map(
        (entry) => entry.id,
      ),
      ["cart-item-1", "cart-item-2"],
    );
  });
});
