# Balcona Guest Prototype Closure

Status: COMPLETE — VISUALLY APPROVED
Date: 2026-08-28
PR: #122
Head: ccd76e7781fa74ed73ab62fc4b3f6ce5e4de681e

## Evidence standard

Guest V1 was rebuilt after a fresh screen-by-screen visual benchmark pass using official/public product evidence from:
- me&u Order & Pay
- Toast Mobile Order & Pay
- Lightspeed Order Anywhere

The evidence pass is documented in:
- docs/product-ux/GUEST_VISUAL_BENCHMARK_AUDIT.md

## What is visually closed

- compact venue / branch / table context
- menu-first guest experience
- sticky category navigation
- supported Featured section
- scan-friendly menu rows
- item detail
- quantity
- modifiers
- item special instructions
- persistent cart CTA
- cart review
- order-level note
- order submission
- order status timeline
- waiter/service request
- bill request
- contextual AI Waiter
- explicit AI cart proposal apply/reject
- AI → human escalation
- online payment states
- payment unknown distinct from failed
- Arabic / RTL

## Backend truth

Visible jobs map to existing Balcona capabilities:
- QR/table sessions
- branch-effective menu
- cart lifecycle
- modifier selections
- item notes
- order-level customer note
- order submission/status
- waiter calls
- bill requests
- AI Waiter proposals/escalation
- customer online-payment intents

## Quality gate

Final approved Guest V1 passed:
- web lint
- web typecheck
- web production build
- API build
- API tests
- Docker API image
- Docker Web image
- Vercel preview READY

## Boundary

This remains a high-fidelity prototype.
Production API wiring, real data, mutations, permissions, realtime and production migration are later implementation work.

Next audit:
**Balcona Service — fresh visual benchmark pass**
