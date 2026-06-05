# Product Phase 4A.0 Owner Analytics + Reports

## Purpose

Product Phase 4A.0 turns the owner dashboard into a real branch management
analytics surface. The goal is not forecasting or synthetic demo metrics; it is
an explainable report layer computed from records the cafe workflow already
creates.

The new branch-scoped API lives under:

- `GET /api/v1/branches/:branchId/owner-analytics/summary`
- `GET /api/v1/branches/:branchId/owner-analytics/sales`
- `GET /api/v1/branches/:branchId/owner-analytics/orders`
- `GET /api/v1/branches/:branchId/owner-analytics/items`
- `GET /api/v1/branches/:branchId/owner-analytics/operations`
- `GET /api/v1/branches/:branchId/owner-analytics/cashier-shifts`
- `GET /api/v1/branches/:branchId/owner-analytics/ai-waiter`
- `GET /api/v1/branches/:branchId/owner-analytics/dashboard`
- `GET /api/v1/branches/:branchId/owner-analytics/daily-report`

All endpoints require a staff session plus branch-scoped `analytics.read`.
Customer routes do not have access to these endpoints.

## Data Sources

The service reads existing operational records only:

- `ManualPayment` for collected revenue and tender mix.
- `Bill` and `BillLine` for bill status, paid bill snapshots, item names,
  quantities, modifier revenue, and historical item totals.
- `Order` for submitted order counts and lifecycle timings.
- `PreparationTask`, `KitchenTicket`, and `PrintJob` for operational pressure.
- `WaiterCall` and `TableAttentionSnapshot` for service pressure.
- `CashierShift`, `CashDrawerTransaction`, and `CashierShiftReport` for drawer,
  X/Z, and over/short analytics.
- `AiWaiterSession`, `AiWaiterMessage`, `AiWaiterCartProposal`, and
  `AiWaiterUsageEvent` for AI waiter usage and escalations.

No mocked revenue, fake analytics, hardcoded demo numbers, inventory cost, tax,
or online payment reconciliation is included.

## Date Range Behavior

Query parameters:

```json
{
  "from": "2026-06-05T00:00:00.000Z",
  "to": "2026-06-05T23:59:59.000Z",
  "preset": "today"
}
```

Supported presets are `today`, `last_7_days`, and `last_30_days`.

When both `from`/`to` and `preset` are provided, the explicit `from`/`to` range
wins. Custom ranges must include both dates and `from` must be before `to`.
The default is `today`, using the API server's local start of day through the
current time.

## Revenue And Collection Rules

Recorded manual payments are the source of truth for collected money in this
phase:

- `collectedMinor` is the sum of recorded `ManualPayment.amountMinor` in range.
- `paidRevenueMinor` uses the same source for deterministic reporting.
- tender totals are grouped by `cash`, `card_pos`, `wallet_manual`, and `other`.
- `paidBillCount` is the distinct count of bills settled by recorded manual
  payments in range.
- `averageTicketMinor = collectedMinor / paidBillCount`, with safe divide.
- unpaid bills are never counted as collected revenue.

Bill line item analytics are limited to paid bill snapshots connected to bills
with recorded manual payments in the selected range. This preserves historical
names, quantities, prices, and modifier snapshots instead of recalculating from
the current menu.

## Owner Dashboard Sections

The `/staff/owner` page now uses the combined owner analytics dashboard endpoint
and daily report endpoint. It includes:

- preset selector for Today, Last 7 days, and Last 30 days;
- revenue, collected, average ticket, paid bills, orders, cash over/short, open
  waiter calls, and AI session cards;
- sales/tender and revenue bucket tables;
- order status, bill status, waiter call, and lifecycle timing sections;
- top items by quantity and revenue;
- preparation, kitchen ticket, and print job operational sections;
- cashier shift, drawer movement, and latest Z report summaries;
- AI waiter sessions, messages, proposals, escalations, token, and cost totals;
- a readable daily report snapshot card.

Empty sections render "No data in this range yet" and action/API errors are
formatted through the shared frontend error formatter to avoid raw object text.

## Limitations And Future Work

Not included yet:

- inventory cost, margin, waste, or profit reporting;
- tax, e-invoicing, service charge policy analytics, or fiscal exports;
- online payment gateway reconciliation;
- PDF, spreadsheet, or scheduled email exports;
- multi-branch portfolio owner dashboard;
- predictive analytics or machine-learning forecasts;
- CRM, loyalty, customer segmentation, Wi-Fi, GPS, or proximity metrics.

Those belong in later product and deployment phases after the operational
record model is stable in production.
