# Phase 11 Staff Roles and Permissions Foundation

Phase 11 adds a reusable backend permission resolver on top of the existing `StaffUser`, `StaffMembership`, `StaffRole`, and `StaffStatus` schema.

## Purpose

The backend can now answer who a staff user is, which active company or branch memberships they have, which roles apply, and whether those roles grant a requested operation permission. This phase is a foundation for future guards and staff dashboards.

## Existing Staff Foundation

No Prisma models are replaced. `StaffUser` remains the staff identity record, and `StaffMembership` remains the role assignment record. A membership with `branchId = null` is company-level. A membership with `branchId` set is branch-level.

## Role Permissions

The permission map lives in TypeScript instead of Prisma. `owner` receives all permissions. Other roles receive focused permissions:

- `branch_manager`: branch operations, sessions, menu read/manage, orders, preparation, waiter calls, notifications, presence, staff read, and analytics read.
- `cashier`: cashier order review/accept/reject plus table, session, and waiter-call reads.
- `waiter`: table/session reads, waiter-call read/acknowledge/resolve, and notifications read.
- `kitchen` and `barista`: preparation read/start/ready/cancel.
- `menu_admin`: company/branch read and menu read/manage.

## Scope Rules

Company-level active memberships apply across all branches in that company. Branch-level active memberships apply only to their branch. If a permission check supplies a `branchId`, the service infers the company from that branch when `companyId` is omitted. If both are supplied, the branch must belong to the company.

Inactive staff users and inactive memberships never grant permissions. The access endpoint still returns the staff user record when found, but effective access is empty for inactive users.

## APIs

- `GET /api/v1/staff/:staffUserId/access`
- `GET /api/v1/staff/:staffUserId/can?permission=<permission>&companyId=<companyId>&branchId=<branchId>`

The access endpoint returns the staff user, active memberships, and effective company, branch, role, and permission access. The check endpoint returns `allowed`, `reason`, `staffUser`, optional `matchedMembership`, roles considered, and resolved scope.

## Not Production Auth

This is not production login, JWT/session auth, or password authentication. The endpoints are internal development/testing helpers and future guard inputs. Existing demo flows that accept optional staff IDs are not refactored to enforce permissions in this phase.

## Future Guard Fit

`StaffAccessService.can()` and `StaffAccessService.assertCan()` are reusable by future services. `RequiredPermission` and `StaffPermissionGuard` are present as a skeleton for later API enforcement once auth middleware supplies a trusted staff user context.

## Future Enforcement

Later phases can enforce cashier, kitchen, waiter, menu admin, and branch manager behavior by adding permission decorators/guards to existing modules. This phase intentionally avoids changing cashier queues, preparation queues, waiter calls, AI waiter behavior, payments/POS, UI, or Phase 12 behavior.
