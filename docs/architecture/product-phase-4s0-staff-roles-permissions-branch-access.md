# Product Phase 4S.0 - Staff Roles, Permissions, and Branch Access

## Goal

Phase 4S.0 turns the existing staff roles and permission map into enforced
backend authorization for the live staff product surfaces. Frontend route and
navigation checks are convenience only; the API remains the source of truth.

## Staff Auth And Current Staff Context

Staff API protection starts with `StaffSessionGuard`. It validates the existing
opaque staff bearer token, rejects inactive/expired/revoked sessions, rejects
inactive staff users, and attaches the trusted request context:

- `request.staffUser`
- `request.staffSession`
- `request.staffAccess`

The existing `GET /api/v1/staff-auth/me` remains compatible. Phase 4S.0 also
adds:

- `GET /api/v1/staff/me`
- `GET /api/v1/staff/me/access`

These expose the current staff user, active memberships, effective companies,
effective branches, roles, permissions, and default branch suggestion.

## Permission Model

The supported product roles remain:

- `owner`
- `branch_manager`
- `cashier`
- `waiter`
- `kitchen`
- `barista`
- `menu_admin`

Company-level active memberships grant role permissions across all branches in
that company. Branch-level active memberships grant role permissions only for
that branch. Inactive staff users and inactive memberships grant nothing.

Denied permission checks return stable reason codes such as:

- `staff_user_context_required`
- `staff_user_inactive`
- `no_active_membership_for_scope`
- `permission_not_granted`

Denied audit-log persistence is not implemented in this phase; it remains a
recommended follow-up if compliance-grade access denial history is required.

## Backend Enforcement

Phase 4S.0 protects the live staff endpoints used by the current product shell:

- Cashier order queues and order review actions.
- Order detail, accept, reject, serve, and complete.
- Kitchen/barista preparation reads and start/ready/cancel actions.
- Waiter-call branch reads and acknowledge/resolve/cancel actions.
- Bill request branch reads and staff lifecycle actions.
- Smart Cashier settings, evaluation, auto-accept, and review rules.
- Table attention branch reads and staff actions.
- Staff branch realtime streams and stored branch events.
- Staff branch notifications and presence event reads.
- Active branch table-session list.
- Menu Admin overview, category, item, modifier, link, and branch override APIs.
- Branch/table/QR admin APIs already scoped under branch-aware routes.
- Branch operating settings and feature flags.
- Venue zones.
- Analytics and audit endpoints.
- AI Waiter staff session list/detail surfaces.
- Staff access overview endpoints.

Customer QR, customer table-session start/resume, customer cart, customer order
status, customer waiter calls, customer bill request, and customer AI waiter
chat/proposal endpoints are intentionally not converted into staff endpoints.

## Branch And Entity Scope

Route-param scoped endpoints use `@RequiredPermission(...)` with `branchIdParam`
or `companyIdParam`.

Entity-scoped staff endpoints use `StaffScopedAccessService` to resolve the
entity's true branch/company before permission assertion. This prevents callers
from trusting a URL branch, omitted branch, or client-selected branch when an
entity ID is the real scope.

Entity-scoped checks cover orders, preparation tasks, waiter calls, bill
requests, table sessions, AI waiter sessions, menu categories/items/modifiers,
Smart Cashier rules, and venue zones.

## Frontend Access

The staff shell now uses effective backend access to:

- persist only accessible selected branches;
- hide inaccessible staff navigation links;
- hide inaccessible staff overview cards;
- guard `/staff/cashier`, `/staff/kitchen`, `/staff/waiter`, `/staff/owner`,
  `/staff/menu`, and `/staff/branches`;
- show a visible access-denied state with an allowed-surface action;
- route successful login to the best default staff surface for the role.

Frontend checks do not replace backend permission checks.

## Tests

Phase 4S.0 adds focused backend unit coverage for:

- company-level membership access across branches;
- branch-level cross-branch denial;
- inactive staff-user denial;
- company-scope denial for branch-only memberships;
- entity scope resolution before permission assertion;
- missing entity denial before permission assertion.

## Known Limitations

This phase prioritizes the current operational staff product surfaces. Broader
media asset, content block, notification template, and experience profile admin
controllers still need the same entity-scoped hardening before a full SaaS admin
security phase is considered complete.

Full staff invitation flows, password reset, user provisioning, admin UI for
membership editing, and denied-access audit persistence are also outside this
phase.

## Next Recommended Phase

Recommended next work:

- complete entity-scoped authorization for media/content/experience admin APIs;
- add owner/manager staff membership management UI;
- add denied-access audit persistence if required;
- add integration/e2e tests for representative guarded controllers;
- define SaaS admin invitation and staff lifecycle flows.
