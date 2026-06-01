# Phase 3 — Menu Foundation

Phase 3 adds the reusable menu, pricing, modifier, and branch availability foundation for the Cafe AI Waiter App / Smart Café Operating System.

This phase is **not** a QR menu website. It creates the backend source of truth that future AI waiter, cart, order, cashier, kitchen, and customer app flows will depend on.

## Company-level menu vs. branch-specific availability

The company-level menu defines the reusable catalog for a café company:

- Categories, such as Coffee, Cold Drinks, Desserts, and Bakery.
- Menu items, including stable item IDs, names, slugs, descriptions, base prices, currency, preparation station, and status.
- Modifier groups and options, such as Size, Sugar Level, Milk Type, and Extras.
- Item-to-modifier-group attachments.

Branches do not redefine the whole menu. Instead, each branch can have a `BranchMenuItemOverride` for an item. This lets one branch control whether an item is customer-visible, available, and optionally priced differently while still using the same company-level item ID and modifier definitions.

## Base price vs. branch override price

Every `MenuItem` stores a deterministic `basePriceMinor`. A branch may optionally set `BranchMenuItemOverride.priceOverrideMinor`.

The backend calculates the customer-facing effective price as:

```text
effectivePriceMinor = priceOverrideMinor ?? basePriceMinor
```

This calculation is intentionally server-side. Clients and future AI flows must request menu data from the backend and use the returned `effectivePriceMinor`; they must not invent or recalculate prices independently.

## Why prices are stored as minor units

Prices are stored as integer minor units, for example `9500` for EGP 95.00. This avoids floating-point rounding issues and keeps all later cart, order, receipt, payment, audit, and reconciliation logic deterministic.

The currency is stored on each menu item and defaults to `EGP` for the demo seed data.

## Why AI must rely on menu IDs and backend prices later

Future AI waiter flows may help customers discover items, explain modifiers, and build a draft order. The AI must never set prices or change prices.

Instead, AI should reference backend-owned identifiers:

- `MenuItem.id` for selected items.
- `ModifierGroup.id` for allowed customization groups.
- `ModifierOption.id` for selected options and deterministic price deltas.
- Backend-calculated item effective prices and option deltas.

This keeps the backend as the source of truth for item identity, price, availability, and allowed modifier choices.

## Intentionally deferred

Phase 3 intentionally does not include:

- AI waiter flows.
- Cart creation or cart submission.
- Order logic.
- Cashier or kitchen workflows.
- Admin CRUD for menu management.
- Payment, POS, or dashboard features.
- Flutter UI or customer-facing app screens.
