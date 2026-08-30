# Balcona Payments External Research

Checked: 2026-08-30

This file records current first-party provider facts that materially affect Balcona's payment implementation. Repository code remains fail-closed when the exact merchant contract is not available.

## Paymob

Official sources checked:

- https://developers.paymob.com/paymob-docs/integration-paths/apis
- https://developers.paymob.com/paymob-docs/developers/checkout-experiences
- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac
- https://developers.paymob.com/paymob-docs/payments-and-features
- https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Paymob%20Subscription%20Module%20API.postman_collection.json

Current contract facts used by Balcona:

- Intention creation is server-side and checkout can use Paymob Unified Checkout.
- Redirects are UX only; transaction callbacks are the payment source of truth.
- Transaction callbacks support HMAC verification.
- Paymob exposes subscriptions/recurring billing as a current product capability.
- The official subscription collection requires an Online 3DS Integration ID for enrollment and a MOTO Integration ID for recurring deductions.
- Subscription plans use `POST /api/acceptance/subscription-plans`.
- Customer enrollment uses `POST /v1/intention/` with `subscription_plan_id`.
- Subscription lookup supports `GET /api/acceptance/subscriptions/{subscription_id}` and filtering by transaction id.
- Subscription lifecycle includes suspend, resume and cancel endpoints.
- Subscription cards and the primary-card lifecycle are provider-supported.
- Egypt uses EGP minor units for subscription amount examples.

Balcona impact:

- Existing restaurant Paymob adapter remains the restaurant-payment adapter.
- Balcona SaaS billing must use a separate Balcona-owned merchant configuration and must not reuse a cafe's tenant merchant identity.
- Paymob is the initial SaaS recurring-billing provider choice because the current first-party recurring contract is materially more complete than the public Fawry API contract.
- Production activation still requires Balcona's own Paymob subscription/MOTO account capability and live credentials.

## Fawry Accept

Official sources checked:

- https://www.fawry.com/business/acceptance/online-checkout/
- https://www.fawry.com/business/acceptance/
- https://www.fawry.com/ar/point-of-sale/

Current verified public facts:

- Fawry Accept supports online cards, reference-code payments and mobile wallets.
- Fawry advertises recurring payments and card tokenization.
- Fawry advertises Auth & Capture, unified reconciliation and split payments.
- Fawry offers in-person POS products and states that multiple integration options exist.

Balcona impact:

- Existing PAY-7 hosted checkout, verified notification, inquiry/recovery and reconciliation code remains supported by repository contract/tests.
- Fawry recurring billing is not selected for BILL-1 because the exact current subscription API contract needed by Balcona is not sufficiently documented in the public first-party surface reviewed here.
- Marketing-level POS capability does not prove a server-to-terminal API contract. PAY-9 remains provider-execution blocked until the exact merchant terminal contract is available.

## Maestr / Jumia Electronic Payment Services

Official source checked:

- https://maestr.com/
- authenticated/merchant documentation link advertised by Maestr: https://pay.maestr.com/docs

Verified public facts:

- Maestr advertises a REST payment-intent API.
- Public examples use `X-API-Key` and an idempotency key.
- Public examples use integer EGP amounts and merchant order IDs.
- Maestr advertises signed webhooks using HMAC SHA-256 plus a timestamp.
- Maestr advertises InstaPay/IPN support and sandbox/production separation.
- Maestr advertises reporting/reconciliation.

Still missing from the public contract needed for safe provider execution:

- exact production payment-intent response action shape for Balcona's merchant account
- exact QR/deep-link/reference behavior
- exact webhook canonicalization and replay window
- authoritative inquiry contract
- refund/reversal contract
- settlement export schema

Balcona impact:

- The provider-neutral customer-action model supports redirect, deep link, QR and display-reference actions.
- Maestr is represented as a commercial IPN-capable provider.
- Maestr execution remains fail-closed in MerchantPaymentIntegration until the exact merchant contract is available.
- PR #116 is treated as source material only; safe provider-neutral work is being superseded by the total payment closure branch.

## Merchant topology

Balcona's required topology remains:

customer -> licensed PSP/acquirer -> cafe merchant account

for restaurant money, and separately:

Balcona customer/company -> Balcona billing PSP -> Balcona merchant account

for SaaS subscription money.

No provider research reviewed here authorizes Balcona to silently pool unrelated cafes' restaurant revenue into Balcona's own merchant account.

## Direct terminal / SoftPOS

Current public provider marketing confirms in-person products exist, but it does not establish the exact device-provisioning/server-to-terminal contract required by PAY-9.

Until that contract is available, Balcona may model terminal/device/payment-request readiness but must not present manual `card_pos` recording as a direct terminal integration.

## Research-to-code rule

Provider-specific money mutations are enabled only when Balcona can prove:

1. provider authentication
2. amount/currency semantics
3. merchant scope
4. transaction authenticity
5. idempotency
6. authoritative inquiry/recovery
7. test/live separation
8. settlement/reconciliation evidence

If one of those depends on guessing, the provider execution remains blocked while provider-neutral product architecture can still be completed.
