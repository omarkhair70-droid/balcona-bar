# Product Phase 4I.0 - Inventory / Stock Foundation

Product Phase 4I.0 adds the first real stock-control foundation for the Cafe AI
Waiter App / Smart Cafe Operating System. It connects company inventory items,
branch stock levels, menu item requirements, customer ordering, AI menu
grounding, setup readiness, and owner visibility without adding suppliers,
purchase orders, COGS accounting, barcode scanning, transfers, or POS payment
logic.

## Goal

The phase gives cafe operators a reliable backend source of truth for:

- company-level inventory items;
- branch-level quantity on hand;
- stock movement audit history;
- menu item ingredient or stock requirements;
- customer-facing sold-out and low-stock states;
- automatic stock consumption when an order is accepted;
- staff-facing inventory adjustment and requirement management.

Inventory affects ordering, but it does not change menu pricing, order totals,
payment settlement, or cashier shift accounting.

## Data Model

The Prisma schema adds four inventory tables:

- `InventoryItem` - company-owned stock item with name, optional SKU, unit,
  status, par level, and default low-stock threshold.
- `BranchInventoryLevel` - per-branch quantity on hand and optional branch-level
  low-stock threshold for an inventory item.
- `InventoryMovement` - append-only stock audit entry with movement type,
  quantity delta, quantity after, source, optional staff actor, and note.
- `MenuItemInventoryRequirement` - menu item to inventory item requirement with
  quantity required per menu item quantity.

The phase also adds enums:

- `InventoryUnit`: `piece`, `gram`, `milliliter`
- `InventoryItemStatus`: `active`, `inactive`, `archived`
- `InventoryMovementType`: `opening_balance`, `stock_in`, `stock_out`,
  `correction`, `waste`, `sale_consumption`, `sale_reversal`
- `InventoryStockStatus`: `in_stock`, `low_stock`, `out_of_stock`

Quantities are stored as integers. Fractional recipes and conversion rules are
left for a later costing and supplier phase.

## Backend API

The new `InventoryModule` exposes staff-guarded endpoints:

- `GET /api/v1/companies/:companyId/inventory/items`
- `POST /api/v1/companies/:companyId/inventory/items`
- `PATCH /api/v1/inventory/items/:inventoryItemId`
- `GET /api/v1/branches/:branchId/inventory/levels`
- `GET /api/v1/branches/:branchId/inventory/alerts`
- `POST /api/v1/branches/:branchId/inventory/levels/:inventoryItemId/adjust`
- `GET /api/v1/menu-items/:menuItemId/inventory-requirements`
- `PUT /api/v1/menu-items/:menuItemId/inventory-requirements`
- `GET /api/v1/branches/:branchId/inventory/menu-availability`

`inventory.read` allows branch/company inventory visibility. `inventory.manage`
allows item creation, item updates, branch stock adjustment, and menu item
requirement changes. Owner, branch manager, and menu admin receive management
access. Cashier, waiter, kitchen, and barista receive read access only.

Scoped item and menu-item routes resolve the owning company or branch before
checking staff permissions, so branch-scoped users cannot mutate another
tenant's inventory.

## Stock Movements

Manual stock adjustment supports:

- opening balance;
- stock in;
- stock out;
- correction;
- waste.

The service stores every accepted adjustment as an `InventoryMovement`, updates
the branch level under a PostgreSQL advisory lock, and rejects negative stock.
The movement record stores the unit and resulting quantity for audit-friendly
history.

Accepted orders create `sale_consumption` movements for linked requirements.
Stock consumption runs inside the same transaction as the guarded order accept
transition, so stale/double accept attempts do not consume inventory twice.

`sale_reversal` is present in the enum for future cancellation/refund handling,
but this phase does not implement automatic reversal logic.

## Menu And Ordering

Menu item stock availability is derived from:

- the existing menu item status;
- branch override visibility and availability;
- active required inventory links;
- branch quantity on hand;
- low-stock thresholds.

The branch menu response includes:

- `canOrder`;
- `stockStatus`;
- `stockReasons`;
- `missingRequirements`;
- `lowStockRequirements`.

Customer menu cards and item detail panels disable ordering when `canOrder` is
false. Cart add/update paths validate stock for the requested item quantity.
Cart submit validates stock across the whole cart so duplicate lines of the
same menu item are counted together.

The backend remains the source of truth. Manual branch availability still works
independently; inventory never flips an override flag behind the operator's
back.

## AI Waiter Integration

AI waiter menu grounding now asks the inventory service for branch menu
availability before building the menu snapshot. Out-of-stock items are filtered
out of the grounded candidate set, so the assistant does not suggest items that
the backend would block.

The existing AI waiter safety boundaries still apply:

- AI cannot submit final orders;
- AI cannot change prices;
- AI cannot bypass cart validation;
- cart proposals still go through backend cart endpoints.

## Staff Inventory UI

The new `/staff/inventory` surface is available in the staff shell for users
with `inventory.read`.

The page includes:

- branch selector;
- inventory health metrics;
- inventory item creation and status management for managers;
- branch stock adjustment form;
- low-stock and out-of-stock alerts;
- level and recent movement table;
- menu item requirement management;
- computed menu availability review.

Read-only staff can inspect stock state without seeing management controls.

## Owner And Setup Integration

Owner analytics summary now includes:

- low-stock count;
- out-of-stock count;
- stock-blocked menu item count;
- recent inventory movements.

Tenant onboarding readiness includes an inventory foundation item. It is treated
as a setup attention item rather than a critical demo blocker. The branch
onboarding menu metadata also reports inventory item count, tracked branch
levels, low-stock count, and out-of-stock count.

## Smoke Path

Use the normal local stack and Balkona demo data:

1. Start local Postgres/Redis and apply migrations.
2. Generate Prisma and start API/web through the README quick start.
3. Log in as manager or owner and open `/staff/inventory`.
4. Create an inventory item, set branch opening balance, and link it to a menu
   item requirement.
5. Confirm the customer menu still shows the item when stock is sufficient.
6. Reduce stock below the required quantity and confirm the customer menu/item
   panel disables add-to-cart with sold-out copy.
7. Restore stock, submit a customer order, accept it from cashier, and confirm a
   `sale_consumption` movement appears.
8. Open `/staff/owner` and `/staff/setup` to confirm inventory signals appear.

## Non-Goals

Product Phase 4I.0 intentionally does not add:

- suppliers or purchase orders;
- COGS, margin, or recipe costing;
- transfer orders between branches;
- barcode scanners;
- expiry dates or batch tracking;
- vendor invoices;
- offline inventory sync;
- automatic stock reversal for cancelled/refunded orders;
- online payment or POS integration.

## Validation

The phase should validate with:

- `pnpm --filter @balcona-bar/api prisma:migrate:dev`
- `pnpm --filter @balcona-bar/api prisma:generate`
- `pnpm --filter @balcona-bar/api build`
- `pnpm --filter @balcona-bar/api test -- --runInBand`
- `pnpm --filter @balcona-bar/web lint`
- `pnpm --filter @balcona-bar/web typecheck`
- `pnpm web:build`

Next recommended phase: inventory refinement for purchasing, supplier
receiving, transfer workflows, costing, and stock reversal policy.
