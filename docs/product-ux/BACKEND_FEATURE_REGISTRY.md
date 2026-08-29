# R3 — Backend Feature Registry

Status: COMPLETE
Audit date: 2026-08-28
Branch: `ux/product-ia-overhaul`

## Scale snapshot

Current backend structure audited from source, not only README phase notes:

- 46 imported NestJS application modules
- 44 HTTP controllers
- 60 service files
- 89 Prisma models
- 107 Prisma enums

The current product therefore cannot be represented accurately by the current Staff navigation alone.

## Registry classification

Frontend exposure labels in this document are observations only:
- Dedicated — obvious current route/workspace exists
- Partial — some capability is surfaced but the domain is broader than the route
- No dedicated route — API exists but no obvious dedicated current web route was found
- Infrastructure — intentionally not a tenant UI domain

R4 decides whether a missing dedicated route is a UX gap, an embedded capability, or intentionally internal.

---

## A. Enterprise / tenant / location foundation

### Companies
Backend:
- list companies
- list company branches

Frontend exposure:
- Platform Admin: Dedicated
- Tenant Staff: indirect through selected company/branch context

### Branches / floors / tables / QR
Backend:
- branch create/update/activate/deactivate
- floor create/update
- table create/update/activate/deactivate
- QR token generate/regenerate
- active table sessions
- QR resolution

Frontend exposure:
- Dedicated: `/staff/branches`
- Setup also exposes bulk creation

### Branch operating settings
Backend:
- get/update branch operating settings
- operating mode/service mode concepts

Frontend exposure:
- No dedicated route observed

### Branch feature flags
Backend:
- list feature flags
- update individual branch feature flag

Frontend exposure:
- No dedicated route observed

### Venue zones
Backend:
- list/create/get/update/delete/archive branch venue zones
- typed zone model exists

Frontend exposure:
- No dedicated route observed

### Tenant onboarding
Backend:
- company onboarding profile
- branch onboarding profile
- floor creation
- bulk tables
- staff invite
- readiness checks
- launch checklist

Frontend exposure:
- Dedicated: `/staff/setup`

R3 note:
The backend already supports a real onboarding/readiness domain. The future UX does not need to invent a fake setup checklist from scratch.

---

## B. Identity / access / SaaS

### Staff authentication
Backend:
- login/logout
- current staff identity
- current effective access
- permission checks

Frontend exposure:
- Dedicated auth flow
- permission-filtered Staff navigation

### Staff / roles / membership
Backend/schema:
- staff users
- staff memberships
- roles
- sessions
- branch/company scoped access

Frontend exposure:
- Partial through Setup invites and auth
- no dedicated ongoing Team/People administration route observed

### Staff invites
Backend:
- fetch invite
- accept invite

Frontend exposure:
- Dedicated invite acceptance route
- invite creation embedded in Setup / Platform

### Platform administration
Backend:
- platform auth
- plans
- companies
- cafe bootstrap
- company detail
- staff invites
- subscription update
- platform audit events

Frontend exposure:
- Dedicated `/platform/*` workspace

### SaaS plans / subscriptions / entitlements
Backend/schema:
- plan catalog
- company subscription
- plan limit overrides
- feature entitlements
- company/branch SaaS status

Frontend exposure:
- Dedicated tenant status page: `/staff/billing`
- Platform subscription editing also exists

R3 note:
This domain is Balcona-account SaaS administration, distinct from restaurant customer payment processing.

---

## C. Menu / catalog

### Guest menu read model
Backend:
- company menu
- branch menu
- item detail
- unavailable branch items

Frontend exposure:
- Dedicated Guest Menu

### Menu administration
Backend:
- category create/update/reorder/activate/deactivate
- item create/update/reorder/activate/deactivate/archive
- modifier group create/update/activate/deactivate
- modifier option create/update/reorder/activate/deactivate
- item↔modifier-group relationships
- branch item overrides

Frontend exposure:
- Dedicated: `/staff/menu`

R3 note:
The backend already has a reusable company-level catalog plus branch-specific override model. R7 should not redesign it as independent branch copies.

---

## D. Inventory / procurement

### Inventory master data
Backend/schema:
- company inventory items
- units/status/thresholds/par concepts

### Branch stock
Backend:
- inventory levels
- alerts
- manual adjustments
- inventory movements

### Menu inventory grounding
Backend:
- menu-item inventory requirements
- branch menu availability derived from stock

### Suppliers
Backend:
- company/branch supplier listing
- create/update

### Purchase orders
Backend:
- list/create/get/update
- submit/cancel
- PO lines add/update/remove

### Receiving
Backend:
- receive PO
- inventory receipts
- receipt lines

Frontend exposure:
- Dedicated but highly concentrated: `/staff/inventory`

R3 note:
Procurement is not future-only. Supplier → PO → receiving already exists in the backend and current route.

---

## E. Guest session / hospitality journey

### QR / table session
Backend:
- resolve QR
- start/get/view/close table session
- list active branch sessions
- table session event history

Frontend exposure:
- Dedicated Guest bootstrap/session flow
- active sessions also visible in Branch Admin

### Cart
Backend:
- get/add/update/remove/clear
- validate

Frontend exposure:
- Dedicated Guest Cart

### AI Waiter
Backend/schema:
- start/resume session
- messages
- tool calls
- cart proposals
- proposal apply/reject
- escalation
- close
- branch AI session list/detail
- usage events/provider modes

Frontend exposure:
- Dedicated Guest AI Waiter
- branch-management exposure is limited relative to backend session/audit depth

### Customer status/timeline
Backend:
- order customer status
- session customer status
- customer timeline

Frontend exposure:
- Dedicated Guest Status

### Waiter calls
Backend:
- create/list/detail
- acknowledge/resolve/cancel
- customer + branch views
- event history

Frontend exposure:
- Guest Service + Staff Waiter

### Bill requests
Backend:
- request
- branch queue
- detail
- acknowledge
- present
- close
- cancel

Frontend exposure:
- Guest Service + Cashier

### Bills / receipts
Backend:
- branch bills
- create from bill request
- detail
- present/cancel
- manual payment
- receipt generate/read
- bill events

Frontend exposure:
- Guest Service + Cashier
- no dedicated Bill/Finance administration route observed

---

## F. Orders / cashier / front-of-house operations

### Orders
Backend:
- submit cart
- cashier queue
- ready-to-serve
- order detail
- accept/reject
- serve/complete/cancel
- session orders
- order event history

Frontend exposure:
- Cashier + Waiter + Guest Status

### Smart Cashier
Backend/schema:
- branch smart-cashier settings
- evaluate order
- attempt auto-accept
- review rules create/update/disable
- rule scope/manual review reason/decision models

Frontend exposure:
- No dedicated configuration route observed

R3 note:
Smart Cashier is a substantial product capability currently much less visible than its backend contract.

### Cashier shifts / cash drawer
Backend/schema:
- current/open/list/detail shift
- cash adjustments
- X report
- close shift / report
- cash drawer transaction model
- X/Z report model

Frontend exposure:
- Partial/Dedicated inside Cashier
- owner analytics also consumes shift/report data

---

## G. Kitchen / production / printing

### Preparation tasks
Backend:
- branch/order task queues
- task detail
- start
- ready
- cancel
- task events

Frontend exposure:
- Dedicated Kitchen

### Kitchen tickets
Backend:
- branch ticket list
- detail
- reprint
- ticket/item lifecycle models

Frontend exposure:
- Dedicated Kitchen mode

### Print jobs
Backend:
- branch jobs
- detail
- mark printing/printed/failed
- retry
- print job events

Frontend exposure:
- Dedicated Kitchen mode / exception handling

### Printer stations
Backend:
- list/create/update/disable
- test print
- adapter/status models

Frontend exposure:
- Partial
- no dedicated device/printer administration route observed

R3 note:
Live print-job operation is exposed; printer-station configuration is broader than the visible Kitchen queue.

---

## H. Autopilot / attention

### Table attention engine
Backend/schema:
- branch attention queue
- rebuild
- session attention
- recalculate
- resolve
- mute
- attention snapshot/events
- reason/priority/status

Frontend exposure:
- Partial/Dedicated inside Waiter
- owner summary components also consume attention concepts

R3 note:
This is an operational exception engine, not merely waiter-call UI.

---

## I. Payments / financial operations

### Customer online payment
Backend:
- create customer payment intent
- customer intent status
- providers: mock / Paymob / Fawry and PAY-8 provider foundation on its working branch
- provider webhook lifecycle

Frontend exposure:
- Partial: Guest Service

### Branch payment operations
Backend:
- branch online-payment listing
- payment intent detail
- refund
- void
- capture
- intent recovery
- operation recovery

Frontend exposure:
- No dedicated current Money/Payments route observed

### Settlement / reconciliation
Backend/schema:
- provider reconciliation runs
- settlement batch import
- reconciliation runs
- reconciliation entries
- reconciliation issues
- issue acknowledge/resolve
- settlement batch detail
- movement/match/issue status models

Frontend exposure:
- No dedicated current reconciliation/finance route observed

R3 note:
This is one of the largest backend-to-visible-product mismatches found so far.

---

## J. Analytics / audit / management insight

### General analytics
Backend:
- branch overview
- branch menu analytics
- branch staff actions
- company overview

Frontend exposure:
- No obvious dedicated current route using the general Analytics controller

### Owner analytics
Backend:
- summary
- sales
- orders
- items
- operations
- cashier shifts
- AI waiter
- dashboard
- daily report

Frontend exposure:
- Dedicated: `/staff/owner`

### Audit logs
Backend:
- branch audit logs
- company audit logs
- actor/action models

Frontend exposure:
- No dedicated audit-log route observed

R3 note:
Owner dashboard represents only one reporting surface; audit/general analytics are separate backend domains.

---

## K. Experience / content / media

### Experience profiles
Backend/schema:
- company/branch profiles
- create/update/activate/archive/default
- effective branch experience
- Balkona experience-pack preview/apply
- scope/status models

Frontend exposure:
- Guest AI reads effective experience
- No dedicated Experience management route observed

### Content blocks
Backend:
- company/branch blocks
- create/update
- activate/deactivate/archive
- placement/status models

Frontend exposure:
- No dedicated content-management route observed

### Notification templates
Backend:
- company/branch templates
- create/update
- activate/deactivate

Frontend exposure:
- No dedicated template-management route observed

### Media assets
Backend/schema:
- assets list/create/get/update
- archive/restore/delete marker
- usage list/create/update/delete
- storage/type/status/usage-target models

Frontend exposure:
- No dedicated media-library route observed

R3 note:
Balcona contains the beginnings of an experience/content system that the current Staff IA does not communicate.

---

## L. Presence / notifications / realtime

### Presence events
Backend:
- create presence event
- branch presence history

### Customer/branch notifications
Backend:
- table-session notifications
- mark read/dismiss
- branch notifications
- channel/kind/status/delivery models
- device subscriptions

Frontend exposure:
- Partial / embedded
- no dedicated notification operations/admin route observed

### Realtime events
Backend:
- branch realtime event feed
- table-session realtime feed
- typed realtime event/channel model

Frontend exposure:
- Embedded infrastructure across customer/cashier/kitchen/waiter

---

## M. System / operations infrastructure

### Jobs
Backend:
- job health
- queue health

Frontend exposure:
- internal/system concern; Platform Status may expose related health indirectly

### System / health
Backend:
- health
- system info

Frontend exposure:
- Platform Status / deployment tooling

### Smoke
Backend:
- staging smoke bootstrap/reset

Frontend exposure:
- Infrastructure only

### Redis / Prisma / config
Infrastructure only.

---

## High-value R3 observations for R4

The following backend domains have **no obvious dedicated current tenant route** despite meaningful domain depth:

1. Branch operating settings
2. Branch feature flags
3. Venue zones
4. Ongoing Team/People administration
5. Smart Cashier settings/review rules
6. Printer station/device administration
7. Online-payment operations
8. Settlement/reconciliation issues
9. General analytics
10. Audit logs
11. Experience profiles/packs
12. Content blocks
13. Notification templates
14. Media library/usages
15. Presence/notification operations

These are not automatically "missing pages." R4 must classify each as:
- should become a dedicated surface
- should be embedded in an existing domain
- should appear only in Setup/advanced settings
- should remain internal/infrastructure

## Backend capabilities already richer than current route names suggest

- `Inventory` includes procurement and receiving.
- `Waiter` includes a table-attention/autopilot engine.
- `Cashier` includes shift and cash-drawer close operations.
- `Service` includes bill/payment flow.
- `Menu` includes company catalog + branch overrides.
- `Setup` includes computed readiness and launch gating.
- `Online Payments` includes post-payment operations and settlement reconciliation not represented by the visible Staff IA.
- Experience/content/media systems exist without a coherent current Back Office home.

## R3 completion gate

R3 status: COMPLETE

Completed:
- module inventory
- controller-by-controller route/action audit
- Prisma model/enum scale audit
- domain classification
- current frontend exposure observation
- no-dedicated-route candidates recorded
- infrastructure separated from tenant product domains

Next: R4 — map R2 surfaces against R3 capabilities and classify strong, weak, missing, misplaced, duplicated, or intentionally internal coverage.
