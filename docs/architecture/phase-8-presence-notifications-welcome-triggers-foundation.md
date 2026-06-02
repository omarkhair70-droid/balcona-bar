# Phase 8 Presence, Notifications, and Welcome Triggers Foundation

Phase 8 adds the backend data model and API surface for customer presence events and stored notifications.

## Scope

- Store venue zones, customer session identities, device subscription placeholders, presence events, notification templates, notifications, and notification deliveries.
- Create a customer session identity, `qr_session_started` presence event, deduped welcome notification, and in-app delivery when a QR table session starts.
- Create a `qr_session_resumed` presence event when an active or idle QR table session resumes without duplicating the original welcome notification.
- Store presence events through `POST /api/v1/presence/events`; venue, table-session, customer-identity, and device-subscription references are validated against the branch.
- Create a deduped in-app welcome notification for table-session presence triggers from Wi-Fi portal, beacon, geofence, near-venue app open, or manual staff events.
- Store in-app notifications for order submitted, cashier accepted, cashier rejected, and preparation ready events.
- Expose notification read/dismiss APIs and branch/table-session read APIs for presence and notifications.

## Boundaries

- Only `in_app` delivery records are functional in this phase.
- `web_push`, `whatsapp`, `sms`, `wifi_portal`, `beacon`, and `geofence` are schema placeholders for future delivery integrations.
- No kitchen/barista queue expansion, payment/POS integration, AI behavior, Wi-Fi/BLE/geofence provider integration, or Phase 9 work is included.
- Notification templates are modeled but not seeded yet; the service uses fallback Balcona Arabic copy for Phase 8 notifications.

## Migration

`20260602040000_phase_8_presence_notifications_welcome_triggers_foundation`

## Seed Data

No seed changes are required for Phase 8.
