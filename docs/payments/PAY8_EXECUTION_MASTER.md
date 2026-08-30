# PAY-8 — Commercial IPN Execution State

Owning branch: `closure/payments-total-closure`  
Owning PR: #160  
Legacy draft: #116 (superseded source material; do not merge)

## Completed provider-neutral work

- [x] Maestr provider enum/domain slot
- [x] provider capability registry
- [x] `bankTransferOrIpn` capability
- [x] optional/generic provider integration references
- [x] redirect/deep-link/QR/display-reference customer actions
- [x] Guest rendering for provider-neutral actions
- [x] explicit provider resolution
- [x] server-only Maestr config placeholders
- [x] production Maestr startup rejection
- [x] create-payment fail-closed gate
- [x] tests preventing fallback to mock

## Provider-specific work blocked by merchant contract

- [ ] create commercial IPN payment request
- [ ] verified webhook implementation
- [ ] authoritative inquiry/recovery
- [ ] exact expiry/late-transfer handling
- [ ] refund/reversal, if commercially supported
- [ ] provider statement ingestion
- [ ] live commercial certification

## Required safety behavior

Unknown provider financial behavior fails closed.

A duplicate delivery is deduplicated. A second genuine bank transfer is a separate financial movement and must not settle an already-paid bill again.

No personal InstaPay account, screenshot proof, SMS proof, or browser-success state is payment authority.

## Software status

PAY-8 can be considered **provider-neutral software ready** only when the total payment PR is green and this documented external contract gate remains visibly blocked.

It cannot be called **live verified** until merchant onboarding, credentials, controlled real payment, verified callback/inquiry, exactly-once settlement, and reconciliation evidence exist.
