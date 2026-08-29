# R1 — Competitive Reference Matrix

Status: IN PROGRESS
Research date: 2026-08-28

This file records product/UX evidence, not marketing inspiration. Official support/product documentation is preferred. Screenshots may be used as visual evidence, but decisions must be anchored to observable workflow behavior.

## Reference set — Batch 1

### Toast

Official evidence:
- Mobile Order & Pay setup: https://support.toasttab.com/en/article/Setting-Up-Toast-Mobile-Order-and-Pay
- Mobile Order & Pay overview: https://support.toasttab.com/en/article/Mobile-Order-and-Pay-Overview
- POS order screens: https://support.toasttab.com/en/article/New-POS-Experience-Ordering-Screens
- KDS setup: https://support.toasttab.com/en/article/Get-Started-With-the-Kitchen-Display-System
- Mobile payments and digital menus: https://support.toasttab.com/en/article/Setting-up-mobile-payments-and-digital-menus

Observed patterns:
- Guest QR ordering is configured through an explicit setup wizard, not scattered settings.
- Guest experience supports distinct service models such as Tabs and Pay-as-you-go.
- Table QR, menu visibility, kitchen routing, tips, staff training, and go-live are treated as one implementation journey.
- POS ordering is a dedicated operational experience.
- KDS is a device mode/workspace with prep-station or expediter responsibility.
- Guest ordering can share a continuous restaurant check/tab with staff-led service.

Balcona relevance:
- Strong reference for onboarding orchestration, guest↔staff continuity, and KDS separation.
- Do not copy Toast visual styling; use the workflow separation principle.

### Lightspeed Restaurant K-Series

Official evidence:
- Back Office introduction: https://k-series-support.lightspeedhq.com/hc/en-us/articles/360054950934-Introduction-to-the-Back-Office
- Back Office navigation changes: https://k-series-support.lightspeedhq.com/hc/en-us/articles/36985562334363-About-Back-Office-navigation-changes
- New POS navigation: https://k-series-support.lightspeedhq.com/hc/en-us/articles/43162671781659-About-the-new-POS-navigation
- Order Anywhere guest flow: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260803553189-Placing-orders-using-Order-Anywhere
- Order Anywhere service profiles: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260803546769-Creating-Order-Anywhere-service-profiles

Observed patterns:
- Back Office is explicitly separate from the Restaurant POS app.
- Back Office navigation is grouped by business domain rather than employee role.
- Lightspeed recently reorganized navigation to reduce menu depth and group related pages.
- POS navigation is optimized separately for order-entry screen space and device ergonomics.
- Guest table QR supports browse, modifiers, cart, online/in-person payment, order status/history, pay-the-bill, and bill splitting by amount or item.
- Service profiles package guest ordering behavior rather than exposing every setting independently.

Balcona relevance:
- Primary reference for IA separation, domain-grouped Back Office, and service-profile concepts.
- Strong guest-flow reference for bill/payment continuation after ordering.

### Square for Restaurants

Official evidence:
- Restaurant POS setup and device modes: https://squareup.com/help/us/en/article/6390-set-up-your-point-of-sale-with-square-for-restaurants
- POS modes: https://squareup.com/help/us/en/article/8458-use-modes-with-square-point-of-sale
- Table management: https://squareup.com/help/us/en/article/8146-customize-table-management-settings
- Floor plans: https://squareup.com/help/us/en/article/6427-building-your-floor-plan
- Menu management: https://squareup.com/help/us/en/article/6424-create-menus-with-square-for-restaurants
- KDS routing: https://squareup.com/help/us/en/article/7959-route-orders-with-your-kds

Observed patterns:
- Device configuration uses reusable Modes and service-specific templates.
- Restaurant modes differ by service model such as full service, quick service, and bar.
- Floor plans are operational state surfaces: occupancy, elapsed-time indicators, sections, merging.
- Menu is a central channel-aware catalog, not only a POS item list.
- KDS has independent routing/configuration based on order source and device role.
- Multiple devices can inherit a mode so configuration changes apply consistently.

Balcona relevance:
- Primary reference for device identity/mode, floor/table operations, and reusable configuration.
- Useful for deciding whether Balcona should treat kitchen/cashier screens as device workspaces rather than generic staff pages.

### Oracle MICROS Simphony

Official evidence:
- EMC basics: https://docs.oracle.com/en/industries/food-beverage/simphony/simgi/c_emc_basics.htm
- Enterprise hierarchy: https://docs.oracle.com/en/industries/food-beverage/simphony/19.3/simcg/c_enterprise.htm
- Inheritance and overrides: https://docs.oracle.com/en/industries/food-beverage/simphony/19.3/simcg/c_enterprise_inheritance_overrides.htm
- Zones: https://docs.oracle.com/en/industries/food-beverage/simphony/19.8/simcg/c_zones.htm

Observed patterns:
- Enterprise configuration is explicitly hierarchical: Enterprise → Property → Revenue Center, with Zones for custom grouping.
- Modules are scoped to hierarchy level; role controls access to levels/modules.
- Higher-level configuration can be inherited and selectively overridden lower in the hierarchy.
- The management UI filters modules by the selected location/scope.
- Table view is optimized for bulk changes; form view for one record.

Balcona relevance:
- Architecture reference for multi-location inheritance, scope selection, and enterprise configuration.
- Do not imitate EMC's visual density or legacy desktop interaction model.

### TouchBistro

Official evidence:
- Multi-unit restaurant platform: https://www.touchbistro.com/pos-solutions/multi-unit-pos/

Observed patterns:
- Product is communicated and organized around front-of-house, back-of-house, and guest engagement capabilities.
- Multi-unit operations centralize menus and performance across locations while preserving per-location operation.
- KDS/inventory/labor/profit-management are treated as back-of-house capabilities, not peer navigation items with cashier.

Balcona relevance:
- Useful product mental-model reference; lower evidence depth than Toast/Lightspeed/Square docs, so not sufficient alone for screen decisions.

### me&u

Official evidence:
- Order & Pay: https://www.meandu.com/serve/order-pay

Observed patterns:
- Guest menu is treated as a consumer product, not a database renderer.
- Personalization includes For You, Trending Items, taste sorting, intelligent upsells, photography, translation, loyalty/CRM continuity.

Balcona relevance:
- Key reference for the Guest Cafe Experience and how AI/menu intelligence can live inside browsing instead of being isolated as a separate chatbot-only surface.
- Marketing claims are not implementation proof; use only observable product concepts until deeper screen evidence is collected.

## Cross-reference findings — Batch 1

### Finding A — One product needs multiple surfaces
Toast, Lightspeed, Square, and Simphony all separate management/configuration from high-frequency operational work. Balcona should not assume one Staff shell is the correct container for cashier, kitchen, waiter, owner, setup, billing, and branch administration.

### Finding B — Role is not an information architecture category
Competitors group Back Office primarily by business domain and scope. Employee roles control access to workspaces and actions; they are not generally sibling navigation modules such as Owner / Kitchen / Waiter.

### Finding C — Device context matters
KDS and POS behavior is attached to device/workspace modes in Toast/Square and separately configured in Lightspeed. Balcona should evaluate a device/workspace model for persistent kitchen, barista, cashier, and service terminals.

### Finding D — Location scope must be a first-class control
Multi-location systems place business/location hierarchy above or beside feature navigation. Balcona must audit whether company/branch selection is globally understandable and whether configuration can eventually inherit/override safely.

### Finding E — Guest is a flagship product surface
Guest QR products support much more than menu→cart: order status, repeat rounds, group ordering, pay-later/pay-now models, bill settlement, splitting, receipts, and personalization. Balcona's guest surface must be audited as an end-to-end cafe session.

### Finding F — Setup is a journey
Toast and Lightspeed onboarding evidence supports setup as a guided path across menu, hardware/device, QR, routing, payment, training, and go-live. Balcona's current Setup capability should be evaluated as an orchestration layer rather than a permanent sibling of daily operational navigation.

### Finding G — Configuration should be reusable
Square Modes and Oracle inheritance/overrides both address repeated configuration at scale. Balcona must audit copy/clone/inheritance needs before designing multi-location administration.

## Provisional product surfaces to test — not final IA

These are research hypotheses only and MUST NOT be treated as final navigation until R2-R6 are complete:

1. Guest Cafe Experience
2. Service / POS / Cashier
3. Kitchen / Barista KDS
4. Office / Management
5. Multi-location HQ
6. Setup / Implementation
7. Balcona Platform Admin

## Next R1 research batches

- deeper Toast Web/Home/Reports/Payments/Menu Builder navigation
- Lightspeed Inventory, Payments, Reports, location selector, user separation
- Square Dashboard, team permissions, close-of-day, payments/refunds
- KDS visual behavior across Toast/Square/Lightspeed/TouchBistro
- guest UX screenshots and edge cases across Toast/Lightspeed/me&u
- restaurant inventory/procurement leaders (MarginEdge, MarketMan or equivalent) as specialist references
- enterprise payments/reconciliation UX
- reservations/waitlist only if Balcona's existing backend or near-term scope justifies it

## R1 completion gate

R1 is not complete until each research track in the master plan has:
- at least two credible references where available
- current official evidence
- Balcona relevance notes
- anti-patterns / what not to copy
- enough evidence to support R7/R8 decisions later


## Reference set — Batch 2

### Toast — finance / reconciliation

Official evidence:
- Payments reports overview: https://support.toasttab.com/en/article/Finance-Reports

Observed patterns:
- Finance is its own reporting domain, not a generic analytics card.
- Toast separates payment activity, deposits/payouts, reconciliation, chargebacks, billing activity, and cost breakdown.
- This supports the idea that Balcona's Money surface should own settlement/reconciliation rather than burying them inside a cashier page.

Balcona relevance:
- Strong evidence for a dedicated Money/Finance workspace with operational drill-down and reconciliation states.

### Lightspeed — users, reports, payments

Official evidence:
- POS users and user groups: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804594570-About-users-and-user-groups
- Back Office users: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804647149-Managing-Back-Office-users
- Reports overview: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804657209-About-Reports
- Payments report: https://k-series-support.lightspeedhq.com/hc/en-us/articles/4403189404699-Payments-report
- POS reports: https://k-series-support.lightspeedhq.com/hc/en-us/articles/360050328874-About-POS-reports

Observed patterns:
- POS users and Back Office users are distinct concepts with distinct permission surfaces.
- POS users are optimized for day-to-day floor responsibilities; Back Office access is separately granted.
- Reporting exists at multiple contexts: quick operational reports at POS and deeper analysis in Back Office.
- Payments reporting exposes transaction-level fields such as user, device, amount, method, and destination.
- Drawer, shift, user, and fiscal reports are related but remain distinct operational/accounting concepts.

Balcona relevance:
- Strong evidence against one universal staff navigation.
- Supports separating employee identity/permissions from workspace access and exposing shift/drawer reports near operations while keeping deeper finance in Back Office.

### Square — close of day and service modes

Official evidence:
- Close of day report: https://squareup.com/help/us/en/article/6594-end-of-day-reporting-with-square-for-restaurants
- Restaurant POS setup/modes: https://squareup.com/help/us/en/article/6390-set-up-your-point-of-sale-with-square-for-restaurants
- Table management: https://squareup.com/help/us/en/article/8146-customize-table-management-settings

Observed patterns:
- Close of day is a guided operational procedure with configurable completion requirements.
- Device modes can encode service style and operational settings once and apply them across devices.
- Table state communicates time/attention directly in the floor plan.

Balcona relevance:
- Reference for shift-close orchestration, readiness gates, and operational attention design.
- Suggests Balcona should not rely only on passive reports where an explicit close workflow is required.

### Restaurant365 — purchasing / receiving specialist reference

Official evidence:
- Purchasing & Receiving: https://www.restaurant365.com/inventory/purchasing-receiving/

Observed patterns:
- Purchasing is treated as a workflow: demand/order → vendor → receiving → discrepancy/credit → inventory/financial impact.
- Receiving accuracy and invoice discrepancy handling are first-class concepts.

Balcona relevance:
- Specialist reference for evaluating whether existing suppliers/purchase-order/receiving backend capabilities are represented as a coherent procurement workflow instead of isolated inventory forms.

### MarketMan — procurement specialist reference

Official evidence:
- Purchasing & order management: https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management

Observed patterns:
- Vendor-centric purchasing, fill-to-par ordering, PO submission, receiving, substitutions/shortages/credits, and real-time price tracking are one workflow family.
- Mobile receiving and exception handling are emphasized over raw CRUD.

Balcona relevance:
- Reference for R2/R4 review of suppliers, POs, stock-in, and receiving screens.
- Do not copy vendor-specific accounting complexity before checking Balcona's actual backend scope.

## Cross-reference findings — Batch 2

### Finding H — Money needs two contexts
Operational payment/shift tasks belong near the restaurant workflow, while payouts, settlement, reconciliation, and finance investigation belong in management/back office. Balcona should test a split between operational tender handling and Money/Finance administration rather than flattening all payment features together.

### Finding I — Reports should match the decision context
Competitors expose quick shift/day reports at POS and deeper historical/multi-location analysis in Back Office. One generic Owner dashboard is unlikely to be enough for Balcona's current analytics, shifts, drawers, payments, and reconciliation backend.

### Finding J — Permissions should control surfaces, not define the whole IA
Lightspeed's explicit separation of POS and Back Office users reinforces that role/access is an authorization layer over task-specific products. Balcona's current role-named destinations must be audited for whether they are truly workspaces or merely permission shortcuts.

### Finding K — Inventory CRUD is not procurement UX
Specialist restaurant inventory products organize purchasing around vendor/order/receiving/exceptions. Balcona's existing supplier and purchase-order capabilities must be audited as an end-to-end job before visual redesign.

### Finding L — Close-of-day is a workflow, not just a report
Square and Lightspeed both show that shift/day closure has operational steps and permissions. Balcona's cashier shifts, drawer movements, X/Z reports, and payment state should be mapped as a close workflow during R2-R6.


## Reference set — Batch 3

### Toast — Back Office / analytics / multi-location / guest continuity

Verified official evidence:
- Analytics & reports overview: https://support.toasttab.com/en/article/Getting-Started-with-Analytics-and-Reports
- Reporting dashboard: https://support.toasttab.com/en/article/How-to-Use-the-Toast-Reporting-Dashboard
- Mobile Order & Pay setup: https://support.toasttab.com/en/article/Setting-Up-Toast-Mobile-Order-and-Pay
- Guest experience: https://support.toasttab.com/en/article/Guest-Experience-for-Toast-Mobile-Order-Pay
- Multilocation management: https://support.toasttab.com/en/article/Getting-Started-Master-Menu-Management
- Cross-location menu management: https://support.toasttab.com/en/article/Copying-Menus-to-Other-Locations-Using-Multi-Location-Management
- Location-specific pricing: https://support.toasttab.com/en/article/Location-Specific-Pricing-Master-Menu-Management-1492786563831

Observed patterns:
- Toast Web reports are grouped into business domains rather than one giant dashboard.
- Dashboard overview is deliberately small and high-level; deeper questions live in reports.
- Guest tabs can continue across guest and server surfaces: guests can reorder/pay from phone while staff can add to the same check.
- Group ordering is a first-class guest behavior.
- Multi-location configuration is shared centrally, with location-specific versions/overrides where required.
- Location-specific pricing is permission-aware rather than duplicating the entire menu.

Balcona relevance:
- Strong proof for separating overview from investigation.
- Strong proof for treating guest session, table check, staff service, and payment as one continuous hospitality session.
- Strong proof for central definitions + local overrides rather than branch-by-branch duplication.

### Lightspeed — Back Office / POS / KDS / permissions / money

Verified official evidence:
- Back Office introduction: https://k-series-support.lightspeedhq.com/hc/en-us/articles/360054950934-Introduction-to-the-Back-Office
- Navigation redesign: https://k-series-support.lightspeedhq.com/hc/en-us/articles/36985562334363-About-Back-Office-navigation-changes
- POS and Back Office user separation: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804594570-About-users-and-user-groups
- New POS navigation: https://k-series-support.lightspeedhq.com/hc/en-us/articles/43162671781659-About-the-new-POS-navigation
- KDS 2.0: https://k-series-support.lightspeedhq.com/hc/en-us/articles/22168531609499-Setting-up-Kitchen-Display-System-2-0
- Guest Order Anywhere: https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260803553189-Placing-orders-using-Order-Anywhere
- Payments report: https://k-series-support.lightspeedhq.com/hc/en-us/articles/4403189404699-Payments-report
- Lightspeed Payments reporting: https://k-series-support.lightspeedhq.com/hc/en-us/articles/20584722767387-Reporting-with-Lightspeed-Payments

Observed patterns:
- Lightspeed explicitly redesigned Back Office navigation after product growth to reduce depth and group features by business relation.
- POS users are not automatically Back Office users.
- KDS screens are configured as named service stations such as Grill, Cold Service, or Bar, with routing to each station.
- Financial Services has its own overview, transactions, payouts, fees, statements, and detail drill-down.
- Guest Order Anywhere includes status/history and distinguishes failed orders/payments so users are not left unsure.

Balcona relevance:
- Primary evidence for separating Balcona Office from operational workspaces.
- Strong evidence for station/device identity in Kitchen/Barista UX.
- Strong evidence for a dedicated Money area rather than burying provider state in cashier screens.
- Strong evidence that failure/unknown payment states require explicit customer-facing history and status.

### Square — service mode / floor operations / close workflow / KDS

Verified official evidence:
- Restaurant POS setup: https://squareup.com/help/us/en/article/6390-set-up-your-point-of-sale-with-square-for-restaurants
- Floor plans: https://squareup.com/help/us/en/article/6427-building-your-floor-plan
- Table management: https://squareup.com/help/us/en/article/8146-customize-table-management-settings
- KDS routing: https://squareup.com/help/us/en/article/7959-route-orders-with-your-kds
- Coursing: https://squareup.com/help/us/en/article/7748-coursing-with-square-kds
- Close of day: https://squareup.com/help/us/en/article/6594-end-of-day-reporting-with-square-for-restaurants

Observed patterns:
- Restaurant operation changes by mode: table service, counter service, bar/lounge.
- Floor plans are live operational views with occupied state, elapsed-time attention indicators, sections, and table merging.
- KDS routing is based on categories/order sources/station responsibility.
- Coursing spans POS and KDS rather than being owned by one page.
- Close of day is an executable checklist with blockers and explicit override authority.

Balcona relevance:
- Strong proof that service model should influence workspace defaults.
- Strong reference for making table attention spatial and time-aware.
- Strong reference for turning shift/day close into a guided workflow rather than only exposing reports.

### Oracle Simphony — scope / hierarchy / roles

Verified official evidence:
- EMC overview: https://docs.oracle.com/en/industries/food-beverage/simphony/simcg/c_emc_basics.htm
- Enterprise hierarchy: https://docs.oracle.com/en/industries/food-beverage/simphony/19.3/simcg/c_enterprise.htm
- Inheritance & overrides: https://docs.oracle.com/en/industries/food-beverage/simphony/19.3/simcg/c_enterprise_inheritance_overrides.htm
- Scope selector: https://docs.oracle.com/en/industries/food-beverage/simphony/simfl/c_scope_selector.htm
- Roles: https://docs.oracle.com/en/industries/food-beverage/simphony/simcg/c_roles.htm

Observed patterns:
- Scope selection is structural: enterprise, location/property, revenue center.
- Modules shown depend on selected scope and granted access.
- Shared enterprise definitions are inherited and overridden closer to the operating location.
- Roles combine administrative module access with operational transaction permissions.

Balcona relevance:
- Primary enterprise reference for future-proof multi-location scope and inheritance.
- Anti-reference visually: do not copy legacy desktop density, terminology, or hierarchy complexity unless Balcona needs it.

### Restaurant365 and MarketMan — specialist inventory / procurement

Verified official evidence:
- Restaurant365 purchasing & receiving: https://www.restaurant365.com/inventory/purchasing-receiving/
- Restaurant365 inventory: https://www.restaurant365.com/inventory/
- MarketMan purchasing/order management: https://www.marketman.com/platform/restaurant-purchasing-software-and-order-management
- MarketMan platform: https://www.marketman.com/platform

Observed patterns:
- Procurement is a connected sequence: inventory/par → PO → supplier → delivery/receiving → discrepancy/credit → inventory and cost impact.
- Suggested ordering and par-based workflows reduce repetitive entry.
- Receiving is exception-oriented: shortages, substitutions, price changes, missing quantities.
- Multi-location purchasing and reporting is centralized where possible.

Balcona relevance:
- Strong evidence that suppliers/PO/receiving should not be isolated CRUD cards.
- R2/R4 must identify whether Balcona backend already supports enough state for an actual procurement workflow.

## R1 anti-pattern register

Do NOT carry these patterns into the final Balcona IA unless a later audit proves a specific need:

1. Flat navigation where Cashier, Kitchen, Owner, Menu, Inventory, Billing, and Setup are sibling destinations.
2. A universal decorative dashboard shell forced onto high-frequency operational surfaces.
3. Exposing every backend module because it exists.
4. Making role names the primary organization of Back Office information architecture.
5. Requiring every branch to repeat configuration that should be inherited or cloned.
6. Treating Setup as permanent daily navigation.
7. Treating Guest as menu → cart only.
8. Treating KDS as a generic staff webpage rather than a persistent station workspace.
9. Mixing restaurant customer payments and Balcona SaaS subscription billing in one mental model.
10. Using dashboards as feature directories instead of exception/decision surfaces.
11. Hiding failed/unknown payment states instead of exposing recovery/status clarity.
12. Designing procurement as raw item/supplier forms with no PO/receiving journey.
13. Showing rare setup/emergency actions with the same prominence as minute-by-minute work.
14. Copying Oracle-style enterprise complexity into single-location tenants.
15. Copying competitor visual language instead of solving Balcona-specific jobs.

## R1 pattern library — evidence-backed candidates

Patterns to test against Balcona during R2-R6:

- workspace separation: Office / Service / Kitchen / Guest / Platform
- global company/location scope selector
- role/permission-driven visibility inside task-oriented workspaces
- device/station modes
- high-frequency floor/table attention view
- setup/readiness journey
- reusable service profiles / operation modes
- shared configuration with local overrides
- central menu with channel/location visibility
- guest session continuity across multiple rounds
- guest order/payment history with explicit pending/failed states
- domain-specific reports with a small decision-oriented Home
- operational close-of-day checklist
- Money workspace with transaction → payout → reconciliation drill-down
- procurement workflow with receiving exceptions
- command/search navigation for large Back Office
- progressive disclosure by enabled feature, role, scope, and device

## R1 track coverage gate

| Research track | Evidence depth | Gate |
|---|---|---|
| Back Office / HQ | Toast + Lightspeed + Oracle | PASS |
| POS / Cashier / Service | Toast + Lightspeed + Square | PASS |
| KDS / Kitchen / Barista | Toast + Lightspeed + Square | PASS |
| Guest Cafe Experience | Toast + Lightspeed + me&u | PASS |
| Onboarding / Implementation | Toast + Lightspeed + Square setup patterns | PASS |
| Multi-location / Enterprise | Toast + Oracle + TouchBistro | PASS |
| Money / Payments / Reconciliation | Toast + Lightspeed + Square close workflow | PASS |
| Inventory / Procurement | Restaurant365 + MarketMan + TouchBistro inventory | PASS |
| Owner / Analytics | Toast + Lightspeed + TouchBistro multi-unit reporting | PASS |
| Roles / Permissions / Device modes | Lightspeed + Oracle + Square | PASS |

## R1 result

Status: COMPLETE

R1 is complete enough to start auditing Balcona. Competitor references now provide evidence for product separation, scope, device context, guest continuity, financial drill-down, onboarding, multi-location inheritance, procurement, permissions, and reporting.

No final Balcona IA is approved yet. The provisional workspace model remains a hypothesis until R2-R6 expose the real surface/backend/role/frequency requirements.
