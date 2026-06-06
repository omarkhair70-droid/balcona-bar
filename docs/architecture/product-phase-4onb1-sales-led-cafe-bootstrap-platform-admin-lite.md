# Product Phase 4ONB.1 — Sales-led Cafe Bootstrap + Platform Admin Lite

## Purpose

Phase 4ONB.1 adds the first internal platform-side onboarding layer for Balcona. A platform admin can log in, create a cafe tenant, assign a SaaS plan, create the first branch, create or reuse the owner staff account, add a company-level owner membership, optionally create starter tables with QR tokens, and hand the owner a setup path.

This is sales-led onboarding only. It is not public self-signup, not real SaaS subscription checkout, and not real email invitation delivery.

## Platform Admin vs Tenant Staff

Platform admins are stored separately from tenant staff:

- `PlatformAdminUser`
- `PlatformAdminSession`
- `PlatformAuditEvent`

Tenant staff continue to use `StaffUser`, `StaffSession`, and staff permissions. Platform APIs use `PlatformSessionGuard`, so a staff bearer token cannot satisfy platform routes. Platform routes are separate from staff UI routes and use their own persisted browser session key.

## Local Dev Bootstrap

The seed can create a platform admin only when explicitly enabled:

```env
PLATFORM_ADMIN_DEV_BOOTSTRAP_ENABLED=true
PLATFORM_ADMIN_EMAIL=platform@balcona.local
PLATFORM_ADMIN_PASSWORD=change-me-platform-123
```

The default remains disabled, and the seed refuses platform dev bootstrap in production.

## Sales-led Bootstrap Flow

The platform admin opens `/platform/login`, then `/platform/companies/new`, and submits:

- company name and slug;
- owner name and email;
- first branch name, slug, and optional address;
- SaaS plan code and subscription status;
- optional starter floor and deterministic table range.

The backend runs the bootstrap in a transaction:

1. Normalize company slug, branch slug, and owner email.
2. Reject duplicate company slugs.
3. Load an active SaaS plan.
4. Create active `Company`.
5. Create `CompanySubscription`.
6. Enforce the branch limit before first branch creation.
7. Create active `Branch`.
8. Create or update the owner `StaffUser`.
9. Enforce staff user limits only when adding a counted owner seat.
10. Create the company-scoped owner `StaffMembership` if it does not already exist.
11. Optionally create starter floor, tables, and QR tokens.
12. Record a `PlatformAuditEvent`.

## Plan Assignment and Limits

Plan assignment happens before branch, owner, and starter table writes. `SaasService.assertWithinLimit` can now evaluate limits against the transaction client, so the new subscription is visible during bootstrap.

Starter table creation uses deterministic codes and counts only new tables against `maxTables`. Duplicate requested table codes are skipped, preserving the rerunnable setup behavior from tenant onboarding.

## Owner Bootstrap

If the owner email already belongs to a tenant staff user, bootstrap reuses that `StaffUser` and updates the display name/status. It creates a company-scoped owner membership only when missing. The owner password is not emailed or set by this flow. Local development can use the existing staff password bootstrap endpoint only when staff dev bootstrap is explicitly enabled.

## Starter Table and QR Creation

Starter tables use:

- normalized uppercase table codes;
- deterministic QR token base: `{branchSlug}-{tableCode}`;
- collision-safe suffix retries;
- active table status;
- customer preview paths such as `/customer/table/main-t01`.

Existing Balkona QR tokens, including `balcona-main-t01`, remain unchanged.

## Frontend Surface

New internal routes:

- `/platform/login`
- `/platform`
- `/platform/companies/new`
- `/platform/companies/[companyId]`

The platform UI has a separate auth store and gate. It is intentionally operational: company metrics, recent companies, add-cafe form, success handoff panel, subscription update, branches, owners, usage, and staff handoff links.

## Limitations and Future Work

Later phases can add:

- public cafe self-signup;
- real SaaS subscription checkout;
- email invitations and password setup links;
- platform support role restrictions;
- tenant import/migration tools;
- marketplace or agency onboarding;
- richer platform audit search and support tooling.

## Local Smoke Steps

1. Enable platform dev bootstrap in `apps/api/.env`.
2. Run migrations and seed.
3. Start the API and web app.
4. Open `/platform/login`.
5. Log in with the configured platform admin.
6. Open `/platform/companies/new`.
7. Create a test cafe with owner, branch, plan, and starter tables.
8. Verify `/platform/companies/[companyId]`.
9. Use the owner email with the staff password bootstrap flow if needed.
10. Open `/staff/setup` and `/staff/billing`.
11. Open a generated customer QR route and verify the existing order flow still works.
