# Permanent Staging API Runtime

Product Phase 4DEPLOY.2 moves Balcona Bar staging away from a laptop-hosted API
and temporary Cloudflare Tunnel. The staging Web can stay on Vercel, but the API
must run on a permanent Docker-compatible host so client demos and product smoke
do not depend on a developer machine.

The target remains provider-agnostic, with a simple recommended path:

- Web: Vercel-compatible Next.js hosting.
- API: persistent Docker-compatible host such as Render, Railway, Fly, or a VPS.
- Database: Neon Postgres or another managed Postgres.
- Redis: Upstash Redis or another managed Redis.

No public signup, real payment gateway, SaaS billing, or new product behavior is
introduced in this phase.

## Architecture

Traffic enters the Web origin first. Browser API calls use
`NEXT_PUBLIC_API_BASE_URL`, which must point to the public API URL including the
API prefix, for example `https://api-staging.example.com/api/v1`.

The API runs as a production NestJS process from the `apps/api/Dockerfile`.
Prisma reads `DATABASE_URL`; Redis reads `REDIS_URL` when available. The API
allows Web traffic through `CORS_ORIGINS`.

Use `NODE_ENV=production` for the hosted Node runtime. Set `APP_ENV=staging` for
staging-only product policy such as mock online payments. True production should
omit `APP_ENV=staging` and keep mock payment actions disabled.

## Required Staging URLs

- Web URL: `https://staging.example.com`
- API URL: `https://api-staging.example.com`
- Browser API base URL: `https://api-staging.example.com/api/v1`
- API health: `https://api-staging.example.com/health`
- API info: `https://api-staging.example.com/api/v1/system/info`

## API Environment

Required:

```text
NODE_ENV=production
APP_ENV=staging
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://USER:PASSWORD@NEON_HOST/DB?sslmode=require&schema=public
REDIS_URL=rediss://default:PASSWORD@UPSTASH_HOST:6379
CORS_ORIGINS=https://staging.example.com
STAFF_AUTH_SESSION_HOURS=12
PLATFORM_AUTH_SESSION_HOURS=12
CUSTOMER_ACCESS_TOKEN_HOURS=24
JOBS_ENABLED=true
SWAGGER_ENABLED=false
```

Staging bootstrap only:

```text
PLATFORM_ADMIN_BOOTSTRAP_ENABLED=true
PLATFORM_ADMIN_EMAIL=admin@example.com
PLATFORM_ADMIN_NAME=Staging Platform Admin
PLATFORM_ADMIN_PASSWORD=<strong generated password>
```

Set `PLATFORM_ADMIN_BOOTSTRAP_ENABLED=false` immediately after the one-time
bootstrap command succeeds.

Development bootstrap flags must stay false for deployed environments:

```text
STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=false
PLATFORM_ADMIN_DEV_BOOTSTRAP_ENABLED=false
```

Optional AI provider:

```text
AI_WAITER_PROVIDER=stub
AI_WAITER_MENU_SNAPSHOT_LIMIT=200
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_CONTEXT_ITEMS=8
GROQ_DRY_RUN=true
```

Keep `GROQ_API_KEY` only on the API runtime. Never expose it as a
`NEXT_PUBLIC_*` variable.

Online payments remain mock/provider-agnostic in this phase:

```text
ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_PROVIDER=mock
MOCK_ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_CHECKOUT_BASE_URL=https://staging.example.com
```

Mock payment actions are allowed only because `APP_ENV=staging` is set. Do not
collect card data until a real payment provider phase is implemented.

## Web Environment

Required:

```text
NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com/api/v1
```

This value is browser-visible and must not contain secrets. For Vercel-style
hosting, configure:

- Root directory: repo root.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm --filter @balcona-bar/web build`.
- Output: Next.js default.
- Environment: `NEXT_PUBLIC_API_BASE_URL`.

## API Docker Deployment

Choose a permanent API host with:

- a stable public HTTPS URL
- support for Docker builds from this repository
- a secret/environment variable manager
- a configurable health check path
- manual one-off commands or jobs for Prisma migrations and platform admin
  bootstrap
- logs that can be inspected without printing secret values

Recommended health check:

```text
/health
```

The route is intentionally outside `API_PREFIX` so host health checks can call
`https://api-staging.example.com/health`. The API metadata route remains
`https://api-staging.example.com/api/v1/system/info`.

Build:

```bash
docker build -f apps/api/Dockerfile -t balcona-api:staging .
```

Run Prisma generation and migrations before rolling out the new API image:

```bash
pnpm install --frozen-lockfile
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api prisma:migrate:deploy
```

If the target database is new or SaaS plans are missing, seed plans/demo data
intentionally:

```bash
pnpm --filter @balcona-bar/api prisma:seed
```

For a clean staging tenant, seeding SaaS plans is required before platform
company creation because `/platform/companies/new` reads active plans. The seed
also creates the demo Balkona dataset, so do it only when that data is expected
in staging.

Start command inside the API image:

```bash
node dist/src/main.js
```

The process reads `PORT` from the environment.

## Permanent API Host Runbook

1. Create a Docker-backed API service from this repository.
2. Use `apps/api/Dockerfile` as the Dockerfile path.
3. Configure the service to listen on the host-provided `PORT`.
4. Set all API environment variables from the `API Environment` section.
5. Set the health check path to `/health`.
6. Run `pnpm --filter @balcona-bar/api prisma:generate`.
7. Run `pnpm --filter @balcona-bar/api prisma:migrate:deploy` against Neon.
8. Run `pnpm --filter @balcona-bar/api prisma:seed` only if SaaS plans are not
   present or the demo dataset is intentionally wanted.
9. Run the platform admin bootstrap command once, then disable
   `PLATFORM_ADMIN_BOOTSTRAP_ENABLED`.
10. Deploy or restart the API service and confirm `/health` and
    `/api/v1/system/info`.
11. Update Vercel staging Web `NEXT_PUBLIC_API_BASE_URL` to the permanent API
    URL including `/api/v1`.
12. Redeploy the Vercel staging Web so browser clients stop using the temporary
    Cloudflare Tunnel URL.
13. Run the automated and manual staging smoke tests.

## Platform Admin Bootstrap

Use the dedicated one-time command after migrations:

```bash
PLATFORM_ADMIN_BOOTSTRAP_ENABLED=true \
PLATFORM_ADMIN_EMAIL=admin@example.com \
PLATFORM_ADMIN_NAME="Staging Platform Admin" \
PLATFORM_ADMIN_PASSWORD="<strong generated password>" \
pnpm deploy:api:bootstrap
```

PowerShell:

```powershell
$env:PLATFORM_ADMIN_BOOTSTRAP_ENABLED="true"
$env:PLATFORM_ADMIN_EMAIL="admin@example.com"
$env:PLATFORM_ADMIN_NAME="Staging Platform Admin"
$env:PLATFORM_ADMIN_PASSWORD="<strong generated password>"
pnpm deploy:api:bootstrap
$env:PLATFORM_ADMIN_BOOTSTRAP_ENABLED="false"
```

The command upserts one active platform owner admin and never prints the
password. Store the password in the deployment secret manager, rotate it after
handoff, and disable the bootstrap flag after use.

`pnpm --filter @balcona-bar/api prisma:seed` still exists for local/demo data.
Do not use it as the default staging bootstrap unless you intentionally want the
demo Balkona dataset in that environment.

## Seed And Cafe Setup

For a clean staging tenant:

1. Log in to `/platform/login`.
2. Open `/platform/companies/new`.
3. Create the cafe workspace with starter tables.
4. Use `/staff/setup` to finish branch readiness.
5. Use `/staff/billing` to confirm SaaS status.

This keeps staging data created through the product surface instead of fake
seed data.

## Smoke Test

Automated route check:

```bash
WEB_BASE_URL=https://staging.example.com \
API_BASE_URL=https://api-staging.example.com/api/v1 \
./scripts/deploy/staging-smoke.sh
```

PowerShell:

```powershell
.\scripts\deploy\staging-smoke.ps1 `
  -WEB_BASE_URL https://staging.example.com `
  -API_BASE_URL https://api-staging.example.com/api/v1
```

Manual smoke steps are in `docs/deployment/staging-smoke-test.md`.

Minimum authenticated smoke after permanent API deploy:

1. Log in at `/platform/login`.
2. Create a cafe workspace from `/platform/companies/new` using plan `pilot`,
   status `active`, and at least two starter tables.
3. Open the created company detail page.
4. Set the owner staff password through the documented staging handoff.
5. Log in at `/staff/login`.
6. Open the first returned `/customer/table/<qrToken>` example.
7. Confirm no visible page renders `[object Object]`.

## Common Errors

- API health fails: confirm the API host exposes `PORT` and the container starts
  with the configured environment.
- Web cannot call API: confirm `NEXT_PUBLIC_API_BASE_URL` includes `/api/v1`
  and `CORS_ORIGINS` exactly includes the Web origin.
- Prisma migration fails: confirm `DATABASE_URL` points at the managed
  Postgres database and use `prisma:migrate:deploy`, not `migrate dev`.
- Platform login fails: confirm the platform admin bootstrap command ran after
  migrations and the password came from the same secret value.
- Redis connection fails: prefer `REDIS_URL`; use `rediss://` if the provider
  requires TLS.

## Backup And Rollback

- Enable managed Postgres backups before staging traffic.
- Take a database snapshot before migrations.
- Keep the previous API image and Web deployment available until smoke passes.
- Rollback usually means redeploying the previous API/Web image.
- If a migration is destructive, restore the database snapshot as part of the
  rollback. Current migrations should remain additive unless a future phase
  documents otherwise.

## What This Phase Does Not Do

- No auto-deploy workflow.
- No final AWS provider choice.
- No real payment gateway.
- No SaaS billing provider.
- No public signup.
