# Balcona Payments Total Closure Status

Owning branch: `closure/payments-total-closure`  
Owning PR: #160

## Restaurant / customer payments

| Area | Software state |
| --- | --- |
| Guest real checkout | Implemented |
| Billing identity collection | Implemented |
| Provider capability discovery | Implemented |
| Paymob hosted checkout | Implemented |
| Paymob verified callbacks/recovery/operations | Preserved from PAY-1..PAY-6 |
| Fawry hosted checkout/recovery/refund | Preserved and exposed |
| Merchant integration per company/branch | Implemented |
| Runtime secret references | Implemented |
| Service unresolved-payment guard | Implemented |
| Office Money operations/reconciliation UX | Implemented / final QA pending |
| Setup payment readiness | Implemented / final QA pending |

## Commercial IPN / PAY-8

Provider-neutral architecture is implemented.

Maestr provider-specific financial execution remains fail-closed pending the exact merchant contract. This is tracked in:
- `PAY8_COMMERCIAL_IPN_PROVIDER_GATE.md`
- `PAY8_MAESTR_MERCHANT_CONTRACT_CHECKLIST.md`
- `PAY8_EXECUTION_MASTER.md`

## Direct terminal / PAY-9

Provider-neutral device/request domain and product readiness UX are implemented.

Direct terminal/SoftPOS provider execution remains externally blocked until an exact merchant terminal contract and test device are verified.

`card_pos` remains a manual external-tender record, not device control.

## Balcona SaaS billing / BILL-1

Real provider-backed billing software is implemented around an isolated Balcona Paymob merchant configuration:
- enrollment checkout;
- recurring subscription state;
- verified transaction HMAC;
- authenticated provider sync;
- invoices;
- payment attempts;
- past-due/grace state;
- plan changes;
- cancellation;
- Account billing UI.

Live certification is still external.

## Final classification rule

The branch may be classified as **PAYMENT SOFTWARE READY** only after current CI, API tests, Docker builds and visual QA are green.

It may be classified as **LIVE PAYMENTS VERIFIED** only after real merchant onboarding and controlled live evidence for the enabled provider paths.

Until the software gates are green, status remains **PAYMENTS IN CLOSURE**.
