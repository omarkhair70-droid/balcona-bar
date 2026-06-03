# balcona-bar

Balcona Bar is organized as a monorepo for the Cafe AI Waiter App / Smart Cafe Operating System. The backend core is complete through Phase 24, UI Phase 1 adds the first Next.js web foundation for customer and staff experiences, UI Phase 2 adds the customer PWA core, UI Phase 3 adds the customer AI waiter experience, UI Phase 4 adds the cashier dashboard core, UI Phase 5 adds the kitchen/barista dashboard core, UI Phase 6 adds the waiter dashboard and attention queue, and UI Phase 7 adds the owner/manager command center.

## Layout

- `apps/api` - NestJS backend application.
- `apps/api/prisma` - Prisma schema, migrations, and seed data.
- `apps/web` - Next.js App Router frontend foundation.
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

3. Copy the web environment example:

   ```bash
   cp apps/web/.env.example apps/web/.env.local
   ```

   `NEXT_PUBLIC_API_BASE_URL` defaults to `http://localhost:3000/api/v1`.

4. Start local infrastructure:

   ```bash
   docker compose up -d
   ```

5. Generate the Prisma client:

   ```bash
   pnpm --filter @balcona-bar/api prisma:generate
   ```

6. Apply the local development migrations:

   ```bash
   pnpm --filter @balcona-bar/api prisma:migrate:dev
   ```

7. Seed local demo data:

   ```bash
   pnpm --filter @balcona-bar/api prisma:seed
   ```

8. Build the API:

   ```bash
   pnpm --filter @balcona-bar/api build
   ```

9. Start the API:

   ```bash
   pnpm --filter @balcona-bar/api start:dev
   ```

10. Start the web app:

   ```bash
   pnpm --filter @balcona-bar/web dev
   ```

   The web app runs on port `3001` by default.

11. Open the customer PWA demo:

   ```text
   http://localhost:3001/customer
   ```

   The seeded QR token is `balcona-main-t01`, which can also be opened directly at:

   ```text
   http://localhost:3001/customer/table/balcona-main-t01
   ```

   From the customer table home, open AI Waiter, send a suggested prompt,
   apply or reject a cart proposal if one is returned, review the cart, and
   submit the order manually from the cart flow.

12. Open the staff cashier demo:

   ```text
   http://localhost:3001/staff/login
   ```

   Bootstrap the local/dev staff password if needed, sign in with the seeded
   staff account documented below, then open `/staff/cashier`. Submit a
   customer order from `/customer`, watch it appear in the cashier dashboard,
   and accept or reject it from the detail panel.

13. Open the kitchen/barista demo:

   ```text
   http://localhost:3001/staff/kitchen
   ```

   After a customer submits an order and the cashier accepts it, the backend
   creates preparation tasks. Kitchen or barista staff can start a task and mark
   it ready from the preparation dashboard. When all active preparation tasks
   for an order are ready, the backend can move the order toward ready state.

14. Open the waiter dashboard demo:

   ```text
   http://localhost:3001/staff/waiter
   ```

   From `/customer`, create a service call or request the bill. Waiter staff
   can open `/staff/waiter`, acknowledge the call, resolve it, and review table
   attention signals for waiter calls, bill requests, ready orders not served,
   preparation delays, and AI waiter escalations.

15. Open the owner/manager command center:

   ```text
   http://localhost:3001/staff/owner
   ```

   The owner dashboard aggregates existing branch endpoints to show order,
   preparation, waiter-call, bill, attention, realtime, menu, and experience
   readiness without requiring a dedicated analytics endpoint.

Useful root scripts:

```bash
pnpm api:build
pnpm web:build
pnpm web:lint
pnpm web:typecheck
```

## UI Phase 1 status

UI Phase 1 adds `apps/web` with a premium design system and product shell:

- Next.js App Router route groups for customer and staff shells
- Tailwind CSS variables for dynamic theme tokens
- API client and endpoint helpers
- React Query provider
- SSE client foundation using `@microsoft/fetch-event-source`
- PWA manifest and static asset caching foundation using `@ducanh2912/next-pwa`
- reusable CustomerShell, StaffShell, DashboardShell, UI primitives, haptics, and sound utilities
- polished static preview surfaces for customer and staff routes

Full customer PWA screens, staff dashboards, AI waiter UI, production auth screens, payment, and backend behavior changes are intentionally outside this phase.

## UI Phase 2 status

UI Phase 2 builds the customer PWA core on top of the Phase 1 foundation:

- customer entry and table QR start/resume routes
- persisted table session state with the returned customer access token context
- session home, menu, cart, status, and service routes
- branch menu browsing with item details, modifiers, notes, quantity, and add-to-cart
- cart read, update, remove, clear, validate, and submit flows
- order status, customer timeline, waiter calls, bill request, and bill state surfaces
- table-session realtime invalidation through the existing SSE client
- branch experience loading with compatible design-token application

Kitchen or barista queues, staff dashboards, payment/POS, AI waiter chat UI, external AI, and backend behavior changes remain outside this phase.

## UI Phase 3 status

UI Phase 3 adds the customer AI waiter experience inside the Customer PWA:

- `/customer/session/[sessionId]/ai-waiter` route
- AI waiter start/resume, message history, message composer, and suggested prompts
- English/Arabic language foundation with right-to-left layout support
- tenant-ready tone/copy sourced from effective experience data when available
- menu-grounded safety copy and proposal rendering
- backend cart proposal apply/reject actions
- cart invalidation after proposal application
- human waiter escalation fallback
- visible errors for AI session, message, proposal, escalation, and close actions

The AI waiter never submits orders, changes prices, bypasses cart validation, or replaces the final cart review and submit flow. External AI provider integration remains outside this UI phase.

## UI Phase 4 status

UI Phase 4 adds the cashier dashboard core inside the Staff shell:

- `/staff` overview with login state, branch selection, and staff surface links
- `/staff/login` staff auth screen using the existing backend login response
- `/staff/cashier` cashier dashboard with branch orders, order detail, and bill requests
- persisted staff auth store with access token, session, effective access, default branch, selected branch, and restore/clear helpers
- cashier order filters, accept, reject with optional reason, visible success/error feedback, and query invalidation
- bill request active/recent lanes with acknowledge, present, and close actions
- branch SSE realtime invalidation, compact realtime status, recent event activity, and subtle best-effort notification sound

Kitchen/barista dashboards, waiter dashboard, owner/manager command center, payment/POS, new backend behavior, and AI behavior changes remain outside this phase.

## UI Phase 5 status

UI Phase 5 adds the Kitchen / Barista Dashboard Core inside the Staff shell:

- `/staff/kitchen` live preparation task board for selected branch
- station filters for all, barista, kitchen, and dessert
- task status filters for pending, preparing, ready, cancelled, and all
- task detail panel with order, table, item, modifiers, notes, and event context
- start, mark ready, and cancel actions with visible success/error feedback
- branch realtime invalidation for preparation task updates
- compact branch activity panel and metrics for task status counts

Waiter dashboard, owner/manager command center, SaaS admin/menu admin, POS/payment, backend behavior changes, drag/drop, and new dependencies remain outside this phase.

## UI Phase 6 status

UI Phase 6 adds the Waiter Dashboard and Attention Queue inside the Staff shell:

- `/staff/waiter` live floor operations screen for selected branch
- waiter call queue with status and type filters
- waiter call detail panel with table, session, order, message, and timeline context
- acknowledge, resolve with optional note, and cancel with optional reason actions
- table attention queue with active/default, status, and priority filters
- attention detail panel with score, reasons, recommended actions, metadata, and session context
- resolve, mute for 15/30/60 minutes, recalculate, and branch rebuild attention actions
- branch SSE realtime invalidation for waiter calls, table attention, and activity
- staff overview updated so cashier, kitchen, and waiter surfaces are live

Owner/manager command center, SaaS admin/menu admin, POS/payment, backend behavior changes, floorplan drag/drop, and new dependencies remain outside this phase.

## UI Phase 7 status

UI Phase 7 adds the Owner / Manager Command Center inside the Staff shell:

- `/staff/owner` live manager dashboard for selected branch
- executive pulse metrics for active orders, submitted orders, preparation, ready orders, waiter calls, bill requests, urgent attention, and visible order value
- client-side aggregation over existing cashier, bill, preparation, waiter-call, attention, realtime, menu, and experience endpoints
- branch health state derived as calm, busy, needs manager attention, or critical
- operations snapshot cards linking to cashier, kitchen, waiter, and bill lanes
- attention and service recovery summary for top table risks
- recent branch realtime activity stream
- menu and experience readiness panel with read-only setup pulse
- staff overview updated so cashier, kitchen, waiter, and owner surfaces are live

SaaS admin/menu admin, company/tenant admin, staff role management, POS/payment, backend behavior changes, chart libraries, fake revenue, and new dependencies remain outside this phase.

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

List the admin menu overview:

```bash
curl http://localhost:3000/api/v1/companies/<companyId>/menu-admin/overview
```

Create a menu category:

```bash
curl -X POST http://localhost:3000/api/v1/companies/<companyId>/menu-admin/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Coffee","slug":"coffee","description":"Coffee drinks","sortOrder":10,"status":"active"}'
```

Create a menu item:

```bash
curl -X POST http://localhost:3000/api/v1/companies/<companyId>/menu-admin/items \
  -H "Content-Type: application/json" \
  -d '{
    "categoryId": "<categoryId>",
    "name": "Spanish Latte",
    "slug": "spanish-latte",
    "description": "Sweet milk coffee",
    "imageUrl": "https://example.com/spanish-latte.jpg",
    "basePriceMinor": 8500,
    "currency": "EGP",
    "station": "barista",
    "status": "active",
    "isFeatured": true,
    "sortOrder": 10
  }'
```

Update item price or status:

```bash
curl -X PATCH http://localhost:3000/api/v1/menu-admin/items/<itemId> \
  -H "Content-Type: application/json" \
  -d '{"basePriceMinor":9000,"status":"inactive"}'
```

Create a modifier group and option:

```bash
curl -X POST http://localhost:3000/api/v1/companies/<companyId>/menu-admin/modifier-groups \
  -H "Content-Type: application/json" \
  -d '{"name":"Milk Type","slug":"milk-type","selectionType":"single","isRequired":true,"minSelections":1,"maxSelections":1,"sortOrder":10,"status":"active"}'

curl -X POST http://localhost:3000/api/v1/menu-admin/modifier-groups/<groupId>/options \
  -H "Content-Type: application/json" \
  -d '{"name":"Oat Milk","slug":"oat-milk","priceDeltaMinor":1500,"status":"active","sortOrder":10}'
```

Attach a modifier group to an item:

```bash
curl -X POST http://localhost:3000/api/v1/menu-admin/items/<itemId>/modifier-groups \
  -H "Content-Type: application/json" \
  -d '{"modifierGroupId":"<groupId>","sortOrder":10}'
```

Set a branch availability override:

```bash
curl -X PUT http://localhost:3000/api/v1/branches/<branchId>/menu-admin/items/<itemId>/override \
  -H "Content-Type: application/json" \
  -d '{"priceOverrideMinor":9000,"isAvailable":true,"isVisible":true,"sortOrder":10}'
```

Deactivate a menu item:

```bash
curl -X POST http://localhost:3000/api/v1/menu-admin/items/<itemId>/deactivate
```

Create a media asset:

```bash
curl -X POST http://localhost:3000/api/v1/companies/<companyId>/media-assets \
  -H "Content-Type: application/json" \
  -d '{
    "type": "image",
    "provider": "external_url",
    "publicUrl": "https://example.com/spanish-latte.jpg",
    "mimeType": "image/jpeg",
    "width": 1200,
    "height": 800,
    "title": "Spanish Latte hero",
    "altText": "Spanish latte on a dark table",
    "dominantColor": "#2A1711"
  }'
```

Attach a media asset to a menu item cover:

```bash
curl -X POST http://localhost:3000/api/v1/media-assets/<mediaAssetId>/usages \
  -H "Content-Type: application/json" \
  -d '{"target":"menu_item","targetId":"<itemId>","role":"cover","sortOrder":10}'
```

Create a branch experience profile:

```bash
curl -X POST http://localhost:3000/api/v1/branches/<branchId>/experience/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "key": "warm-dark",
    "name": "Warm Dark Café",
    "status": "active",
    "isDefault": true,
    "language": "ar-EG",
    "theme": { "name": "warm-dark" },
    "designTokens": {
      "colors": {
        "background": "#120D0A",
        "surface": "#1D1510",
        "primary": "#C68A4A",
        "accent": "#7A2E2E",
        "text": "#FFF7EA",
        "mutedText": "#B7A99A"
      }
    }
  }'
```

Get the effective branch experience:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/experience/effective
```

Create a content block:

```bash
curl -X POST http://localhost:3000/api/v1/branches/<branchId>/content-blocks \
  -H "Content-Type: application/json" \
  -d '{"placement":"customer_welcome","key":"welcome-copy","title":"أهلاً بيك","body":"خد نفس فوق.","sortOrder":10}'
```

Create and update a notification template:

```bash
curl -X POST http://localhost:3000/api/v1/branches/<branchId>/notification-templates \
  -H "Content-Type: application/json" \
  -d '{"key":"welcome-main","kind":"welcome","channel":"in_app","title":"أهلاً بيك","body":"نورت بلكونة."}'

curl -X PATCH http://localhost:3000/api/v1/notification-templates/<templateId> \
  -H "Content-Type: application/json" \
  -d '{"title":"أهلاً بيك في بلكونة","isActive":true}'
```

Create a venue zone:

```bash
curl -X POST http://localhost:3000/api/v1/branches/<branchId>/venue-zones \
  -H "Content-Type: application/json" \
  -d '{"name":"Fusion Photo Zone","slug":"fusion-photo-zone","type":"custom","description":"Central visual transition area","metadata":{"mood":"photo","experienceRole":"hero_zone"}}'
```

Apply the Balkona experience pack:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/experience-packs/balkona/preview

curl -X POST http://localhost:3000/api/v1/branches/<branchId>/experience-packs/balkona/apply
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

Start an AI waiter session and exchange messages. The AI waiter creates proposals only; applying a proposal reuses backend cart validation and pricing:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/ai-waiter/start \
  -H "Content-Type: application/json" \
  -d '{"language":"ar-EG"}'

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/ai-waiter/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"عايز حاجة ساقعة ومش مسكرة قوي","language":"ar-EG"}'

curl http://localhost:3000/api/v1/table-sessions/<sessionId>/ai-waiter/messages
```

Apply or reject an AI waiter cart proposal:

```bash
curl -X POST http://localhost:3000/api/v1/ai-waiter/cart-proposals/<proposalId>/apply

curl -X POST http://localhost:3000/api/v1/ai-waiter/cart-proposals/<proposalId>/reject \
  -H "Content-Type: application/json" \
  -d '{"reason":"مش ده اللي عايزه"}'
```

Escalate AI waiter help to a human waiter and inspect staff-facing sessions:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/ai-waiter/escalate \
  -H "Content-Type: application/json" \
  -d '{"reason":"customer_requested_human","message":"عايز أكلم ويتر"}'

curl http://localhost:3000/api/v1/branches/<branchId>/ai-waiter/sessions
curl http://localhost:3000/api/v1/ai-waiter/sessions/<aiWaiterSessionId>
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

Serve or complete an order. Orders with preparation tasks can only be served after every non-cancelled task is ready:

```bash
curl -X POST http://localhost:3000/api/v1/orders/<orderId>/serve \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","note":"Served to table"}'

curl -X POST http://localhost:3000/api/v1/orders/<orderId>/complete \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","note":"Completed operationally"}'
```

List preparation tasks for an order:

```bash
curl http://localhost:3000/api/v1/orders/<orderId>/preparation-tasks
```

List orders for a table session:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/orders
```

Request and inspect the operational bill state for a table session:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/bill/request \
  -H "Content-Type: application/json" \
  -d '{"note":"عايز الحساب"}'

curl http://localhost:3000/api/v1/table-sessions/<sessionId>/bill
```

List active branch bill requests and manage a bill request lifecycle:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/bill-requests
curl http://localhost:3000/api/v1/branches/<branchId>/bill-requests?status=active

curl http://localhost:3000/api/v1/bill-requests/<billRequestId>

curl -X POST http://localhost:3000/api/v1/bill-requests/<billRequestId>/acknowledge \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/bill-requests/<billRequestId>/present \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/bill-requests/<billRequestId>/close \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","note":"Closed operationally"}'

curl -X POST http://localhost:3000/api/v1/bill-requests/<billRequestId>/cancel \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","reason":"Customer changed mind"}'
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

Check if staff can serve orders or manage bill requests:

```bash
curl "http://localhost:3000/api/v1/staff/<waiterStaffUserId>/can?permission=orders.serve&branchId=<branchId>"
curl "http://localhost:3000/api/v1/staff/<waiterStaffUserId>/can?permission=bills.request&branchId=<branchId>"
curl "http://localhost:3000/api/v1/staff/<cashierStaffUserId>/can?permission=bills.close&branchId=<branchId>"
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

Read and update branch operating settings:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/operating-settings

curl -X PUT http://localhost:3000/api/v1/branches/<branchId>/operating-settings \
  -H "Content-Type: application/json" \
  -d '{"operatingMode":"assisted","serviceMode":"dine_in","tableAttentionEnabled":true,"analyticsEnabled":true}'
```

Read and update branch feature flags:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/feature-flags

curl -X PUT http://localhost:3000/api/v1/branches/<branchId>/feature-flags/table_attention \
  -H "Content-Type: application/json" \
  -d '{"enabled":true,"config":{"source":"local-demo"}}'
```

Inspect and manage table attention:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/autopilot/attention
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/autopilot/attention

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/autopilot/attention/recalculate \
  -H "Content-Type: application/json" \
  -d '{"source":"manual_check"}'

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/autopilot/attention/resolve \
  -H "Content-Type: application/json" \
  -d '{"staffUserId":"<optionalStaffUserId>","note":"Handled"}'

curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/autopilot/attention/mute \
  -H "Content-Type: application/json" \
  -d '{"minutes":30,"staffUserId":"<optionalStaffUserId>"}'

curl -X POST http://localhost:3000/api/v1/branches/<branchId>/autopilot/attention/rebuild
```

Read analytics and audit history:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/analytics/overview
curl http://localhost:3000/api/v1/branches/<branchId>/analytics/menu
curl http://localhost:3000/api/v1/branches/<branchId>/analytics/staff-actions
curl http://localhost:3000/api/v1/companies/<companyId>/analytics/overview

curl http://localhost:3000/api/v1/branches/<branchId>/audit-logs
curl http://localhost:3000/api/v1/companies/<companyId>/audit-logs
```

Staff auth local/dev bootstrap and login:

```bash
curl -X POST http://localhost:3000/api/v1/staff-auth/dev/bootstrap-password \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@balcona.local","password":"change-me-local-123"}'

curl -X POST http://localhost:3000/api/v1/staff-auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@balcona.local","password":"change-me-local-123","branchId":"<optionalBranchId>"}'

curl http://localhost:3000/api/v1/staff-auth/me \
  -H "Authorization: Bearer <accessToken>"

curl -X POST http://localhost:3000/api/v1/staff-auth/logout \
  -H "Authorization: Bearer <accessToken>"
```

Frontend staff demo:

```text
http://localhost:3001/staff/login
http://localhost:3001/staff
http://localhost:3001/staff/cashier
http://localhost:3001/staff/kitchen
http://localhost:3001/staff/waiter
http://localhost:3001/staff/owner
```

Use the same local/dev account after password bootstrap:

```text
manager@balcona.local
change-me-local-123
```

After login, select the default branch if needed. Submit an order from the
customer PWA, then accept or reject it from the cashier dashboard.

Kitchen/barista flow:

```text
1. Open /customer and submit an order.
2. Open /staff/cashier and accept the submitted order.
3. Open /staff/kitchen.
4. Start a pending preparation task.
5. Mark the task ready.
```

Waiter/floor flow:

```text
1. Open /customer and create a service call or request the bill.
2. Open /staff/waiter.
3. Acknowledge the waiter call.
4. Resolve the waiter call after speaking with the table.
5. Review attention signals created by waiter calls, bill requests, ready orders not served, preparation delays, or AI escalations.
6. Resolve, mute, or recalculate table attention from the detail panel.
```

Owner/manager flow:

```text
1. Open /customer and submit an order.
2. Open /staff/cashier and accept the submitted order.
3. Open /staff/kitchen and move a preparation task toward ready.
4. Open /staff/waiter and resolve any service call or attention item.
5. Open /staff/owner.
6. Review the branch pulse, health/risk summary, lane snapshots, attention risks, realtime activity, and menu/experience readiness.
```

Table-session start/resume responses now include a `customerAccess` object with a one-time returned customer access token. Current customer endpoints remain backwards-compatible; the token foundation is ready for the future PWA ownership guard rollout.

Swagger/OpenAPI is available by default in local/dev:

```bash
curl http://localhost:3000/api/openapi.json
```

Open browser docs at `http://localhost:3000/api/docs`. Future UI clients can generate typed API bindings from the OpenAPI JSON.

Inspect BullMQ/Redis job queue health with a staff bearer token that has `system.jobs.read`:

```bash
curl http://localhost:3000/api/v1/system/jobs/health \
  -H "Authorization: Bearer <accessToken>"

curl http://localhost:3000/api/v1/system/jobs/queues \
  -H "Authorization: Bearer <accessToken>"
```

Security and scaling environment variables:

```bash
STAFF_AUTH_SESSION_HOURS=12
STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=false
CUSTOMER_ACCESS_TOKEN_HOURS=24
SWAGGER_ENABLED=true
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
JOBS_ENABLED=true
```

Backend core is now ready for UI Phase 1 planning. Remaining production work includes complete staff-auth enforcement on all staff-only routes, customer token guards across PWA mutation/read endpoints, production rate limiting, external notification delivery, deployment-specific CORS, and real payment/POS/storage/AI integrations when their phases begin.

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
- Phase 14 order completion and bill flow foundation: `docs/architecture/phase-14-order-completion-bill-flow-foundation.md`
- Phase 15 menu admin backend: `docs/architecture/phase-15-menu-admin-backend.md`
- Phase 16-17 media, experience, content, and Balkona pack: `docs/architecture/phase-16-17-media-experience-content-balkona-pack.md`
- Phase 18 AI waiter backend foundation: `docs/architecture/phase-18-ai-waiter-backend-foundation.md`
- Phases 19, 20, and 22 cafe autopilot brain: `docs/architecture/phase-19-20-22-cafe-autopilot-brain.md`
- Phases 21, 23, and 24 security, scaling, and hardening: `docs/architecture/phase-21-23-24-security-scaling-hardening.md`
- Backend core complete checklist: `docs/architecture/backend-core-complete-checklist.md`
- UI Phase 1 web foundation: `docs/architecture/ui-phase-1-web-foundation.md`
- UI Phase 2 customer PWA core: `docs/architecture/ui-phase-2-customer-pwa-core.md`
- UI Phase 3 AI waiter customer experience: `docs/architecture/ui-phase-3-ai-waiter-customer-experience.md`
- UI Phase 4 cashier dashboard core: `docs/architecture/ui-phase-4-cashier-dashboard-core.md`
- UI Phase 5 kitchen/barista dashboard core: `docs/architecture/ui-phase-5-kitchen-barista-dashboard-core.md`
- UI Phase 6 waiter dashboard and attention queue: `docs/architecture/ui-phase-6-waiter-dashboard-attention-queue.md`
- UI Phase 7 owner/manager command center: `docs/architecture/ui-phase-7-owner-manager-command-center.md`
