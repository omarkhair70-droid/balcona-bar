# Phase 1 Backend Skeleton

## Implemented layout

```text
apps/
  api/                 # NestJS backend application
docs/
  architecture/        # Architecture notes and decisions
docker-compose.yml     # Local PostgreSQL and Redis
```

## Backend capabilities

The Phase 1 API skeleton provides:

- NestJS application bootstrapping in `apps/api`.
- Global API prefix configured by `API_PREFIX`, defaulting to `/api/v1`.
- `/health` endpoint outside the API prefix for local and infrastructure checks.
- `/api/v1/system/info` endpoint for basic service metadata.
- Global validation pipe with transformation, whitelisting, and non-whitelisted field rejection.
- Global exception filter with a consistent JSON error response shape.
- Basic structured JSON logging.
- Environment configuration and validation through `@nestjs/config`.
- Prisma foundation with a PostgreSQL datasource using `DATABASE_URL`.
- Redis client provider for future modules.

## Local infrastructure

The root `docker-compose.yml` starts:

- PostgreSQL on `localhost:5432` with a persistent `postgres_data` volume.
- Redis on `localhost:6379` with append-only persistence and a persistent `redis_data` volume.

## Development flow

1. Copy `apps/api/.env.example` to `apps/api/.env` and adjust values if needed.
2. Start local infrastructure from the repository root:

   ```bash
   docker compose up -d
   ```

3. Generate Prisma client:

   ```bash
   npm run api:prisma:generate
   ```

4. Start the API in development mode:

   ```bash
   npm run api:dev
   ```

## Explicit non-goals

Phase 1 does not implement product modules. Menu logic, order logic, AI waiter logic, Flutter screens, and admin dashboard features remain deferred.
