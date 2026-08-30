# Balcona SaaS Billing — Paymob

Status: SOFTWARE IMPLEMENTATION IN CLOSURE / LIVE MERCHANT CERTIFICATION REQUIRED

## Separate money planes

Balcona keeps two financial planes separate.

### Restaurant/customer money
Customer -> licensed PSP/acquirer -> cafe merchant account.

### Balcona SaaS subscription money
Cafe/company -> Balcona billing PSP -> Balcona's own merchant account.

Cafe merchant credentials must not be reused for Balcona subscription billing.

## Implemented billing domain

The SaaS billing layer includes:
- provider/customer/subscription/plan references on `CompanySubscription`;
- billing environment and provider;
- payment attempts;
- invoices;
- provider events;
- period dates;
- grace/past-due state;
- last provider sync;
- audit trail.

## Paymob flow

Initial provider choice: Paymob recurring subscriptions.

Implemented software flow:
1. Balcona plan supplies EGP recurring amount.
2. Server creates/uses provider subscription plan.
3. Server creates subscription enrollment Intention.
4. Customer enters card data only on Paymob-hosted checkout.
5. Paymob transaction callback is HMAC verified.
6. Exact amount/currency/integration/environment are validated.
7. Provider subscription is resolved with authenticated server-to-server lookup.
8. Only verified transaction truth activates the Balcona subscription period.
9. Payment attempts and invoices are persisted.
10. Failed recurring charge moves subscription to `past_due` with grace state.
11. Account UI exposes sync, plan change and cancellation.

## Runtime isolation

SaaS billing uses dedicated server-only variables beginning with:

`SAAS_BILLING_PAYMOB_...`

These are intentionally separate from restaurant Paymob configuration.

Production enables SaaS billing only when the required Balcona billing credentials, 3DS/MOTO integration IDs, callback URLs and live expectation are configured.

## Callback rules

The transaction callback is HMAC verified before financial persistence.

The public subscription webhook surface reviewed during closure is treated only as a trigger: Balcona re-reads subscription state using authenticated provider credentials instead of trusting an unverified webhook body as financial authority.

## Live gate

Software completion does not mean live billing verification.

Live certification still requires Balcona merchant onboarding, live subscription capability, live credentials/integrations, registered callback URLs and a controlled subscription transaction demonstrating the recurring lifecycle.
