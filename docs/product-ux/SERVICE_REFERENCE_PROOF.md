# Balcona Service — Reference Proof

Status: LOCKED FOR PROTOTYPE
Date: 2026-08-28

## Surface

Balcona Service is the live front-of-house operating workspace.

It is not Balcona Office.
It is not Kitchen.
It is not a generic staff dashboard.

Primary users:
- cashier
- waiter/server
- branch manager during active service

## Reference stack

### Square for Restaurants POS
Take:
- task-first layout
- stable action areas
- clear table/order/check context
- touch-first controls
- shift/payment clarity

### Toast POS
Take:
- restaurant order/check lifecycle
- quick exception handling
- guest ↔ staff continuity
- bill/payment completion

### Lightspeed Restaurant POS
Take:
- POS separated from Back Office
- compact active-service navigation
- role/device-adaptive entry

### Balcona
Use:
- Smart Cashier review reasons
- waiter calls
- computed attention
- ready-to-serve
- bill request lifecycle
- manual payments
- cashier shifts / X / close
- realtime branch state

## Formula

**Square operational clarity + Toast restaurant workflow + Lightspeed POS separation + Balcona automation**

## Core navigation

- Floor
- Orders
- Attention
- Bills
- Shift

Cashier default:
- Orders

Waiter default:
- Attention / Floor

Manager:
- can switch across modes if authorized

No Office mega-navigation.

## Cashier layout

Desktop/terminal:
- left: queue
- center/right: selected order/check detail
- stable bottom/right actions
- shift state persistent

High-frequency actions:
- accept
- reject
- cancel
- complete
- acknowledge/present bill
- record manual payment
- X report
- cash adjustment
- begin close

## Waiter/Floor layout

Tablet/handheld:
- floor/table state
- attention age/reason
- ready-to-serve
- waiter calls
- quick claim/resolve/serve actions

Primary information:
- table
- reason
- age
- order/bill state
- urgency

## Density

Service density = compact + touchable.

Rules:
- ~44px minimum touch targets
- fewer metadata fields than Office
- important state always visible
- no hover-only primary action
- no giant page header
- no marketing-style cards
- no deep finance/provider details

## States

Orders:
- needs review
- accepted
- preparing
- ready
- served
- cancelled/rejected

Attention:
- urgent
- due
- active
- acknowledged
- resolved
- muted

Bills:
- requested
- acknowledged
- presented
- partially/fully paid
- payment pending
- payment unknown/needs review

Shift:
- no open shift
- open
- cash adjustment
- X report
- close blockers
- close ready

## Visual direction

Service should feel:
- faster than Office
- darker/warmer if useful
- flatter
- operational
- touch-oriented

Balcona identity:
- warm brown/bronze accent may be stronger than Office
- semantic urgency always wins over brand

## Prototype acceptance

The prototype passes when:
1. cashier can understand what to process next immediately
2. waiter can see who needs service and why
3. floor state is readable without entering Office
4. bill/payment state is explicit
5. shift state is persistent
6. Cashier and Waiter feel like modes of one Service product
7. Arabic/RTL works
8. no Office sidebar or Office density leaks in
9. every visible job maps to existing backend capability
