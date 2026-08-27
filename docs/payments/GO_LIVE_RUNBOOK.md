# Payment Go-Live Runbook

Status: MANUAL GATES + ENGINEERING CHECKLIST

This runbook distinguishes what engineering can complete without merchant approval from what requires a real person/business account.

## Stage A — engineering-only / no real-money dependency

Engineering can complete all of the following without live merchant credentials:

- provider abstraction.
- Paymob sandbox adapter.
- hosted checkout redirect flow.
- webhook/HMAC verification implementation.
- mocked provider tests.
- sandbox transaction tests when test credentials are available.
- customer payment guards.
- refunds/reconciliation domain models and services.
- SaaS billing state machine.
- CI coverage.
- deployment env templates.

Do not block this work on a commercial contract.

## Stage B — merchant onboarding

Manual intervention is required for each merchant account that will receive live money.

### Cafe-customer payments

For the first live cafe merchant:

1. create/activate the merchant account with the chosen PSP.
2. complete KYC/business verification requested by the provider.
3. provide settlement bank account details directly to the PSP.
4. agree to the provider commercial terms.
5. request/enable required methods:
   - cards.
   - relevant wallets.
   - Meeza or local methods where the provider/account supports them.
6. obtain live integration identifiers and secrets.
7. configure the Balcona backend callback URL in the provider dashboard.
8. configure customer return URL.
9. confirm live/test integration IDs are not mixed.

### Balcona SaaS billing

Use a separate merchant relationship/account owned by Balcona for Balcona subscription revenue.

Do not use a cafe merchant account to collect Balcona subscription fees.

## Secrets handoff

Never paste live secrets into a source file, issue, PR body or chat transcript intended for permanent storage.

Required runtime secret names for initial Paymob integration are expected to include values equivalent to:

- PAYMOB_SECRET_KEY
- PAYMOB_PUBLIC_KEY
- PAYMOB_HMAC_SECRET
- PAYMOB_INTEGRATION_IDS or provider-specific configured IDs

Exact variables are finalized by the implementation phase.

Store them in the deployment secret/environment system only.

## Paymob dashboard setup

Use the official Paymob dashboard to distinguish test mode and live mode.

For live launch confirm:

- secret key is live.
- public key is live.
- integration IDs are live.
- payment methods are enabled for the merchant.
- transaction processed callback points to the HTTPS Balcona API endpoint.
- response/return URL points to the intended Balcona web origin.
- HMAC secret matches the environment.

Official references:

- https://developers.paymob.com/paymob-docs/integration-paths/apis
- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac
- https://github.com/PaymobAccept/API-Postman-Collections

## Live validation sequence

Perform in this order.

### 1. Preflight

- production API health green.
- HTTPS valid.
- production CORS locked.
- mock payment actions unavailable.
- callback endpoint publicly reachable.
- secrets loaded without being printed.
- payment provider reports configured/live.

### 2. Low-value successful card transaction

Use a small legitimate live amount.

Verify:

- Balcona creates exactly one local payment intent.
- provider creates the matching transaction.
- customer completes provider checkout.
- redirect shows a pending/processing state unless backend already confirmed.
- verified webhook arrives.
- amount/currency/provider reference checks pass.
- bill becomes paid exactly once.
- receipt is generated.
- realtime update arrives.
- owner/cashier analytics classify the payment correctly.
- cash drawer expected physical cash does not increase.

### 3. Duplicate callback test

Use provider webhook testing/retry functionality when available.

Verify no second settlement/receipt/payment is created.

### 4. Failure/decline test

Verify failed payment:

- does not settle bill.
- leaves customer with a readable retry path.
- records safe failure metadata.

### 5. Refund test

After refund functionality is shipped:

- issue a small full or partial refund.
- verify provider result.
- verify local refund state.
- verify owner/cashier reporting.
- verify refund cannot exceed refundable balance.
- verify staff actor/audit entry.

### 6. Inquiry/reconciliation test

Compare provider inquiry/report against Balcona:

- transaction id.
- amount.
- currency.
- paid/refunded state.
- settlement information when exposed.

## IPN / InstaPay gate

Do not implement a fake live InstaPay connector from a personal account.

A live IPN adapter can be enabled only when a bank or licensed PSP provides:

- a commercial merchant/API agreement.
- documented authentication.
- a merchant payment/request/QR capability.
- server-verifiable payment status/callback/inquiry.
- settlement destination and reconciliation information.

## Terminal/POS gate

For physical payment devices:

- obtain provider terminal/device provisioning.
- bind the device/terminal identifier to the cafe branch.
- test amount push from Balcona to terminal if the provider integration supports it.
- verify terminal result is authenticated and mapped to the same bill.
- keep manual card POS as a fallback during pilot until integrated flow is proven.

## Final labels

Allowed status labels:

- PAYMENT ARCHITECTURE READY
- PAYMOB SANDBOX READY
- SOFTWARE PAYMENT READY
- LIVE CREDENTIALS CONFIGURED
- LIVE PAYMENTS VERIFIED

Never use LIVE PAYMENTS VERIFIED until a real low-value payment, webhook verification and reconciliation checks have actually passed.
