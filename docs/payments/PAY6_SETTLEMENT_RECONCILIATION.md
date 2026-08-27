# PAY-6 — Settlement and Payout Reconciliation

Status: IMPLEMENTED ON `payments/paymob-settlement-reconciliation`

## Purpose

PAY-6 separates three different financial truths that must never be conflated:

1. Balcona's local payment and adjustment ledger.
2. Paymob's authenticated transaction state.
3. the merchant settlement / payout statement that represents provider-to-bank
   settlement accounting.

A payment being `succeeded` is not the same statement as a provider reporting
it `is_settled`, and neither statement alone proves the exact bank payout net
after fees.

## Provider boundary

Paymob publishes separate API collections for:

- Accept payment processing / transaction inquiry.
- Payouts / disbursements.

The Payouts API is an outbound disbursement product. PAY-6 does **not** treat it
as the merchant settlement API for Accept transactions.

Current official transaction inquiry responses can expose reconciliation signals
including, depending on acquiring flow:

- `is_settled`.
- `merchant_commission`.
- order commission fees.
- acquirer settlement date.
- acquirer batch reference.
- `bill_balanced`.

These fields can be absent or flow-specific. PAY-6 therefore does not invent a
fee or settlement date when Paymob does not return one.

Official references:

- https://github.com/PaymobAccept/API-Postman-Collections
- https://github.com/PaymobAccept/API-Postman-Collections/blob/main/Transaction%20Inquiry%20API.postman_collection.json
- https://developers.paymob.com/

## Local reconciliation movements

PAY-6 normalizes local Paymob money movement into three movement types:

- `sale`: succeeded Paymob payment intent, dated by `succeededAt`.
- `refund`: succeeded refund operation, dated by `completedAt`.
- `void`: succeeded post-settlement void, dated by `completedAt`.

An authorization-only void whose payment was never settled is not a negative
sale movement because no successful sale was recorded in the local revenue
ledger.

Local totals:

`gross = sales`

`adjustments = refunds + post-settlement voids`

`net_before_fees = gross - adjustments`

## Provider inquiry reconciliation

A provider reconciliation run:

1. selects local movements for one branch, currency, and time window.
2. requires a provider transaction reference for each movement.
3. retrieves each Paymob transaction with authenticated server-side inquiry.
4. verifies currency, amount, operation identity, and provider status.
5. records provider settlement signals where available.
6. creates a durable entry for each compared movement.
7. opens durable issues for discrepancies.

Run states:

- `matched`: all compared movements match and Paymob explicitly reports them
  settled.
- `pending`: movement truth matches but one or more transactions are not yet
  explicitly settled, or the settlement signal is unavailable.
- `mismatch`: one or more material differences exist.
- `failed`: provider reconciliation itself could not complete safely.

A missing settlement signal is deliberately not promoted to `matched`.

## Fees

Provider fee coverage is explicit.

When all sale inquiries expose a usable provider fee and there are no
refund/void movements whose fee treatment still depends on the settlement
statement:

- `providerFeeMinor` is recorded.
- `providerNetMinor = providerGross - providerAdjustments - providerFee`.

If any required fee is unavailable:

- fee coverage is marked incomplete.
- `providerFeeMinor` remains null.
- `providerNetMinor` remains null.

Zero is never substituted for an unknown provider fee.

## Settlement / payout statement import

There is no assumption in PAY-6 that a stable public Accept payout-batch API is
available for every merchant.

Instead Balcona exposes a normalized settlement statement contract that can be
fed from:

- a verified Paymob merchant statement/export.
- an approved provider integration added later.
- an audited operations import prepared from provider/dashboard settlement data.

The import stores:

- provider.
- branch.
- external settlement reference.
- optional payout/bank reference.
- currency.
- transaction-activity coverage period.
- settlement/payout date.
- gross.
- adjustments.
- provider fees.
- net.
- source hash.
- individual provider transaction lines.

`periodStart` / `periodEnd` represent the local transaction-activity window
being reconciled. A bank payout date can be later and belongs in
`settledAt` / `payoutReference`.

Each line contains:

- provider transaction id.
- sale/refund/void movement type.
- amount.
- fee.
- net.
- currency.
- optional settlement reference/date.

The batch totals must exactly equal totals derived from the supplied lines before
Balcona persists the batch.

The import is idempotent by external reference and canonical source hash. The
same external reference with different contents is rejected.

## Statement reconciliation

After import, Balcona automatically compares the normalized statement with local
movements in the same branch/currency/period.

It detects:

- local transaction missing from statement.
- statement-only provider transaction.
- amount mismatch.
- currency mismatch.
- sale/refund/void type mismatch.
- gross / adjustment total mismatch.
- net-after-fee mismatch.

Statement net expectation:

`expected_net = local_net_before_fees - provider_fee`

The original settlement statement is not silently modified to make a mismatch
disappear.

## Mismatch queue

Every mismatch is a durable `OnlinePaymentReconciliationIssue`.

Issue lifecycle:

- `open`
- `acknowledged`
- `resolved`

Acknowledgement and resolution require staff scope plus
`online_payments.manage`, and create staff-attributed audit records.

Resolution does not rewrite historical provider/import data. It records the
operations decision and note.

## Daily financial close

PAY-6 has a separate scheduler from PAY-4 pending-payment recovery.

Default behavior:

- disabled until explicitly enabled.
- runs hourly when enabled.
- computes the previous fully closed calendar day.
- default timezone: `Africa/Cairo`.
- discovers branch/currency scopes that had Paymob movements in that day.
- runs one deterministic provider reconciliation per scope.
- uses a Redis distributed lock so multiple API instances do not run the same
  close concurrently.
- uses deterministic day/branch/currency idempotency so repeated hourly ticks
  return the same run instead of duplicating financial records.

Default limits:

- maximum 500 local movements per reconciliation run.
- maximum 50 branch/currency scopes per scheduler tick.

A limit breach fails closed for operations review rather than silently
truncating financial data.

Runtime settings:

- `ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED`
- `ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_INTERVAL_SECONDS`
- `ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE`
- `ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_ENTRIES`
- `ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_SCOPES`

Enabling automatic PAY-6 requires:

- online payments enabled.
- Paymob configured provider.
- `PAYMOB_API_KEY`.

## Staff APIs

Manage:

- start provider reconciliation for a branch/time window.
- import a normalized settlement batch.
- acknowledge mismatch.
- resolve mismatch.

Read:

- list branch reconciliation runs.
- read a reconciliation run with entries/issues.
- read a settlement batch with lines.
- list mismatch issues.

All records are company/branch scoped.

Costly/mutating PAY-6 routes reuse Balcona's Redis-backed financial-operation
rate limit.

## Smoke and staging hygiene

Smoke reset removes PAY-5 operations and all PAY-6 reconciliation/settlement
records for the smoke branch before clearing payment intents and bills.

This prevents old settlement references or mismatch issues from contaminating
later staging smoke cycles.

## What PAY-6 closes

PAY-6 gives Balcona a software-grade path to answer:

- Did Balcona record the same transactions Paymob reports?
- Has Paymob explicitly marked the transaction settled?
- What provider fee did the provider expose, when available?
- Does the imported merchant settlement statement contain every local movement?
- Do gross, adjustments, fees, and net reconcile?
- Which discrepancies are still open and who acknowledged/resolved them?

## What still requires the live merchant

SOFTWARE PAYMENT READY is not the same as LIVE SETTLEMENT VERIFIED.

Final financial proof requires a real merchant account and controlled live data:

1. live payment.
2. verified callback.
3. live transaction inquiry.
4. controlled refund.
5. provider settlement/export.
6. actual bank payout/reference.
7. imported statement reconciliation with zero unexplained mismatch.

Until that is observed, Balcona must not claim that real bank settlement has
been verified.
