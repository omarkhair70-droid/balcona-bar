# R10 — Screen Architecture

Status: COMPLETE
Audit date: 2026-08-28

## Purpose

R10 defines the required product screens and their jobs before visual styling.

Each blueprint records:
- user/context
- primary job
- primary data
- primary action
- important states
- backend capability mapping
- device/layout assumptions

This is a screen architecture, not final copy or route naming.

---

# Surface A — Balcona Guest

## G1 — Session Entry / Table Confirmation

User:
Guest

Job:
Confirm the guest is entering the correct cafe/table session and recover cleanly from invalid QR/session state.

Primary data:
- cafe/branch
- table
- session status
- language

Primary actions:
- continue
- retry QR/session
- contact staff if invalid

States:
- resolving
- ready
- invalid QR
- expired/closed session
- temporary error

Backend:
- QR resolve
- table session start/get

Layout:
mobile-first

---

## G2 — Guest Home / Session Pulse

Job:
Orient the guest without acting as a feature directory.

Primary content:
- current table/cafe
- active order summary
- preparation/service state
- current bill/payment state when relevant
- recommended next action

Primary actions:
- browse menu
- continue order
- track order
- request service
- pay bill

States:
- new session
- order active
- ready/served
- bill requested
- payment pending
- paid

Backend:
- customer status
- timeline
- cart
- active bill

---

## G3 — Menu / Discovery

Job:
Find something desirable and available quickly.

Primary data:
- categories
- items
- images
- price
- availability
- modifiers preview
- recommendation signals

Primary actions:
- open item
- add
- ask AI / recommendation
- search/filter if justified

States:
- available
- sold out
- limited/unavailable
- loading
- personalized/recommended

Backend:
- branch menu
- inventory-grounded availability
- experience/media/content

---

## G4 — Item Detail / Customize

Job:
Understand and customize one item without ordering mistakes.

Primary data:
- item
- media
- description
- modifiers
- required/optional selections
- price delta
- stock availability

Primary action:
Add to order/cart

States:
- valid selection
- missing required option
- sold out
- price update

Backend:
- menu item
- modifiers
- cart add

Pattern:
detail panel/full-screen mobile sheet

---

## G5 — AI Assistant

Job:
Ask natural-language questions, get recommendations, or build a cart proposal.

Primary data:
- conversation
- menu grounding
- proposal
- escalation state

Primary actions:
- send
- apply proposal
- reject proposal
- ask for human help

States:
- thinking
- proposal ready
- proposal outdated due availability
- escalated
- unavailable

Backend:
- AI waiter session/messages/tool calls/cart proposals/escalation

Architecture rule:
AI entry is available contextually from Menu/Home/Cart, not only via permanent nav.

---

## G6 — Cart / Review Order

Job:
Verify the order before submission.

Primary data:
- items
- modifiers
- quantity
- subtotal/total
- validation issues

Primary actions:
- edit
- remove
- submit order

States:
- valid
- item became unavailable
- price changed
- cart empty
- submit pending/failed/succeeded

Backend:
- cart CRUD
- validate
- submit

---

## G7 — Order / Session Status

Job:
Know what is happening without asking staff.

Primary data:
- all current-session orders
- order state
- preparation state
- timeline
- ready/served state

Primary actions:
- order another round
- request service
- view bill when relevant

Backend:
- session orders
- customer status
- timeline
- realtime

---

## G8 — Service / Help

Job:
Ask for staff assistance clearly.

Primary actions:
- call waiter
- request water/help types supported
- cancel pending request when supported
- see current request state

Primary data:
- open calls
- acknowledgement/resolution state

Backend:
- waiter calls

Architecture rule:
Service help is distinct from the financial Bill experience, even if reachable from same session nav.

---

## G9 — Bill

Job:
Understand exactly what is owed.

Primary data:
- bill lines
- total
- paid/unpaid state
- existing payments
- payment options

Primary actions:
- request bill if not created
- start payment
- choose pay in person where available

States:
- not requested
- requested
- being prepared
- presented
- payment pending
- paid
- payment needs review

Backend:
- bill request
- bill
- bill lines
- receipt/payment state

---

## G10 — Pay

Job:
Complete payment with certainty.

Primary data:
- amount
- payment method
- customer action: redirect/deep link/QR/reference
- provider-neutral payment status

Primary actions:
- start/continue payment
- retry only when safe
- return to bill

States:
- action required
- confirming
- succeeded
- failed
- unknown/needs review
- expired

Backend:
- online payment intent
- customer action
- recovery/inquiry state

Rule:
Never rely on redirect alone as success truth.

---

## G11 — Receipt / Finish

Job:
Leave with proof of payment and a clean end state.

Primary data:
- receipt
- bill
- payments
- time
- cafe identity

Primary actions:
- view/share receipt
- finish session

Backend:
- bill receipt
- bill/payment status

---

# Surface B — Balcona Service

## S1 — Service Workspace Shell

User:
cashier/waiter/manager

Job:
Enter the correct operating mode immediately.

Persistent:
- branch
- current shift/user
- connectivity
- attention counts
- mode switch if authorized

No Office mega-navigation.

---

## S2 — Floor

Job:
Understand live tables visually.

Primary data:
- floor/table map
- session state
- elapsed time
- order/bill state
- attention reason
- staff ownership

Primary actions:
- open table/session
- claim/resolve attention
- open bill/order context

Backend:
- tables
- active sessions
- attention
- bill requests
- orders

Layout:
tablet/terminal; optional compact phone variant

---

## S3 — Orders Queue

Job:
Process incoming and active orders quickly.

Primary data:
- review state
- age
- table
- total
- reason requiring review
- preparation state

Primary actions:
- accept
- reject
- open detail
- cancel where authorized

Backend:
- cashier orders
- Smart Cashier decision/reasons
- order lifecycle

---

## S4 — Order Detail Panel

Job:
Resolve one order without losing queue context.

Primary data:
- full items/modifiers
- table/session
- history
- review reason
- customer context

Primary actions:
- accept/reject/cancel
- navigate to bill
- see preparation/service progress

Backend:
- order detail/events

Pattern:
side detail panel

---

## S5 — Attention Queue

User:
waiter/server/manager

Job:
See exactly who/what needs service now.

Sources:
- waiter calls
- ready-to-serve
- computed attention
- AI escalation

Primary actions:
- acknowledge/claim
- serve
- resolve
- mute/recalculate where authorized

Backend:
- waiter calls
- autopilot attention
- ready orders
- AI escalation

---

## S6 — Bill Requests Queue

Job:
Handle guests asking for the bill.

Primary data:
- table
- bill request age/state
- order completion
- bill total/state

Primary actions:
- acknowledge
- present bill
- open bill

Backend:
- bill requests
- bills

---

## S7 — Bill / Immediate Payment

Job:
Complete in-person settlement.

Primary data:
- bill lines
- amount due
- recorded payments
- online payment state
- receipt state

Primary actions:
- cash
- external POS/manual tender
- other supported manual method
- view online payment state
- generate receipt

Backend:
- bills
- manual payments
- online payments read
- receipt

---

## S8 — Shift Open

Job:
Start cashier shift safely.

Primary data:
- branch
- previous shift state
- opening float

Primary action:
Open shift

Backend:
- cashier shifts/open

---

## S9 — Shift Pulse

Job:
Know current drawer/shift state.

Primary data:
- opening float
- recorded cash
- adjustments
- expected cash
- current orders/bills

Actions:
- cash adjustment
- X report
- begin close

---

## S10 — Close Shift / Close Day

Job:
Close operational period with no hidden blockers.

Checklist:
- open orders
- unpaid bills
- unresolved cash variance
- required report
- active payment unknowns
- manager override if permitted

Primary action:
Close and generate final report

Backend:
- cashier shift close
- X/Z reports
- bills/orders/payments

---

# Surface C — Balcona Kitchen

## K1 — Station Bootstrap / Device Mode

User:
kitchen/barista/expediter

Job:
Know which station this device represents.

Data:
- branch
- station
- printer/routing state
- connectivity

Manager actions:
- switch/configure station only with permission

---

## K2 — Production Board

Job:
Prepare current work.

Primary data:
- ticket age
- table/order
- items/modifiers
- course/station if supported
- status

Primary actions:
- start
- ready
- complete/bump based on lifecycle
- open detail

States:
- new
- in progress
- delayed
- changed
- cancelled
- ready

Backend:
- preparation tasks
- kitchen tickets
- realtime

---

## K3 — Ticket Detail / Recall

Job:
Inspect instructions/history without losing board.

Data:
- item detail
- modifier detail
- events
- linked order

Actions:
- start/ready/cancel where allowed
- reprint
- recall recent

---

## K4 — Production Alert

Job:
Surface exceptional production failures.

Examples:
- print failed
- routing issue
- cancelled/changed ticket
- stale realtime

Primary action:
retry/acknowledge/escalate

Backend:
- print jobs
- ticket/preparation events

Rule:
Only live production exception actions belong here; full printer configuration belongs in Office.

---

# Surface D — Balcona Office

## O1 — Office Home

Scope:
All Locations or Branch

Job:
Know business health and what needs attention.

All Locations content:
- sales snapshot
- location health
- critical money issues
- stock/procurement exceptions
- top operational issues
- trend deltas

Branch content:
- branch pulse
- current shift
- delayed operations
- stock alerts
- payment issues
- device health

Primary actions:
drill into issue/domain

Backend:
- owner/general analytics
- payments/reconciliation
- inventory alerts
- attention
- jobs/device state where relevant

---

## O2 — Operations Overview

Job:
Review branch/company operating health beyond live execution.

Data:
- orders
- service attention
- preparation performance
- shift state
- automation outcomes

Actions:
- drill into Orders
- Attention
- Shifts
- Kitchen Operations
- Automation

---

## O3 — Operations / Orders

Job:
Historical and managerial order investigation.

Data:
- orders across scope/time
- lifecycle
- exceptions
- source
- staff actions

Actions:
- inspect
- filter/export later
- operational recovery only if backend permits

---

## O4 — Operations / Service & Attention

Job:
Review recurring service issues and current unresolved attention.

Data:
- waiter calls
- attention reasons
- response time
- escalations

Actions:
- inspect
- resolve where current
- tune automation via link

---

## O5 — Operations / Shifts & Cash

Job:
Review shifts and cash movement.

Data:
- open/closed shifts
- X/Z
- cash adjustments
- expected/actual where available

Actions:
- inspect reports
- investigate variance

---

## O6 — Operations / Kitchen

Job:
Review production performance and exceptions.

Data:
- preparation time
- ticket status
- printer failures
- station health

Actions:
- inspect
- open device/station config

---

## O7 — Automation / Smart Cashier

Job:
Configure and understand automated cashier decisions.

Data:
- mode
- rules
- review reasons
- evaluation outcomes
- auto-accept performance

Actions:
- enable/disable
- create/update rule
- test/evaluate
- audit change

Backend:
- Smart Cashier settings/review rules/evaluation

---

## O8 — Catalog Overview

Job:
Understand menu health.

Data:
- categories/items
- inactive/unavailable
- modifier integrity
- branch override count
- preview issues

Actions:
- create item/category
- fix issue
- open branch override

---

## O9 — Catalog / Categories

Structured table/list:
- name
- status
- sort order
- item count

Actions:
- create/edit/reorder/activate/deactivate

---

## O10 — Catalog / Items

Structured table:
- item
- category
- base price
- status
- availability
- branch overrides
- media

Actions:
- create/edit/archive
- open detail
- manage overrides

---

## O11 — Catalog / Item Editor

Full page:
- basics
- price
- description
- media
- modifiers
- inventory requirements link
- branch override summary
- preview

---

## O12 — Catalog / Modifiers

Job:
Manage groups/options and item assignments.

Use table/list + detail editor.

---

## O13 — Catalog / Availability & Branch Overrides

Job:
Explain effective sellability.

For each item:
- company state
- stock state
- branch override
- effective state
- reason

Actions:
- override
- reset to company default

---

## O14 — Inventory Overview

Job:
Know stock/procurement health.

Data:
- low/out
- pending POs
- deliveries due
- stock-blocked menu items
- recent adjustments

---

## O15 — Inventory / Stock

Table:
- item
- branch
- on hand
- par
- threshold
- status

Actions:
- adjust
- inspect movement

---

## O16 — Inventory / Alerts

Exception queue:
- low
- out
- missing threshold
- menu impact

---

## O17 — Inventory / Movements

Ledger-like table:
- item
- type
- quantity
- source
- actor
- time

---

## O18 — Inventory / Requirements

Job:
Map menu items to inventory consumption.

Data:
- menu item
- ingredient
- quantity/unit

Actions:
- edit requirements
- validate missing links

---

## O19 — Suppliers

Table:
- supplier
- status
- branch scope
- recent POs

Actions:
- create/edit/deactivate

---

## O20 — Purchase Orders

Table:
- PO
- supplier
- branch
- status
- amount/lines
- created/submitted

Actions:
- create
- edit draft
- submit
- cancel
- receive

---

## O21 — Purchase Order Detail

Full page:
- supplier
- lines
- quantities
- status timeline
- receive history

Actions:
- edit lines
- submit
- cancel
- receive

---

## O22 — Receiving

Job:
Record delivery accurately.

Data:
- expected lines
- received quantity
- discrepancy
- receipt

Primary action:
Confirm receiving

Backend:
- PO receipts
- inventory receipts

---

## O23 — Locations Overview

All Locations:
- branch list
- readiness/health
- active/inactive
- key exceptions

Actions:
- add branch
- open branch

---

## O24 — Branch Profile

Data:
- name
- address
- status
- service/operating mode summary
- inheritance state

Actions:
- edit
- deactivate
- open setup/readiness

---

## O25 — Floors & Tables

Visual/list management:
- floors
- tables
- capacity
- status
- QR state

Actions:
- create/edit
- bulk create
- activate/deactivate

---

## O26 — QR Management

Data:
- table
- token/link
- generated state
- last regeneration

Actions:
- generate
- regenerate with high-risk confirmation
- print/export later

---

## O27 — Zones

Data:
- zone
- type
- status
- scope/usage

Actions:
- create/edit/archive

Final placement between Locations and Experience remains contextual to zone usage, but screen exists.

---

## O28 — Devices & Stations

Data:
- device/station
- role
- branch
- status
- last activity
- printer mapping

Actions:
- create/edit/disable
- test print
- assign mode/station

Backend:
- printer stations
- KDS/station concepts

---

## O29 — Team / People

Data:
- staff
- role
- branch/company access
- status
- last activity where available

Actions:
- invite
- edit access
- deactivate/revoke

---

## O30 — Team / Roles & Access

Job:
Understand and change permission/access assignment.

Data:
- role
- effective permissions
- location access

Actions:
- assign role/access
- inspect effective access

Rule:
Do not expose raw permission matrix to casual operators unless needed.

---

## O31 — Team / Invites

Data:
- pending/accepted/expired
- role
- branch
- expiry

Actions:
- invite
- resend/revoke if backend later supports

---

## O32 — Money Overview

Job:
Know financial health.

Data:
- collected
- pending
- failed/unknown
- refunds
- settlement status
- reconciliation issues

Actions:
- open transactions/issues/settlements

---

## O33 — Money / Transactions

Table:
- transaction/payment
- provider
- amount
- bill/order
- status
- date

Actions:
- inspect
- permitted refund/void/capture from detail

---

## O34 — Payment Detail

Full page/detail:
- customer-facing state
- provider state
- bill/order/table
- events
- operations
- recovery history

Actions:
- refund
- void
- capture
- recover

High-risk confirmation required.

---

## O35 — Money / Bills

Table:
- bill
- table/order
- total
- paid/unpaid
- payment methods
- receipt

---

## O36 — Money / Refunds & Operations

Data:
- refund/void/capture operations
- status
- provider reference
- amount
- recovery state

Actions:
- inspect/recover

---

## O37 — Money / Settlements

Data:
- batch
- provider
- date
- gross
- fees
- net
- status

Actions:
- import statement
- open batch

---

## O38 — Money / Reconciliation

Data:
- reconciliation runs
- match summary
- unmatched/mismatch counts

Actions:
- run/import
- inspect run

---

## O39 — Money / Issues

Exception queue:
- mismatch type
- amount
- payment/batch
- severity
- status

Actions:
- acknowledge
- resolve
- open linked transaction

---

## O40 — Insights Overview

Job:
Answer trend questions, not operational execution.

Data:
- sales
- orders
- items
- operations
- shifts
- AI
- location comparison

---

## O41 — Insights / Reports

Report library:
- Daily
- Sales
- Orders
- Items
- Operations
- Cashier shifts
- AI Waiter
- company analytics

Actions:
- date/scope/filter
- export later

---

## O42 — Activity / Audit

Data:
- actor
- action
- entity
- branch/company
- time

Actions:
- filter
- inspect

Backend:
- audit logs

---

## O43 — Experience Overview

Job:
See what guest-facing configuration is active.

Data:
- effective profile
- active content
- media health
- AI state
- notification configuration

---

## O44 — Experience Profiles

Data:
- company/branch profile
- active/default
- inheritance

Actions:
- create/edit
- activate
- archive
- set default
- apply/preview pack

---

## O45 — AI Waiter Management

Data:
- mode/provider
- usage
- sessions
- escalations
- performance summary

Actions:
- inspect sessions
- configure allowed experience/settings where backend supports

---

## O46 — Content

Data:
- content block
- placement
- status
- scope

Actions:
- create/edit
- activate/deactivate/archive

---

## O47 — Media Library

Data:
- assets
- type
- status
- usages

Actions:
- create/update
- archive/restore
- inspect usage

---

## O48 — Notifications

Data:
- templates
- channel
- kind
- active state
- recent notification status where useful

Actions:
- create/edit template
- activate/deactivate

---

## O49 — Settings / Business

Data:
- business/company profile
- defaults

---

## O50 — Settings / Branch Operations

Data:
- operating mode
- service mode
- branch settings

Actions:
- update with scope/inheritance clarity

---

## O51 — Settings / Feature Flags

Advanced screen:
- feature
- state
- scope
- inherited/override
- consequence

Actions:
- enable/disable with confirmation when high impact

---

## O52 — Account / Plan & Billing

Data:
- current plan
- usage
- entitlements
- blockers/warnings

Actions:
- future upgrade/billing
- contact/support

This is not Money.

---

# Surface E — Balcona Setup

## U1 — Setup Home

Data:
- overall progress
- branch
- blockers
- recommended next step

Actions:
- continue setup
- open blocker
- test experience

---

## U2 — Business

- company/branch profile
- status
- essential identity

---

## U3 — Menu Setup

Paths:
- import
- copy existing
- use current catalog
- manual create

Backend currently supports manual/catalog; import/copy capabilities can be future implementation if not yet present.

---

## U4 — Tables & QR

- floor creation
- bulk tables
- QR readiness

---

## U5 — Team Setup

- role coverage
- invite initial staff

---

## U6 — Kitchen / Devices

- stations
- printer readiness
- test print
- KDS mode

Some backend pieces exist; screen blueprint can expose only implemented capability during first implementation pass.

---

## U7 — Payments

- enabled provider
- configuration readiness
- webhook/provider health later
- test payment in non-production
- live certification status

No secrets shown in client.

---

## U8 — Experience

- theme/profile
- AI waiter
- content/media essentials

---

## U9 — Operations / Automation

- service mode
- Smart Cashier defaults
- operating settings

---

## U10 — Final Readiness / Go Live

Checklist:
- menu
- tables/QR
- staff
- kitchen
- payment
- end-to-end test
- unresolved blockers

Primary action:
Go Live / mark ready according to supported backend semantics

---

# Surface F — Balcona Platform

## P1 — Platform Dashboard

- tenant counts/status
- onboarding attention
- system health summary

## P2 — Companies

- company list
- plan
- status
- branch count
- search

## P3 — New Cafe / Bootstrap

- company
- plan
- first branch
- owner
- starter tables
- invite/access

## P4 — Company Detail

- tenant identity
- branches
- subscription
- owner/staff invite
- audit summary

## P5 — System Status

- API/system info
- job health
- environment/runtime indicators safe for platform users

---

# Cross-screen state requirements

Every list/detail screen supports:
- loading
- healthy empty
- filtered empty
- partial failure where possible
- full error
- permission denied where relevant
- stale/realtime disconnected where live

Every mutation supports:
- pending
- success
- failure
- unknown/ambiguous where financial/provider operation requires it

Every scoped configuration screen shows:
- current scope
- inheritance/default state
- impact of change

---

# Screen consolidation rules for implementation

The blueprint defines conceptual screens, not 60 mandatory URL files.

Several screens can share one route with meaningful sub-navigation if:
- jobs are strongly related
- frequency is similar
- data model is coherent
- the page remains scannable
- deep links remain possible

Do NOT repeat the current mega-page pattern merely to reduce route count.

---

# First implementation wave candidates

When implementation starts after R11, the safest order is:

1. Office shell + scope + navigation
2. role-aware Home
3. Catalog decomposition
4. Inventory/Procurement decomposition
5. Locations + Team
6. Money visibility
7. Operations / Smart Cashier
8. Experience management
9. Service shell
10. Kitchen shell
11. Guest journey refinement
12. Setup orchestration
13. Platform polish

This order can be re-ranked after implementation risk review.

# R10 completion gate

R10 status: COMPLETE

All currently identified backend capability families now have a proposed screen home or an explicit embedded/internal treatment.

Next:
R11 — Visual Direction.
