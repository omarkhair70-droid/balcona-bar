# PAY-8 — Commercial IPN Execution Master

Status: ACTIVE
Branch: `payments/pay8-commercial-ipn`
PR: #116
Base: `main`

## Rule of execution

PAY-8 is one bounded implementation PR, delivered incrementally.

No sub-phase advances merely because the next code is easy to write. Every financial sub-phase must pass:

1. documented provider / domain contract;
2. bounded implementation;
3. negative-path and idempotency tests;
4. no regression to PAY-1 through PAY-7 invariants;
5. review of provider ambiguity before the next financial mutation is enabled.

Unknown financial behavior fails closed. No endpoint, signature formula, status mapping, expiry rule, refund rule, or settlement rule may be guessed.

## PAY-8.0 — Provider decision gate

Goal: prove that the selected licensed PSP/bank exposes enough commercial IPN surface for a safe adapter.

Current preferred candidate: Maestr / Jumia Electronic Payment Services.

Verified public surface:
- REST payment-intent creation;
- API-key authentication;
- request idempotency;
- EGP integer amounts;
- merchant order reference;
- signed HMAC SHA-256 webhook;
- webhook timestamp;
- payment/event references;
- sandbox/live separation;
- InstaPay/IPN commercial rail;
- reporting/reconciliation surface.

Still required before provider lock:
- authenticated status inquiry contract;
- exact create response / payment link / QR / deep link contract;
- authoritative amount/currency inquiry fields;
- expiry and late-payment semantics;
- complete webhook canonicalization and replay window;
- terminal-state vocabulary;
- refund/reversal capability;
- reconciliation/export schema;
- live/sandbox base URLs and key lifecycle.

Gate state: **CANDIDATE APPROVED / PROVIDER-SPECIFIC SETTLEMENT GATED**.

## PAY-8.1 — Provider-neutral core cleanup

- [x] make numeric `integrationId` optional;
- [x] add generic `providerIntegrationReference`;
- [x] add explicit provider capability type;
- [x] remove fake Fawry `integrationId=0`;
- [x] add conservative capability registry for existing providers;
- [x] remove common provider-resolution, query-filter and settlement-import assumptions that only Paymob/Fawry can exist;
- [x] decide transaction-reference storage: normalized metadata + legacy fallback; no intent schema migration in PAY-8.1;
- [x] add/adjust tests for provider-neutral capability and reconciliation invariants;
- [ ] build/typecheck gate.

Definition of done: PAY-1 through PAY-7 behavior remains unchanged while the common contract can represent a commercial IPN provider without sentinel values or provider-specific type hacks.

## PAY-8.2 — Create commercial IPN payment request

Blocked on provider lock.

Required:
- local intent persisted before provider call;
- durable merchant reference;
- idempotent provider create;
- EGP exact integer amount;
- provider reference persisted;
- provider-generated checkout/link/QR/deep-link only;
- bounded timeout;
- ambiguous initialization recovery path;
- no personal InstaPay identifier.

## PAY-8.3 — Verified webhook

Blocked on complete signed-webhook contract.

Required:
- raw/canonical payload handling exactly as provider specifies;
- signature verification before database mutation;
- timestamp freshness;
- replay protection;
- event deduplication;
- safe redaction;
- merchant reference validation.

## PAY-8.4 — Authoritative inquiry

Blocked on documented status endpoint.

Required:
- authenticated server-to-server lookup;
- amount/currency/reference verification;
- conservative provider-state normalization;
- unknown state never maps to success;
- expected environment verification where available.

If webhook monetary truth is incomplete, inquiry is mandatory before settlement.

## PAY-8.5 — Exactly-once bill settlement

- verified provider truth only;
- existing atomic BillsService settlement guard remains final authority;
- duplicate webhook settles once;
- out-of-order events do not reopen/duplicate settlement;
- amount/currency/reference mismatch cannot settle.

## PAY-8.6 — Retry, recovery and expiry

- inquiry before retry after ambiguous/failed/expired state where provider truth may still exist;
- stale-intent scheduler support;
- provider unavailable => fail closed;
- no blind duplicate payment request.

## PAY-8.7 — Late and duplicate real transfers

Two different concepts must remain separate:

- duplicate delivery/event => de-duplicate;
- second real incoming transfer => preserve as a second financial movement.

A real duplicate/late incoming transfer must not settle a paid bill again. Route it to unapplied/reconciliation handling.

## PAY-8.8 — Refund/reversal capability

Disabled by default.

Enable only if documented provider/IPN commercial capabilities prove a supported operation. Card-style refund semantics must not be assumed.

## PAY-8.9 — PAY-6 reconciliation integration

- normalize provider transaction references;
- match sale/adjustment movements;
- ingest provider statement/export truth;
- gross/fee/net only where provider evidence supplies them;
- unmatched and duplicate incoming transfers remain visible;
- bank/provider evidence remains payout truth.

## PAY-8.10 — Customer and operations UX

Customer:
- initiate;
- waiting/pending;
- realtime success;
- expired/failed;
- safe retry.

Staff/owner:
- provider/payment reference;
- recovery state;
- mismatch/unapplied state;
- reconciliation status.

## PAY-8.11 — Security/failure matrix

Must cover:
- invalid signature;
- stale timestamp;
- replay;
- duplicate event;
- amount mismatch;
- currency mismatch;
- wrong merchant reference;
- create timeout;
- inquiry timeout;
- provider 5xx/rate limit;
- unknown provider state;
- webhook before create response;
- webhook after expiry;
- late success after another method settled the bill;
- concurrent create attempts;
- two genuine incoming transfers.

## PAY-8.12 — Final software gate

- Prisma generate/migrations;
- API build;
- API tests;
- web lint;
- web typecheck;
- web build;
- Docker API image;
- Docker web image;
- docs/runbook/env examples;
- final diff review;
- PR ready-for-review;
- merge only when clean;
- post-merge main checks.

Final software status: **PAY-8 SOFTWARE READY**.

## PAY-8.LIVE — Commercial certification

Separate from software completion.

Requires merchant onboarding/KYC, live credentials, registered Oracle HTTPS callback, controlled real payment, verified webhook, authoritative inquiry, exactly-once bill settlement, reconciliation against provider/bank truth, and refund/reversal test only if that capability is commercially supported.

Only then: **PAY-8 LIVE VERIFIED**.
