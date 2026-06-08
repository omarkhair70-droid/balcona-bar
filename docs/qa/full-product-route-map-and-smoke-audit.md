# PR QA-1 - Full Product Route Map and Smoke Audit

## Purpose

This audit explains what exists in the Balcona Bar web app and API before PR
CX-1. It is a product QA and route inventory artifact, not a feature spec. The
current product is a pre-user Cafe OS with customer, staff, cashier, kitchen,
waiter, owner, platform, and demo areas.

PR #65, "Add context-aware AI waiter safe tools", is merged into `main`, so
AI-1 is included in this route map and smoke scope.

## Role Map

| Area | Intended user | Plain-language meaning |
| --- | --- | --- |
| Customer | Cafe guest at a table | A guest opens a QR/table link, starts or resumes a table session, browses menu, uses AI waiter, manages cart, follows status, asks for service, and requests bill when eligible. |
| Staff | Authenticated cafe staff member | Shared staff shell and overview for people working inside a tenant cafe workspace. |
| Cashier | Cashier or manager | Accepts/rejects submitted orders, manages bill requests, creates/presents bills, records payments, and handles cashier shifts. |
| Kitchen / Barista | Kitchen, barista, prep station staff | Works preparation tasks, station tickets, and print queues after orders are accepted. |
| Waiter | Floor staff / service team | Handles service calls, bill/service attention, ready orders, and table attention. |
| Owner | Cafe owner, manager, branch manager | Reads branch pulse, analytics, operations, readiness, and business health. |
| Platform | Balcona platform/admin operator | Manages SaaS tenants, plans, subscriptions, cafe bootstrap, and platform-only diagnostics. This is not cafe staff auth. |
| Demo | QA/client presentation operator | Launcher and shortcut area for testing and presenting existing flows. It is not the normal daily product surface. |
| Public | Anyone with the web URL | Root marketing/product-shell entry and unauthenticated login/entry pages. |

## Route Inventory

Status values:

- `working`: verified by code and/or live staging route smoke.
- `needs manual smoke`: route loads or is coded, but the end-to-end workflow needs credentials, seeded state, or mutations.
- `likely broken`: current evidence contradicts intended behavior.
- `unknown`: code exists but no strong current-state evidence yet.

| Route/path | Area | Intended user | Purpose | Entry point | Required auth/session/token | Main dependencies | Current status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` | public | Anyone evaluating the app | Product shell landing page with links to demo, customer, and staff surfaces. | Direct web root. | None. | Static Next page and shared UI primitives. | working | Live staging loaded with links to `/demo/balkona`, `/customer`, and `/staff`. Copy still reads as a product shell, not the full app map. |
| `/demo/balkona` | demo | QA/demo presenter | Guided launcher for seeded QR, staff routes, demo checklist, proof points, and API base diagnostics. | Root link or direct demo URL. | None. | `features/demo/balkona-demo.ts`, web env, static route links. | working | Live staging loaded. It exposes local/dev credentials as local-only guidance. |
| `/customer` | customer | Cafe guest or demo operator | Enter a QR token or resume stored session. | Root link, demo launcher, or direct customer route. | None until a table token is opened. | Customer shell, local storage session store, QR token routing. | working | Live staging loaded with token entry, Continue, Reset, and demo launcher link. |
| `/customer/table/[qrToken]` | customer | Cafe guest scanning a table QR | Resolve table QR token and start/resume a table session. | Physical QR, demo launcher, QR admin preview, or `/customer` token entry. | QR token. | `GET /tables/resolve/:qrToken`, `POST /table-sessions/start`, customer session store. | working | Live staging QR `balcona-main-t01` resolved after a longer retry and redirected to `/customer/session/<sessionId>`. Initial load stayed on "Starting session" for the short pass, so this remains a staging watch item. |
| `/customer/session/[sessionId]` | customer | Cafe guest at an active table | Table home and navigation into menu, AI waiter, cart, status, and service. | QR start route redirect or stored session resume. | Customer table session id/access context. | `GET /table-sessions/:sessionId`, `GET /table-sessions/:sessionId/cart`, `GET /table-sessions/:sessionId/customer-status`, SSE refresh hooks. | working | Live staging session home loaded and showed table state plus bottom nav. |
| `/customer/session/[sessionId]/menu` | customer | Cafe guest choosing items | Browse branch menu, inspect item details/modifiers, add items to cart. | Table home, bottom nav, AI waiter. | Customer table session id/access context. | `GET /branches/:branchId/menu`, `POST /table-sessions/:sessionId/cart/items`, cart query invalidation, menu availability. | working | Live staging menu loaded seeded menu after a longer wait. Add-to-cart was not executed during staging smoke to avoid mutating data. |
| `/customer/session/[sessionId]/ai-waiter` | customer | Cafe guest asking for help | Start/resume AI waiter, send prompts, render safe action results and cart proposals. | Table home, menu help card, bottom nav. | Customer table session id/access context. | AI waiter endpoints, branch menu, cart, AI-1 safe tool executor. | needs manual smoke | Live staging page loaded prompts and AI shell. Message sending, proposal apply/reject, bill request, and explicit call_waiter tool execution need authenticated/staged flow smoke. |
| `/customer/session/[sessionId]/cart` | customer | Cafe guest reviewing order | Validate totals, edit/clear cart, and submit final order manually. | Table home, menu, AI waiter proposal card, bottom nav. | Customer table session id/access context and draft cart. | Cart endpoints, order submit endpoint, idempotency key. | needs manual smoke | Live staging showed an existing draft cart and Submit order button. Order submission was not clicked during staging smoke. |
| `/customer/session/[sessionId]/status` | customer | Cafe guest tracking service | Show customer-facing order status and timeline events. | Table home, bottom nav. | Customer table session id/access context. | Session orders, customer status, customer timeline, realtime events. | working | Live staging loaded empty/no-orders state. Full order timeline needs order lifecycle smoke. |
| `/customer/session/[sessionId]/service` | customer | Cafe guest needing staff | Call waiter, request water/help, see active calls, request bill when eligible. | Table home, bottom nav, AI waiter escalation. | Customer table session id/access context. | Waiter calls, bill request state, optional online payment intent. | needs manual smoke | Live staging loaded service actions and no-billable-order state. Buttons were not clicked during staging smoke. |
| `/staff/login` | staff | Cafe staff member | Staff authentication form. | Staff route guards, demo launcher, direct route. | Staff email/password; optional branch id. | `POST /staff-auth/login`, staff auth store. | working | Live staging login form loaded. No staging credentials were used. |
| `/staff/invite/[token]` | staff | Invited staff user | Accept staff invite and set first password. | Platform company detail invite link or onboarding invite. | Invite token. | Staff invite check/accept endpoints. | needs manual smoke | Requires a fresh invite token. |
| `/staff` | staff | Authenticated cafe staff | Staff overview/operations hub with role-aware links. | Root staff link, staff login redirect. | Staff access token. | `GET /staff-auth/me`, staff access/permissions. | working | Live staging unauthenticated guard loaded "Staff session is not active". Authenticated hub still needs credentials. |
| `/staff/cashier` | cashier | Cashier/manager | Incoming order queue, order detail, accept/reject, bill requests, bills, shifts, payments. | Staff overview, demo launcher. | Staff token with branch cashier permissions. | Orders, bills, bill requests, cashier shifts, online payments, realtime events. | needs manual smoke | Live staging unauthenticated guard loaded. Full customer-to-cashier order cycle was not run. |
| `/staff/kitchen` | kitchen | Kitchen/barista staff | Preparation task board, station filters, kitchen tickets, print queue. | Staff overview, demo launcher. | Staff token with preparation/kitchen permissions. | Preparation tasks, kitchen tickets, print jobs, realtime events. | needs manual smoke | Live staging unauthenticated guard loaded. Task state changes need order data and credentials. |
| `/staff/waiter` | waiter | Floor/service staff | Waiter call queue, table attention, ready orders, service/bill attention. | Staff overview, demo launcher. | Staff token with waiter permissions. | Waiter calls, table attention, ready orders, preparation/order detail endpoints. | needs manual smoke | Live staging unauthenticated guard loaded. Call acknowledge/resolve and ready-order serving need credentials. |
| `/staff/owner` | owner | Cafe owner/manager | Owner command center with branch pulse, analytics, operations, activity, readiness. | Staff overview, demo launcher. | Staff token with owner/manager access. | Owner analytics, orders, bills, preparation, waiter calls, attention, menu, experience. | needs manual smoke | Live staging unauthenticated guard loaded. Data correctness needs authenticated branch smoke. |
| `/staff/menu` | staff/menu admin | Owner, manager, menu admin | Branch menu admin: categories, items, modifiers, branch overrides, availability. | Staff overview, setup, demo launcher. | Staff token with menu permissions. | Menu admin endpoints, branch menu, customer menu invalidation. | needs manual smoke | Live staging unauthenticated guard loaded. CRUD paths need credentials. |
| `/staff/branches` | owner/setup staff | Owner, manager, setup/admin staff | Branch/table admin, floor/table setup, QR token generation/regeneration, printable QR cards. | Staff setup, demo launcher. | Staff token with settings/manage permissions. | Branch admin endpoints, QR token endpoints, table preview URLs. | needs manual smoke | Live staging unauthenticated guard loaded. QR scan/regenerate needs authenticated smoke and a non-demo table. |
| `/staff/inventory` | staff/inventory | Owner, manager, inventory/menu staff | Inventory items, stock levels, alerts, adjustments, suppliers, purchase orders, receiving, requirements, availability, movements. | Staff overview/setup/billing. | Staff token with inventory read/manage permissions. | Inventory, suppliers, purchase orders, menu admin overview, branch menu. | needs manual smoke | QA-1 includes a small fix so unauthenticated users see the normal staff login gate before branch selection. Full inventory workflow still needs credentials. |
| `/staff/billing` | owner/manager | Owner, branch manager, platform-aware tenant admin | Tenant plan/status and SaaS limits for the selected branch. | Staff overview/setup/owner. | Staff token with SaaS read permission. | SaaS status/plans endpoints. | needs manual smoke | Live staging unauthenticated guard loaded. |
| `/staff/setup` | owner/setup staff | Owner, branch manager | Tenant onboarding, branch readiness, floor/table creation, staff invites, launch checklist. | Platform handoff links, staff overview. | Staff token with tenant onboarding permissions. | Tenant onboarding, readiness, branch tables, staff invite endpoints. | needs manual smoke | Live staging unauthenticated guard loaded. Invite creation and readiness need credentials. |
| `/platform/login` | platform | Balcona platform admin | Platform-only admin login. | Direct platform URL or platform guard. | Platform admin email/password. | `POST /platform-auth/login`, platform auth store. | working | Live staging login form loaded. No platform credentials were used. |
| `/platform` | platform | Balcona platform admin | Companies/tenant dashboard. | Platform login redirect, direct route. | Platform session token. | Platform companies endpoint. | needs manual smoke | Live staging unauthenticated guard loaded. Authenticated company list needs platform credentials. |
| `/platform/companies` | platform | Balcona platform admin | Alias/dashboard route for company list. | Platform nav. | Platform session token. | Platform companies endpoint. | needs manual smoke | Live staging unauthenticated guard loaded. |
| `/platform/companies/new` | platform | Balcona platform admin | Bootstrap a new cafe workspace, first branch, owner user, plan, starter tables and QR examples. | Platform dashboard "Add Cafe". | Platform session token. | Platform plans, company bootstrap transaction, SaaS limit checks. | needs manual smoke | Requires platform admin credentials. Previous phase smoke passed, but QA-1 did not create a new staging cafe. |
| `/platform/companies/[companyId]` | platform | Balcona platform admin | Company detail, subscription controls, staff invite creation, setup/staff/customer handoff links. | Platform company list or bootstrap result. | Platform session token and company id. | Platform company detail, plans, subscription mutation, platform staff invites. | needs manual smoke | Requires platform session and real company id. |
| `/platform/status` | platform | Balcona platform admin/support | Staging diagnostics surface for API base, env safety, and system info. | Platform nav/status link. | Platform session token for page body; public health links are visible in code. | Web env, `/health`, `/api/v1/system/info`. | needs manual smoke | Live staging unauthenticated guard loaded. Direct API checks passed: Railway health ok and system info returned `appEnvironment=staging`, `nodeEnvironment=production`. |

## Product Flow Map

### Customer Order Flow

```text
QR/demo table link
-> customer table session
-> table home
-> AI waiter or menu
-> cart
-> submit order
-> cashier accepts
-> kitchen/barista prepares
-> waiter serves
-> customer checks status
-> customer requests bill
-> cashier/waiter handles bill
```

### AI Waiter Flow

```text
customer session
-> start AI session
-> ask recommendation
-> AI proposal
-> customer applies proposal
-> cart validates
-> customer submits final order manually
-> AI can read order status / request bill / call waiter if safe
```

AI-1 safety boundary: the AI can produce safe backend action results and cart
proposals, but final order submission remains a customer cart action. Explicit
call-waiter wording should create a real waiter call through the safe tool
executor; generic safety fallback remains human escalation only.

### Staff Operations Flow

```text
staff login/demo staff link
-> staff dashboard
-> cashier / kitchen / waiter / owner depending on permissions
```

### Platform Flow

```text
platform admin
-> companies/tenants/plans/setup
-> not the same as cafe owner
```

### Demo Flow

```text
demo launcher
-> shortcuts to customer/staff/platform-like test surfaces
-> credentials/checklist if available
-> used for QA/client presentation
```

The demo route is a shortcut and checklist surface. It does not replace the
normal daily product start points: guests normally start at a QR token, staff at
`/staff/login`, and platform operators at `/platform/login`.

## Page-by-Page Smoke Checklist

### Customer

- [ ] Table home opens from `/customer/table/<qrToken>`.
- [ ] Menu opens.
- [ ] Menu item details and required modifiers open if present.
- [ ] Add item to cart.
- [ ] Cart review shows backend totals.
- [ ] Submit order.
- [ ] AI waiter starts.
- [ ] AI recommendation returns.
- [ ] AI proposal apply/reject works if a proposal is returned.
- [ ] Order status page shows submitted order and timeline.
- [ ] Service page opens.
- [ ] Call waiter works and duplicate active calls are handled.
- [ ] Request bill is unavailable before billable order and available when eligible.
- [ ] Bottom nav works between table, menu, cart, status, and service.
- [ ] Invalid/closed session guard returns readable recovery path.

### Cashier

- [ ] Staff login works for cashier/manager.
- [ ] Incoming orders load.
- [ ] Accept order.
- [ ] Reject order if supported by current order state.
- [ ] View bill requests.
- [ ] Create/present/close bill where supported.
- [ ] Open cashier shift before recording payments.
- [ ] Manual/mock online payment states remain readable.

### Kitchen / Barista

- [ ] Staff login works for kitchen/barista role.
- [ ] Tickets/tasks load.
- [ ] Move task pending -> preparing.
- [ ] Move task preparing -> ready.
- [ ] Reprint or print-queue actions work where supported.
- [ ] Realtime/poll refresh shows newly accepted orders.

### Waiter

- [ ] Staff login works for waiter role.
- [ ] Active waiter calls load.
- [ ] Acknowledge waiter call.
- [ ] Resolve waiter call.
- [ ] Bill/service attention appears when relevant.
- [ ] Ready orders appear when order is ready to serve.
- [ ] Serve ready order when role allows.

### Owner

- [ ] Owner overview loads after staff login.
- [ ] Analytics cards load from real branch endpoints.
- [ ] Branch/menu/inventory/setup shortcuts work if present.
- [ ] Empty states do not present fake revenue as real data.
- [ ] Daily/report range controls do not crash.

### Platform

- [ ] `/platform/login` loads.
- [ ] Platform admin login works.
- [ ] `/platform/status` shows web API base URL and safe API metadata.
- [ ] `/platform/companies` loads company list.
- [ ] `/platform/companies/new` loads SaaS plans.
- [ ] Cafe bootstrap creates company, branch, subscription, owner staff user, starter tables, and QR examples.
- [ ] Company detail loads plan/status/staff invite areas.
- [ ] Platform surfaces remain clearly internal/admin only.

### Demo

- [x] `/demo/balkona` opens on staging.
- [x] Customer shortcut opens the seeded QR route.
- [x] Staff shortcut opens `/staff/login`.
- [x] Documented demo credentials are local/dev only.
- [x] Demo is identified as a presentation/QA launcher, not the normal daily app.

## API Surface Summary

The web app currently depends on these API groups:

- Public/staging: `/health`, `/api/v1/system/info`, `/companies`, `/companies/:slug/branches`.
- Customer QR/session: `/tables/resolve/:qrToken`, `/table-sessions/start`, `/table-sessions/:sessionId`, `/table-sessions/:sessionId/view`, `/table-sessions/:sessionId/close`.
- Customer menu/cart/order: `/branches/:branchId/menu`, `/menu/items/:itemId`, `/table-sessions/:sessionId/cart`, cart item mutation endpoints, `/table-sessions/:sessionId/cart/submit`.
- Customer AI: `/table-sessions/:sessionId/ai-waiter/*`, `/ai-waiter/cart-proposals/:proposalId/apply`, `/ai-waiter/cart-proposals/:proposalId/reject`.
- Customer status/service: `/table-sessions/:sessionId/orders`, `/table-sessions/:sessionId/customer-status`, `/table-sessions/:sessionId/customer-timeline`, waiter call endpoints, bill request endpoints.
- Staff auth/access: `/staff-auth/login`, `/staff-auth/me`, `/staff-auth/logout`, `/staff-auth/invites/:token`, `/staff/me`, staff permission endpoints.
- Cashier/billing: cashier order endpoints, bill request endpoints, bill endpoints, online payment mock/provider endpoints, cashier shift endpoints.
- Kitchen/barista: preparation tasks, kitchen tickets, print jobs, printer stations.
- Waiter/attention: waiter calls, ready orders, table attention/autopilot endpoints.
- Owner: `/branches/:branchId/owner-analytics/*`, owner dashboard/report endpoints, branch operational read endpoints.
- Menu/branch setup: menu admin endpoints, branch admin/table QR endpoints, tenant onboarding endpoints.
- Inventory: inventory items, stock levels, alerts, suppliers, purchase orders, receipts, requirements, menu availability.
- Platform/SaaS: platform auth, platform companies/bootstrap/invites/subscription, SaaS plans/status.

## Live Staging Smoke Evidence

Target web: `https://balcona-bar-staging-web.vercel.app/`

Detected API base from the live web demo diagnostics:
`https://balcona-barapi-production.up.railway.app/api/v1`

Direct API checks run on 2026-06-08:

- `GET https://balcona-barapi-production.up.railway.app/health` returned
  `{"status":"ok"}`.
- `GET https://balcona-barapi-production.up.railway.app/api/v1/system/info`
  returned `environment=staging`, `appEnvironment=staging`,
  `nodeEnvironment=production`, `apiPrefix=api/v1`.
- `GET https://balcona-barapi-production.up.railway.app/api/v1/companies`
  returned active company `Balcona Bar`.

Browser route smoke run on live staging:

- `/` loaded the product shell.
- `/demo/balkona` loaded the demo launcher.
- `/customer` loaded token entry/resume.
- `/customer/table/balcona-main-t01` resolved to a customer session after a
  longer wait.
- `/customer/session/<sessionId>` loaded table home.
- `/customer/session/<sessionId>/menu` loaded seeded menu items after a longer
  wait.
- `/customer/session/<sessionId>/ai-waiter` loaded AI waiter prompts and shell.
- `/customer/session/<sessionId>/cart` loaded an existing draft cart and submit controls.
- `/customer/session/<sessionId>/status` loaded no-orders/timeline state.
- `/customer/session/<sessionId>/service` loaded service actions and no-billable-order state.
- `/staff/login` loaded staff login.
- `/staff`, `/staff/cashier`, `/staff/kitchen`, `/staff/waiter`,
  `/staff/owner`, `/staff/menu`, `/staff/branches`, `/staff/billing`, and
  `/staff/setup` loaded unauthenticated staff guard states.
- `/platform/login` loaded platform login.
- `/platform`, `/platform/companies`, and `/platform/status` loaded
  unauthenticated platform guard states.

Not run during QA-1 browser smoke:

- Staff/platform login, because no staging credentials were entered in browser.
- Customer order submit, waiter-call click, bill-request click, AI message send,
  menu add-to-cart, QR regeneration, inventory changes, purchase order receiving,
  or payment mocks, because those mutate staging data.

## Validation Commands

Required validation for this PR:

```bash
pnpm install
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test -- --runInBand
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
git diff --check
```

Record final command results in the PR body. If a command cannot run, report
the exact environment reason.

## Local/Authenticated Smoke Checklist

Use this when local database/cache or staging credentials are available:

1. Start database/cache.
2. Run migrations and seed data if the environment is local or intentionally reset.
3. Start API.
4. Start web with `NEXT_PUBLIC_API_BASE_URL` pointing at the API.
5. Open `/demo/balkona`.
6. Open `/customer/table/balcona-main-t01`.
7. Add menu item to cart and submit order.
8. Log in to staff.
9. Open cashier and accept order.
10. Open kitchen/barista and start/ready preparation.
11. Open waiter and serve/resolve attention.
12. Open customer status and confirm timeline.
13. Request bill and handle bill through cashier/waiter.
14. Open owner dashboard and confirm analytics/readiness cards.
15. Open platform login/companies/status if platform credentials are available.

## Fixes Included In QA-1

- `/staff/inventory` now wraps the whole inventory content in `StaffAuthGate`
  before branch-empty state rendering. This makes unauthenticated inventory
  match the rest of the staff surface by showing the staff login-required guard
  instead of "Select a branch / No branch access".

## Known Issues

See `docs/qa/known-product-issues.md`.

## Recommended Next PR

PR CX-1 - AI-First Customer Table Experience Shell + Balcona Pack.
