# Real Cafe Readiness Checklist

This checklist answers one question:

Can we give this to a real cafe and let them use it for a day?

Use it before any real pilot. It is intentionally stricter than a demo script.

## Setup

- Cafe company exists.
- Branch exists.
- Branch operating mode is correct.
- Branch service mode is correct.
- Branch timezone and opening assumptions are correct.
- Staff owner/manager can log in.
- Demo/dev bootstrap is disabled or tightly controlled.
- Health endpoint works.
- Web app loads on target devices.
- API base URL is correct for the environment.
- CORS origin matches the Web origin.

## Menu

- Categories are present and ordered.
- Items are present and visible.
- Prices are correct.
- Currency is correct.
- Required modifier groups are configured.
- Optional modifiers are configured.
- Modifier price deltas are correct.
- Unavailable items are hidden or clearly unavailable.
- Staff can mark items unavailable without developer help.
- Allergens/dietary tags are present before AI makes dietary suggestions.
- Customer can browse menu on a phone.

## Tables / QRs

- Floors are configured.
- Tables are configured.
- Each table has a QR token.
- QR tokens are printed and placed correctly.
- QR token `balcona-main-t01` exists for the Balkona demo path when using demo
  data.
- Invalid QR shows readable recovery.
- Disabled table blocks new sessions.
- QR rotation process is documented.
- Staff know who to contact if a QR code fails.

## Staff Accounts

- Owner account exists.
- Manager account exists if needed.
- Cashier account exists.
- Kitchen account exists.
- Barista account exists if drinks route separately.
- Waiter account exists.
- Each staff member has secure credentials.
- Staff can log out.
- Lost password/reset process is defined.
- Disabled staff cannot log in.

## Roles

- Owner can access manager/owner surfaces.
- Cashier can access cashier actions.
- Kitchen/barista can access preparation actions.
- Waiter can access waiter calls and attention queue.
- Staff cannot access unauthorized branch data.
- Staff cannot perform unauthorized mutations.
- Role-denied UI is readable.
- Permission guard coverage has been reviewed.

## Customer Order Flow

- Customer scans QR.
- Customer starts or resumes table session.
- Customer opens menu.
- Customer opens item detail.
- Customer satisfies required modifiers.
- Customer adds item to cart.
- Customer edits quantity or removes item.
- Customer validates cart.
- Customer submits order.
- Customer receives visible status after submit.
- Duplicate submit is prevented or safely idempotent.
- Unavailable item during checkout is handled clearly.

## Kitchen Flow

- Cashier acceptance creates preparation tasks.
- Kitchen/barista staff see new tasks quickly.
- Staff can start a task.
- Staff can mark a task ready.
- Staff can cancel a task with a reason when needed.
- Order status moves correctly as tasks progress.
- Late or stuck tasks are visible.
- Kitchen display is readable from expected distance/device.

## Waiter Flow

- Customer can call waiter.
- Customer can request bill when billable orders exist.
- Waiter sees waiter calls.
- Waiter can acknowledge a call.
- Waiter can resolve a call.
- Waiter sees table attention items.
- Waiter can mute or resolve attention appropriately.
- Ready orders that need serving are visible.
- Staff know how to handle duplicate or mistaken calls.

## Bill Request

- Customer sees friendly copy when bill is not yet available.
- Customer cannot spam duplicate active bill requests.
- Staff can acknowledge bill request.
- Staff can mark bill presented.
- Staff can close bill operationally.
- Customer sees active bill request status.
- Payment/POS expectations are clearly communicated as out of scope until the
  payment/POS phase.

## Owner Monitoring

- Owner dashboard loads.
- Owner sees active orders.
- Owner sees preparation state.
- Owner sees waiter call and attention state.
- Owner sees menu/experience readiness.
- Owner can identify blocked operations.
- Owner understands analytics/reporting limitations.
- Owner knows how to contact support or pause the pilot.

## AI Waiter

- Branch AI enabled/disabled state is known.
- AI only suggests real available menu items.
- AI does not invent prices.
- AI asks required modifier questions.
- AI escalates to human on low confidence.
- AI escalates on severe allergy or missing allergen metadata.
- AI creates cart proposals only.
- Applying proposal uses backend cart validation.
- Customer submits final order from cart.
- Staff can disable AI during service if needed.

## Failure Cases

- API unavailable shows readable customer/staff error.
- Web reload preserves customer session where expected.
- Realtime disconnect shows stale/reconnecting state.
- Staff auth expiry redirects or recovers safely.
- Cart submit failure leaves cart visible for retry.
- Waiter call failure shows visible feedback.
- Bill request failure shows visible feedback.
- Invalid or expired QR shows readable recovery.
- Customer duplicate tap does not create duplicate orders.

## Offline / Weak Internet

- Customers understand if ordering is unavailable.
- Staff know not to rely on stale dashboard state.
- Reconnect behavior is visible.
- Critical mutations show success or failure.
- There is a manual service fallback if internet is weak.
- Cafe has a no-internet operating plan.

## Support / Human Fallback

- Customer can ask for a human waiter.
- AI failure routes to a human fallback.
- Staff can see escalations.
- Staff know how to resolve escalations.
- Support contact exists for operators.
- Known issue reporting path is documented.

## Data Reset

- Demo reset process exists for non-production environments.
- Reset does not run against production by accident.
- Seed verification can confirm required demo data.
- Old demo sessions/orders can be cleaned safely.
- Cafe pilot data retention expectations are documented.

## Privacy / Security

- Real secrets are not in git.
- Staff passwords are not shared in docs.
- Dev bootstrap is disabled outside local/dev use.
- Staff endpoint permissions are reviewed.
- Customer session access is reviewed.
- Realtime stream access is reviewed.
- CORS origins are locked to intended Web origins.
- Logs avoid unnecessary sensitive customer data.
- AI decision logs are redacted where needed.

## One-Day Pilot Go / No-Go

Go only if:

- Menu and availability can be managed by cafe staff.
- Tables and QRs can be managed without developer help.
- Staff accounts and roles are configured.
- Customer can submit orders reliably.
- Cashier/kitchen/waiter can operate the order lifecycle.
- Human fallback exists for AI and service failures.
- Critical failure cases have readable recovery.
- At least one full rehearsal passed with real devices.

No-go if:

- Menu changes still require developer/database work.
- Staff credentials or permissions are unclear.
- Customer submit can duplicate orders.
- Kitchen or cashier misses orders.
- AI can invent items/prices or bypass validation.
- There is no manual fallback plan.
