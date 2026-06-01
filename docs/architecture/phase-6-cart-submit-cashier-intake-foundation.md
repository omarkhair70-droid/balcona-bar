# Phase 6 Cart Submit and Cashier Intake Foundation

Phase 6 turns a valid customer draft cart into a submitted backend-owned order snapshot. The submitted order appears in the cashier intake queue for the branch. Cashier acceptance and rejection are recorded, but accepted orders do not route to kitchen or barista queues yet.

## Cart Draft vs Submitted Order

The cart remains a mutable draft. Customers can add items, remove lines, update quantities, clear the draft, and validate it while the table session is open.

Submitting the cart creates an `Order` and marks the draft cart as `converted`. The order is the durable submitted record. It is no longer recalculated from client input, future AI output, or mutable cart state.

The cart submit endpoint is:

`POST /api/v1/table-sessions/:sessionId/cart/submit`

It requires an open table session, a non-empty draft cart, and a valid cart according to the Phase 5 menu and modifier validation rules.

## Snapshot Ownership

`OrderItem` and `OrderItemModifierOption` copy item, modifier, price, quantity, note, and currency snapshots from the validated cart. This preserves what the customer submitted even if the menu changes later.

The backend remains the only pricing authority. Clients and future AI flows provide IDs, quantities, notes, and modifier choices only. Prices come from database-backed cart snapshots after validation confirms they still match current menu state.

## Idempotency and Duplicate Submit Prevention

Submit supports the optional `Idempotency-Key` header. When the same table session submits with the same key again, the service returns the existing order with an idempotency replay indicator instead of creating a duplicate.

The submit transaction also takes a PostgreSQL advisory lock scoped to the table session. That keeps rapid double taps from creating duplicate orders while the draft cart is converted.

Branch order numbers are generated under a branch-scoped advisory lock and use a readable `B0001` style format. This is simple and deterministic for local development. The unique `(branchId, orderNumber)` constraint protects branch scope.

## Cashier Queue Lifecycle

Submitted orders enter the cashier queue with status `submitted`.

Cashier intake endpoints are:

- `GET /api/v1/branches/:branchId/cashier/orders`
- `GET /api/v1/orders/:orderId`
- `POST /api/v1/orders/:orderId/cashier/accept`
- `POST /api/v1/orders/:orderId/cashier/reject`
- `GET /api/v1/table-sessions/:sessionId/orders`

Accepting an order changes the status to `cashier_accepted`, records `cashierAcceptedAt`, and writes an `OrderEvent`.

Rejecting an order changes the status to `cashier_rejected`, records `cashierRejectedAt`, stores the optional rejection reason, and writes an `OrderEvent`.

## Why Acceptance Does Not Route Yet

Phase 6 proves the handoff from customer submit to cashier intake only. A cashier-accepted order remains a cashier workflow result; it does not create kitchen or barista queue items.

Kitchen and barista routing will come later after cashier acceptance is established as the system gate.

## Intentionally Deferred

Phase 6 does not implement:

- AI waiter behavior
- Kitchen queue
- Barista queue
- Routing accepted orders to preparation stations
- Payment, POS, or payment intents
- Staff login or authorization
- Inventory changes
- Production receipt printing
- Flutter UI
