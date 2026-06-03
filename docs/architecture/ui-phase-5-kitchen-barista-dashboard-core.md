# UI Phase 5 Kitchen / Barista Dashboard Core

UI Phase 5 adds the second live staff operations screen: the kitchen and barista preparation dashboard. It builds on the Phase 4 staff auth store, branch selection, Staff shell, React Query patterns, and branch realtime hook.

## Routes

- `/staff/kitchen` shows the live preparation task board and task detail panel.
- `/staff` links to the kitchen surface as a live staff area.

No duplicate staff auth, branch, or kitchen routes are added.

## Endpoints Used

Preparation tasks:

- `GET /branches/:branchId/preparation-tasks`
- `GET /orders/:orderId/preparation-tasks`
- `GET /preparation-tasks/:taskId`
- `POST /preparation-tasks/:taskId/start`
- `POST /preparation-tasks/:taskId/ready`
- `POST /preparation-tasks/:taskId/cancel`

Realtime:

- `SSE /realtime/branches/:branchId/stream`
- `GET /realtime/branches/:branchId/events`

Staff auth is reused from Phase 4:

- `POST /staff-auth/login`
- `POST /staff-auth/logout`
- `GET /staff-auth/me`

## Query Keys

Phase 5 extends staff query keys with:

- `staffPreparationTasks(branchId, station?, status?)`
- `staffPreparationTask(taskId)`
- `staffOrderPreparationTasks(orderId)`

The existing `staffBranchRealtime(branchId)` and `staffBranchOrders(branchId)` keys are reused for realtime activity and cashier-adjacent invalidation.

## Task Board Flow

The dashboard reads branch preparation tasks for the selected branch. It defaults to all stations and pending tasks, with station filters for:

- all
- barista
- kitchen
- dessert

It also provides status filters for:

- pending
- preparing
- ready
- cancelled
- all

Task cards show item name, quantity, station, status, table/floor context, order number, notes, modifier options, and creation timing when returned by the backend.

## Start, Ready, And Cancel Flow

Selecting a task loads the task detail endpoint. The detail panel shows the task, order, table, item, modifier, and event context returned by the backend.

Actions call the existing backend endpoints:

- Start is enabled for pending tasks.
- Mark ready is enabled for pending and preparing tasks.
- Cancel is enabled for pending and preparing tasks and can send an optional reason.

Successful actions invalidate branch preparation tasks, selected task detail, branch orders, branch realtime activity, and order preparation tasks when an order id is available.

## Realtime Invalidation

The Phase 4 `useStaffBranchRealtime` hook now also invalidates preparation task queries on branch events. The kitchen dashboard shows a compact realtime status and a recent branch activity panel.

The branch SSE stream remains the only realtime transport. No WebSocket or drag/drop workflow is introduced.

## Intentionally Not Included

This phase does not add:

- waiter dashboard
- owner or manager command center
- SaaS admin or menu admin
- POS/payment
- backend behavior changes
- drag/drop station assignment
- new staff auth storage
- new dependencies

## Next Phase

The next UI phase is the Waiter Dashboard + Attention Queue.
