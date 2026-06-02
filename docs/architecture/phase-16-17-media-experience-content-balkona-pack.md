# Phase 16-17 Media, Experience, Content, and Balkona Pack

Phase 16-17 adds the backend foundation for a branded customer experience layer
without building the Customer PWA, storage pipeline, or AI waiter.

## Media Assets

`MediaAsset` stores metadata only. It can describe external URLs, placeholder
assets, or future storage-backed files, but this phase does not upload binaries,
process images, resize media, or configure real S3, R2, or Supabase credentials.

`MediaAssetUsage` links one media asset to a target such as a company, branch,
menu category, menu item, modifier group, venue zone, experience profile,
content block, or notification template. The usage record carries a role like
`cover`, `hero`, `gallery`, `thumbnail`, or `background`, plus sort order and
metadata. Known targets are validated for company ownership when the API can
prove it from the database.

`MenuItem.imageUrl` remains in place for backward compatibility. Media assets
are the richer future path.

## Experience Profiles

`ExperienceProfile` is the design-token and configuration layer for the future
Next.js PWA and dashboards. Profiles can be scoped to a company or branch and
store theme, design tokens, motion tokens, layout config, brand voice, and
future AI waiter tone.

The effective branch experience endpoint resolves the active default branch
profile first, then falls back to a company default profile, then any active
profile in scope. It also returns active content blocks, venue zones, and
relevant media usage summaries.

## Content Blocks

`ContentBlock` keeps customer and dashboard copy configurable instead of
hardcoded in UI code. Blocks are placement-aware and language-aware, so future
clients can render welcome copy, menu headers, bill-flow text, waiter-call text,
and AI-intro copy from the backend.

## Notification Templates

The existing `NotificationTemplate` model is reused. Phase 16-17 adds admin
endpoints to create, list, update, activate, and deactivate templates. Existing
notification creation still works as-is; resolving templates inside
`PresenceNotificationsService` is documented as future work and is not refactored
in this phase.

## Venue Zones

`VenueZone` now has a safe status field and admin endpoints. Venue zones model
physical café experience surfaces such as entrances, seating zones, photo zones,
cashier zones, and other branch-specific areas. Delete requests archive zones
that already have presence events, preserving historical presence data.

## Balkona Experience Pack

The Balkona Bar pack is a concrete branded layer on top of the generic SaaS
system. Applying it to a branch upserts:

- an active default branch `ExperienceProfile`
- Arabic-first content blocks
- in-app notification templates
- branch venue zones

The pack does not create fake menu items and does not upload media. Media
placeholders are returned as an empty list for now.

## Limitations

- No UI, Next.js PWA, or Flutter UI.
- No real storage upload or credentials.
- No image processing, transcoding, or binary file handling.
- No AI waiter implementation.
- No payment/POS work.
- No Redis/BullMQ work.
- No production auth guard enforcement.
