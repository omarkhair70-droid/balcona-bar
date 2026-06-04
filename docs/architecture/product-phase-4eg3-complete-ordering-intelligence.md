# Product Phase 4E.G3: Complete Ordering Intelligence

Product Phase 4E.G3 adds modifier turns, selected-item detail grounding, and
smart cart completion to the Groq AI waiter path.

G2 made the AI search the full backend menu and send compact
`relevantMenuItems`. That was enough for recommendations and simple item
proposals, but it was not enough for real ordering because many cafe items need
required choices such as size, sugar, milk, ice, temperature, add-ons, or
toppings.

## Why G2 Was Not Enough

G2 intentionally did not send modifier groups/options in the default
recommendation context. That protected payload size and avoided 413 failures,
but it meant an exact request like "هات Spanish Latte" could not safely become
a cart proposal if the item required size or sugar.

G3 keeps the G2 compact menu strategy and adds a second deterministic backend
grounding layer for one selected item only.

## Item Detail Grounding

`AiWaiterItemDetailGroundingService` uses the G2 grounded candidates plus recent
message metadata to decide whether modifier context is needed.

Modes:

- `none`
- `exact_item_detail`
- `pending_modifier_resolution`
- `modifier_clarification`
- `complete_for_proposal`

The service includes modifier details only when there is an exact or
high-confidence item request, a pending modifier answer, or a clear
customization/options question. Broad recommendations such as "عايز حاجة
ساقعة" still receive only compact `relevantMenuItems`.

Hard limits:

- one selected item by default;
- capped option list per modifier group;
- truncated item/group/option text;
- no prices in Groq item-detail context.

## Pending Modifier State

G3 uses existing `AiWaiterMessage.metadata` and avoids a database migration.
When the assistant asks a required modifier question, metadata stores compact
state:

```json
{
  "mode": "modifier_question",
  "pendingModifier": {
    "menuItemId": "...",
    "modifierGroupId": "...",
    "allowedOptionIds": ["..."],
    "allowedOptions": [{ "id": "...", "name": "...", "slug": "..." }],
    "selectedModifierOptionIds": ["..."],
    "question": "...",
    "createdAt": "..."
  },
  "pendingItem": {
    "id": "...",
    "name": "..."
  }
}
```

`AiWaiterContextService` passes only safe compact metadata into recent messages.
It does not expose secrets, raw prompts, or large provider blobs.

## Modifier Lexicon

`ai-waiter-modifier-lexicon.ts` is domain-specific. It maps customer phrases to
existing option names/slugs only; it does not invent modifier options.

It covers practical cafe answers in English, Egyptian Arabic, Franco-Arabic,
and mixed language for:

- sizes: small, medium, large, `صغير`, `وسط`, `كبير`;
- sugar: no/low/normal/extra sugar, `من غير سكر`, `مش مسكر`, `عادي`;
- ice: no/light/normal/extra ice, `من غير تلج`, `تلج قليل`;
- milk: regular, oat, almond, lactose-free, `شوفان`, `لوز`;
- temperature: hot, iced, cold, `سخن`, `ساقع`;
- yes/no confirmations where the pending group has matching options.

Low-confidence or ambiguous matches become clarification turns.

## Multi-Turn Order Completion

Supported flows:

- exact item with required modifiers asks the next required question first;
- the pending answer is matched deterministically and remembered;
- multiple required groups carry forward earlier selected option IDs;
- item plus all required modifiers in one message can create a valid proposal;
- optional modifiers do not block proposal creation;
- vague recommendations do not trigger modifier explosions.

The AI still never submits final orders. Proposal application remains a customer
action, and final order submission remains in the cart flow.

## Groq Context And Prompt

Groq still receives compact `relevantMenuItems`. G3 adds
`itemDetailGrounding` only when needed.

Metadata and prompt guidance now include:

- `itemDetailGroundingMode`
- `itemDetailMenuItemId`
- `requiredModifierGroupCount`
- `optionalModifierGroupCount`
- `selectedModifierOptionCount`
- `pendingModifierGroupId`
- `pendingModifier`
- `selectedModifierOptionIds`
- `missingRequiredGroups`

Prompt rules make the ordering contract explicit: open conversation remains
open, broad recommendations stay broad, exact item requests with required
choices ask first, and cart proposals can use only backend-provided IDs.

## Backend Guardrails

`AiWaiterProviderSafetyService` remains the final authority.

G3 strengthens proposal validation:

- modifier option IDs must belong to the selected item;
- required groups must satisfy min selections;
- max selections and single-selection groups are enforced;
- options outside selected item detail are rejected;
- fake menu or modifier IDs are rejected;
- prices, payment, discounts, refunds, allergy guarantees, and final order
  submission remain forbidden.

If Groq proposes an incomplete exact item cart, the provider converts that into
a modifier question when item detail exists.

## Frontend Quick Replies

Customer AI messages now render quick reply chips when assistant metadata has
`pendingModifier.allowedOptions`.

The chips display option names only. Clicking a chip sends the option name as a
normal customer message, so the backend still performs all matching and
validation.

## Admin Readiness Warnings

The existing menu admin readiness surface already warns about required modifier
groups with no active options, invalid min/max, and single-selection groups that
allow multiple selections. G3 relies on those warnings for menu setup handoff
instead of adding a new admin surface.

## Session Debug Visibility

Provider metadata now exposes item-detail mode, selected item, pending modifier
group, selection counts, action rejection, safety flags, and grounding mode in
message/session metadata. Raw Groq prompts and secrets are not persisted.

Future owner/staff UI can present this metadata more richly from the existing
session detail endpoint.

## Tests

G3 adds and extends tests for:

- modifier lexicon matching;
- exact item detail grounding;
- vague recommendation no-modifier behavior;
- pending modifier metadata detection;
- Arabic and English modifier answers;
- same-message item plus modifier completion;
- option-list caps;
- provider modifier question behavior;
- pending answer proposal completion;
- fake or cross-item modifier rejection;
- compact Groq context behavior;
- recent metadata sanitization;
- modifier min/max safety validation.

## Known Limitations

- The deterministic lexicon is intentionally cafe-domain-specific and should
  grow from observed cafe phrases, not a generic dictionary.
- Multi-item proposals with independent required modifiers should remain a
  future flow.
- Staff/owner debug UI still shows metadata through existing detail structures;
  a polished session-debug panel is a later UI phase.
- Modifier option prices are still backend-only and are not sent to Groq.

## Next Recommended Phase

Next phase: improve customer-facing proposal review for richer modifier
summaries, then add staff/owner AI session debugging panels that summarize
grounding, modifier turns, and rejected actions without exposing raw prompts.
