# UI Phase 3 AI Waiter Customer Experience

UI Phase 3 adds the customer-facing AI waiter route inside the existing Customer PWA. It uses the backend AI waiter endpoints that already exist and keeps the AI waiter as a suggestion layer only.

## Route

- `/customer/session/[sessionId]/ai-waiter`

The route uses `CustomerSessionScreen`, so customer access, branch theme loading, session gating, realtime status, and bottom spacing remain consistent with the rest of the PWA.

## Endpoints Used

- `POST /table-sessions/:sessionId/ai-waiter/start`
- `GET /table-sessions/:sessionId/ai-waiter`
- `GET /table-sessions/:sessionId/ai-waiter/messages`
- `POST /table-sessions/:sessionId/ai-waiter/messages`
- `POST /ai-waiter/cart-proposals/:proposalId/apply`
- `POST /ai-waiter/cart-proposals/:proposalId/reject`
- `POST /table-sessions/:sessionId/ai-waiter/escalate`
- `POST /table-sessions/:sessionId/ai-waiter/close`

The frontend types intentionally use broad `Record<string, unknown>` fields for session, message, and proposal records. The UI extracts known fields defensively and avoids treating incomplete backend data as confirmed menu items.

## Tenant Tone And Theme

The UI is reusable for any cafe tenant. Balkona remains a good default visual demo, but customer copy is generic warm cafe concierge copy by default.

The AI waiter route reads:

- `aiWaiterTone`
- `brandVoice`
- `contentBlocks`
- branch/company names when available
- design tokens through the existing customer branch theme loader

If tenant experience data is missing, the page falls back to neutral warm cafe copy.

## Safety Rules

The UI keeps these rules visible:

- AI suggests. You confirm.
- Suggestions are based on branch menu and availability.
- Prices and availability are checked by the system.
- The AI waiter never submits an order.
- The AI waiter never changes prices.
- The AI waiter never bypasses backend cart validation.
- Final order submission remains in the cart flow.

## Cart Proposal Flow

When the backend returns a cart proposal, the customer sees a proposal card with status and proposal items.

The card attempts to match proposal `menuItemId` values to the live branch menu. If a proposal item cannot be matched or item details are missing, the UI says so and does not invent a menu item name.

Applying a proposal calls the backend apply endpoint. That endpoint updates the cart through backend cart validation. Rejecting a proposal calls the backend reject endpoint. Both paths invalidate AI waiter and customer cart state.

## Language Foundation

The UI has a small language foundation:

- English
- Arabic

The selected language is sent to start and message endpoints. The composer and prompt chips support right-to-left layout for Arabic. This is not full i18n yet, but the route is structured so Arabic copy can expand later.

## Human Fallback

The page includes a persistent “Ask a human waiter” fallback. Escalation calls the backend AI waiter escalation endpoint, which notifies staff through the waiter-call flow. The fallback is hospitality-focused and does not leave the customer at an error dead end.

## Intentionally Not Included

This phase does not add:

- external AI provider integration
- staff dashboards
- cashier dashboard
- kitchen or barista queue UI
- payment or POS
- backend behavior changes
- automatic order submission

## Next Phase

The next UI phase is the Cashier Dashboard.
