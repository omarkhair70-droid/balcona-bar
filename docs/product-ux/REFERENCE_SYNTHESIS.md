# R8 — Reference Synthesis

Status: COMPLETE
Audit date: 2026-08-28

## Purpose

R8 turns competitor research into explicit Balcona product decisions.

Every important IA/UX decision below records:
- Balcona problem
- external evidence/pattern
- alternatives
- chosen Balcona direction
- rejected approach
- reason

This file is the proof layer between R1 research and R7/R9 product design.

---

## D1 — Separate product surfaces

Balcona problem:
Current Staff shell mixes cashier, kitchen, waiter, owner, setup, billing, menu, inventory, and branches.

Evidence:
- Toast separates Toast Web, POS, KDS, and guest experiences.
- Lightspeed separates Back Office, Restaurant POS, KDS, and Order Anywhere.
- Square separates Dashboard, POS modes, KDS, and guest-facing flows.

Chosen Balcona direction:
- Guest
- Service
- Kitchen
- Office
- Setup
- Platform

Rejected:
One universal responsive shell for every role.

Reason:
Operational frequency, device context, and decision density are fundamentally different.

---

## D2 — Office navigation is domain-based, not role-based

Balcona problem:
Current navigation mixes role labels and business domains.

Evidence:
- Lightspeed Back Office groups by reports, menu, POS, business, hardware, operations, payments, inventory, integrations.
- Toast Web groups by management/business functions.
- Oracle scopes modules by enterprise/location context, not employee role labels.

Chosen direction:
Office domains:
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

Rejected:
Owner / Cashier / Kitchen / Waiter as peer Back Office destinations.

Reason:
Roles control access. They should not define the information architecture.

---

## D3 — Scope selector is first-class

Balcona problem:
Branch selection exists but is not the governing mental model of the product.

Evidence:
- Lightspeed uses explicit location context.
- Oracle uses enterprise/property/revenue-center scope.
- Toast multi-location management applies shared definitions with local variation.

Chosen direction:
Persistent scope selector in Office:
- All locations
- branch
- future group/region if needed

Rejected:
Branch selector buried independently inside many pages.

Reason:
Scope changes the meaning of nearly every business-domain view.

---

## D4 — Shared configuration + local overrides

Balcona problem:
Multi-location growth would become repetitive and error-prone if each branch duplicated menus/config.

Evidence:
- Toast Master Menu / location-specific versions.
- Oracle inheritance/override hierarchy.
- Square reusable modes/configuration.

Chosen direction:
Visually explicit states:
- Company default
- Inherited
- Branch override

Rejected:
Silent copies or branch-by-branch duplication.

Reason:
Balcona backend already supports branch menu overrides and company-level concepts.

---

## D5 — Setup is an orchestration layer

Balcona problem:
Setup is currently a peer navigation item.

Evidence:
- Toast setup/readiness guides combine menu, hardware, QR, payments, training, go-live.
- Lightspeed implementation/onboarding flows package configuration into guided setup.

Chosen direction:
Balcona Setup as a project/readiness center:
- progress
- blockers
- dependencies
- deep links into Office
- go-live handoff

Rejected:
Permanent Setup module at same prominence as Cashier.

Reason:
Setup frequency collapses after go-live.

---

## D6 — Guest is an end-to-end session, not a menu app

Balcona problem:
Current guest navigation undersells AI, service, bill, payment, and multi-round session capabilities.

Evidence:
- Toast Mobile Order & Pay supports tabs/group ordering and staff↔guest check continuity.
- Lightspeed Order Anywhere supports order status/history and pay-the-bill.
- me&u treats menu discovery/personalization as a consumer product.

Chosen direction:
Guest mental model:
- discover
- order
- track
- service
- bill/pay

Rejected:
Backend-shaped navigation like AI / Waiter Calls / Payment Intent.

Reason:
Guest should experience one hospitality session.

---

## D7 — AI is contextual, not necessarily a permanent top-level tab

Balcona problem:
AI Waiter exists as a separate route but menu intelligence may be more valuable during discovery.

Evidence:
- me&u embeds recommendation/personalization into browsing.
- Toast/Lightspeed guest flows emphasize task completion over chatbot destinations.

Chosen direction:
Keep conversational AI, but allow contextual AI entry inside Menu/Order/Service.

Rejected:
Forcing AI to remain isolated as a standalone destination only.

Reason:
AI should reduce friction, not add another product area to learn.

---

## D8 — KDS is a station/device workspace

Balcona problem:
Kitchen currently inherits the same Staff shell as administrative surfaces.

Evidence:
- Toast KDS uses prep/expeditor station roles.
- Square KDS routes by station/source.
- Lightspeed KDS configures named production stations.

Chosen direction:
Kitchen/Barista/Expediter are station modes on one production system.

Rejected:
Kitchen as a generic dashboard with full tenant navigation.

Reason:
Dedicated production screens require persistence, visibility, speed, and low cognitive load.

---

## D9 — Service is operational, Office is managerial

Balcona problem:
Current cashier/waiter routes and owner/admin pages coexist in one Staff product.

Evidence:
- Lightspeed explicitly separates POS users from Back Office users.
- Square POS modes are optimized for active service, Dashboard for management.

Chosen direction:
Service owns:
- floor
- orders
- attention
- bills/payments
- shift

Office owns:
- review
- history
- policies
- configuration
- analytics

Rejected:
Making operational staff navigate through Back Office to perform live work.

Reason:
Different jobs, devices, and frequency.

---

## D10 — Money becomes a first-class Office domain

Balcona problem:
Payment backend depth far exceeds visible UI.

Evidence:
- Toast has finance/payment reporting and payout/reconciliation concepts.
- Lightspeed has payments, payouts, fees, statements, transaction drill-down.
- Square separates operational payment execution from reporting/close processes.

Chosen direction:
Money:
- Overview
- Transactions
- Bills
- Refunds/Operations
- Settlements/Payouts
- Reconciliation
- Issues

Rejected:
Keeping all payment complexity inside Cashier or Owner dashboards.

Reason:
Financial investigation is a distinct management job.

---

## D11 — Balcona SaaS Billing is account-level, not Money

Balcona problem:
Current `/staff/billing` sits beside restaurant operations.

Evidence:
Comparable platforms separate merchant/business subscription/account management from guest transaction processing.

Chosen direction:
Account → Plan & Billing

Rejected:
Money → Balcona Subscription

Reason:
One is the restaurant's customer money; the other is the restaurant's relationship with Balcona.

---

## D12 — Inventory and procurement are workflows, not CRUD

Balcona problem:
One giant Inventory route contains stock, suppliers, POs, receiving, requirements, movements.

Evidence:
- Restaurant365 purchasing/receiving is workflow-oriented.
- MarketMan treats purchasing, delivery, discrepancies, and stock as connected work.

Chosen direction:
Inventory domain with clear sub-navigation:
- Stock
- Alerts
- Movements
- Requirements
- Suppliers
- Purchase Orders
- Receiving

Rejected:
One mega-page with all forms visible together.

Reason:
The backend already has real lifecycle state across these concepts.

---

## D13 — Home is attention/decision oriented

Balcona problem:
Current Staff Overview acts as a feature directory.

Evidence:
- Toast reporting dashboard is high-level and directs deeper investigation elsewhere.
- Restaurant operational dashboards prioritize business health and exceptions.

Chosen direction:
Home answers:
- what needs attention
- what changed
- where to drill next

Rejected:
Grid of feature cards.

Reason:
A mature OS should reduce navigation burden, not advertise its modules.

---

## D14 — Close-of-day is a workflow

Balcona problem:
Cashier shift/report features exist but are compressed into a general cashier screen.

Evidence:
- Square close-of-day is a guided checklist with blockers.
- Lightspeed POS reports/shift concepts distinguish live operation from close activities.

Chosen direction:
Shift close checklist:
- open orders
- unpaid bills
- cash variance
- required reports
- close confirmation

Rejected:
Only exposing X/Z report buttons.

Reason:
Closing the day is an operational process, not just report generation.

---

## D15 — Devices / printer stations need administration outside live Kitchen

Balcona problem:
PrinterStation backend exists; print-job exceptions are mixed with live production.

Evidence:
- Square/Toast/Lightspeed separate device/station setup from KDS operation.

Chosen direction:
Office → Locations → Devices & Stations
Kitchen keeps only live print/routing exceptions relevant to production.

Rejected:
All printer configuration inside KDS.

Reason:
Configuration is low-frequency and manager-owned.

---

## D16 — Team becomes an ongoing Back Office domain

Balcona problem:
Staff management is mostly represented through setup/invites.

Evidence:
- Lightspeed distinguishes POS users, Back Office users, roles/groups.
- Enterprise restaurant products treat people/access as ongoing administration.

Chosen direction:
Team:
- People
- Roles & Access
- Invites
- Location access
- Security/sessions

Rejected:
Staff administration only during onboarding.

Reason:
Access changes after go-live are normal and security-sensitive.

---

## D17 — Experience becomes a real management domain

Balcona problem:
Experience profiles, content, media, templates, and presence-related capabilities are hidden.

Evidence:
- Guest-experience platforms treat presentation, personalization, content, and engagement as configurable product areas.
- Balcona already has backend primitives that justify a coherent surface.

Chosen direction:
Experience:
- Profiles
- AI Waiter
- Content
- Media
- Notifications
- contextual triggers/zones where appropriate

Rejected:
Scattering each capability into unrelated Settings pages.

Reason:
These capabilities collectively shape what the guest experiences.

---

## D18 — Search / command navigation is required for large Office

Balcona problem:
Back Office will have many low-frequency pages.

Evidence:
- Lightspeed supports quick navigation/search in a growing Back Office.
- Mature SaaS products use command/search to reduce deep-menu dependence.

Chosen direction:
Cmd/Ctrl+K for pages/entities/actions where safe.

Rejected:
Making every low-frequency task permanently visible in side navigation.

Reason:
R6 shows many configuration jobs are infrequent but still important.

---

## D19 — Detail panels are a valid existing Balcona pattern

Balcona problem:
Need focused action without losing queue/list context.

Evidence:
- Current Balcona already uses detail panels for cashier, kitchen, waiter, attention, and menu item detail.

Chosen direction:
Preserve and standardize list/queue → detail panel pattern where it supports fast operations.

Rejected:
Converting every detail into a separate route.

Reason:
This is one of the current UX patterns that already matches high-frequency work.

---

## D20 — Destructive actions need a standard confirmation system

Balcona problem:
Some current routes use browser-native confirm; no shared dialog standard was found.

Evidence:
Enterprise/admin products consistently differentiate reversible edits from destructive financial/configuration changes.

Chosen direction:
R9 standard:
- consequence text
- affected scope
- typed confirmation only for high-risk cases
- audit reason where needed
- clear cancel/default

Rejected:
Browser `window.confirm` for product-critical administration.

Reason:
Inconsistent confirmations are risky in multi-location and finance operations.

---

# What we intentionally do NOT copy

## From Toast
- proprietary visual language
- any exact navigation labels that do not fit Balcona
- unnecessary hardware-specific assumptions

## From Lightspeed
- exact information hierarchy
- product-specific legacy terminology
- all Back Office breadth regardless of Balcona capability

## From Square
- generic Square ecosystem IA
- over-generalized mode concepts where Balcona does not need them

## From Oracle Simphony
- legacy enterprise desktop density
- deep hierarchy jargon
- complexity optimized for very large hospitality groups by default

## From specialist inventory tools
- accounting/COGS complexity not supported by Balcona backend
- vendor-specific finance workflows

# R8 completion gate

R8 status: COMPLETE

All major approved R7 decisions now have documented research rationale and explicit non-copy rules.

Next:
R9 — UX System.
