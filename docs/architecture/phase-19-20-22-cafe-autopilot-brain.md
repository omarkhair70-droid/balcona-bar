# Phases 19, 20, and 22 Cafe Autopilot Brain

This phase adds a backend-only operating layer for branch settings, feature flags, table attention, analytics, and audit history. PostgreSQL remains the durable source of truth. Redis is used only as a best-effort live-state cache for active attention state and branch queues.

## Product Boundary

This phase does not add UI, PWA, Flutter, payment/POS, external AI providers, production auth/login, kitchen/barista queue work, BullMQ, or later phase behavior. Existing order, bill, waiter call, preparation, and AI waiter flows remain responsible for their own lifecycle transitions.

## Branch Settings and Feature Flags

`BranchOperatingSettings` stores branch operating mode, service mode, enabled capability switches, and JSON configuration for opening hours, service behavior, attention behavior, and metadata. Missing settings are created with safe assisted defaults when read.

`BranchFeatureFlag` stores per-branch feature keys with an enabled bit and optional JSON config. The read endpoint returns all known feature keys, including defaults for flags not yet stored.

Settings and feature-flag updates write audit logs and emit `branch_settings_updated` realtime events through the existing SSE-backed realtime event service.

## Table Attention Engine

`TableAttentionSnapshot` stores the latest attention status for a table session. `TableAttentionEvent` stores reason events when a snapshot changes. Scoring is deterministic and reads existing state:

- submitted orders waiting for cashier acceptance.
- delayed preparation tasks.
- ready orders not yet served.
- active waiter calls.
- active bill requests.
- escalated AI waiter sessions.
- idle active table sessions.

Scores map to `low`, `medium`, `high`, and `urgent` priorities. Snapshots can be recalculated, rebuilt for a branch, resolved, or muted. Existing lifecycle services call the recalculation hook best-effort after relevant state changes; a recalculation failure does not roll back the original lifecycle action.

Redis keys used by the attention layer:

- `table_session:{sessionId}:attention_state`
- `table_session:{sessionId}:attention_score`
- `branch:{branchId}:attention_queue`
- `branch:{branchId}:active_sessions`

Redis writes are time-boxed and swallowed on failure so Redis outages do not break core API behavior.

## Analytics Foundation

Analytics endpoints are read-only and compute snapshots from persisted records. Branch overview includes order volume, subtotal, waiter call counts, bill request counts, AI waiter counts, cart proposal counts, attention counts, and lifecycle timing averages. Menu analytics aggregate ordered items and modifiers. Staff action analytics summarize audit log activity.

The company overview aggregates branches under a company and emits `analytics_snapshot_generated` as a stored realtime event when generated.

## Audit Foundation

`AuditLog` stores actor type, optional staff actor, optional table session, target, action, before/after JSON, metadata, request ID, and timestamp. The audit service is intentionally best-effort for write callers: audit failures do not break operational flows.

Audit read endpoints are available at branch and company scope with filters for action, actor type, target type, table session, and date range.

## Realtime

This phase extends `RealtimeEventType` with:

- `table_attention_updated`
- `table_attention_resolved`
- `branch_attention_queue_updated`
- `branch_settings_updated`
- `analytics_snapshot_generated`
- `audit_log_created`

SSE remains the realtime transport. No WebSocket or queue replacement is introduced.

## Permissions

The Phase 11 permission catalog now includes:

- `settings.read`
- `settings.manage`
- `feature_flags.read`
- `feature_flags.manage`
- `autopilot.read`
- `autopilot.manage`
- `analytics.read`
- `audit.read`

Route enforcement remains aligned with the existing staff access foundation and production auth/login remains deferred.

