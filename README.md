# balcona-bar

Balcona Bar is organized as a monorepo for the Cafe AI Waiter App / Smart Café Operating System. Phase 13 adds the deterministic Smart Cashier / Auto-Accept Rules foundation.

## Layout

- `apps/api` - NestJS backend application.
- `apps/api/prisma` - Prisma schema, migrations, and seed data.
- `docker-compose.yml` - local PostgreSQL and Redis services.
- `docs/architecture` - architecture decisions and phase notes.

## Local quick start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the API environment example:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. Start local infrastructure:

   ```bash
   docker compose up -d
   ```

4. Generate the Prisma client:

   ```bash
   pnpm --filter @balcona-bar/api prisma:generate
   ```

5. Apply the local development migrations:

   ```bash
   pnpm --filter @balcona-bar/api prisma:migrate:dev
   ```

6. Seed local demo data:

   ```bash
   pnpm --filter @balcona-bar/api prisma:seed
   ```

7. Build the API:

   ```bash
   pnpm --filter @balcona-bar/api build
   ```

8. Start the API:

   ```bash
   pnpm --filter @balcona-bar/api start:dev
   ```

## API verification

The health endpoint remains outside the API prefix:

```bash
curl http://localhost:3000/health
```

Service metadata remains available at:

```bash
curl http://localhost:3000/api/v1/system/info
```

Company and branch verification endpoints:

```bash
curl http://localhost:3000/api/v1/companies
curl http://localhost:3000/api/v1/companies/balcona-bar/branches
```

Read the company menu and branch menu:

```bash
curl http://localhost:3000/api/v1/companies/balcona-bar/menu
curl http://localhost:3000/api/v1/branches/<branchId>/menu
curl http://localhost:3000/api/v1/branches/<branchId>/menu/unavailable
```

Read a detailed menu item:

```bash
curl http://localhost:3000/api/v1/menu/items/<itemId>
```

List tables and resolve a seeded QR token:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/tables
curl http://localhost:3000/api/v1/tables/resolve/balcona-main-t01
```

Start or resume a table session from a QR token:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/start \
  -H "Content-Type: application/json" \
  -d '{"qrToken":"balcona-main-t01","guestLabel":"Guest 1","partySize":2}'
```

Read, view, close, or list table sessions:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/view
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/close \
  -H "Content-Type: application/json" \
  -d '{"reason":"guest-left"}'
curl http://localhost:3000/api/v1/branches/<branchId>/table-sessions/active
```

Read the active draft cart for a table session:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/cart
```

Add an item to the draft cart:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/items \
  -H "Content-Type: application/json" \
  -d '{
    "menuItemId": "<menuItemId>",
    "quantity": 1,
    "notes": "Less ice",
    "selectedModifiers": [
      {
        "modifierGroupId": "<modifierGroupId>",
        "optionIds": ["<modifierOptionId>"]
      }
    ]
  }'
```

Update, remove, clear, or validate the draft cart:

```bash
curl -X PATCH http://localhost:3000/api/v1/cart/items/<cartItemId> \
  -H "Content-Type: application/json" \
  -d '{"quantity":2,"notes":"No sugar"}'

curl -X DELETE http://localhost:3000/api/v1/cart/items/<cartItemId>

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/clear

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/validate
```

Submit a valid draft cart with an idempotency key:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/submit \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-session-<sessionId>-submit-1" \
  -d '{"customerNote":"Please bring water too"}'
```

List cashier intake orders for a branch:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/cashier/orders
curl http://localhost:3000/api/v1/branches/<branchId>/cashier/orders?status=all
```

Read an order:

```bash
curl http://localhost:3000/api/v1/orders/<orderId>
```

Accept or reject an order at cashier intake. Accepting creates pending preparation tasks for order items routed to `barista`, `kitchen`, or `dessert` stations:

```bash
curl -X POST http://localhost:3000/api/v1/orders/<orderId>/cashier/accept \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/orders/<orderId>/cashier/reject \
  -H "Content-Type: application/json" \
  -d '{"reason":"Item unavailable","staffUserId":"<optionalStaffUserId>"}'
```

Read Smart Cashier settings. Missing settings return the default effective mode: disabled `manual_only`.

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/smart-cashier/settings
```

Enable deterministic auto-accept for safe orders:

```bash
curl -X PUT http://localhost:3000/api/v1/branches/<branchId>/smart-cashier/settings \
  -H "Content-Type: application/json" \
  -d '{
    "enabled": true,
    "mode": "auto_accept_safe_orders",
    "maxAutoAcceptSubtotalMinor": 50000,
    "requirePaymentBeforeAutoAccept": false,
    "reviewCustomerNotes": true
  }'
```

Submit a valid draft cart. If every Smart Cashier check passes, the response shows `cashier_accepted`, `autoAcceptDecision=auto_accepted`, and created preparation tasks:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/submit \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-session-<sessionId>-submit-auto-accept-1" \
  -d '{}'
```

Evaluate or explicitly attempt auto-accept for an existing order:

```bash
curl -X POST http://localhost:3000/api/v1/orders/<orderId>/smart-cashier/evaluate

curl -X POST http://localhost:3000/api/v1/orders/<orderId>/smart-cashier/attempt-auto-accept
```

Create, list, and disable Smart Cashier review rules:

```bash
curl -X POST http://localhost:3000/api/v1/branches/<branchId>/smart-cashier/review-rules \
  -H "Content-Type: application/json" \
  -d '{"scope":"menu_item","menuItemId":"<menuItemId>","reasonCode":"item_requires_review","note":"Seasonal manual check"}'

curl http://localhost:3000/api/v1/branches/<branchId>/smart-cashier/review-rules

curl -X POST http://localhost:3000/api/v1/smart-cashier/review-rules/<ruleId>/disable
```

List pending preparation tasks for a branch:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/preparation-tasks
```

Filter preparation tasks by station or status:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/preparation-tasks?station=barista
curl http://localhost:3000/api/v1/branches/<branchId>/preparation-tasks?station=kitchen&status=preparing
curl http://localhost:3000/api/v1/branches/<branchId>/preparation-tasks?station=all&status=all
```

Start, mark ready, or cancel a preparation task:

```bash
curl -X POST http://localhost:3000/api/v1/preparation-tasks/<taskId>/start \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/preparation-tasks/<taskId>/ready \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/preparation-tasks/<taskId>/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"Made by mistake","staffUserId":"<optionalStaffUserId>"}'
```

List preparation tasks for an order:

```bash
curl http://localhost:3000/api/v1/orders/<orderId>/preparation-tasks
```

List orders for a table session:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/orders
```

Read table-session notifications and mark a stored notification read or dismissed:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/notifications

curl -X POST http://localhost:3000/api/v1/notifications/<notificationId>/read

curl -X POST http://localhost:3000/api/v1/notifications/<notificationId>/dismiss
```

Create and inspect presence events:

```bash
curl -X POST http://localhost:3000/api/v1/presence/events \
  -H "Content-Type: application/json" \
  -d '{"branchId":"<branchId>","tableSessionId":"<sessionId>","triggerType":"manual_staff_trigger","sourceChannel":"in_app"}'

curl http://localhost:3000/api/v1/branches/<branchId>/presence/events
curl http://localhost:3000/api/v1/branches/<branchId>/presence/events?triggerType=manual_staff_trigger
curl http://localhost:3000/api/v1/branches/<branchId>/presence/events?tableSessionId=<sessionId>
```

List branch notifications:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/notifications
curl http://localhost:3000/api/v1/branches/<branchId>/notifications?status=sent
curl http://localhost:3000/api/v1/branches/<branchId>/notifications?kind=welcome
```

Read customer-facing order and table-session status:

```bash
curl http://localhost:3000/api/v1/orders/<orderId>/customer-status

curl http://localhost:3000/api/v1/table-sessions/<sessionId>/customer-status

curl http://localhost:3000/api/v1/table-sessions/<sessionId>/customer-timeline
```

Starting a preparation task also stores a deduped in-app `preparation_started` notification for the table session:

```bash
curl -X POST http://localhost:3000/api/v1/preparation-tasks/<taskId>/start \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'
```

Create, list, and manage waiter calls:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/waiter-calls \
  -H "Content-Type: application/json" \
  -d '{"type":"call_waiter","message":"Please send someone when available","priority":1}'

curl http://localhost:3000/api/v1/table-sessions/<sessionId>/waiter-calls
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/waiter-calls?status=all

curl http://localhost:3000/api/v1/branches/<branchId>/waiter-calls
curl http://localhost:3000/api/v1/branches/<branchId>/waiter-calls?status=acknowledged&type=need_bill

curl http://localhost:3000/api/v1/waiter-calls/<waiterCallId>

curl -X POST http://localhost:3000/api/v1/waiter-calls/<waiterCallId>/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/waiter-calls/<waiterCallId>/resolve \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","resolutionNote":"Handled at table"}'

curl -X POST http://localhost:3000/api/v1/waiter-calls/<waiterCallId>/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"No longer needed"}'
```

Customer timeline responses include waiter call created, acknowledged, resolved, and cancelled events:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/customer-timeline
```

Development-only staff verification:

```bash
curl http://localhost:3000/api/v1/staff
```

Get staff access context and effective permissions:

```bash
curl http://localhost:3000/api/v1/staff/<staffUserId>/access
```

Check if a cashier can accept an order for a branch:

```bash
curl "http://localhost:3000/api/v1/staff/<cashierStaffUserId>/can?permission=orders.accept&branchId=<branchId>"
```

Check if a cashier can attempt Smart Cashier auto-accept:

```bash
curl "http://localhost:3000/api/v1/staff/<cashierStaffUserId>/can?permission=smart_cashier.auto_accept&branchId=<branchId>"
```

Check if kitchen staff can start preparation:

```bash
curl "http://localhost:3000/api/v1/staff/<kitchenStaffUserId>/can?permission=preparation.start&branchId=<branchId>"
```

Check if a waiter can resolve a waiter call:

```bash
curl "http://localhost:3000/api/v1/staff/<waiterStaffUserId>/can?permission=waiter_calls.resolve&branchId=<branchId>"
```

Denied example for the wrong role:

```bash
curl "http://localhost:3000/api/v1/staff/<waiterStaffUserId>/can?permission=orders.accept&branchId=<branchId>"
```

Check branch-level access with explicit company and branch scope:

```bash
curl "http://localhost:3000/api/v1/staff/<staffUserId>/can?permission=branches.read&companyId=<companyId>&branchId=<branchId>"
```

Open realtime branch streams. These SSE endpoints are future-browser `EventSource('/api/v1/realtime/...')` friendly. PowerShell or curl can open them, but the connection stays open for future events and heartbeats:

```bash
curl http://localhost:3000/api/v1/realtime/branches/<branchId>/stream?channel=orders
curl http://localhost:3000/api/v1/realtime/branches/<branchId>/stream?channel=preparation
curl http://localhost:3000/api/v1/realtime/branches/<branchId>/stream?channel=waiter_calls
```

Open realtime table-session streams:

```bash
curl http://localhost:3000/api/v1/realtime/table-sessions/<sessionId>/stream?channel=status
curl http://localhost:3000/api/v1/realtime/table-sessions/<sessionId>/stream?channel=notifications
```

List recent stored realtime events:

```bash
curl http://localhost:3000/api/v1/realtime/branches/<branchId>/events
curl http://localhost:3000/api/v1/realtime/branches/<branchId>/events?channel=orders&limit=25

curl http://localhost:3000/api/v1/realtime/table-sessions/<sessionId>/events
curl http://localhost:3000/api/v1/realtime/table-sessions/<sessionId>/events?channel=status&limit=25
```

## Phase notes

- Phase 1 backend skeleton: `docs/architecture/phase-1-backend-skeleton.md`
- Phase 2 multi-café foundation: `docs/architecture/phase-2-multi-cafe-foundation.md`
- Phase 3 menu foundation: `docs/architecture/phase-3-menu-foundation.md`
- Phase 4 table session foundation: `docs/architecture/phase-4-table-session-foundation.md`
- Phase 5 customer cart draft foundation: `docs/architecture/phase-5-customer-cart-draft-foundation.md`
- Phase 6 cart submit and cashier intake foundation: `docs/architecture/phase-6-cart-submit-cashier-intake-foundation.md`
- Phase 7 kitchen and barista queue foundation: `docs/architecture/phase-7-kitchen-barista-queue-foundation.md`
- Phase 8 presence, notifications, and welcome trigger foundation: `docs/architecture/phase-8-presence-notifications-welcome-triggers-foundation.md`
- Phase 9 customer order status foundation: `docs/architecture/phase-9-customer-order-status-foundation.md`
- Phase 10 waiter call system foundation: `docs/architecture/phase-10-waiter-call-system-foundation.md`
- Phase 11 staff roles and permissions foundation: `docs/architecture/phase-11-staff-roles-permissions-foundation.md`
- Phase 12 realtime events foundation: `docs/architecture/phase-12-realtime-events-foundation.md`
- Phase 13 Smart Cashier auto-accept foundation: `docs/architecture/phase-13-smart-cashier-auto-accept-foundation.md`
