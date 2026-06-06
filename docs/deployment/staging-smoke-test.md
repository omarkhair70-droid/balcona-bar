# Staging Smoke Test

Use this after staging API and Web are deployed, migrations are applied, and the
platform admin has been bootstrapped.

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
4. Create a test cafe workspace with starter tables.
5. Open the created company detail page and confirm plan, usage, and status
   render without raw object errors.
6. Set the owner password through the documented staff auth bootstrap path for
   staging, or use a staging-only staff credential created during setup.
7. Log in at `/staff/login`.
8. Open `/staff/setup` and confirm branch/table/setup readiness cards load.
9. Open `/staff/billing` and confirm SaaS plan/status appears.
10. Open `/customer/table/:qrToken` for a created table and confirm a customer
    session can start.
11. If seeded menu data is intentionally available in that staging cafe, submit
    a basic customer order and confirm the cashier sees it.
12. Confirm no visible page renders `[object Object]`.

The smoke does not require a real payment gateway. Mock online payment should
remain explicit and staging-only until a real provider is added.
