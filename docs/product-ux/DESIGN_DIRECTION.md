# R11 — Visual Direction

Status: COMPLETE
Audit date: 2026-08-28

## Goal

Give Balcona a visual language that matches its actual product maturity:
a multi-location hospitality operating system with distinct guest, service, kitchen, management, setup, and platform contexts.

The redesign must not become:
- a Toast clone
- a Lightspeed clone
- a generic shadcn dashboard
- a dark glass-card theme applied everywhere

---

# 1. Current visual diagnosis

The existing UI has a recognizable warm hospitality identity:
- dark brown background
- bronze/copper primary
- burgundy accent
- cream foreground
- glass/premium surfaces
- compact rounded corners

These are useful brand ingredients.

The problem is not the palette alone.

The current visual system frequently applies:
- large hero headers
- premium glass cards
- large decorative titles
- card grids
- identical dashboard shells

to surfaces with completely different jobs.

This makes:
- Cashier feel like a presentation dashboard
- Kitchen feel like an admin app
- Owner/Office less information-dense than the backend requires
- Guest feel partly like a product demo rather than a living cafe session

R11 therefore separates **brand identity** from **workspace ergonomics**.

---

# 2. Core visual principle

## "Warm hospitality, operational clarity"

Balcona should feel:
- human
- premium
- calm
- modern
- trustworthy

without sacrificing:
- density
- speed
- legibility
- financial certainty
- kitchen visibility
- mobile simplicity

The brand is warm.
The interface behavior is disciplined.

---

# 3. One brand, multiple visual modes

Balcona does not use one identical page treatment everywhere.

## Guest mode
Mood:
hospitality / discovery / comfort

Characteristics:
- brand-forward
- image-rich
- warmer surfaces
- generous spacing
- consumer typography
- fewer visible controls
- strong bottom actions
- cafe-specific theme adaptation allowed

## Service mode
Mood:
fast / practical / confident

Characteristics:
- flatter surfaces
- high information density
- large touch targets
- limited decoration
- strong status hierarchy
- current action always obvious
- table/order context persistent

## Kitchen mode
Mood:
urgent / unmistakable / distance-readable

Characteristics:
- very high contrast
- minimal branding
- large ticket typography
- timer-led hierarchy
- station color/label support
- bright exception semantics
- no decorative glass

## Office mode
Mood:
professional / calm / analytical

Characteristics:
- desktop information density
- neutral surfaces
- tables, filters, side panels
- subtle Balcona bronze accent
- low visual noise
- strong hierarchy
- broad canvas

## Setup mode
Mood:
guided / reassuring / progressive

Characteristics:
- stepper/progress
- focused forms
- recommendations
- completion states
- fewer simultaneous choices

## Platform mode
Mood:
internal operations / SaaS control

Characteristics:
- shares Office system
- more technical/system status affordances
- clearly differentiated from tenant context

---

# 4. Color strategy

## Brand colors

Preserve the warm Balcona family:
- bronze/copper as brand accent
- deep warm brown/burgundy as identity colors
- cream/warm neutral for hospitality surfaces

Do not use brand accent as the only status signal.

## Semantic colors

Status colors are independent tokens:
- success
- warning
- danger
- info
- neutral
- pending/unknown

Financial unknown/pending must have its own semantic treatment and must not be visually identical to failure.

## Surface colors

Office should use calmer neutral surfaces than the current all-dark presentation treatment.

R11 direction:
support both:
- dark operational modes where useful
- neutral/light or low-contrast Office surfaces if visual testing proves superior

The final implementation may support appearance themes later, but the first overhaul should prioritize context over theme toggles.

## Guest theming

Branch experience profiles may influence:
- accent
- hero/media treatment
- subtle background tone
- content

They must not override:
- accessibility
- payment/status semantics
- core control contrast

---

# 5. Typography

## Office
- restrained sans-serif
- compact headings
- strong tabular numbers
- clear data hierarchy
- no 48–60px page titles in routine admin screens

## Service
- medium/large readable labels
- numerals and totals emphasized
- compact supporting text

## Kitchen
- large ticket/item text
- modifiers visually distinct
- timers immediately scannable

## Guest
- more expressive hierarchy allowed
- menu names/images lead
- price clear but secondary to item identity

## Arabic
Arabic typography must be tested as a first-class composition, not translated after English spacing is finished.

Avoid:
- narrow line boxes
- uppercase-dependent hierarchy
- icon/text assumptions that fail in RTL

---

# 6. Shape / elevation

Current rounded-card language can remain but should be restrained.

Rules:
- operational cards: low elevation
- Office tables/panels: mostly flat
- Guest hero/item cards: richer depth allowed
- alerts: use border/background/status, not glow
- modal/dialog: elevated
- premium glow reserved for rare brand moments

Retire:
- premium glass as default page wrapper
- glow on routine primary buttons
- heavy shadow on every card

---

# 7. Office shell visual direction

Desktop frame:

Left rail:
- Balcona mark
- scope-aware domain navigation
- collapsible groups only when needed

Top bar:
- company/location selector
- command search
- attention
- account/language

Main content:
- compact page title
- contextual actions
- optional breadcrumbs
- filter/action row
- data area

No giant hero card around every page heading.

Example hierarchy:

`Inventory`
`New Cairo · Stock`

[Search] [Status] [Low stock]                         [+ Adjust stock]

---------------------------------------------------------------
Item        On hand     Par     Status      Last movement
...

This is intentionally closer to an operating tool than a marketing page.

---

# 8. Home visual direction

Home composition:

Top:
- 1–3 critical attention items

Then:
- role/scope-specific operational pulse

Then:
- trends/metrics

Avoid:
- nine equally weighted feature cards
- decorative KPI walls
- "Open Surface" buttons

Cards on Home must answer:
- is something wrong?
- what changed?
- what should I do?

---

# 9. Service visual direction

## Cashier terminal

Layout target:
- left/center: queue or floor
- right: selected check/order detail
- bottom/side: high-frequency actions

Visual hierarchy:
1. action needed
2. total/payment state
3. table/customer context
4. detail/history

Primary actions should be stable in position.

Avoid giant page header above the queue.

## Waiter handheld

Layout:
- attention queue first
- table identifier large
- reason + age
- claim/resolve/serve actions
- minimal secondary metadata

---

# 10. Kitchen visual direction

Ticket board:

Each ticket communicates:
- order/table
- age
- item
- modifiers
- state

Status/timing hierarchy:
- new
- in progress
- approaching target
- late
- changed/cancelled

Do not rely solely on background colors.
Use:
- text labels
- timer
- border/icon
- spatial grouping

KDS header remains minimal:
- station
- connectivity
- queue controls
- manager menu

---

# 11. Guest visual direction

The current Guest experience should move away from "dashboard card" framing.

## Session header
Compact:
- cafe identity
- table
- language/help
- order/bill state when relevant

## Menu
- strong photography
- category navigation
- clean item rows/cards
- availability clear
- AI recommendation affordance embedded naturally

## Cart
- consumer checkout pattern
- sticky total/submit

## Status
- timeline/progress
- plain-language states

## Service
- large intent-based actions

## Bill / Pay
- calm, high-trust layout
- total dominant
- method/action clear
- pending/unknown state explicit

The guest should feel like they are using the cafe, not Balcona administration software.

---

# 12. Money visual direction

Financial screens must feel trustworthy, not promotional.

Use:
- ledger/table structure
- monospace/tabular numbers where useful
- status chips
- explicit provider/reference in detail
- event timeline
- issue banners
- clear amounts/currency

Payment detail:
- Balcona interpreted state first
- provider technical detail second
- operations/history third

Refund/void/capture buttons:
- visually secondary until context confirms action
- never mixed with routine navigation

---

# 13. Inventory / procurement visual direction

Inventory Overview:
exception-led.

Stock:
dense table.

Purchase Orders:
status/table/list.

PO Detail:
document-like structure:
- supplier header
- lines
- totals
- lifecycle
- receiving history

Receiving:
large quantity inputs
exception emphasis
mobile/tablet friendly where deliveries are checked away from desk.

---

# 14. Locations visual direction

Locations overview:
- structured location list
- health/readiness state

Floors/Tables:
use a spatial view where it improves operations,
plus a structured list for administration.

Do not force floor-plan visuals for bulk editing tasks.

QR management:
- table
- code
- state
- print/export action
- regenerate as dangerous/recovery action

---

# 15. Team visual direction

People list should be boring in the best way:
- name
- role
- location access
- status
- last relevant activity

Role/access detail:
- human-readable role summary first
- advanced permission detail secondary

Avoid exposing 80 raw permission switches by default.

---

# 16. Experience visual direction

This is where richer Balcona brand expression can live in Office.

Use:
- preview panels
- guest preview
- media thumbnails
- profile state
- content placement

But editing controls remain structured and predictable.

Experience should feel creative without turning the rest of Office into a creative tool.

---

# 17. Setup visual direction

Main layout:
- progress/steps on one side/top
- focused task content
- right/secondary readiness summary

States:
- complete
- in progress
- blocked
- optional

Show:
- why blocked
- what to do
- where to go

Celebrate Go Live modestly; do not make every setup step a decorative milestone card.

---

# 18. Iconography

Use icons to reinforce:
- domain
- status
- action

Rules:
- consistent library
- no icon-only critical action without accessible label
- directional icons mirror correctly in RTL
- avoid decorative icon boxes on every metric/card

---

# 19. Motion

Motion is functional:
- drawer transition
- new ticket/order arrival
- state change
- confirmation
- step progress

Avoid:
- ambient glowing animation
- excessive hover movement
- animated backgrounds in operations

Kitchen/Service motion must never distract from urgency.

---

# 20. Data visualization

Charts only when they answer a comparison/trend question.

Use:
- line for time trends
- bar for category/location comparisons
- simple distribution where useful

Avoid:
- charts for single numbers
- decorative donut walls
- dashboards with more visualizations than decisions

Tables remain primary for investigation.

---

# 21. Content / copy tone

Guest:
- natural hospitality language
- concise
- friendly

Operations:
- direct
- action-oriented

Office:
- precise
- business language

Financial:
- explicit
- no ambiguous success language

Setup:
- instructional
- clear next step

Avoid internal phase names and backend terminology.

---

# 22. Visual reference synthesis

## From Toast
Take:
- separation of operational products
- guest hospitality focus
- setup progression

Do not take:
- exact orange/black branding
- Toast-specific POS visual identity

## From Lightspeed
Take:
- mature Back Office density
- clear business-domain navigation
- transaction/report structure

Do not take:
- exact green branding
- every enterprise information layer

## From Square
Take:
- clean touch operation
- floor/table state clarity
- restrained controls

Do not take:
- generic Square aesthetic
- ecosystem patterns unrelated to Balcona

## From Oracle
Take:
- hierarchy/scope clarity

Do not take:
- legacy enterprise density

## From me&u
Take:
- guest menu as a consumer experience

Do not take:
- brand-heavy patterns that reduce operational consistency

---

# 23. Proposed design-token evolution

Current tokens can evolve rather than be discarded.

Token groups:

## Brand
- brand-primary
- brand-secondary
- brand-warm-surface

## Neutral surfaces
- canvas
- surface
- surface-raised
- surface-subtle
- border
- text
- text-muted

## Semantic
- success
- warning
- danger
- info
- pending

## Operational
- attention-critical
- attention-due
- realtime-live
- realtime-stale
- ticket-late

## Shape
- radius-sm
- radius-md
- radius-lg

## Elevation
- flat
- raised
- overlay

Do not encode business semantics directly into one theme color.

---

# 24. Design deliverables required before production implementation

Before coding the overhaul, create visual prototypes for at least:

1. Office Home — All Locations
2. Office Home — Branch
3. Office Catalog Items
4. Office Inventory Stock
5. Office Purchase Order Detail / Receiving
6. Office Money Transactions
7. Office Payment Detail / Reconciliation Issue
8. Office Locations / Tables
9. Office Team
10. Office Experience
11. Service Cashier
12. Service Waiter/Floor
13. Kitchen KDS
14. Guest Menu
15. Guest Bill/Pay
16. Setup Home / Readiness

Each prototype must show:
- English
- at least one Arabic/RTL example for representative surfaces
- populated state
- empty/error/attention state where critical
- real density, not placeholder marketing content

---

# 25. R11 final visual decision

Balcona keeps its warm hospitality identity, but stops making every surface look like the same premium dark dashboard.

The visual system becomes context-aware:

- **Guest:** warm and consumer-facing
- **Service:** direct and touch-operational
- **Kitchen:** high-contrast production
- **Office:** calm, dense, business-grade
- **Setup:** guided and progressive
- **Platform:** precise internal control

This is the approved design direction for the next implementation/design-prototype phase.

# R11 completion gate

R11 status: COMPLETE

R1–R11 research, audit, IA, UX-system, screen-architecture, and visual-direction phase is now complete.

No production UI has been changed in this phase.
