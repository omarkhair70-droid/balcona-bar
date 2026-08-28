# R7 — Information Architecture

Status: COMPLETE
Audit date: 2026-08-28

## Product model

Balcona is a multi-location hospitality operating system.

It is not one dashboard.

The product is divided into six intentional surfaces that share one backend and identity system:

1. **Balcona Guest** — customer cafe session
2. **Balcona Service** — front-of-house operations
3. **Balcona Kitchen** — production/KDS
4. **Balcona Office** — tenant Back Office / management
5. **Balcona Setup** — implementation/readiness project layer
6. **Balcona Platform** — Balcona internal SaaS administration

These are product surfaces, not necessarily separate deployments.

---

# 1. Balcona Guest

Audience:
- seated guest / ordering customer

Device:
- phone first

Primary mental model:
**My cafe session**

Core journey:
1. Arrive / identify table
2. Discover
3. Order
4. Track
5. Get service
6. Bill / pay
7. Receipt / finish

## Guest information architecture

### Persistent session navigation

Proposed primary destinations:
- **Menu**
- **Order**
- **Service**
- **Bill**

Home is contextual entry/state, not necessarily a permanent peer tab after the session is active.

AI is not required to remain a permanent navigation destination.

AI should be available contextually:
- recommendation entry from Menu
- conversational assistant
- cart/order help
- escalation to human

### Guest state layer

Always available contextually:
- table / cafe identity
- active order status
- cart count
- bill/payment status when relevant
- language
- help

### Guest design rule

The customer never navigates to backend concepts such as:
- payment intents
- waiter-call records
- reconciliation
- table sessions
- provider states

Those are translated into human session states.

---

# 2. Balcona Service

Audience:
- cashier
- waiter/server
- branch manager when operating on floor

Devices:
- counter terminal
- handheld
- tablet

Primary mental model:
**Run service now**

Service is role/device adaptive rather than one universal page.

## Service modules

### Floor
- live tables
- occupancy/session state
- elapsed time
- attention signals
- active bill/request state

### Orders
- incoming orders
- cashier review
- active checks/orders
- exceptions
- order detail

### Attention
- waiter calls
- computed table attention
- ready-to-serve
- escalations

### Bills & Payments
- bill requests
- present bill
- immediate payment
- payment state
- permitted recovery action

### Shift
- open shift
- cash state
- adjustment
- X report
- close checklist / Z report

## Default entry by role

Cashier:
- Orders

Waiter:
- Attention or Floor

Branch Manager:
- Floor / Operations pulse

## Device behavior

A dedicated Service terminal can be pinned to a Service mode.

Logging in with a broad-permission manager account does not automatically expose Office navigation on the operational screen.

Exit to Office is an explicit manager action.

---

# 3. Balcona Kitchen

Audience:
- kitchen
- barista
- expediter
- manager troubleshooting production

Device:
- dedicated display

Primary mental model:
**What must be prepared now**

## Kitchen IA

Primary:
- **Tickets / Production**

Context controls:
- station
- ticket layout
- all-day / grouped view where supported
- recent/recalled
- status/filter

Exceptions:
- print/routing failure
- cancellation/change
- delayed ticket

Administrative configuration is NOT primary KDS navigation.

Printer station setup, device configuration, routing configuration, and historical diagnostics belong in Office.

## Station model

Kitchen and Barista are not separate products.

A station/device can be configured as:
- kitchen prep station
- barista
- expediter
- other future production station

The workstation opens directly in its assigned context.

---

# 4. Balcona Office

Audience:
- owner
- HQ/operations manager
- branch manager
- menu/catalog admin
- inventory/procurement operator
- finance operator
- authorized team administrator

Device:
- desktop first
- tablet supported where useful

Primary mental model:
**Manage the business**

## Office global frame

Persistent top-level controls:

### A. Scope selector
Examples:
- All locations
- New Cairo
- Zamalek
- Maadi

Scope is first-class and always visible.

### B. Command / Search
Search:
- pages
- menu items
- payments
- orders
- staff
- tables
- suppliers
- purchase orders
- settings

Keyboard:
- Cmd/Ctrl + K

### C. Attention inbox
Management exceptions:
- payment mismatch
- stockout
- device offline
- unresolved attention
- launch blocker

### D. User / Account
- profile
- language
- plan & billing if authorized
- security
- logout

---

## Office primary navigation

### 1. Home

Purpose:
**What needs my attention?**

At All Locations:
- company health
- location comparison
- critical exceptions
- money health
- stock/procurement exceptions
- trend snapshot

At Branch:
- branch pulse
- operational exceptions
- current shift
- low stock
- payment issues
- device/station health

Home is not a feature directory.

---

### 2. Operations

Purpose:
**Manage restaurant operation policies and review operating state**

Sub-navigation:
- Overview
- Orders
- Service & Attention
- Shifts & Cash
- Kitchen Operations
- Smart Cashier / Automation

Operational execution itself remains in Service/Kitchen.

Office Operations is for:
- manager review
- historical/detail investigation
- settings
- exceptions
- automation rules

---

### 3. Catalog

Purpose:
**What do we sell?**

Sub-navigation:
- Menus
- Categories
- Items
- Modifiers
- Availability
- Branch Overrides
- Preview

Scope behavior:
- All Locations: shared catalog / master definitions
- Branch: effective catalog + local overrides

Do not duplicate full menus per branch when inherited/shared definitions already work.

---

### 4. Inventory

Purpose:
**What do we have and what do we need?**

Sub-navigation:
- Overview
- Stock
- Alerts
- Movements
- Requirements / Recipes
- Suppliers
- Purchase Orders
- Receiving

Purchasing is a first-class subdomain inside Inventory, not hidden at the bottom of one giant page.

If later scale demands it, Purchasing can graduate to its own top-level domain without changing the conceptual model.

---

### 5. Locations

Purpose:
**Where does the business operate?**

At company scope:
- Branches
- location health
- shared/default configuration

At branch scope:
- Profile
- Floors
- Tables
- QR
- Zones
- Devices & Stations
- Printer Stations

Active live sessions should not be treated as location configuration; they are Operations/Floor context.

---

### 6. Team

Purpose:
**Who can do what?**

Sub-navigation:
- People
- Roles & Access
- Invites
- Location Access
- Sessions / Security where appropriate

Setup may link here, but ongoing staff management belongs here.

---

### 7. Money

Purpose:
**Where is the money and is it correct?**

Sub-navigation:
- Overview
- Transactions
- Bills
- Refunds / Operations
- Settlements / Payouts
- Reconciliation
- Issues

Operational cash drawer/shift execution remains in Service.

Money is for:
- investigation
- provider state
- settlement
- financial exception handling
- export/accounting handoff

Balcona SaaS subscription billing is NOT inside Money.

---

### 8. Insights

Purpose:
**What is happening over time?**

Sub-navigation:
- Overview
- Sales
- Orders
- Items / Menu
- Operations
- Shifts / Cash
- AI / Automation
- Locations comparison
- Reports
- Activity / Audit where appropriate

The backend general Analytics + Owner Analytics should be synthesized here rather than preserving "Owner" as a product domain.

---

### 9. Experience

Purpose:
**What does the guest experience and how does Balcona behave toward them?**

Sub-navigation:
- Experience Profiles
- AI Waiter
- Content
- Media Library
- Notifications
- Zones & Triggers where experience-related

This is the likely home for currently hidden:
- ExperienceProfile
- ContentBlock
- MediaAsset
- NotificationTemplate
- presence-driven experience configuration

Venue Zones must be validated in R10 against their actual job; if primarily physical operations rather than experience triggers, they move to Locations.

---

### 10. Settings

Purpose:
**Business configuration that does not deserve daily navigation**

Sub-navigation:
- Business
- Branch Operating Settings
- Service Mode
- Feature Flags
- Integrations
- Security
- Advanced

Settings is not a dumping ground.

Every setting must state:
- scope
- owner
- consequence
- inheritance
- last changed/audit where important

---

# Account / Plan & Billing

Balcona SaaS subscription is accessed from account/organization context, not as Office primary navigation.

Contains:
- current plan
- usage
- entitlements
- warnings/blockers
- invoices/payment later when BILL-1 exists
- upgrade/contact sales

---

# 5. Balcona Setup

Audience:
- owner
- branch manager
- Balcona onboarding specialist

Primary mental model:
**Get this location live**

Setup is a project overlay across Office domains.

## Setup phases

1. Business
2. Locations
3. Menu
4. Tables & QR
5. Team
6. Kitchen / Devices
7. Payments
8. Experience
9. Operations / Automation
10. Final readiness
11. Go Live

## Setup behavior

- percentage/progress
- blockers
- prerequisites
- recommended defaults
- test links
- copy/import/template options
- explicit "Open in Office" deep links
- completion/handoff

After launch:
- Setup is no longer a top-level daily destination
- readiness remains accessible from Home/Locations/Account as needed

---

# 6. Balcona Platform

Audience:
- Balcona internal platform team

Keep separate from tenant Office.

Primary IA:
- Dashboard
- Companies
- Onboarding / Bootstrap
- Plans / Subscriptions
- System Status
- Audit / Support later

Never mix restaurant operational workspaces into Platform navigation.

---

# Scope architecture

## Company scope

Examples:
- shared menu
- company staff
- company media
- company experience defaults
- company analytics
- multi-location Money view
- plan/account

## Branch scope

Examples:
- tables
- branch overrides
- branch stock
- local supplier/PO
- cashier shift
- attention
- devices/stations
- local payment issues

## Inheritance model

Any shared/local configuration should visually state one of:

- **Company default**
- **Inherited**
- **Branch override**

Actions:
- Override for this branch
- Reset to company default

Do not silently duplicate records.

---

# Role-aware navigation

Office navigation is domain-based.

Permissions determine:
- whether destination is visible
- whether it is read-only
- whether actions appear

Role does NOT rename the information architecture.

Example:
A menu admin sees:
- Home
- Catalog
- Inventory (limited)
- Experience (limited)
- Insights (limited)

They do not see a route named "Menu Admin."

---

# Progressive disclosure

Hide or demote a domain when:
- feature is not enabled
- role lacks access
- current scope makes it irrelevant
- device is pinned to operational mode
- tenant is not multi-location
- setup is complete

Do not render disabled feature cards merely to advertise backend breadth during daily work.

---

# URL strategy guidance

R7 defines conceptual IA, not a mandatory route migration.

Implementation may preserve existing URLs behind new shells initially.

Potential future route namespaces:
- `/guest/*`
- `/service/*`
- `/kitchen/*`
- `/office/*`
- `/setup/*`
- `/platform/*`

A route migration is optional and should not be bundled with visual shell work unless necessary.

---

# R7 decisions that are now approved

1. Guest, Service, Kitchen, Office, Setup, and Platform are distinct product surfaces.
2. Staff flat navigation is retired conceptually.
3. Office uses business-domain IA, not role-named IA.
4. Company/location scope is first-class.
5. Setup is a project layer.
6. SaaS Billing moves to Account context.
7. Money becomes a first-class Office domain.
8. Team becomes a first-class Office domain.
9. Experience becomes a first-class Office domain for existing hidden capabilities.
10. Kitchen and Service are device/task workspaces, not generic dashboard pages.
11. Shared configuration should support inherited/default/override language.
12. Platform stays separate.

## R7 completion gate

R7 status: COMPLETE

Next:
R8 — Reference Synthesis.
