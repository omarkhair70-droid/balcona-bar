# balcona-bar

Balcona Bar is organized as a monorepo for the Cafe AI Waiter App / Smart Café Operating System. Phase 9 adds read-only customer order status and timeline APIs over the existing order, preparation, and notification state.

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

Development-only staff verification:

```bash
curl http://localhost:3000/api/v1/staff
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
