# Customer PWA Features

UI Phase 2 adds the first live customer table-ordering PWA surfaces on top of the Phase 1 design system.

## Flow

- `/customer` opens the local customer entry and resume surface.
- `/customer/table/[qrToken]` starts or resumes a table session and stores the returned customer access context.
- `/customer/session/[sessionId]` shows the table home.
- `/customer/session/[sessionId]/menu` loads the branch menu, item detail, modifiers, and add-to-cart.
- `/customer/session/[sessionId]/cart` reads, validates, edits, clears, and submits the backend draft cart.
- `/customer/session/[sessionId]/status` shows session orders, customer status, and timeline.
- `/customer/session/[sessionId]/service` creates waiter calls and bill requests.

## Shared Pieces

- `customer-session-store.ts` persists table session identity in local storage.
- `CustomerSessionScreen` provides the session frame, realtime status, branch theme loading, session gate, and bottom navigation.
- `useCustomerRealtime` connects to the table-session SSE stream and invalidates customer queries.
- Menu, cart, status, and service components stay reusable so future customer screens can compose them without redesigning the shell.

This phase does not add staff dashboards, payment, POS, AI waiter chat UI, or backend behavior changes.
