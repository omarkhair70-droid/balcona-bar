# Known Product Issues

This file captures issues found during QA-1 that are outside the safe scope of
the route inventory PR.

## Customer QR/session can feel slow on staging cold paths

- Area: customer
- Route: `/customer/table/balcona-main-t01`, `/customer/session/:sessionId/menu`
- Severity: medium
- Reproduction steps:
  1. Open `https://balcona-bar-staging-web.vercel.app/customer/table/balcona-main-t01`.
  2. Watch the initial "Opening your table session" state.
  3. Open the session menu immediately after landing.
- Expected behavior: QR session and menu move from loading to live state quickly
  enough for a phone-camera customer flow.
- Actual behavior: In QA-1 browser smoke, the QR route remained on "Starting
  session" in a short route pass, but resolved when rechecked with a longer
  wait. The menu also showed "Loading menu" in a short pass and resolved after a
  longer wait.
- Recommended follow-up PR: Add customer-facing timeout/retry telemetry and
  measure Railway/Neon cold-start latency before changing UX or backend
  behavior.

## Full authenticated staging smoke still depends on credentials and controlled data mutations

- Area: platform / staff / customer
- Route: `/platform/*`, `/staff/*`, `/customer/session/:sessionId/*`
- Severity: medium
- Reproduction steps:
  1. Try to complete the whole customer -> cashier -> kitchen/waiter -> bill
     loop from a clean browser without staging credentials.
  2. Try to verify QR regeneration, inventory receiving, or payment mocks
     without a controlled staging test tenant.
- Expected behavior: QA can run a documented, repeatable full smoke with a known
  staging tenant and disposable test data.
- Actual behavior: QA-1 could only run public/unauthenticated route smoke and
  non-mutating customer route checks. Authenticated platform/staff flows and
  mutating actions were not run.
- Recommended follow-up PR: Create a staging smoke data policy and credential
  handoff runbook for disposable test cafes before client demo rehearsals.

## Root page still reads like an implementation phase shell

- Area: public / demo
- Route: `/`
- Severity: low
- Reproduction steps:
  1. Open the staging root page.
  2. Read the headline and "UI Phase 8" badge.
- Expected behavior: A new stakeholder should immediately understand where to
  start as customer, staff, platform admin, or demo presenter.
- Actual behavior: The root page loads and links to the right surfaces, but its
  copy still describes a "Premium smart cafe product shell" and implementation
  phase status.
- Recommended follow-up PR: In CX-1 or a focused navigation polish PR, decide
  whether root should be a product launcher, demo launcher, or marketing page.
