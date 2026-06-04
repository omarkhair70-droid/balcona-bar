# Product Phase 4E.G2: Deep Menu Grounding And Smart Tool Selection

Product Phase 4E.G2 replaces the Groq provider's first-N menu slice with a
backend menu-grounding layer. The API now searches the full branch menu
internally, chooses a compact set of relevant candidates, and sends only those
candidates to Groq.

The product goal is better real-cafe behavior without increasing payload size
or weakening commerce guardrails.

## Why First-N Failed

G0/G1 kept Groq payloads compact by sending only the first few menu items. That
prevented 413 payload-size failures, but it created a relevance problem:

- a real menu item could exist outside the first slice;
- a customer could ask for "mango", "lemon mint", "waffle", or "Spanish latte"
  and Groq would not see the item;
- Groq then had to either ask unnecessary clarification or risk inventing an
  item id.

G2 keeps the compact-payload decision, but moves menu search to deterministic
backend code before Groq is called.

## Menu Grounding Service

`AiWaiterContextService` loads the backend menu snapshot up to
`AI_WAITER_MENU_SNAPSHOT_LIMIT`, which defaults to 200 and validates up to
1000. `AiWaiterMenuGroundingService` ranks menu candidates from that full
snapshot before any compact Groq payload is built. It returns
`MenuGroundingResult`:

- `candidates`
- `totalMenuItemsAvailable`
- `groundingMode`
- `topMatchReasons`
- `exactMatchFound`
- `omittedMenuItemCount`

Candidate scoring uses:

- exact item name and slug matches;
- token overlap across name, slug, description, and category;
- simple typo distance for customer-facing item terms;
- cafe lexicon intents such as cold, caffeine, dessert, low sugar, budget, and
  premium;
- a small featured boost only after a real phrase match;
- a small recent-message hint for follow-up turns;
- fallback featured/category-diverse candidates when no phrase matches.

The default Groq candidate cap is 12 and the hard cap is 20. If a query matches
only a few items, the result is filled with safe fallback candidates up to the
configured cap so Groq still has useful menu context without receiving the full
menu snapshot.

## Cafe Lexicon And Aliases

`ai-waiter-cafe-lexicon.ts` is intentionally domain-specific. It is not a full
Arabic dictionary.

It covers realistic cafe ordering phrases across:

- Egyptian Arabic: `عايز حاجة ساقعة`, `ناديلي حد`, `عايز حاجة تفوقني`;
- Franco-Arabic: `3ayez haga sa2a3a`, `2ahwa`, `so5n`;
- English: `cold`, `iced`, `coffee`, `dessert`, `wake me up`;
- Balcona menu aliases: `lemon mint`, `lemoon mint`, `mango`, `spanish`,
  `matcha`, `waffle`, `pancake`, `milkshake`, `smoothie`;
- preference/safety phrases: `مش مسكر`, `حساسية`, `low sugar`, `allergy`.

The lexicon maps phrase families to intents and search signals rather than
adding broad unrelated vocabulary.

## Groq Context Changes

The provider no longer sends a `menuItems` first slice. It sends:

- `relevantMenuItems`
- `grounding`
- compact branch/table/cart context
- the last two trimmed recent messages
- `menuPolicy`

Each relevant menu item includes only:

- `id`
- `slug`
- `name`
- short `description`
- `isFeatured`
- `category`

Modifier groups/options are still excluded by default. They should be added in
a later modifier-focused turn only when needed.

Safe request metadata/logging now includes approximate request size and
grounding fields:

- `requestBodyChars`
- `menuItemsSent`
- `recentMessagesSent`
- `totalMenuItemsAvailable`
- `groundingMode`
- `omittedMenuItemCount`
- `topMatchReasons`
- `exactMatchFound`

API keys, secrets, and raw provider credentials are never logged.

## Smart Tool Selection Behavior

The system prompt now tells Groq:

- backend searched the full menu already;
- confirmed menu matches must come from `relevantMenuItems`;
- cart proposal item ids must come from `relevantMenuItems`;
- exact high-confidence item requests may create a cart proposal;
- vague requests such as "something cold" or "something sweet" should usually
  recommend and ask one useful follow-up, not force a cart proposal;
- waiter, bill, and order-status requests should use their safe platform
  actions without menu items;
- allergy/health concerns must not guarantee safety and should offer human
  fallback.

Groq can still answer in plain text. Action blocks remain optional.

## Safety Guardrails

G2 keeps the existing provider normalization and
`AiWaiterProviderSafetyService` validation.

The provider still rejects:

- fake menu item ids;
- fake modifier option ids;
- price, subtotal, total, currency, discount, payment, or refund fields;
- final order submit;
- payment/refund/discount promises;
- free-item promises;
- allergy guarantees;
- oversized quantities;
- unsafe action names.

G2 adds a stricter grounding rule before mapping any cart proposal:

If Groq proposes a menu item id that is not in the backend-selected
`relevantMenuItems`, the action is rejected with
`ungrounded_menu_item_rejected`. Safe visible text can still be kept as open
chat, but no cart proposal is created.

This means an item must both exist in the backend menu and be grounded for the
current request before it can be proposed.

## Recommended Local Env

```env
AI_WAITER_PROVIDER=groq
AI_WAITER_MENU_SNAPSHOT_LIMIT=200
GROQ_MODEL=openai/gpt-oss-20b
GROQ_MAX_CONTEXT_ITEMS=12
GROQ_TIMEOUT_MS=10000
GROQ_MAX_RETRIES=1
GROQ_DRY_RUN=false
```

Keep `GROQ_API_KEY` API-side only. Do not expose it through frontend code or
`NEXT_PUBLIC_*`.

## Tests

G2 adds and extends backend tests for:

- Egyptian Arabic, Franco-Arabic, and English cafe phrase lexicon behavior;
- Balcona aliases and typo handling such as `lemoon mint`;
- exact item requests ranking first;
- Arabic aliases such as `ليمون نعناع`;
- broad cold, caffeine, and dessert requests;
- budget terms that do not break cold search;
- fallback featured/category-diverse candidates;
- provider context using `relevantMenuItems`;
- full-menu grounding for items outside the first menu rows;
- compact request bodies with `GROQ_MAX_CONTEXT_ITEMS=8`;
- modifier groups/options excluded by default;
- fake and ungrounded item proposal rejection;
- existing invalid JSON retry and safety validation paths.

## Known Limitations

- Modifier group/options context is still intentionally deferred.
- The lexicon is cafe-domain-specific and should expand through observed cafe
  phrases, not generic dictionary imports.
- Ranking is deterministic and lightweight; semantic embeddings can be added
  later if needed.
- The AI still cannot submit final orders, change prices, or bypass cart
  validation.

## Next Recommended Phase

Next phase: add modifier-turn grounding so the backend can provide exact
required modifier groups/options only after a specific item is chosen, while
keeping the first recommendation turn compact.
