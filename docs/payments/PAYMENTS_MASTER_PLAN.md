# Balcona Real Payments Master Plan

Status: ACTIVE

Implementation progress:
- PAY-0: merged to main in PR #109
- PAY-1: merged to main in PR #109
- PAY-2: merged to main in PR #110
- PAY-3: implemented on branch `payments/customer-payment-hardening`
- PAY-4 and later: pending

Owner: Balcona engineering
Baseline main: 23f52a530cc5f9372956405edaa29c3e8015f6a3
Working branch: payments/real-payments-foundation

## Purpose

This document is the source of truth for taking Balcona from the existing mock-only online-payment foundation to production-capable payment acceptance for Egyptian cafes and production SaaS billing for Balcona itself.

Do not replace the existing bill settlement foundation. Extend it.

## Current repository truth

Balcona already has:

- `OnlinePaymentIntent` with idempotency, provider intent id, checkout URL, status, amount, currency, expiry, failure metadata and audit events.
- `OnlinePaymentEvent` with provider event de-duplication.
- atomic guarded bill settlement through the existing bills service.
- realtime payment success/failure events.
- receipt generation and online revenue reporting.
- `SaasPlan`, `CompanySubscription` and feature-entitlement foundations.
- customer session access-token primitives.

Current runtime limitations:

- `ONLINE_PAYMENT_PROVIDER` only accepts `mock` or placeholder `external`.
- `createIntentForCustomer()` explicitly rejects non-mock live processing.
- no provider-specific webhook verification.
- no refunds, voids, capture, disputes, settlement reconciliation or provider inquiries.
- no merchant payment integration model per company/branch.
- no real SaaS recurring billing.
- customer-token enforcement and production rate limiting are not complete across all customer routes.

## Product boundaries

There are two separate money flows and they MUST remain separate.

### Cafe customer payments

Customer -> licensed PSP/acquirer -> cafe merchant account.

Balcona orchestrates and records the payment. Balcona must not silently pool customer funds into a Balcona-owned account for later manual distribution.

### Balcona SaaS billing

Cafe/company -> billing PSP -> Balcona merchant account.

This is the subscription/invoice lifecycle for access to Balcona itself.

## Provider strategy

### Primary online provider: Paymob

Use Paymob's current Intention API and hosted Unified Checkout first.

Reasons:

- first-party documented Intention API.
- callback/webhook flow with HMAC verification.
- cards and other enabled payment methods through integration IDs.
- refunds, voids, capture, inquiries and subscriptions documented by Paymob.
- test and live modes supported by the same payment architecture.

Official references:

- https://developers.paymob.com/paymob-docs/integration-paths/apis
- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac
- https://github.com/PaymobAccept/API-Postman-Collections

### Secondary provider: Fawry Accept

Add after Paymob is production-ready.

Target capabilities:

- cards, Fawry reference, mobile wallets.
- recurring payments.
- card tokenization.
- auth/capture.
- split payments when a regulated marketplace/payout model is explicitly contracted.
- online + POS paths and reconciliation reporting.

Reference:

- https://www.fawry.com/business/acceptance/online-checkout/

### In-person provider path: Fawry or Geidea

Do not model terminal acceptance as a fake online payment. Add a payment channel dimension and provider adapter capable of representing terminal/SoftPOS outcomes.

Geidea references:

- https://docs.geidea.net/docs/geidea-checkout-v2
- https://docs.geidea.net/docs/sample-callback-responses
- https://docs.geidea.net/docs/refund-2

### IPN / InstaPay rail

Do not automate a personal InstaPay account and do not use screenshots as proof of payment.

Use an approved bank/PSP/commercial integration that exposes merchant QR, payment link, request-to-pay or equivalent IPN capabilities with verifiable transaction status.

Reference:

- https://www.cbe.org.eg/ar/payment-systems-and-services/instant-payment-network
- https://www.cbe.org.eg/en/news-publications/news/2025/06/19/08/20/psos-and-psps-licensing-rules

## Security invariants

1. Balcona backend remains source of truth for bill id, amount and currency.
2. Browser redirects never mark a bill paid.
3. Only a verified provider callback/webhook or a provider inquiry result may transition a real payment to succeeded.
4. Verify provider signature/HMAC before trusting payload contents.
5. Verify provider transaction reference, local intent, amount, currency, live/test mode and merchant scope before settlement.
6. Provider events must be durable and idempotent.
7. Repeated, delayed or out-of-order provider events must never double-settle.
8. No raw card number, CVV or other PCI card secrets enter Balcona logs/database.
9. Provider credentials live only in runtime secret storage, never git and never `NEXT_PUBLIC_*`.
10. Production must disable mock payment mutation endpoints.
11. Customer payment create/status endpoints must enforce the table-session/customer access token before real money is enabled.
12. Production payment endpoints need rate limiting and abuse controls.
13. Never log provider secret keys, HMAC secrets, access tokens or complete callback payloads containing sensitive fields.
14. Refund permissions must be staff-authenticated, branch/company scoped and audited.

## Target domain model

The existing `OnlinePaymentIntent` remains the user-facing bill payment attempt.

Add, in bounded migrations:

### MerchantPaymentIntegration

Represents the PSP merchant configuration assigned to a company or branch.

Minimum fields:

- companyId
- optional branchId
- provider
- environment: test/live
- status
- enabled payment methods/channels
- provider merchant/account reference
- secret reference names, not plaintext secrets
- configuration metadata safe for persistence

### PaymentTransaction

Represents the authoritative provider transaction.

Minimum fields:

- onlinePaymentIntentId
- provider
- provider transaction id/reference
- status
- channel
- method
- authorized/captured/refunded amounts
- currency
- provider created/paid timestamps
- live/test flag
- safe provider metadata

### PaymentWebhookInbox

Durable callback receipt before business processing.

Minimum fields:

- provider
- providerEventId or deterministic fingerprint
- signatureVerified
- receivedAt
- processing status
- processing attempts
- linked intent/transaction ids when resolved
- safe/redacted payload

### PaymentRefund

- transaction id
- provider refund id
- amount
- reason
- status
- requested-by staff
- timestamps

### PaymentSettlement / ReconciliationEntry

Track provider settlement/payout information and daily reconciliation findings.

## Provider contract

Every real provider adapter must implement the contract documented in `PAYMENT_PROVIDER_CONTRACT.md`.

Business services must not contain Paymob/Fawry/Geidea-specific parsing outside provider adapter modules.

## Delivery phases

### PAY-0 — permanent architecture reference

- this master plan.
- provider contract.
- live security rules.
- go-live runbook.
- implementation master prompt.

No payment behavior changes.

### PAY-1 — Paymob sandbox adapter

- add `paymob` provider configuration.
- create Paymob Intention server-side.
- return hosted checkout URL to customer.
- preserve existing mock provider for local/demo.
- add strict timeouts and provider-safe errors.
- unit tests with network calls mocked.

Acceptance:

- sandbox credentials can create a real Paymob test intention.
- no credential is required to run repository CI.

### PAY-2 — verified Paymob callbacks

- provider-specific callback controller.
- raw/normalized callback handling required by HMAC calculation.
- HMAC verification.
- durable de-duplication.
- amount/currency/provider reference verification.
- existing atomic settlement remains final gate.
- callback retry/out-of-order tests.

Acceptance:

- success redirect alone cannot settle.
- invalid HMAC cannot settle.
- duplicate valid webhook settles exactly once.
- amount mismatch cannot settle.

### PAY-3 — customer payment security

- require customer-session access ownership for create/read real payment endpoints.
- payment-specific rate limits.
- production mock routes inaccessible.
- redacted logging.
- security test matrix.

### PAY-4 — provider inquiry and recovery

- transaction inquiry.
- recovery for lost callback.
- scheduled reconciliation of pending payments.
- explicit expired/cancelled transitions.

### PAY-5 — refunds / void / capture

- full and partial refund.
- authorization/capture if enabled for the merchant.
- auditable staff permission.
- receipt/report adjustments.
- provider and local amount guards.

### PAY-6 — reconciliation and settlements

- daily transaction-to-provider reconciliation.
- fees, gross, net and settlement references when provider data makes them available.
- mismatch queue for owner/platform operations.

### PAY-7 — Fawry adapter

Implement the same provider contract; do not duplicate settlement business logic.

### PAY-8 — IPN commercial adapter

Only after an approved commercial bank/PSP API and credentials exist.

### PAY-9 — in-person terminal/SoftPOS

Add terminal channel and device/provider lifecycle without weakening online-payment controls.

### BILL-1 — Balcona SaaS billing

Separate from cafe-customer payment settlement.

- provider customer/subscription references.
- invoice and billing payment attempt models.
- trial -> active -> past_due -> grace -> suspended/cancelled lifecycle.
- verified billing webhooks.
- retry/dunning rules.
- entitlements driven by verified billing state.

## Manual gates

Engineering can complete sandbox implementation without live merchant credentials.

Human/business intervention is required only for:

1. merchant account creation and KYC/business verification.
2. merchant bank settlement details and commercial contract.
3. enabling required payment methods/integration IDs.
4. receiving live secret/public/HMAC credentials.
5. provider dashboard configuration of callback and return URLs.
6. terminal provisioning when an in-person device is used.
7. final low-value live transaction + refund + settlement verification.

Until these gates are satisfied, the repository may reach SOFTWARE PAYMENT READY but must not claim LIVE PAYMENTS VERIFIED.

## Definition of done for live cafe payments

Do not declare live payments complete until:

- customer ownership guard is enforced.
- live provider credentials are in secret storage.
- one live card transaction succeeds end-to-end.
- callback signature verification is observed.
- bill settles exactly once.
- receipt and analytics are correct.
- one refund is verified.
- provider inquiry agrees with local status.
- settlement/reconciliation check passes.
- mock mutation routes are disabled in production.
- CI and production smoke checks pass.
