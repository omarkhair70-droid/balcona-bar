# UI Phase 7 Owner / Manager Command Center

## Scope

UI Phase 7 upgrades `/staff/owner` from a preview route into the live Owner /
Manager Command Center. The phase is frontend-only and reuses the existing staff
auth store, branch selector, staff shell, dashboard primitives, React Query API
patterns, broad response helpers, and branch realtime hook.

This phase intentionally does not include SaaS admin, company or tenant admin,
staff role management, POS or payment, external chart libraries, backend
analytics endpoints, or backend behavior changes.

## Route

- `/staff/owner` - live manager command center inside the staff shell.

## Endpoints Used

- `GET /branches/:branchId/cashier/orders?status=all`
- `GET /branches/:branchId/bill-requests?status=all`
- `GET /branches/:branchId/preparation-tasks?station=all&status=all`
- `GET /branches/:branchId/waiter-calls?status=all&type=all`
- `GET /branches/:branchId/autopilot/attention?status=all&priority=all&limit=100`
- `GET /realtime/branches/:branchId/events?channel=all&limit=12`
- `GET /branches/:branchId/experience/effective`
- `GET /branches/:branchId/menu`

## Query Strategy

The owner dashboard aggregates existing operational endpoints client-side with
React Query. Owner-specific query keys are added for clean invalidation:

- `staffOwnerOrders(branchId)`
- `staffOwnerBillRequests(branchId)`
- `staffOwnerPreparationTasks(branchId)`
- `staffOwnerWaiterCalls(branchId)`
- `staffOwnerAttentionQueue(branchId)`
- `staffOwnerExperience(branchId)`
- `staffOwnerMenu(branchId)`

Existing staff query keys remain available for cashier, kitchen, waiter, and
branch realtime activity.

## Client-Side Aggregation

`owner-data.ts` provides defensive helpers for broad backend shapes:

- count records by returned status
- extract order status and visible order value
- extract bill, task, waiter-call, and attention state
- format visible order value without claiming final paid revenue
- derive owner health status from returned operational counts

The visible order value is labeled as tracked or visible order value, not final
revenue.

## Health / Risk Scoring

The dashboard derives one of four manager states:

- Calm
- Busy
- Needs manager attention
- Critical

Inputs include urgent attention, high-priority waiter calls, submitted orders,
ready orders that may need serving, pending or preparing tasks, open waiter
calls, and open bill requests. The score is intentionally transparent and
displayed with reasons and recommended manager actions.

## Realtime Invalidation

`useStaffBranchRealtime` now invalidates owner aggregate query keys when branch
events arrive. This keeps the owner pulse aligned with cashier, preparation,
waiter-call, attention, bill, and activity updates without changing backend
behavior.

## Intentionally Not Included

- SaaS admin or menu editing
- company or tenant admin
- staff roles management UI
- payments or POS
- analytics charts or charting dependencies
- new backend analytics endpoints
- fake revenue, fake trend lines, or placeholder metrics

## Next Phase

The next planned UI phase is Full Demo Hardening + Balkona Demo Mode.
