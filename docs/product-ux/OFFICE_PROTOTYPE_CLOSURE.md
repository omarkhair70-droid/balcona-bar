# Balcona Office Prototype Closure

Status: COMPLETE — PROTOTYPE APPROVED
Date: 2026-08-28
PR: #118
Head: 51d33bc9db9de8cf916269bc11f248609f7c2eff

## What is closed

Balcona Office visual/interaction prototype is complete for the current product-UX phase.

Covered domains:
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

Covered structural behavior:
- All Locations / single-branch scope
- Arabic / RTL
- task-specific sub-navigation
- Home business-at-a-glance
- exception-led attention
- record drill-down drawer
- contextual actions
- domain jumps
- company-default / branch-override concepts where relevant

## Backend coverage

The prototype intentionally maps to real Balcona backend capabilities recorded in:
- BACKEND_FEATURE_REGISTRY.md
- UX_COVERAGE_GAPS.md
- INFORMATION_ARCHITECTURE.md
- SCREEN_BLUEPRINT.md

No unsupported Reservations / CRM / Labor / generic health score modules were introduced.

## Important boundary

This prototype is **not production integration**.

It uses representative static data so that:
- information architecture
- density
- hierarchy
- interaction patterns
- bilingual behavior
- domain coverage

can be reviewed before replacing production Staff UI.

Actual API wiring, mutation behavior, permission enforcement, realtime behavior, and production migration happen in the later implementation waves.

## Visual direction

Office direction is locked:
- Home: Square-style business-at-a-glance clarity
- Deep Office: Lightspeed-style Back Office discipline
- Toast: decision hierarchy
- Oracle: scope/inheritance discipline
- Balcona: product truth and bilingual identity

## Quality gate

Final prototype head passed:
- web lint
- web typecheck
- web production build
- API build
- API tests
- Docker API image
- Docker Web image

Office prototype phase is closed.

Next surface:
**Balcona Service — Cashier + Waiter/Floor**
