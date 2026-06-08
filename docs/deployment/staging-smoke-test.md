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
15. Open `/staff/setup` and confirm the branch staff invite card explains that
    branch roles receive access to the selected branch. The owner/company-level
    warning should only appear for owner-role context.
16. Create a branch staff invite, then confirm the success state shows the
    invite link, Copy link, Open invite, email, role, and branch summary.
17. Open `/staff/menu` as an owner or `menu_admin` and confirm the Overview tab
    shows category, item, modifier, branch availability, and setup warning
    counts.
18. Create a menu category with a clear slug, active status, and sort order.
19. Create a menu item in that category with an EGP base price, station, status,
    sort order, and an external `imageUrl`. Confirm the image preview renders;
    if the URL is empty or broken, the UI should show the preview fallback.
20. Edit the item price/status and confirm the success state is readable.
21. Create a modifier group and option, then attach the modifier group to the
    item if the account has full menu permissions.
22. Open the Availability tab and save a branch override for visibility,
    availability, optional price override, and sort order.
23. Open a customer QR/session for the same branch and confirm menu
    visibility, availability, and displayed price match the branch override.
24. Log in as a lower-privilege branch role such as cashier, waiter, or kitchen
    and confirm category, item, modifier, and branch override edits are not
    available unless that role has the matching menu permissions.
25. Open `/staff/branches`, copy a customer QR URL, open it in a new tab, and
    confirm a visible scannable QR image appears for a table with a token.
26. Scan the QR with a phone camera and confirm it opens the customer
    `/customer/table/<qrToken>` route and starts or resumes a table session.
27. Regenerate one non-demo table QR token with confirmation. Confirm the token
    changes, the old `/customer/table/<oldToken>` no longer opens, and the new
    QR image scans/opens `/customer/table/<newToken>` correctly.
28. Log in as a lower-privilege branch staff role such as cashier or waiter and
    confirm QR regeneration is not available.
29. Open `/staff/billing` and confirm the staff routes load without
    `[object Object]` errors.

Menu media upload and storage are not part of this smoke. Menu Admin accepts an
`imageUrl`, previews it in the web UI, and lets the backend validate the URL.
Upload/media library support remains a follow-up.

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
- menu admin: `/staff/menu`
- branch/table QR management: `/staff/branches`
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
12. Create a branch staff invite from `/staff/setup`; confirm the success panel
    shows the invite link, Copy link, Open invite, email, role, and branch.
13. Confirm invite failure states, if triggered by a duplicate or invalid email,
    render readable text rather than `[object Object]`.
14. Open `/staff/menu` as an owner or `menu_admin`; confirm Overview shows
    catalog, branch availability, modifier, and setup warning counts.
15. Create an active category with slug and sort order.
16. Create an active item with EGP price, station, sort order, and `imageUrl`;
    confirm the image preview renders or falls back cleanly for an empty/broken
    URL.
17. Edit the item price/status and confirm the success or failure message is
    readable.
18. Create a modifier group and option, then attach the group to the item if
    the account has full menu permissions.
19. Save a branch override for the item, including visibility, availability,
    optional price override, and sort order.
20. Open a customer QR/session for the same branch and verify customer menu
    visibility, availability, and price reflect the saved override.
21. Log in as a cashier, waiter, or kitchen user and confirm menu edit controls
    are not available unless that user has matching menu permissions.
22. Open `/staff/branches`, select the active branch, and confirm tables show
    floor/area, code, display name, capacity, status, QR token, customer URL,
    and a printable QR card with a visible scannable QR image.
23. Copy a customer QR URL, open it, then scan the visible QR with a phone
    camera and confirm it opens the matching customer table/session URL.
24. Regenerate a non-demo table QR token only after the confirmation prompt.
    Confirm the old token no longer opens and the new QR image scans/opens the
    new customer table/session URL.
25. Log in as a lower-privilege branch role such as cashier or waiter and
    confirm QR regeneration is unavailable.
26. Open `/staff/billing` and confirm SaaS plan/status appears.
27. Open `/customer/table/:qrToken` for the first returned QR example and
    confirm a customer session can start.
28. If seeded menu data is intentionally available in that staging cafe, submit
    a basic customer order and confirm the cashier sees it.
29. Confirm no visible page renders `[object Object]`.

The smoke does not require a real payment gateway. Mock online payment should
remain explicit and staging-only until a real provider is added.

PNG/PDF batch QR export remains a follow-up. The current staging surface should
at minimum provide copy link, open QR link, regeneration with confirmation, and a
printable scannable QR card for each QR token.
