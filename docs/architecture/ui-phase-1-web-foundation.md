# UI Phase 1 Web Foundation

UI Phase 1 adds the first frontend package for the Cafe AI Waiter App / Smart Cafe Operating System. The scope is intentionally foundational, but the foundation is expected to feel like a premium product system: one Next.js App Router app, shared primitives, product shells, dynamic theme wiring, API helpers, realtime utilities, and a PWA shell.

## Why Next.js App Router

`apps/web` uses the App Router so customer and staff surfaces can share routing conventions, layouts, metadata, server-friendly rendering, and future route-level loading or error states. A single app keeps product iteration fast before the frontend is large enough to justify splitting customer and staff applications.

## Route Groups

The web app uses route groups to keep product contexts separate without creating separate packages:

- `app/(customer)` contains customer-facing routes.
- `app/(staff)` contains staff-facing routes.
- `/customer` is the customer PWA foundation route.
- `/staff` and `/staff/*` are staff dashboard foundation routes.

The root route `/` remains a small foundation entry point linking into the two shells.

## Product Shells

The design system includes reusable shells that future screens can build on without redesigning the app:

- `CustomerShell` provides the mobile-first table experience frame.
- `StaffShell` provides the operator workspace frame.
- `DashboardShell` provides the reusable dashboard layout, sidebar, mobile navigation, header, actions, and supporting rail.

Placeholder routes use polished preview states and realistic product density. They do not wire live flows, mutations, dashboard behavior, or backend state.

## Balkona-First, SaaS-Ready

The default visual language is a warm dark premium cafe theme suitable for Balkona. It is not hardcoded as the only supported cafe. Theme values live behind CSS variables and can be replaced later by branch-specific `ExperienceProfile.designTokens`.

## Dynamic Theme System

`ThemeProvider` accepts optional design tokens, merges them with the fallback theme, and applies variables to `document.documentElement`. Tailwind consumes the variables through semantic names such as `background`, `surface`, `primary`, and `muted-foreground`.

The current token set includes:

- core colors for background, foreground, surfaces, borders, status colors, primary, and accent
- raised and overlay surfaces for premium cards and shells
- radius values for cards and buttons
- card, elevated, and glow shadows

Later phases can call `GET /api/v1/branches/:branchId/experience/effective`, normalize its `designTokens`, and pass the result into `ThemeProvider`.

## API Client Strategy

`lib/api/client.ts` provides a small fetch wrapper that:

- reads `NEXT_PUBLIC_API_BASE_URL`
- defaults to `http://localhost:3000/api/v1`
- supports JSON requests and query params
- supports bearer tokens
- throws `ApiError` with status, message, and details

`lib/api/endpoints.ts` only includes foundation helpers for companies, effective branch experience, table-session start, staff login, and staff identity. It does not attempt to mirror the entire backend.

## React Query

`QueryProvider` creates a conservative React Query client with short stale time, one retry for queries, no mutation retries, and window-focus refetch disabled. It wraps the root layout so future customer and staff screens can add server-state hooks without introducing a second provider.

## Realtime

`lib/realtime/sse-client.ts` uses `@microsoft/fetch-event-source` and supports:

- URL configuration
- optional bearer token and headers
- message and error callbacks
- caller-provided abort signals
- default fetch-event-source reconnect behavior

No staff dashboard is wired to realtime events in this phase.

## PWA Foundation

The PWA setup includes a manifest, app icon, metadata, and `@ducanh2912/next-pwa` config. The service worker is disabled in development and only caches static Next.js assets. Live orders, table sessions, staff state, and other business data are intentionally not cached offline.

## Haptics And Sound

The haptics utility safely wraps `navigator.vibrate` with light, success, and warning patterns. The sound utility provides opt-in notification playback with native `Audio` support or a short Web Audio beep fallback. No loud assets or staff alerts are added yet.

## Intentionally Not Implemented

This phase does not add:

- full customer ordering PWA screens
- cashier, kitchen, waiter, or owner dashboards
- AI waiter UI
- production auth screens
- backend behavior changes
- payment flows
- kitchen or barista queue behavior

The current screens are static preview surfaces. They establish visual hierarchy, spacing, density, shell composition, and reusable primitives without adding operational behavior.

## Next UI Phases

Likely next steps are customer table-session entry, menu browsing, cart and order placement screens, staff authentication screens, and the first realtime staff dashboard surfaces.
