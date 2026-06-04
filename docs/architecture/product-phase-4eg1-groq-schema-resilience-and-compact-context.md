# Product Phase 4E.G1: Groq Schema Resilience And Compact Context

Phase 4E.G1 hardens the Groq AI waiter provider after successful live provider
calls exposed two practical deployment issues:

- some safe Groq responses omitted optional structured-output fields and were
  rejected as `invalid_schema`;
- large menu context payloads could produce oversized requests before Groq had a
  chance to answer.

## Why `invalid_schema` Happened

The G0 provider parsed Groq JSON and then required the model output to already
match the full internal `GroqAiWaiterPlan` shape. That was too strict for hosted
LLM output. A response with a useful `assistantMessage` and `intent`, but no
`suggestedActions`, `menuItemCandidates`, or `safety`, was safe enough to route
through backend validation but still failed before validation ran.

G1 moves that strictness to the right boundary:

- malformed JSON still retries once with a valid-JSON-only instruction;
- non-object JSON still fails as invalid schema;
- safe partial JSON is normalized into the internal plan shape;
- safety validation still runs after normalization.

## Normalization

`GroqAiWaiterProviderService.normalizeGroqPlan(raw, input)` creates a complete
`GroqAiWaiterPlan` from partial Groq JSON:

- `customerMessage` defaults to the customer input;
- `language` defaults from the customer input, falling back to `ar-EG`;
- `intent` defaults to `clarification`;
- `confidence` defaults to `0.5`;
- `assistantMessage` defaults to a safe cafe-help message;
- `suggestedActions` and `menuItemCandidates` default to empty arrays;
- `proposedCart` and `missingRequiredModifier` default to `null`;
- `safety` defaults to a non-escalated safe object;
- `debug` marks provider normalization for internal inspection.

The normalized plan is then passed into `AiWaiterProviderSafetyService`.

## Safety Still Validates

Normalization does not make Groq trusted. The safety service remains the hard
boundary and still blocks:

- fake menu item ids;
- fake modifier option ids;
- price, subtotal, total, discount, or currency amount fields;
- final order submission actions;
- discount, payment, refund, or free-item promises;
- allergy guarantees;
- oversized proposed quantities;
- unsafe actions.

Groq can suggest. The backend validates. The customer confirms. Final order
submission remains outside the AI waiter provider.

## Compact Context

Earlier testing also hit `413` payload-size failures. G1 keeps the request body
small by default:

- `GROQ_MAX_CONTEXT_ITEMS` defaults to `8`;
- menu context sends only `id`, `slug`, `name`, `description`, and
  `isFeatured`;
- modifier groups and options are not sent in the default recommendation
  context;
- the provider records approximate request body size in safe metadata/log
  fields without logging API keys.

Modifier groups/options can be added later only for narrower modifier-selection
turns where the extra context is needed.

## Recommended Local Env

```env
AI_WAITER_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_CONTEXT_ITEMS=8
```

Keep `GROQ_API_KEY` API-side only. Never expose it through `NEXT_PUBLIC_*` or
frontend code.

## Validation

```bash
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```
