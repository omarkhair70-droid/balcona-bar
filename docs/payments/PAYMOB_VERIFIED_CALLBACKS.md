# PAY-2 — Paymob Verified Transaction Callbacks

Status: IMPLEMENTED ON `payments/paymob-verified-callbacks`

## Purpose

PAY-2 turns the PAY-1 hosted checkout foundation into a verifiable server-side
payment result flow.

The customer browser redirect remains UX only. A Balcona bill can move to paid
from Paymob only through the verified transaction callback path and the existing
atomic bill settlement guard.

## Callback endpoint

`POST /api/v1/online-payments/webhooks/paymob?hmac=<transaction-hmac>`

The endpoint accepts Paymob's transaction callback envelope and validates the
transaction HMAC before any payment database lookup or mutation.

## HMAC contract

Paymob transaction POST callbacks use HMAC-SHA512 over these 20 values from
`body.obj`, in this exact order and without separators:

1. amount_cents
2. created_at
3. currency
4. error_occured
5. has_parent_transaction
6. id
7. integration_id
8. is_3d_secure
9. is_auth
10. is_capture
11. is_refunded
12. is_standalone_payment
13. is_voided
14. order.id
15. owner
16. pending
17. source_data.pan
18. source_data.sub_type
19. source_data.type
20. success

The received `hmac` is a query parameter. Balcona computes the digest with
`PAYMOB_HMAC_SECRET` and compares decoded digests with a timing-safe compare.

Official references:

- https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/universal-prompt.md
- https://github.com/PaymobAccept/Paymob-AI-Integration-Skill/blob/main/skills/paymob-integration/references/code-nodejs.md

## Signed provider-order binding

PAY-2 intentionally does not use `order.merchant_order_id` as the primary
callback lookup key.

Paymob's transaction HMAC signs `order.id`, but not
`order.merchant_order_id`. PAY-1 now persists the Paymob intention's
`intention_order_id` as `OnlinePaymentIntent.providerOrderId`.

The verified callback is therefore bound using:

`provider=paymob + providerOrderId=verified order.id`

If `merchant_order_id` is present it is used only as an additional cross-check
against the local intent id.

## Verified settlement gates

A callback may reach bill settlement only if:

- HMAC verification succeeds.
- integration id belongs to the configured Paymob merchant environment.
- the signed provider order id resolves to a Paymob intent.
- merchant reference, when present, agrees with the local intent.
- signed amount equals local amount.
- signed currency equals local currency.
- callback represents an actionable primary transaction.
- local intent remains active.
- the existing atomic bill settlement policy succeeds.

## Callback idempotency

Paymob does not provide a separate callback event id in this flow.

Balcona derives a deterministic provider event id from:

- signed transaction id, and
- the verified transaction HMAC digest.

This means an identical retry is deduplicated, while a genuinely changed
signed transaction state is not incorrectly suppressed merely because the
transaction id is the same.

The database unique constraint on `provider + providerEventId` remains the
final concurrent duplicate guard.

## Status normalization

- `pending=true` -> `pending`
- successful auth-only transaction -> `requires_action`
- `is_voided=true` -> `cancelled`
- final `success=true` -> `succeeded`
- otherwise -> `failed`

PAY-2 treats `has_parent_transaction=true` callbacks as non-actionable.
Capture, void and refund child-transaction business logic belongs to PAY-5.

## Sensitive data

The HMAC calculation necessarily reads the callback source-data fields required
by Paymob, but Balcona does not persist the callback PAN field. Stored callback
metadata is deliberately reduced to transaction/order/integration/state and
payment source type/subtype.

## Recovery boundary

PAY-2 handles push callbacks only.

Lost callback recovery and transaction inquiry remain PAY-4. Until PAY-4 exists,
a callback delivery problem can leave an intent pending and requires provider
inquiry/manual investigation rather than trusting the browser redirect.
