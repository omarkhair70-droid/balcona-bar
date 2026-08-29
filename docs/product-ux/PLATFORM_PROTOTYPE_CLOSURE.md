# Balcona Platform Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
Surface: Balcona Platform
Branch: ux/platform-prototype
Visual gate run: 33226099151
Evidence artifact: balcona-platform-v1-visual-gate
Artifact digest: sha256:934b474a7ef7cdd5510fbc63a4fb50bb349b5dab0c8c6227896a2bdf40d7da80

## Closed scope

Balcona Platform V1 is visually closed for the current product-UX prototype phase.

Covered surfaces:
- Dashboard
- Companies
- Company investigation drawer
- New Cafe / Bootstrap
- Plans & Subscriptions
- System Status
- Arabic / RTL
- desktop
- handheld

## Reference-led acceptance

The Platform direction uses:
- Balcona Office primitives for calm data density and investigation patterns;
- enterprise/property separation for platform vs tenant context;
- current Balcona Platform backend truth for auth, tenant bootstrap, plans, subscription state, starter branch/tables/QR, owner handoff, system status and audit-aware actions.

Platform passes the intended identity:

**internal SaaS operations — precise, technical, tenant-oriented, restrained**

It is not:
- tenant Office;
- cafe operations;
- a public signup product;
- a CRM;
- a fake recurring-billing dashboard.

## Manual visual review

Representative screenshots were reviewed manually at:
- 1440×1000 desktop
- 390×844 handheld

Reviewed states:
- Dashboard
- tenant attention
- Companies registry
- company detail drawer
- New Cafe / Bootstrap
- Plans
- System Status
- Arabic / RTL
- mobile company drawer
- mobile bootstrap

The visual hierarchy keeps platform identity distinct from restaurant operations. Dense company state is scannable, suspension/past-due states remain explicit, and mobile navigation collapses to a compact horizontal rail instead of dumping the desktop sidebar.

## Automated quality gate

Final Platform visual gate passed:
- web lint
- web typecheck
- web production build
- dashboard
- tenant attention
- company investigation drawer
- companies list
- bootstrap flow
- plans boundary
- system status
- desktop
- mobile
- Arabic / RTL
- no page-level horizontal overflow

## Product truth retained

Visible Platform jobs map to existing Balcona capabilities:
- separate PlatformAdmin auth/session model
- company list/detail
- cafe bootstrap
- first branch
- owner/staff handoff
- starter tables/QR
- SaaS plans
- internal subscription status/entitlements
- system info/status
- platform audit context

## Boundary

This remains a high-fidelity prototype using representative data.

Production integration must wire the approved shell to real Platform APIs, permissions, mutations, status and audit data without:
- exposing secrets;
- impersonating restaurant staff;
- mixing cafe customer money with Balcona SaaS subscription state;
- claiming a real recurring billing provider exists before BILL-1 is implemented.

## Gate decision

**PLATFORM V1 VISUAL GATE: PASS**

After Setup closure, the six-surface UX/UI prototype program is complete:
Guest / Service / Kitchen / Office / Setup / Platform.
