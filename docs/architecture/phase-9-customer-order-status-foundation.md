# Phase 9 Customer Order Status Foundation

Phase 9 adds read-only customer-facing status aggregation for the future table web/PWA experience.

## Purpose

The customer app needs a simple answer to: "What is happening with my order right now?" The backend now maps internal cashier, preparation, and notification state into customer-safe status, progress, and timeline responses without mutating order or preparation records.

## Status Mapping

- `submitted` orders are shown as `cashier_review`.
- `cashier_rejected` orders are shown as `rejected`.
- `cashier_accepted` orders with no preparation tasks are shown as `accepted`.
- Accepted orders with preparation tasks are mapped from task state:
  - all tasks pending: `queued_for_preparation`
  - at least one preparing and none ready: `preparing`
  - some ready but not all ready: `partially_ready`
  - all ready: `ready`
- Cancelled preparation tasks remain in the preparation totals and do not count as ready. With the current simple behavior, accepted orders with only cancelled/non-ready preparation tasks remain before `ready`.
- Table-session status can expose `draft_cart` when no submitted order exists but a draft cart has items.

## APIs

- `GET /api/v1/orders/:orderId/customer-status`
- `GET /api/v1/table-sessions/:sessionId/customer-status`
- `GET /api/v1/table-sessions/:sessionId/customer-timeline`

The order endpoint returns the customer-safe order status, preparation progress, station summary, timeline, and latest visible notifications. The table-session endpoint aggregates the table, branch, draft cart summary, active/submitted orders, and visible notification summary. The timeline endpoint combines session, notification, order, and preparation milestones into customer-friendly labels.

## Notification Hook

Preparation task start now creates one deduped in-app `preparation_started` notification with `preparation-started:<taskId>`. This is stored only; no external push, Firebase/APNs, WhatsApp, SMS, Wi-Fi, BLE, or geofence delivery is sent.

## Deferred Work

Completion, payment, POS integration, customer UI/PWA, Flutter UI, AI waiter behavior, waiter calls, staff auth/login, and production push channels are intentionally deferred. Orders with no actionable station items can remain `accepted` until future completion/payment phases define the final customer state.

## Future Fit

The responses are stable customer-facing aggregates over backend-owned state. A future PWA can poll or subscribe to these endpoints without learning internal cashier or preparation table details.
