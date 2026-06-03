# AI Waiter Real Engine Spec

This spec defines the product requirements for replacing the current AI waiter
foundation/stub with a real, safe, menu-grounded AI waiter.

The AI waiter is a concierge and ordering assistant. It is not an autonomous
cashier, payment agent, nutrition authority, or kitchen controller.

## Core Rules

- Must understand the current branch menu and current availability.
- Must not invent items, modifiers, availability, prices, discounts, or prep
  promises.
- Must ask required option questions before creating a complete cart proposal.
- Must identify missing modifiers and unresolved conflicts.
- Must support Arabic and English.
- Must detect dietary constraints and allergies, then avoid unsafe certainty.
- Must suggest based on mood, budget, group size, time of day, and preferences.
- Must create structured cart proposals only.
- Must never submit orders by itself.
- Must rely on deterministic backend validation before cart application.
- Must escalate to a human waiter when confidence is low.
- Must log decisions safely without storing unnecessary sensitive content.
- Must expose tenant/branch tone settings later.

## Required Backend Endpoints

Existing endpoints provide a useful base:

- `POST /table-sessions/:sessionId/ai-waiter/start`
- `GET /table-sessions/:sessionId/ai-waiter`
- `GET /table-sessions/:sessionId/ai-waiter/messages`
- `POST /table-sessions/:sessionId/ai-waiter/messages`
- `POST /ai-waiter/cart-proposals/:proposalId/apply`
- `POST /ai-waiter/cart-proposals/:proposalId/reject`
- `POST /table-sessions/:sessionId/ai-waiter/escalate`
- `POST /table-sessions/:sessionId/ai-waiter/close`
- `GET /branches/:branchId/ai-waiter/sessions`
- `GET /ai-waiter/sessions/:aiWaiterSessionId`

Real-engine additions should include:

- `POST /table-sessions/:sessionId/ai-waiter/messages/stream`, if streaming is
  added later.
- `POST /table-sessions/:sessionId/ai-waiter/proposals/validate-draft` for
  deterministic pre-storage proposal checks.
- `GET /branches/:branchId/ai-waiter/context-health` for staff/admin readiness.
- `GET /branches/:branchId/ai-waiter/evaluations` for internal QA later.
- Admin endpoints for branch AI tone, escalation thresholds, and enabled state.

Endpoint additions should remain behind staff/session permissions where they are
staff-facing and behind table-session access where customer-facing.

## Required Data Model Additions

Menu and operating context:

- menu item tags: dietary, allergen, caffeine, spicy, sweet, hot/cold, meal type
- modifier option tags and allergen metadata
- branch daypart or service window metadata
- branch item availability reason and expiry
- estimated prep-time metadata by item or station
- item popularity or recommendation weight

AI waiter configuration:

- branch AI enabled flag
- branch tone profile and language defaults
- escalation threshold
- allowed suggestion categories
- human fallback copy
- model/provider config reference without secrets in database rows

Decision logging:

- model/provider identifier
- prompt/context version
- selected menu item IDs and modifier option IDs
- rejected candidate reason codes
- confidence score
- escalation reason
- validation errors returned by deterministic checks
- redacted user preference summary

Evaluation data:

- scenario fixtures
- expected item IDs and required option questions
- unsafe prompt labels
- Arabic/English expected behavior
- human-reviewed pass/fail outcome

## Prompt And Context Strategy

The model should receive only the context needed to answer the current table
session:

- branch identity and tone settings
- current branch menu categories, items, prices, modifier groups, required
  options, and availability
- known cart contents, if relevant
- recent AI waiter conversation summary
- current time of day and branch service mode
- explicit safety rules
- output schema

Context should be compact and structured. The backend should prepare a canonical
menu context rather than letting the model scrape UI text.

Recommended flow:

1. Load table session, branch, table, and current cart.
2. Load effective menu and availability.
3. Build structured context with item IDs and option IDs.
4. Ask the model for one of:
   - answer only
   - clarifying question
   - structured cart proposal draft
   - human escalation
5. Validate any proposal draft deterministically.
6. Store messages, proposal, confidence, and safe decision metadata.
7. Return customer-safe response and proposal state.

## Safety Rules

Menu and pricing:

- Never mention an item as orderable unless it exists in the current branch menu
  and is available.
- Never create proposal items without backend menu item IDs.
- Never invent or alter prices.
- Always use backend totals after cart validation.

Modifiers:

- Required modifier groups must be satisfied before a proposal can be complete.
- Missing required groups should produce a question, not a guessed selection.
- Modifier option IDs must belong to the selected item's allowed groups.

Dietary and allergies:

- Detect allergy and dietary statements.
- Avoid medical guarantees such as "safe for allergy".
- Prefer cautious language and human escalation for severe allergy claims.
- Use known allergen metadata only; if metadata is missing, say the team should
  confirm.

Ordering authority:

- AI may create a proposal only.
- Customer must apply or reject the proposal.
- Cart validation must run after apply.
- Customer must submit final order from the cart.

Human fallback:

- Escalate when confidence is low.
- Escalate when menu data is missing.
- Escalate on severe allergies.
- Escalate when the customer asks for a human.
- Escalate after repeated misunderstood messages.

## Proposal Schema

The backend should accept and store a proposal draft only after validating this
shape:

```json
{
  "language": "en",
  "title": "Light breakfast for two",
  "message": "I can add these to your cart for review.",
  "confidence": 0.86,
  "items": [
    {
      "menuItemId": "menu-item-id",
      "quantity": 1,
      "modifierOptions": [
        {
          "modifierGroupId": "modifier-group-id",
          "modifierOptionId": "modifier-option-id",
          "quantity": 1
        }
      ],
      "customerNote": "Less sugar"
    }
  ],
  "missingQuestions": [],
  "assumptions": [
    "Customer asked for a light option."
  ],
  "safetyNotes": [
    "No allergy guarantee was made."
  ]
}
```

Rules:

- `menuItemId` is required for each item.
- `quantity` must be positive and within backend limits.
- `modifierOptions` must satisfy all required groups.
- `missingQuestions` must be non-empty when required groups are unresolved.
- `confidence` below threshold should return fallback or clarifying question.
- Customer-visible `message` must not claim final order submission.

## Human Fallback Rules

Show or create a human fallback when:

- model/provider fails
- menu context cannot be loaded
- deterministic validation rejects the proposal draft
- severe allergy or safety concern appears
- user intent is unclear after two clarifying turns
- user asks for a human waiter
- branch AI is disabled
- confidence is below branch threshold

Fallback copy should be calm and hospitality-focused:

- "I will ask a human waiter to help with this."
- "The team can confirm that for you at the table."
- "I do not want to guess on that. A waiter can help."

## Logging And Privacy

Decision logs should help debug without becoming a privacy hazard:

- Store IDs and reason codes where possible.
- Store redacted summaries instead of raw sensitive customer statements when
  possible.
- Avoid storing payment, health, or identity details beyond what the service
  requires.
- Keep prompt/context version so regressions can be traced.
- Expose operational audit to staff only where permissioned.

## Tenant And Branch Tone Settings

Later admin settings should support:

- default language
- tone preset
- banned phrases
- preferred greeting
- escalation style
- branch-specific menu explanation
- AI enabled/disabled state
- confidence threshold
- human fallback message

Tone settings must not override safety rules.

## Evaluation Checklist

Before enabling real AI for a cafe:

- Suggests only real available menu items.
- Refuses or escalates unavailable item requests.
- Preserves backend prices.
- Asks required modifier questions.
- Detects missing modifiers.
- Handles Arabic prompt and Arabic response direction.
- Handles English prompt and English response.
- Handles mixed Arabic/English prompt.
- Handles budget request without inventing discounts.
- Handles group size request with sensible quantities.
- Handles time-of-day request without claiming unavailable dayparts.
- Handles allergy request cautiously and escalates when metadata is insufficient.
- Creates proposal only, never order submit.
- Proposal apply calls backend validation.
- Rejection is stored and does not mutate cart.
- Provider failure shows human fallback.
- Low confidence shows human fallback.
- Logs contain prompt/context version and safe decision metadata.

## Release Gate

The real AI waiter should stay behind a branch feature flag until:

- menu admin and availability management are reliable
- required modifier data is complete
- deterministic proposal validation is tested
- human fallback is tested
- evaluation suite passes for the target branch menu
- staff can disable AI quickly during service
