# Staging Smoke Runner

SMOKE-1 adds a staging smoke runner for the Balcona Bar platform. It is a real operational smoke, not a unit test. It checks the public web surface, API health, customer table ordering, AI waiter reliability, cashier accept, KDS preparation tasks, waiter calls, bill requests, owner analytics, and platform navigation where credentials are available.

The runner is dependency-free Node.js and uses API calls plus page fetch checks. Browser screenshots, traces, and videos are reserved for a future Playwright/browser mode and should only be written on failure.

## Setup

Copy the example file and fill staging-only values:

```powershell
Copy-Item .env.smoke.example .env.smoke.local
```

Required base URLs:

```text
SMOKE_WEB_BASE_URL=https://balcona-bar-staging-web.vercel.app
SMOKE_API_BASE_URL=https://balcona-bar-staging-api.example.com/api/v1
```

Full mode also needs a staging demo table:

```text
SMOKE_DEMO_BRANCH_SLUG=balkona
SMOKE_DEMO_TABLE_QR_TOKEN=balcona-main-t01
SMOKE_DEMO_TABLE_2_QR_TOKEN=
SMOKE_MENU_ITEM_NAME=Spanish Latte
```

Protected role checks need staging-only credentials:

```text
SMOKE_PLATFORM_EMAIL=
SMOKE_PLATFORM_PASSWORD=
SMOKE_OWNER_EMAIL=
SMOKE_OWNER_PASSWORD=
SMOKE_CASHIER_EMAIL=
SMOKE_CASHIER_PASSWORD=
SMOKE_KITCHEN_EMAIL=
SMOKE_KITCHEN_PASSWORD=
SMOKE_BARISTA_EMAIL=
SMOKE_BARISTA_PASSWORD=
SMOKE_WAITER_EMAIL=
SMOKE_WAITER_PASSWORD=
```

Optional controls:

```text
SMOKE_RUN_ID=
SMOKE_TIMEOUT_MS=30000
SMOKE_RETRY_TRANSIENT=true
SMOKE_ENVIRONMENT=staging
SMOKE_BRANCH_ID=
SMOKE_COMPANY_ID=
```

Never commit `.env.smoke.local`, tokens, cookies, storage state, screenshots containing private data, Railway keys, Vercel keys, Neon URLs, or production secrets.

## Commands

Install dependencies first:

```powershell
pnpm install
```

Run full staging smoke:

```powershell
pnpm smoke:staging
pnpm smoke:staging:full
```

Run API-first full smoke without web page checks:

```powershell
pnpm smoke:staging:api
```

Run safe web/page checks only:

```powershell
pnpm smoke:staging:web
```

Run smoke helper tests:

```powershell
pnpm smoke:test
```

## Modes

`safe` mode performs low-impact checks: API health, system info, web pages, and protected dashboard loads when credentials are present.

`full` mode mutates the staging demo table: opens a table session, loads menu, applies AI proposal when available, adds cart, submits order, cashier accepts, KDS starts and readies the task, waiter handles a call, order is served, customer requests bill, and staff presents the bill when available.

Skipped steps are never marked as passed. If credentials are missing, the relevant role checks are reported as `skipped` with the missing env var names.

## Timing And Thresholds

Every step records:

- `stepName`
- `role`
- page or API endpoint
- method
- `startedAt`
- `finishedAt`
- `durationMs`
- status
- retry count and retry attempts
- requestId, flowId, and clientTraceId when available
- safe entity IDs
- safe error code/message when failed

Flow totals are reported:

- `totalRunDurationMs`
- `customerFlowDurationMs`
- `cashierFlowDurationMs`
- `kitchenFlowDurationMs`
- `waiterServiceFlowDurationMs`
- `billFlowDurationMs`
- `ownerFlowDurationMs`
- `platformFlowDurationMs`

Warnings are emitted when:

- table session open is over 3000ms
- add cart is over 2000ms
- submit cart is over 5000ms
- cashier accept is over 5000ms
- task start is over 3000ms
- task ready is over 3000ms
- page load is over 5000ms
- any API request is over 2000ms
- AI session start is over 3000ms
- AI message response is over 10000ms
- AI proposal apply/tool execution is over 3000ms

Slow steps do not fail the smoke by themselves. They produce `warning` and make the final result `PASS_WITH_WARNINGS`.

## Retry Visibility

Retries never hide instability. If a retry succeeds, the step status is `passed_with_retry`, not `passed`.

Each retry attempt includes:

- attempt number
- started/finished timestamps
- duration
- requestId if available
- safe error code/message

Example:

```text
Submit cart: passed_with_retry
attempt 1: timeout after 15000ms
attempt 2: success in 920ms
```

## Coverage Matrix

The markdown and JSON reports include a coverage matrix for:

- Customer: table open, menu load, item detail, add cart, cart load, cart validate, submit cart, order status, AI waiter, AI proposal apply, call waiter, request bill.
- Staff: cashier login, cashier order list, cashier accept, kitchen login, kitchen ticket list, preparation task start, preparation task ready, waiter login, waiter call acknowledge/resolve.
- Owner: owner login, owner dashboard load, branch/menu/orders summary load.
- Platform: platform login, company list load, branch/company navigation.
- System: API health, web health/build metadata, migration/schema status, request correlation, debug report availability.
- AI Waiter: session start, English message, Arabic message, menu-aware suggestion, proposal created/applied, cart updated, call waiter, request bill, order status, safety fallback, unsupported action refusal, provider fallback if tested.

Each row shows covered yes/no/skipped, status, duration, requestId, and notes.

## Artifacts

The runner writes:

```text
smoke-results/latest.json
smoke-results/latest.md
smoke-results/latest-summary.txt
```

`smoke-results/` is ignored by Git. The JSON report is machine-readable. The markdown report is human-readable. The summary text is short enough to paste into ChatGPT, Codex, or a GitHub PR comment.

If browser mode is added later, screenshots, traces, and videos should only be captured on failure and should never include secrets, tokens, cookies, or committed storage state.

## Failure Bundle

When any step fails, the runner prints a ready-to-copy bundle:

```text
SMOKE FAILURE
Run ID:
Environment:
Step:
Role:
Page/Endpoint:
Status:
Duration:
Request ID:
Flow ID:
Client Trace ID:
Entity IDs:
Error Code:
Error Message:
Retry Count:
Last 5 Breadcrumbs:
Suggested Log Search:
```

Use `requestId`, `flowId`, or `clientTraceId` to search Railway/API logs. OBS-1 adds matching backend request correlation fields.

## AI Waiter Smoke

The AI smoke checks the AI waiter as an operational subsystem, not as a quality evaluator. It verifies:

- session start/load
- English message
- Arabic/Egyptian Arabic message
- menu-aware suggestion
- cart proposal creation when available
- proposal apply and cart update when available
- AI does not submit final orders by itself
- call waiter tool path
- bill request tool path
- order status tool after accept
- allergy/health safety fallback
- unsupported price-change refusal
- provider fallback marked skipped if no failure toggle exists

The smoke does not assert exact AI wording, does not score LLM quality, and does not print provider keys, raw private prompts, tokens, cookies, or customer secrets.

## Data And Cleanup

The runner uses the configured staging demo table and includes the run ID in guest labels and notes. It does not add broad reset endpoints and does not delete staging data.

Recommended cleanup strategy:

- Use a dedicated staging demo branch/table.
- Run smoke during quiet windows when possible.
- Filter smoke orders by run ID in notes/events when manual cleanup is needed.
- Add a protected staging-only reset endpoint only if it can be restricted to smoke-prefixed data and guarded by `SMOKE_RESET_TOKEN`.

## Missing Credentials

Missing base URLs stop the runner immediately.

Missing role credentials mark that role's protected checks as skipped with a clear note. Skipped is not passed. A full platform confidence run should provide all role credentials.

## Migrations Before Smoke

Before running a deploy smoke, verify migrations:

```powershell
pnpm --filter @balcona-bar/api prisma:migrate:deploy
pnpm --filter @balcona-bar/api prisma:generate
```

The runner checks `/system/info` for safe migration/schema metadata when available. Prisma schema mismatch errors should appear as safe OBS-1 operational codes such as `DATABASE_SCHEMA_MISMATCH` or `MIGRATION_NOT_APPLIED`.

## Final Result

The final score prints:

- Total steps
- Passed
- Passed with retry
- Warnings
- Skipped
- Failed
- Slow requests count
- Total duration
- Overall result

Rules:

- `FAIL` if any critical step fails.
- `PASS_WITH_WARNINGS` if there are no critical failures but there are retries, slow requests, warnings, or skipped optional steps.
- `PASS` only when all critical flows pass on the first attempt and there are no serious warnings.
