# R2 — Balcona Full Surface Registry

Status: IN PROGRESS
Audit date: 2026-08-28
Branch: `ux/product-ia-overhaul`

## Scope

This audit inventories the current web product surfaces before any redesign. It records route structure, navigation, page concentration, API actions, role/scope assumptions, and obvious surface debt.

This is not a visual review only.

## Current route families

### Guest / customer

1. `/customer` — customer entry / demo entry surface
2. `/customer/table/[qrToken]` — QR table-session bootstrap
3. `/customer/session/[sessionId]` — session home
4. `/customer/session/[sessionId]/menu` — menu browsing and add-to-cart
5. `/customer/session/[sessionId]/cart` — cart edit/validation/submit
6. `/customer/session/[sessionId]/status` — order/session status and timeline
7. `/customer/session/[sessionId]/service` — waiter calls, bill request, bill/payment state
8. `/customer/session/[sessionId]/ai-waiter` — AI waiter conversation/proposals/escalation

Current guest bottom navigation:
- Home
- Menu
- Cart
- Status
- Service

The AI Waiter is not a peer bottom-navigation destination; it is accessed contextually from other guest surfaces.

### Staff / tenant operations

1. `/staff` — staff overview / surface launcher
2. `/staff/login` — staff auth
3. `/staff/invite/[token]` — invite acceptance
4. `/staff/cashier` — cashier/order/bill/payment/shift workspace
5. `/staff/kitchen` — preparation/KDS/tickets/print queue workspace
6. `/staff/waiter` — waiter calls/attention/serve workspace
7. `/staff/menu` — menu/category/item/modifier/availability administration
8. `/staff/inventory` — inventory/procurement/receiving administration
9. `/staff/branches` — branch/floor/table/QR/session/setup-issue administration
10. `/staff/setup` — tenant onboarding/readiness
11. `/staff/billing` — Balcona SaaS plan/entitlement status
12. `/staff/owner` — owner analytics/reporting command center

Current authenticated staff navigation is a flat permission-filtered list:
- Overview
- Cashier
- Menu
- Inventory
- Setup
- Billing
- Branches
- Kitchen
- Waiter
- Owner

This mixes:
- operational workspaces
- Back Office domains
- onboarding
- SaaS account billing
- role-named analytics

in one navigation level.

### Balcona platform administration

1. `/platform/login` — platform admin login
2. `/platform` — platform dashboard/company listing
3. `/platform/companies` — company listing alias/surface
4. `/platform/companies/new` — sales-led cafe bootstrap
5. `/platform/companies/[companyId]` — tenant detail/subscription/invite administration
6. `/platform/status` — system status

Current platform navigation:
- Dashboard
- Companies
- Add Cafe
- Status

The Platform surface is already conceptually separated from tenant staff operations. Preserve this separation during R7.

### Demo / public shell

- `/` — root/public entry
- `/demo/balkona` — flagship demo launcher

The demo launcher is a presentation/development surface, not part of the future restaurant IA.

## Page concentration audit

Large feature pages currently contain multiple workflows in single React surfaces:

| Surface | Approx. lines | Main responsibilities observed |
|---|---:|---|
| Inventory | 4,041 | inventory items, branch stock, alerts, menu requirements, suppliers, purchase orders, PO lines, submit/cancel, receiving |
| Menu Admin | 2,817 | overview, categories, items, branch availability, modifiers, preview/setup issues |
| Branch/Table Admin | 1,806 | branches, floors, tables, QR links, sessions, setup issues |
| Setup | 1,655 | company profile, branch profile, floors/tables, QR, staff invites, readiness, launch checklist |
| Cashier | 1,381 | order queue/detail, accept/reject/cancel/complete, bill requests, manual payment, cashier shift, cash adjustment, X report |
| Kitchen | 1,168 | preparation tasks, kitchen tickets, print jobs, retries/reprints, realtime |
| Owner | 1,018 | owner analytics dashboard + daily report |
| Waiter | 988 | waiter calls, ready-to-serve, table attention, mute/recalculate/resolve attention, realtime |
| Guest Service | 674 | waiter calls, bill request, bill state, online payment intent |
| AI Waiter | 646 | AI session, conversation, proposals, cart application/rejection, escalation |
| SaaS Billing | 560 | current plan, subscription, usage, entitlements, warnings, blockers, plan catalog |

Line count is not itself a UX defect. Here it is used as a signal that several current routes are product-area containers, not single jobs.

## Current internal tabs / sub-surfaces

### Branch / tables
`/staff/branches` contains:
- Branches
- Floors
- Tables
- QR Links
- Active Sessions
- Setup Issues

### Menu
`/staff/menu` contains:
- Overview
- Categories
- Items
- Availability
- Modifiers
- Preview Issues

### Kitchen
Current code and API calls expose at least three operational layers:
- Preparation tasks
- Kitchen tickets
- Print jobs / print queue

The final audit must still record the exact visible mode control and modal/drawer behavior.

### Inventory
Current API calls prove the route contains at least:
- Inventory item master data
- Branch inventory levels
- Stock adjustments
- Alerts
- Menu-item inventory requirements
- Menu availability impact
- Suppliers
- Purchase orders
- Purchase-order lines
- Submit/cancel PO
- Receiving
- Inventory receipts

This is already a procurement domain inside one top-level `Inventory` page.

## Action coverage by current surface

### Cashier
Current page directly calls actions for:
- accept order
- reject order
- cancel order
- complete order
- acknowledge bill request
- present bill
- record manual payment
- open cashier shift
- close cashier shift
- create cash adjustment
- get X report
- realtime branch events
- logout

Surface observation:
Cashier currently combines order execution, bill settlement, cash control, and shift close.

### Kitchen
Current page directly calls actions for:
- start preparation
- mark preparation ready
- cancel preparation
- kitchen tickets
- reprint kitchen ticket
- print-job success/failure/retry
- realtime events

Surface observation:
The route combines live KDS work and printer operations. R5/R6 must decide which printer actions are minute-by-minute kitchen actions versus administrative exception handling.

### Waiter
Current page directly calls actions for:
- waiter-call acknowledge/resolve/cancel
- ready-to-serve orders
- serve order
- table attention queue
- recalculate/rebuild attention
- mute/resolve table attention
- realtime events

Surface observation:
This is more than a waiter-call inbox; it is already an operational attention engine.

### Menu Admin
Current page directly calls actions for:
- category CRUD/lifecycle
- item CRUD/lifecycle/archive
- modifier group/option CRUD/lifecycle
- item↔modifier group assignment
- branch menu-item overrides
- availability

Surface observation:
The backend/front-end contract supports a reusable catalog plus branch override concept, but the current UX still presents it as one very large route.

### Inventory / procurement
Current page directly calls actions for:
- item create/update
- branch stock adjustment
- alerts and availability
- recipe/menu inventory requirements
- supplier create/update
- PO create/update
- PO line create/update/remove
- PO submit/cancel
- PO receive
- receipts

Surface observation:
Balcona already has a purchasing/receiving workflow family. R4 should not classify procurement as a missing feature merely because it is visually buried inside Inventory.

### Setup
Current page directly calls actions for:
- company onboarding profile
- branch onboarding profile
- floor creation
- bulk table creation
- staff invitations
- branch readiness checks
- launch checklist

Surface observation:
The underlying product already contains the beginnings of the evidence-backed Setup/Readiness layer identified in R1.

### Owner
Current page directly loads:
- owner analytics dashboard
- owner daily report

Current backend reporting breadth may exceed what is visible through this single owner surface; R3/R4 will verify.

### SaaS Billing
Current page loads:
- branch SaaS status
- plan catalog

Surface observation:
This is Balcona-account subscription/entitlement administration, not restaurant customer payment operations. It is currently placed as a sibling of Cashier/Kitchen in Staff navigation.

## Guest surface audit

### QR bootstrap
`/customer/table/[qrToken]`
- starts a table session
- routes into the session experience
- handles invalid/error QR state

### Session Home
- gets cart state
- gets customer status
- acts as a launcher into Menu / AI / Cart / Status / Service

Current concern:
Home currently behaves partly as a feature launcher. R5/R6 should define what a seated guest most needs *now* versus which capabilities deserve permanent navigation.

### Menu
- branch menu
- cart state
- add to cart
- AI entry point

### Cart
- update/remove/clear
- validate
- submit

### Status
- customer status
- timeline
- table-session orders

### Service
- create waiter call
- waiter-call history
- request bill
- load bill
- create online payment intent
- development/mock payment support

Current concern:
Service is carrying hospitality help + bill presentation + payment. R7 may keep these related in the guest journey but should not assume they must remain one screen.

### AI Waiter
- starts/resumes AI session
- sends messages
- receives proposals
- apply/reject cart proposal
- escalation
- close AI session
- branch experience/menu grounding

Current concern:
AI is technically a separate page, while R1 guest references suggest recommendation/intelligence may also belong contextually inside menu discovery. This remains a hypothesis for R5-R10, not an approved redesign.

## Navigation debt findings

### N1 — Flat Staff IA
Operational workspaces and administrative domains are siblings.

### N2 — Role labels used as destinations
`Owner`, `Kitchen`, and `Waiter` are role/workspace language, while `Menu`, `Inventory`, and `Branches` are business-domain language.

### N3 — SaaS billing mixed with cafe operations
Balcona subscription/entitlement status is inside the same Staff navigation as minute-by-minute restaurant work.

### N4 — Branch context is widely reused without a higher-level scope model
The current shell has a selected branch and permission filtering, but R3/R5 must determine which workflows are branch-scoped, company-scoped, or multi-location/HQ.

### N5 — Setup is a peer destination
Current Setup has real readiness/orchestration capability but is navigationally treated like a permanent daily module.

### N6 — Staff Overview is a feature directory
The current Overview maps visible staff areas into cards. This is useful for demos/discovery but does not yet behave like an operational Home focused on exceptions, tasks, and business health.

## Surface debt findings

### S1 — Mega-routes
Inventory, Menu, Branch Admin, Setup, Cashier, and Kitchen each contain multiple jobs and exception paths.

### S2 — Operational and exception tools share surfaces
Example: live kitchen preparation and printer retry management share one route.

### S3 — Existing backend concepts are visually compressed
Examples:
- procurement compressed into Inventory
- table attention/autopilot compressed into Waiter
- cash drawer/shift close compressed into Cashier
- SaaS entitlements compressed into Billing
- branch/floor/table/QR/session health compressed into Branches

### S4 — Guest capability exceeds navigation language
The guest product supports AI assistance, realtime status, service calls, bill requests, and online payments, while its primary navigation reads like a simple menu-ordering app.

## Preserve candidates

These existing product boundaries are currently healthy enough to preserve conceptually unless later audits contradict them:

- Platform Admin is separate from tenant operations.
- Guest routes are separate from Staff routes.
- Guest has a mobile-first bottom-navigation shell.
- KDS/Waiter/Cashier each have dedicated operational routes rather than being widgets inside Owner.
- permissions already filter staff route access.
- Setup already has computed readiness instead of a fake checklist.
- Menu already supports branch overrides.
- Inventory already connects menu availability to stock.
- realtime operational APIs already exist across cashier/kitchen/waiter.

## Remaining R2 gate

Before R2 can be marked COMPLETE, audit:
1. exact visible sections/modes inside Cashier, Kitchen, Waiter, Inventory, Setup, Owner, Platform company detail
2. modal/drawer/detail-panel behavior
3. desktop/mobile/touch assumptions per route
4. duplicated actions across surfaces
5. hidden routes/actions reachable only through links
6. current empty/loading/error/destructive-confirmation patterns
7. existing i18n/RTL behavior that constrains redesign

No final IA decision is approved during R2.


## R2 detail / interaction audit

### Exact current sub-navigation

Kitchen mode state:
- Tasks
- Tickets
- Print

Inventory mode state:
- Overview
- Items
- Levels
- Alerts
- Adjustments
- Suppliers
- Purchase Orders
- Receiving
- Requirements
- Availability
- Movements

Branch/Table admin tabs:
- Branches
- Floors
- Tables
- QR Links
- Active Sessions
- Setup Issues

Menu admin tabs:
- Overview
- Categories
- Items
- Availability
- Modifiers
- Preview Issues

Owner date scope defaults to Today and supports report-range behavior rather than separate analytics routes.

### Detail-panel pattern

Current feature code uses dedicated detail panels for:
- customer menu item detail
- cashier order detail
- kitchen preparation task detail
- waiter call detail
- table attention detail

This is a useful existing pattern for list/queue → focused action context.

### Modal / confirmation pattern

No shared Staff Dialog/Sheet/AlertDialog pattern was found in the current feature surfaces.

Explicit browser-native confirmation usage was found in:
- Branch/Table Admin
- Inventory

This is a UX-system gap for R9: destructive/irreversible actions need a consistent confirmation and consequence pattern rather than route-specific browser confirms.

### i18n / RTL constraints

- app-level direction handling exists
- Arabic/RTL support exists in the i18n layer
- language switching is present in the dashboard shell and guest shell/session surfaces
- AI message/composer surfaces contain RTL-aware behavior

R11 must preserve Arabic/RTL as a first-class layout requirement. The redesign cannot be validated only in English/LTR.

### Device/context assumptions visible in current code

- Guest is explicitly mobile-first with fixed bottom navigation and a constrained max-width session shell.
- Staff uses a desktop-oriented dashboard shell with a persistent left rail on large screens and horizontal navigation on smaller screens.
- Cashier, Kitchen, and Waiter currently inherit the same Staff shell even though their task/device contexts differ.
- Platform Admin is desktop/back-office oriented and correctly separated from guest/staff.

This confirms an R1 hypothesis: operational surfaces currently share a shell for implementation convenience, not because their jobs are equivalent.

## R2 duplication / placement findings

### D1 — Setup and Branches overlap
Setup can create floors/tables in bulk and expose readiness/QR concerns, while Branches owns detailed branch/floor/table/QR/session administration.

Interpretation:
- Setup should likely orchestrate completion.
- Locations/Branch administration should own ongoing maintenance.
- Exact boundary will be defined in R7, not by deleting either capability.

### D2 — Owner and Staff Overview overlap as dashboards
Staff Overview is a capability launcher while Owner is a business analytics surface.

Interpretation:
A future role-aware Home should not require two dashboard concepts for an owner unless they serve clearly different decision contexts.

### D3 — Cashier and Money overlap
Cashier owns immediate bill/payment/shift actions while financial settlement/reconciliation capabilities exist outside this visible surface in the backend.

Interpretation:
Keep immediate payment execution close to cashier; move investigation/reconciliation/accounting to Back Office Money during R7/R10 if R3 confirms coverage.

### D4 — Kitchen live work and print administration overlap
Print failure/retry is currently inside the same kitchen route as preparation tasks and tickets.

Interpretation:
Some printer exceptions may belong in Kitchen; printer/device configuration and historical troubleshooting may belong elsewhere. Frequency/role mapping will decide.

### D5 — Guest Service mixes service and financial completion
Waiter calls, bill requests, bill state, and online payment initiation share one route.

Interpretation:
They are part of one end-of-meal journey, but R10 should decide whether one screen, progressive panels, or a distinct Bill/Pay state best serves the guest.

## R2 completion gate

R2 status: COMPLETE

Completed:
- all public/customer/staff/platform/demo route families inventoried
- current navigation models recorded
- major internal tabs/modes recorded
- large multi-workflow surfaces identified
- primary API actions by surface recorded
- detail-panel pattern recorded
- destructive-confirmation gap recorded
- guest/staff/platform device assumptions recorded
- i18n/RTL constraints recorded
- major placement/duplication problems recorded

R2 does not decide the replacement IA. The next phase is R3: backend feature registry, including capabilities that have no obvious current route.
