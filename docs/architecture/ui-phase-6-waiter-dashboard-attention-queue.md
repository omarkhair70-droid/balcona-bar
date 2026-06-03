# UI Phase 6 Waiter Dashboard and Attention Queue

## Scope

UI Phase 6 upgrades the existing `/staff/waiter` preview route into the live
Waiter Dashboard and Attention Queue. The phase is frontend-only and reuses the
Phase 4/5 staff auth store, branch selector, staff page shell, UI primitives,
React Query patterns, and branch realtime hook.

This phase intentionally does not include owner or manager dashboards, SaaS or
menu admin, POS or payment, new customer UI, backend behavior changes, floorplan
drag/drop, or new dependencies.

## Route

- `/staff/waiter` - live waiter and floor operations screen inside the staff
  shell.

## Endpoints Used

Waiter calls:

- `GET /branches/:branchId/waiter-calls`
- `GET /waiter-calls/:waiterCallId`
- `POST /waiter-calls/:waiterCallId/acknowledge`
- `POST /waiter-calls/:waiterCallId/resolve`
- `POST /waiter-calls/:waiterCallId/cancel`

Attention:

- `GET /branches/:branchId/autopilot/attention`
- `POST /branches/:branchId/autopilot/attention/rebuild`
- `GET /table-sessions/:sessionId/autopilot/attention`
- `POST /table-sessions/:sessionId/autopilot/attention/recalculate`
- `POST /table-sessions/:sessionId/autopilot/attention/resolve`
- `POST /table-sessions/:sessionId/autopilot/attention/mute`

Realtime:

- `SSE /realtime/branches/:branchId/stream`
- `GET /realtime/branches/:branchId/events`

## Query Keys

- `staffQueryKeys.staffWaiterCalls(branchId, status, type)`
- `staffQueryKeys.staffWaiterCall(waiterCallId)`
- `staffQueryKeys.staffAttentionQueue(branchId, status, priority)`
- `staffQueryKeys.staffTableSessionAttention(sessionId)`
- `staffQueryKeys.branchRealtime(branchId)`

## Waiter Call Flow

The waiter call queue loads branch calls with status and type filters. Cards
show the request type, status, priority, table and floor label, optional message,
order context, and created time.

Selecting a call opens a detail panel with call, table, session, order, and event
context. Open calls can be acknowledged. Open or acknowledged calls can be
resolved with an optional resolution note. Non-terminal calls can be cancelled
with an optional reason, matching the backend cancel contract.

Successful actions invalidate the branch waiter-call list, selected waiter-call
detail, branch attention queue, selected table attention detail when available,
and branch realtime activity.

## Attention Queue Flow

The attention queue loads branch attention snapshots with status and priority
filters. The UI exposes an Active filter that maps to the backend default by
omitting the `status` query param. Exact filters use `urgent`,
`needs_attention`, `muted`, `resolved`, `normal`, or `all`.

Cards show table and floor context, status, priority, score, top reason,
recommended actions, and last evaluated time. Urgent attention is visually
elevated.

Selecting a table session opens the attention detail panel with session context,
score, reasons, recommended actions, optional metadata, and action controls.
Staff can resolve attention with an optional note, mute it for 15, 30, or 60
minutes, or ask the backend to recalculate the snapshot. The branch card also
supports rebuilding the branch attention queue.

Successful attention actions invalidate the branch attention queue, selected
table-session attention detail, branch waiter calls, and branch realtime
activity.

## Realtime Invalidation

`useStaffBranchRealtime` now invalidates waiter-call queries and attention queue
queries on branch stream messages in addition to cashier, bill, preparation, and
activity queries. It also treats waiter-call and attention event types as
best-effort audible staff signals with the existing throttle.

## Next Phase

The next planned staff operations phase is the Owner / Manager Command Center.
