# Phase 7 Kitchen and Barista Queue Foundation

Phase 7 creates preparation queue tasks after cashier acceptance. Customer submit still sends an order to cashier only; preparation tasks are created only when the cashier accepts the submitted order.

## Cashier Acceptance Trigger

`POST /api/v1/orders/:orderId/cashier/accept` remains the workflow gate. The accept transaction updates the order to `cashier_accepted`, writes the `cashier_accepted` order event, and creates preparation tasks for actionable order items.

Rejected orders do not create preparation tasks. If task creation fails, cashier acceptance fails too because both happen in the same transaction.

## Station Routing

Preparation routing uses the existing `MenuItem.station` value captured through each submitted `OrderItem` relationship. Phase 7 creates tasks for:

- `barista`
- `kitchen`
- `dessert`

Items whose station is `cashier` are intentionally left out of preparation queues. Cashier-station items are still part of the accepted order, but they are not actionable kitchen, barista, or dessert tasks in this phase.

## Snapshot-Based Tasks

`PreparationTask` stores the item name, slug, notes, and quantity copied from the order item snapshot. The kitchen, barista, and dessert queues do not trust client prices, do not recalculate menu prices, and do not read mutable cart state.

The submitted order remains the source of truth. Preparation tasks are operational work items derived from that order snapshot.

## Task Lifecycle

Tasks start as `pending` when the cashier accepts the order.

Staff-facing lifecycle endpoints move a task through:

- `pending` to `preparing`
- `pending` or `preparing` to `ready`
- `pending` or `preparing` to `cancelled`

Each state change writes a `PreparationTaskEvent` so the operational history is preserved.

## Deferred Customer Tracking

Phase 7 does not aggregate preparation tasks into customer-facing order status. That can be added later once preparation routing is stable and the product can decide how to summarize mixed station states for guests.

## Intentionally Deferred

Phase 7 does not implement:

- AI waiter behavior
- Flutter UI
- Customer-facing order tracking UI
- Payment or POS
- Inventory changes
- Production receipt printing
- Production staff authentication and authorization
- Phase 8 behavior
