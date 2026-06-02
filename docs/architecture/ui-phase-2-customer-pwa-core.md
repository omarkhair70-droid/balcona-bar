# UI Phase 2 Customer PWA Core

UI Phase 2 turns the customer side of `apps/web` from a premium shell into the first live table-ordering PWA surface. It stays within customer PWA scope and does not add staff dashboards, payment, POS integrations, external AI, or backend behavior changes.

## Routes

The customer flow lives under `app/(customer)`:

- `/customer` - local customer entry and resume surface.
- `/customer/table/[qrToken]` - starts or resumes a table session from a QR token.
- `/customer/session/[sessionId]` - table home with live cart and status summary.
- `/customer/session/[sessionId]/menu` - branch menu, item detail, modifiers, and add-to-cart.
- `/customer/session/[sessionId]/cart` - draft cart review, validation, clear, update, remove, and submit.
- `/customer/session/[sessionId]/status` - orders, customer status, and timeline.
- `/customer/session/[sessionId]/service` - waiter calls and bill request.

## Session Persistence

Customer session state is stored with Zustand persist in local storage. The stored fields are:

- `sessionId`
- `branchId`
- `tableId`
- `qrToken`
- `customerAccessToken`
- `customerAccessTokenExpiresAt`
- `customerSessionIdentityId`
- `lastLoadedAt`

The store exposes `setFromStartResult` and `clearSession`. Session screens are guarded so a missing, expired, or mismatched local session asks the customer to reopen the table link.

## API Surface

Phase 2 expands the frontend API helper layer for the live customer endpoints:

- branch menu and item detail helpers
- cart read, add, update, remove, clear, validate, and submit helpers
- table-session orders
- customer status and timeline
- waiter calls
- bill request and bill state
- table-session realtime stream invalidation

The types intentionally model the backend response shapes now used by the PWA while keeping broad `Record<string, unknown>` fields for backend objects that are displayed as summaries in this phase.

## Theme And Experience

Customer session screens load the effective branch experience with `getBranchEffectiveExperience(branchId)` and apply compatible string-valued `designTokens` to the existing CSS variable theme system. This keeps the Balkona warm dark default while allowing future branch-level themes to flow into the same reusable primitives.

## Realtime

`useCustomerRealtime` connects to `/realtime/table-sessions/:sessionId/stream` through the existing SSE client. Incoming events invalidate the customer cart, orders, status, timeline, waiter calls, and bill queries. The PWA shows a compact realtime state badge, but it does not add staff queue behavior.

## Out Of Scope

This phase intentionally does not implement:

- kitchen or barista queue UI
- staff dashboards
- payment or POS flows
- AI waiter chat UI
- external AI integrations
- backend behavior changes

## Validation

The intended validation set is:

```bash
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```
