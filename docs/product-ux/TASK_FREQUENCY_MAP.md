# R6 — Task / Frequency Map

Status: COMPLETE
Audit date: 2026-08-28

## Why frequency matters

Balcona currently gives several low-frequency administrative areas the same navigational weight as minute-by-minute operational work.

R6 assigns product jobs to frequency/context bands. This is used by R7 to determine:
- default landing surfaces
- persistent navigation
- secondary navigation
- command/search access
- setup-only access
- exception drawers/inboxes
- advanced settings

---

## F0 — Continuous / live state

These are not "pages to visit." They are live operating signals.

- new orders
- preparation ticket age
- waiter calls
- table attention
- ready-to-serve
- payment pending/unknown during checkout
- realtime availability/sold-out changes
- print/KDS delivery failures
- current shift/drawer state

UX treatment:
- realtime badges/queues
- attention counts
- timers
- prominent exception state
- no deep navigation required to notice them

---

## F1 — Every minute / many times per shift

### Cashier
- review new order
- accept/reject
- open check/order
- present bill
- record payment
- resolve immediate payment ambiguity
- respond to bill request

### Waiter
- acknowledge request
- serve ready order
- resolve attention item
- inspect table/session

### Kitchen / Barista
- read ticket
- start item/task
- mark ready
- react to cancellation/change
- prioritize queue

### Guest
- browse
- customize
- add to cart
- order
- track status
- request service
- reorder
- bill/pay

UX treatment:
- dedicated operational workspace
- minimal chrome
- large direct actions
- context preserved
- keyboard/touch shortcuts where appropriate
- no unrelated admin navigation

---

## F2 — Every shift

### Cashier / branch operations
- open shift
- confirm opening float
- cash adjustment
- X report
- shift handoff
- close shift / Z report

### Branch manager
- review unavailable items
- review staffing/access for shift
- review device/printer health
- check payment exceptions
- check open orders/tables before close
- review critical stock alerts

UX treatment:
- shift checklist / branch pulse
- contextual actions from Home/Operations
- not top-level global navigation items by themselves

---

## F3 — Daily

### Branch manager
- daily sales/operations summary
- unresolved attention/incidents
- low stock/out of stock
- cash/drawer variance
- payment/reconciliation exceptions
- staff operational issues
- print/device issues

### Owner
- company/branch health
- sales trend
- orders/throughput
- payment health
- high-severity stock/operational issues

### Procurement
- purchase needs
- supplier orders
- receiving deliveries

UX treatment:
- Home surfaces should prioritize these
- exception-first
- "things needing attention" above feature cards

---

## F4 — Weekly / periodic operations

- compare branch performance
- product mix/menu analytics
- menu availability review
- inventory counting
- purchasing/vendor review
- cost/price review
- reconciliation/payout review
- audit/activity review
- AI/automation performance review
- team access review

UX treatment:
- Back Office domains
- reports with saved filters
- data tables
- export
- cross-location scope
- not operational device navigation

---

## F5 — Configuration / occasional maintenance

- create/edit menu item/category/modifiers
- update branch-specific prices/availability
- create/edit supplier
- update recipe/inventory requirements
- edit floor/table
- regenerate QR
- configure Smart Cashier rules
- configure branch operating/service mode
- configure feature flags
- configure experience/content
- manage media assets
- configure notification templates
- configure venue zones
- configure printer stations/devices
- manage staff roles/access
- update plan/account settings

UX treatment:
- structured Back Office
- grouped by domain
- searchable via command/search
- progressive disclosure
- strong audit/context
- clear company vs branch scope

---

## F6 — Setup once / branch launch

- create company
- first branch
- choose service model
- import/build menu
- create floors/tables
- generate QR set
- invite initial staff
- configure stations/devices
- configure payments
- set experience/branding
- set automation defaults
- readiness validation
- end-to-end test
- go live

UX treatment:
- Setup/Launch project center
- progress
- dependencies
- blockers
- recommended defaults
- import/copy/template paths
- disappears from primary daily navigation after completion

---

## F7 — Rare exception / recovery

- refund
- void/capture edge cases
- recover unknown payment
- acknowledge/resolve reconciliation mismatch
- emergency table/session close
- printer failure retry/admin troubleshooting
- audit investigation
- security/access incident
- subscription suspension/reactivation
- destructive branch/table/item archive
- QR regeneration after compromise/damage

UX treatment:
- not primary navigation
- reachable from affected object/detail
- permission-gated
- explicit consequence/confirmation
- audit trail
- recovery status and retry safety

---

# Frequency map by product domain

| Domain | F1 live | F2 shift | F3 daily | F4 weekly | F5 config | F6 setup | F7 exception |
|---|---:|---:|---:|---:|---:|---:|---:|
| Guest | high | - | - | - | - | - | payment/order recovery |
| Orders/Cashier | high | high | medium | low | low | test flow | high |
| Service/Attention | high | medium | medium | low | low | test flow | medium |
| Kitchen | high | medium | medium | low | station config | setup | high |
| Menu/Catalog | low | low | medium | high | high | high | archive/override |
| Inventory | low | medium | high | high | high | medium | adjustment |
| Purchasing | low | low | high | high | medium | medium | cancel/discrepancy |
| Money | payment state | shift cash | high | high | provider settings | high | very high |
| Locations | low | low | low | medium | high | high | deactivate/regenerate |
| Team | low | medium | medium | medium | high | high | revoke access |
| Experience | guest runtime | - | low | medium | high | high | rollback |
| Automation | runtime | medium | medium | high | high | medium | disable/recover |
| Analytics | low | shift report | daily | high | saved config | - | investigation |
| SaaS account | - | - | low | low | medium | initial plan | suspension |
| Platform | - | - | daily internal | periodic | high internal | high | support incident |

---

# Navigation consequences for R7

1. F1 work gets dedicated workspaces, not Back Office pages.
2. F2/F3 exceptions belong on role-aware Home/Operations.
3. F4/F5 tasks belong in domain-grouped Office navigation.
4. F6 Setup is an orchestration layer, not a permanent sibling of Cashier.
5. F7 actions live in object detail / issue inbox with strong permissions and confirmation.
6. Search/command navigation is justified for F5 because those tasks are broad but infrequent.
7. Owner Home should summarize F3, not expose every F5 module as cards.
8. Guest navigation should follow the meal/session journey, not backend domains.

## R6 completion gate

R6 status: COMPLETE

Next:
R7 — Information Architecture.
