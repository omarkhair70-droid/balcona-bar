# Balkona Full Demo Smoke Test

## Purpose

This runbook verifies the local Balkona presentation flow from customer table
QR through staff operations and owner overview. It uses existing frontend
routes and backend contracts only.

## Local Setup

Run these in separate terminals and keep them open during the demo:

```powershell
docker compose up -d
pnpm --filter @balcona-bar/api start:dev
$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"
pnpm web:dev
```

Seed and migrate the database if the local environment was reset:

```powershell
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api prisma:migrate:dev
pnpm --filter @balcona-bar/api prisma:seed
```

## URLs

- Demo launcher: `http://localhost:3001/demo/balkona`
- Customer entry: `http://localhost:3001/customer`
- Customer QR demo: `http://localhost:3001/customer/table/balcona-main-t01`
- Staff login: `http://localhost:3001/staff/login`
- Staff overview: `http://localhost:3001/staff`
- Cashier: `http://localhost:3001/staff/cashier`
- Kitchen / Barista: `http://localhost:3001/staff/kitchen`
- Waiter / Floor: `http://localhost:3001/staff/waiter`
- Owner / Manager: `http://localhost:3001/staff/owner`

## Local Staff Credentials

These are local/demo credentials only:

```text
manager@balcona.local
change-me-local-123
```

Bootstrap the password locally if needed:

```powershell
curl -X POST http://localhost:3000/api/v1/staff-auth/dev/bootstrap-password `
  -H "Content-Type: application/json" `
  -d '{"email":"manager@balcona.local","password":"change-me-local-123"}'
```

## End-to-End Checklist

1. Open `/demo/balkona`.
2. Confirm the API base URL, route list, command reference, and local credentials are visible.
3. Open the customer QR route for `balcona-main-t01`.
4. Confirm the table session starts or resumes and lands on the table home.
5. Open the menu, select a real menu item, satisfy required modifiers, and add it to cart.
6. Optionally open AI Waiter and apply a backend proposal if one is returned.
7. Open the cart, confirm totals, and submit the order manually.
8. Log in as staff with the local/demo account.
9. Open cashier and accept the submitted order.
10. Open kitchen/barista and start or mark a preparation task ready.
11. Open waiter/floor, serve the ready order, then open service from the customer session and request the bill when available.
12. Open waiter/floor and acknowledge or resolve the call or table attention item.
13. Open owner/manager and confirm branch pulse, operations snapshot, attention, realtime, and readiness panels load.

## Bill Request Smoke Guard

When validating the billing path through API or a local script, stop immediately
if bill request creation fails or returns an empty bill request/bill id. Do not
continue into present or manual payment with blank identifiers.

```powershell
$billRequest = curl -s -X POST `
  "http://localhost:3000/api/v1/table-sessions/$sessionId/bill/request" `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer $customerAccessToken" `
  -d "{}" | ConvertFrom-Json

if (-not $billRequest.billRequest.id -or -not $billRequest.bill.id) {
  throw "Bill request smoke failed: missing billRequest.id or bill.id"
}
```

## Per-Screen Verification

- `/demo/balkona`: launcher title, readiness cards, launch links, local/dev credentials, checklist, proof points, diagnostics, and terminal reminder are visible.
- `/customer`: demo QR token is available and the full demo launcher can be opened.
- `/customer/session/:sessionId`: menu, AI waiter, cart, status, and service next steps are clear.
- `/customer/session/:sessionId/menu`: add-to-cart failures render visible customer feedback.
- `/customer/session/:sessionId/cart`: submit failures keep the cart visible and show retry-friendly copy.
- `/customer/session/:sessionId/service`: waiter-call and bill-request failures show visible feedback, and no-billable-order state explains when the bill becomes available.
- `/staff`: operations hub links to cashier, kitchen, waiter, owner, and the Balkona demo launcher.
- `/staff/cashier`: empty, loading, success, error, and branch states are visible.
- `/staff/kitchen`: task empty, loading, success, error, and branch states are visible.
- `/staff/waiter`: call, attention, empty, loading, success, error, and branch states are visible.
- `/staff/owner`: no fake revenue or fake analytics; visible values are derived from existing branch endpoints.

## Known Limitations

- Payment and POS are intentionally not part of the demo.
- SaaS admin, tenant admin, company admin, and menu admin UI are intentionally not part of this UI phase.
- External AI provider integration is outside this phase; the UI renders backend AI waiter contracts defensively.
- The owner view aggregates existing endpoints client-side and does not claim final paid revenue.
- Realtime is represented by the existing SSE refresh foundation; keep API and web terminals running.
