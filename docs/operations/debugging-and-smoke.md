# Debugging And Smoke

OBS-1 makes staging bugs diagnosable from either a copied debug report or one
`requestId`. The report and logs are designed to be safe to share: they include
correlation IDs, route/action context, timings, and sanitized error codes, but
never auth tokens, cookies, raw request bodies, raw AI messages, customer notes,
database URLs, or secrets.

## What To Send

When reporting a bug, send one of:

- The copied debug report from the visible `Copy debug report` button.
- The `requestId` shown in the UI error message.
- If available, the `flowId` or `clientTraceId` from the copied report.

Also include what you clicked, the expected outcome, and whether it happened on
staging or local development.

## Copy A Debug Report

In staging and development, important error states show `Copy debug report`.
Click it and paste the JSON into the bug report. The report includes:

- current route and timestamp
- environment, build SHA, build time, and app version
- user agent and viewport
- flow/action name
- requestId, flowId, and clientTraceId
- safe API method/path/status/code/message
- safe sessionId/orderId/taskId/ticketId where available
- last breadcrumbs such as route changes, API calls, retries, and action clicks

Do not add screenshots of browser storage, cookies, auth headers, raw payloads,
raw AI messages, customer notes, or `.env` values.

## Search Railway Logs

Search by the strongest ID you have:

```text
requestId="req-..."
flowId="customer_order_cycle:..."
clientTraceId="..."
```

Backend request logs use:

- `request_started`
- `request_completed`
- `request_failed`
- `slow_request`

Action-style logs include `action`, `stage`, `result`, `durationMs`, and safe IDs
such as `sessionId`, `orderId`, `taskId`, `ticketId`, and `branchId` when the
route or payload safely exposes them.

## Correlate Frontend And Backend

The frontend sends these headers on API requests:

- `X-Request-Id`: one ID per API request
- `X-Flow-Id`: stable per customer/staff flow when possible
- `X-Client-Trace-Id`: stable for the browser session

The backend accepts or generates those values and returns them as response
headers. If the response is an error, the body also includes the `requestId`,
`flowId`, and `clientTraceId`.

## Slow Requests

Any request above 2000ms emits `slow_request` with:

- requestId / flowId / clientTraceId
- method and safe path
- action if inferred from the route
- statusCode and durationMs
- safe IDs from route params/body

Critical server flows may also include stage timings, for example cart submit
timings such as `submitLockMs`, `idempotencyLookupMs`, `cartValidationMs`,
`orderCreateMs`, and `responseMappingMs`.

## Prisma P2028 / Transaction Timeout

If Prisma reports `P2028`, the API maps it safely to:

```text
DB_TRANSACTION_TIMEOUT
```

Search logs for the `requestId`, then inspect the action and stage timings. This
usually means an interactive transaction did too much work or waited on a slow
side effect.

## Missing Migrations Or Schema Mismatch

Schema-like Prisma errors are mapped safely to:

```text
MIGRATION_NOT_APPLIED
DATABASE_SCHEMA_MISMATCH
```

The API health/system metadata intentionally does not run risky live schema
introspection. To verify staging migrations, run the deploy migration command in
the deployment environment:

```bash
pnpm --filter @balcona-bar/api prisma:migrate:deploy
pnpm --filter @balcona-bar/api prisma:generate
```

Then check:

```text
/health
/api/v1/system/info
```

Those endpoints expose safe metadata only: version, environment, git SHA, build
time, and migration check guidance.

## Manual Smoke

Use a fresh order after each staging deploy:

1. Open `/demo/balkona`.
2. Open `/customer/table/balcona-main-t01`.
3. Add Spanish Latte with required modifiers.
4. Submit cart.
5. Open `/staff/cashier`.
6. Accept order.
7. Open `/staff/kitchen`.
8. Start the preparation task.
9. Mark the task ready.
10. Serve the order from staff/waiter or cashier flow.
11. Request bill from customer service.
12. Present the bill.
13. Record manual payment.
14. Confirm receipt appears.

Stop immediately at the first failure and copy the debug report or request ID.

## Examples

### Add Cart Failed

Copy the customer menu/item-panel debug report. Search logs by `requestId`, then
look for `action="cart_add_item"` and any safe validation code.

### Submit Cart Timeout

Copy the cart error report. Search for `action="cart_submit"` and compare
`request_started`, `request_completed`, and `slow_request`. If the code is
`DB_TRANSACTION_TIMEOUT`, inspect cart submit stage timings.

### Cashier Accept Failed

Copy the cashier notice debug report. Search for `action="cashier_accept"`.
KDS routing failures include sanitized details such as `reason`, `orderId`,
`branchId`, task counts, ticket counts, and skipped item reasons.

### Task Ready Failed

Copy the KDS notice debug report. Search for `action="preparation_task_ready"`
and inspect the task/KDS sync stages. Post-commit notification/realtime/print
failures should not roll back the task status.

### Migration Not Applied After Deploy

If the API returns `MIGRATION_NOT_APPLIED` or `DATABASE_SCHEMA_MISMATCH`, do not
retry blindly. Run the staging migration deploy command, then verify `/health`
and `/api/v1/system/info` show the expected build SHA and environment.

## Never Include

- auth tokens or customer access tokens
- cookies
- authorization headers
- raw localStorage/sessionStorage dumps
- raw request bodies
- raw AI messages or customer notes
- database URLs
- `.env` values
- stack traces
- raw SQL

