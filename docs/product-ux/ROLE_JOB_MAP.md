# R5 — Role / Job Map

Status: COMPLETE
Audit date: 2026-08-28

## Principle

Balcona navigation must be organized around jobs and operating context, not around the existence of backend modules or role names.

A product persona is not automatically a new database role. Many personas can be expressed through existing permissions, scoped access, and workspace defaults.

## Current authorization roles

Current backend roles:
- owner
- branch_manager
- cashier
- waiter
- kitchen
- barista
- menu_admin

Current permission model is already granular across:
- companies / branches / tables / sessions
- menu / inventory / media / experience / content / venue zones
- orders / bills / online payments
- AI waiter / smart cashier
- preparation / waiter calls
- notifications / presence
- staff / settings / feature flags
- autopilot / analytics / owner analytics
- SaaS / onboarding / audit / auth / security / jobs

R5 therefore does not need to redesign authorization before designing information architecture.

---

# Persona J1 — Guest

Context:
- seated at a table or using a cafe ordering link
- mobile-first
- no training
- attention measured in seconds

Primary jobs:
1. Confirm I am in the right cafe/table context.
2. Understand what I can order now.
3. Discover items quickly.
4. Ask questions or get recommendations.
5. Customize items without mistakes.
6. Review the order and total.
7. Submit confidently.
8. Know whether the order actually went through.
9. Track preparation/service status.
10. Order another round without starting over.
11. Ask for human help.
12. Request the bill.
13. Understand what remains unpaid.
14. Pay using an available method.
15. Know definitively whether payment succeeded/failed/pending.
16. Get a receipt and leave.

Secondary jobs:
- revisit current-session orders
- reorder something already ordered
- manage group/shared ordering if later supported
- see availability changes
- use Arabic/English naturally

Should not see by default:
- backend/provider terminology
- branch configuration
- payment reconciliation
- staff roles
- raw operational statuses
- system errors without a human explanation

UX consequence:
Guest is a flagship consumer product surface, not a thin projection of the database.

---

# Persona J2 — Cashier

Context:
- fixed counter terminal/tablet/desktop
- high-frequency
- interruptions are normal
- speed and financial certainty matter more than decoration

Primary jobs:
1. Open my shift.
2. See incoming orders needing cashier review.
3. Understand why an order needs attention.
4. Accept/reject/cancel with clear consequences.
5. Open order/check detail immediately.
6. See active bill requests.
7. Present a bill.
8. Record cash/manual external POS payments.
9. Understand online-payment state without guessing.
10. Recover/route payment uncertainty.
11. Make permitted cash adjustments.
12. See current expected drawer state.
13. Run shift X report when needed.
14. Complete close-of-shift procedure.
15. Hand over cleanly to the next shift.

Secondary jobs:
- serve/complete where local operation gives cashier that responsibility
- view menu/stock availability to explain problems
- see customer/table context

Should not see by default:
- full menu administration
- supplier purchasing
- SaaS subscription
- enterprise configuration
- KDS administration
- full owner analytics

UX consequence:
Cashier should open directly into an operational workspace, not a generic Staff home.

---

# Persona J3 — Waiter / Server

Context:
- mobile/handheld/tablet
- moving around floor
- action queue, not analysis dashboard

Primary jobs:
1. See tables/guests needing attention now.
2. Distinguish explicit waiter calls from computed attention.
3. Acknowledge a request so teammates know it is owned.
4. Resolve/cancel with clear state.
5. See ready-to-serve orders.
6. Mark served.
7. Assist with bill/payment when requested.
8. Handle AI waiter escalation.
9. Understand table/session context quickly.
10. Avoid duplicate service by multiple staff.

Secondary jobs:
- see menu/availability
- see limited order/status detail
- mute/recalculate attention when authorized

Should not see by default:
- inventory procurement
- finance reconciliation
- setup
- SaaS billing
- enterprise configuration

UX consequence:
Waiter UI should optimize for attention, location/table context, and one-tap ownership.

---

# Persona J4 — Kitchen

Context:
- dedicated screen
- hands busy
- distance from screen varies
- time pressure and noise

Primary jobs:
1. See only tickets/items relevant to my station.
2. Identify oldest/urgent work.
3. Read modifiers/instructions with high confidence.
4. Start work.
5. Mark ready.
6. Handle cancellation/change clearly.
7. See order/table/service context only when useful.
8. Recover a recently completed ticket where supported.
9. Know whether routing/printing has failed.

Secondary jobs:
- limited ticket reprint
- station status
- recipe/instruction reference if product enables it later

Should not see by default:
- owner navigation
- menu CRUD
- finance
- SaaS
- company setup
- unrelated station tickets

UX consequence:
Kitchen is a device/station workspace. Standard Back Office chrome should disappear.

---

# Persona J5 — Barista

Context:
- same production model as Kitchen but often faster cycle and drink modifiers
- may be a dedicated bar station

Primary jobs:
- same production lifecycle as Kitchen
- filter to barista/drink station
- prioritize quick-turn beverage tickets
- see modifiers prominently
- coordinate readiness with expediter/service

UX consequence:
Do not create a second generic admin product. Use station identity/configuration on the same production system.

---

# Persona J6 — Branch Manager

Context:
- branch-scoped
- alternates between live operations and Back Office
- responsible for exceptions and readiness

Primary live jobs:
1. Know whether the branch is healthy now.
2. See open operational exceptions.
3. See delayed orders/tables.
4. See cashier shift/drawer issues.
5. See low/out-of-stock items.
6. See payment failures/unknowns needing attention.
7. See KDS/printer/device problems.
8. See unresolved staff/guest escalations.

Primary Back Office jobs:
9. Maintain branch tables/floors/QR.
10. Maintain branch-specific menu availability/overrides.
11. Manage branch staff.
12. Manage stock and purchasing as permitted.
13. Configure Smart Cashier/automation.
14. Configure branch service/operating settings.
15. Manage branch devices/stations.
16. Review audit/activity.
17. Complete launch/readiness items for a new branch.

Should not need:
- company-wide configuration unless granted
- platform SaaS administration tools
- raw technical job queues

UX consequence:
Branch Manager needs both a branch Home and access to Back Office domains. These are not the same screen.

---

# Persona J7 — Menu / Catalog Admin

Context:
- desktop Back Office
- lower frequency, detail-heavy

Primary jobs:
1. Manage categories.
2. Manage items.
3. Manage modifiers/options.
4. Reorder catalog structures.
5. Activate/deactivate/archive correctly.
6. Manage media for sellable items.
7. Define branch-specific overrides.
8. Understand why an item is unavailable.
9. Preview guest-facing results.
10. Coordinate content/experience presentation where permitted.
11. Review menu performance.

Should not see by default:
- live cashier queue
- waiter queue
- kitchen tickets
- payment reconciliation

UX consequence:
Menu should become a true Catalog workspace with structured sub-navigation and preview, not a single 2,800-line route mentally.

---

# Persona J8 — Inventory / Procurement Operator

Current authorization note:
This is a product persona, not currently a distinct StaffRole. It can map to owner, branch manager, menu admin, or future permission bundles.

Primary jobs:
1. Count/review current branch stock.
2. See low/out-of-stock exceptions.
3. Adjust stock with a reason.
4. Understand movement history.
5. Maintain par/threshold data.
6. Maintain ingredient/menu requirements.
7. Manage suppliers.
8. Create purchase order.
9. Fill/order based on need.
10. Edit lines and quantities.
11. Submit PO.
12. Receive delivery.
13. Record shortages/discrepancies.
14. Confirm stock updates.
15. Review receipt/history.

Should not see by default:
- cashier queue
- KDS tickets
- SaaS billing

UX consequence:
Inventory and Procurement may share a Back Office area but must be distinguishable workflows.

---

# Persona J9 — Finance / Payments Operator

Current authorization note:
Product persona; can map to owner/branch manager plus `online_payments.manage` and finance-related permissions.

Primary jobs:
1. Find a payment transaction.
2. See provider/payment state.
3. See bill/order/table context.
4. Refund when authorized.
5. Void/capture when supported.
6. Recover unknown provider state safely.
7. See settlement batches.
8. Run/import reconciliation.
9. Investigate mismatch.
10. Acknowledge/resolve reconciliation issue.
11. Understand gross/fees/net.
12. Review payout/settlement history.
13. Export/provide records to accounting.
14. Separate restaurant customer money from Balcona SaaS billing.

Should not see by default:
- kitchen tickets
- menu editing
- guest AI configuration

UX consequence:
A Money/Finance workspace is justified by existing backend jobs.

---

# Persona J10 — Owner / Company Admin

Context:
- single or multi-location
- decision-oriented
- not necessarily in the restaurant

Primary jobs:
1. Know company health quickly.
2. Compare locations.
3. See sales/orders/operations trends.
4. See problem locations.
5. See top/weak items.
6. See payment/settlement health.
7. See stock/procurement exceptions.
8. See AI/automation performance.
9. Manage central catalog/standards.
10. Manage team/access.
11. Add or prepare a new branch.
12. Manage Balcona plan/entitlements.
13. Review company audit/security events.
14. Drill down into a branch when needed.

Should not be forced to:
- open live kitchen queues
- behave like a cashier
- navigate by employee role names

UX consequence:
Owner should land on a company/HQ Home when multi-location, with easy scope drill-down.

---

# Persona J11 — Multi-location Operations / HQ Manager

Current authorization note:
Not a current StaffRole requirement. Could map to owner or scoped branch-manager memberships.

Primary jobs:
1. View all assigned locations.
2. Compare exceptions across locations.
3. roll out shared menu/config.
4. manage location-specific overrides.
5. standardize service settings.
6. coordinate branch launches.
7. see stock/payment/device health by location.
8. identify branches needing intervention.
9. audit change propagation.

UX consequence:
Balcona needs an explicit All Locations scope even if only larger tenants use it.

---

# Persona J12 — Balcona Platform Admin

Context:
- Balcona internal team
- operates the SaaS, not the cafe floor

Primary jobs:
1. Create/bootstrap cafe tenant.
2. Assign initial plan/subscription.
3. Create initial owner access/invite.
4. inspect company state.
5. adjust subscription status when authorized.
6. check system status.
7. support onboarding without impersonating restaurant roles unnecessarily.
8. preserve platform audit trail.

UX consequence:
Keep `/platform` separate from tenant Office.

---

# Persona J13 — Implementation / Onboarding Operator

Context:
- may be cafe owner/manager or a Balcona onboarding specialist
- temporary, project-oriented

Primary jobs:
1. create company/branch profile
2. import/build menu
3. create floors/tables/QR
4. invite initial staff
5. configure service mode
6. configure kitchen/devices
7. configure payments
8. validate readiness
9. test end-to-end guest flow
10. go live
11. hand ownership to operating team

UX consequence:
Setup is a guided project with completion and handoff, not permanent daily navigation.

---

## Cross-role ownership rules

### Rule 1 — Jobs can cross domains without merging workspaces
Example:
Cashier handles immediate payment; Finance handles reconciliation.

### Rule 2 — Permission does not imply navigation prominence
Kitchen may have read permissions for menu/inventory context but should not get Menu Admin/Inventory navigation by default.

### Rule 3 — Role defaults should be opinionated
A user can have broad permissions and still land in their most likely workspace.

### Rule 4 — Scope matters as much as role
Owner at All Locations is a different job context from owner inside one branch.

### Rule 5 — Device identity can override generic role navigation
A dedicated KDS should stay KDS even if a manager signs in to troubleshoot.

## R5 completion gate

R5 status: COMPLETE

Completed:
- current authorization roles recorded
- guest and operational personas defined
- Back Office personas defined
- finance/procurement/HQ personas separated from database-role assumptions
- platform/onboarding personas defined
- primary jobs and non-goals recorded
- cross-role ownership principles recorded

Next:
R6 — Task / Frequency Map.
