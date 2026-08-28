# PAY-8 — Commercial IPN Provider Decision Gate

Status: IN PROGRESS on `payments/pay8-commercial-ipn`

## Purpose

PAY-8 adds a commercial account-to-account payment rail for Balcona through a licensed bank/PSP integration connected to Egypt's Instant Payment Network (IPN).

This phase MUST NOT integrate a personal InstaPay account, scrape SMS notifications, accept screenshot proof, or treat browser/client state as payment authority.

## Current decision

Preferred provider candidate: **Maestr / Jumia Electronic Payment Services**.

Reason:
- explicitly exposes InstaPay/IPN as a commercial national rail;
- REST payment-intent creation is publicly documented;
- create requests are idempotent;
- webhook events are signed with HMAC SHA-256 and include a timestamp;
- sandbox and production are separate;
- reporting/reconciliation is explicitly part of the platform surface.

The public integration surface is enough to approve provider-neutral PAY-8 preparation, but it is **not yet sufficient to lock provider-specific settlement code**.

## Publicly verified contract

Create:
- `POST /api/v1/payment-intents`
- `X-API-Key`
- `Idempotency-Key`
- integer amount
- `currency=EGP`
- `merchant_order_id`

Webhook:
- `X-Maestr-Signature`
- HMAC SHA-256
- `X-Maestr-Timestamp`
- `event_reference`
- `payment_reference`
- `merchant_order_id`
- normalized provider status signal

Platform:
- sandbox and production credentials are separate;
- InstaPay/IPN is exposed as a supported national rail;
- reporting and reconciliation exports are part of the commercial surface.

## Provider-lock blockers

Before provider-specific money settlement can be implemented, merchant documentation or provider-supplied integration material MUST confirm:

1. authenticated transaction/status inquiry endpoint and response;
2. authoritative amount and currency fields used during inquiry;
3. exact payment-intent create response, including payment link / QR / deep-link and provider reference;
4. exact expiry semantics and late-payment behavior;
5. complete webhook canonicalization/signature rules and replay window;
6. IPN-specific terminal states;
7. refund/reversal capability, if any;
8. reconciliation/export schema and transaction reference mapping;
9. sandbox/live base URLs and key lifecycle;
10. deterministic test vectors for signature verification when available.

No financial endpoint, status mapping, or signature formula may be guessed.

## Approved work while the gate remains open

The following provider-neutral changes are safe to implement before provider lock:
- remove Paymob-specific assumptions from common provider types;
- make provider integration identifiers generic;
- model capabilities explicitly;
- prepare a dedicated commercial-IPN provider slot without fabricating financial behavior;
- extend tests around provider-neutral invariants.

## Non-negotiable settlement rules

A PAY-8 success may settle a Balcona bill only after:
- server-authenticated provider truth;
- merchant/local reference match;
- exact amount match;
- exact EGP currency match;
- expected environment match;
- event/retry deduplication;
- existing atomic bill settlement guard.

If the provider webhook does not carry enough authoritative monetary truth, Balcona MUST perform authenticated inquiry before settlement.

## Duplicate-transfer policy

Idempotent create retries and duplicate webhook delivery are de-duplicated.

A second real incoming bank transfer is **not** a duplicate event. It must be recorded as a separate financial movement and routed to reconciliation/unapplied-payment handling instead of settling the same bill twice.

## Refund policy

PAY-8 must not assume card-style refund or reversal semantics. Provider capabilities remain false until the commercial IPN documentation proves a supported refund/reversal operation.

## Gate outcome

Current outcome: **PROVIDER CANDIDATE APPROVED; PROVIDER-SPECIFIC SETTLEMENT CONTRACT PENDING MERCHANT DOCUMENTATION.**

Provider-neutral PAY-8 implementation may proceed. Provider-specific financial mutation/settlement code remains gated.
