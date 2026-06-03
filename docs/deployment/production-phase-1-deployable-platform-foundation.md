# Production Phase 1 Deployable Platform Foundation

## Goal

Production Phase 1 prepares Balcona Bar for production-style deployment without
choosing the final cloud provider. Local Docker/Postgres/Redis development stays
intact, while the repo gains container build files, a production compose
example, deployment environment guidance, and smoke-test documentation.

This phase does not add SaaS admin UI, payments, POS, fake data, backend
behavior changes, or a final AWS topology.

## Target Architecture

- Web runtime: Next.js app served as a production web process on port `3001`.
- API runtime: NestJS API served as a production Node.js process on port `3000`.
- Postgres: persistent relational store used by Prisma.
- Redis: realtime, jobs, and operational cache dependency.
- Browser traffic reaches the web origin and calls the public API base URL.
- Operators run migrations before starting a new API release.

## Web Runtime

Build and start the web app in production mode:

```bash
pnpm --filter @balcona-bar/web build
pnpm --filter @balcona-bar/web start
```

Required production env:

- `NEXT_PUBLIC_API_BASE_URL` - public browser-facing API base URL, for example
  `https://api.example.com/api/v1`.

The Dockerfile at `apps/web/Dockerfile` accepts `NEXT_PUBLIC_API_BASE_URL` as a
build argument because public Next.js values are bundled for browser usage.

## API Runtime

Build and start the API in production mode:

```bash
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api start:prod
```

Required production env:

- `NODE_ENV=production`
- `PORT=3000`
- `API_PREFIX=api/v1`
- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ORIGINS`

Recommended production env:

- `SWAGGER_ENABLED=false` unless API docs should be public in that environment.
- `STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=false`
- `STAFF_AUTH_SESSION_HOURS=12`
- `CUSTOMER_ACCESS_TOKEN_HOURS=24`
- `JOBS_ENABLED=true`

Current staff and customer access tokens are opaque database-backed tokens stored
as hashes. No JWT signing secret is required by the current backend. If a later
phase introduces JWTs or signed cookies, that phase should add the required
secret variables and rotation notes.

Optional future provider placeholders:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

Keep optional provider keys unset until their integrations are actually enabled.

## Postgres

Production requires a persistent Postgres database. Prisma reads the connection
from `DATABASE_URL`.

Example:

```text
postgresql://USER:PASSWORD@HOST:5432/balcona_bar?schema=public
```

Do not use local demo passwords outside local development.

## Redis

Production requires Redis. Prefer `REDIS_URL`:

```text
redis://HOST:6379/0
rediss://HOST:6379/0
```

Use `rediss://` when the provider requires TLS.

## Environment Files

Use the checked-in examples as templates only:

- `apps/api/.env.example`
- `apps/web/.env.example`

For production-style compose, create local files that are not committed:

- `apps/api/.env.production`
- `apps/web/.env.production`

Never commit real credentials, database URLs, Redis passwords, or provider keys.

## Migrations

Run migrations before starting the new API release:

```bash
pnpm install --frozen-lockfile
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api prisma migrate deploy
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/web build
```

The root helper script is also available:

```bash
pnpm api:prisma:migrate:deploy
```

## Docker Images

Production-style Dockerfiles:

- `apps/api/Dockerfile`
- `apps/web/Dockerfile`

Build examples:

```bash
docker build -f apps/api/Dockerfile -t balcona-api:prod .
docker build -f apps/web/Dockerfile -t balcona-web:prod \
  --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api/v1 .
```

The images intentionally keep the workspace build simple and reliable. Provider
specific image size optimization can happen in AWS Phase 2.

## Compose Example

`docker-compose.prod.example.yml` shows a production-style local topology:

- `api`
- `web`
- `postgres`
- `redis`
- env file usage
- health checks
- ports
- persistent Postgres and Redis volumes

It is an example, not the final AWS infrastructure.

## Health Checks

Expected URLs:

- API health: `http://localhost:3000/health`
- API metadata: `http://localhost:3000/api/v1/system/info`
- Web root: `http://localhost:3001/`
- Demo launcher: `http://localhost:3001/demo/balkona`
- Customer demo table: `http://localhost:3001/customer/table/balcona-main-t01`
- Staff login: `http://localhost:3001/staff/login`

## Smoke Test

1. Apply migrations with `pnpm api:prisma:migrate:deploy`.
2. Start Postgres and Redis.
3. Start the API.
4. Start the web app with `NEXT_PUBLIC_API_BASE_URL` pointing to the public API.
5. Open `/health` and confirm the API returns healthy.
6. Open `/` and `/demo/balkona`.
7. Open `/customer/table/balcona-main-t01` and confirm the table session starts.
8. Open `/staff/login` and confirm the login form renders.
9. If seeded demo data is available, submit a customer order and verify staff
   dashboards load the operational flow.

## Rollback Notes

- Keep the previous API and web images available until the smoke test passes.
- If API startup fails after deployment, stop the new API process and restart
  the previous image against the same database.
- Prisma migrations are forward-only. For risky migrations, prepare a manual
  database rollback plan before deploy.
- Do not run `prisma migrate dev` in production.
- Keep database backups before migration deploys.

## Remaining AWS Phase 2 Work

- Choose AWS services for web hosting, API runtime, Postgres, Redis, secrets,
  logs, metrics, and networking.
- Add CI/CD image builds and deployment promotion.
- Add managed secrets and environment injection.
- Add production log aggregation and alerting.
- Add TLS, custom domains, WAF/rate-limiting decisions, and backup policies.
- Decide whether to split worker/job runtime from the API process.
