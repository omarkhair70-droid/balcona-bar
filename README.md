# balcona-bar

Balcona Bar is organized as a monorepo. Phase 1 establishes the backend skeleton, local infrastructure, and architecture documentation only.

## Layout

- `apps/api` — NestJS backend application.
- `docker-compose.yml` — local PostgreSQL and Redis services.
- `docs/architecture` — architecture decisions and phase notes.

## Phase 1 quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the API environment example:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. Start local infrastructure:

   ```bash
   docker compose up -d
   ```

4. Generate the Prisma client:

   ```bash
   npm run api:prisma:generate
   ```

5. Start the API:

   ```bash
   npm run api:dev
   ```

The health endpoint is exposed at `/health`; service metadata is exposed at `/api/v1/system/info`.
