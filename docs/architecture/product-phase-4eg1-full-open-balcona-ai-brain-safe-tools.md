# Product Phase 4E.G1: Full Open Balcona AI Brain With Safe Commerce Tools

Phase 4E.G1 turns the Groq-backed customer chat from a narrow structured
waiter parser into the first real step toward Balcona's open AI Brain.

The product decision is simple:

- conversation is open;
- platform actions are guarded;
- Balcona personality and commercial intelligence matter;
- the backend remains the source of truth for commerce.

The customer should be able to talk naturally about almost anything safe:
mood, studying, captions, jokes, ideas, comparisons, general questions, and
the Balcona experience. The assistant should feel like a premium cafe
companion, not a menu-only bot.

## AI Chat Is The Platform Core

Balcona is not only a QR menu and not only an order parser. The chat is the
primary product surface: an intelligent customer companion that can be useful
first, then gently commercial when it is natural.

The assistant can:

- answer general safe questions;
- respond to small talk and mood;
- help with studying or work-session choices;
- write captions and light creative copy;
- explain drinks and food;
- recommend menu items and pairings;
- help groups choose;
- suggest commercial next steps without pressure;
- connect the conversation back to Balcona when it fits.

## Balcona Personality

The system prompt frames Groq as Balcona Bar's AI Brain: warm, sharp, helpful,
human-like, premium but not fake, concise enough for mobile, emotionally aware,
commercially smart, and hospitality-first.

Language behavior:

- Arabic input gets warm Egyptian Arabic by default;
- English input gets English;
- Franco Arabic is understood and answered naturally;
- mixed Arabic/English is matched naturally.

The assistant should avoid robotic limits such as "I can only help with the
menu" unless the request is unsafe, impossible, or requires real human/staff
authority.

## Open Conversation

Plain text from Groq is valid. Partial JSON from Groq is valid. JSON with only
`assistantMessage`, `message`, `response`, or `content` is valid.

The provider normalizes all safe conversational output into an internal plan
with:

- `mode: "open_chat"` by default;
- `metadata.provider: "groq"`;
- `metadata.normalizationUsed: true`;
- `AiWaiterMessageKind.text`;
- no stub fallback.

Missing optional fields such as `suggestedActions`, `menuItemCandidates`,
`safety`, `confidence`, `debug`, `proposedCart`, and
`missingRequiredModifier` no longer fail normal chat.

## Hidden Action Block Protocol

When Groq wants to suggest a real platform action, it may append a hidden block
after the visible answer:

```text
BALCONA_ACTION_JSON:
{
  "action": "create_cart_proposal",
  "items": [
    {
      "menuItemId": "item-lemon-mint",
      "quantity": 1,
      "modifierOptionIds": [],
      "notes": "low sugar if available"
    }
  ],
  "reason": "customer_requested_item"
}
```

The backend strips this block before persistence and display. It must never be
shown to the customer. If no block exists, the answer remains open chat.

Allowed actions:

- `none`
- `create_cart_proposal`
- `call_waiter`
- `request_bill`
- `order_status`

Disallowed actions:

- `final_order_submit`
- `submit_order`
- `pay`
- `take_payment`
- `refund`
- `discount`
- `change_price`
- `update_price`
- `delete_order`
- `confirm_payment`
- direct database mutation

## Strict Action Guardrails

Open conversation is flexible. Platform actions are not.

The provider and safety service still reject:

- fake menu item ids;
- fake modifier option ids;
- hidden or unavailable items where backend context can validate them;
- price, subtotal, total, currency amount, discount, payment, or refund fields;
- discount, payment, refund, or free-item promises;
- final order submission;
- direct database mutation;
- allergy guarantees or medical certainty;
- oversized proposed quantities;
- unsafe action names.

If a hidden action is invalid but the visible text is safe, the provider keeps
the visible text and rejects only the action:

- no proposal is created;
- no platform tool is executed;
- `metadata.actionRejected = true`;
- `metadata.safetyFlags` explains why.

If the visible text itself is unsafe, the provider returns a safe fallback.

## Compact Context And 413 Prevention

Earlier live testing hit `413` payload-size errors. G1 keeps request bodies
compact by default:

- `GROQ_MAX_CONTEXT_ITEMS` defaults to `4`;
- modifier groups/options are not sent by default;
- menu context sends only id, slug, name, short description, featured flag, and
  category when available;
- cart context is compact: item count, total quantity, and whether an open cart
  exists;
- only the last two recent messages are sent;
- each recent message is trimmed to 200 characters.

Safe request metadata/log fields include:

- `provider`
- `model`
- `requestBodyChars`
- `menuItemsSent`
- `recentMessagesSent`

The API key, secrets, and full raw prompt are never logged.

## Recommended Local Env

```env
AI_WAITER_PROVIDER=groq
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_CONTEXT_ITEMS=4
GROQ_TIMEOUT_MS=10000
GROQ_MAX_RETRIES=1
GROQ_DRY_RUN=false
```

Keep `GROQ_API_KEY` API-side only. Never expose it through `NEXT_PUBLIC_*` or
frontend code.

## Tests

Backend tests cover:

- plain Arabic and English open chat;
- safe general chat, captions, and small talk;
- partial JSON aliases;
- hidden action block stripping;
- valid cart proposal actions;
- fake item, fake modifier, oversized quantity, and unsafe action rejection;
- visible payment/discount/allergy promise fallback;
- waiter, bill, and order-status actions;
- compact context shape and request metadata;
- timeout and empty-response fallback paths through the registry boundary.

## Known Limitations

- Modifier-option dialogue remains intentionally compact and can be deepened in
  a later phase.
- Groq still sees only compact menu context by default, so it should ask a short
  follow-up question when it needs details not present in context.
- The AI can draft proposals but still cannot submit final orders or change any
  backend state directly.

## Next Recommended Phase

Next phase: build richer menu grounding and modifier-turn intelligence so the
AI Brain can ask for required modifiers only when needed while keeping request
payloads compact.
