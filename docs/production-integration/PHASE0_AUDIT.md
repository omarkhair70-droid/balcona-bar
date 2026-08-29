# Balcona Production Integration — Phase 0 Audit

Status: PHASE 0 BASELINE
Date: 2026-08-29
Repository: `omarkhair70-droid/balcona-bar`
Baseline main SHA: `e05de1ac7059b1776ec3f05cd37e84556e8594aa`
UX/UI closure: PR #126 merged, post-merge CI green
Open unrelated lane: PR #116 PAY-8 (Draft)

## Purpose

This audit maps the six visually approved Balcona prototype surfaces to the production web routes and real API/realtime capabilities already present on `main`.

It is intentionally **not a redesign** and **not an architecture restart**.

The production integration rule is:

> Preserve the approved visual shell, reuse proven production behavior, and only add wiring/read models where the approved surface requires product truth that is not yet exposed in the corresponding production route.

## Hosting / deployment truth

- Balcona's current deployment target/runtime is **Oracle**.
- Railway is historical context only and is not a target.
- The repository still contains AWS-era deployment documentation and Terraform. Those files are not evidence of the current runtime target.
- Oracle/production runtime verification is a separate Oracle/Pilot lane. This Phase 0 audit does not claim that the live Oracle host, Docker stack, database, Redis, proxy, TLS, backups, or monitoring have been re-audited here.

---

# 1. Executive finding

Production Integration is **not a greenfield implementation**.

The current production web app already contains substantial real behavior:

- Guest session/menu/cart/order/status/service/payment/AI flows.
- Cashier orders, bills, shifts, manual payment, and realtime.
- Waiter calls, attention, ready-to-serve, serving, and realtime.
- Kitchen preparation tasks, KDS tickets, print jobs, and realtime.
- Owner analytics.
- Menu administration.
- Inventory/procurement.
- Branch/floor/table/QR administration.
- Tenant onboarding.
- Platform company/bootstrap/subscription/system-status operations.

The primary job is therefore:

1. promote the approved prototype shells;
2. preserve existing query/mutation/reliability logic;
3. consolidate fragmented production routes where the approved surface expects one product surface;
4. fill only the missing UI wiring/read-model gaps;
5. keep external provider/hardware gates explicit.

---

# 2. Surface map

## A1 — Guest

### Approved prototype
- `/prototype/guest`

### Current production routes
- `/customer/table/[qrToken]`
- `/customer/session/[sessionId]`
- `/customer/session/[sessionId]/menu`
- `/customer/session/[sessionId]/cart`
- `/customer/session/[sessionId]/status`
- `/customer/session/[sessionId]/service`
- `/customer/session/[sessionId]/ai-waiter`

### Confirmed real production behavior
- QR/table session bootstrap.
- customer session state and access-token readiness.
- branch menu query.
- item detail/modifier-aware cart path.
- cart read/add/update/remove/clear/validate.
- idempotency key generation on cart mutations.
- order submission.
- customer status and timeline.
- waiter-call creation/read state.
- bill request/read state.
- online payment intent creation and status handling.
- AI Waiter session/messages.
- AI cart proposal apply/reject.
- AI escalation.
- loading/error/empty handling already exists in production pages.

### Classification
**PARTIALLY PRODUCTION INTEGRATED — behavior strong, visual architecture fragmented.**

### Main integration work
- Promote the approved Guest mobile-native shell and navigation.
- Preserve existing customer session store/readiness/retry/idempotency logic.
- Consolidate the current multi-page flow into the approved Menu / Order / Service / Bill mental model without losing deep routes where they remain useful.
- Preserve explicit payment pending/unknown/succeeded semantics.
- Verify customer realtime/update strategy route-by-route during A1; do not assume all Guest states are realtime-connected merely because staff surfaces are.
- Ensure prototype-only representative data and controls do not enter production.
- Production mock-payment controls must remain governed by existing production safety rules and must not become a normal Guest action.

### Backend gap
No major backend gap identified for the approved Guest jobs in Phase 0.

---

## A2 — Service

### Approved prototype
- `/prototype/service`

### Current production routes
- `/staff/cashier`
- `/staff/waiter`

### Confirmed real production behavior — Cashier
- cashier order queue/detail.
- accept/reject/cancel/complete order.
- branch bill requests.
- acknowledge/present bill request.
- current/open/close cashier shift.
- cash adjustment.
- X-report.
- manual payment.
- staff branch realtime.
- branch-scoped permission gate.

### Confirmed real production behavior — Waiter/Floor
- waiter calls.
- acknowledge/resolve/cancel waiter call.
- branch attention queue.
- table-session attention.
- mute/recalculate/resolve attention.
- ready-to-serve orders.
- serve order.
- staff branch realtime.
- branch-scoped permission gate.

### Classification
**PARTIALLY PRODUCTION INTEGRATED — behavior strong, approved unified Service shell not yet promoted.**

### Main integration work
- Replace the split mental model with one approved Service product surface containing Cashier and Waiter/Floor modes.
- Preserve the existing cashier and waiter query/mutation logic instead of reimplementing it.
- Promote approved Orders / Attention / Bills / Shift layouts.
- Build the approved spatial Floor view from existing floor/table/session/attention truth.
- The current Waiter page does not itself expose a real spatial floor-plan read model; this is a UI/read-model composition gap, not evidence of a missing venue backend.
- Keep payment unknown/review states explicit and fail-safe.
- Preserve current permission boundaries when modes are unified.
- Preserve staff realtime.

### Backend gap
No structural backend gap identified for Orders/Attention/Bills/Shift.
The Floor view may require a composed read model or additional production endpoint usage, but existing branch/floor/table/session/attention capabilities already exist.

---

## A3 — Kitchen

### Approved prototype
- `/prototype/kitchen`

### Current production route
- `/staff/kitchen`

### Confirmed real production behavior
- branch preparation-task queue.
- preparation-task detail.
- start task.
- mark ready.
- cancel task.
- KitchenTicket list/detail data.
- ticket reprint.
- PrintJob list/status/error/printable payload.
- mark print job printed/failed.
- retry print job.
- station/ticket metadata.
- staff branch realtime.
- permission gate for preparation access.

### Classification
**HIGH PRODUCTION BEHAVIOR COVERAGE — visual shell migration required.**

### Main integration work
- Promote approved Kitchen / Barista / Dessert / Expediter presentation.
- Preserve real task/ticket/print mutations and realtime.
- Preserve age/late/modifier/note hierarchy from the approved prototype.
- Keep Expediter as a UI cross-station mode unless backend truth changes; do not invent a new station enum.
- Keep physical printer transport/discovery outside this lane unless already implemented and verified.

### External gate
Physical printer transport/discovery remains **Venue Ops / Hardware** when not backed by a verified adapter/device path.

---

## A4 — Office

### Approved prototype
- `/prototype/office/home`

### Current production routes contributing to Office
- `/staff/owner`
- `/staff/menu`
- `/staff/inventory`
- `/staff/branches`
- `/staff/billing`

### Approved Office domains
- Home
- Operations
- Catalog
- Inventory
- Locations
- Team
- Money
- Insights
- Experience
- Settings

### Current production capability mapping

#### Home
**WIRED**
- `/staff/owner`
- owner analytics dashboard.
- daily report.
- realtime status.

#### Catalog
**WIRED**
- `/staff/menu`
- category/item/modifier CRUD.
- activation/deactivation/reorder relationships.
- item ↔ modifier-group relationships.
- branch overrides.

#### Inventory
**WIRED**
- `/staff/inventory`
- inventory items.
- levels/alerts.
- menu requirements/availability.
- suppliers.
- purchase orders.
- submit/cancel/update.
- receiving.

#### Locations
**WIRED**
- `/staff/branches`
- branches.
- floors.
- tables.
- QR generation/regeneration.
- activation/deactivation.

#### Operations
**PARTIAL / FRAGMENTED**
- owner analytics exposes operational visibility.
- cashier/waiter/kitchen surfaces own live operational mutations.
- approved Office Operations needs an owner/manager investigation/control composition rather than copying Service/Kitchen actions into Office.

#### Team
**PARTIAL**
- staff auth/membership/roles/invites exist in backend.
- onboarding invite flow exists.
- no dedicated ongoing Team management production route was identified in the current web route tree.

#### Money
**PARTIAL / FRAGMENTED**
- owner analytics includes revenue/payment/bill/shift visibility.
- cashier owns operational shift/manual-payment mutations.
- `/staff/billing` is Balcona SaaS account status, not restaurant Money.
- approved Office Money needs a dedicated composition that keeps restaurant money separate from Balcona SaaS billing.

#### Insights
**WIRED FOUNDATION**
- owner analytics provides sales/orders/items/operations/shifts/AI/inventory/payment visibility.
- approved Office Insights can reuse these real read models.

#### Experience
**BACKEND EXISTS / MISSING DEDICATED PRODUCTION UI**
- experience capability exists in backend.
- no dedicated production Office route identified.

#### Settings
**BACKEND EXISTS / MISSING DEDICATED PRODUCTION UI**
- branch operating settings and feature-flag capabilities exist.
- no dedicated production Office settings route identified.

### Classification
**PARTIALLY PRODUCTION INTEGRATED — strongest domain coverage, highest navigation/composition debt.**

### Main integration work
- Promote approved Office shell and domain navigation.
- Reuse existing Menu/Inventory/Branch/Owner pages and data logic under the Office information architecture.
- Add bounded Team / Money / Experience / Settings production UI only where backend truth already exists.
- Do not turn Office into Service or duplicate live POS controls.
- Keep Balcona SaaS billing separate from restaurant financial operations.

---

## A5 — Setup

### Approved prototype
- `/prototype/setup`

### Current production route
- `/staff/setup`

### Confirmed real production behavior
- company onboarding profile.
- branch onboarding profile.
- branch launch checklist.
- readiness checks.
- create onboarding floor.
- bulk create tables.
- QR readiness.
- staff invitation.
- permission-aware company/branch onboarding actions.

### Approved phases
1. Business
2. Locations
3. Menu
4. Tables & QR
5. Team
6. Kitchen / Devices
7. Payments
8. Experience
9. Operations
10. Final readiness

### Classification
**PARTIALLY PRODUCTION INTEGRATED — core onboarding engine is real, approved orchestration is broader than current action wiring.**

### Main integration work
- Promote approved finite 10-phase shell.
- Reuse existing company/branch/floor/table/staff/readiness mutations.
- Connect supported steps to real Catalog, device/station readiness, payment readiness, Experience and Operations truth.
- Where a step depends on another production domain, use a real state/link/action rather than fake setup completion.
- Preserve visible blocked/attention states for external provider and hardware gates.
- Never manufacture a green readiness check.

### External gates
Merchant/provider onboarding and physical hardware can remain **SOFTWARE READY / EXTERNAL GATE**.

---

## A6 — Platform

### Approved prototype
- `/prototype/platform`

### Current production routes
- `/platform`
- `/platform/companies`
- `/platform/companies/[companyId]`
- `/platform/companies/new`
- `/platform/status`
- `/platform/login`

### Confirmed real production behavior
- separate Platform authentication.
- company list.
- company detail.
- plan list.
- company subscription-state update.
- staff invite.
- company/bootstrap creation.
- system info/status.

### Classification
**HIGH PRODUCTION BEHAVIOR COVERAGE — approved Platform shell migration required.**

### Main integration work
- Promote the approved technical/internal Platform shell.
- Preserve platform auth boundary.
- Preserve tenant-centric company/bootstrap/investigation behavior.
- Keep internal subscription state explicitly separate from real recurring SaaS billing.
- Do not expose tenant staff behavior as Platform operations.

### External/future boundary
Real recurring Balcona SaaS billing remains a separate billing program.

---

# 3. Shared integration rules

For every surface:

1. approved visual shell is authoritative;
2. production query/mutation behavior is authoritative;
3. prototype static data is not authoritative;
4. existing auth/session/idempotency/retry/concurrency controls must be preserved;
5. existing realtime must be preserved where already implemented;
6. loading/empty/error/permission-denied states must survive the visual migration;
7. new visible actions require real product/backend truth;
8. payment unknown remains distinct from failure;
9. hardware/provider gates remain explicit;
10. no cross-surface redesign during integration;
11. desktop/mobile/RTL regression required;
12. E2E smoke required before a surface is called PRODUCTION INTEGRATED.

---

# 4. Dependency order

Approved integration sequence:

**Guest → Service → Kitchen → Office → Setup → Platform**

## Why this order

### Guest first
- most complete end-customer path;
- exercises session/menu/cart/order/service/payment/AI contracts;
- establishes the production method for promoting a prototype shell without losing mature behavior.

### Service second
- consumes order/bill/attention state created by Guest;
- unifies two mature production workspaces without rewriting their operational logic.

### Kitchen third
- consumes accepted orders/preparation tasks;
- already has strong real behavior and realtime;
- gives the first full front-to-back operating spine.

### Office fourth
- broadest domain composition;
- should integrate after Guest/Service/Kitchen operating truth is stable.

### Setup fifth
- readiness must point at real production domains, not prototype assumptions.

### Platform last
- internal SaaS control plane can follow once tenant operation is stable.

---

# 5. First implementation slice — A1 Guest

The next bounded engineering PR should be **Guest Production Integration**.

Before code mutation, its branch should re-read the exact production Guest files and approved prototype and preserve:

- customer session store.
- QR/session bootstrap.
- access-token readiness.
- customer transient retry behavior.
- cart mutation idempotency.
- React Query keys/invalidation.
- current menu/cart/order/service/bill/payment/AI endpoints.
- production safety boundaries around mock payment behavior.

Then migrate the approved Guest shell in bounded steps:

1. shell + session header + bottom navigation;
2. menu + categories + item detail;
3. cart + modifiers + notes + validation;
4. order submit + order timeline;
5. service/waiter-call + bill;
6. AI Waiter + proposal + escalation;
7. payment states;
8. loading/empty/error/expired-session/permission-equivalent states;
9. RTL/mobile regression;
10. E2E smoke and manual screenshot review.

No backend rewrite is justified before a concrete missing contract is found.

---

# 6. Parallel lanes — do not mix into A1

## Payments
- PAY-8 remains PR #116 and remains fail-closed behind merchant contract/docs.
- Do not make Guest integration dependent on undocumented Maestr behavior.

## Oracle / Pilot
- Oracle is the current deployment target/runtime.
- Railway is historical only.
- Audit the live Oracle stack separately before changing deployment topology.

## Venue Ops
- printer transport/discovery.
- terminal/SoftPOS.
- weak-internet/device fallback.

## Sales
May proceed in parallel once stable production surfaces and demo tenant are available.

---

# 7. Phase 0 conclusion

**PHASE 0 AUDIT: COMPLETE**

The repository already contains enough real production behavior to begin integration without a new architecture phase.

Next execution:
**A1 — Guest Production Integration**

Gate to close A1:
**approved Guest shell + real Guest behavior + production states + regression + smoke + manual visual review.**
