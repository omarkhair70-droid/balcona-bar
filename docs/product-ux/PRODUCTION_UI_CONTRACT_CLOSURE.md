# Production UI Contract Closure

Status: ACTIVE IMPLEMENTATION
Base: main @ 30410d45a568fe4dc6362b773c90f490f82eeca9
Branch: fix/production-ui-contract-closure

## Rule

The approved prototype components are the visual and interaction contract.

Production integration may reuse:
- API endpoints;
- query/mutation hooks;
- auth and permission gates;
- realtime behavior;
- domain policies;
- error/loading/empty states.

Production integration must not preserve a legacy page composition when it conflicts with the approved prototype.

## Approved contracts

- Guest: apps/web/features/prototype/guest-prototype.tsx
- Service: apps/web/features/prototype/service-prototype.tsx
- Kitchen: apps/web/features/prototype/kitchen-prototype.tsx
- Office: apps/web/features/prototype/office-home-prototype.tsx
- Setup: apps/web/features/prototype/setup-prototype.tsx
- Platform: apps/web/features/prototype/platform-prototype.tsx

## Closure order

1. Service
   - remove dashboard-style shell drift;
   - keep Floor / Orders / Attention / Bills / Shift;
   - make Cashier Orders task-first;
   - keep real server authority and realtime.

2. Office
   - preserve the approved quiet Back Office shell;
   - remove legacy admin-card composition;
   - restore approved domain/sub-navigation hierarchy;
   - start with Catalog, then Home/Operations/Insights, then Inventory/Locations/Control pages;
   - keep all real backend capabilities.

3. Kitchen
   - verify production board against the approved KDS contract and only fix measurable drift.

4. Setup
   - verify finite readiness journey against approved ten-stage contract.

5. Platform
   - verify internal SaaS control-plane composition against approved contract.

6. Guest
   - regression-only unless a real contract drift is found.

## Route/source-of-truth policy

Canonical routes are the only user-facing product routes:
- /guest/*
- /service/*
- /kitchen
- /office/*
- /setup
- /platform/*

Legacy /staff/* implementation routes may remain only as internal rewrite targets while migration is in progress. They are not a second product design.

Prototype components remain implementation references until parity is closed. Public prototype routes must not become a second live product.

## Definition of done

A surface is not closed merely because it:
- loads;
- has no console errors;
- passes RTL/mobile;
- calls real APIs.

It closes only when:
- canonical production composition matches the approved prototype contract;
- real data/mutations/realtime are preserved;
- no legacy composition is visible as a competing design;
- route interactions do not 404;
- desktop, handheld and RTL pass;
- authenticated live-data timing is exercised for operational actions.
