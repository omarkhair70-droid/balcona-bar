# Phase 5 Customer Cart Draft Foundation

Phase 5 turns an active table session into a customer-owned draft cart. The cart lets a customer add menu items, select modifiers, update quantities, remove lines, clear the cart, and validate the draft before a future order-confirmation phase.

## Table Session Relationship

A cart belongs to one `TableSession`, and each draft cart also stores the session `companyId` and `branchId` for fast scoping and validation. The table session remains the source of customer context: if the session is missing, closed, or expired, cart operations are rejected.

Only one draft cart can exist for a table session. Clearing a cart removes its draft lines while keeping an empty draft state available for the same session.

## Draft Only

The cart is not an order. Phase 5 does not create an `Order`, reserve inventory, notify staff, send anything to the kitchen or barista station, or trigger cashier approval. It only stores the customer's current draft.

The `CartStatus` enum includes `converted` for a future order-submission phase, but Phase 5 does not use it to submit or confirm anything.

## Pricing Snapshots

`CartItem` stores snapshots of the item name, slug, base price, effective branch price, modifier total, unit price, line total, and currency. `CartItemModifierOption` stores snapshots of modifier group and option names, slugs, and price deltas.

Snapshots make the draft stable after a customer adds an item. If a menu price or modifier price changes while the customer is reviewing the cart, the cart can still show what the customer originally selected, and validation can report the difference before any future order confirmation.

## Backend Price Calculation

The backend is the only price authority. Clients, including the future AI waiter, provide item IDs, quantities, notes, and modifier option IDs only. They never provide trusted prices.

The service calculates prices from database state:

- Base price: `BranchMenuItemOverride.priceOverrideMinor ?? MenuItem.basePriceMinor`
- Modifier price: `ModifierOption.priceDeltaMinor`
- Unit price: effective base price plus selected modifier deltas
- Line total: unit price multiplied by quantity
- Cart subtotal: sum of cart line totals

Cart currency is derived from the menu item currency. Mixed currencies are rejected for now.

## Modifier Validation

When an item is added, the service validates every selected modifier group and option against the current menu configuration:

- The modifier group must be attached to the menu item.
- The modifier group must be active.
- Selected options must belong to the selected group.
- Selected options must be active.
- Required groups must satisfy their minimum selection rules.
- Single-selection groups may receive only one option.
- Multiple-selection groups must respect `maxSelections`.

Changing modifiers is intentionally not supported through the quantity update endpoint. A customer removes the line and adds it again with a new modifier selection.

## Cart Validation

`POST /api/v1/table-sessions/:sessionId/cart/validate` checks the current draft against current menu and branch availability without submitting an order. It returns an `isValid` boolean, issues, recalculated totals, and the cart snapshot.

Validation can detect inactive items, inactive categories, hidden or unavailable branch items, inactive modifier groups or options, detached modifier groups, modifier rule violations, currency changes, and price differences between current database values and stored cart snapshots.

## Future Phases

This foundation prepares the system for a future AI waiter and order-confirmation flow. The AI waiter can propose cart changes using IDs, but the backend will still resolve availability and pricing. A later phase can convert a valid draft cart into an order, then introduce cashier approval, kitchen or barista routing, payments, and POS integration.
