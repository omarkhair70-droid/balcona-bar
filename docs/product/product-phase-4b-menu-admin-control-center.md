# Product Phase 4B - Menu Admin Control Center

Product Phase 4B adds the first serious branch-scoped Menu Admin Control Center
for real cafe operations. It builds on the existing Phase 15 menu admin backend
instead of replacing it, and keeps customer/staff flows intact.

## Scope

- Staff route: `/staff/menu`
- Backend branch overview: `GET /api/v1/branches/:branchId/menu-admin/overview`
- Company menu CRUD reuse for categories, items, modifier groups, modifier
  options, item modifier links, and branch item overrides
- Branch-effective availability preview and setup issues
- Customer menu cache invalidation after admin mutations

## Backend Notes

The existing menu admin backend already supports company-scoped category, item,
modifier, and branch override writes. Phase 4B adds a branch-scoped overview
response that combines:

- company and branch summaries
- all company categories and items
- branch-specific item override state
- effective price, visibility, availability, and customer-visible flags
- modifier group and option data
- setup issues for inactive categories/items, missing overrides, hidden or
  unavailable items, invalid effective prices, invalid modifier selection state,
  and required groups without active options

The customer menu remains the source of truth for what guests see: only active
categories, active items, and visible/available branch overrides appear.

## Frontend Notes

The `/staff/menu` surface is designed as a control center, not a placeholder:

- Categories: create, edit, activate, and deactivate menu sections.
- Items: create, edit, activate, deactivate, archive, and assign preparation
  station routing.
- Availability: save or clear branch overrides for visible, available, and
  price override state.
- Modifiers: create/edit modifier groups, create/edit options, activate or
  deactivate groups/options, and attach/detach groups from items.
- Preview Issues: shows customer-visible branch items and setup warnings before
  they reach customer ordering, kitchen routing, or future AI suggestions.

## Non-Goals

This phase does not add AWS deployment execution, tenant onboarding, billing,
subscriptions, payments, POS integrations, real LLM behavior, fake production
data, or a redesign of existing customer/staff flows.

## Demo Acceptance

For the local Balkona demo:

1. Log in at `/staff/login`.
2. Open `/staff/menu`.
3. Select the seeded branch.
4. Toggle item visibility or availability and save.
5. Open `/customer/table/balcona-main-t01`.
6. Confirm the customer menu reflects the backend-validated branch override.
7. Review Preview Issues for missing overrides, hidden items, or required
   modifier groups without active options.

## Validation

Phase 4B should validate with:

```bash
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
```

## Next Phase

Product Phase 4C should continue the real product completion track with SaaS
admin/tenant management or the next approved roadmap slice, without reopening
the completed branch menu admin foundation unless a backend contract gap is
found during pilot testing.
