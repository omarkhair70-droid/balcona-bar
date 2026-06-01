# Phase 4 — Table Session Foundation

Phase 4 turns a scanned café table QR token into a backend-controlled `TableSession`. The session is the durable container that future customer-facing and staff-facing features will attach to, without creating orders, carts, AI conversations, payments, or kitchen/cashier workflow yet.

## QR token to table session flow

1. A guest scans the physical QR code for a café table.
2. The client sends `POST /api/v1/table-sessions/start` with the table `qrToken` and optional guest metadata.
3. The backend resolves the QR token to a `CafeTable`, including its `Company`, `Branch`, and `Floor` context.
4. The backend rejects inactive or maintenance tables with a clear API error.
5. The backend either resumes the existing open session for the table or creates a new session.
6. The response returns the session plus company, branch, floor, and table details so a future client can continue into menu, chat, cart, or status flows.

## Create vs. resume behavior

A table should only have one open session at a time. Open sessions are statuses `active` and `idle`.

- If an `active` or `idle` session already exists for the scanned table, the backend resumes it, updates `lastSeenAt`, records a `resumed` event, and returns `wasResumed: true`.
- If no open session exists, the backend creates a new `TableSession`, records a `created` event, and returns `wasResumed: false`.

The service uses transactional logic and a PostgreSQL advisory transaction lock keyed by table id to prevent duplicate open sessions under concurrent QR scans. The migration also adds a partial unique index on `TableSession(tableId)` for `active`/`idle` sessions as a database backstop. Prisma does not model partial unique indexes directly in the schema, so the raw migration owns that strict database constraint while service logic remains the primary application rule.

## Why table session is the future container

A table session represents the guest's current visit at a physical table. Future features can attach records to this session instead of trying to infer context from QR tokens or table ids alone:

- AI waiter conversations can be scoped to the visit.
- Cart state can belong to the visit before an order exists.
- Orders can later reference the visit that produced them.
- Waiter calls and status events can be tracked against the same visit.
- Staff table maps can show which tables currently have active or idle guest sessions.

This foundation keeps table identity, branch identity, guest presence, lifecycle timestamps, and lifecycle events in one place.

## Why no order is created in this phase

Scanning a QR code means the guest has arrived at a table, not that they have ordered anything. Creating an order during QR scan would blur the boundary between presence/session tracking and commerce workflow.

Phase 4 intentionally creates only the `TableSession`. Later phases can introduce carts, order submission, kitchen/cashier routing, and payment state as separate lifecycle steps that reference the session.

## Session status meanings

- `active` — the session is open and recently interacted with.
- `idle` — the session is still open but can be treated by future staff/table-map logic as not recently active.
- `closed` — the session has been explicitly closed and should no longer accept guest activity as an open visit.
- `expired` — the session was ended by expiry policy rather than an explicit close action. Expiry automation is deferred.

## Session events

`TableSessionEvent` records the lifecycle trail for a session:

- `created` when a new session is opened.
- `resumed` when a QR scan reuses an existing open session.
- `viewed` when the client touches/views the session.
- `closed` when the session is explicitly closed.
- `expired` reserved for future expiry automation.

## Intentionally deferred

Phase 4 does not implement:

- AI waiter behavior.
- Cart creation or cart mutation.
- Order creation or order lifecycle.
- Waiter calls.
- Cashier/kitchen workflow.
- Payment or POS integration.
- Flutter UI.
- Admin dashboard features.
