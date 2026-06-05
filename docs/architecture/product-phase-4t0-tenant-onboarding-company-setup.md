# Product Phase 4T.0 - Tenant Onboarding / Company Setup

Product Phase 4T.0 adds the first serious tenant setup foundation for the Cafe
AI Waiter App / Smart Cafe Operating System. It turns setup readiness into a
real owner/manager surface without adding SaaS signup, billing, inventory,
payment gateways, Wi-Fi provisioning, GPS, or offline operations.

## Goal

The phase gives a cafe operator a guarded setup workflow for:

- company identity review;
- branch profile readiness;
- floors, tables, and customer QR links;
- branch staff role coverage;
- menu and modifier readiness;
- operational checks for cashier, bills, shifts, printers, KDS, waiter, and
  owner analytics.

The backend remains the source of truth. Readiness is computed from existing
records instead of fake checklist state.

## Backend Module

The new `TenantOnboardingModule` exposes guarded staff endpoints:

- `GET /api/v1/companies/:companyId/onboarding`
- `PATCH /api/v1/companies/:companyId/onboarding/profile`
- `GET /api/v1/branches/:branchId/onboarding`
- `PATCH /api/v1/branches/:branchId/onboarding/profile`
- `POST /api/v1/branches/:branchId/onboarding/floors`
- `POST /api/v1/branches/:branchId/onboarding/tables/bulk`
- `POST /api/v1/branches/:branchId/onboarding/staff/invite`
- `POST /api/v1/branches/:branchId/onboarding/readiness-checks`
- `GET /api/v1/branches/:branchId/onboarding/launch-checklist`

The module reuses the existing schema:

- `Company`
- `Branch`
- `Floor`
- `CafeTable`
- `StaffUser`
- `StaffMembership`
- `MenuCategory`
- `MenuItem`
- `ModifierGroup`
- `MenuItemModifierGroup`
- `BranchMenuItemOverride`
- `PrinterStation`
- `BranchOperatingSettings`
- `BranchFeatureFlag`
- `BranchSmartCashierSettings`
- `CashierShift`

No Prisma migration is required for Phase 4T.0.

## Permissions

Phase 4T.0 adds two explicit staff permissions:

- `tenant_onboarding.read`
- `tenant_onboarding.manage`

`owner` receives these through the existing full-permission owner role.
`branch_manager` receives branch-scoped tenant onboarding permissions plus
`staff.manage` for branch staff setup.

The permissions are not granted to:

- `cashier`
- `waiter`
- `kitchen`
- `barista`
- `menu_admin`

Company profile updates require company-scoped `tenant_onboarding.manage`.
Branch setup actions require branch-scoped `tenant_onboarding.manage`. Staff
invites require branch-scoped `staff.manage`; creating an owner membership also
requires company-scoped staff management.

## Readiness Model

The branch onboarding response returns:

- `company`
- `branch`
- `sections`
- `tables`
- `staff`
- `menu`
- `operations`
- `launchChecklist`
- `launchSummary`

Readiness sections are computed from live records:

- Company profile
- Branch profile
- Tables and QR
- Staff setup
- Menu readiness
- Operations readiness

Launch summary distinguishes:

- `blocked` - critical setup is missing;
- `ready_for_demo` - customer and staff demo-critical checks are ready;
- `ready_for_pilot` - demo checks plus printer/modifier readiness are ready.

`readiness-checks` acknowledges a manual note, but it does not persist fake
completion state in this phase. Persistence belongs in a later workflow phase.

## Frontend Scope

The new `/staff/setup` page is visible to staff with branch-scoped
`tenant_onboarding.read`.

It provides:

- company profile review and owner-level edit when permitted;
- branch profile edit for branch managers and owners;
- floor creation;
- deterministic bulk table creation with generated QR tokens;
- branch staff invite/membership setup;
- role coverage metrics;
- menu readiness metrics;
- computed setup section progress;
- launch checklist with clear blocked reasons.

The page reuses the existing staff shell, staff branch selector, API client,
React Query keys, and shared readable error formatter.

## Safety And Non-Goals

This phase does not add:

- public SaaS signup;
- subscription billing;
- payment gateway setup;
- POS integration;
- inventory;
- Wi-Fi provisioning;
- GPS;
- offline sync;
- fake production tenant claims;
- customer UI redesign.

Existing Balkona seed/demo behavior remains intact, including the customer QR
token `balcona-main-t01`.

## Local Smoke

1. Start local Postgres/Redis and seed the repo using the README quick start.
2. Log in as an owner or branch manager at `/staff/login`.
3. Open `/staff/setup`.
4. Select a branch.
5. Confirm company and branch profile cards load.
6. Create a floor or reuse an existing one.
7. Bulk create a small table batch.
8. Confirm QR preview links point to `/customer/table/:qrToken`.
9. Invite a branch staff role such as cashier, kitchen, waiter, or menu admin.
10. Confirm the launch checklist updates from backend-computed records.

## Validation

Run:

```bash
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test -- --runInBand
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```

## Future Scope

Later tenant setup phases can add persisted setup task ownership, invite email
delivery, richer staff setup workflows, tenant plan status, SaaS admin screens,
and deployment-specific onboarding checks. Those are intentionally outside
Phase 4T.0.
