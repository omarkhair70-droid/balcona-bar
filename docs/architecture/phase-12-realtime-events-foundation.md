# Phase 12 Realtime Events Foundation

Phase 12 adds a stored realtime event log plus single-process Server-Sent Events fanout for future customer and staff screens.

## Purpose

Realtime events are separate from stored notifications. Notifications are customer-facing messages with read/dismiss state. Realtime events are operational signals that tell future screens when backend state changed: new cashier orders, preparation task updates, waiter-call lifecycle changes, notification changes, and customer table-session status updates.

## SSE Decision

The first transport is Server-Sent Events instead of WebSocket. SSE works naturally with future browser/PWA `EventSource`, keeps the protocol simple for branch dashboards, and avoids introducing a bidirectional client protocol before production auth and UI exist.

## Event Log and Fanout

Every emitted event is stored in `RealtimeEvent` with scope IDs, type, channel, JSON payload, and creation time. The service also publishes the same event envelope to in-memory RxJS subscribers for currently connected SSE clients.

This foundation writes realtime rows inside the same transaction where the state change happens when a transaction client is available. It also publishes immediately from that call. Future production scaling should move delivery to a post-commit outbox worker, Redis Pub/Sub, or similar distributed fanout.

## Streams

Branch streams use:

- `GET /api/v1/realtime/branches/:branchId/stream?channel=all`
- `orders` for `branch_orders`
- `preparation` for `branch_preparation`
- `waiter_calls` for `branch_waiter_calls`
- `notifications` for `branch_notifications`

Table-session streams use:

- `GET /api/v1/realtime/table-sessions/:sessionId/stream?channel=all`
- `status` for `session_status`
- `notifications` for `session_notifications`
- `waiter_calls` for `session_waiter_calls`

Both stream types validate that the branch or table session exists, emit an immediate `connection_opened` event, and keep the connection alive with heartbeat events roughly every 25 seconds.

## Debug Event APIs

Recent stored events can be read without opening a stream:

- `GET /api/v1/realtime/branches/:branchId/events`
- `GET /api/v1/realtime/table-sessions/:sessionId/events`

Both support optional `channel`, `type`, and `limit` query parameters.

## Current Limits

Fanout is in memory and single-process only. It is enough for local development and early UI integration, but it does not provide distributed delivery guarantees across multiple API instances. Redis Pub/Sub, a durable outbox, or a worker-based event bus should be added before production multi-server deployment.

## Future Auth

Realtime streams are dev/open endpoints for now. Future staff dashboard streams should integrate with `StaffPermissionGuard`, and future customer streams should validate table-session or customer-session context before opening the connection.

## Deferred Work

This phase does not add Flutter UI, web/PWA UI, production auth/login, external push/Firebase/APNs/WhatsApp/SMS, Redis Pub/Sub, WebSocket, payment/POS, AI waiter behavior, or Phase 13 behavior.
