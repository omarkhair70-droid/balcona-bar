# Product Phase AI-1 - Context-Aware AI Brain + Safe Tool Actions

Product Phase AI-1 deepens the existing Balcona AI waiter from a menu-grounded
assistant into a compact, table-aware cafe companion. The AI can now reason from
customer-safe operational context while deterministic backend services remain
the only actors that create bill requests or waiter calls.

## What Changed

- `AiWaiterContext` now includes `operationalContext` with table, draft cart,
  recent order, preparation summary, bill, waiter-call, table-attention, and
  branch-operation state.
- The context is compact by design:
  - draft cart items are capped at 6;
  - recent orders are capped at 5;
  - active waiter-call inspection is capped at 3;
  - attention reasons and recommended actions are capped at 5 each.
- The AI context excludes secrets, staff identities, raw payment records, full
  bill lines, and full order details.
- Groq receives the operational context alongside the existing relevant menu
  grounding and item-detail grounding.
- The Groq prompt now tells the model:
  - order status must come from operational context only;
  - a draft cart is not a submitted order;
  - bill requests should happen only when billable and not already active;
  - waiter calls should not duplicate active calls;
  - service problems and urgent attention should lean toward staff fallback;
  - cart proposals remain proposals only.
- `AiWaiterToolExecutorService` executes only safe table actions:
  - `read_order_status` reads compact context only;
  - `request_bill` calls `BillRequestsService.requestBill`;
  - `call_waiter` calls `WaiterCallsService.createForTableSession`;
  - cart proposals stay proposal-only and still require customer confirmation.

## Safety Boundaries

The AI still never submits final orders, changes prices, confirms payment,
issues refunds, creates discounts, guarantees allergy safety, invents menu IDs,
or mutates the cart directly.

Tool execution is context-gated:

- bill requests are skipped when there are no billable orders, bill flow is
  disabled, or an active bill request already exists;
- waiter calls are skipped when waiter calls are disabled, an active waiter call
  already exists, or the customer request is not explicit;
- service problems use waiter-call priority `2`; normal waiter requests use
  priority `1`;
- tool failures are persisted as failed tool calls and do not crash the
  customer message flow.

## Customer UI

The customer AI waiter page now includes operational suggested prompts such as
order status, bill, and waiter-call requests. Assistant messages can show a
compact backend-result badge such as `Bill request sent`, `Waiter notified`, or
`Order status checked`.

After action-like AI responses, the web app refreshes customer status, timeline,
bill, and waiter-call queries so the table UI stays in sync with backend state.

## Validation

AI-1 coverage includes:

- context builder tests for operational context, caps, customer-safe fields, and
  existing inventory-filtered menu grounding;
- Groq provider tests for compact operational payload inclusion and existing
  safe action mapping;
- tool executor tests for bill creation, duplicate bill skip, waiter call
  creation, active waiter-call skip, read-only order status, and non-crashing
  tool failures;
- AI waiter service integration test coverage that persists executor-enriched
  provider results and leaves cart proposals on the existing confirmation path.

## Manual Smoke

For local or staging smoke:

1. Open a customer table session.
2. Start AI waiter.
3. Ask for a recommendation and confirm any cart proposal is still proposal-only.
4. Submit an order manually from the cart flow.
5. Ask `Where is my order?` or `فين طلبي؟` and verify the response is grounded
   in the latest order state.
6. Ask for the bill after an accepted/preparing/ready/served/completed order and
   verify the customer service/bill UI shows the request.
7. Ask for a waiter and verify the waiter dashboard receives one call.
8. Repeat bill/waiter requests and verify duplicates are skipped rather than
   creating noisy repeated requests.
9. Ask for unsafe payment, refund, discount, or allergy guarantees and verify the
   AI refuses or routes to human staff.
