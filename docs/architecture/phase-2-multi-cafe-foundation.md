# Phase 2 — Multi-company and multi-branch foundation

Phase 2 introduces the first reusable product-domain foundation for the Smart Café Operating System. The goal is to model cafés as companies with one or more branches, floors, physical tables, and staff memberships without introducing waiter AI, menu, ordering, kitchen, cashier, payment, dashboard, or Flutter UI workflows yet.

## Multi-company model

The database now starts with `Company`. A company represents the café business or operator using the product. Companies have stable slugs and lifecycle status so the same backend can support multiple independent café brands or operators.

## Multi-branch model

Each `Branch` belongs to a company and has its own slug, optional address, status, floors, tables, and branch-scoped staff memberships. Branch slugs are unique only inside their company, allowing different companies to use natural branch slugs such as `main-branch` without global collisions.

## Floors and tables

A `Floor` belongs to a branch and provides a simple sort order for table presentation. `CafeTable` belongs to a branch and can optionally belong to a floor. Table codes are unique per branch, and each table has a globally unique QR token. Phase 2 only resolves QR tokens to company, branch, floor, and table metadata; it does not create table sessions.

## Staff users and memberships

`StaffUser` stores reusable staff identities by email. `StaffMembership` connects staff users to a company and optionally a branch with a role. This supports company-level owners and branch-level operational staff while keeping authorization workflows out of scope for this phase.

## Seed/demo data policy

Balcona Bar is included only as safe local seed and demo data. It is not hardcoded into product logic. The application queries companies, branches, tables, and staff from the database, so another café can be added through data without changing backend code.

The seed creates:

- Company: Balcona Bar
- Branch: Main Branch
- Floor: Ground Floor
- Tables: T01 through T06 with stable QR tokens
- Fake local staff emails for owner, branch manager, cashier, waiter, kitchen, and barista verification users

## Intentionally deferred

The following areas remain intentionally deferred until later phases:

- AI waiter behavior and prompts
- Menu/catalog management
- Orders, carts, and table sessions
- Kitchen, barista, cashier, and payment workflows
- POS integrations
- Admin dashboard features
- Flutter customer or staff UI
