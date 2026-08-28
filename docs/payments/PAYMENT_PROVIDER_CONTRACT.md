# Payment Provider Contract

Status: ACTIVE

This contract isolates Balcona payment business logic from PSP-specific APIs.

Provider adapters are infrastructure. They must not settle bills directly.

## Responsibilities

A provider adapter MAY:

- create a provider-side payment attempt/intention.
- build or return a provider-hosted checkout URL.
- verify callback/webhook authenticity.
- normalize provider events into Balcona's payment event vocabulary.
- inquire about a provider transaction.
- request refund, void or capture operations where supported.
- expose provider transaction and settlement references.

A provider adapter MUST NOT:

- decide a Balcona bill amount.
- trust amount/currency supplied by the browser.
- mark a Balcona bill paid.
- bypass the central online-payment settlement guard.
- store or expose raw card PAN/CVV.
- silently treat redirects as payment confirmation.

## Type-level contract

The concrete TypeScript shape may evolve, but adapters must preserve these semantics.

### createPayment

Input:

- local intent id
- merchant integration context
- amountMinor
- currency
- internal reference
- notification/webhook URL
- customer return URL
- optional safe billing/customer fields
- allowed payment method identifiers

Output:

- provider
- providerIntentId/reference
- checkout URL or client secret
- expiration when available
- normalized initial status
- safe provider metadata

### verifyWebhook

Input:

- raw/parsed provider callback representation required by the provider signature algorithm
- request headers/query values needed by the signature algorithm
- merchant integration context

Output:

- verified boolean
- provider event identifier/fingerprint
- provider transaction/intention reference
- normalized event status
- amount/currency when supplied
- live/test flag when supplied
- safe/redacted payload

Verification failure MUST fail closed.

### inquirePayment

Input:

- provider transaction/intention reference
- merchant integration context

Output:

- normalized status
- provider transaction id
- amount/currency
- paid/captured/refunded values when available
- live/test flag
- safe provider metadata

### refundPayment

Provider mutation response is not sufficient settlement truth. The adapter
returns only safe operation references and the business layer must perform
authenticated transaction inquiry before finalizing the local operation.

Input:

- provider transaction id
- amountMinor
- currency
- idempotency/reference
- reason

Output:

- provider refund id
- status
- refunded amount
- safe provider metadata

### voidPayment

Optional provider capability. Balcona requires authoritative provider inquiry
after the mutation and currently enables Paymob void only for card-based
transactions.

### capturePayment

Optional provider capability. Balcona currently permits full capture only
because the bill settlement domain does not yet support partial online
settlement.

## Normalized status vocabulary

At the OnlinePaymentIntent level Balcona currently uses:

- pending
- requires_action
- succeeded
- failed
- cancelled
- expired

Provider-specific intermediate states must be mapped conservatively.

Unknown or ambiguous provider states must never map to `succeeded`.

## Required verification before settlement

A normalized provider success may be submitted to the Balcona settlement service only after all applicable checks pass:

1. callback authenticity verified or inquiry performed with authenticated server credentials.
2. provider transaction belongs to the expected configured provider/merchant integration.
3. provider transaction/intention reference resolves to the intended local payment.
4. provider amount equals the local intent amount.
5. provider currency equals the local intent currency.
6. provider environment matches expected test/live mode.
7. event has not already been processed.
8. local bill is still eligible for the existing atomic settlement guard.

## Provider capabilities

Each adapter should declare capabilities rather than making callers infer them.

The code-level capability registry is fail-closed: newly introduced providers must explicitly opt into supported capabilities. Unsupported or undocumented capabilities remain `false`.

A provider-native numeric integration identifier is optional. Providers that do not expose one must not fabricate sentinel values such as `0`; they may expose a provider-native string integration/rail/account reference instead.

Each provider capability set covers:

- hostedCheckout
- embeddedCheckout
- cards
- mobileWallets
- kioskOrReference
- bankTransferOrIpn
- tokenization
- recurring
- authorizeCapture
- void
- partialRefund
- fullRefund
- transactionInquiry
- settlementData
- terminal
- softPos

## Error policy

Provider adapter errors must be mapped into stable categories:

- missing_config
- authentication_failed
- invalid_request
- provider_declined
- provider_unavailable
- rate_limited
- timeout
- invalid_response
- signature_invalid
- amount_mismatch
- currency_mismatch
- environment_mismatch
- transaction_not_found
- unsupported_operation

Do not leak secret material or provider raw responses to customer-facing errors.

## Paymob mapping

Initial Paymob implementation uses:

- Intention creation from Balcona backend.
- Unified Checkout hosted page.
- transaction processed callback as backend signal.
- HMAC verification before normalization.
- redirect callback for customer UX only.
- server-side inquiry for recovery/reconciliation.
- refund/void/capture modules in later phases.

Official references:

- https://developers.paymob.com/paymob-docs/integration-paths/apis
- https://developers.paymob.com/paymob-docs/developers/checkout-experiences
- https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac
- https://github.com/PaymobAccept/API-Postman-Collections

## Fawry mapping

Fawry must implement the same Balcona contract. Fawry-specific recurring, split, tokenization, POS and reconciliation features must not leak into common bill settlement logic.

Reference:

- https://www.fawry.com/business/acceptance/online-checkout/

## Geidea mapping

Geidea callbacks must validate their documented signature and success codes before normalization. Refund/capture/terminal capabilities remain provider capabilities, not core assumptions.

References:

- https://docs.geidea.net/docs/geidea-checkout-v2
- https://docs.geidea.net/docs/sample-callback-responses
- https://docs.geidea.net/docs/refund-2

## Provider transaction reference storage

Provider transaction references used by reconciliation may be stored in the normalized `providerTransactionId` metadata key. PAY-8 keeps legacy provider-specific metadata fallbacks for existing Paymob/Fawry records.

PAY-8 deliberately does not add a single first-class transaction-id column to `OnlinePaymentIntent` during provider-neutral cleanup: one intent can observe multiple provider events or child/adjustment transactions, and the current domain does not need to pretend one reference is universally canonical. `OnlinePaymentOperation` continues to keep its own first-class provider transaction reference for financial mutations.

## IPN mapping

An IPN adapter is accepted only when backed by a documented commercial bank/PSP integration with a verifiable transaction status mechanism.

A personal InstaPay app flow, screenshot upload, SMS scraping or manual visual confirmation is not a compliant provider adapter.
