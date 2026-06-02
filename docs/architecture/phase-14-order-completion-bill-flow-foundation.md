# Phase 14 Order Completion and Bill Flow Foundation

Phase 14 extends the backend beyond accepted orders and ready preparation tasks. It adds an operational ending for café service: orders can become preparing, ready, served, and completed, and table sessions can request and track a bill.

This bill flow is operational only. It is not payment processing, POS integration, a tax invoice, a receipt system, or legal billing.

## Order Lifecycle

Orders keep the existing statuses `submitted`, `cashier_accepted`, `cashier_rejected`, and `cancelled`, and add:

- `preparing` when a preparation task starts.
- `ready` when all non-cancelled preparation tasks for the order are ready.
- `served` when staff marks the order served to the table.
- `completed` when staff completes the order or a bill close completes already served orders.

Preparation task actions remain the source of truth for preparation work. Starting a task emits the existing preparation task realtime event and then promotes the order from `cashier_accepted` to `preparing` once. Marking the final active task ready promotes the order to `ready` once.

## Serve and Complete

`POST /api/v1/orders/:orderId/serve` marks an accepted, preparing, or ready order as served. If the order has preparation tasks, every non-cancelled task must be ready first.

`POST /api/v1/orders/:orderId/complete` marks a served order, or a ready order where the serving step is skipped, as completed.

Both endpoints keep staff identity optional for now and write `OrderEvent` rows plus realtime order events. The served action also creates an in-app `order_served` notification.

## Bill Requests

`BillRequest` models a table-session request for the bill. It stores an operational subtotal snapshot from billable orders:

- included: `cashier_accepted`, `preparing`, `ready`, `served`, and `completed`.
- excluded: `submitted`, `cashier_rejected`, and `cancelled`.

Only active or idle table sessions can request a bill. If a session already has an active bill request (`open`, `acknowledged`, or `presented`), the request endpoint returns it instead of creating a duplicate.

Bill requests move through:

- `open`
- `acknowledged`
- `presented`
- `closed`
- `cancelled`

Closing a bill request is still not payment. It marks already served orders for the table session as `completed`, leaves the table session open, and records operational events.

## Realtime

Phase 14 adds order and bill realtime event types on existing channels:

- order lifecycle: `order_preparation_started`, `order_preparation_ready`, `order_served`, `order_completed`
- bill lifecycle: `bill_requested`, `bill_acknowledged`, `bill_presented`, `bill_closed`, `bill_cancelled`

Branch subscribers can continue using `branch_orders`. Customer table-session subscribers can continue using `session_status`.

## Notifications

New in-app notification kinds:

- `order_served`
- `bill_requested`
- `bill_presented`
- `bill_closed`

External push, Firebase/APNs, WhatsApp, SMS, and production delivery channels remain deferred.

## Permissions

The permission map adds future guard keys:

- `orders.serve`
- `orders.complete`
- `bills.read`
- `bills.request`
- `bills.acknowledge`
- `bills.present`
- `bills.close`
- `bills.cancel`

`owner` receives all permissions. `branch_manager` receives all Phase 14 permissions. `cashier` receives bill queue/close/cancel permissions and `orders.complete`. `waiter` receives bill read/request/acknowledge/present and `orders.serve`.

Production auth and route guard enforcement remain deferred.

## Deferred

This phase does not add payment/POS, online payment, invoices, tax receipts, Flutter UI, web/PWA UI, AI waiter behavior, production auth/login, external push channels, automatic table-session close, or Phase 15 behavior.
