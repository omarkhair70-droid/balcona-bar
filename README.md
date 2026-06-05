# balcona-bar

Balcona Bar is organized as a monorepo for the Cafe AI Waiter App / Smart Cafe Operating System. The backend core is complete through Phase 24, UI Phase 1 adds the first Next.js web foundation for customer and staff experiences, UI Phase 2 adds the customer PWA core, UI Phase 3 adds the customer AI waiter experience, UI Phase 4 adds the cashier dashboard core, UI Phase 5 adds the kitchen/barista dashboard core, UI Phase 6 adds the waiter dashboard and attention queue, UI Phase 7 adds the owner/manager command center, UI Phase 8 adds full demo hardening plus Balkona demo mode, Production Phase 1 adds deployable platform foundation files, Production Phase 2 adds AWS infrastructure foundation scaffolding without deploying resources, Production Phase 3A adds public demo deploy readiness plus CI/CD guardrails without deploying resources, Production Phase 3B adds the first public AWS demo preflight deploy pack without deploying resources, Product Phase 4A starts the full Cafe OS product completion track, Product Phase 4B adds branch-scoped menu admin and availability management, Product Phase 4C adds branch, tables, and QR management, Product Phase 4E.G0-G3 add a Groq AI waiter provider with safe backend validation, deep menu grounding, and modifier-turn ordering intelligence, Product Phase 4S.0 enforces staff roles, permissions, and branch access on the current staff product surfaces, Product Phase 4O.0 hardens order lifecycle transitions across cashier, preparation, waiter, and customer status flows, Product Phase 4K.0 adds KDS kitchen tickets plus a mock printer foundation for station operations, Product Phase 4P.0 adds stable bills, manual cashier payments, and receipt foundations, Product Phase 4C.0 adds cashier shifts, cash drawer transactions, and X/Z reports, Product Phase 4A.0 adds branch-scoped owner analytics and daily reports from real orders, bills, payments, shifts, operations, and AI waiter records, and Product Phase 4T.0 adds guarded tenant onboarding and company/branch setup readiness.

## Layout

- `apps/api` - NestJS backend application.
- `apps/api/prisma` - Prisma schema, migrations, and seed data.
- `apps/web` - Next.js App Router frontend foundation.
- `.github/workflows` - CI, Docker build, Terraform validation, and manual ECR example workflows.
- `docker-compose.yml` - local PostgreSQL and Redis services.
- `docker-compose.prod.example.yml` - production-style compose example for deployment smoke tests.
- `infra/aws/terraform` - AWS infrastructure foundation scaffold and staging tfvars examples.
- `scripts/deploy` - non-destructive local image build and public smoke test helpers.
- `docs/architecture` - architecture decisions and phase notes.
- `docs/demo` - local demo runbooks and smoke tests.
- `docs/deployment` - production deployment notes and checklists.
- `docs/product` - product audits, completion roadmap, and real-cafe readiness docs.

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
staff account documented below, then open `/staff/cashier`. Open a cashier
shift with an opening float before recording payments. Submit a customer
order from `/customer`, watch it appear in the cashier dashboard, and accept
or reject it from the detail panel.

13. Open the kitchen/barista demo:

```text
http://localhost:3001/staff/kitchen
```

After a customer submits an order and the cashier accepts it, the backend
creates preparation tasks, station kitchen tickets, and pending mock print
jobs for the seeded demo printer stations. Kitchen or barista staff can use
Tasks, Tickets, and Print Queue modes to move preparation forward and track
ticket/print state. When all active preparation tasks for an order are ready,
the backend moves the order to ready state.

14. Open the waiter dashboard demo:

```text
http://localhost:3001/staff/waiter
```

From `/customer`, create a service call or request the bill. Waiter staff
can open `/staff/waiter`, acknowledge the call, resolve it, serve ready
orders, and review table attention signals for waiter calls, bill requests,
ready orders not served, preparation delays, and AI waiter escalations.

15. Open the owner/manager command center:

```text
http://localhost:3001/staff/owner
```

The owner dashboard aggregates existing branch endpoints to show order,
preparation, waiter-call, bill, cashier shift, payment, item, and AI waiter
records through the branch-scoped owner analytics API. Use the Today, Last 7
days, and Last 30 days presets after completing a local order, bill, manual
payment, and Z report smoke flow.

16. Open the full Balkona demo launcher:

```text
http://localhost:3001/demo/balkona
```

The launcher collects the customer QR route, staff routes, local/dev
credentials, presentation checklist, proof points, API base URL diagnostics,
and command reminders in one presentation-ready screen.

Useful root scripts:

```bash
pnpm api:build
pnpm api:start:prod
pnpm api:prisma:migrate:deploy
pnpm docker:build:api
pnpm docker:build:web
pnpm smoke:public:ps
pnpm web:build
pnpm web:lint
pnpm web:start
pnpm web:typecheck
```

## Product Phase 4A.0 status

Product Phase 4A.0 adds production-grade branch owner analytics and reports:

- branch-scoped `/owner-analytics/*` API endpoints guarded by `owner_analytics.read`;
- summary, sales, orders, items, operations, cashier shift, AI waiter,
  dashboard, and daily report responses;
- recorded manual payments as the source of truth for collected revenue;
- paid bill line snapshots for top items, category breakdowns, and modifier
  revenue;
- order lifecycle timing averages that skip missing timestamps;
- cashier shift, drawer movement, and latest Z report summaries;
- `/staff/owner` upgraded to a real owner analytics dashboard with safe empty
  states and readable errors.

Local demo steps: open a cashier shift, submit and accept a customer order,
mark preparation ready, serve the order, request and present the bill, record a
manual payment, close the shift with a Z report, then open `/staff/owner` and
select Today.

See
`docs/architecture/product-phase-4a0-owner-analytics-reports.md` for metric
definitions, date range behavior, limitations, and future reporting scope.

## Product Phase 4T.0 status

Product Phase 4T.0 adds the first guarded tenant onboarding and company setup
foundation:

- `tenant_onboarding.read` and `tenant_onboarding.manage` permissions for owner
  and branch manager setup access;
- branch manager `staff.manage` coverage for branch staff setup;
- `/companies/:companyId/onboarding` and `/branches/:branchId/onboarding`
  readiness APIs;
- branch profile, floor creation, bulk table/QR creation, branch staff invite,
  and computed launch checklist endpoints;
- `/staff/setup` for company/branch setup, tables, QR preview, role coverage,
  menu readiness, operations readiness, and launch blockers;
- readiness computed from existing production records instead of fake checklist
  state;
- no SaaS signup, billing, inventory, payment gateway, Wi-Fi, GPS, or offline
  workflow in this phase.

Existing local dev, Balkona seed/demo data, customer QR routes, and staff
operational surfaces remain intact. See
`docs/architecture/product-phase-4t0-tenant-onboarding-company-setup.md` for the
endpoint contract, permission model, non-goals, and smoke path.

## Product Phase 4P.0 status

Product Phase 4P.0 adds the first bill settlement core while keeping payment
manual and cashier-controlled:

- customer bill requests create a stable linked bill snapshot;
- bill lines copy order item snapshots instead of recalculating menu prices;
- cashiers can record exact manual payments by cash, card POS, wallet manual,
  or other method;
- paid bills generate receipt payloads and printable text;
- customer service screens show active bill lines and receipt state;
- cashier bill request cards show bill lines, totals, payment controls, and
  receipt state;
- `bills.pay` is branch-scoped and required for manual payment actions;
- AI waiter safety continues to reject payment confirmation, refunds,
  discounts, and final order submission.

Not included in this phase: online payments, webhooks, split bills, refunds,
tax/e-invoicing, POS sync, cash drawer, inventory, or tenant onboarding.

See
`docs/architecture/product-phase-4p0-bill-manual-payment-receipt-core.md` for
data model, flow, safety behavior, and limitations.

Validation commands for this phase:

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```

## Product Phase 4C.0 status

Product Phase 4C.0 adds cashier shift and drawer operations on top of the
manual payment foundation:

- one open cashier shift per branch for this phase;
- opening shifts records opening cash float and an opening drawer transaction;
- new manual payments require an open cashier shift;
- cash payments increase expected drawer cash;
- card POS, wallet manual, and other payments count in tender totals without
  increasing drawer cash;
- X reports are persisted interim reports for open shifts;
- Z close stores an immutable final snapshot with counted cash and over/short;
- `/staff/cashier` now shows shift state, cash in/out, X report, close shift,
  and payment blocking copy when no shift is open.

Local demo sequence:

```text
1. Open /staff/login and sign in as manager/owner/cashier.
2. Open /staff/cashier and open a cashier shift with an opening float.
3. Submit a customer QR order.
4. Accept the order in cashier.
5. Move preparation ready in /staff/kitchen and serve from staff flow.
6. Customer requests the bill.
7. Cashier presents the bill and records a cash manual payment.
8. Confirm the receipt appears.
9. Generate an X report.
10. Close the shift with counted cash and generate the Z report.
11. Confirm another manual payment requires a new open shift.
```

See
`docs/architecture/product-phase-4c0-shift-cash-drawer-xz-reports.md` for the
data model, payment integration, X/Z report behavior, and limitations.

## Product Phase 4E.G0 status

Product Phase 4E.G0 adds a Groq-powered AI waiter provider while keeping the
existing backend safety model intact:

- `AI_WAITER_PROVIDER=stub` remains the local/demo default.
- `AI_WAITER_PROVIDER=groq` enables the API-side Groq provider.
- `GROQ_API_KEY` is used only by the API runtime and must never be exposed to
  the browser.
- Groq returns a structured waiter plan that is validated by backend safety
  rules before any response, tool call, or cart proposal is persisted.
- Draft cart proposals still require customer confirmation and still apply
  through backend cart validation.
- Groq failures, invalid JSON, rate limits, missing config, and unsafe output
  fall back safely instead of breaking customer chat.

See
`docs/architecture/product-phase-4eg0-groq-ai-waiter-provider.md` for provider
architecture, env vars, safety rules, fallback behavior, and the manual smoke
test.

Validation commands for this phase:

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```

## Product Phase 4E.G2 status

Product Phase 4E.G2 adds deep menu grounding and smart tool selection for the
Groq AI waiter provider:

- the API searches the full branch menu before calling Groq;
- Groq receives `relevantMenuItems`, not a first-N `menuItems` slice;
- menu candidates are selected with exact names/slugs, aliases, typo handling,
  category/description tokens, recent-message hints, and cafe intent phrases;
- the cafe lexicon is domain-specific for Egyptian Arabic, Franco-Arabic,
  English, and Balcona menu aliases;
- `AI_WAITER_MENU_SNAPSHOT_LIMIT` controls the backend menu snapshot searched
  for grounding and defaults to `200`;
- `GROQ_MAX_CONTEXT_ITEMS` now caps grounded candidates, defaults to `8`, and
  still has a hard cap of `20`;
- modifier groups/options remain excluded from the first recommendation turn;
- cart proposals are rejected if they contain menu item ids outside the
  backend-grounded candidate set;
- final order submission, price changes, payment, discounts, fake ids, and
  allergy guarantees remain blocked by backend safety validation.

See
`docs/architecture/product-phase-4eg2-deep-menu-grounding-smart-tool-selection.md`
for grounding behavior, prompt/context changes, safety guardrails, tests, and
known limitations.

## Product Phase 4E.G3 status

Product Phase 4E.G3 adds complete ordering intelligence for required modifier
turns while keeping Groq context compact and backend validation strict:

- exact/high-confidence item requests can load compact details for one selected
  item only;
- required modifier groups create a visible modifier question before any cart
  proposal;
- pending modifier metadata is persisted on AI waiter messages without a
  database migration;
- English, Egyptian Arabic, Franco-Arabic, and mixed answers are matched to
  existing modifier option names/slugs only;
- item plus modifier answers in one message can create a valid cart proposal
  after all required groups are satisfied;
- optional modifiers do not block proposal creation;
- quick reply chips render customer-safe option labels and send normal message
  text back to the API;
- safety validation now enforces item-scoped modifier IDs plus min/max and
  single-selection limits;
- menu admin readiness warnings for broken required modifiers remain the setup
  handoff surface;
- Groq still cannot submit final orders, change prices, invent IDs, bypass cart
  validation, or expose hidden action blocks.

See
`docs/architecture/product-phase-4eg3-complete-ordering-intelligence.md` for
item detail grounding, modifier matching, pending state, Groq prompt/context
changes, guardrails, tests, and limitations.

## Product Phase 4S.0 status

Product Phase 4S.0 enforces staff roles, permissions, and branch access for the
current operational staff surfaces:

- staff session guard attaches trusted `request.staffUser` context;
- `/staff/me` and `/staff/me/access` expose current access context;
- company-level memberships apply across all company branches;
- branch-level memberships apply only to that branch;
- inactive staff users and inactive memberships are denied;
- cashier, kitchen/barista, waiter, bill, attention, smart cashier, menu admin,
  branch/table/QR, venue zone, analytics, audit, settings, staff overview, and
  AI waiter staff endpoints are protected by branch/company or entity scope;
- frontend staff navigation, overview cards, route gates, selected branch, and
  login landing now follow effective backend access;
- customer QR, customer cart, customer status, customer waiter/bill, and
  customer AI waiter routes remain customer-facing.

See
`docs/architecture/product-phase-4s0-staff-roles-permissions-branch-access.md`
for enforcement boundaries, reason codes, tests, known limitations, and the next
recommended SaaS admin hardening phase.

## Product Phase 4O.0 status

Product Phase 4O.0 hardens the operational order lifecycle across cashier,
preparation, waiter, and customer status surfaces:

- a shared lifecycle policy defines allowed order transitions and stable denial
  reason codes;
- cashier accept/reject, waiter serve, cashier completion, and staff
  cancellation are guarded by both staff access and lifecycle state;
- completion is allowed only after service;
- serving is allowed only after the order reaches ready state;
- cancellation requires a visible reason and is allowed only before service;
- active preparation tasks are cancelled when the parent order is cancelled;
- preparation start and ready sync now respect parent-order state;
- order responses include lifecycle summaries for reusable frontend gating;
- cashier, kitchen/barista, waiter, and customer status screens consume the
  lifecycle state without changing payment, POS, AI, or admin scope.

See
`docs/architecture/product-phase-4o0-order-lifecycle-hardening.md` for the state
machine, transition rules, reason codes, smoke test, known limitations, and next
recommended Bill + Manual Payment phase.

## Product Phase 4K.0 status

Product Phase 4K.0 adds the KDS kitchen-ticket and mock printer foundation for
accepted orders:

- accepted orders create station-scoped kitchen tickets for barista, kitchen,
  and dessert items;
- each station ticket queues a pending mock print job with structured payload
  and printable text;
- tickets follow preparation lifecycle changes for in-progress, ready,
  cancelled, void, and served states;
- order cancellation queues void print jobs for active tickets;
- the KDS staff page now includes Tasks, Tickets, and Print Queue modes;
- cashier order detail and waiter ready-order cards show read-only ticket and
  print context;
- branch/entity staff access checks protect ticket, print job, and printer
  station endpoints.

See
`docs/architecture/product-phase-4k0-kds-kitchen-tickets-printer-foundation.md`
for the data model, mock printer adapter, lifecycle sync, realtime behavior,
smoke test, known limitations, and next recommended Bill + Manual Payment
phase.

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

Product Phase 4A.0 supersedes this UI-only aggregation with branch-scoped owner
analytics and daily report endpoints backed by recorded orders, bills, manual
payments, cashier shifts, operations, and AI waiter usage.

## UI Phase 8 status

UI Phase 8 adds Full Demo Hardening + Balkona Demo Mode:

- `/demo/balkona` premium local presentation launcher
- shared Balkona demo constants for QR token, local/dev credentials, route links, checklist, proof points, and command reference
- staff overview polished into an operations hub with cashier, kitchen, waiter, owner, and demo launcher links
- customer entry and session empty states hardened for clearer demo next steps
- launcher diagnostics for API base URL, route list, Docker/API/Web reminder, and local command reference
- full demo smoke-test runbook in `docs/demo/balkona-full-demo-smoke-test.md`
- architecture note in `docs/architecture/ui-phase-8-full-demo-hardening-balkona-demo-mode.md`

SaaS admin/menu admin, company/tenant admin, payment/POS, backend behavior changes, fake revenue/orders/analytics, external chart libraries, and new dependencies remain outside this phase.

## Production Phase 1 status

Production Phase 1 adds a deployable platform foundation while keeping local
development unchanged:

- production-style API and Web Dockerfiles
- `docker-compose.prod.example.yml` with API, Web, Postgres, Redis, env-file usage, ports, health checks, and persistent Postgres/Redis volumes
- clearer API and Web env examples for production API base URL, `DATABASE_URL`, `REDIS_URL`, CORS/web origin, session lifetimes, and optional future provider keys
- root scripts for production API start, Web start, and Prisma migration deploy
- deployment runbook in `docs/deployment/production-phase-1-deployable-platform-foundation.md`
- small post-merge demo hotfixes for duplicate customer order keys and readable staff login errors

Local Docker/Postgres/Redis development still uses `docker-compose.yml` and the
existing local quick start. Final AWS infrastructure, managed secrets,
observability, CI/CD promotion, SaaS admin UI, menu admin UI, payments, and POS
remain outside this phase.

## Production Phase 2 status

Production Phase 2 adds the AWS infrastructure foundation without deploying
resources:

- Terraform scaffold in `infra/aws/terraform`
- VPC, subnet, security group, ECR, RDS, Redis, ECS Fargate, ALB, CloudWatch,
  and Secrets Manager foundation resources
- Route 53, ACM, and CloudFront placeholder example for future DNS/TLS work
- AWS architecture, environment mapping, and first-deploy checklist docs
- no real AWS account IDs, domains, credentials, or secrets committed
- no `terraform apply`, Docker compose, server startup, or real AWS deployment

The next production phase is Production Phase 3 - First Public Demo Deploy,
where real AWS account values, image pushes, DNS/TLS finalization, seed/demo
tenant verification, and public smoke testing happen.

## Production Phase 3A status

Production Phase 3A prepares the repository for the first public AWS demo deploy
without creating resources or publishing a public link:

- GitHub Actions CI for Web lint, Web typecheck, Web build, Prisma generate, API
  build, and API tests
- Docker build validation workflow for API and Web images with no image push
- Terraform formatting and validation workflow with no plan or apply
- manual ECR push example workflow documenting required GitHub secrets
- `scripts/deploy` helpers for local Docker image builds and public smoke tests
- Phase 3A readiness docs and Phase 3B first public demo deploy checklist
- no real AWS resources, secrets, account IDs, domains, or deploy commands

Local development still uses the existing quick start and `docker-compose.yml`.
There is still no public demo URL until Production Phase 3B. The next phase is
Production Phase 3B - First Public Demo Deploy.

## Production Phase 3B preflight status

Production Phase 3B adds the exact first public AWS demo deploy pack while still
avoiding real infrastructure changes:

- AWS deploy decision template for owner, budget, domain, network, sizing,
  rollback, seed, and approval decisions
- staging Terraform tfvars example for first-demo sizing and placeholder image
  URIs/origins
- AWS network egress planning for NAT Gateway versus VPC endpoints
- first public demo command runbook with approval gates around cost-creating or
  destructive commands
- Prisma migration runner plan for safe deployed migrations
- public demo seed verification checklist for the Balkona table/customer/staff
  flow
- local Terraform validation helper scripts for fmt/init/validate only

Still no public link until real AWS values are approved and terraform
apply/deploy is executed manually. The next phase is Production Phase 3C -
First Public AWS Demo Execution.

## Product Phase 4A status

Product Phase 4A starts the product completion track for turning the current
demo into a complete Cafe Operating System usable by real cafes:

- full Cafe OS gap audit across customer, staff, admin, AI, analytics, security,
  seed data, realtime, and QA surfaces
- completion roadmap from Product Phase 4B through Product Phase 4J
- real AI Waiter engine specification for menu-grounded, validation-gated
  suggestions
- real cafe readiness checklist for one-day pilot decisions

AWS execution is paused until budget and customer readiness are approved.

## Product Phase 4B status

Product Phase 4B adds a branch-scoped Menu Admin Control Center for real cafe
menu operations:

- `/staff/menu` control center for categories, items, branch availability,
  modifiers, item modifier links, and preview issues
- branch-effective menu admin overview at
  `/api/v1/branches/:branchId/menu-admin/overview`
- setup warnings for customer-visible menu gaps, hidden or unavailable items,
  missing branch overrides, and modifier validation risks
- customer menu and staff owner menu cache invalidation after menu admin writes
- local Balkona demo launcher links for reviewing menu admin before customer
  ordering

This phase does not add AWS execution, SaaS onboarding, billing, payments, POS,
or real LLM behavior.

## Product Phase 4C status

Product Phase 4C adds the Branch & Tables foundation required before real cafe
QR readiness:

- guarded branch/table admin API at
  `/api/v1/companies/:companyId/branch-admin/overview`
- branch create/edit/activate/deactivate
- floor create/edit using the current `Floor` model for operational grouping
- table create/edit/activate/deactivate with capacity, floor, status, and QR
  token controls
- QR token generate/regenerate endpoints with collision-safe token generation
- active table session visibility and backend setup warnings
- `/staff/branches` staff UI for branches, floors, tables, QR links, active
  sessions, and readiness issues

The existing Balkona QR token `balcona-main-t01` remains supported. This phase
does not add tenant onboarding, billing, payments, POS, real AI provider
integration, advanced floor plan editing, QR image/PDF batch generation, or AWS
deployment execution. The current next phase is Product Phase 4D - Staff Roles /
Permissions / Branch Access.

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
http://localhost:3001/demo/balkona
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

Balkona full demo flow:

```text
1. Open /demo/balkona.
2. Start the seeded customer QR table: /customer/table/balcona-main-t01.
3. Add menu items, optionally use AI Waiter, review cart, and submit the order.
4. Log in through /staff/login with the local/dev account.
5. Accept the order in /staff/cashier.
6. Move preparation work in /staff/kitchen.
7. Resolve service calls or attention in /staff/waiter.
8. Review the operating overview in /staff/owner.
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
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/balcona_bar?schema=public
REDIS_URL=redis://<host>:6379/0
STAFF_AUTH_SESSION_HOURS=12
STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=false
CUSTOMER_ACCESS_TOKEN_HOURS=24
SWAGGER_ENABLED=false
CORS_ORIGINS=http://localhost:3001
JOBS_ENABLED=true
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

Production deployments should set `NODE_ENV=production`,
`STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=false`, a production `DATABASE_URL`,
`REDIS_URL`, and deployed web origins in `CORS_ORIGINS`. Current staff and
customer access tokens are opaque database-backed tokens stored as hashes, so no
JWT signing secret is required in this phase.

Backend core, UI demo flows, and Production Phase 1 deployment files are now
ready for provider-specific planning. Remaining production work includes final
cloud infrastructure, managed secrets, complete staff-auth enforcement on all
staff-only routes, customer token guards across PWA mutation/read endpoints,
production rate limiting, external notification delivery, deployment-specific
CORS review, and real payment/POS/storage/AI integrations when their phases
begin.

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
- UI Phase 8 full demo hardening and Balkona demo mode: `docs/architecture/ui-phase-8-full-demo-hardening-balkona-demo-mode.md`
- Balkona full demo smoke test: `docs/demo/balkona-full-demo-smoke-test.md`
- Production Phase 1 deployable platform foundation: `docs/deployment/production-phase-1-deployable-platform-foundation.md`
- Production Phase 2 AWS infrastructure foundation: `docs/deployment/production-phase-2-aws-infrastructure-foundation.md`
- AWS environment mapping: `docs/deployment/aws-env-mapping.md`
- AWS first deploy checklist: `docs/deployment/aws-first-deploy-checklist.md`
- Production Phase 3A public demo readiness: `docs/deployment/production-phase-3a-public-demo-readiness.md`
- Production Phase 3B first public demo deploy checklist: `docs/deployment/production-phase-3b-first-public-demo-deploy-checklist.md`
- AWS deploy decisions template: `docs/deployment/aws-deploy-decisions.template.md`
- AWS network egress options: `docs/deployment/aws-network-egress-options.md`
- AWS first public demo command runbook: `docs/deployment/aws-first-public-demo-command-runbook.md`
- AWS Prisma migration runner: `docs/deployment/aws-prisma-migration-runner.md`
- Public demo seed verification: `docs/deployment/public-demo-seed-verification.md`
- Full Cafe OS gap audit: `docs/product/full-cafe-os-gap-audit.md`
- Full Cafe OS completion roadmap: `docs/product/full-cafe-os-completion-roadmap.md`
- AI Waiter real engine spec: `docs/product/ai-waiter-real-engine-spec.md`
- Product Phase 4B menu admin control center: `docs/product/product-phase-4b-menu-admin-control-center.md`
- Product Phase 4C branch tables QR management: `docs/product/product-phase-4c-branch-tables-qr-management.md`
- Product Phase 4E.G2 deep menu grounding and smart tool selection: `docs/architecture/product-phase-4eg2-deep-menu-grounding-smart-tool-selection.md`
- Product Phase 4E.G3 complete ordering intelligence: `docs/architecture/product-phase-4eg3-complete-ordering-intelligence.md`
- Product Phase 4S.0 staff roles, permissions, and branch access: `docs/architecture/product-phase-4s0-staff-roles-permissions-branch-access.md`
- Product Phase 4O.0 order lifecycle hardening: `docs/architecture/product-phase-4o0-order-lifecycle-hardening.md`
- Product Phase 4K.0 KDS, kitchen tickets, and printer foundation: `docs/architecture/product-phase-4k0-kds-kitchen-tickets-printer-foundation.md`
- Product Phase 4C.0 shift, cash drawer, and X/Z reports: `docs/architecture/product-phase-4c0-shift-cash-drawer-xz-reports.md`
- Product Phase 4T.0 tenant onboarding and company setup: `docs/architecture/product-phase-4t0-tenant-onboarding-company-setup.md`
- Real cafe readiness checklist: `docs/product/real-cafe-readiness-checklist.md`
