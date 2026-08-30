# PAY-8 — Maestr Merchant Contract Checklist

This checklist must be completed from authenticated/current Maestr merchant documentation before provider-specific money execution is enabled.

## Authentication and environment
- [ ] sandbox base URL
- [ ] production base URL
- [ ] API-key lifecycle and rotation
- [ ] merchant/account identifier rules
- [ ] sandbox/live credential separation

## Create payment
- [ ] exact endpoint
- [ ] exact request schema
- [ ] amount unit confirmed
- [ ] EGP currency semantics confirmed
- [ ] merchant order/reference field confirmed
- [ ] idempotency behavior confirmed
- [ ] expiry semantics confirmed
- [ ] exact response schema
- [ ] provider payment reference
- [ ] redirect/deep-link/QR/reference action format

## Webhook
- [ ] endpoint registration flow
- [ ] raw vs parsed body requirement
- [ ] signature header
- [ ] timestamp header
- [ ] exact canonicalization input
- [ ] HMAC/hash algorithm
- [ ] replay tolerance/window
- [ ] event ID / dedupe key
- [ ] amount and currency authority
- [ ] merchant reference authority
- [ ] sandbox/live indicator if supplied
- [ ] deterministic signature test vector

## Inquiry / recovery
- [ ] authenticated status endpoint
- [ ] provider reference lookup
- [ ] merchant reference lookup if supported
- [ ] authoritative amount
- [ ] authoritative currency
- [ ] exact status vocabulary
- [ ] timeout/unknown behavior
- [ ] late-success behavior

## Refund / reversal
- [ ] capability exists or is explicitly unsupported
- [ ] endpoint and authentication
- [ ] full vs partial semantics
- [ ] idempotency
- [ ] provider references
- [ ] settlement impact

## Settlement / reconciliation
- [ ] export/report format
- [ ] provider transaction reference
- [ ] sale/refund/reversal identifiers
- [ ] gross amount
- [ ] fees
- [ ] net amount
- [ ] payout reference
- [ ] settlement date
- [ ] unmatched/duplicate transfer handling

Until the relevant boxes are proven, the corresponding provider mutation remains disabled.
