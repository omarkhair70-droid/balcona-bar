# Product Phase 4SaaS.0: Plans, Tenant Limits, and Subscription Status

## Goal

Product Phase 4SaaS.0 adds internal SaaS plan tracking and tenant limit enforcement without adding a real subscription payment provider. The backend remains the source of truth for subscription status, feature entitlements, usage counts, warnings, blockers, and write gates.

This phase does not add Stripe, Paymob, Fawry, subscription invoices, tax or e-invoicing, public self-signup, a SaaS admin console, or frontend-only fake limits.

## Data model

The Prisma schema adds:

- `SaasPlan`: seeded plan catalog with codes, display names, prices, feature booleans, and nullable limits. A nullable limit means unlimited.
- `CompanySubscription`: one current subscription per company, linked to a plan and carrying status such as `trialing`, `active`, `past_due`, `suspended`, or `cancelled`.
- `CompanyPlanLimitOverride`: company-specific overrides for integer limits or boolean feature entitlements.
- `SaasFeatureKey`: stable feature keys used by backend enforcement.

The seeded plans are `pilot`, `starter`, `growth`, and `enterprise`. The Balkona seed receives an active `pilot` subscription with generous limits so the existing local demo remains intact.

## Backend service

`SaasService` exposes the shared policy layer:

- `getPlans()`: returns the active plan catalog.
- `getCompanySaasStatus(companyId)`: returns company subscription, plan, entitlements, usage, limits, warnings, and blockers.
- `getBranchSaasStatus(branchId)`: resolves the branch company and returns the same status with branch context.
- `assertCompanyFeatureEnabled(companyId, featureKey)`: blocks write features when the subscription is missing, suspended, cancelled, or the feature is disabled.
- `assertWithinLimit(companyId, limitKey, nextIncrement)`: blocks writes that would exceed finite tenant limits.

Usage is calculated from backend records:

- branches
- tables
- distinct active staff users
- non-archived menu items
- non-archived inventory items
- AI waiter messages in the current month
- succeeded online payment intents in the current month

Warnings are emitted at 80 percent usage. Blockers are emitted for suspended/cancelled subscriptions and exceeded finite limits. `past_due` is a warning in this phase so existing operations can continue while billing remains manual/internal.

## API endpoints

New endpoints:

- `GET /api/v1/saas/plans`
- `GET /api/v1/companies/:companyId/saas/status`, guarded by company-scoped `saas.read`
- `GET /api/v1/branches/:branchId/saas/status`, guarded by branch-scoped `saas.read`
- `POST /api/v1/dev/companies/:companyId/saas/assign-plan`, guarded by company-scoped `saas.manage` and only enabled when local/dev bootstrap is allowed

Permissions:

- `owner`: `saas.read`, `saas.manage`
- `branch_manager`: `saas.read`
- `cashier`, `waiter`, `kitchen`, `barista`, `menu_admin`: no SaaS permissions

## Enforcement points

The first backend write gates are intentionally limited to plan-sensitive surfaces:

- branch creation checks setup entitlement and branch limit
- floor/table setup checks setup entitlement, and table creation checks table limits
- tenant onboarding profile/table/staff writes check setup entitlement and relevant table/staff limits
- menu item creation checks menu item limit
- inventory item creation checks inventory entitlement and inventory item limit
- branch stock adjustment and menu inventory requirements check inventory entitlement
- online customer payment intent creation checks online payment entitlement
- owner analytics reads check owner analytics entitlement
- AI waiter start/message checks AI waiter entitlement, and message sends check monthly AI message limit

These gates keep existing behavior for active pilot/enterprise tenants while making suspended, cancelled, disabled-feature, and exceeded-limit states enforceable from the backend.

## Frontend surfaces

The web app adds `/staff/billing` for branch-scoped owner/branch manager access. It shows:

- current subscription and plan
- usage cards
- feature entitlement status
- warnings and blockers
- internal plan catalog

The UI clearly states that this phase is internal plan tracking and that real subscription billing is not connected yet. `/staff/setup` now displays SaaS warning/blocker signals returned by the onboarding API, and `/staff/owner` links to the billing/status surface.

## Local smoke path

1. Run migrations and seed data.
2. Sign in as `owner@balcona.local` or `manager@balcona.local`.
3. Open `/staff/billing`.
4. Confirm the Balkona company is on the active `Pilot` plan.
5. Confirm usage cards and feature entitlements render without client-side invented limits.
6. Open `/staff/setup` and confirm the plan signals card is present.
7. Open `/staff/owner` and confirm the Plan and limits link is available.
8. Run the existing customer order, cashier, kitchen, waiter, bill, manual payment, inventory, and mock online payment flows to confirm the active pilot plan does not block the demo.

## Future work

Future SaaS phases can add a real subscription billing provider, SaaS admin UI, tenant self-signup, subscription invoices, tax/e-invoicing, usage exports, plan-change workflows, notification emails, and production entitlement audit logs. Those are intentionally outside this phase.
