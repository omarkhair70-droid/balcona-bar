# Balcona Service Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
PR: #120
Visual gate run: 33223593351
Evidence artifact: balcona-service-v1-visual-gate
Artifact digest: sha256:840472a9d87ac73a56e759241872c319ecda2bb23164495ce15449056da6800c

## Closed scope

Balcona Service V1 is visually closed for the current product-UX prototype phase.

Covered modes:
- Cashier
- Waiter / Floor

Covered workspaces:
- Floor
- Orders
- Attention
- Bills
- Shift

## Evidence-led acceptance

The fresh visual benchmark audit in `SERVICE_VISUAL_BENCHMARK_AUDIT.md` was applied against:
- Toast POS
- Square for Restaurants
- Lightspeed Restaurant POS
- Balcona backend/product truth

The revised V1 now passes the required visual criteria:

1. Floor reads as a restaurant floor rather than an equal-card dashboard.
2. Main Dining / Terrace service areas are switchable.
3. table state and elapsed time are immediately readable.
4. selecting a table exposes supported table/order/bill/attention context.
5. waiter attention is a prioritized operational queue.
6. cashier Orders remain task-first with persistent primary actions.
7. payment-unknown is visually separate and dominant in Bills.
8. shift state is persistent without becoming an Office/back-office surface.
9. Cashier and Waiter remain modes of one Service product.
10. Arabic / RTL remains usable on desktop and mobile.

## Manual visual review

Representative screenshots were reviewed manually at:
- 1440×1000 desktop
- 390×844 handheld

Reviewed states:
- Orders
- Floor / Main Dining
- Floor / Terrace
- Attention
- Bills / payment unknown
- Shift / close blockers
- Waiter mode
- Arabic RTL
- handheld Orders
- handheld Attention
- handheld Floor
- handheld Bills
- handheld Shift
- handheld Arabic RTL

Two bounded visual defects found during the gate were corrected:
- Floor mobile status text no longer truncates the `ATTENTION` state.
- Shift Drawer Adjustment no longer clips the `Cash in` action at desktop width.

No redesign or backend scope was reopened.

## Automated quality gate

Final Service visual gate passed:
- web lint
- web typecheck
- web production build
- Playwright interaction smoke
- desktop/mobile representative states
- service-area switching
- payment-unknown safety state
- shift close-blocker state
- Cashier → Waiter mode switch
- Arabic / RTL
- no horizontal page overflow

Existing PR quality also covers:
- API build
- API tests
- Docker API image
- Docker Web image
- Vercel preview readiness on the evidence-led V1 branch

## Backend truth retained

Visible Service jobs remain mapped to existing Balcona capabilities:
- cashier order lifecycle
- Smart Cashier review state
- waiter calls
- table attention
- computed attention
- ready-to-serve
- AI escalation
- bill requests
- manual payments
- payment unknown / needs review
- cashier shifts
- X reporting
- cash adjustments
- close blockers
- realtime branch context

## Boundary

This remains a high-fidelity prototype using representative data.

It does not yet perform production API mutation wiring, permission integration, realtime production replacement, or Staff UI migration. Those belong to the later production-integration wave.

## Gate decision

**SERVICE V1 VISUAL GATE: PASS**

Next surface:
**Balcona Kitchen — PR #121 visual closure gate**
