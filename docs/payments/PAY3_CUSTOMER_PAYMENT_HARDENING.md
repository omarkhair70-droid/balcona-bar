# PAY-3 — Customer Payment Hardening

Status: IMPLEMENTED ON `payments/customer-payment-hardening`

## Purpose

PAY-3 closes the customer-facing security and concurrency gaps that must be
resolved before real payment credentials are enabled.

## Customer ownership

The two customer payment routes are now guarded by the existing hashed
table-session access token:

- `POST /api/v1/customer/sessions/:sessionId/bills/:billId/online-payment-intents`
- `GET /api/v1/customer/sessions/:sessionId/online-payment-intents/:intentId`

The browser sends the existing customer access token as a Bearer token. The
guard resolves the token through `TableSessionAccessService` and requires the
token identity to belong to the exact `:sessionId` in the route.

QR knowledge alone is no longer enough to create or read a customer payment
intent.

## Payment-specific rate limiting

Customer payment routes use a Redis-backed fixed-window counter keyed by:

- payment action policy.
- customer session identity.
- table session id.

Defaults:

- create payment intent: 6 requests / 60 seconds.
- read payment intent: 60 requests / 60 seconds.

Environment overrides:

- `ONLINE_PAYMENT_RATE_LIMIT_WINDOW_SECONDS`
- `ONLINE_PAYMENT_CREATE_RATE_LIMIT_MAX`
- `ONLINE_PAYMENT_READ_RATE_LIMIT_MAX`

Production behavior is fail-closed: if the distributed Redis limiter cannot be
used, protected customer payment requests return service unavailable instead of
silently bypassing the limit.

Development/test may use an in-process bounded fallback so CI and local work do
not require a running Redis instance.

A rejected request returns HTTP 429 with `Retry-After`.

## Production mock isolation

Environment validation rejects startup when true production is configured with:

- `ONLINE_PAYMENT_PROVIDER=mock`, or
- `MOCK_ONLINE_PAYMENTS_ENABLED=true`.

The payment service also contains a defense-in-depth runtime check that refuses
customer mock intent creation in production.

Staging remains allowed to use mock payments deliberately because
`APP_ENV=staging` is distinct from `NODE_ENV=production`.

## One active payment intent per bill

PAY-3 uses two independent layers.

### Transaction advisory lock

Before checking for an existing active intent, both mock and Paymob customer
creation paths acquire a PostgreSQL transaction advisory lock namespaced by the
bill id.

This serializes competing requests across processes/API instances before either
request can decide that no active intent exists.

### Partial unique database index

A database migration adds the final invariant:

`billId` is unique among intents whose status is `pending` or
`requires_action`.

This prevents another present or future write path from persisting two active
payment intents for one bill even if it bypasses the normal service lock.

The migration intentionally does not silently clean historical duplicate active
intents. If such records exist, deployment must stop for explicit financial
reconciliation.

## What PAY-3 does not claim

- It does not add Paymob inquiry/recovery; that is PAY-4.
- It does not add refunds/capture/void; that is PAY-5.
- It does not add an edge/IP rate limit to the provider webhook because provider
  retry/source-network behavior must not be guessed. HMAC verification remains
  mandatory, and edge-layer webhook flood controls can be added with verified
  provider/network requirements.
- It does not invent missing Paymob customer billing data. The customer UI still
  needs a real collection/merchant-data decision before a Paymob checkout can be
  exercised end-to-end from the current PWA.
