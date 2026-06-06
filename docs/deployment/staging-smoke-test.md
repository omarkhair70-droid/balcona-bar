# Staging Smoke Test

Use this after staging API and Web are deployed. The preferred staging target is
a permanent API host pointed to Neon Postgres plus Upstash Redis.

Cloudflare Tunnel quick links are transitional only. If a laptop-hosted API is
used while waiting for a permanent host, update the Vercel staging web
environment variable that points to the API whenever the laptop, API process, or
tunnel restarts.

## First Cafe Workspace Flow

1. Point the API at the staging Neon Postgres URL and Upstash Redis URL.
2. Apply database migrations:

   ```bash
   pnpm --filter @balcona-bar/api prisma:migrate:deploy
   ```

3. Seed SaaS plans and demo data if the database is new or plans are missing:

   ```bash
   pnpm --filter @balcona-bar/api prisma:seed
   ```

4. Bootstrap the platform admin from the staging-safe environment variables:

   ```bash
   pnpm --filter @balcona-bar/api platform-admin:bootstrap
   ```

5. Start or restart the API on the permanent staging host, or expose it through
   the current Cloudflare Tunnel URL only when using a laptop-hosted fallback.
6. Confirm Vercel staging web has `NEXT_PUBLIC_API_BASE_URL` set to the
   permanent API `/api/v1` URL, then redeploy or restart the web environment if
   changed.
7. Open `/platform/login` and log in as the platform admin.
8. Open `/platform/companies/new` and create a cafe workspace:
   - plan: `pilot`
   - status: `active`
   - starter tables: enabled
   - count: `2` or more
9. Confirm the response page shows the company, branch, subscription, owner
   staff user handoff, starter tables, and customer QR examples.
10. Open the first returned QR example, `/customer/table/<qrToken>`, and start a
    customer table session.
11. Open `/staff/login`, then use the staff setup/password handoff path for the
    owner account.
12. Open `/staff/setup` and `/staff/billing` and confirm the staff routes load
    without `[object Object]` errors.

## Automated Route Check

PowerShell:

```powershell
.\scripts\deploy\staging-smoke.ps1 `
  -WEB_BASE_URL https://staging.example.com `
  -API_BASE_URL https://api-staging.example.com/api/v1
```

Bash:

```bash
WEB_BASE_URL=https://staging.example.com \
API_BASE_URL=https://api-staging.example.com/api/v1 \
./scripts/deploy/staging-smoke.sh
```

This verifies:

- API health: `/health`
- API metadata: `/api/v1/system/info`
- Web root: `/`
- platform login: `/platform/login`
- cafe creation page: `/platform/companies/new`
- staff login: `/staff/login`
- setup page: `/staff/setup`
- billing page: `/staff/billing`
- customer QR route: `/customer/table/balcona-main-t01`
- no fetched page contains `[object Object]`

## Manual Authenticated Smoke

1. Open `/platform/login`.
2. Log in with the staging platform admin created from env-provided credentials.
3. Open `/platform/companies/new`.
4. Create a test cafe workspace with plan `pilot`, status `active`, starter
   tables enabled, and at least two tables.
5. Open the created company detail page and confirm plan, usage, and status
   render without raw object errors.
6. Set the owner password through the documented staff auth bootstrap path for
   staging, or use a staging-only staff credential created during setup.
7. Log in at `/staff/login`.
8. Open `/staff/setup` and confirm branch/table/setup readiness cards load.
9. Open `/staff/billing` and confirm SaaS plan/status appears.
10. Open `/customer/table/:qrToken` for the first returned QR example and
    confirm a customer session can start.
11. If seeded menu data is intentionally available in that staging cafe, submit
    a basic customer order and confirm the cashier sees it.
12. Confirm no visible page renders `[object Object]`.

The smoke does not require a real payment gateway. Mock online payment should
remain explicit and staging-only until a real provider is added.
