# balcona-bar

Balcona Bar is organized as a monorepo for the Cafe AI Waiter App / Smart Café Operating System. Phase 5 adds the customer cart draft foundation on top of the menu, pricing, modifiers, branch availability, and table session backend foundations.

## Layout

- `apps/api` — NestJS backend application.
- `apps/api/prisma` — Prisma schema, migrations, and seed data.
- `docker-compose.yml` — local PostgreSQL and Redis services.
- `docs/architecture` — architecture decisions and phase notes.

## Local quick start

1. Install dependencies:

   ```bash
   pnpm install
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
   pnpm --filter @balcona-bar/api prisma:generate
   ```

5. Apply the local development migrations:

   ```bash
   pnpm --filter @balcona-bar/api prisma:migrate:dev
   ```

6. Seed local demo data:

   ```bash
   pnpm --filter @balcona-bar/api prisma:seed
   ```

7. Build the API:

   ```bash
   pnpm --filter @balcona-bar/api build
   ```

8. Start the API:

   ```bash
   pnpm --filter @balcona-bar/api start:dev
   ```

## API verification

The health endpoint remains outside the API prefix:

```bash
curl http://localhost:3000/health
```

Service metadata remains available at:

```bash
curl http://localhost:3000/api/v1/system/info
```

Company and branch verification endpoints:

```bash
curl http://localhost:3000/api/v1/companies
curl http://localhost:3000/api/v1/companies/balcona-bar/branches
```


Phase 3 menu verification endpoints:

```bash
curl http://localhost:3000/api/v1/companies/balcona-bar/menu
curl http://localhost:3000/api/v1/companies/balcona-bar/branches
```

To fetch the customer-facing menu for a branch, first get a branch id from the company branches endpoint, then run:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/menu
curl http://localhost:3000/api/v1/branches/<branchId>/menu/unavailable
```

To fetch a detailed menu item, first get an item id from a menu endpoint, then run:

```bash
curl http://localhost:3000/api/v1/menu/items/<itemId>
```

To list tables, first get a branch id from the company branches endpoint, then run:

```bash
curl http://localhost:3000/api/v1/branches/<branchId>/tables
```

To resolve a seeded table QR token:

```bash
curl http://localhost:3000/api/v1/tables/resolve/balcona-main-t01
```

Phase 5 customer cart draft endpoints use an active table session id:

```bash
curl http://localhost:3000/api/v1/table-sessions/<sessionId>/cart
```

To add an item to the draft cart:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/items \
  -H "Content-Type: application/json" \
  -d '{
    "menuItemId": "<menuItemId>",
    "quantity": 1,
    "notes": "Less ice",
    "selectedModifiers": [
      {
        "modifierGroupId": "<modifierGroupId>",
        "optionIds": ["<modifierOptionId>"]
      }
    ]
  }'
```

To update a cart item quantity or notes:

```bash
curl -X PATCH http://localhost:3000/api/v1/cart/items/<cartItemId> \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 2,
    "notes": "No sugar"
  }'
```

To remove a cart item:

```bash
curl -X DELETE http://localhost:3000/api/v1/cart/items/<cartItemId>
```

To clear a draft cart:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/clear
```

To validate a draft cart against the current menu and branch availability:

```bash
curl -X POST http://localhost:3000/api/v1/table-sessions/<sessionId>/cart/validate
```

Development-only staff verification:

```bash
curl http://localhost:3000/api/v1/staff
```

## Phase notes

- Phase 1 backend skeleton: `docs/architecture/phase-1-backend-skeleton.md`
- Phase 2 multi-café foundation: `docs/architecture/phase-2-multi-cafe-foundation.md`
- Phase 3 menu foundation: `docs/architecture/phase-3-menu-foundation.md`
- Phase 5 customer cart draft foundation: `docs/architecture/phase-5-customer-cart-draft-foundation.md`
