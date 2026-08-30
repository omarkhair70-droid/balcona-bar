# S3 — Balcona Service closure

## Branch and source of truth

- Integration base: `codex/full-platform-closure-20260830-1214`
- Verified base SHA at lane start: `d4f275a4b31c09fb71bd1c5439a3a915c2e81ad2`
- Lane: `closure/service-s3`
- Approved visual/product contract: `apps/web/features/prototype/service-prototype.tsx`
- The prototype is preserved unchanged.
- Existing production routes remain `/staff/cashier` and `/staff/waiter`. S3 does not introduce a final `/service` namespace.

## Reference recheck

The S3 pass rechecked current Toast, Lightspeed Restaurant, and Square for Restaurants service/table-management patterns. The applied principles were limited to product behavior, not copied visuals:

- keep the floor/table surface operational and visible during service;
- expose floor/service-area switching;
- make elapsed table time and urgency legible;
- keep order decisions task-first;
- keep attention priority-first;
- keep shift/cash controls available to the cashier;
- preserve handheld usability.

Balcona still does not store authoritative physical x/y table coordinates. The Service floor therefore uses real configured floor grouping, real table order, real session state, and real attention state in an operational map without pretending to be an architectural floor plan.

## Production behavior preserved

S3 keeps the existing production contracts and mutations:

- staff auth/session restore and logout;
- branch-scoped permission gate;
- branch selection;
- branch realtime stream and reconnect state;
- cashier order accept/reject/cancel/complete;
- waiter ready-order serve;
- waiter-call acknowledge/resolve/cancel;
- attention resolve/mute/recalculate/rebuild;
- bill-request acknowledge/present;
- manual bill payment only when a cashier shift is open;
- online payment intents are displayed from provider/backend state and no provider success is synthesized;
- cashier shift open/current state, drawer cash-in/cash-out, X report, close/Z report.

## S3 UI closure

### Floor

`ServiceFloorBoard` now acts as a live service-area map instead of a metric-card grid:

- floor/service-area switching comes from real configured floors;
- table state uses real table/session/attention data;
- active-session elapsed time updates live;
- urgency and maintenance/inactive/free states are distinct;
- selecting any table opens table context;
- selecting an active session also forwards its real session id to the existing attention workflow.

### Orders

Cashier keeps the existing real order queue/detail lifecycle. The page-level metric-card wall was removed in favor of a compact live status strip, leaving the order decision lane as the primary task.

### Attention

The real attention queue is explicitly prioritized client-side by active status, priority, then age while retaining backend attention records and actions.

Waiter remains floor/attention-first, with waiter calls, ready orders, and activity kept as operational follow-through rather than an Office-style module directory.

### Bills and payments

Existing bill-request and manual-payment behavior is preserved. Online payment intents now distinguish:

- succeeded;
- pending / requires action;
- failed / cancelled / expired;
- unknown provider/backend state.

Failed or unknown online payment state is shown as unresolved and never converted into a fake success state.

### Shift

The cashier live status strip now keeps the current shift state visible while the existing full shift panel remains the source for:

- opening float;
- current expected cash and tender totals;
- cash drawer adjustments;
- X report;
- counted cash;
- close and Z report.

## Shared-file changes

The only cross-surface shared files changed by S3 are:

- `apps/web/messages/en.json`
- `apps/web/messages/ar.json`

Changes are additive Service-specific translation keys plus a clarification of the Service floor geometry note. No existing Guest, Kitchen, Office, Setup, Platform, or Marketing key was removed or renamed.

## QA gates

Automated PR gates include:

- repository CI: web lint, typecheck, build; API build/tests; smoke helpers;
- Service Production Visual QA;
- desktop cashier orders/bills/shift;
- desktop waiter floor/attention;
- 390px cashier and waiter;
- Arabic RTL waiter attention;
- staff login and unauthenticated `/staff` route behavior;
- viewport overflow checks.

The production components themselves retain explicit loading/empty/error states, permission denial, realtime reconnect state, problem-payment state, and open/no-open shift states. Existing API tests cover cashier shift lifecycle and online-payment failure/reconciliation behavior.

## Scope exclusions

S3 does not change Kitchen, Office, Setup, Marketing, the final namespace, main, or production deployment.
