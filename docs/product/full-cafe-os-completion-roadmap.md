# Full Cafe OS Completion Roadmap

Product Phase 4A starts the product completion track. The next phases should
turn the current demo-grade Cafe Operating System into a pilot-ready product
without restarting design, removing deployment work, or jumping into paid cloud
execution while budget is zero.

## Roadmap Principles

- Keep backend as source of truth for pricing, availability, permissions, and
  order lifecycle.
- Build admin/setup surfaces before adding more spectacle.
- Do not add payment/POS until cafe operations are stable without it.
- Keep AI suggestions safe, menu-grounded, and validation-gated.
- Prefer real data flows and explicit gaps over fake completeness.

## Product Phase 4B - Menu Admin + Availability Management

### Goal

Build the staff/owner menu admin UI and harden backend availability operations
so a cafe can manage its own menu without developer help.

### Why It Matters

Menu changes are daily operations. A real cafe must add items, change prices,
mark items sold out, and update modifiers quickly.

### Backend Scope

- Audit and complete menu-admin permission guards.
- Add bulk availability operations if missing.
- Add stronger validation for modifier groups, required selections, station
  routing, branch overrides, and active/inactive states.
- Add audit events for menu changes.
- Add test coverage for menu admin service/controller paths.

### Frontend Scope

- Add staff/owner menu admin route.
- Build category, item, modifier group, modifier option, and item-link editors.
- Add quick availability toggles for item and modifier availability.
- Add branch override UI.
- Add validation preview that mirrors customer cart validation.
- Add empty states, loading states, and mutation error feedback.

### Non-Goals

- No POS sync.
- No payment.
- No AI menu generation.
- No full media upload pipeline unless already supported safely.

### Validation

- Web lint/typecheck/build.
- API build/tests.
- Menu admin service/controller tests.
- Manual menu edit -> customer menu -> cart submit smoke test.

### Demo Acceptance Criteria

- Owner edits a menu item name, price, and status.
- Owner adds or edits a required modifier group.
- Staff marks an item unavailable and the customer menu reflects it.
- Customer cannot submit a cart with unavailable item/options.

## Product Phase 4C - Branch / Tables / QR Management

### Goal

Allow a cafe operator to configure branches, floors, tables, and QR tokens from
the product.

### Why It Matters

QR ordering is only usable if the cafe can install, replace, retire, and print
QRs without engineering support.

### Backend Scope

- Complete branch/floor/table CRUD as needed.
- Add QR token regeneration and disable/retire behavior.
- Add table status controls.
- Add audit logs for QR and table changes.
- Add seed/setup verification endpoints or utilities.

### Frontend Scope

- Add branch setup page.
- Add floor/table management UI.
- Add QR generation/export/print view.
- Add table status and QR health indicators.
- Add guided setup checklist for first demo branch.

### Non-Goals

- No paid cloud deployment.
- No floorplan drag/drop unless it can be kept small.
- No hardware printer integration.

### Validation

- API tests for QR lifecycle and table CRUD.
- Web build validation.
- Manual QR regenerate -> old QR fails or redirects by policy -> new QR starts
  session.

### Demo Acceptance Criteria

- Operator creates a table.
- Operator generates or rotates a QR token.
- Customer opens the new QR route and starts a session.
- Disabled table blocks new customer sessions with readable copy.

## Product Phase 4D - Staff Roles / Permissions / Branch Access

### Goal

Make staff account and permission management real enough for a cafe team.

### Why It Matters

Real cafes need owners, managers, cashiers, waiters, kitchen staff, and branch
access boundaries.

### Backend Scope

- Audit `StaffSessionGuard` and permission guard coverage on every staff-only
  endpoint.
- Add invite/create staff flow.
- Add disable/reactivate staff user and membership.
- Add password reset or secure first-password setup.
- Add session revocation.
- Add tests for role access by endpoint and branch scope.

### Frontend Scope

- Add staff management route.
- Add staff invite/create form.
- Add role and branch access editor.
- Add staff status/session management.
- Add role-denied and expired-session states across dashboards.

### Non-Goals

- No payroll.
- No time clock.
- No external identity provider unless a later security phase chooses one.

### Validation

- API permission matrix tests.
- Staff login and branch access smoke test.
- UI test or manual verification for denied access states.

### Demo Acceptance Criteria

- Owner creates a cashier, waiter, kitchen user, and manager.
- Each staff member sees only allowed branch/dashboard actions.
- Disabled staff cannot log in or mutate operations.

## Product Phase 4E - AI Waiter Real Engine Foundation

### Goal

Replace the AI waiter stub with a safe, menu-grounded engine that creates
structured cart proposals only.

### Why It Matters

AI is the product promise, but unsafe suggestions or invented items would harm
trust faster than no AI.

### Backend Scope

- Add provider abstraction for real model calls.
- Build current branch menu and availability context retrieval.
- Add deterministic proposal validation before storage.
- Add missing required modifier question flow.
- Add confidence scoring and human escalation.
- Add safe decision logging.
- Add evaluation fixtures for menu-grounding, Arabic/English, allergies, budget,
  group size, and required options.

### Frontend Scope

- Add guided question UI for missing modifiers.
- Add clearer confidence/fallback states.
- Add proposal edit or refine flow.
- Keep final order submission in cart.
- Improve Arabic/English direction and copy hooks.

### Non-Goals

- AI never submits orders.
- AI never changes prices.
- AI never bypasses cart validation.
- No external marketing chatbot.

### Validation

- Backend AI proposal schema tests.
- Golden evaluation prompts.
- Cart proposal apply/reject tests.
- Manual Arabic/English customer flow.

### Demo Acceptance Criteria

- AI suggests only real available menu items.
- AI asks for required options before proposal application.
- AI escalates to human when uncertain.
- Applying a proposal uses backend cart validation.

## Product Phase 4F - Order Lifecycle Hardening

### Goal

Make the customer-to-cashier-to-kitchen-to-waiter lifecycle reliable under real
shift conditions.

### Why It Matters

The order lifecycle is the operating system core. It must survive duplicate
clicks, stale carts, unavailable items, staff mistakes, and realtime hiccups.

### Backend Scope

- Audit order status transitions.
- Harden idempotency, cancellation, rejection, serving, completion, and bill
  close behavior.
- Add policy for order edits after submission.
- Add staff identity requirements where appropriate.
- Add lifecycle tests across happy and failure paths.

### Frontend Scope

- Improve customer conflict resolution for stale prices/unavailable items.
- Add high-volume cashier and kitchen states.
- Improve retry and stale-data handling.
- Add customer and staff copy for rejected/cancelled/delayed orders.

### Non-Goals

- No payments/POS.
- No tax receipt.
- No delivery/takeaway expansion unless scoped later.

### Validation

- API lifecycle test matrix.
- Manual full flow with accepted, rejected, cancelled, served, and completed
  orders.
- Realtime disconnect/reconnect smoke test.

### Demo Acceptance Criteria

- Customer submits once even after retries.
- Cashier can accept/reject with clear downstream state.
- Kitchen tasks update order status correctly.
- Waiter can mark served and bill flow remains coherent.

## Product Phase 4G - Owner Analytics + Operational Reports

### Goal

Turn the owner command center from live pulse into useful management reporting.

### Why It Matters

Owners need to understand service speed, menu performance, staff actions, and
recovery risks.

### Backend Scope

- Stabilize analytics definitions.
- Add date-range filters and snapshot/report strategy if needed.
- Add export endpoints if scoped.
- Add permissions and audit coverage.

### Frontend Scope

- Add date filters.
- Add trend and comparison views.
- Add menu performance, service timing, staff action, and attention reports.
- Add CSV/export if backend supports it.

### Non-Goals

- No fake revenue.
- No BI warehouse.
- No advanced forecasting.

### Validation

- Analytics endpoint tests.
- UI aggregation tests where practical.
- Manual reporting smoke test with seeded orders.

### Demo Acceptance Criteria

- Owner can see today's service pulse.
- Owner can inspect menu item performance.
- Owner can review staff action history.
- Owner can identify attention and service bottlenecks.

## Product Phase 4H - Tenant Onboarding / Company Setup

### Goal

Create the guided setup path for a new cafe tenant.

### Why It Matters

Without onboarding, every new cafe requires developer/database intervention.

### Backend Scope

- Add company/branch creation workflow if missing.
- Add owner bootstrap and default roles.
- Add setup checklist state.
- Add starter menu/import hooks.
- Add tenant lifecycle state.

### Frontend Scope

- Build company setup wizard.
- Build branch setup wizard.
- Link menu, tables, staff, theme, and seed verification readiness.
- Add setup progress and blockers.

### Non-Goals

- No subscription payment integration yet.
- No public marketplace.
- No multi-region provisioning.

### Validation

- End-to-end setup smoke test from empty tenant to usable QR flow.
- API tests for onboarding state.
- Manual staff login and customer QR verification.

### Demo Acceptance Criteria

- New cafe company is created.
- First branch, first table, first staff owner, and starter menu are configured.
- Customer QR route works without editing seed files.

## Product Phase 4I - End-to-End Demo Hardening

### Goal

Make the demo reliable enough for repeated stakeholder and real cafe trials.

### Why It Matters

The product should be easy to reset, verify, and present without hidden manual
fixes.

### Backend Scope

- Add deterministic demo seed verification.
- Add safe reset tooling for demo environments.
- Add scenario fixtures for accepted/rejected/delayed service.
- Add health checks for seed readiness.

### Frontend Scope

- Add demo readiness diagnostics.
- Add clearer setup blocker messages.
- Polish failure states found in rehearsals.
- Keep existing visual system intact.

### Non-Goals

- No fake orders as product data.
- No bypassing real backend validation.
- No cloud deployment if budget remains zero.

### Validation

- Local full demo smoke test.
- Public demo smoke script when an environment exists.
- Manual customer-to-owner rehearsal checklist.

### Demo Acceptance Criteria

- Demo can be reset and verified from docs/scripts.
- All critical routes open.
- Customer order appears across staff dashboards.
- Failure cases show readable messages.

## Product Phase 4J - SaaS Readiness / Billing Prep

### Goal

Prepare SaaS account, plan, and entitlement foundations without integrating
payments yet.

### Why It Matters

Billing should not arrive as a surprise refactor after tenant onboarding and
roles exist.

### Backend Scope

- Add plan/entitlement models if needed.
- Add tenant lifecycle states for trial, active, suspended, and internal demo.
- Add entitlement checks at feature boundaries.
- Prepare future billing provider abstraction without payment implementation.

### Frontend Scope

- Add read-only account/plan settings.
- Add trial/internal demo state messaging.
- Add disabled feature explanations based on entitlement.

### Non-Goals

- No Stripe or payment provider integration.
- No invoices.
- No tax calculations.
- No POS.

### Validation

- Entitlement model tests.
- UI checks for trial/active/suspended display states.
- No real payment calls.

### Demo Acceptance Criteria

- Tenant has a visible plan/status.
- Feature entitlements can be checked deterministically.
- Suspended or incomplete tenant state blocks safely with clear copy.

## Recommended Order

1. Product Phase 4B - Menu Admin + Availability Management.
2. Product Phase 4C - Branch / Tables / QR Management.
3. Product Phase 4D - Staff Roles / Permissions / Branch Access.
4. Product Phase 4F - Order Lifecycle Hardening.
5. Product Phase 4E - AI Waiter Real Engine Foundation.
6. Product Phase 4G - Owner Analytics + Operational Reports.
7. Product Phase 4H - Tenant Onboarding / Company Setup.
8. Product Phase 4I - End-to-End Demo Hardening.
9. Product Phase 4J - SaaS Readiness / Billing Prep.

The AI waiter can be developed in parallel, but it should not be enabled for a
real cafe until menu data, validation, and fallback rules are reliable.
