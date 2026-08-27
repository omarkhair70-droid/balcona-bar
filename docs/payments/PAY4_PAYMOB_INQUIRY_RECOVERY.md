# PAY-4 — Paymob Transaction Inquiry and Recovery

Status: IMPLEMENTED ON `payments/paymob-inquiry-recovery`

## Purpose

PAY-4 adds pull-based provider truth so Balcona does not depend on webhook
delivery alone.

It is the recovery layer for:

- missed Paymob callbacks.
- customer retry attempts after a locally terminal payment state.
- stale pending / requires_action intents.
- explicit checkout expiry when Paymob confirms no transaction exists.
- staff support inquiries.
- periodic reconciliation.

## Official Paymob inquiry flow

Balcona follows Paymob's current Transaction Inquiry collection:

1. `POST {base_url}/api/auth/tokens`
   with `{ "api_key": PAYMOB_API_KEY }`.
2. Use the returned bearer token for:
   `POST {base_url}/api/ecommerce/orders/transaction_inquiry`
   with `{ "order_id": providerOrderId }`.

The Paymob API key is a distinct server-side credential from the Intention
Secret Key.

Balcona caches the short-lived inquiry auth token for 55 minutes and refreshes
it once if Paymob rejects it early.

Official references:

- https://github.com/PaymobAccept/API-Postman-Collections
- https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Transaction%20Inquiry%20API.postman_collection.json
- https://developers.paymob.com/

## Why inquiry is trusted

Inquiry is an authenticated server-to-server request. It does not depend on
browser redirect parameters.

The inquiry response still must pass Balcona's local safety gates:

- provider order id must equal the stored Paymob order id.
- merchant reference, when present, must equal the Balcona intent id.
- amount must equal the local intent amount.
- currency must equal the local intent currency.
- integration id must be configured.
- `is_live` must match Balcona's expected test/live environment.
- child/refund transactions are non-actionable until PAY-5.

Only after these checks can an inquiry-reported success reach the existing
atomic bill settlement guard.

## Retry preflight

Before creating a new Paymob attempt, Balcona checks the latest prior Paymob
intent for the same bill/session when that intent is:

- failed.
- cancelled.
- expired.
- still active but its checkout expiry has passed.

If the prior provider order exists, Balcona performs Transaction Inquiry first.

Result policy:

- provider success -> recover the old intent to succeeded and settle once.
- provider pending/requires_action -> recover the old local intent to active and
  do not create a second provider payment.
- provider failed/cancelled -> preserve a safe terminal result and allow normal
  retry flow.
- provider inquiry unavailable -> fail closed; do not create another Paymob
  payment blindly.
- no provider transaction + expired local checkout -> mark the intent expired.

This closes the main lost-callback retry race for new PAY-4 traffic.

## Scheduled reconciliation

Runtime settings:

- `ONLINE_PAYMENT_RECONCILIATION_ENABLED`
- `ONLINE_PAYMENT_RECONCILIATION_INTERVAL_SECONDS`
- `ONLINE_PAYMENT_RECONCILIATION_STALE_SECONDS`
- `ONLINE_PAYMENT_RECONCILIATION_BATCH_SIZE`

Default behavior keeps reconciliation disabled until `PAYMOB_API_KEY` is
configured deliberately.

When enabled, the API periodically selects stale active Paymob intents and
inquires them.

A Redis distributed lock ensures only one API instance runs a reconciliation
tick at a time.

The scheduler does not block application startup if Redis is temporarily
unavailable; it skips that tick and retries on the next interval.

## Explicit terminal transitions

PAY-4 adds explicit recovery behavior:

- Paymob void/cancel -> `cancelled`.
- final unsuccessful transaction -> `failed`.
- no provider transaction after local checkout expiry -> `expired`.
- authenticated provider success -> `succeeded`.
- auth-only success -> `requires_action`.
- provider pending -> `pending`.

When a terminal local intent is recovered to pending/requires_action, Balcona
first checks that another active intent does not already exist for the same
bill. If one exists, recovery records a conflict and preserves the database
one-active-intent invariant.

## Staff recovery endpoint

`POST /api/v1/online-payment-intents/:intentId/recover`

Requirements:

- valid staff session.
- branch/company scoped access.
- `online_payments.manage` permission.
- Redis-backed staff recovery rate limit (default 10 requests / 60 seconds).

The endpoint performs real provider inquiry and may update/settle local state.
Production fails closed if the shared payment rate limiter is unavailable.

## Safe metadata

Balcona deliberately stores only normalized inquiry metadata such as:

- provider transaction/order id.
- integration id.
- test/live flag.
- provider timestamps.
- state flags.
- source type/subtype.

Full PAN/card payloads from the inquiry response are not persisted.

## Remaining boundary

PAY-4 materially reduces retry/double-charge risk, but PAY-5 is still required
for:

- refund handling.
- void/capture operations.
- provider child-transaction lifecycle.
- cancelling/voiding an already-created replacement provider attempt if a
  historical older charge is discovered after the replacement exists.

Real money still requires the manual go-live gates and live transaction tests.
