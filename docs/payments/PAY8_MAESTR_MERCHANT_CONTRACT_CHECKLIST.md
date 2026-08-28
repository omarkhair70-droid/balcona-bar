# PAY-8 — Maestr Merchant Contract Checklist

Status: REQUIRED BEFORE PROVIDER-SPECIFIC MONEY FLOW
Provider: Maestr / Jumia Electronic Payment Services
Branch: `payments/pay8-commercial-ipn`
PR: #116

## Purpose

This checklist is the exact evidence gate between the provider-neutral PAY-8 foundation and provider-specific financial code.

Public Maestr material is sufficient to select the provider and prove:
- commercial InstaPay/IPN support;
- REST payment-intent creation;
- server API key authentication;
- idempotent create requests;
- signed webhook events;
- separate sandbox and production environments;
- reporting and reconciliation.

It is not sufficient to safely infer the details below.

## 1. Environment and credentials

Require provider-issued documentation for:

- [ ] sandbox API base URL;
- [ ] production API base URL;
- [ ] sandbox API key lifecycle;
- [ ] production API key lifecycle;
- [ ] webhook signing secret/key lifecycle;
- [ ] credential rotation process;
- [ ] IP allowlisting or mTLS requirements, if any;
- [ ] request timeout / provider rate-limit guidance.

No default live URL may be guessed in Balcona.

## 2. Create payment intent

Publicly observed request path:

`POST /api/v1/payment-intents`

Publicly observed request fields:
- `amount`
- `currency`
- `merchant_order_id`
- `description`
- `X-API-Key`
- `Idempotency-Key`

Still require:

- [ ] exact amount unit (major vs minor units);
- [ ] allowed decimal/rounding rules;
- [ ] EGP-only or multi-currency behavior for the IPN method;
- [ ] how InstaPay/IPN is selected/requested;
- [ ] exact idempotency conflict/replay semantics;
- [ ] exact successful create response;
- [ ] provider payment reference field;
- [ ] customer action type returned for IPN:
  - redirect,
  - deep link,
  - QR payload,
  - display/reference code,
  - or another documented form;
- [ ] payment request expiry field;
- [ ] error response schema;
- [ ] deterministic recovery key when create times out after provider acceptance.

Balcona must persist its local intent/reference before the provider create request.

## 3. Webhook authenticity

Publicly observed:
- `X-Maestr-Signature`
- HMAC SHA-256
- `X-Maestr-Timestamp`
- `event_reference`
- `payment_reference`
- `merchant_order_id`
- status-change event

Still require:

- [ ] exact canonical bytes/string signed;
- [ ] whether timestamp participates in the signature;
- [ ] signature encoding (hex/base64/etc.);
- [ ] accepted timestamp clock-skew/replay window;
- [ ] whether body must be raw bytes;
- [ ] event retry schedule;
- [ ] event ordering guarantees, if any;
- [ ] event id uniqueness guarantee;
- [ ] webhook acknowledgement response requirements;
- [ ] deterministic provider signature test vector.

Invalid or ambiguous signatures must fail closed before database mutation.

## 4. Authoritative payment inquiry

Required before PAY-8.4:

- [ ] authenticated lookup endpoint by Maestr payment reference;
- [ ] authenticated lookup endpoint by merchant order id, if supported;
- [ ] not-found semantics;
- [ ] authoritative amount field;
- [ ] authoritative currency field;
- [ ] merchant-order reference field;
- [ ] provider transaction/payment reference;
- [ ] environment/test-live marker, if available;
- [ ] created/paid/expired timestamps;
- [ ] full provider state vocabulary;
- [ ] documented terminal vs non-terminal states.

Unknown states must never map to Balcona `succeeded`.

If the signed webhook does not carry authoritative amount + currency, Balcona inquiry is mandatory before settlement.

## 5. Expiry and late payment

Require:

- [ ] provider-side payment request TTL;
- [ ] whether a payer can authorize after displayed expiry;
- [ ] state returned for expired requests;
- [ ] whether an expired request can later become successful;
- [ ] behavior when provider accepts funds after Balcona has settled the bill by another method;
- [ ] recommended cancellation/closure operation for unpaid requests, if any.

A late real incoming payment must never settle an already-paid bill twice.

## 6. Duplicate real transfers

Require provider evidence for:

- [ ] whether one payment request can receive more than one successful transfer;
- [ ] unique transaction reference for every real incoming movement;
- [ ] whether duplicate payer authorization is prevented at the rail/provider level;
- [ ] how statement/export data represents multiple incoming movements against one merchant order.

Balcona policy remains:
- duplicate webhook delivery = deduplicate;
- second real transfer = preserve as a separate financial movement and route to unapplied/reconciliation handling.

## 7. Refund / reversal / outbound return

Do not assume card-style refund semantics.

Require:

- [ ] whether IPN pay-ins support reversal;
- [ ] whether Maestr exposes merchant refund API for an IPN payment;
- [ ] full vs partial support;
- [ ] exact mutation endpoint and idempotency behavior;
- [ ] authoritative post-mutation inquiry;
- [ ] timeout/ambiguous-outcome recovery;
- [ ] whether customer return must instead be a new outbound transfer.

Until proven, Maestr PAY-8 capabilities remain:
- `fullRefund=false`
- `partialRefund=false`

## 8. Reporting and reconciliation

Public Maestr material states normalized payment/refund exports are available.

Require exact merchant schema for:

- [ ] export/report retrieval mechanism;
- [ ] provider payment reference;
- [ ] merchant order id;
- [ ] movement type;
- [ ] gross amount;
- [ ] fee;
- [ ] net;
- [ ] currency;
- [ ] transaction timestamp;
- [ ] settlement/value date;
- [ ] settlement/batch reference;
- [ ] bank/payout reference;
- [ ] refund/adjustment representation;
- [ ] duplicate/unapplied movement representation.

`settlementData` remains false until this schema is confirmed.

## 9. Required sandbox test vectors

Before enabling provider-specific success settlement, obtain/execute:

1. [ ] successful InstaPay/IPN request;
2. [ ] pending request;
3. [ ] failed/declined request;
4. [ ] expired request;
5. [ ] valid signed webhook;
6. [ ] invalid signature;
7. [ ] replayed webhook;
8. [ ] lost webhook recovered by inquiry;
9. [ ] create timeout followed by inquiry/recovery;
10. [ ] duplicate webhook;
11. [ ] amount mismatch evidence;
12. [ ] late success after local expiry;
13. [ ] second real incoming transfer if provider sandbox permits it;
14. [ ] refund/reversal only if provider contract supports it;
15. [ ] reconciliation/export match.

## Activation rule

Provider-specific PAY-8 code may be enabled capability by capability, not all at once.

For example:
- documented create contract -> implement PAY-8.2 create only;
- documented webhook signature -> implement PAY-8.3 verification;
- documented inquiry -> implement PAY-8.4 and enable recovery;
- documented statement schema -> set `settlementData=true` and connect PAY-6;
- documented refund -> enable the exact refund capability only.

No documentation means capability stays false.
