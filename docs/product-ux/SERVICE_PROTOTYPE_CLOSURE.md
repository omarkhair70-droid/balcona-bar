# Balcona Service Prototype Closure

Status: SUPERSEDED — V0 CLOSURE REOPENED FOR VISUAL AUDIT
Date: 2026-08-28
PR: #120
Head: 82f31ee30828cb2cf6d9c2892a5bbef83e066972

## What is closed

Balcona Service visual/interaction prototype is complete for the current product-UX phase.

Covered modes:
- Cashier
- Waiter / Floor

Covered workspaces:
- Floor
- Orders
- Attention
- Bills
- Shift

Covered interaction proof:
- task-oriented navigation
- order queue + selected detail/action area
- waiter calls
- computed attention
- ready-to-serve
- AI escalation
- bill request / present / manual-payment state
- payment unknown / needs-review safety
- shift open
- cash adjustment
- X report
- close blockers
- Arabic / RTL

## Backend coverage

Prototype jobs map to existing Balcona backend capabilities:
- cashier order lifecycle
- Smart Cashier review state
- waiter calls
- table attention
- ready-to-serve
- bill requests
- bills/manual payments
- cashier shifts and X/Z reporting

## Important boundary

This prototype is not production integration.

It uses representative static data so information hierarchy, live-service flow, touch density, mode separation, and bilingual behavior can be approved before production migration.

Actual API mutation wiring, permissions, realtime behavior, and production Staff UI replacement happen in implementation waves.

## Quality gate

Final Service head passed:
- web lint
- web typecheck
- web production build
- API build
- API tests
- Docker API image
- Docker Web image

Service prototype phase is closed.

Next surface:
**Balcona Kitchen — KDS / Barista / Expediter**


## Supersession note

The original Service V0 closure is superseded by the fresh visual benchmark audit:
- `docs/product-ux/SERVICE_VISUAL_BENCHMARK_AUDIT.md`

Service has been revised to Evidence-led V1 and remains visually open until Omar reviews the new prototype.

Do not treat this older closure record as current visual approval.
