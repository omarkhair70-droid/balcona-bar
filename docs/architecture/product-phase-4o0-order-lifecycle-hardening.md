# Product Phase 4O.0 - Order Lifecycle Hardening

## Goal

Product Phase 4O.0 makes order lifecycle transitions explicit and consistent
across cashier, preparation, waiter, customer status, and realtime surfaces.
Staff permissions decide who may attempt an operation; the lifecycle policy now
decides whether the order is in a state where that operation is valid.

This phase does not add payment, online checkout, POS, split bills, tenant
onboarding, AI order submission, or new SaaS admin surfaces.

## Why Permissions Alone Were Not Enough

Before this phase, staff permissions protected endpoints, but order state rules
were distributed across services. A user with the right permission could still
hit a valid endpoint at the wrong lifecycle moment, such as serving an order
before preparation was ready or completing an order before it was served.

Phase 4O.0 centralizes the state machine in
`apps/api/src/orders/order-lifecycle.policy.ts`. Services still own their
domain work, but they call the shared policy before mutating an order.

## Lifecycle State Machine

The normal order path is:

```text
submitted -> cashier_accepted -> preparing -> ready -> served -> completed
```

Terminal states:

```text
cashier_rejected
cancelled
completed
```

Allowed staff-facing actions:

- `accept`: `submitted -> cashier_accepted`
- `reject`: `submitted -> cashier_rejected`
- `start_preparation`: `cashier_accepted -> preparing`
- `mark_preparation_ready`: `cashier_accepted|preparing -> ready` only when no
  active preparation task is still pending or preparing
- `serve`: `ready -> served`
- `complete`: `served -> completed`
- `cancel`: `submitted|cashier_accepted|preparing -> cancelled`

The API exposes lifecycle summaries on order responses:

- `status`
- `isTerminal`
- `allowedActions`
- `blockedReasons`
- `nextExpectedRole`
- `progressStep`
- `customerLabel`

## Denial Reason Codes

Lifecycle failures use stable codes so frontend surfaces and future operational
tools can show useful messages without parsing text:

- `order_not_found`
- `invalid_order_transition`
- `order_already_terminal`
- `order_not_submitted`
- `order_not_ready_to_serve`
- `order_has_pending_preparation_tasks`
- `order_not_served`
- `cancellation_requires_reason`
- `cancellation_not_allowed_from_status`
- `missing_staff_actor`
- `stale_order_state`
- `idempotency_conflict`

Preparation-task guards also return stable setup/action codes such as
`parent_order_not_accepted`, `parent_order_terminal`, `order_cancelled`,
`task_not_actionable`, `task_already_ready`, and `task_already_cancelled`.

## Order Transition Hardening

Cashier accept/reject, waiter serve, cashier completion, and staff cancellation
now validate the current order status before updating. Mutations use guarded
updates against the expected current status so a stale dashboard action cannot
silently overwrite a newer order state.

Order events now include lifecycle metadata where useful:

- `previousStatus`
- `nextStatus`
- `action`
- `source`
- optional `reason`

This keeps the existing `OrderEvent` audit trail useful without adding a new
audit-log table in this phase.

## Preparation Sync Hardening

Preparation tasks now respect parent-order state:

- tasks cannot start or move ready when the parent order is cancelled,
  rejected, served, completed, or otherwise terminal;
- starting the first actionable task can move an accepted order to `preparing`;
- marking the last active task ready can move an order to `ready`;
- accepted orders with no actionable preparation tasks can move directly to
  `ready`;
- active pending/preparing tasks are cancelled when the parent order is
  cancelled.

Cancelled preparation tasks are excluded from readiness checks.

## Cancellation And Rejection Behavior

Rejection remains a cashier review outcome from `submitted`.

Cancellation is a staff operation for operational reversals after submission
and before service. It is allowed only from:

- `submitted`
- `cashier_accepted`
- `preparing`

Cancellation requires a non-empty reason. The reason is stored in order event
metadata and is also used when cancelling active preparation tasks for that
order. Phase 4O.0 does not add a dedicated `cancellationReason` column.

There is no dedicated cancellation notification kind yet. Customer status
surfaces still show the cancelled status through normal order/status refreshes
and realtime invalidation.

## Staff Permission Fit

The backend remains the source of truth for staff access:

- cashier review list: `orders.cashier_review`
- ready-to-serve list: `orders.serve`
- accept: `orders.accept`
- reject: `orders.reject`
- serve: `orders.serve`
- complete: `orders.complete`
- cancel: `orders.complete`

Cancellation uses `orders.complete` in this phase to avoid widening the
permission model with a new action before the staff role matrix is revisited.

## Frontend Updates

Frontend changes are limited to existing operational surfaces:

- cashier detail panels read `lifecycle.allowedActions` before rendering
  accept, reject, cancel, and complete actions;
- cancellation requires visible reason input;
- cashier completion appears only when the order has been served;
- kitchen/barista task actions are disabled when the parent order is no longer
  actionable;
- waiter dashboard shows ready-to-serve orders and serves them through the
  existing backend validation path;
- customer status uses the lifecycle customer label when present.

The UI remains a client convenience layer; backend policy still validates every
mutation.

## Smoke Test

Recommended local smoke flow:

1. Start local infra, API, and web through the existing README quick-start.
2. Open `http://localhost:3001/customer/table/balcona-main-t01`.
3. Add menu items, satisfy required modifiers, and submit from the cart.
4. Open `http://localhost:3001/staff/login`, sign in, then open
   `/staff/cashier`.
5. Accept the submitted order and confirm it leaves the cashier review queue.
6. Open `/staff/kitchen`, start preparation tasks, and mark each active task
   ready.
7. Open `/staff/waiter`, confirm the order appears in the ready-to-serve panel,
   and serve it.
8. Return to `/staff/cashier`, confirm completion is available only after
   serving, then complete the order.
9. Repeat with a second submitted/accepted/preparing order and cancel it with a
   reason; verify active preparation tasks are cancelled and customer status
   shows cancelled.

## Tests

Phase 4O.0 adds focused backend coverage for:

- allowed and denied lifecycle transitions;
- lifecycle response summaries;
- completion blocked before service;
- service blocked before readiness;
- cancellation reason requirements;
- cancellation event metadata, realtime event, and preparation-task
  cancellation;
- preparation-task parent-order guards;
- preparation start and ready sync behavior.

## Known Limitations

- Staff lifecycle mutations do not yet have a public idempotency key contract.
- Cancellation reason is stored in event metadata, not a dedicated order column.
- Cancellation currently uses `orders.complete` permission.
- There is no dedicated customer cancellation notification type.
- Payment, POS, split bill, and manual payment flows remain outside this phase.

## Next Recommended Phase

Next recommended phase: Product Phase 4P.0 - Bill + Manual Payment Core.
