# Product Phase 4E.G0: Groq AI Waiter Provider

Product Phase 4E.G0 adds a Groq-backed AI waiter provider behind the existing
backend AI waiter flow. The goal is to improve customer conversation quality
without weakening the Smart Cafe OS rules:

- AI suggests only.
- Backend validates.
- Customer confirms.
- Staff operates.
- The browser never receives provider API keys.
- Groq output never submits final orders, changes prices, or bypasses cart
  validation.

## Why Groq

Groq gives the AI waiter a real hosted LLM provider option with fast chat
completion responses. The integration uses the OpenAI-compatible Groq chat
completions endpoint through direct `fetch`, so no SDK dependency is added.

Groq free limits and model availability are not guaranteed production capacity.
Production use should monitor rate limits and have a paid/contracted capacity
plan before depending on it for live venues.

## Provider Architecture

The AI waiter now uses an `AiWaiterProvider` interface:

- `AiWaiterStubProviderService` remains the deterministic local/demo provider.
- `GroqAiWaiterProviderService` calls Groq and maps structured output back to
  the existing `AiWaiterProviderResult`.
- `AiWaiterProviderRegistry` selects the configured provider and catches Groq
  failures.
- `AiWaiterProviderSafetyService` validates every Groq plan before persistence.

`AiWaiterService` still owns persistence, cart proposals, tool calls, usage
events, and realtime events. Cart proposal application still goes through
`CartService.addItemWithTransaction`.

The Prisma `AiWaiterProviderMode` enum remains unchanged in this phase. Groq is
recorded in message/usage metadata and model name while persisted provider mode
stays compatible with the current schema.

## Environment

API-only environment variables:

```env
AI_WAITER_PROVIDER=groq
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TIMEOUT_MS=10000
GROQ_MAX_RETRIES=1
GROQ_MAX_CONTEXT_ITEMS=8
GROQ_DRY_RUN=false
```

Local/demo defaults to `AI_WAITER_PROVIDER=stub`. If `AI_WAITER_PROVIDER=groq`
is set without `GROQ_API_KEY`, the API logs a clear provider config issue and
returns a safe customer fallback instead of crashing.

Never set `GROQ_API_KEY` as a `NEXT_PUBLIC_*` variable.

## Structured Output Contract

Groq is instructed to return JSON only:

```ts
type GroqAiWaiterPlan = {
  customerMessage: string;
  language: "ar-EG" | "en" | "mixed";
  intent:
    | "recommendation"
    | "specific_item_request"
    | "cart_proposal"
    | "modifier_question"
    | "request_bill"
    | "call_waiter"
    | "order_status"
    | "complaint"
    | "allergy_or_health"
    | "clarification"
    | "out_of_scope";
  confidence: number;
  assistantMessage: string;
  suggestedActions: string[];
  menuItemCandidates: Array<{ menuItemId?: string; slug?: string; name?: string }>;
  proposedCart?: {
    title: string;
    items: Array<{
      menuItemId: string;
      quantity: number;
      modifierOptionIds: string[];
      notes?: string;
    }>;
  } | null;
  missingRequiredModifier?: {
    menuItemId: string;
    modifierGroupId: string;
    question: string;
  } | null;
  safety: {
    requiresHumanFallback: boolean;
    reason?: string;
    allergyOrHealthConcern?: boolean;
    refusedUnsafeRequest?: boolean;
  };
};
```

If the model returns invalid JSON or an invalid/unsafe shape, the registry
falls back safely.

## Prompt And Context

The system prompt tells Groq:

- speak concise warm Egyptian Arabic by default;
- only help with cafe menu, recommendations, draft cart proposals, waiter
  calls, bill requests, and order status;
- never invent menu items or prices;
- never submit final orders;
- never guarantee allergy safety;
- return JSON only.

The context sent to Groq is compact and API-side only:

- branch id/name/slug;
- table session id/status/party size;
- current cart summary;
- recent AI waiter messages;
- available/visible menu item snapshots with ids, names, slugs, descriptions,
  and featured flags;
- modifier groups/options are omitted from the default context until a narrower
  modifier-selection turn needs them;
- policy flags that backend prices and final order submission are forbidden.

Secrets and unnecessary customer PII are not sent.

## Safety Loop

`AiWaiterProviderSafetyService` validates Groq output before it becomes an
`AiWaiterProviderResult`:

- unknown menu item ids are rejected;
- unknown modifier option ids are rejected;
- missing required modifiers block cart proposal creation;
- oversized quantities are rejected with a safe fallback;
- price/discount/payment/refund fields or promises are rejected;
- final-order-submit actions are rejected;
- allergy or health concerns force human fallback with no guarantee;
- out-of-scope prompts are redirected to cafe help.

If a proposed cart is valid, the backend persists a draft proposal only. The
customer still has to apply it, and applying still uses backend cart validation.

## Error Handling

Groq failures never break customer chat:

- missing key;
- 401 invalid key;
- 429 rate limit;
- 5xx outage;
- timeout;
- invalid JSON;
- schema/safety failure.

Customer fallback:

```text
حصلت مشكلة بسيطة في الويتر الذكي. أقدر أساعدك بالمنيو الأساسي أو أنادي ويتر.
```

Logs include provider, error type, status, retry-after, request duration, and
model where safe. API keys and raw secrets are never logged.

## Metadata

Assistant messages and usage events can include:

- `provider`;
- `model`;
- `intent`;
- `confidence`;
- `safetyFlags`;
- `fallbackUsed`;
- `latencyMs`;
- prompt/completion/total tokens when Groq returns usage;
- safe rate-limit header snippets.

Raw chain-of-thought and raw Groq responses are not exposed to customers.

## Manual Smoke Test

1. Set `GROQ_API_KEY` in `apps/api/.env`.
2. Set `AI_WAITER_PROVIDER=groq`.
3. Start API and web.
4. Start a customer QR session, for example `/customer/table/balcona-main-t01`.
5. Open the AI waiter.
6. Send `عايز حاجة ساقعة ومش مسكرة`.
   Expected: Egyptian Arabic response, real branch-menu recommendations only,
   no fake price.
7. Send `هات مانجو`.
   Expected: if Mango exists and is available, a draft cart proposal is created;
   it is not submitted as a final order.
8. Send `عندي حساسية لبن`.
   Expected: no allergy guarantee; human fallback offered.
9. Send `ناديلي ويتر`.
   Expected: escalation action available.
10. Disable internet or use an invalid key.
    Expected: safe fallback to stub/no crash.

## Validation Commands

```bash
pnpm --filter @balcona-bar/api prisma:generate
pnpm --filter @balcona-bar/api build
pnpm --filter @balcona-bar/api test
pnpm --filter @balcona-bar/web lint
pnpm --filter @balcona-bar/web typecheck
pnpm web:build
```

## Known Limitations

- This does not add voice, images, payment/POS, AWS changes, or frontend Groq
  calls.
- Groq output quality depends on the selected model and available rate limits.
- The provider uses JSON mode/best-effort structured output rather than adding a
  new SDK dependency.
- The database enum still stores provider mode as the existing compatible value;
  Groq-specific details live in metadata.

## Next Recommended Phase

Next phase: deepen AI waiter menu intelligence, modifier dialogue, and
evaluation coverage now that a safe provider loop exists.
