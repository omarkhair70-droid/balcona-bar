# Product Phase 4P.0: Bill, Manual Payment, and Receipt Core

## Summary

Product Phase 4P.0 adds the first real settlement foundation for the cafe OS:
stable bills, manual cashier payment recording, and receipt payloads. It keeps
payment offline/manual only and leaves online payment, refunds, split bills,
tax/e-invoicing, POS integrations, cash drawer, and inventory for later phases.

## Data Model

The phase adds:

- `Bill` for stable bill headers and lifecycle status.
- `BillLine` for immutable order-item snapshots copied from submitted order
  item snapshots.
- `ManualPayment` for cashier-recorded cash, card POS, wallet, or other
  payments.
- `BillReceipt` for receipt JSON payload plus printable text.
- `BillEvent` for audit-friendly bill lifecycle events.

Bill requests now have an optional one-to-one linked `Bill`. Realtime event
types include bill creation, payment recording, paid state, and receipt
generation.

## Bill Generation

Customer bill requests create or reuse a stable bill snapshot immediately. The
bill is generated from current billable orders in accepted, preparing, ready,
served, or completed states. Bill lines copy order item snapshots, including
item names, quantity, unit price, modifier total, line total, currency, and
modifier snapshots. Menu prices are not recalculated during billing.

The bill number is branch-scoped and generated under a PostgreSQL advisory lock.
Repeated access to the same bill request returns the same linked bill instead
of generating duplicate lines.

## Manual Payment Flow

Cashiers can record manual payments through branch-scoped bill permissions. The
first phase intentionally requires the manual payment amount to exactly match
the bill balance. Partial payments, split bills, refunds, voids, and online
payments are not implemented.

When a payment is recorded:

- a `ManualPayment` row is created;
- the bill is marked `paid`;
- the linked bill request is closed;
- served orders for the table are completed;
- the table session is closed only when no non-terminal orders remain;
- a receipt is generated.

## Receipt Generation

Receipts are generated only for paid or closed bills. The receipt stores both a
structured JSON payload and printable text. The payload includes company,
branch, table, bill totals, lines, and manual payment records. Receipt numbers
are branch-scoped and derived from the bill number.

## Customer UX

The customer service screen still lets the customer request the bill, but now it
also shows active bill lines, total, balance due, and receipt status when the
backend returns them. Customers are not offered online payment in this phase;
the UI states that payment is handled with the cashier at the table.

## Cashier UX

The cashier bill request queue now shows the linked stable bill, bill lines,
totals, recorded payments, receipt status, and a manual payment panel. The panel
supports cash, card POS, wallet manual, and other methods, with optional
reference and note fields.

## Permissions And Scope

The phase adds `bills.pay`. Branch managers and cashiers receive it by default.
Bill detail, manual payment, cancellation, and receipt endpoints resolve access
from the bill's branch before checking staff permissions.

## AI Safety

AI waiter payment behavior remains backend-safe. The existing provider safety
layer rejects final order submission, direct payment actions, refunds,
discount/payment promises, and visible payment confirmation text. AI can suggest
that a customer ask staff for help, but it cannot record or confirm payment.

## Known Limitations

- Manual payments must exactly match the balance due.
- No online payment provider, webhooks, refund, split bill, tax/e-invoicing, POS
  sync, cash drawer, or inventory behavior is included.
- Receipt text is a foundation for printable output, not a certified invoice.
- Bill close policy is intentionally conservative and session close occurs only
  when orders are terminal.

## Validation

Expected validation for the phase:

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```

When applying locally against a development database, also run:

```bash
pnpm --filter @balcona-bar/api prisma:migrate:dev
```
