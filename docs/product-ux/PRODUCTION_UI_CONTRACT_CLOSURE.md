# Balcona Service UI Contract Closure

Status: ACTIVE IMPLEMENTATION
Base: main @ 30410d45a568fe4dc6362b773c90f490f82eeca9
Branch: fix/production-ui-contract-closure

## Current scope

Only **Service** receives a full UI-contract correction in this closure.

Office is frozen visually for now. Only reproducible 404 / broken-navigation defects may be changed there.

Guest, Kitchen, Setup, and Platform are regression-only unless a Service change breaks them.

## Service source of truth

Approved contract:

`apps/web/features/prototype/service-prototype.tsx`

Production may reuse:
- API endpoints;
- query/mutation hooks;
- auth and permission gates;
- branch scoping;
- realtime behavior;
- domain policies;
- payment truth;
- error/loading/empty states.

Production must not preserve legacy Cashier/Waiter page composition where that composition conflicts with the approved Service prototype.

## Service closure requirements

Production Service must retain the approved mental model:

- Floor
- Orders
- Attention
- Bills
- Shift

Cashier and Waiter/Floor remain operating modes inside one Service product.

The production surface must be task-first rather than dashboard-first.

Order, bill, shift, waiter, attention, and payment actions remain server-authoritative unless the domain already supports a safe optimistic interaction.

## Office boundary

No broad Office redesign in this closure.

Allowed Office changes:
- exact broken links;
- exact canonical-route mistakes;
- exact controls that lead to 404;
- regression fixes caused by Service changes.

Not allowed:
- Home redesign;
- Catalog visual redesign;
- Inventory redesign;
- Locations redesign;
- Control-plane redesign.

## Canonical routes

User-facing Service routes:
- /service/cashier
- /service/waiter

Legacy /staff/cashier and /staff/waiter remain internal rewrite targets only.

## Definition of done

Service is closed only when:
- production composition matches the approved Service prototype;
- real API/mutation/realtime behavior is preserved;
- Cashier and Waiter/Floor work with authenticated live data;
- desktop, handheld, and RTL pass;
- no Service navigation produces 404;
- Accept / reject / serve / bill / shift actions provide immediate local feedback and reconcile with server truth;
- Guest, Kitchen, Office, Setup, and Platform regressions remain green.

Office 404 work closes only when the exact broken navigation is reproduced and fixed without reopening Office design.
