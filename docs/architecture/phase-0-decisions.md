# Phase 0 Decisions

## Scope

Balcona Bar starts as a monorepo so backend, future client apps, infrastructure, and documentation can evolve together without premature repository coordination overhead.

## Initial boundaries

- `apps/api` owns the NestJS backend skeleton.
- Root-level `docker-compose.yml` owns local developer infrastructure.
- `docs/architecture` owns decision records and implementation notes.

## Technology decisions

- **Backend framework:** NestJS, selected for modular structure, dependency injection, validation, and a clear path for future product modules.
- **Database:** PostgreSQL, selected as the transactional system of record.
- **ORM:** Prisma, selected for typed database access and migration workflows.
- **Cache/ephemeral store:** Redis, selected for future caching, rate limiting, sessions, queues, or realtime coordination.
- **Configuration:** Environment-based configuration through `@nestjs/config`.
- **Local infrastructure:** Docker Compose with persistent volumes for PostgreSQL and Redis.

## Deferred decisions

The following are intentionally out of scope for Phase 1:

- Menu domain modeling and logic.
- Ordering workflows.
- AI waiter features.
- Flutter application screens.
- Admin dashboard features.
- Production deployment topology.
