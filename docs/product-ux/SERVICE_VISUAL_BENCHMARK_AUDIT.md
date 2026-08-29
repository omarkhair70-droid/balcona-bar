# Balcona Service — Visual Benchmark Audit

Status: EVIDENCE PASS COMPLETE — REVISION REQUIRED
Date: 2026-08-28

## Purpose

This audit replaces the earlier text-only Service reference proof with a fresh visual benchmark pass against real front-of-house restaurant POS products.

The existing Service prototype before this audit is treated as **V0**.

## Sources inspected visually / structurally

### Toast POS — Table Service + Order + Payment
Official support:
- https://support.toasttab.com/en/article/New-POS-Managing-Tables
- https://support.toasttab.com/en/article/New-POS-Experience-Ordering-Screens
- https://support.toasttab.com/en/article/New-POS-Managing-Payments
- https://support.toasttab.com/en/article/New-POS-Experience-Table-Data-Details-Pane

Observed:
- Table Service is a floor-plan workspace, not a generic grid of equal cards.
- Service areas sit at the top for rapid switching.
- Active table tiles expose timer, table identity, spend and server context at a glance.
- A details pane gives high-level table/order context without forcing a full screen change.
- Order screens separate check detail from item/menu work.
- Primary service actions remain persistent and touchable.
- Payment is a dedicated operational state, not hidden inside a generic order card.
- Dark/light mode is device-specific; visual semantics matter more than brand decoration.

Take:
- spatial floor plan
- top service-area switching
- timer/state prominence
- details pane
- persistent high-frequency actions
- separate payment state

Do not copy:
- Toast-only features unsupported by Balcona such as reservation/VIP chit data, split/service-charge controls, seat management, or manual menu-entry semantics where Balcona backend does not support them.

### Square for Restaurants
Official support:
- https://squareup.com/help/us/en/article/6427-building-your-floor-plan
- https://squareup.com/help/us/en/article/8146-customize-table-management-settings
- https://squareup.com/help/us/en/article/8152-take-orders-tableside-with-square-for-restaurants-mobile-pos
- https://squareup.com/help/us/en/article/8421-new-order-and-pay-capabilities-with-square-for-restaurants

Observed:
- Floor plans mirror real restaurant sections/layout.
- Occupied state starts as soon as the table/session is active.
- Time-based color indicators escalate table state.
- Mobile/tableside workflows prioritize touch speed.
- Orders/checks centralize in one operational list.
- Live cart/check context remains visible during tableside actions.

Take:
- floor geometry as an operational map
- time-based urgency
- touch-first density
- centralized active-order list

Do not copy:
- unsupported seating, comp/void/move/split features or preauthorization behavior.

### Lightspeed Restaurant POS
Official support:
- https://resto-support.lightspeedhq.com/hc/en-us/articles/360000348213-About-floors-and-tables
- https://resto-support.lightspeedhq.com/hc/en-us/articles/360005777873-About-navigation-in-Restaurant-POS
- https://resto-support.lightspeedhq.com/hc/en-us/articles/226405408-About-orders
- https://resto-support.lightspeedhq.com/hc/en-us/articles/229679927-Basic-ordering-on-an-iPhone-iPod

Observed:
- Tables is the natural starting point for table-service work.
- Floor and table status are primary operational navigation.
- Orders List is a separate all-orders summary.
- Profile/shift/cash functions stay available without becoming Office/Back Office.
- Handheld ordering collapses to task-focused navigation and persistent Send/Pay behavior.

Take:
- clear Tables vs Orders separation
- handheld/task-mode discipline
- shift functions separated from Back Office

Do not copy:
- customer profile, takeout, manual product-entry or unsupported payment terminal controls.

## Balcona backend truth retained

Visible Service jobs must stay within existing capabilities:
- cashier order queue
- accept / reject / cancel / complete
- Smart Cashier review state
- ready-to-serve
- waiter calls
- table-session attention
- computed attention
- AI escalation
- bill requests
- bill present / manual payment
- payment unknown / needs review
- cashier shifts
- X report
- cash adjustments
- close blockers
- realtime branch events

## V0 gaps

### S1 Floor
Problem:
- equal square card grid reads as a dashboard, not a restaurant floor.
- no service-area switching.
- table selection does not expose a real context pane.
- timer/state is subordinate to decorative card structure.

Revision:
- spatial floor canvas
- Dining / Terrace area tabs
- table shapes/positions vary
- state color + elapsed time dominate
- selecting a table opens a persistent detail pane
- pane shows only supported context: table/session state, active attention, active order, bill state and direct jumps

### S2 Orders
V0 direction is broadly valid because Balcona's cashier job is accepting/processing incoming orders, not manually composing full checks.

Refine:
- denser queue rows
- stronger review/ready exceptions
- explicit selected-order rail
- primary accept/reject/serve actions fixed
- avoid faux analytics cards

### S3 Attention
Problem:
- cards are too dashboard-like for fast waiter work.

Revision:
- prioritized queue/list
- one clear active item
- urgency + age + table + reason
- action drawer
- preserve computed/AI/waiter/ready source distinctions

### S4 Bills
V0 direction is valid.

Refine:
- queue density
- unresolved payment state must visually outrank line items
- requested/presented/unknown/paid remain separate
- no provider/reconciliation internals

### S5 Shift
V0 direction is valid.

Refine:
- shift status should remain persistent in shell
- open/X/adjust/close hierarchy should be compact
- close blockers remain explicit

## Revised synthesis

**Floor**
Toast spatial table-service model
+ Square time-based table urgency
+ Lightspeed Tables-first navigation
+ Balcona attention/session truth

**Orders**
Toast/Square operational check hierarchy
+ Balcona incoming-order acceptance/review lifecycle

**Attention**
handheld task queue discipline
+ Balcona waiter/computed/ready/AI sources

**Bills**
Toast payment separation
+ Balcona bill/manual-payment/unknown-state safety

**Shift**
Lightspeed POS-profile separation
+ Balcona cashier-shift truth

## Acceptance gate after revision

Service cannot be visually re-closed until:
1. Floor reads as a restaurant floor, not a dashboard grid.
2. Service areas are switchable.
3. table urgency/timer is readable immediately.
4. selecting a table opens supported context.
5. waiter attention reads as a prioritized operational queue.
6. cashier orders remain task-first.
7. bills keep unknown payment separate and dominant.
8. shift status is persistent but not Office-like.
9. Cashier and Waiter remain modes of one Service product.
10. Arabic / RTL remains usable.
