# PAY-7 — Fawry Hosted Checkout, Verified Callbacks, Recovery, and Refund

Status: IMPLEMENTED ON `payments/fawry-provider`

## Purpose

PAY-7 adds Fawry as a first-class Balcona payment provider without weakening the
money-safety invariants built in PAY-1 through PAY-6.

Supported provider surface in this phase:

- Fawry-hosted checkout.
- hosted CARD.
- hosted MWALLET.
- hosted PayAtFawry.
- hosted VALU when enabled on the merchant profile.
- signed Server-to-Server Notification V2.
- signed Get Payment Status V2 inquiry.
- retry preflight recovery.
- stale-intent reconciliation.
- full and partial refund through the official Refund API.

## PCI boundary

Balcona does not collect PAN/CVV for Fawry.

Fawry's direct/self-hosted card APIs can involve card token/CVV handling. PAY-7
deliberately uses the Fawry-hosted checkout surface so Balcona does not expand
its card-data handling scope.

Payment-method availability remains controlled by the Fawry merchant profile.
Balcona can request a hosted method, but it must not pretend that a method is
commercially enabled before Fawry enables it for the merchant.

## Hosted checkout

Balcona stores the local intent UUID as the Fawry merchant reference before
calling Fawry.

This is essential because the merchant reference is the durable recovery key if
hosted checkout initialization times out.

Hosted request signature:

`SHA256(merchantCode + merchantRefNum + customerProfileId-or-empty + returnUrl + itemId + quantity + price(two decimals) + secureKey)`

Balcona currently sends one bill charge item, so item sorting does not introduce
signature ambiguity.

The exact live hosted checkout endpoint must be confirmed during Fawry merchant
onboarding. Production does not rely on the staging default: it requires an
explicit `FAWRY_CHECKOUT_URL`.

## Verified callback

Fawry Server-to-Server Notification V2 is verified before database access.

Notification signature:

`SHA256(fawryRefNumber + merchantRefNumber + paymentAmount(two decimals) + orderAmount(two decimals) + orderStatus + paymentMethod + paymentReferenceNumber-or-empty + secureKey)`

Balcona uses timing-safe digest comparison.

Verified merchant reference is matched against the persisted provider order
reference.

Before settlement Balcona verifies:

- merchant reference.
- local payment amount.
- EGP currency.
- provider status.

Only a verified `PAID` state can reach the existing atomic bill settlement
guard.

Browser return/redirect parameters are never settlement authority.

## Status inquiry and retry safety

Get Payment Status V2 request signature:

`SHA256(merchantCode + merchantRefNumber + secureKey)`

Before a new Fawry attempt after a failed/cancelled/expired or locally expired
checkout, Balcona queries Fawry first.

Policy:

- PAID -> recover the old intent and settle once.
- NEW/UNPAID -> preserve/recover the old active attempt and do not create a
  second Fawry order.
- CANCELED -> terminal.
- EXPIRED -> terminal.
- FAILED -> terminal.
- provider inquiry unavailable -> fail closed; do not create a blind retry.
- provider has no transaction after checkout expiry -> explicitly expire the
  local intent and restore the bill.

The merchant reference is persisted before the provider initialization call, so
even an ambiguous initialization failure remains queryable.

## Provider-state mapping

Fawry provider states normalize as:

- `PAID` -> `succeeded`.
- `NEW` / `UNPAID` / unknown non-terminal -> `pending`.
- `CANCELED` / `CANCELLED` -> `cancelled`.
- `EXPIRED` -> `expired`.
- `FAILED` -> `failed`.
- `REFUNDED` / `PARTIAL_REFUNDED` -> adjustment observation; the historical
  succeeded sale is preserved rather than settled again.

## Refund

Official Fawry Refund API supports full and partial refunds.

Refund signature:

`SHA256(merchantCode + fawryReferenceNumber + refundAmount(two decimals) + reason-if-present + secureKey)`

PAY-7 reuses Balcona's durable `OnlinePaymentOperation` ledger.

Refund invariants:

- source payment must be succeeded.
- a Fawry reference must already have been verified and stored.
- cumulative succeeded refunds cannot exceed the original payment.
- global idempotency key.
- PostgreSQL advisory lock.
- only one pending financial operation per payment.
- staff `online_payments.manage`.
- Redis-backed financial-operation rate limit.

A direct Fawry Refund API response with `statusCode=200` is treated as the
provider's authoritative success response for that mutation.

### Ambiguous refund outcome

If the refund request times out, the network fails, or Fawry returns a response
that cannot be safely interpreted after the request may have reached Fawry:

- operation remains `pending`.
- failure code is marked `uncertain:...`.
- another refund is blocked.

This prevents duplicate refund execution.

Fawry Status V2 exposes `REFUNDED` and `PARTIAL_REFUNDED`, but the current
published response does not provide a reliable exact cumulative partial-refund
amount.

Therefore:

- full/cumulative-final refund can be auto-recovered when provider state proves
  the whole original payment is refunded.
- an ambiguous intermediate partial refund is not guessed from
  `PARTIAL_REFUNDED`; it remains pending until provider/dashboard/statement
  evidence resolves it.

PAY-6 statement reconciliation can be used as financial evidence, but PAY-7
does not fabricate an exact partial-refund amount from a status label.

## Refund adjustment notifications

A later Fawry `REFUNDED` / `PARTIAL_REFUNDED` notification does not
re-settle the original bill.

It is recorded as provider adjustment state and the historical successful sale
is preserved.

## Stale recovery scheduler

The existing PAY-4 recovery scheduler is provider-aware.

When active provider is Fawry:

- stale Fawry payment intents are queried through Get Payment Status V2.
- provable full-total pending refund operations can be reconciled.
- ambiguous intermediate partial refunds are intentionally not hammered by the
  automatic scheduler because Status V2 cannot prove their exact amount.

The Redis lock key is provider-specific so Paymob and Fawry recovery semantics
do not share a misleading lock identity.

## Production runtime

Required production Fawry configuration:

- `ONLINE_PAYMENT_PROVIDER=fawry`
- `FAWRY_MERCHANT_CODE`
- `FAWRY_SECURE_KEY`
- explicit `FAWRY_CHECKOUT_URL`
- explicit `FAWRY_STATUS_URL`
- `FAWRY_NOTIFICATION_URL`
- `FAWRY_RETURN_URL`
- `FAWRY_EXPECT_LIVE=true`

Recommended:

- explicit `FAWRY_REFUND_URL`
- explicit `FAWRY_ALLOWED_RETURN_ORIGINS`
- bounded `FAWRY_TIMEOUT_MS`
- `ONLINE_PAYMENT_RECONCILIATION_ENABLED=true` after inquiry credentials are
  configured.

Secrets are server-only and must never use `NEXT_PUBLIC_*`.

## Cancel Unpaid boundary

Fawry's current public Cancel Unpaid Order documentation is internally
inconsistent about signature concatenation order.

The prose / JavaScript example describes:

`orderRefNo + merchantAccount + lang + secureKey`

while PHP/Python examples show:

`merchantAccount + orderRefNo + lang + secureKey`

PAY-7 deliberately does not enable Cancel Unpaid based on a guessed signature.

Enablement requires one of:

1. a confirmed merchant-onboarding integration specification from Fawry, or
2. a provider-supplied deterministic test vector that establishes the accepted
   signature formula.

Paid transactions use Refund API instead.

## Official references

- https://developer.fawrystaging.com/docs/express-checkout/fawrypay-hosted-checkout
- https://developer.fawrystaging.com/docs/card-tokens/payment-notifications/server-notification-v2
- https://developer.fawrystaging.com/docs/sdks/payment-notifications/get-payment-status-v2
- https://developer.fawrystaging.com/public/docs/server-apis/refund-issue-api
- https://developer.fawrystaging.com/docs/server-apis/cancel-payment-api
- https://developer.fawrystaging.com/public/signatureTool/

## Manual go-live gate

Before real Fawry money:

1. Fawry merchant onboarding / KYC / commercial agreement.
2. merchant code and live secure key.
3. provider-confirmed live hosted checkout and status endpoints.
4. notification URL registered with Fawry operations.
5. return URL registered/allowed.
6. requested methods enabled on merchant profile.
7. controlled low-value payment for each enabled method.
8. callback + status inquiry comparison.
9. controlled refund.
10. settlement/export and bank reconciliation through PAY-6.

Until those steps are observed, the code can be software-ready without claiming
live Fawry certification.
