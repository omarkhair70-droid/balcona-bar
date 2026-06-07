# Staging Smoke Test

Use this after staging API and Web are deployed. The current permanent staging
target is Vercel Web pointing to the Railway API, with Railway connected to Neon
Postgres plus Upstash Redis.

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

5. Start or restart the API on Railway, or expose it through the current
   Cloudflare Tunnel URL only when using a laptop-hosted fallback.
6. Confirm Vercel staging web has `NEXT_PUBLIC_API_BASE_URL` set to the Railway
   API `/api/v1` URL and `NEXT_PUBLIC_APP_ENV=staging`, then redeploy if
   changed. Do not use `localhost` or `*.trycloudflare.com` in the staging
   Vercel env.
7. Open `/platform/login` and log in as the platform admin.
8. Open `/platform/status` and confirm the Web API target is Railway, the API
   metadata loads, `APP_ENV=staging`, and `NODE_ENV=production`.
9. Open `/platform/companies`.
10. Open `/platform/companies/new` and create a cafe workspace:
   - plan: `pilot`
   - status: `active`
   - starter tables: enabled
   - count: `2` or more
11. Confirm the response page shows the company, branch, subscription, owner
   staff user handoff, starter tables, and customer QR examples.
12. Open the first returned QR example, `/customer/table/<qrToken>`, and start a
    customer table session.
13. Open the created company detail page, generate a staff invite for the owner
    or manager, and copy the returned `/staff/invite/<inviteToken>` link.
14. Open the invite link, set a staff password, then log in at `/staff/login`
    with the invited staff email.
15. Open `/staff/setup` and `/staff/billing` and confirm the staff routes load
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
- platform companies: `/platform/companies`
- platform diagnostics: `/platform/status`
- cafe creation page: `/platform/companies/new`
- staff login: `/staff/login`
- setup page: `/staff/setup`
- billing page: `/staff/billing`
- customer QR route: `/customer/table/balcona-main-t01`
- no fetched page contains `[object Object]`
- API URL is not `localhost`, `127.0.0.1`, `.localhost`, or
  `*.trycloudflare.com`

## Manual Authenticated Smoke

1. Open `/platform/login`.
2. Log in with the staging platform admin created from env-provided credentials.
3. Open `/platform/status` and confirm the Web API target and API metadata.
4. Open `/platform/companies`.
5. Open `/platform/companies/new`.
6. Create a test cafe workspace with plan `pilot`, status `active`, starter
   tables enabled, and at least two tables.
7. Open the created company detail page and confirm plan, usage, and status
   render without raw object errors.
8. Open the company detail page, generate a staff invite for the owner or
   manager, and copy the `/staff/invite/<inviteToken>` link.
9. Open the invite link and set a password of at least 12 characters.
10. Log in at `/staff/login` with the invited staff email and new password.
11. Open `/staff/setup` and confirm branch/table/setup readiness cards load.
12. Open `/staff/billing` and confirm SaaS plan/status appears.
13. Open `/customer/table/:qrToken` for the first returned QR example and
    confirm a customer session can start.
14. If seeded menu data is intentionally available in that staging cafe, submit
    a basic customer order and confirm the cashier sees it.
15. Confirm no visible page renders `[object Object]`.

The smoke does not require a real payment gateway. Mock online payment should
remain explicit and staging-only until a real provider is added.
