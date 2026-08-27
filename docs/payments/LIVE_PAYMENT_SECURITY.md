# Live Payment Security Rules

Status: REQUIRED BEFORE REAL MONEY

## Trust boundaries

Balcona must assume all browser input, redirect parameters and unverified webhook bodies are untrusted.

Only these can authorize a real payment state transition:

- a provider callback/webhook whose authenticity has been cryptographically verified, or
- an authenticated server-to-server provider inquiry.

## Customer ownership

Before real payments are enabled:

- create-payment and read-payment customer routes must require the existing customer table-session access token.
- the token must resolve to the same table session as the bill/payment intent.
- a QR token alone is not sufficient proof of ownership for payment operations.

## Amount and currency

- derive payable amount from the Balcona bill.
- never accept an arbitrary client amount.
- persist local intent amount/currency before creating provider payment.
- compare provider callback/inquiry amount and currency before settlement.
- mismatches fail closed and generate an auditable event.

## Webhooks

Every real provider webhook route must:

1. use the exact signature material required by the provider.
2. verify before business processing.
3. reject invalid signatures.
4. persist a durable inbox/event record.
5. de-duplicate provider events or deterministic fingerprints.
6. tolerate duplicate and out-of-order delivery.
7. return an appropriate provider acknowledgement only after durable receipt.
8. never use customer redirect state to substitute for the webhook.

## Paymob

Paymob transaction callbacks must be authenticated with the HMAC rules documented by Paymob.

The transaction processed callback drives backend state.

The transaction response redirect is for UX only.

Official reference:

- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac

## Secrets

Secrets include at minimum:

- Paymob secret key
- Paymob public key where used
- Paymob HMAC secret
- provider API keys/tokens/passwords
- Fawry/Geidea credentials
- future IPN provider credentials

Rules:

- environment/secret manager only.
- never git.
- never database plaintext when a secret reference can be used.
- never browser `NEXT_PUBLIC_*`.
- never logs.
- never exception messages returned to customers.

## Production mock isolation

When APP_ENV=production:

- mock online payment success/failure endpoints must not be usable.
- mock provider cannot be selected for real-money checkout.
- startup/config validation should fail closed for an invalid production payment configuration where appropriate.

## Rate limiting and abuse controls

Payment-sensitive endpoints require tighter controls than ordinary catalog reads:

- intent creation by customer/session/IP.
- webhook route protection against payload floods while preserving legitimate provider retries.
- staff refund/void/capture operations.
- transaction inquiry endpoints.

Rate limiting must not be the only webhook security mechanism.

## Logging

Log:

- request id
- local intent id
- safe provider reference
- normalized status
- signature verified true/false
- processing result
- latency
- reconciliation mismatch codes

Do not log:

- secret keys
- HMAC secrets
- bearer tokens
- full card data
- CVV
- unredacted sensitive provider payloads

## Refund authorization

Refund/void/capture endpoints must:

- require staff session authentication.
- enforce company/branch scope.
- require a dedicated permission.
- record actor, reason, amount and provider result in audit history.
- enforce refundable amount server-side.
- be idempotent.

## Failure policy

When uncertain, preserve money integrity over UI optimism.

Examples:

- webhook missing amount -> inquire before settlement if provider contract allows it.
- unknown provider status -> keep pending/requires_action.
- signature cannot be verified -> reject.
- provider timeout after create call -> recover by provider reference/idempotency/inquiry, do not create duplicate uncontrolled charges.
- database transaction failure after provider success -> webhook retry or reconciliation must recover without double settlement.

## Go-live security gate

Real money remains disabled until tests prove:

- invalid signature cannot settle.
- tampered amount cannot settle.
- tampered currency cannot settle.
- duplicate webhook cannot double settle.
- success redirect cannot settle.
- wrong customer session cannot create/read payment.
- production mock success route is unavailable.
- secrets are absent from repository and browser bundles.
