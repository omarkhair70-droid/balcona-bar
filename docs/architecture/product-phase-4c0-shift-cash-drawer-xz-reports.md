# Product Phase 4C.0: Shift, Cash Drawer, and X/Z Reports

## Purpose

Product Phase 4C.0 turns manual payment recording into a branch cashier
operation. A cashier opens a branch shift with an opening cash float, records
manual payments against that open shift, reviews interim X reports, and closes
the shift with an immutable Z report snapshot.

This phase keeps the existing offline/manual settlement model. It does not add
online gateways, refunds, split bills, tax/e-invoicing, POS reconciliation,
inventory, payroll, or multiple drawers.

## Data Model

The phase adds:

- `CashierShift` for a branch cashier shift and cached operational totals.
- `CashDrawerTransaction` for opening float, cash payments, cash in, cash out,
  and corrections.
- `CashierShiftReport` for persisted X and Z report snapshots.
- `ManualPayment.cashierShiftId` as a nullable historical relation.

New payments require an open shift. Historical manual payments can remain
without a shift after migration.

PostgreSQL enforces one open shift per branch with a partial unique index:

```sql
CREATE UNIQUE INDEX "CashierShift_one_open_per_branch"
ON "CashierShift"("branchId")
WHERE "status" = 'open';
```

## Payment Integration

`BillsService.recordManualPayment()` still uses the guarded bill settlement
introduced in Product Phase 4P.0. Before settlement, it locks the branch cashier
shift scope and finds the current open shift.

If no shift is open, the backend returns:

```text
Open a cashier shift before recording payments
```

After the guarded bill update succeeds, the service creates `ManualPayment`
with `cashierShiftId`.

Tender behavior:

- `cash` attaches to the shift and creates a `cash_payment` drawer transaction.
- `card_pos`, `wallet_manual`, and `other` attach to the shift but do not
  increase expected cash.
- duplicate or stale payment attempts still fail before creating another
  payment or drawer transaction.

## X Report

An X report is an interim report for the current open shift. It is recomputed
from source records at generation time and persisted as `CashierShiftReport`.
It does not close the shift and does not include counted cash or over/short
values.

## Z Report

Closing a shift atomically:

- recomputes tender and drawer totals;
- accepts counted cash from the cashier;
- calculates cash over/short;
- creates a persisted `z_report`;
- stores the immutable Z snapshot on `CashierShift.zReportSnapshot`;
- marks the shift closed.

After close, no new payments can attach to that shift. A new cashier shift must
be opened before recording more payments for the branch.

## Report Snapshot

Reports include:

- shift identity, branch/company, status, opened/closed timestamps, and staff
  actors;
- opening float, cash payments, cash in/out, corrections, expected cash,
  counted cash, and over/short;
- tender totals for cash, card POS, manual wallet, other, and total collected;
- bill and payment counts;
- paid bill summaries, manual payment summaries, and drawer transactions.

The report snapshot is intentionally deterministic and source-record based.
Cached totals on `CashierShift` are operational convenience fields, not the
audit source of truth.

## Authorization

Shift routes use the existing staff session guard and branch permission
patterns:

- branch shift reads require branch-scoped `bills.read`;
- opening shifts and drawer adjustments require `bills.pay`;
- closing shifts requires `bills.close`;
- shift-id routes resolve the shift branch before checking permission.

Customer routes never expose cashier shift APIs.

## Cashier UI

The `/staff/cashier` dashboard now includes a shift panel near the top:

- no open shift: opening float, note, and open shift action;
- open shift: opened time, opening float, expected cash, tender totals,
  payment/bill counts, X report, cash in, cash out, and close shift controls;
- close shift: counted cash, note, calculated over/short, and Z generation.

Manual payment controls explain that a cashier shift must be open before
recording payment. After payment, the bill queue and shift panel refresh
together.

## Limitations And Future Work

- One open cashier shift per branch.
- No multiple drawers or cashier handoff.
- No refunds, voids, split payments, or cash drawer reconciliation workflow.
- No online payment gateway or gateway settlement reconciliation.
- No offline branch mode.
- No tax or e-invoicing.

Future phases can add multiple drawers, payment void/refund events, POS
provider reconciliation, cash pickup/drop policies, and end-of-day export.

## Local Demo Steps

1. Log in as a cashier, branch manager, or owner.
2. Open `/staff/cashier`.
3. Open a cashier shift with an opening float.
4. Submit a customer QR order.
5. Accept the order from cashier UI.
6. Mark kitchen preparation ready and serve the order.
7. Request and present the bill.
8. Record a cash manual payment.
9. Generate an X report.
10. Close the shift with counted cash and generate the Z report.
11. Confirm recording another payment requires opening a new shift.

## Validation

Expected validation for the phase:

```bash
pnpm --filter @balcona-bar/api prisma:migrate:dev
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```
