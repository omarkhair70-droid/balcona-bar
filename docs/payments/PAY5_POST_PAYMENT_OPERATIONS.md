# PAY-5 — Paymob Refund, Void, Capture, and Child Transactions

Status: IMPLEMENTED ON `payments/paymob-post-payment-ops`

## Purpose

PAY-5 closes Balcona's first production-grade post-payment money movement layer:

- full and partial refunds.
- card void.
- authorization capture.
- durable operation idempotency.
- provider child transaction lifecycle.
- recovery after uncertain provider outcomes.
- receipt and operational reporting adjustments.

PAY-5 does not replace PAY-2 settlement or PAY-4 inquiry. It builds on both.

## Official Paymob API mapping

Balcona follows Paymob's current Refund / Void / Capture API collection.

### Refund

`POST /api/acceptance/void_refund/refund`

Authorization:

`Authorization: Token PAYMOB_SECRET_KEY`

Body:

- `transaction_id`
- `amount_cents`

Balcona supports full and partial refund amounts, bounded by the remaining
refundable amount.

### Void

`POST /api/acceptance/void_refund/void`

Authorization:

`Authorization: Token PAYMOB_SECRET_KEY`

Body:

- `transaction_id`

Paymob documents void as a card-payment operation intended for same-business-day
reversal where supported by the acquiring flow.

### Capture

`POST /api/acceptance/capture`

Authorization:

`Authorization: Token PAYMOB_SECRET_KEY`

Body:

- `transaction_id`
- `amount_cents`

Paymob supports capturing authorized transactions. Paymob also documents that
authorization-only transactions that are not captured are automatically voided
after their provider window.

Official references:

- https://github.com/PaymobAccept/API-Postman-Collections
- https://developers.paymob.com/paymob-docs/developers/transaction-void
- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac

## Balcona operation ledger

PAY-5 adds `OnlinePaymentOperation`.

Every financial mutation has:

- local operation id.
- local online payment intent id.
- provider.
- operation type: refund / void / capture.
- pending / succeeded / failed status.
- globally unique idempotency key.
- parent provider transaction id.
- child/provider operation transaction id when known.
- amount and currency.
- requesting staff user.
- request/completion/failure timestamps.
- safe provider metadata.

Database invariants include:

- unique idempotency key.
- unique provider child transaction reference.
- only one pending financial operation per online payment intent.
- positive operation amount.

Balcona also takes a PostgreSQL advisory transaction lock per online payment
intent before creating an operation.

## Provider response is not final truth

HTTP 200 from refund, void, or capture does not directly mutate Balcona's
financial truth.

Flow:

1. lock and create local pending operation.
2. authenticate and inquire the target Paymob transaction.
3. verify operation eligibility.
4. send refund / void / capture.
5. persist the provider operation transaction reference when returned.
6. inquire Paymob server-to-server again.
7. only authoritative inquiry may finalize the local operation.

If the provider mutation times out or the provider is unavailable after the
request may have been sent, the operation remains `pending` / uncertain.

Balcona does NOT reinterpret an ambiguous timeout as failure and does NOT allow
a second financial operation while the first is unresolved.

This prevents duplicate refunds and duplicate capture/void mutations.

## Child transaction lifecycle

Paymob can represent capture/refund/void as child transactions.

A verified HMAC callback with `has_parent_transaction=true` is treated as a
trigger, not complete post-payment truth.

Balcona:

1. verifies the normal Paymob callback HMAC.
2. records/deduplicates the callback.
3. performs authenticated transaction inquiry by the child transaction id.
4. requires authoritative child operation type and parent transaction id.
5. matches the child to exactly one pending local operation.
6. validates provider order/currency/amount.
7. finalizes that operation.

Unsiged/non-HMAC child fields from the incoming callback are not used as the
sole authority for a refund/void/capture mutation.

## Refund rules

Refund requires a succeeded Paymob payment.

Balcona calculates cumulative locally succeeded refunds and rejects:

`previous refunds + requested refund > original payment amount`

Partial refunds are supported.

Successful refund does not rewrite the historical bill into an unpaid order.
The original sale remains settled and the refund is represented as a financial
adjustment linked to that payment.

Receipts and analytics show the adjustment and net online collection.

## Void rules

Void is allowed only when:

- provider is Paymob.
- authoritative target transaction is card-based.
- transaction state is currently authorized or succeeded.
- there is no successful refund.
- there is no earlier successful void.
- Paymob accepts the provider-side void.

For an authorization-only payment that was never settled, successful void
cancels the active payment intent and returns the bill to its payable presented
state when no other active payment exists.

For a payment that had already settled the bill, successful void is retained as
a post-settlement financial adjustment. The historical bill remains paid and
reporting nets the void.

## Capture rules

Current Balcona bill settlement is full-balance settlement.

Therefore PAY-5 intentionally supports FULL CAPTURE ONLY:

`capture amount == OnlinePaymentIntent.amountMinor`

Paymob can support partial capture, but Balcona rejects partial capture until a
future partial/split online settlement model can preserve bill accounting
without ambiguity.

A successful full capture is passed through the existing PAY-2 atomic
`settleBillWithOnlinePayment` guard.

## Staff security

Mutation routes require:

- valid staff session.
- company/branch scope.
- `online_payments.manage`.
- Redis-backed financial-operation rate limiting.

Default financial mutation throttle:

`5 requests / 60 seconds / staff identity`

Production inherits the PAY-3 fail-closed Redis policy.

Routes:

- `POST /api/v1/online-payment-intents/:intentId/refund`
- `POST /api/v1/online-payment-intents/:intentId/void`
- `POST /api/v1/online-payment-intents/:intentId/capture`
- `POST /api/v1/online-payment-operations/:operationId/recover`

## Recovery and scheduled reconciliation

PAY-4 reconciliation now also scans stale pending Paymob financial operations.

A pending operation can be recovered using:

- known provider child transaction id, or
- the authoritative parent transaction state when the child reference was not
  returned because the mutation outcome was uncertain.

Partial-refund recovery may use cumulative provider
`refunded_amount_cents` to prove the requested cumulative refund amount.

## Receipts and reporting

The operational bill is not reopened by a post-settlement refund/void.

Instead:

- receipt payload records gross online payment.
- successful refund/void adjustments are listed.
- net online payment is derived.
- owner analytics subtract adjustments in the date range where the adjustment
  completed.
- cashier X/Z shift reporting subtracts successful refund/void adjustments in
  the shift window.
- Paymob is included in external online tender totals.

This preserves both immutable sales history and correct net cash/revenue views.

## Audit

Successful financial operations create staff-attributed audit actions:

- `online_payment_refunded`
- `online_payment_voided`
- `online_payment_captured`

Provider operation events are also stored on the OnlinePaymentIntent audit
stream.

## Remaining boundary

PAY-6 remains responsible for provider settlement/payout reconciliation,
fees/gross/net settlement references, mismatch queues, and daily financial
close against Paymob settlement data.

Live production verification still requires real Paymob merchant credentials
and controlled low-value live refund/void/capture tests where the merchant
configuration enables those capabilities.
