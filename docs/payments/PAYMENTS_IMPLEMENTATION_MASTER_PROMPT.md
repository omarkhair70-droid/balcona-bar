# Payments Implementation Master Prompt

Use this prompt when resuming Balcona real-payments work in another engineering session.

---

Repository: omarkhair70-droid/balcona-bar

Payment source of truth:

- docs/payments/PAYMENTS_MASTER_PLAN.md
- docs/payments/PAYMENT_PROVIDER_CONTRACT.md
- docs/payments/LIVE_PAYMENT_SECURITY.md
- docs/payments/GO_LIVE_RUNBOOK.md
- docs/architecture/product-phase-4pay1-online-payment-foundation.md

Rules:

1. Inspect current main/working branch before changing code.
2. Preserve the existing guarded bill settlement foundation.
3. Do not redesign the product or replace the existing payment intent lifecycle without a concrete correctness reason.
4. The backend is source of truth for bill, amount and currency.
5. Never mark a real payment succeeded from a browser redirect.
6. Only a verified provider webhook/callback or authenticated provider inquiry may authorize success.
7. Real provider adapters must implement the provider-neutral contract and must not settle bills directly.
8. Preserve idempotency and duplicate-event protection.
9. Reject amount, currency, merchant-scope, environment or signature mismatches.
10. Never store raw card PAN/CVV and never expose provider secrets to the browser.
11. Keep mock provider available only for local/demo/test policy; production mock mutation actions must remain disabled.
12. Real payment customer routes require customer-session ownership before live money is enabled.
13. Provider-specific raw payload parsing belongs in provider adapter/webhook infrastructure, not bill business logic.
14. All new money-changing staff actions such as refund/void/capture require auth, permission, scope, audit and idempotency.
15. Do not claim live verification without a real manual payment gate documented in GO_LIVE_RUNBOOK.md.
16. No live credentials belong in git, docs, PR bodies, test fixtures or logs.
17. Prefer official provider documentation and primary sources. Re-check current provider docs before implementing a provider endpoint whose schema may have changed.
18. CI must not require real provider credentials. Provider network calls must be mockable in tests.
19. Keep each PR bounded to one payment phase and include tests plus docs updates.
20. Do not merge to main merely because implementation compiles; verify the phase acceptance criteria first.

Current provider priority:

1. Paymob hosted checkout / Intention API.
2. verified Paymob transaction callback/HMAC.
3. payment security/customer ownership.
4. inquiry/recovery.
5. refunds/void/capture.
6. reconciliation/settlements.
7. Fawry.
8. approved IPN commercial integration.
9. terminal/SoftPOS.
10. separate Balcona SaaS recurring billing.

For the requested phase:

- read all relevant existing service/controller/schema/tests first.
- state the exact current gap.
- implement the smallest complete slice.
- add focused unit/integration tests for success and failure paths.
- run or verify the repository's lint/typecheck/build/test gates.
- update payment docs if behavior or manual gates changed.
- return changed files, validation results, remaining manual requirements and the exact next phase.

If provider credentials are missing, complete all code/tests/config templates possible and stop at the documented manual gate. Do not invent credentials or bypass the provider.
