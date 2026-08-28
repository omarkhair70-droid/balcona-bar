# Balcona Guest — Reference Proof

Status: LOCKED FOR PROTOTYPE
Date: 2026-08-28

## Surface

Balcona Guest is the customer-facing table-session experience opened from QR.

It is not:
- a Staff app
- a Back Office
- a generic restaurant website
- a five-card feature launcher

## Reference stack

### me&u
Take:
- consumer-first menu discovery
- strong item imagery and merchandising
- lightweight contextual recommendation

### Toast Mobile Order & Pay
Take:
- session continuity
- order → status → bill/payment lifecycle
- table context without exposing operations complexity

### Lightspeed Order Anywhere
Take:
- clear guest order/payment state
- simple confirmation and recovery language

### Balcona
Use:
- QR table sessions
- branch-effective menu and availability
- cart + modifier flow
- order submission
- customer status/timeline
- waiter calls
- bill requests
- online payment intents
- AI Waiter grounding, proposals, and escalation
- experience/content/media profiles

## Formula

**me&u discovery + Toast session continuity + Lightspeed state clarity + Balcona AI/service truth**

## Primary architecture

Guest opens into the **Menu**, not a dashboard.

Persistent mobile navigation:
- Menu
- Order
- Service
- Bill

Home is contextual session framing, not a permanent equal destination.
AI Waiter is contextual and accessible from Menu/item/cart/service — not a fifth primary destination.

## Core flows

### QR / session
- venue identity
- branch/table confirmation
- start/continue session

### Menu
- categories
- featured / relevant items
- item detail
- modifiers
- availability
- contextual AI help
- sticky cart state

### Cart
- items
- quantity/edit
- modifier summary
- subtotal
- validate
- submit order

### Order
- submitted
- accepted
- preparing
- ready
- served
- cancelled/rejected
- meaningful timeline

### Service
- call waiter
- show existing waiter-call state
- request bill
- AI → human escalation

### Bill / Pay
- bill request state
- bill presented
- total
- create online payment
- payment pending
- payment succeeded
- payment unknown / needs review

No customer-facing settlement/reconciliation/provider internals.

## Visual direction

Guest should feel:
- warm
- mobile-native
- appetizing
- calm
- fast
- clearly Balcona

Unlike Office/Service/Kitchen, Guest may use:
- richer imagery
- larger type
- more generous spacing
- stronger warm hospitality identity

Avoid:
- dashboard metrics
- admin tables
- giant SaaS hero
- excessive glass
- operational jargon
- provider internals

## Prototype acceptance

Pass when:
1. QR guest understands venue/table/session immediately
2. Menu is the default experience
3. item → modifier → cart feels consumer-native
4. AI feels helpful inside the ordering journey, not bolted on
5. order status is understandable without restaurant jargon
6. waiter/bill requests expose their current state
7. payment unknown is distinct from failed
8. Arabic/RTL works naturally
9. mobile layout is primary
10. every visible action maps to existing Balcona capability
