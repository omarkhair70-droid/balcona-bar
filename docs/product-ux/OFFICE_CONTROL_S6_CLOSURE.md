# Office Control Plane / S6 Closure

Branch: `closure/office-control-s6`  
Integration target: `codex/full-platform-closure-20260830-1214`

## Ownership boundary

S6 owns only:

- Team
- Money
- Experience
- Settings
- Account / Plan & Billing

Office Core remains owned by the parallel S5 lane:

- Home
- Operations
- Catalog
- Inventory
- Locations
- Insights

This change does not redesign Office Core or replace its shell/navigation model.

## Product model

Office Control is ongoing business administration. Roles control authorization; they do not define navigation.

The implementation exposes backend truth and deliberately leaves unsupported administration read-only rather than simulating successful mutations.

## Team

### People

Reads the existing `StaffUser` / `StaffMembership` administration API. The selected Office location filters the visible membership set while company-level memberships remain explicit.

### Roles & access

Uses the existing effective access resolver and displays real membership scope plus effective permissions.

The backend currently has no general staff role-reassignment mutation. S6 therefore does not add a fake role editor.

### Invites

Uses the existing branch onboarding staff-invite mutation. That service creates/activates the real staff user/membership and returns an invite path.

The UI says that an invite link was created. It does not claim that email delivery occurred.

### Location access

Location access is derived from real company/branch membership scope.

### Sessions/security

The backend supports the current staff session lifecycle, including expiration and revocation through logout. It does not expose an all-device session management API, so S6 only exposes the current session and a real current-token revoke action.

## Money

Restaurant/customer money is kept separate from Balcona SaaS account billing.

The Money surface exposes:

- branch bills
- online payment intents / transactions
- refund
- void
- capture
- provider inquiry/recovery
- provider reconciliation runs
- settlement-statement import
- payout / settlement references returned by reconciliation
- financial reconciliation issues
- issue acknowledge / resolve

All financial mutations use existing server APIs, existing provider validation, idempotency, scoped authorization, and destructive confirmation.

### Provider truth policy

S6 never labels an adapter "live" because code exists.

Transaction/provider labels are conservative:

- mock -> test / mock
- explicit non-live evidence -> sandbox / test evidence
- transaction evidence where configured and observed live -> live evidence on that transaction
- Paymob/Fawry without verifiable live evidence -> provider recorded; live certification unverified
- absent provider evidence -> provider state unavailable

No mock succeed/fail control is promoted into Office Money.

## Experience

The Experience surface exposes supported backend capability:

- company and branch Experience Profiles
- profile activation / archive / default lifecycle
- Balkona experience-pack preview and apply
- content blocks and activation state
- notification templates and activation state
- company media assets and archive/restore lifecycle
- AI Waiter branch runtime switch
- AI Waiter tone/personality where present in profiles
- venue zones
- presence events
- notification delivery activity

Sub-queries are permission-aware. A user with `experience.read` does not trigger unrelated media/content/presence/settings calls that their role cannot read.

## Experience/content/media authorization hardening

Before S6, several experience/content/media administration endpoints did not consistently use the staff authorization pattern already established in payments, bills, zones, and other domains.

S6 applies the existing pattern:

- company list/create endpoints: staff session + permission + company scope
- branch list/create endpoints: staff session + permission + branch scope
- resource-by-id endpoints: load `companyId` / `branchId`, then assert effective permission for that record
- media usage listing: requires an explicit company scope and checks `media.read`
- media usage mutations: resource-scoped `media.manage`

The public effective guest-experience endpoint remains public intentionally because it is consumed by guest surfaces.

## Settings

The Settings surface is scope-aware:

### Business

Company identity uses the existing company onboarding profile mutation. It is only offered when company-level `tenant_onboarding.manage` is available.

### Branch operating settings

Exposes validated `BranchOperatingSettings` fields, including:

- operating mode
- service mode
- runtime feature switches through their supported controls
- updated-at evidence

### Feature flags

Exposes real branch feature flag keys and distinguishes:

- inherited backend default
- explicit branch value

Each flag shows the documented runtime consequence and uses the existing audited mutation.

### Integrations

Provider credentials or environment secrets are not exposed by staff APIs. The UI therefore avoids fake "connected/live" switches. Payment environment truth is shown in Money where transaction evidence exists.

### Security

Shows supported current-session security state and links ongoing staff access/session administration to Team.

### Advanced

Structured JSON configuration is visible read-only where a dedicated validated editor is not implemented. S6 does not add a generic JSON write that bypasses existing DTO validation.

### Audit

Recent branch audit entries expose action, target, actor, time, and backend-recorded consequence/message where available.

## Account / Plan & Billing

The existing SaaS status surface is retained and promoted to Account.

It shows:

- plan
- subscription state
- entitlements
- tenant usage and limits
- blockers / warnings
- internal plan catalog

The backend itself states that real external subscription billing is not yet connected; the UI preserves that truth.

Restaurant money remains in Money.

## Permission gates

Existing role/permission tests already cover branch isolation and tenant scope. S6 adds explicit Office Control coverage:

- branch manager: positive management access for Team, Money, Experience, Settings/flags and read access to SaaS plan state
- cashier: positive read access where defined by the role and negative management access for Team, payment mutations, experience management, settings management, flags, and SaaS account state
- branch membership in another branch remains denied
- company-level membership remains scoped to its company
- new Experience/Content/Media resource helpers resolve the record scope before checking permissions
- missing scoped resources fail before permission evaluation

## UX state gates

New S6 surfaces implement:

- loading states
- empty states
- API error states with retry where appropriate
- negative permission states
- branch/location selector scope
- destructive confirmations
- financial exception state
- real mutation failure display
- no optimistic/fake success messaging

The Office shell already uses responsive desktop/tablet behavior and logical-direction border/alignment utilities. New tables are horizontally scrollable where needed and all controls remain usable in RTL. The Office visual harness now captures Team, Money, Experience, Settings, and Account directly, including a tablet Money viewport and an Arabic RTL Team tablet viewport.

## Reference synthesis

Current references were rechecked only for specific unresolved administration problems:

- Restaurant365: explicit user security, location access, and permission administration
- Square Dashboard: team/location permission patterns
- Toast: explicit payment/refund/void and finance reporting concepts
- Lightspeed Back Office: payment reporting and payout visibility

The implementation borrows administration principles only: explicit scope, explicit financial state, exception visibility, and permission clarity. It does not copy visual branding or competitor information architecture.

## Shared files changed

The following shared files are intentionally touched and kept narrow:

- `apps/web/features/staff/office-staff-shell.tsx`
  - replaces S6 hash placeholders with S6 route links
  - adds one Account navigation item
  - leaves Office Core links unchanged
- `apps/web/features/staff/pages/staff-billing-page.tsx`
  - re-labels the existing SaaS plan surface as Account / Plan & Billing
  - separates SaaS billing copy from restaurant Money
- `apps/web/messages/en.json`
  - Account navigation label only
- `apps/web/messages/ar.json`
  - Account navigation label only
- `apps/api/src/staff/staff-scoped-access.service.ts`
  - adds scope resolution helpers for Experience Profile, Content Block, Notification Template, Media Asset, and Media Usage
- `scripts/visual-qa/office-production-visual.mjs`
  - extends the existing Office visual harness with S6 routes, deterministic API fixtures, desktop/tablet captures, RTL capture, overflow checks, and browser-console failure checks

No broad shared shell rewrite is included.

## Deliberately unsupported rather than faked

- arbitrary staff role reassignment
- all-device staff session administration
- media binary upload transport
- staff-editable payment provider credentials/live-certification
- external Balcona subscription payment gateway
- generic unvalidated advanced-settings JSON writes

These require backend capability beyond S6's mandate and are not simulated.
