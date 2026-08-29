# Balcona Product UX / IA Overhaul

Status: R1-R11 COMPLETE / NO PRODUCTION UI CHANGES
Branch: `ux/product-ia-overhaul`
Baseline: `main@d9ea1b4f41a682c521af84200d36e4c657bed6e7`

## Goal

Rebuild Balcona's product experience around the actual scale of the system without removing backend capability or redesigning screens feature-by-feature in isolation.

Balcona is treated here as a multi-location hospitality operating system with distinct customer, service, kitchen, management, and platform surfaces.

## Non-negotiable rules

1. Do not remove backend behavior because it is difficult to expose in UI.
2. Do not redesign production screens before the surface and feature audits are complete.
3. Do not copy one competitor visually. Every adopted pattern must solve a documented Balcona problem.
4. Separate operational workspaces from back-office administration.
5. Treat the guest cafe experience as a flagship surface, not as a secondary menu page.
6. Location/company scope, roles, frequency, and device context must be explicit in IA decisions.
7. A backend capability with missing or weak frontend coverage must be recorded before any implementation.
8. Setup/onboarding is an orchestration layer, not another permanent peer page in daily navigation.
9. SaaS/platform administration is separate from tenant restaurant operations.
10. Implementation starts only after evidence-backed IA and screen architecture exist.

## Research tracks

- Back Office / HQ
- POS / Cashier / Service
- KDS / Kitchen / Barista
- Guest Cafe Experience
- Onboarding / Implementation
- Multi-location / Enterprise
- Money / Payments / Reconciliation
- Inventory / Procurement
- Owner / Analytics
- Roles / Permissions / Device modes

## Phase plan

### R1 — Competitive Research ✅ COMPLETE
Build an evidence matrix from official product/support documentation and current UI references. Capture navigation, task flows, scope models, device modes, onboarding, guest flow, and density patterns.

Deliverables:
- `REFERENCE_MATRIX.md`
- reference source ledger
- initial pattern library

### R2 — Balcona Full Surface Audit ✅ COMPLETE
Inventory every current route, page, tab, modal, drawer, primary action, secondary action, and role gate across customer, staff, platform, and demo surfaces.

Deliverable:
- `BALCONA_SURFACE_REGISTRY.md`

### R3 — Backend Feature Registry ✅ COMPLETE
Inventory controllers, services, Prisma models/enums, jobs, permissions, realtime events, and major domain capabilities. Do not rely only on README phase notes.

Deliverable:
- `BACKEND_FEATURE_REGISTRY.md`

### R4 — Coverage Gap ✅ COMPLETE
Map backend capability to frontend exposure and classify each as:
- strong coverage
- weak coverage
- missing surface
- misplaced surface
- duplicated UX
- internal-only by design

Deliverable:
- `UX_COVERAGE_GAPS.md`

### R5 — Role / Job Map ✅ COMPLETE
Define jobs-to-be-done for owner/HQ, operations manager, branch manager, cashier, waiter/server, kitchen, barista, menu admin, inventory/procurement, finance, platform admin, and guest.

Deliverable:
- `ROLE_JOB_MAP.md`

### R6 — Task / Frequency Map ✅ COMPLETE
Classify tasks by context:
- every minute
- every shift
- daily
- weekly
- setup once
- rare exception/emergency

Use frequency to control navigation prominence and information density.

Deliverable:
- `TASK_FREQUENCY_MAP.md`

### R7 — Information Architecture ✅ COMPLETE
Define the final workspace model, global scope controls, location hierarchy, navigation, account/settings split, and progressive disclosure rules.

Deliverable:
- `INFORMATION_ARCHITECTURE.md`

### R8 — Reference Synthesis ✅ COMPLETE
For every important Balcona IA/UX decision record:
- Balcona problem
- competitor evidence
- competing approaches
- chosen pattern
- rejected pattern
- reason

Deliverable:
- `REFERENCE_SYNTHESIS.md`

### R9 — UX System ✅ COMPLETE
Define product-level behavior for:
- navigation
- command/search
- breadcrumbs
- location scope
- tables/lists
- filters
- bulk actions
- forms
- modals/drawers/pages
- destructive actions
- realtime alerts
- empty/loading/error states
- permissions
- audit visibility
- desktop/touch/mobile density

Deliverable:
- `UX_SYSTEM.md`

### R10 — Screen Architecture ✅ COMPLETE
Blueprint every required surface before visual styling. Each screen must state user, job, device, scope, data, primary action, states, backend capabilities, and reference evidence.

Deliverable:
- `SCREEN_BLUEPRINT.md`

### R11 — Visual Direction ✅ COMPLETE
Define the visual system after IA and screen architecture. Preserve useful Balcona identity but stop forcing one decorative dashboard treatment onto guest, cashier, kitchen, and back-office workflows.

Deliverable:
- `DESIGN_DIRECTION.md`

## Implementation boundary

Implementation is a separate phase after R1-R11. It must be split into bounded PRs by shell/workspace and workflow. The current research branch must not change backend business behavior.


## Phase closure

R1-R11 are complete.

Approved outputs:
- evidence-backed competitive reference matrix
- complete current surface audit
- backend capability registry
- backend↔frontend coverage gap map
- role/job map
- task-frequency map
- new product information architecture
- competitor-reference synthesis
- cross-surface UX system
- screen architecture
- visual direction

No production UI or backend business behavior was changed.

The next phase is implementation/prototyping. It must begin from the approved IA and screen blueprint rather than patching the existing flat Staff shell screen-by-screen.
