# UI Phase 8 Full Demo Hardening + Balkona Demo Mode

## Scope

UI Phase 8 makes the merged customer and staff surfaces presentation-ready for a
single local Balkona operating demo. The phase is frontend and documentation
only. It does not add backend behavior, payment, POS, SaaS admin, tenant admin,
menu admin, fake business metrics, external chart libraries, or new
dependencies.

## Demo Route

- `/demo/balkona` - premium local presentation launcher for the full Balkona
  customer-to-owner demo.

The route exposes:

- demo title and presentation framing
- launch links for customer, staff login, cashier, kitchen/barista, waiter, and owner routes
- local/dev-only staff credentials
- full demo checklist
- proof points for what the demo exercises
- lightweight diagnostics with API base URL, route list, terminal reminder, and command reference

## Shared Demo Constants

`apps/web/features/demo/balkona-demo.ts` is the source of truth for:

- seeded QR token
- demo staff credentials
- route labels and descriptions
- smoke-test checklist
- proof points
- local command reference

Keeping these values in one file prevents route and credential drift across the
launcher, customer entry, docs, and future demo helpers.

## Staff Overview Hardening

`/staff` now behaves as an operations hub instead of a plain route index. It
keeps the existing staff auth store and branch selector, links to all live staff
surfaces, and adds a clear Balkona demo launcher card. It does not add fake
metrics or a new staff-auth path.

## Customer Demo Hardening

The customer entry and session surfaces receive low-risk presentation polish:

- customer entry reuses the shared demo QR token
- customer home cards explain the next real action for menu, AI waiter, cart, status, and service
- empty cart and empty order status states link to the next useful customer route
- existing visible mutation-error handling from the customer PWA remains intact

## Diagnostics

The demo launcher reads `NEXT_PUBLIC_API_BASE_URL` through the existing web env
config and displays it for presenter confidence. The command reference is
documentation only and does not execute Docker, API, or web commands.

## Intentionally Not Included

- backend behavior changes
- Docker or dev-server execution from the UI
- payment or POS
- SaaS admin, tenant admin, company admin, or menu admin UI
- kitchen/barista, waiter, cashier, or owner scope expansion beyond hardening
- fake orders, fake revenue, fake analytics, or charting dependencies
- new dependencies

## Validation

Required validation for this phase:

```powershell
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```
