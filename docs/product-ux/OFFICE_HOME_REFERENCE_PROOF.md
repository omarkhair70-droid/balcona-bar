# Office Home — All Locations Reference Proof

Status: LOCKED FOR FIRST PROTOTYPE
Date: 2026-08-28

## Purpose

Define the first Balcona Office screen from product evidence before visual implementation.

This is not a generic restaurant dashboard.

## Reference stack

### Lightspeed Restaurant Back Office
Take:
- restrained business-domain shell
- dense management canvas
- navigation hierarchy
- functional, low-decoration structure

### Toast Web / Toast Now multi-location
Take:
- high-level overview first
- location-aware management
- KPI → drill-down
- only a few summary measures before deeper reporting

### Oracle Simphony
Take:
- scope hierarchy discipline
- All Locations vs one location
- explicit scope before configuration/analysis

### Balcona
Use only real capabilities:
- owner analytics
- orders
- shifts/cash
- inventory alerts
- attention
- payment/reconciliation
- AI/Smart Cashier
- branch state
- setup/readiness
- device/print exceptions where data exists

## Explicitly excluded

Do not show unless backend support is verified:
- reservations
- labor cost
- guest CRM
- loyalty
- net profit
- customer count
- table occupancy aggregate across branches if not supported
- generic health score
- fake forecasts
- arbitrary Quick Actions
- marketing cards

## Screen job

When an owner/operations manager opens Balcona at **All Locations**, answer:

1. Is the company operating normally?
2. Which location needs me?
3. Is money correct?
4. Is anything blocked by stock?
5. Are service/kitchen operations falling behind?
6. What changed enough to investigate?

The page should be useful in roughly 10–20 seconds.

---

# Layout grammar

## A. Global Office frame

Left:
- Balcona wordmark/product
- Home
- Operations
- Catalog
- Inventory
- Locations
- Team
- Money
- Insights
- Experience
- Settings

Top:
- scope selector: **All Locations**
- search / Cmd+K
- attention inbox
- language/account

No huge hero.

Page header:
- `Home`
- concise date/time context
- optional comparison/date filter

---

## B. Critical attention strip

First visible content.

Show only if non-empty.

Possible Balcona-supported issue types:
- reconciliation mismatch
- payment needs review
- out-of-stock affecting menu
- delayed kitchen/service attention
- open/abnormal shift
- printer/device operational failure where available
- launch blocker for a location not live

Each item:
- severity
- branch
- plain-language problem
- age/date
- direct destination

If there is no critical issue:
small healthy state, not an empty decorative card.

---

## C. Company pulse

Maximum 3–4 measures.

Candidate measures only if current owner analytics supports them:
- collected sales/revenue
- orders
- average order value
- payment status/collection signal

Rules:
- no KPI card for every backend module
- no fake Net Profit
- each metric opens its report/domain
- comparison period is explicit

Visual:
one compact horizontal metric band, not four floating gradient cards.

---

## D. Locations comparison

This is the center of All Locations Home.

Preferred form:
dense ranked table/list rather than donut chart.

Columns:
- Location
- Sales / collected amount if available
- Orders
- operational attention count
- stock alerts
- payment issues
- current status/readiness

Row click:
enter branch scope.

Why:
Owner needs to know **which branch** needs attention, not admire a chart.

---

## E. Money health

Compact exception-led panel.

Show:
- pending/unknown online payments
- reconciliation open issues
- latest settlement/reconciliation status where supported

Primary action:
Open Money

Do not show:
technical provider details at Home level.

---

## F. Operations health

Show cross-location exceptions, for example:
- delayed preparation
- unresolved waiter/table attention
- branch with abnormal shift state
- high rejection/review load if Smart Cashier data supports it

Primary action:
Open Operations / branch.

---

## G. Stock & procurement health

Show:
- branches with out-of-stock items
- menu items blocked by stock
- low-stock severity
- pending PO/receiving signal only if query support is practical

Primary action:
Open Inventory.

---

## H. Trend

One chart maximum on Home.

Preferred:
sales/collected revenue over time, if data supports the selected scope.

Reason:
gives owner direction without turning Home into Reports.

All other analytics belong in Insights.

---

## I. Recent meaningful activity

Optional low-priority section.

Only meaningful events:
- significant setting change
- payment issue resolved
- branch activated/deactivated
- high-impact inventory movement
- automation rule changed

Do not use raw realtime feed as a social-style activity list.

Audit/Activity owns full history.

---

# Visual composition rules

## Canvas
Office-first neutral canvas.

Test direction:
- warm off-white / low-chroma neutral main canvas
- dark/bronze Balcona identity in nav/brand accents
- no purple SaaS gradient
- no blue-default admin template feel

## Sidebar
- narrow but readable
- domain labels
- active state quiet and obvious
- no permanent Shortcut section unless R6 proves a repeated job

## Typography
- compact page titles
- tabular numbers
- readable Arabic
- strong row hierarchy

## Cards
- use panels for exceptions/grouped summaries
- tables/lists for comparable branch data
- avoid grid of equal-weight cards

## Status
- text + semantic icon/color
- pending/unknown is distinct from failure

## Density
Professional Back Office density.
The page should feel materially more information-efficient than the current Staff shell.

---

# Arabic / RTL proof

The prototype must include an Arabic state before approval.

Examples:
- كل الفروع
- الرئيسية
- العمليات
- المخزون
- المدفوعات
- يحتاج مراجعة
- نفد من المخزون

RTL requirements:
- sidebar may mirror to the right in full RTL layout
- scope/search/actions mirror logically
- numeric values remain stable/readable
- branch table column order is intentionally RTL, not browser-flipped accidentally

---

# State proof required

Prototype must show at least:

## Populated / normal
- multiple branches
- a few noncritical issues

## Critical attention
- payment/reconciliation issue
- stock issue
- operations delay

## Healthy
- no critical attention

## Partial error
Example:
Money panel failed to load while Home and Locations remain available.

Do not block the entire Home for one failed domain request.

---

# Prototype acceptance test

The first Office Home prototype passes only if:

1. It looks like Balcona, not a generic SaaS dashboard.
2. Every visible data point maps to real Balcona capability.
3. All Locations is visually the governing scope.
4. The owner can identify the worst branch quickly.
5. Attention is more prominent than decorative KPIs.
6. Money problems are visible without exposing provider internals.
7. Inventory/operations issues are visible without turning Home into their full modules.
8. No fake feature exists for visual balance.
9. Arabic/RTL works.
10. The same shell can plausibly host Catalog, Inventory, Money, and Team.

After this proof is approved, build the prototype in code/design tooling. Do not generate another standalone dashboard image as the source of truth.
