# Balcona Guest Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
PR: #122
Visual gate run: 33225285224
Evidence artifact: balcona-guest-v1-visual-gate
Artifact digest: sha256:af81855dafab7daa63a0f3b8bee8472df9c8fa9388b4bd9eeae053d3878ab86e

## Closed scope

Balcona Guest V1 is visually closed for the current product-UX prototype phase.

Covered journey:
- table / session context
- Menu default
- category browsing
- featured items
- unavailable item state
- item detail
- modifier selection
- item note
- AI Waiter contextual proposal
- proposal apply
- persistent cart state
- cart review
- order-level note
- order submission
- order status timeline
- waiter request
- bill request
- bill presented
- online payment pending
- payment unknown / needs review
- Arabic / RTL
- desktop containment

## Reference-led acceptance

The visual direction was checked against:
- me&u Order & Pay — hospitality-led discovery / brandable visual menu
- Toast Mobile Order & Pay — table-session continuity / persistent order and pay flow
- Lightspeed Order Anywhere — guest action and payment-state clarity
- Balcona backend/product truth — QR session, cart, order, service, bill, AI and payment states

The V1 passes the required Guest principles:

1. Menu is the default experience, not a feature dashboard.
2. branch/table/session context is visible without becoming a hero.
3. core menu rows scan quickly.
4. Featured content is subordinate to browse.
5. item detail supports modifier, quantity and note patterns.
6. cart supports an order-level note and explicit final submit.
7. AI is contextual and produces an explicit cart proposal rather than hidden mutation.
8. waiter and bill states remain visible to the guest.
9. payment unknown is visually and verbally different from failure and explicitly discourages duplicate payment.
10. Arabic / RTL is natural on the guest surface.
11. the desktop presentation preserves the mobile-native product rather than mutating into an unrelated desktop dashboard.

## Manual visual review

Representative screenshots were reviewed manually at:
- 390×844 primary handheld
- 1440×1000 desktop containment

Reviewed states:
- Menu
- AI proposal
- item detail + modifier + note
- cart review + order note
- submitted order
- ready-to-serve timeline
- active waiter request
- presented bill
- payment unknown
- payment unknown Arabic / RTL
- desktop Menu containment

The first gate also exposed a real accessibility defect:
- visible sheet close buttons had no accessible label while only the backdrop carried `Close`.

The visible Item / Cart / AI close controls now have localized accessible names.

## Media boundary

The repository currently has no committed Guest menu photography and the seeded menu records do not populate `imageUrl`.

The prototype therefore keeps an intentionally abstract branded visual fallback instead of inventing food photography and presenting it as real tenant evidence.

Production integration must:
- render the real backend `imageUrl` / media asset when present;
- retain the fallback only when tenant media is absent;
- preserve the approved menu/image hierarchy.

This media-content boundary does not reopen Guest IA or interaction design.

## Automated quality gate

Final Guest visual gate passed:
- web lint
- web typecheck
- web production build
- category navigation
- availability state
- AI proposal apply
- item modifier + note flow
- cart + order note
- submit → order status
- lifecycle state progression
- waiter request state
- bill request / presented state
- payment pending / unknown
- Arabic / RTL
- desktop containment
- no horizontal page overflow

Existing PR quality also includes:
- API build
- API tests
- Docker API image
- Docker Web image
- Vercel preview readiness on the Guest branch

## Backend truth retained

Visible Guest jobs map to existing Balcona capabilities:
- QR/table sessions
- branch-effective menu
- cart lifecycle
- modifiers and item notes
- order-level customer note
- order submission / status
- waiter calls
- bill requests
- AI Waiter proposals / escalation
- customer online-payment intents and status

## Boundary

This remains a high-fidelity prototype using representative data.

It does not yet replace the production Guest routes or wire the approved visual layer to live API records, mutations and realtime. That belongs to Production Integration.

## Gate decision

**GUEST V1 VISUAL GATE: PASS**

Next surface:
**Balcona Office — PR #118 visual closure gate**
