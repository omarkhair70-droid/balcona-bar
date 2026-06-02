# Phase 18 AI Waiter Backend Foundation

Phase 18 adds the durable backend foundation for an AI waiter chat experience. The AI waiter helps a customer choose from the branch menu, stores chat history, creates cart proposals, tracks tool calls and rough usage, and can escalate to a human waiter.

## Product Boundary

The AI waiter creates a draft/proposal only. It does not set prices, change prices, submit orders, accept or reject orders, mark payment complete, or bypass menu/cart/order validation. The backend remains the source of truth for menu item IDs, modifier option IDs, availability, visibility, pricing, cart validation, order submission, cashier flow, and bill flow.

## Provider-Agnostic Architecture

`AiWaiterModule` owns the controller, orchestration service, context service, and deterministic stub provider. The provider contract returns assistant copy, suggested actions, optional structured cart proposal items, and tool-call metadata. This keeps future external LLM integration behind the provider layer without coupling this phase to a provider SDK or credentials.

This phase uses `AiWaiterStubProviderService` only. It can greet customers, suggest featured/available items, ask for missing required modifiers, create a proposal when an exact active item can be matched safely, and suggest escalation when unsure.

## Durable Records

Prisma stores:

- `AiWaiterSession` per table session, with provider mode, counters, summary/context metadata, and lifecycle state.
- `AiWaiterMessage` for customer, assistant, system, and tool-visible messages.
- `AiWaiterCartProposal` for proposed items before they touch the real draft cart.
- `AiWaiterToolCall` for action/audit records.
- `AiWaiterUsageEvent` for rough token/cost counters, even in stub mode.

Only one active AI waiter session is created per active table session by service logic.

## Context Window

The context builder compacts inputs to the current table session, effective branch/company experience profile tone, current draft cart summary, a compact active/visible/available branch menu snapshot, and the last 12 messages. The full chat history remains durable, but future providers should receive only the summary plus a bounded recent window.

Redis short-term context caching can be added later, but this phase uses PostgreSQL as the durable source of truth and does not add Redis/BullMQ orchestration.

## Menu-Aware Recommendations

Recommendations only use active menu items whose categories are active and whose branch override is visible and available. The stub does not invent items and does not author prices. If required modifier groups are missing, it asks a clarifying question instead of creating a cart proposal.

## Cart Proposal Apply

Applying a proposal calls the existing cart add-item logic inside a transaction. That means item ownership, branch visibility/availability, active modifiers, required selections, currency, and backend price snapshots are revalidated before anything becomes part of the customer draft cart. If validation fails, the proposal remains proposed and records the last apply error in `validationSnapshot`.

## Human Fallback

Escalation marks the active AI waiter session as escalated and creates a waiter call through the existing waiter-call flow. Existing waiter call notifications and realtime events remain responsible for staff notification behavior.

## Realtime

Phase 18 extends `RealtimeEventType` with AI waiter lifecycle, message, proposal, apply, escalation, and close events. Events are stored through `RealtimeEventsService` with branch and table-session scope and the existing SSE infrastructure remains unchanged.

## Limitations

- No UI, PWA, or Flutter client.
- No external LLM integration or provider credentials.
- No production auth/login enforcement.
- No payment/POS integration.
- No Redis/BullMQ job layer.
- No order finalization by AI.
