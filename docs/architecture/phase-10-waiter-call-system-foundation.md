# Phase 10 Waiter Call System Foundation

Phase 10 adds a backend lifecycle for customer-initiated human help requests from a table session.

## Purpose

Waiter calls support staff instead of replacing staff. The customer can request help, and staff can see, acknowledge, resolve, or the customer can cancel that request. This keeps human service visible inside the same table-session timeline as orders, preparation, and notifications.

## Lifecycle

Waiter calls move through:

- `open` when a customer creates the request.
- `acknowledged` when staff accepts ownership and the customer should know a waiter is on the way.
- `resolved` when staff has handled the request.
- `cancelled` when the customer cancels an unresolved request.

Every lifecycle change writes a `WaiterCallEvent` with actor type and optional metadata.

## Branch Queue

`GET /api/v1/branches/:branchId/waiter-calls` is the staff queue. It defaults to open calls and sorts by priority descending, then oldest created call first. Staff can filter by call status or type.

## Table Session Calls

`POST /api/v1/table-sessions/:sessionId/waiter-calls` creates a call only for an open table session. Optional order references must belong to the same table session. Customers can list their table-session calls and cancel unresolved calls.

## Notifications

The waiter call lifecycle stores in-app `waiter_call` notifications for created, acknowledged, and resolved events using dedupe keys:

- `waiter-call-created:<waiterCallId>`
- `waiter-call-acknowledged:<waiterCallId>`
- `waiter-call-resolved:<waiterCallId>`

No external push, Firebase/APNs, WhatsApp, SMS, Wi-Fi, BLE, or geofence delivery is sent in this phase.

## Deferred Work

Production staff auth/login, role enforcement, customer UI/PWA, Flutter UI, AI waiter behavior, payment/POS, inventory, and external delivery channels are intentionally deferred. Staff identity is optional and only validated when a staff user ID is supplied.

## Future Fit

The waiter call APIs prepare both the customer PWA and staff dashboard: customers get a timeline-safe help lifecycle, while operations get a branch queue and full call event history.
