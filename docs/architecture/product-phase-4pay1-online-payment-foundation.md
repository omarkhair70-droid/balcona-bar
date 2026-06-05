# Product Phase 4PAY.1: Online Payment Foundation

Product Phase 4PAY.1 adds a provider-agnostic online payment foundation for already-presented bills. It does not collect card data, does not call a real gateway, and does not add subscriptions, refunds, split bills, POS sync, or final order submission by AI.

## Scope

- Customers can start an online payment intent for a presented or payment-pending bill.
- The only runtime provider in this phase is the local/dev `mock` provider.
- Provider-like events flow through webhook-shaped backend endpoints.
- Online payment success settles a bill with the same guarded bill-settlement policy as manual payment.
- Duplicate provider events are idempotent and do not double-settle.
- Manual cashier payment remains available and is rejected by the backend after the bill is already paid online.
- Online payment success after manual payment records `settlement_skipped` instead of creating a second settlement.

## Data Model

`OnlinePaymentIntent` stores the provider-neutral payment attempt:

- provider: `mock` or future `external`
- status: `pending`, `requires_action`, `succeeded`, `failed`, `cancelled`, `expired`
- amount, currency, bill, branch, table session, checkout URL, and provider intent id
- idempotency key for caller retries

`OnlinePaymentEvent` stores provider/webhook and settlement audit events:

- `intent_created`
- `provider_webhook_received`
- `status_updated`
- `settlement_completed`
- `settlement_skipped`

The provider event id is unique per provider so duplicate webhook delivery can be safely ignored.

## Settlement Guard

Online success calls `BillsService.settleBillWithOnlinePayment()`. The bill is settled only after an atomic guarded update matches:

- the exact bill id
- status in `presented` or `payment_pending`
- `balanceDueMinor` equal to the intent amount

Only after that guard wins does the backend create bill events, close the linked bill request, complete served orders, close the table session when no open orders remain, generate the receipt, and emit realtime bill/receipt events.

## Mock Provider

Mock endpoints are intended for local/dev smoke testing:

- `POST /api/v1/customer/sessions/:sessionId/bills/:billId/online-payment-intents`
- `GET /api/v1/customer/sessions/:sessionId/online-payment-intents/:intentId`
- `GET /api/v1/branches/:branchId/online-payments`
- `GET /api/v1/online-payment-intents/:intentId`
- `POST /api/v1/online-payments/mock/:intentId/succeed`
- `POST /api/v1/online-payments/mock/:intentId/fail`
- `POST /api/v1/online-payments/webhooks/mock`

Mock actions are disabled when `onlinePayments.mockEnabled` is false. The app does not render or process raw card data.

## Configuration

Local defaults:

```env
ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_PROVIDER=mock
MOCK_ONLINE_PAYMENTS_ENABLED=true
ONLINE_PAYMENT_CHECKOUT_BASE_URL=http://localhost:3001
```

Production should keep `MOCK_ONLINE_PAYMENTS_ENABLED=false` and replace the provider implementation in a later phase before handling real money.

## Realtime And UI

The backend emits existing bill paid and receipt generated events, plus online payment-specific realtime events:

- `online_payment_intent_created`
- `online_payment_succeeded`
- `online_payment_failed`

Customer service can show Pay Online once a bill is presented. Cashier bill cards show online payment status while keeping manual payment controlled by the backend bill balance.

## Analytics And Cash Drawer

Owner analytics now include online revenue in paid revenue and tender breakdowns:

- `online_mock`
- `online_external`

Cashier shift reports include online totals separately, but online payments do not increase expected drawer cash.

## Limitations

- No real provider SDK.
- No real hosted checkout page.
- No refunds, partial capture, split payments, saved cards, or disputes.
- No SaaS subscription billing.
- No payment provider secrets are committed or required.
