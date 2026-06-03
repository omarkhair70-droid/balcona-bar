# Full Cafe OS Gap Audit

Product Phase 4A audits the current repo as a product, not as a cloud deploy.
The goal is to turn the strong Balkona demo into a complete Cafe Operating
System a real cafe can use for a full day.

AWS execution remains paused while budget is zero. This audit does not ask for
paid cloud work, Terraform apply, payments, POS integration, or a UI redesign.

## Priority Guide

- P0: blocks real cafe day-one usage or creates unacceptable operational risk.
- P1: needed for a reliable pilot but can follow after a narrow P0 slice.
- P2: important for scale, polish, or SaaS maturity after the core pilot works.

## Executive Finding

The product has a strong end-to-end demo spine:

- customer QR start, menu, item detail, cart, order status, service calls, bill
  request, and AI waiter UI
- staff login, cashier, kitchen/barista, waiter, attention queue, and owner
  command center
- backend primitives for menu admin, staff permissions, realtime, analytics,
  audit, branch settings, experience profiles, media, and operational jobs

The biggest gaps are not the demo screens. They are the real cafe setup and
control surfaces: menu admin UI, branch/table/QR management, staff/role admin,
tenant onboarding, production-grade AI waiter engine, operational hardening, and
test coverage.

## Customer QR / Session Start

- Current state: Customer route `/customer/table/[qrToken]` resolves a seeded QR
  token and starts or resumes table sessions through backend table-session APIs.
- What works: The demo token `balcona-main-t01` opens the customer flow, returns
  company/branch/floor/table context, stores session access, and links into menu,
  AI waiter, cart, status, and service screens.
- UI-only or partially wired: The customer entry page is demo-friendly, but there
  is no customer-facing expired QR, moved table, closed branch, or table blocked
  flow.
- Backend gaps: Need production policies for QR rotation, table disablement,
  session expiry, branch closed hours, duplicate active sessions, and customer
  token enforcement coverage audit.
- Frontend gaps: Need clearer recovery for expired/resumed sessions, unavailable
  branch, invalid QR, network retry, and table already transferred.
- Data/model gaps: Need QR lifecycle metadata, table availability state, optional
  human-readable QR labels, and audit for QR regeneration.
- Operational risk: If QR tokens are static and unmanaged, a real cafe cannot
  safely replace, retire, or troubleshoot table QR codes.
- Priority: P0.

## Customer Menu Browsing

- Current state: Customer menu reads the effective branch menu and shows
  categories/items with item detail navigation.
- What works: Menu browsing is functional for seeded data, uses real backend
  menu APIs, and respects visible active data returned by the API.
- UI-only or partially wired: The menu presentation is polished, but real cafe
  editing, bulk availability, item search, sold-out handling, and media cleanup
  are not customer-complete.
- Backend gaps: Menu read APIs exist; admin-side backend exists, but production
  availability workflows need stronger operator rules and audit.
- Frontend gaps: No staff menu admin UI yet; customer menu needs search/filter
  and clearer category/item empty states for real large menus.
- Data/model gaps: Need stronger item metadata for allergens, dietary tags,
  prep-time hints, popularity, photos, and multilingual display fields.
- Operational risk: A cafe cannot confidently run a live menu if staff cannot
  quickly mark items unavailable or fix menu data without developer help.
- Priority: P0.

## Item Details / Modifiers

- Current state: Item detail panels render modifiers and perform required group
  validation before adding to cart.
- What works: Required modifier validation, quantity, notes, selected option
  submission, and backend price validation are in place for the demo flow.
- UI-only or partially wired: Complex modifier UX is basic: no guided questions,
  no dependent modifiers, no allergen warnings, and limited large-option support.
- Backend gaps: Need deeper validation for conditional groups, unavailable
  options during selection, branch-specific overrides, and modifier conflict
  rules.
- Frontend gaps: Need better multi-group progress, long-option ergonomics,
  translation readiness, and customer-friendly validation summaries.
- Data/model gaps: Need modifier option allergens, dietary tags, max quantity per
  option, conflict groups, default selections, and per-branch option overrides.
- Operational risk: Incorrect modifier handling creates wrong orders and kitchen
  confusion.
- Priority: P0.

## Cart Validation / Submit

- Current state: Cart read, add, update, remove, clear, validate, and submit
  flows exist in the Customer PWA and backend.
- What works: Backend remains source of truth for pricing and required modifier
  validation; final order submission stays in the cart flow.
- UI-only or partially wired: Error messages were hardened, but cart recovery is
  still a pilot-level experience for concurrency, sold-out items, branch closing,
  and stale prices.
- Backend gaps: Need production audit of idempotency, customer access guards,
  concurrent availability changes, order throttling, and table-session close
  behavior.
- Frontend gaps: Need richer conflict resolution for changed prices, unavailable
  modifiers, and partial cart invalidation.
- Data/model gaps: Need explicit cart validation reason codes suitable for
  customer copy and support diagnostics.
- Operational risk: Cart submit is the primary revenue action; unclear failures
  will cause abandoned orders or duplicate staff work.
- Priority: P0.

## Customer Order Status / Timeline

- Current state: Customer status and timeline screens read order/session status
  endpoints and realtime invalidation.
- What works: Customers can see submitted, accepted, rejected, preparing, ready,
  served, completed, waiter-call, and bill-related events when emitted.
- UI-only or partially wired: The timeline is useful for demo, but not yet a
  fully localized, cafe-configurable notification surface.
- Backend gaps: Need complete event taxonomy review, customer token enforcement,
  and lifecycle edge-case tests across rejection, cancellation, close, and bill
  states.
- Frontend gaps: Need stronger empty, long-wait, rejected, delayed, and order
  edited states.
- Data/model gaps: Need customer-visible event copy keys, localized templates,
  and operational delay reasons.
- Operational risk: Customers will ask staff for updates if the timeline is
  unclear or stale.
- Priority: P1.

## Service Calls And Bill Request

- Current state: Customer service actions can create waiter calls and request a
  bill; staff waiter/cashier surfaces can act on those records.
- What works: Waiter call create/list/acknowledge/resolve/cancel and bill
  request/acknowledge/present/close/cancel flows exist.
- UI-only or partially wired: Customer bill UX now handles active/no-bill states,
  but no payment, receipt, or POS close exists.
- Backend gaps: Need stronger duplicate suppression, escalation rules,
  service-level timing, table closure policies, and bill correctness guarantees.
- Frontend gaps: Need clearer customer state after waiter action and better staff
  prioritization during high volume.
- Data/model gaps: Need service categories, SLA metadata, staff assignment, and
  bill presentation history.
- Operational risk: Service calls are customer trust moments; missed or duplicate
  calls create visible service failure.
- Priority: P0 for waiter call reliability, P1 for bill polish.

## AI Waiter Customer Chat

- Current state: Customer AI waiter UI is premium and multi-language-ready, with
  backend session/message APIs and a stub provider.
- What works: Start/resume, message history, suggested prompts, tone-aware UI,
  proposal cards, and human fallback are wired.
- UI-only or partially wired: The real intelligence is not implemented; current
  provider behavior is a foundation/stub rather than a production AI waiter.
- Backend gaps: Need real model/provider integration, retrieval over current menu
  and availability, deterministic tool layer, safety policy, confidence scoring,
  and evaluation harness.
- Frontend gaps: Need richer question flows for required options, allergies,
  budget, group size, and low-confidence fallback.
- Data/model gaps: Need structured menu semantics, dietary/allergen metadata,
  tone settings, prompt templates, and safe decision logs.
- Operational risk: An AI waiter that invents items, prices, or unsafe dietary
  claims would damage trust quickly.
- Priority: P0 before any real cafe uses AI recommendations.

## AI Waiter Proposal / Apply / Reject

- Current state: AI cart proposals are stored and can be applied or rejected
  through backend APIs; applying still goes through backend cart validation.
- What works: The AI never submits orders and proposal application does not
  bypass cart validation or pricing.
- UI-only or partially wired: Proposal quality and completeness depend on stubbed
  backend data; UI renders defensively but cannot fix weak proposal generation.
- Backend gaps: Need strict proposal schema, proposal validation before storage,
  missing modifier detection, item availability confirmation, and confidence
  reasons.
- Frontend gaps: Need proposal editing, ask-a-question loops for missing options,
  and clearer partial proposal states.
- Data/model gaps: Need proposal decision metadata, applied cart item mapping,
  rejection reason taxonomy, and evaluation labels.
- Operational risk: Applying a poor proposal can create wrong cart contents even
  if final submit remains safe.
- Priority: P0.

## Cashier Order Dashboard

- Current state: Staff cashier dashboard lists branch orders, shows details, and
  can accept/reject submitted orders and handle bill lanes.
- What works: Uses real order and bill endpoints, branch selector, staff auth
  store, realtime invalidation, and visible mutation feedback.
- UI-only or partially wired: It is a strong demo dashboard, but lacks production
  throughput tools like assignment, batching, order edit, refund/cancel policy,
  and POS/payment handoff.
- Backend gaps: Need stricter permission enforcement on all cashier mutations,
  order edit policy, cancellation policy, and audit review.
- Frontend gaps: Need denser high-volume mode, keyboard support, printing/export
  hooks, and multi-branch operator patterns.
- Data/model gaps: Need cashier assignment, payment state placeholder, external
  order references, and service-time metrics.
- Operational risk: Cashier intake is the control point between customer intent
  and kitchen work; weak permissions or noisy queues can create costly mistakes.
- Priority: P0.

## Kitchen / Barista Preparation Dashboard

- Current state: Kitchen/barista dashboard lists preparation tasks by station and
  status, with start/ready/cancel actions and detail panels.
- What works: Accepting orders creates preparation tasks, task actions update
  order lifecycle, and realtime invalidation keeps staff current.
- UI-only or partially wired: No drag/drop, printer/KDS integration, bump-screen
  mode, item prep timers, or multi-station routing editor.
- Backend gaps: Need station configuration management, SLA rules, task
  reassignment, partial item readiness, and stronger task cancellation policy.
- Frontend gaps: Need high-contrast kitchen display mode, sound/notification
  tuning, item grouping, and late-task escalation.
- Data/model gaps: Need station definitions, prep-time targets, routing rules,
  and staff assignment records.
- Operational risk: Wrong or stale preparation tasks directly disrupt service.
- Priority: P1 after cashier/menu P0 hardening.

## Waiter Attention Queue

- Current state: Waiter dashboard combines waiter calls and table attention
  records with acknowledge/resolve/cancel/mute/recalculate actions.
- What works: Staff can triage calls, view context, and work attention signals
  from persisted backend records.
- UI-only or partially wired: Attention scoring is useful but needs real-world
  tuning and operational calibration.
- Backend gaps: Need scoring validation, suppression rules, assignment, escalation
  policy, and audit of false positives/false negatives.
- Frontend gaps: Need floor/table map mode, ownership handoff, shift view, and
  clearer urgent/aged-call prioritization.
- Data/model gaps: Need waiter zones, staff assignment, SLA thresholds, and
  table status dimensions.
- Operational risk: Incorrect prioritization can make staff ignore urgent tables
  or chase low-value signals.
- Priority: P1.

## Owner / Manager Command Center

- Current state: Owner dashboard aggregates existing operational endpoints
  client-side for branch pulse and readiness.
- What works: It shows live operational counts, attention summary, service
  recovery signals, recent activity, and menu/experience readiness.
- UI-only or partially wired: It is not yet a full analytics/reporting product;
  no charts dependency, exports, saved reports, or historical comparison.
- Backend gaps: Analytics endpoints exist, but owner UI does not yet consume the
  full analytics set or provide report definitions.
- Frontend gaps: Need date filters, manager drilldowns, exports, trend views,
  and anomaly explanations.
- Data/model gaps: Need business definitions for KPIs, reporting periods, and
  tenant-level benchmarks.
- Operational risk: Managers can observe the live floor but cannot yet run the
  business from reports.
- Priority: P1.

## Menu / Admin Readiness

- Current state: Menu admin backend APIs exist for categories, items, modifier
  groups/options, links, reorder, status transitions, and branch item overrides.
- What works: The backend is a strong base for real menu management and avoids
  hard deletion in favor of lifecycle status.
- UI-only or partially wired: No staff/owner menu admin UI exists yet.
- Backend gaps: Need permission guard rollout, bulk availability operations,
  import/export, versioning, audit review, media upload integration, and branch
  override ergonomics.
- Frontend gaps: Need the full menu admin workspace with category/item/modifier
  editing, availability toggles, preview, validation, and change history.
- Data/model gaps: Need richer allergens/dietary tags, translations, prep times,
  menu sections for dayparts, and media ownership.
- Operational risk: Without menu admin UI, a real cafe needs developer help to
  change the core product data.
- Priority: P0.

## Branch / Table / QR Management

- Current state: Backend models companies, branches, floors, tables, and QR
  token resolution; branch table listing exists.
- What works: Seeded data supports the Balkona demo and QR start flow.
- UI-only or partially wired: There is no admin UI for branch setup, floors,
  tables, QR generation, QR rotation, or printing.
- Backend gaps: Need create/update/archive endpoints for full branch/table/floor
  management if not already complete, QR regeneration policy, and audit.
- Frontend gaps: Need branch/table admin surfaces and QR export/print workflow.
- Data/model gaps: Need QR lifecycle, table status, labels, zones, capacity, and
  display ordering suitable for real venues.
- Operational risk: A cafe cannot self-install or rearrange tables without this.
- Priority: P0.

## Staff Roles / Permissions

- Current state: Staff auth, sessions, roles, effective access, permission maps,
  guards, and staff dashboards exist.
- What works: Staff login works, access context is returned, and the web app can
  select accessible branches.
- UI-only or partially wired: No complete staff admin UI exists for inviting,
  disabling, assigning roles, resetting passwords, or auditing access.
- Backend gaps: Need guard enforcement audit across all staff endpoints, invite
  flows, password reset, session revocation, and least-privilege tests.
- Frontend gaps: Need staff management UI, role editor, branch access editor,
  session management, and readable permission explanations.
- Data/model gaps: Need invitation state, password reset tokens, staff status
  lifecycle, and optional shift/assignment data.
- Operational risk: Weak staff control is a security and operations blocker for
  real cafes.
- Priority: P0.

## Tenant / Company Onboarding

- Current state: Multi-company and multi-branch backend foundation exists, but
  Balkona is seeded demo data rather than self-service onboarding.
- What works: The model can represent more than one cafe/operator.
- UI-only or partially wired: No SaaS admin or tenant onboarding UI exists.
- Backend gaps: Need company creation workflow, owner bootstrap, branch setup
  wizard, default roles, starter menu import, and tenant lifecycle.
- Frontend gaps: Need onboarding screens for company, branch, table, staff, menu,
  and theme setup.
- Data/model gaps: Need tenant setup checklist, lifecycle states, plan metadata,
  onboarding progress, and ownership records.
- Operational risk: Every new cafe requires manual developer/database work.
- Priority: P1 after single-cafe day-one flow, P0 for SaaS scale.

## Billing / Subscriptions Readiness

- Current state: Payment/POS/billing are intentionally out of scope. No real
  subscription product is implemented.
- What works: Deployment docs and product architecture keep payment separate
  from operational bill request flows.
- UI-only or partially wired: No pricing, plan selection, subscription status,
  invoices, or billing admin exists.
- Backend gaps: Need plan/account models, entitlement checks, billing provider
  integration later, and subscription webhooks when payment phase starts.
- Frontend gaps: Need SaaS billing settings, plan display, trial state, usage
  notices, and blocked/expired account UX.
- Data/model gaps: Need plan, entitlement, billing customer, subscription, and
  invoice metadata.
- Operational risk: Not a day-one cafe operations blocker for a managed pilot,
  but blocks self-service SaaS.
- Priority: P2 for pilot, P1 before SaaS launch.

## Analytics / Reporting

- Current state: Backend analytics endpoints exist for branch overview, menu,
  staff actions, and company overview; owner UI currently aggregates operational
  endpoints client-side.
- What works: Read-only analytics can be queried and audit history exists.
- UI-only or partially wired: Owner dashboard has live pulse but not a reporting
  suite.
- Backend gaps: Need report definitions, historical persistence/caching strategy,
  export endpoints, and permissions review.
- Frontend gaps: Need charts, date ranges, comparisons, exports, menu/staff
  reporting pages, and clear KPI definitions.
- Data/model gaps: Need normalized KPI definitions, report snapshots, and
  revenue/payment state once payments exist.
- Operational risk: Operators cannot use the system for weekly decisions yet.
- Priority: P1.

## Realtime Events

- Current state: SSE streams and stored realtime events exist for branch and
  table-session channels; web uses realtime invalidation.
- What works: Customer and staff screens update from branch/session activity
  without full manual refresh.
- UI-only or partially wired: Realtime is used as invalidation, not yet as a
  fully observable live operations layer.
- Backend gaps: Existing architecture notes call out future auth integration for
  streams; need production stream guards, disconnect metrics, retry policy, and
  event retention policy.
- Frontend gaps: Need clearer disconnected/reconnecting UI, stale data indicators,
  and recovery when event streams fail.
- Data/model gaps: Need event retention limits, delivery diagnostics, and channel
  authorization metadata.
- Operational risk: Staff may act on stale orders if realtime fails silently.
- Priority: P0 for auth/staleness, P1 for observability.

## Error Handling / Loading / Empty States

- Current state: Recent UI hardening added visible errors for customer mutations
  and staff login; dashboards include useful loading and empty states.
- What works: The demo no longer depends only on console errors for key customer
  failures.
- UI-only or partially wired: Error handling is inconsistent across all long-tail
  admin/setup paths because those paths do not exist yet.
- Backend gaps: Need stable error code taxonomy for customer copy, staff copy,
  validation, retry, and support diagnostics.
- Frontend gaps: Need shared error presentation primitives across customer,
  staff, and future admin surfaces.
- Data/model gaps: Need support correlation IDs and user-safe error categories.
- Operational risk: During a real shift, unclear failures cause staff workarounds
  and duplicate orders.
- Priority: P1.

## Seed / Demo Data

- Current state: Seeded Balkona data powers local demo and public-demo
  verification docs.
- What works: There is a known QR token, staff demo accounts, menu, and flow
  checklist.
- UI-only or partially wired: Demo launcher is polished, but not a complete seed
  admin or reset tool.
- Backend gaps: Need idempotent demo seed verification, reset/cleanup scripts,
  and environment-safe seed policy.
- Frontend gaps: Need admin-visible setup health and missing-data diagnostics.
- Data/model gaps: Need setup checklist records and seed version metadata.
- Operational risk: Demo or pilot setup can drift and fail at showtime.
- Priority: P1.

## Security / Auth / Session Handling

- Current state: Staff auth uses database-backed sessions and guards; customer
  session access exists for table sessions; production docs call out secret and
  CORS concerns.
- What works: Staff login/me/logout flows exist, dev bootstrap can be disabled,
  and access context drives staff UI branch selection.
- UI-only or partially wired: Staff admin and customer session management UI are
  missing.
- Backend gaps: Need endpoint-by-endpoint guard audit, stream auth, rate
  limiting, CSRF/CORS review, session revocation, password reset, and security
  tests.
- Frontend gaps: Need expired session recovery, role-denied states, and safer
  handling for shared tablet/device scenarios.
- Data/model gaps: Need staff invitation/reset records, session device metadata,
  failed login tracking, and customer session abuse signals.
- Operational risk: Security gaps can expose tenant data or allow unauthorized
  operational actions.
- Priority: P0.

## Testing / QA Coverage

- Current state: API unit tests cover selected staff permission/token hashing;
  CI runs web lint/typecheck/build and API build/tests.
- What works: Baseline validation catches TypeScript/build failures and a small
  set of backend permission utilities.
- UI-only or partially wired: There is no broad end-to-end regression suite for
  customer-to-staff flows.
- Backend gaps: Need service/controller tests for cart, order lifecycle, menu
  admin, staff auth, permissions, AI waiter proposals, realtime events, and
  analytics.
- Frontend gaps: Need component/integration tests for cart, item modifiers,
  dashboards, auth recovery, and mutation error states.
- Data/model gaps: Need test seed fixtures and stable scenario builders.
- Operational risk: The product can regress critical cafe flows without CI
  catching it.
- Priority: P0 for customer/order/security paths, P1 for dashboards/admin.

## P0 Completion Focus

Before giving this to a real cafe for a full day, complete or explicitly control
these P0 areas:

- menu admin and availability management
- branch/table/QR management
- staff roles, staff account management, and endpoint guard audit
- customer cart/order lifecycle hardening
- cashier intake reliability
- AI waiter real-engine safety before enabling live recommendations
- realtime auth/staleness handling
- critical test coverage for customer order and staff operations paths
