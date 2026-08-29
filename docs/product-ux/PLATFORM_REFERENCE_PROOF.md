# Balcona Platform — Prototype Brief

Status: LOCKED FOR PROTOTYPE
Date: 2026-08-29
Surface: Balcona Platform
Base: ux/product-ia-overhaul

## Product job

Balcona Platform is the internal SaaS administration console used by the Balcona team to bootstrap and inspect cafe tenants.

It is not:
- tenant Office;
- a restaurant operations surface;
- a CRM;
- a support ticketing suite;
- a public signup flow;
- a place to invent billing-provider behavior.

Primary mental model:

**Operate the Balcona SaaS estate without impersonating cafe operators.**

## Reference stack

Primary visual system:
- Balcona Office primitives: neutral/light canvas, compact data hierarchy, table/list alignment, side detail investigation.

Enterprise hierarchy principle:
- Oracle Simphony-style separation between platform/enterprise context and property operations.

Admin/product principles:
- status-first tenant list;
- explicit plan/subscription state;
- scoped bootstrap flow;
- internal system health;
- audit-aware actions.

## Balcona backend truth

Current Platform capability includes:
- separate PlatformAdminUser / PlatformAdminSession auth;
- company list and summary;
- company detail;
- cafe bootstrap;
- first branch;
- initial owner/staff handoff;
- starter tables/QR;
- plans;
- subscription plan/status updates;
- usage/entitlement signals;
- system info/status;
- platform audit events.

## IA

1. Dashboard
2. Companies
3. New Cafe / Bootstrap
4. Plans & Subscriptions
5. System Status

Company detail is an investigation/workspace state, not a permanent top-level peer.

Future Audit / Support may be added only when product/backend scope justifies a dedicated surface.

## Layout grammar

Desktop:
- compact internal-console rail;
- technical context visible;
- summary strip;
- tenant table as primary object;
- detail drawer / company workspace;
- bootstrap as explicit finite workflow.

Handheld:
- compact horizontal platform nav;
- list-first tenant review;
- no full desktop rail dump;
- detail drawer becomes full-width.

## Visual personality

Use the Office system, but:
- slightly more technical;
- lower warmth;
- denser status metadata;
- bronze only as Balcona accent;
- no restaurant imagery;
- no Guest/Service styling.

## Guardrails

- Never expose secrets.
- Never imply real recurring SaaS billing exists where only internal subscription state exists.
- Never mix cafe customer payments into SaaS plan state.
- Suspended/cancelled/past-due remain visibly distinct.
- Bootstrap actions map to existing platform APIs only.
- Platform users do not operate kitchen/service jobs from this surface.

## Closure gate

Pass only after:
- tenant status can be scanned quickly;
- company detail preserves plan/branch/staff handoff context;
- bootstrap is finite and explicit;
- system status is clear and non-secret;
- Arabic/RTL works;
- desktop + handheld reviewed;
- no page-level overflow;
- automated interaction QA passes;
- screenshots manually reviewed.
