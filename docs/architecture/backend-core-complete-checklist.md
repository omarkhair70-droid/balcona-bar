# Backend Core Complete Checklist

Use this checklist before merging backend-core changes or before starting UI Phase 1.

## Local Setup

- Install dependencies.
- Copy API environment variables.
- Confirm `DATABASE_URL` and Redis settings.
- Run Prisma generate.
- Apply migrations in the approved local workflow.
- Seed demo data.
- Build the API.

## Smoke Coverage

- Health endpoint responds.
- System info responds.
- Companies and branches list.
- Branch menu and item details load.
- Table QR resolves.
- Table session starts/resumes and returns `customerAccess`.
- Draft cart reads, validates, adds, updates, removes, and clears.
- Cart submit creates an order with idempotency.
- Smart Cashier settings read/update and evaluate.
- Cashier order accept/reject works.
- Preparation queues list/start/ready/cancel.
- Waiter calls create/acknowledge/resolve/cancel.
- Bill request/request status/acknowledge/present/close/cancel works.
- Realtime branch and table-session SSE streams open.
- Stored realtime events list.
- AI waiter starts, chats, proposes, applies/rejects proposal, escalates.
- Autopilot attention reads/recalculates/resolves/mutes/rebuilds.
- Analytics overview/menu/staff-action endpoints read.
- Audit logs read by branch and company.
- Staff auth dev bootstrap/login/me/logout works.
- Job queue health and queue status endpoints respond with staff bearer auth.
- Swagger docs and OpenAPI JSON load when enabled.

## Safety Checks

- No raw password hashes returned.
- Staff auth tokens are returned only once and stored hashed.
- Customer access tokens are returned only on session start/resume and stored hashed.
- Redis/BullMQ failures do not break core synchronous writes.
- Customer endpoints remain backwards-compatible until the PWA token guard rollout.
- Staff-only route guard rollout is documented before UI integration.

## Deferred Production Work

- Full auth enforcement across staff/admin route groups.
- Customer access-token enforcement across PWA table-session endpoints.
- Production rate limiting and firewall rules.
- Dedicated BullMQ worker process deployment.
- External notification delivery.
- Real payment/POS integration.
- External AI provider integration.
- Real file upload/storage provider.

