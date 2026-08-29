# Balcona Setup Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
Surface: Balcona Setup
Branch: ux/setup-prototype
Visual gate run: 33227157944
Evidence artifact: balcona-setup-v1-visual-gate
Artifact digest: sha256:8611830249dcf9a0251175dc3898dad062d45f4533edc8eb418a9a58985f643b

## Closed scope

Balcona Setup V1 is visually closed for the current product-UX prototype phase.

Covered phases:
1. Business
2. Locations
3. Menu
4. Tables & QR
5. Team
6. Kitchen / Devices
7. Payments
8. Experience
9. Operations / Automation
10. Final readiness

Covered behavior:
- finite launch/readiness journey
- branch context
- progress and phase state
- complete / attention / blocked semantics
- Office-domain handoff concepts
- explicit external payment gate
- explicit venue hardware gate
- final GO / NO-GO state
- Arabic / RTL
- desktop
- handheld

## Reference-led acceptance

The locked Setup direction was synthesized from:
- Toast implementation / go-live orchestration
- Square restaurant configuration clarity
- Balcona onboarding/readiness truth

Formula:

**Toast orchestration + Square configuration clarity + Balcona readiness truth**

The result keeps Setup distinct from permanent Office administration.

Primary mental model:

**Get this location live**

## Manual visual review

Representative screenshots were reviewed manually at:
- 1440×1000 desktop
- 390×844 handheld

Reviewed states include:
- Menu readiness
- Tables & QR
- Team coverage
- Kitchen / Devices
- Payments external gate
- Final readiness
- Arabic / RTL
- handheld progress/phase navigation

The visual direction passes:
- guided and finite rather than dashboard-like;
- warmer than Office without becoming Guest;
- progress is visible but not gamified;
- blockers explain why they block;
- the next action remains obvious;
- the payment provider and physical-printer gates are not converted into fake green checks.

## QA findings

The final failed pre-pass was a harness-only issue:
- the test asserted case-sensitive `Launch progress`;
- rendered UI used the visually uppercased `LAUNCH PROGRESS`.

The assertion was normalized without changing the visual implementation.

No unresolved page-level overflow or interaction defect remains in the final gate.

## Automated quality gate

Final Setup visual gate passed:
- web lint
- web typecheck
- web production build
- phase navigation
- launch progress
- Tables & QR
- Team
- Kitchen / Devices
- Payments external gate
- Final NO-GO state
- desktop
- mobile
- Arabic / RTL
- no page-level horizontal overflow

## Backend/product truth retained

Visible Setup jobs map to existing Balcona capability:
- company/branch onboarding readiness
- company/branch profile
- floors
- bulk tables
- QR readiness
- staff role coverage and invites
- menu readiness
- printer/station readiness signals
- operating/service mode
- Smart Cashier/settings signals
- SaaS entitlement/blocker state
- payment-readiness state without exposing provider secrets
- launch checklist / blockers

## External gates remain external

Setup intentionally distinguishes software readiness from external activation:

- live merchant/provider certification remains an external payment gate;
- physical printer transport remains a venue/hardware gate;
- final end-to-end rehearsal remains required before real handoff.

These do not justify reopening Setup IA or visual design.

## Boundary

This remains a high-fidelity prototype using representative readiness data.

Production Integration must wire the approved Setup experience to real onboarding/readiness APIs, mutations, permissions and query state without turning Setup into the permanent admin surface.

Ongoing administration belongs in the owning Office domains.

## Gate decision

**SETUP V1 VISUAL GATE: PASS**

With Guest, Service, Kitchen, Office and Platform also visually approved, the six-surface Balcona UX/UI prototype program is complete.
