# UI Phase 4 Cashier Dashboard Core

UI Phase 4 adds the first real staff operations screen: the cashier dashboard. It upgrades the existing staff preview routes without adding backend behavior.

## Routes

- `/staff` shows staff login state, branch selection, and staff surface links.
- `/staff/login` signs in through the existing staff auth endpoint.
- `/staff/cashier` shows cashier orders, order detail, bill requests, metrics, realtime state, and activity.

Kitchen, waiter, and owner routes remain preview surfaces in this phase.

## Staff Auth Store

The frontend adds a small persisted staff session store with:

- `accessToken`
- `expiresAt`
- `staffUser`
- `staffSession`
- `effectiveAccess`
- `defaultBranch`
- `selectedBranchId`
- `lastLoadedAt`

The store saves the `staffLogin` response, restores context through `staffMe(token)`, clears expired or unauthorized sessions, and selects the default branch from `defaultBranch`, the session branch, or the first branch in `effectiveAccess.branches`.

## Branch Selection

Branch selection uses `effectiveAccess.branches` from the backend. The selected branch drives cashier order queries, bill request queries, and branch realtime invalidation.

No permissions matrix UI is included. The dashboard trusts backend access control and uses the returned access only to pick a branch context.

## Endpoints Used

Staff auth:

- `POST /staff-auth/login`
- `POST /staff-auth/logout`
- `GET /staff-auth/me`

Cashier orders:

- `GET /branches/:branchId/cashier/orders`
- `GET /orders/:orderId`
- `POST /orders/:orderId/cashier/accept`
- `POST /orders/:orderId/cashier/reject`

Bill requests:

- `GET /branches/:branchId/bill-requests`
- `GET /bill-requests/:billRequestId`
- `POST /bill-requests/:billRequestId/acknowledge`
- `POST /bill-requests/:billRequestId/present`
- `POST /bill-requests/:billRequestId/close`
- `POST /bill-requests/:billRequestId/cancel`

Realtime:

- `SSE /realtime/branches/:branchId/stream`
- `GET /realtime/branches/:branchId/events`

Complex operational response bodies are represented with broad `Record<string, unknown>` types and defensive extraction helpers.

## Order Queue Flow

The cashier dashboard loads branch orders with a status filter. The default lane is `submitted`, with quick filters for accepted, preparing, ready, and all orders.

Each order card shows order number, table context, submitted time, status, item count, quantity, subtotal, source, and customer note when returned by the backend.

## Accept And Reject Flow

Selecting an order loads the detail endpoint. The detail panel shows returned items, modifiers, notes, totals, and order events.

Accept calls `POST /orders/:orderId/cashier/accept` with the optional `staffUserId`. Reject calls `POST /orders/:orderId/cashier/reject` with optional `reason` and `staffUserId`.

On success or failure, the UI shows visible feedback. On success it invalidates branch orders, order detail, and branch realtime activity.

## Bill Request Flow

The bill panel loads active or filtered branch bill requests. Cards show table context, status, subtotal, order count, and requested time.

Open requests can be acknowledged. Open or acknowledged requests can be presented. Presented requests can be closed. These actions call the existing bill request endpoints and invalidate branch bill requests, bill request detail, and branch realtime activity.

This phase does not implement payment or POS handling.

## Realtime Strategy

`useStaffBranchRealtime` connects to the branch SSE stream with the staff bearer token. Incoming branch events invalidate cashier orders, bill requests, and recent branch events.

The UI shows a compact realtime state indicator and plays a best-effort subtle notification sound for new order and bill request signals. Browser autoplay blocks are ignored safely.

## Intentionally Not Included

This phase does not add:

- kitchen or barista dashboard UI
- waiter dashboard UI
- owner or manager command center
- production payment or POS
- new backend features
- new dependencies
- automatic cashier decisions
- AI behavior changes

## Next Phase

The next UI phase is the Kitchen / Barista Dashboard.
