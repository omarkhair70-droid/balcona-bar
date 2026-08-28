# Balcona Kitchen — Reference Proof

Status: LOCKED FOR PROTOTYPE
Date: 2026-08-28

## Surface

Balcona Kitchen is a dedicated production workspace.

It is not:
- Balcona Office
- Balcona Service
- a generic Staff dashboard

Primary users:
- kitchen
- barista
- dessert station
- expediter / manager during active production

## Reference stack

### Toast KDS
Take:
- ticket readability
- age/timer dominance
- prep vs ready hierarchy
- low chrome

### Square KDS
Take:
- station clarity
- touch-first ticket actions
- source/routing visibility
- clear production state

### Lightspeed KDS
Take:
- named production-station model
- station responsibility

### Balcona
Use:
- PreparationTask lifecycle
- KitchenTicket snapshots
- kitchen / barista / dessert stations
- PrintJob state
- reprint
- retry / mark printed / mark failed
- realtime branch context

## Formula

**Toast ticket readability + Square station clarity + Lightspeed station responsibility + Balcona production truth**

## Primary workspace

Persistent top frame only:
- Balcona Kitchen
- branch
- station
- connectivity
- language
- manager exit

No Office rail.
No Service navigation.
No hero header.

## Station modes

- Kitchen
- Barista
- Dessert
- Expediter

Expediter is a prototype viewing mode over all stations; it does not invent a new backend station enum.

## Work modes

### Board
Preparation tasks organized for fast production:
- New
- In progress
- Ready

Actions:
- Start
- Mark ready
- Cancel where authorized

### Tickets
Kitchen-ticket snapshot:
- display code
- order number
- table/floor
- station
- items/modifiers/notes
- print state
- reprint

### Print
Only operational print exceptions:
- pending/printing
- printed
- failed
- retry / mark printed / mark failed

Printer configuration remains Office → Locations → Devices & Stations.

## Density and visual rules

Kitchen density = maximum scannability.

Rules:
- landscape-first
- large item typography
- age/status dominates
- high contrast
- large touch targets
- minimal metadata
- semantic urgency overrides brand color
- no decorative cards
- no analytics
- no Office-style tables

## State language

Preparation:
- New
- In progress
- Ready
- Cancelled

Ticket:
- Active
- Ready/complete where represented

Print:
- Pending
- Printing
- Printed
- Failed
- Reprint requested

## Prototype acceptance

Pass when:
1. station identity is obvious immediately
2. oldest/late work is obvious without reading every ticket
3. one tap can start or mark work ready
4. modifiers/notes cannot be missed
5. print failure is visible but does not dominate normal production
6. expediter can see cross-station readiness
7. Arabic/RTL remains readable
8. no Office or Service shell leaks into Kitchen
9. every visible action maps to existing backend behavior


## Prototype implementation status

Prototype route implemented:
- `/prototype/kitchen`

Current proof includes:
- Kitchen
- Barista
- Dessert
- Expediter cross-station viewing mode
- Board
- Tickets
- Print
- Arabic / RTL

This section also serves as the preview-deployment checkpoint for the complete Kitchen prototype tree.
