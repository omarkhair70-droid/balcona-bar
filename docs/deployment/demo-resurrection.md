# Demo Resurrection Runbook

## Goal

Restore Balcona Bar as a reliable flagship demo without treating the expired
Railway runtime as a source-code failure and without pulling future SaaS,
billing, or production-AWS work into the demo finish line.

The demo acceptance path is:

customer/table QR -> menu -> cart/order -> cashier -> kitchen/barista ->
waiter/service -> owner/operations.

## Current Source State

The repository already contains the full operational demo spine:

- customer QR/table session, menu, modifiers, cart, submit, status, waiter call,
  bill request, and AI waiter surfaces;
- cashier intake and order actions;
- kitchen/barista preparation tasks and KDS tickets;
- waiter attention and serve flow;
- owner analytics/operations;
- staff auth, roles, permissions, and branch scoping;
- menu, branch, table, QR, inventory, shift, bill/payment, onboarding, and
  platform-admin foundations;
- deterministic staging smoke bootstrap/reset/full-run tooling.

The latest main-branch CI and Docker validation were green after the final
Arabic/i18n work. The last staging reliability/performance series also recorded
zero failed full-smoke steps before its final optimization pass.

The old hosted demo becoming unavailable should therefore be treated first as
an environment/runtime loss, not as evidence that these product flows are
missing from source.

## Recommended Demo Architecture

Keep the already-existing split deployment:

- Web: Vercel project `balcona-bar-staging-web`.
- API: one persistent Docker-compatible public service.
- Postgres: Neon.
- Redis: Upstash Redis.

For the shortest resurrection path, Railway Hobby is preferred because the repo
and staging runbooks already target this architecture and require no application
rewrite. Render Free can be useful for temporary testing, but its idle spin-down
makes it a poor choice for a flagship demo that must open immediately.

Do not deploy the API as an ad-hoc laptop tunnel for the flagship demo.

## Demo-Only Scope

Required now:

- stable public API URL;
- reachable Postgres and Redis;
- all Prisma migrations applied;
- deterministic demo/staging data present;
- Vercel rebuilt against the new API base URL;
- clean full smoke run with zero failed steps;
- one manual browser walk through the flagship journey.

Explicitly not required for demo closure:

- public SaaS signup;
- subscription billing;
- real payment gateway;
- AWS/ECS migration;
- multi-tenant self-service completion;
- production-grade AI provider guarantees;
- POS integrations;
- refunds or raw-card handling.

Mock online payment may remain enabled only in `APP_ENV=staging`.

## API Runtime Environment

Minimum runtime configuration:

```text
NODE_ENV=production
APP_ENV=staging
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=<neon postgres connection string>
REDIS_URL=<upstash redis connection string>
CORS_ORIGINS=https://balcona-bar-staging-web.vercel.app
STAFF_AUTH_SESSION_HOURS=12
PLATFORM_AUTH_SESSION_HOURS=12
CUSTOMER_ACCESS_TOKEN_HOURS=24
SWAGGER_ENABLED=false
JOBS_ENABLED=true
ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_PROVIDER=mock
MOCK_ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_CHECKOUT_BASE_URL=https://balcona-bar-staging-web.vercel.app
SMOKE_BOOTSTRAP_ENABLED=true
SMOKE_BOOTSTRAP_TOKEN=<strong staging-only token>
SMOKE_RESET_TOKEN=<strong staging-only token>
```

AI waiter can run with `AI_WAITER_PROVIDER=stub` for deterministic demo closure.
If Groq credentials are intentionally available, switch to
`AI_WAITER_PROVIDER=groq`; AI quality must not block the operational demo.

Never enable development password bootstraps on the public demo runtime.

## Resurrection Sequence

1. Confirm the existing Neon database and Upstash Redis still exist.
2. If either expired, create a new staging-only instance and update only the API
   environment variables. No code change is required.
3. Create/reconnect the persistent API service to this repository and build with
   `apps/api/Dockerfile`.
4. Run:
   ```bash
   pnpm --filter @balcona-bar/api prisma:generate
   pnpm --filter @balcona-bar/api prisma:migrate:deploy
   ```
5. Start the API and verify:
   - `GET /health`
   - `GET /api/v1/system/info`
6. Point Vercel production env at:
   ```text
   NEXT_PUBLIC_API_BASE_URL=https://<stable-api-host>/api/v1
   NEXT_PUBLIC_APP_ENV=staging
   ```
7. Redeploy `balcona-bar-staging-web`.
8. Configure `.env.smoke.local` from `.env.smoke.example`.
9. Run:
   ```bash
   pnpm smoke:reset:staging
   pnpm smoke:bootstrap:staging
   pnpm smoke:staging:full
   ```
   or:
   ```bash
   pnpm smoke:staging:clean-full
   ```
10. Require `failed = 0`. Warnings about latency should be reviewed, but future
    SaaS/billing work is not a demo blocker.
11. Manually walk:
    - `/demo/balkona`
    - customer QR/table open
    - menu/modifiers/cart/submit
    - cashier accept
    - kitchen/barista start + ready
    - waiter serve/service call
    - customer bill request
    - staff bill present/manual or staging mock settlement
    - owner dashboard/analytics

## Go / No-Go

GO when:

- Vercel web is READY and targets the new stable API;
- API health and system-info are reachable;
- migrations are current;
- clean full smoke reports zero failed steps;
- the manual flagship journey completes once from a freshly reset demo state.

NO-GO only for failures in that journey or infrastructure required by it.
Future SaaS, billing, AWS, POS, and production-hardening items stay outside this
finish line.
