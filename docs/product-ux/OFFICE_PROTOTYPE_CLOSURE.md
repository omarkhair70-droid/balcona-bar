# Balcona Office Prototype Closure

Status: EVIDENCE-LED V1 — VISUAL GATE PASSED
Date: 2026-08-29
PR: #118
Visual gate run: 33225896086
Evidence artifact: balcona-office-v1-visual-gate
Artifact digest: sha256:567a526e1e2217f5148edb2520d01526ed3244473dea399d8797a00979296ddc

## Closed scope

Balcona Office V1 is visually closed for the current product-UX prototype phase.

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
- All Locations / branch scope
- domain navigation
- deep sub-navigation
- data tables
- metric bands
- exception-first Home
- record investigation drawer
- Arabic / RTL
- desktop-first layout
- handheld containment with internal dense-table scrolling

## Reference-led acceptance

The locked Office direction was applied against:
- Lightspeed Back Office — domain structure and business-grade density
- Toast management/reporting — high-level decision hierarchy and multi-location management
- Square Dashboard / Restaurants — interaction and reporting clarity
- Oracle Simphony — enterprise/property scope and inheritance thinking
- Balcona product truth — operations, catalog, inventory, money, analytics, experience and settings

Office passes the intended direction:

**business-grade Back Office — calm, dense, professional, analytical, operationally credible, visually quiet**

It is not a role dashboard and it is not a colorful generic SaaS template.

## Manual visual review

Representative screenshots were reviewed manually at:
- 1440×1000 desktop
- 390×844 handheld

Reviewed states include:
- company Home
- branch Home
- Operations / Orders
- Operations / Attention
- Catalog / Availability
- Inventory / Stock
- Inventory / Purchase Orders
- Inventory / Receiving
- Locations / Floors & Tables
- Team / Roles & Access
- Money / Overview
- Money / Reconciliation
- Money / Issues
- Insights / Sales
- Experience / AI Waiter
- Settings / Branch Operations
- Arabic Settings
- handheld Home
- handheld Money / Issues
- handheld record drawer
- handheld Arabic Money

## Defects found and corrected during closure

Manual review rejected the original handheld containment even though the first automated gate was green:

1. The desktop domain sidebar stacked all ten domains vertically before the content on a 390px screen.
2. The first compact-rail fix exposed a real CSS min-content containment bug and expanded the page from 390px to 1162px.

Final correction:
- handheld Office uses a compact horizontally scrollable domain rail;
- desktop retains the 220px domain sidebar;
- outer grid, rail and aside are explicitly min-width constrained;
- dense business tables scroll internally;
- the page itself no longer horizontally overflows;
- record drawer close control has a localized accessible name.

This is why manual screenshot review remains a mandatory gate after automated QA.

## Automated quality gate

Final Office visual gate passed:
- web lint
- web typecheck
- web production build
- company/branch scope switch
- desktop search entry
- Operations states
- record detail drawer
- Catalog availability
- Inventory stock / purchase orders / receiving
- Locations / floors & tables
- Team roles
- Money overview / reconciliation / issues
- Insights
- Experience
- Settings
- Arabic / RTL
- handheld containment
- internal dense-table scrolling
- handheld drawer
- no page-level horizontal overflow

Existing PR quality also includes:
- API build
- API tests
- Docker API image
- Docker Web image

## Product boundary

This remains a high-fidelity prototype with representative data.

Production integration must wire the approved Office shell and domain hierarchy to the real branch/company APIs, permissions, mutations, query state and realtime behavior without reopening visual architecture.

## Gate decision

**OFFICE V1 VISUAL GATE: PASS**

Next surface:
**Balcona Setup — ux/setup-prototype**
