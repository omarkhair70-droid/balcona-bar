# R4 — Backend ↔ Frontend Coverage Gap Map

Status: COMPLETE
Audit date: 2026-08-28
Inputs:
- R2 `BALCONA_SURFACE_REGISTRY.md`
- R3 `BACKEND_FEATURE_REGISTRY.md`

## Classification

- **Strong** — current surface maps clearly to the backend job and exposes the core workflow.
- **Weak / compressed** — capability is exposed, but too many jobs are compressed into one route or important backend depth is not represented.
- **Missing dedicated surface** — meaningful backend capability has no obvious user-facing home.
- **Misplaced** — capability is visible but currently lives in the wrong product/navigation context.
- **Duplicated / overlapping** — multiple surfaces expose the same setup/administration responsibility without a clear ownership boundary.
- **Embedded by design** — capability should remain contextual rather than become its own navigation destination.
- **Internal** — infrastructure/technical capability should not become tenant product navigation.

---

## Coverage matrix

| Capability family | Backend depth | Current UI | Coverage | R4 finding |
|---|---|---|---|---|
| QR/table-session bootstrap | high | Guest QR/session | Strong | Preserve journey foundation |
| Guest menu | high | Guest Menu | Strong | Visual/product redesign later, not missing capability |
| Guest cart | high | Guest Cart | Strong | Preserve explicit validation/submit state |
| Guest order status/timeline | medium/high | Guest Status | Strong | Good dedicated mental model |
| Guest waiter calls | medium | Guest Service | Strong/embedded | Contextually appropriate |
| Guest bill request | high | Guest Service | Weak/compressed | End-of-meal flow is larger than Service label implies |
| Guest online payment | very high backend | Guest Service | Weak/compressed | Customer initiation exists; financial lifecycle far exceeds guest screen |
| AI Waiter | high | separate Guest AI page | Weak/context gap | Functional, but intelligence is isolated from menu discovery |
| Cashier order lifecycle | high | Cashier | Strong | Dedicated high-frequency workspace exists |
| Bill presentation/manual payment | high | Cashier | Strong | Correct operational context |
| Cashier shifts/cash drawer/X/Z | high | Cashier | Weak/compressed | Shift-close is a workflow family inside one operational route |
| Smart Cashier | high | no dedicated configuration | Missing dedicated surface | Automation/rules are effectively hidden |
| Preparation tasks | high | Kitchen Tasks | Strong | Dedicated operational mode exists |
| Kitchen tickets | high | Kitchen Tickets | Strong | Dedicated operational mode exists |
| Print jobs | high | Kitchen Print | Weak/misplaced | Live exceptions fit; administration does not |
| Printer stations/devices | medium/high | no dedicated admin | Missing dedicated surface | Needs device/station ownership later |
| Waiter calls | high | Waiter | Strong | Dedicated operational queue |
| Table attention/autopilot | high | Waiter | Strong but hidden identity | Backend is an attention engine, not merely waiter UI |
| Menu catalog admin | very high | Menu Admin | Strong but compressed | Functional breadth is real; IA inside route needs decomposition |
| Branch item overrides | high | Menu Availability | Strong | Valuable multi-location foundation |
| Inventory levels/alerts | high | Inventory | Strong but compressed | Good capability, poor domain separation |
| Menu stock grounding | high | Inventory | Strong/embedded | Correct cross-domain relationship |
| Suppliers | medium/high | Inventory | Weak/compressed | Procurement hidden inside Inventory |
| Purchase orders | high | Inventory | Weak/compressed | Real workflow buried in mega-route |
| Receiving/receipts | high | Inventory | Weak/compressed | Real workflow buried in mega-route |
| Branch/floor/table/QR maintenance | high | Branches | Strong but compressed | Dedicated route exists, too many subdomains |
| Active table sessions | medium | Branches | Weak/misplaced | Operational/live concept mixed into location admin |
| Setup/readiness | high | Setup | Strong capability / misplaced nav | Setup should orchestrate, not remain equal to daily work |
| SaaS plan/entitlements | high | Billing | Strong capability / misplaced nav | Belongs to account/plan context, not restaurant operations |
| Platform tenant bootstrap | high | Platform | Strong | Preserve product separation |
| Platform subscription control | medium/high | Platform company detail | Strong | Correct platform context |
| Staff authentication | high | Staff auth | Strong | Preserve |
| Staff invites | medium/high | Setup/Platform/invite route | Overlapping | Creation has multiple contexts; acceptance is clear |
| Ongoing staff/team management | high schema/access model | no dedicated Team route | Missing dedicated surface | Staff should not be setup-only |
| Branch operating settings | medium/high | no dedicated route | Missing dedicated surface | Likely Settings/Operations config |
| Branch feature flags | medium/high | no dedicated route | Missing dedicated surface | Likely advanced configuration |
| Venue zones | medium | no dedicated route | Missing dedicated surface | Likely Locations/Experience depending job |
| Owner analytics | very high | Owner | Strong but narrow IA | Dedicated analytics exists; role name is not ideal Back Office IA |
| General analytics | medium/high | no dedicated route | Missing/overlapping | Needs synthesis with Owner analytics |
| Audit logs | medium/high | no dedicated route | Missing dedicated surface | Likely advanced Operations/Security/Activity |
| Online payment operations | very high | no Money workspace | Missing dedicated surface | Major mismatch |
| Settlement/reconciliation | very high | no Money workspace | Missing dedicated surface | Major mismatch |
| Refund/void/capture/recovery | very high | no dedicated operator UI | Missing dedicated surface | Some may be finance/admin only |
| Experience profiles/packs | high | no dedicated admin | Missing dedicated surface | Existing guest experience system is invisible |
| Content blocks | high | no dedicated admin | Missing dedicated surface | CMS-like capability hidden |
| Notification templates | medium/high | no dedicated admin | Missing dedicated surface | Messaging configuration hidden |
| Media assets/usages | high | no media library | Missing dedicated surface | Reusable asset system hidden |
| Presence notifications | high | embedded | Embedded/weak admin | Runtime behavior can stay embedded; templates/history need context |
| Realtime events | infrastructure | embedded | Internal | Do not create tenant navigation |
| Jobs/queue health | infrastructure | Platform/system | Internal | Platform/ops only |
| Health/system info | infrastructure | Platform Status | Strong/internal | Correct context |
| Smoke tooling | infrastructure | none | Internal | Never productize |

---

## Highest-severity coverage gaps

### G1 — Money / Finance is missing as a product surface

Backend already includes:
- branch online payment listing
- payment intent detail
- refund
- void
- capture
- recovery
- provider reconciliation
- settlement import
- reconciliation runs
- reconciliation entries/issues
- issue acknowledge/resolve
- settlement batches

Current visible product:
- Guest can initiate online payment.
- Cashier can settle manually.
- No coherent Back Office Money surface represents the financial operations backend.

Severity: **Critical product-visibility gap**

R7 implication:
Test a dedicated Money/Finance domain with operational payments, transactions, settlements, reconciliation, and issues.

### G2 — Experience / Content system is almost invisible

Backend already includes:
- Experience Profiles
- effective branch experience
- experience packs
- Content Blocks
- Notification Templates
- Media Assets and usages
- Venue Zones
- Presence/Notifications

Current visible product:
- Guest consumes some effective experience.
- No coherent management surface exposes the system.

Severity: **High**

R7 implication:
Test an Experience / Guest Experience / Content workspace rather than scattering these settings.

### G3 — Smart Cashier automation is hidden

Backend includes:
- mode/settings
- evaluate
- attempt auto-accept
- review rules
- rule scopes
- manual review reason codes
- enable/disable lifecycle

Current visible product:
- Cashier experiences order results.
- No dedicated automation/rules configuration was found.

Severity: **High**

R7 implication:
Test Automation / Smart Operations configuration, likely manager-only.

### G4 — Team management stops at onboarding

Backend has:
- StaffUser
- StaffMembership
- roles
- company/branch access
- sessions
- invitations
- permission checks

Current visible product:
- invite during Setup
- login/access
- no clear ongoing People/Team workspace

Severity: **High**

R7 implication:
Test Team / People as a Back Office domain.

### G5 — Device/printer management is incomplete visually

Backend includes:
- PrinterStation create/update/disable/test
- print job lifecycle
- KDS/preparation stations

Current visible product:
- Kitchen sees print queue/retries.
- no dedicated device/station administration route.

Severity: **Medium/High**

R7 implication:
Separate live production exception handling from Hardware / Devices configuration.

### G6 — Branch settings are hidden

Backend:
- operating settings
- operating modes
- service modes
- feature flags

Current visible product:
- no obvious dedicated route.

Severity: **High**

R7 implication:
Settings must become structured and scope-aware, not a miscellaneous dumping ground.

---

## Highest-severity placement problems

### P1 — Flat Staff navigation

Current siblings mix:
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

This combines:
- operational workspaces
- admin domains
- SaaS account management
- onboarding
- role labels

Classification: **Structural IA problem**

### P2 — SaaS Billing inside cafe operations

`/staff/billing` is about Balcona plan/usage/entitlements.

Classification: **Misplaced**

Likely future home:
Account / Plan & Billing, visible only to authorized tenant administrators.

### P3 — Setup as permanent daily navigation

Setup has legitimate functionality but belongs to implementation/readiness.

Classification: **Misplaced**

Likely future behavior:
persistent readiness access when incomplete; secondary setup/settings access after go-live.

### P4 — Owner as a navigation domain

Owner is a role, while the backend capabilities are analytics/reports/operations/finance.

Classification: **Misnamed / role-based IA**

### P5 — Active Sessions inside Branch Administration

Active sessions are live operations; Branches is configuration/location administration.

Classification: **Mixed frequency/context**

---

## Overlap map

### Setup ↔ Branches
Both can affect floors/tables/QR.

Proposed ownership principle for R7:
- Setup = guided completion
- Locations = ongoing administration

### Menu Availability ↔ Inventory Availability
Menu manages sellability/override.
Inventory computes stock-grounded availability.

Proposed ownership principle:
- Catalog owns intentional selling state.
- Inventory owns stock truth and shortage effects.
- UI should explain the source of unavailability.

### Setup Invites ↔ Platform Invites
Both can create staff invitations in different onboarding contexts.

Proposed ownership principle:
- Platform creates initial tenant/owner access during sales-led bootstrap.
- Tenant Team/Setup owns internal staff onboarding afterward.

### Waiter Calls ↔ Autopilot Attention
Waiter calls are explicit guest requests.
Attention is computed operational risk/need.

Proposed ownership principle:
One operational attention workspace may merge the queues visually while preserving reason/source.

---

## Embedded-by-design candidates

Do not create top-level navigation merely because the backend exists:

- realtime event transport
- customer-status aggregation
- QR token resolution
- provider webhooks
- payment recovery jobs
- notification delivery transport
- cart validation
- menu stock grounding
- order lifecycle policies

These belong inside user jobs and system behavior.

---

## R4 product truth

The current frontend does **not** represent the backend as a coherent hospitality operating system.

It represents a subset of the backend as:
- a Guest QR app,
- a flat Staff launcher,
- several mega-routes,
- and a separate Platform admin.

The backend already supports enough domain depth to justify a new IA built around:
- operating workspaces
- Back Office domains
- multi-location scope
- Money/Finance
- Experience/Content
- Team
- Automation
- Devices
- Setup/readiness

The exact final structure remains unapproved until R5 and R6 establish who does each job and how often.

## R4 completion gate

R4 status: COMPLETE

Completed:
- backend↔surface coverage classification
- major missing dedicated surfaces identified
- misplaced surfaces identified
- overlap/duplication boundaries identified
- embedded/internal capabilities separated from product-navigation candidates
- highest-severity gaps ranked

Next:
R5 — Role / Job Map.
