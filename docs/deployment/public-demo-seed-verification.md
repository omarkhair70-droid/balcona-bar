# Public Demo Seed Verification

The first public demo depends on real seed data in the deployed database. Do not
fake successful flows in the UI; verify the backend data exists before sharing a
public link.

## Required Demo Identity

- Demo company exists.
- Demo branch exists.
- Demo table exists.
- Demo QR slug or token exists: `balcona-main-t01`.
- Customer route opens: `/customer/table/balcona-main-t01`.

## Staff Access

- At least one staff account exists for the demo branch.
- Staff membership and permissions allow the expected dashboard access.
- Staff login route opens: `/staff/login`.
- Demo credentials are stored and shared through an approved secure channel.
- Production or public demo environments must not rely on open-ended local
  password bootstrap.
- If a bootstrap path is temporarily needed, it must be disabled immediately
  after the approved staff account is created.

## Menu Readiness

- Menu has visible categories.
- Categories have visible items.
- Demo items have prices.
- Required modifiers are configured so customer validation works.
- Availability state matches what the demo presenter expects.

## Customer Flow

Verify manually:

- Customer can start or resume a table session.
- Customer can browse the menu.
- Customer can open an item detail.
- Customer can satisfy required modifiers.
- Customer can add an item to cart.
- Customer can view cart.
- Customer can submit cart.
- Customer sees order status after submit.

## Staff Dashboard Flow

Verify manually:

- Staff can log in.
- Staff default branch is correct.
- Cashier dashboard can see submitted orders.
- Kitchen/barista dashboard can see preparation work after cashier acceptance.
- Waiter dashboard can see waiter calls or attention items when created.
- Owner/manager dashboard can load the branch operations snapshot.

## Public Smoke Baseline

Run the smoke script after deployment:

```bash
WEB_BASE_URL=https://app.example.com \
API_BASE_URL=https://api.example.com \
./scripts/deploy/smoke-test-public-demo.sh
```

The script verifies page availability. The full customer/staff flow still needs
manual verification with the seeded data above.
