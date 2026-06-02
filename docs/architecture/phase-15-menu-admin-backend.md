# Phase 15 Menu Admin Backend

Phase 15 adds backend-only menu administration APIs for the future owner,
manager, and menu-admin dashboard. PostgreSQL remains the source of truth, and
the phase intentionally stays within normal transactional NestJS and Prisma
services.

## Purpose

The menu admin backend manages company-level menu structure and branch-level
availability rules:

- categories
- menu items, prices, statuses, featured flags, sort order, and stations
- modifier groups and modifier options
- menu item to modifier group links
- branch menu item overrides for price, visibility, availability, and sort order

The API is separate from the public/customer menu endpoints. Customer menu reads
continue to use the existing public `menu` module, while admin reads and writes
live under `menu-admin`.

## Public Menu vs Admin Menu

The customer menu is optimized for guests and only exposes active items that are
available and visible in the branch context. The admin menu is an operational
surface that can read inactive and archived records, manage ordering, and edit
branch overrides.

This separation keeps future dashboard workflows from changing customer menu
behavior accidentally.

## Safe Status-Based Changes

Phase 15 prefers status transitions over hard deletion:

- categories can be activated or deactivated
- menu items can be activated, deactivated, or archived
- modifier groups and options can be activated or deactivated

Hard delete endpoints are not part of this phase. Existing orders and carts may
reference menu records, so operational changes are modeled as status changes.

## Snapshot Preservation

Submitted carts and orders store backend-owned item and modifier snapshots.
Changing a menu item name, price, station, or modifier setup does not mutate
historical order/cart snapshots. This preserves past order history and customer
timelines.

## Branch Overrides

Branch overrides are scoped by `branchId + menuItemId` and are upserted by the
admin API. They can override price, visibility, availability, and sort order for
one branch without changing company-level menu defaults.

Deleting an override returns the branch to the company-level defaults for that
item.

## Modifier Rules

Modifier groups validate selection rules before write:

- `minSelections` must be non-negative
- `maxSelections` must be greater than or equal to `minSelections`
- `single` selection groups must have `maxSelections = 1`
- required groups must have `minSelections >= 1`

Modifier option slugs remain unique inside a group, and modifier group slugs
remain unique inside a company.

## Deferred Work

Media upload and storage is deferred to Phase 16. Phase 15 keeps `imageUrl` as a
plain URL field and does not add upload, storage, resizing, or asset ownership
logic.

Redis and BullMQ are also not implemented in this phase. Menu admin writes are
transactional database operations, and queue/scaling decisions remain reserved
for later phases, especially Phase 19 and Phase 24.

## Future Permissions

Phase 15 extends the staff permission map with menu-specific permissions:

- `menu.read`
- `menu.manage_categories`
- `menu.manage_items`
- `menu.manage_modifiers`
- `menu.manage_branch_overrides`

The controller does not enforce production auth yet. Future dashboard auth can
attach the existing staff permission guard to these routes without changing the
menu admin service contracts.
