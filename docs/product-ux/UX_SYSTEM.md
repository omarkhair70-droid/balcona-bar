# R9 — Balcona UX System

Status: COMPLETE
Audit date: 2026-08-28

## Purpose

R9 defines how Balcona behaves as a product before visual redesign.

This system governs:
- navigation
- scope
- search
- data density
- tables/lists
- detail panels
- forms
- filters
- bulk actions
- realtime state
- destructive actions
- empty/loading/error states
- responsive behavior
- touch behavior
- Arabic/RTL
- accessibility

It is shared across Guest, Service, Kitchen, Office, Setup, and Platform, with surface-specific density rules.

---

# 1. Navigation system

## Office

Primary structure:
- persistent left navigation on desktop
- compact/collapsible navigation on medium screens
- mobile Office access is supported but not the primary authoring environment

Persistent top frame:
- company/location scope
- global search / command
- attention inbox
- account/language

Navigation rules:
1. Domain names only.
2. Do not show destinations without permission.
3. Do not show irrelevant branch-only destinations at All Locations unless they have an aggregate view.
4. Do not show disabled product modules as permanent dead links.
5. Nested navigation depth target: max 2 visible levels.
6. Deep settings remain searchable even if not persistent.

## Service

Navigation is task-oriented and role/device adaptive.

Core destinations:
- Floor
- Orders
- Attention
- Bills
- Shift

Rules:
- cashier can default to Orders
- waiter can default to Attention/Floor
- dedicated terminal can remain pinned to one mode
- Office escape is secondary and permission-gated

## Kitchen

No generic product navigation rail.

Persistent controls only:
- station
- queue/filter
- layout
- alerts
- manager/exit action

## Guest

Bottom/mobile session navigation follows the meal journey.

Rules:
- cart/order state can surface as badges
- Bill appears/promotes when relevant
- AI is contextual
- no product-admin concepts

## Setup

Setup has its own step/progress navigation, not Office primary nav.

---

# 2. Scope system

Every Office page declares scope support:

- Company
- All Locations
- Single Branch
- Object-level

Scope control must communicate:
- current scope
- whether the page supports aggregate data
- whether changes apply globally or locally

Configuration state labels:
- Company default
- Inherited
- Branch override

Override actions:
- Override for this branch
- Reset to company default

Never perform a scope-changing write without showing the target location/company.

---

# 3. Global search / command

Shortcut:
- Cmd/Ctrl + K

Search categories:
- Navigate
- Orders
- Bills
- Payments
- Menu items
- Staff
- Tables
- Suppliers
- Purchase orders
- Settings

Command principles:
- safe navigation can execute immediately
- mutating actions must open the normal action UI
- destructive/financial mutations cannot execute directly from search
- results respect permissions and current tenant

---

# 4. Home / attention system

Home is not a module launcher.

Priority order:
1. critical blockers
2. money/reconciliation issues
3. live operational exceptions
4. stock/procurement issues
5. setup/readiness only when incomplete
6. trends and metrics

Attention object format:
- what happened
- where
- severity
- age
- owner/assignee if any
- direct resolution link

Do not require users to infer urgency from decorative metrics.

---

# 5. Data density system

## Density A — Guest
- generous spacing
- one dominant action
- content-first
- image-friendly
- minimal tables
- plain language

## Density B — Service
- compact enough for speed
- large touch targets
- dense queues/cards
- essential metadata only
- important status always visible

## Density C — Kitchen
- maximum scannability
- large type for item/modifier
- high contrast
- timer/status dominates
- minimum chrome

## Density D — Office
- information-dense
- tables over card grids for structured records
- persistent filters where useful
- batch actions
- drill-down

## Density E — Setup
- guided
- fewer choices at once
- progress-oriented
- recommendations/defaults

---

# 6. Table / list system

Use tables when:
- comparing records
- bulk managing
- scanning many structured fields
- sorting/filtering matters

Use cards when:
- operational queue items have state/action emphasis
- guest content is visual
- few records need large touch actions

Office table standards:
- sticky header where useful
- sortable columns
- filter chips
- saved view support later
- row selection only when a meaningful bulk action exists
- row click opens detail
- primary identifier remains visible
- status uses text + icon/color, not color only

---

# 7. Detail-panel system

Preserve and standardize Balcona's current list → detail-panel pattern.

Use side panel when:
- user must keep queue/list context
- action is quick
- record detail is secondary to current list

Use full page when:
- multi-step editing
- deep history
- complex financial investigation
- long configuration forms
- multiple related tabs

Use modal when:
- bounded confirmation
- short create/edit
- one clear decision

Do not use modal for complex record administration.

---

# 8. Form system

Form principles:
1. Group by job, not schema.
2. Show scope at top.
3. Required fields are explicit.
4. Recommended defaults are preselected where safe.
5. Advanced options collapsed by default.
6. Save behavior is consistent.
7. Dirty-state navigation warns before loss.
8. Server validation maps to exact fields where possible.
9. Entity IDs/slugs are hidden unless operationally meaningful.

Form footer:
- primary Save/Create
- secondary Cancel
- destructive actions separated visually

---

# 9. Filter system

Operational filters:
- minimal
- fast toggles
- remember current device/session preference

Office filters:
- search
- status
- location
- date range
- owner/actor
- provider/supplier/category depending domain

Rules:
- active filters are visible
- clear-all available
- URL/state persistence for shareable investigations where appropriate

---

# 10. Bulk action system

Allowed examples:
- menu availability
- archive/deactivate
- location assignment
- stock review selection
- staff access
- issue acknowledge where safe

Bulk action rules:
- show selected count
- show target scope
- summarize consequences
- no hidden cross-location effect

Financial operations:
- no broad bulk refund/void by default

---

# 11. Status language

Statuses must be human and domain-specific.

Examples:

Payment:
- Waiting for customer
- Confirming payment
- Paid
- Failed
- Needs review
- Refunded

Order:
- Needs review
- Accepted
- Preparing
- Ready
- Served
- Complete
- Cancelled

Do not expose raw provider/backend enum names to Guest.

Office may show technical/provider state in detail, but always alongside a Balcona interpretation.

---

# 12. Realtime system

Realtime state should answer:
- connected?
- last updated?
- stale?
- action pending?

Do not over-display transport details.

Operational workspaces:
- auto-update lists
- visually announce meaningful new work
- preserve user's current detail context
- avoid jumping rows unpredictably

If realtime disconnects:
- show stale/offline state
- keep last known data visible
- provide refresh/reconnect
- do not imply live certainty

---

# 13. Optimistic action rules

Safe for optimistic UI:
- acknowledge waiter call
- mark notification read
- low-risk local UI state

Not optimistic without authoritative confirmation:
- payment success
- refund
- void/capture
- bill paid
- shift close
- destructive branch/entity state

Financial truth must remain backend/provider authoritative.

---

# 14. Loading system

Avoid full-page spinners where partial content can render.

Patterns:
- skeleton/table placeholder for Office lists
- queue placeholders for Service
- ticket placeholders for Kitchen
- content skeleton for Guest

Long-running mutations:
- disable duplicate action
- show progress/state
- preserve idempotency/retry semantics
- reveal recovery path on ambiguity

---

# 15. Empty-state system

Empty states classify into:

### Healthy empty
Example:
No payment issues.

Tone:
positive/neutral, no unnecessary action.

### Setup empty
Example:
No suppliers yet.

Tone:
explain value + create/import action.

### Filtered empty
Example:
No transactions match filters.

Tone:
clear filters.

### Permission empty
Do not show as empty data.
Explain access only where useful.

### Failure empty
Never disguise load failure as no records.

---

# 16. Error system

Error hierarchy:

1. Inline field error
2. Action error
3. Section load error
4. Page load error
5. Critical operational outage

Error messages contain:
- what failed
- whether state changed
- what user should do next
- retry/recovery action when safe

For payments:
- "We don't know yet" is a valid state.
- never convert unknown into failed/success without authoritative truth.

---

# 17. Confirmation / destructive action system

Replace browser-native confirmation.

Risk levels:

### Low
Reversible edit:
- no confirm

### Medium
Deactivate/archive/revoke:
- confirmation dialog
- consequence
- scope

### High
Financial/security/destructive:
- explicit object and amount
- reason where needed
- permission check
- confirmation
- audit trail
- success/failure result

Examples:
- refund
- void
- close shift with variance
- regenerate QR
- revoke staff access
- disable branch

---

# 18. Notification / attention system

Separate:
- operational attention
- informational notification
- background success toast

Operational attention persists until resolved/acknowledged.

Do not use transient toast for:
- payment mismatch
- failed print route
- unresolved table request
- security issue

---

# 19. Audit visibility

Show "last changed by / at" when consequence is important:
- pricing
- branch override
- roles/access
- payment/refund operation
- automation rule
- feature flag
- service mode
- printer/device config

Deep audit log remains Office-level.

---

# 20. Touch / keyboard behavior

## Service
- minimum touch target ~44px
- primary actions reachable one-handed where possible
- keyboard shortcuts optional for fixed cashier terminal
- avoid hover-only affordances

## Kitchen
- larger touch targets
- no tiny secondary controls in ticket body
- manager actions separated

## Office
- keyboard navigation/search strongly supported
- dense pointer-friendly tables
- bulk actions

## Guest
- mobile thumb ergonomics
- bottom actions where task-critical
- safe-area aware

---

# 21. Responsive behavior

Do not merely stack desktop layouts.

Guest:
- mobile-first

Service:
- dedicated tablet/terminal layouts
- phone waiter mode can differ from cashier terminal

Kitchen:
- landscape-first dedicated display

Office:
- desktop-first
- tablet responsive
- mobile provides review/emergency access, not every heavy admin workflow

Setup:
- desktop/tablet preferred
- mobile can complete light steps

---

# 22. Arabic / RTL system

Arabic is a first-class product layout.

Requirements:
- logical properties/end/start
- icons with directional meaning mirror where needed
- number/currency remain readable
- table alignment tested
- mixed Arabic/English product/provider names supported
- drawers/panels respect direction
- KDS readability tested in Arabic
- Guest content never assumes LTR image/text composition

No R11 design is approved until both Arabic and English examples are reviewed.

---

# 23. Accessibility baseline

- visible focus
- semantic headings
- no color-only status
- meaningful button labels
- aria-live for important async states
- contrast appropriate to operational environments
- keyboard reachability in Office
- reduced-motion respect
- touch target minimums

---

# 24. Existing components to preserve conceptually

Current Balcona patterns worth retaining/refactoring:
- permission-gated routes
- branch-scoped data contracts
- detail panels
- empty/loading state components
- language switcher
- realtime status concept
- reusable buttons/cards as primitives

Patterns to retire or constrain:
- glass/premium card for every page
- giant page hero on every Staff route
- feature-card launcher Home
- browser-native confirm
- identical shell for Owner/Cashier/Kitchen/Waiter

# R9 completion gate

R9 status: COMPLETE

Next:
R10 — Screen Architecture.
