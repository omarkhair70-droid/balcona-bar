# Product Phase 4C - Branch / Tables / QR Management

Product Phase 4C adds a guarded Branch & Tables admin foundation so a cafe can
configure the operational structure required before real customer QR usage:
branches, floors, tables, QR tokens, active sessions, and setup warnings.

## Why This Matters

The customer PWA starts from `/customer/table/:qrToken`. Before a real cafe can
pilot the product, staff need a safe way to manage which branches and tables can
start QR sessions, which QR tokens are ready to print, and which setup gaps
block customer readiness.

## Backend Scope

Phase 4C adds a new guarded branch admin API:

- `GET /api/v1/companies/:companyId/branch-admin/overview`
- `POST /api/v1/companies/:companyId/branch-admin/branches`
- `PATCH /api/v1/branch-admin/branches/:branchId`
- `POST /api/v1/branch-admin/branches/:branchId/activate`
- `POST /api/v1/branch-admin/branches/:branchId/deactivate`
- `POST /api/v1/branches/:branchId/table-admin/floors`
- `PATCH /api/v1/table-admin/floors/:floorId`
- `POST /api/v1/branches/:branchId/table-admin/tables`
- `PATCH /api/v1/table-admin/tables/:tableId`
- `POST /api/v1/table-admin/tables/:tableId/activate`
- `POST /api/v1/table-admin/tables/:tableId/deactivate`
- `POST /api/v1/table-admin/tables/:tableId/qr-token/generate`
- `POST /api/v1/table-admin/tables/:tableId/qr-token/regenerate`

The new endpoints use the existing staff session and permission guards. Read
overview access requires staff table/branch access; mutations require existing
`settings.manage` permission so this phase does not redesign roles before
Product Phase 4D.

The API reuses the existing schema:

- `Company`
- `Branch`
- `Floor`
- `CafeTable`
- `TableSession`
- `TableAttentionSnapshot`

`VenueZone` remains an experience/presence model. Tables use `Floor` as their
operational grouping in this phase.

## QR Token Rules

- `CafeTable.qrToken` remains globally unique.
- Tokens use lowercase letters, numbers, and hyphens.
- When no token is supplied for a new table, the backend generates one from the
  branch slug and table code, then adds a numeric suffix if needed.
- Regeneration requires explicit confirmation because printed QR codes become
  stale.
- QR image/PDF generation is not included in this phase.
- The existing Balkona demo token `balcona-main-t01` remains seeded and
  supported.

## Active Session Notes

The overview includes open table sessions for the selected branch, including
session status, guest label, party size, timestamps, table summary, and attention
snapshot when available.

This phase does not add destructive bulk close behavior. Existing table sessions
remain historical records when table metadata changes.

Customer QR session start now rejects inactive branches in addition to inactive
tables.

## Frontend Scope

Phase 4C adds `/staff/branches` with:

- branch overview metrics
- branch create/edit/activate/deactivate
- floor create/edit
- table create/edit/activate/deactivate
- QR token and preview URL management
- active session visibility
- backend setup issues
- ready-for-QR-demo status

Staff navigation, staff overview, and the Balkona demo launcher link to the new
surface.

## Setup Warnings

The backend reports warnings for:

- company has no branches
- branch inactive
- branch has no tables
- branch has no active tables
- branch inactive with active tables
- inactive table with an open session
- missing QR token
- unsafe QR token format
- missing or invalid capacity
- no customer demo link possible

## Non-Goals

This phase does not add tenant onboarding, billing, payments, POS integration,
real AI provider integration, advanced floor plan visuals, drag-and-drop table
maps, QR image/PDF batch generation, inventory, public deployment, advanced
analytics, or a staff role redesign.

## Validation

Run:

```bash
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
```

New focused tests cover branch/table admin overview warnings, branch creation,
QR token collision suffixing, cross-branch floor rejection, and inactive branch
QR session blocking.

## Next Phase

Product Phase 4D should address Staff Roles / Permissions / Branch Access:

- clearer permission names for branch/table administration
- staff access management UI
- safe branch membership assignment
- role-specific route access expectations
- no broad permission redesign inside Phase 4C
