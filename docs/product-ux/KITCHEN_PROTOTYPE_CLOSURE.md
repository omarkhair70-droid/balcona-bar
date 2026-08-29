# Balcona Kitchen Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
PR: #121
Visual gate run: 33223964844
Evidence artifact: balcona-kitchen-v1-visual-gate
Artifact digest: sha256:dc54c23ce3235de134773c0f8cf9ff38cc1016dd297f5e52f07288d895080049

## Closed scope

Balcona Kitchen V1 is visually closed for the current product-UX prototype phase.

Covered station modes:
- Kitchen
- Barista
- Dessert
- Expediter cross-station mode

Covered work modes:
- Board
- Tickets
- Print

## Reference-led acceptance

The locked reference stack was applied against:
- Toast KDS — ticket readability / age dominance / low chrome
- Square KDS — station clarity / touch-first operations
- Lightspeed KDS — production-station responsibility
- Balcona backend truth — PreparationTask, KitchenTicket and PrintJob lifecycle

The V1 passes the required visual criteria:

1. station identity is obvious immediately;
2. oldest and late work are visible without reading every ticket;
3. one tap advances preparation state;
4. modifiers and notes remain visually dominant enough to avoid missed preparation instructions;
5. ticket snapshots remain highly scannable;
6. print failure/retry is visible without overwhelming normal production;
7. Expediter can view cross-station work;
8. Arabic / RTL remains readable;
9. no Office or Service shell leaks into Kitchen;
10. all visible prototype actions map to existing backend behavior.

## Manual visual review

Representative screenshots were reviewed manually at:
- 1440×1000 desktop
- 390×844 handheld

Reviewed states:
- Kitchen production board
- board after task start
- Barista board
- Expediter board
- Expediter tickets
- print failure
- print retry
- Arabic RTL
- handheld board
- handheld tickets
- handheld print
- handheld Arabic RTL

A real handheld defect was found during this gate:
- the Board / Tickets / Print + oldest-active row forced a 390px viewport to 408px.

The navigation was changed to a two-row handheld layout while preserving the desktop composition. The final gate reports no horizontal page overflow.

## Automated quality gate

Final Kitchen visual gate passed:
- web lint
- web typecheck
- web production build
- task state transition smoke
- Kitchen / Barista / Dessert / Expediter station switching
- Tickets
- failed Print state
- Retry transition
- Arabic / RTL
- representative desktop/mobile states
- no horizontal page overflow

Existing PR quality also includes:
- API build
- API tests
- Docker API image
- Docker Web image

## Backend truth retained

Visible Kitchen jobs remain mapped to:
- PreparationTask lifecycle
- station-scoped production work
- KitchenTicket snapshots
- kitchen / barista / dessert routing
- PrintJob lifecycle
- reprint / retry
- branch realtime context

## Boundary

This remains a high-fidelity prototype using representative data.

It does not yet replace production Kitchen UI, wire production mutations, connect physical ESC/POS printers, add printer discovery, or change backend station contracts. Those belong to the later production-integration / venue-ops waves.

## Gate decision

**KITCHEN V1 VISUAL GATE: PASS**

Next surface:
**Balcona Guest — PR #122 visual closure gate**
