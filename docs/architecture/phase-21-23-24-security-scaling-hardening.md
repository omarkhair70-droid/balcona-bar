# Phases 21, 23, and 24 Security, Scaling, and Hardening

This phase completes the backend foundation needed before UI Phase 1. It adds staff auth/session primitives, customer table-session access-token primitives, API hardening, OpenAPI generation, BullMQ queue foundations, and a backend QA checklist. PostgreSQL remains the source of truth; Redis and BullMQ are side-effect/scaling infrastructure only.

## Staff Auth and Sessions

`StaffUser` now supports nullable password metadata: `passwordHash`, `passwordSetAt`, and `lastLoginAt`. `StaffSession` stores opaque staff access-token hashes, scope, status, expiry, revocation, last-use metadata, user agent, and IP address. Raw tokens are returned only once at login and are never stored.

Staff auth endpoints:

- `POST /api/v1/staff-auth/dev/bootstrap-password`
- `POST /api/v1/staff-auth/login`
- `GET /api/v1/staff-auth/me`
- `POST /api/v1/staff-auth/logout`

The bootstrap endpoint is for local/dev setup. It is disabled in production unless `STAFF_AUTH_DEV_BOOTSTRAP_ENABLED=true`.

## Permission Guard Rollout

`StaffSessionGuard` validates bearer tokens and writes staff/session/access context onto the request. The existing `StaffPermissionGuard` can then enforce `@RequiredPermission(...)`; a `RequirePermissions` alias is available for future rollout naming.

This PR applies staff auth and permission guards to the new jobs status endpoints. It does not globally enforce auth across all existing staff/admin endpoints, so customer QR/menu/cart flows remain compatible and staff UI integration can roll guards onto route groups deliberately.

New permissions include:

- `auth.read`
- `auth.manage`
- `system.jobs.read`
- `system.jobs.manage`
- `system.docs.read`
- `security.read`
- `security.manage`

`owner` receives all permissions. `branch_manager` receives read-level auth/jobs/docs/security permissions. Other roles do not receive system/security permissions by default.

## Customer Table-Session Access

`CustomerSessionIdentity` now stores a hashed access token, token status, expiry, and last-used timestamp. Starting or resuming a table session returns `customerAccess.customerAccessToken` once so the future PWA can prove ownership of a table session.

Existing customer endpoints remain backwards-compatible in this phase. The next UI integration can require the token for customer reads/mutations without putting secrets into QR tokens.

## API Hardening

The bootstrap now adds:

- `x-request-id` propagation/generation.
- basic security headers.
- CORS configuration through `CORS_ORIGINS`.
- global validation and exception filtering remain in place.

Rate limiting is documented as a production hardening follow-up. It was not added here to avoid introducing broad behavior changes before UI integration.

## OpenAPI

Swagger/OpenAPI is enabled by default with:

- `/api/docs`
- `/api/openapi.json`

Set `SWAGGER_ENABLED=false` to disable docs generation. DTO-level decoration is intentionally minimal; this is a foundation for future typed UI client generation.

## BullMQ and Redis

`JobsModule` creates a BullMQ queue foundation for:

- `notifications`
- `attention`
- `analytics`
- `cleanup`
- `ai_waiter`

Queues are for side effects, retries, cleanup, and future worker processes. Core order/cart/bill/waiter writes remain synchronous PostgreSQL transactions. Queue add/status operations catch Redis failures rather than crashing core API flows.

Guarded job status endpoints:

- `GET /api/v1/system/jobs/health`
- `GET /api/v1/system/jobs/queues`

Processor stubs exist for notification delivery, attention jobs, analytics snapshots, cleanup jobs, and AI waiter summaries. Production can run dedicated workers later.

## Redis and Realtime Scaling

SSE remains the realtime transport. The current durable pattern is:

- PostgreSQL stores every `RealtimeEvent`.
- SSE emits events to connected clients.
- clients can reconnect and fetch stored events.

Future multi-instance scaling can add Redis pub/sub fanout between API instances without replacing SSE or moving durable realtime state out of PostgreSQL.

## Limitations

- No UI, PWA, or Flutter implementation.
- No real payment/POS integration.
- No external AI provider integration.
- No real file upload/storage provider.
- Not every existing staff endpoint is auth-enforced yet.
- No production deployment-specific rate limiting or firewall config.

