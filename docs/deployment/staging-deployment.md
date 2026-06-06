# Staging Deployment Foundation

Product Phase 4DEPLOY.0 prepares Balcona Bar for a real staging deployment
without choosing a final paid provider. The target is provider-agnostic, with a
simple recommended path:

- Web: Vercel-compatible Next.js hosting.
- API: Docker-compatible host such as Render, Railway, Fly, or a VPS.
- Database: managed Postgres.
- Redis: managed Redis.

No public signup, real payment gateway, SaaS billing, or new product behavior is
introduced in this phase.

## Architecture

Traffic enters the Web origin first. Browser API calls use
`NEXT_PUBLIC_API_BASE_URL`, which must point to the public API URL including the
API prefix, for example `https://api-staging.example.com/api/v1`.

The API runs as a production NestJS process from the `apps/api/Dockerfile`.
Prisma reads `DATABASE_URL`; Redis reads `REDIS_URL` when available. The API
allows Web traffic through `CORS_ORIGINS`.

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
PORT=3000
API_PREFIX=api/v1
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?schema=public
REDIS_URL=redis://HOST:6379/0
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
GROQ_DRY_RUN=false
```

Keep `GROQ_API_KEY` only on the API runtime. Never expose it as a
`NEXT_PUBLIC_*` variable.

Online payments remain mock/provider-agnostic in this phase:

```text
ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_PROVIDER=mock
MOCK_ONLINE_PAYMENTS_ENABLED=false
ONLINE_PAYMENT_CHECKOUT_BASE_URL=https://staging.example.com
```

Do not collect card data until a real payment provider phase is implemented.

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

Build:

```bash
docker build -f apps/api/Dockerfile -t balcona-api:staging .
```

Run migrations before rolling out the new API:

```bash
pnpm install --frozen-lockfile
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api prisma:migrate:deploy
```

Start command inside the API image:

```bash
node dist/src/main.js
```

The process reads `PORT` from the environment.

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
