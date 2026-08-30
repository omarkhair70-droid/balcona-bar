# PAY-8 — Commercial IPN Provider Gate

Status: SOFTWARE ARCHITECTURE READY / PROVIDER EXECUTION FAIL-CLOSED  
Branch: `closure/payments-total-closure`  
Owning PR: #160  
Supersedes draft PR: #116

## Provider decision

Selected commercial IPN candidate: **Maestr / Jumia Electronic Payment Services**.

Balcona does not integrate personal InstaPay accounts, screenshots, SMS notifications, or client-side proof as payment authority.

Current first-party public material is sufficient to establish:
- commercial InstaPay/IPN positioning;
- REST payment-intent architecture;
- server-side API-key authentication;
- idempotency;
- integer EGP amount examples;
- signed webhook positioning;
- sandbox/production separation;
- reconciliation/reporting positioning.

It is not sufficient to safely enable Maestr money mutation in Balcona.

## Required merchant-only facts before execution can be enabled

Balcona still requires authoritative merchant documentation for:
1. exact sandbox and production base URLs;
2. create-payment response action shape;
3. QR/deep-link/reference semantics;
4. expiry and late-payment behavior;
5. complete webhook canonicalization and signature input;
6. timestamp/replay rules;
7. authoritative inquiry endpoint and response;
8. terminal provider-state vocabulary;
9. refund/reversal behavior, if supported;
10. settlement/export schema;
11. merchant/account binding fields;
12. deterministic test vectors where available.

No endpoint, signature formula, status mapping, amount rule, refund rule, or settlement rule may be guessed.

## Implemented now

The total closure branch safely includes:
- `maestr` as a provider identity;
- `bankTransferOrIpn=true` capability;
- provider-neutral customer actions:
  - redirect
  - deep link
  - QR
  - display reference
- server-only Maestr runtime placeholders;
- explicit Maestr provider resolution;
- staging representation;
- hard production rejection;
- customer create fail-closed before provider or intent mutation;
- tests proving Maestr cannot silently fall through to mock.

## Settlement invariant

A future PAY-8 payment may settle a bill only after:
- server-authenticated provider truth;
- merchant/local reference match;
- exact amount match;
- exact EGP currency match;
- expected environment match;
- replay/event deduplication;
- existing atomic bill settlement guard.

If webhook truth is incomplete, authenticated provider inquiry is mandatory before settlement.

## Current outcome

**PROVIDER SELECTED. PROVIDER-SPECIFIC FINANCIAL EXECUTION BLOCKED PENDING VERIFIED MERCHANT CONTRACT.**

This is an external contract gate, not an invitation to fabricate implementation.
