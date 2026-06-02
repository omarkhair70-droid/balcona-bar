# Phase 13 Smart Cashier Auto-Accept Foundation

Phase 13 adds a deterministic Smart Cashier foundation for safe order auto-acceptance. It is not an AI cashier and does not use an LLM. The backend evaluates branch settings, order state, amount limits, customer notes, menu availability, modifier availability, and review rules before deciding whether an order can move from `submitted` to `cashier_accepted`.

## Operating Modes

Each branch can have one `BranchSmartCashierSettings` row. Missing settings are treated as a safe default:

- `manual_only`: orders remain submitted for cashier review.
- `assisted`: the backend can evaluate and store reasons, but still requires cashier review.
- `auto_accept_safe_orders`: the backend may auto-accept only when every deterministic check passes.

Settings are disabled by default. Branch managers or future guarded staff flows can enable auto-accept per branch and optionally set `maxAutoAcceptSubtotalMinor`, `requirePaymentBeforeAutoAccept`, and `reviewCustomerNotes`.

## Safe Auto-Accept Checks

The evaluator requires:

- smart cashier settings exist and are enabled.
- mode is `auto_accept_safe_orders`.
- order status is still `submitted`.
- branch is active.
- subtotal does not exceed the configured maximum when one exists.
- payment is not required before auto-accept, because payment/POS is deferred.
- customer notes are absent when `reviewCustomerNotes` is enabled.
- current menu items and categories are active.
- branch menu item overrides do not hide or mark items unavailable.
- selected modifier groups and options are still active and consistent.
- enabled branch, item, or category review rules do not apply.

There is no inventory model yet, so stock-based review is deferred. The `out_of_stock` reason code exists for the later inventory phase but is not emitted without inventory data.

## Manual Review Reasons

Manual review reasons are stored on the order during submit-time or explicit attempt-time evaluation. Reasons include disabled/manual/assisted mode, branch closed, high amount, item or modifier unavailable, customer note present, payment required, and review-rule hits.

The read-only evaluate endpoint returns the same deterministic decision and reasons without changing order status.

## Submit Flow Integration

Cart submit still creates the order as `submitted`, writes the `submitted` order event, creates the existing order-submitted notification, and emits `order_submitted` realtime.

After that, Smart Cashier evaluates the order in the same transaction:

- `requires_manual_review`: the order stays `submitted`, stores decision metadata, and remains in the cashier queue.
- `auto_accepted`: the system sets `cashier_accepted`, `cashierAcceptedAt`, `autoAcceptedAt`, and Smart Cashier metadata; writes a `cashier_accepted` `OrderEvent` with `actorType=system`; creates preparation tasks; creates the existing order-accepted notification; and emits existing `order_accepted` realtime.

Manual cashier accept/reject endpoints remain unchanged. If Smart Cashier leaves an order submitted, the cashier can still accept or reject it normally.

## Realtime

Phase 13 reuses existing realtime channels:

- branch orders: `branch_orders`
- customer session status: `session_status`

It adds event types:

- `smart_cashier_evaluated`
- `smart_cashier_auto_accepted`
- `smart_cashier_manual_review_required`

These events supplement the existing `order_submitted` and `order_accepted` events. Preparation task realtime is still emitted by the preparation task creation hook.

## Permissions

The Phase 11 permission map now includes future guard keys:

- `smart_cashier.read`
- `smart_cashier.manage`
- `smart_cashier.evaluate`
- `smart_cashier.auto_accept`

`owner` receives them through the full permission set. `branch_manager` receives all Smart Cashier permissions. `cashier` receives read, evaluate, and auto-accept attempt permissions. Production auth/login and route enforcement remain deferred.

## Deferred

This phase does not add Flutter UI, web/PWA UI, AI waiter behavior, LLM decisions, payment/POS, inventory enforcement, production auth/login, external push channels, or Phase 14 behavior.
