# Product Phase 4K.0 - KDS, Kitchen Tickets, and Printer Foundation

## Goal

Product Phase 4K.0 adds the operational layer between accepted orders and future
payment/POS work: station-scoped kitchen tickets, a mock printer queue, realtime
ticket events, and reusable KDS frontend surfaces.

This phase deliberately does not add real thermal-printer drivers, payments,
POS integration, split bills, AI order submission, or new SaaS admin flows.

## Why This Comes Before Payment

Manual payment and POS flows need a reliable operational record of what was
prepared, voided, reprinted, and served. Kitchen tickets provide that record
without coupling preparation to receipts or settlement. The cashier can accept
an order, preparation stations can work from tickets, the waiter can see station
readiness, and later bill/payment phases can build on the same order state.

## Station Ticket Model

The data model adds:

- `KitchenTicket` for one order/station ticket.
- `KitchenTicketItem` for item-level station snapshots.
- `KitchenTicketStatus` for `queued`, `in_progress`, `ready`, `served`,
  `cancelled`, and `voided`.
- `KitchenTicketType` for kitchen, barista, dessert, receipt, void, and reprint
  ticket intent.

Tickets are branch-scoped and deduped by order, station, and type. Each ticket
stores display code, order number, table/floor snapshots, customer note, station,
status timestamps, item names, modifier snapshots, and preparation task links.
Cashier-only menu items do not create kitchen tickets.

## Print Job Model

The print foundation adds:

- `PrinterStation` for branch printer configuration and station routing.
- `PrintJob` for printable ticket work.
- `PrintJobEvent` for job lifecycle history.
- `PrintJobStatus` for pending, printing, printed, failed, cancelled, and
  reprint-requested states.
- `PrintJobKind` for kitchen, barista, dessert, receipt, and void tickets.

Every accepted station ticket creates an initial pending print job. Reprints
create a new print job for the same ticket instead of duplicating the ticket.
Order cancellation creates void print jobs for active tickets.

## Mock Printer Adapter

Phase 4K.0 seeds mock printer stations for the Balkona demo branch:

- Main Barista Printer
- Main Kitchen Printer
- Dessert Printer
- Cashier Receipt Printer

The adapter type is `mock`. The API creates structured print payloads plus
human-readable `printableText`, but it does not talk to physical ESC/POS,
browser print bridges, USB, LAN, or third-party print services yet.

Printer station config is sanitized before persistence so common secret-shaped
keys such as password, token, apiKey, and secret are not stored through the
frontend contract.

## Order And Preparation Lifecycle Integration

Ticket creation is tied to accepted orders:

1. Customer submits a cart.
2. Cashier or Smart Cashier accepts the order.
3. Preparation tasks are created for actionable stations.
4. Kitchen tickets are created once per order/station/type.
5. Initial mock print jobs are queued.

Preparation lifecycle updates keep tickets in sync:

- starting a preparation task moves linked ticket items to `in_progress`;
- marking preparation ready moves linked ticket items to `ready`;
- a ticket becomes `ready` when all active linked items are ready;
- cancelling linked preparation cancels ticket items;
- cancelling the parent order cancels active tickets and queues void print jobs;
- serving the parent order marks ready tickets as served.

The order response now includes compact `kitchenTickets` summaries so cashier
and waiter screens can show ticket and print state without extra calls.

## Realtime Behavior

Branch preparation realtime events now include:

- `kitchen_ticket_created`
- `kitchen_ticket_updated`
- `kitchen_ticket_ready`
- `kitchen_ticket_cancelled`
- `print_job_created`
- `print_job_printed`
- `print_job_failed`
- `print_job_reprint_requested`
- `printer_station_updated`

Events are emitted on the branch preparation channel. Customer table-session
streams remain unchanged in this phase.

## Staff Permissions And Branch Scoping

No new permissions are introduced. Existing preparation/settings permissions
gate the new surfaces:

- read tickets and print jobs: `preparation.read`
- reprint or retry print jobs: `preparation.start`
- mark print jobs printed: `preparation.ready`
- mark print jobs failed: `preparation.cancel`
- create, update, disable, or test printer stations: `settings.manage`

Entity-scoped access checks resolve the branch from the kitchen ticket, print
job, or printer station before permission evaluation. Branch-scoped staff cannot
operate across branches through direct entity IDs.

## Frontend Updates

The staff KDS page now has three modes:

- preparation tasks;
- station kitchen tickets;
- mock print queue.

The cashier order detail panel shows read-only kitchen ticket and print status
context. The waiter ready-order panel shows station ticket readiness before an
order is served. These are visibility improvements only; backend lifecycle and
permission checks remain the source of truth.

## Smoke Test Checklist

Recommended local smoke flow:

1. Start local infrastructure, API, and web with the existing README quick start.
2. Seed the database.
3. Open `http://localhost:3001/customer/table/balcona-main-t01`.
4. Add a barista, kitchen, or dessert item and submit the cart.
5. Open `http://localhost:3001/staff/login` and sign in.
6. Open `/staff/cashier` and accept the submitted order.
7. Open `/staff/kitchen` and confirm the Tickets mode shows station tickets.
8. Open KDS Print Queue mode and confirm pending mock print jobs exist.
9. Mark a print job printed, then retry/reprint another ticket if needed.
10. Start and mark preparation tasks ready.
11. Open `/staff/waiter` and confirm the ready order shows station ticket
    readiness before serving.
12. Cancel an accepted or preparing order and confirm active tickets are
    cancelled and void print jobs are queued.

## Tests

Phase 4K.0 adds or extends backend tests for:

- idempotent ticket creation per accepted order/station/type;
- item and modifier snapshotting;
- skipping cashier-only items;
- ticket readiness sync from preparation tasks;
- print job creation, printed state, failed state, and invalid transitions;
- order served/cancelled ticket sync;
- branch/entity scoped access for kitchen tickets, print jobs, and printer
  stations.

## Known Limitations

- Printer adapters are mock-only.
- No thermal printer discovery, LAN/USB transport, ESC/POS formatting, or
  browser print bridge is included.
- No cashier receipt printing is connected to bill/payment settlement yet.
- No kitchen bump screen websocket protocol is added beyond existing branch SSE
  invalidation.
- Printer station management is API-foundation only; the staff UI consumes print
  jobs but does not add a full printer admin console.
- Payment, POS, refunds, discounts, and final bill settlement remain outside
  this phase.

## Next Recommended Phase

Next recommended phase: Product Phase 4P.0 - Bill + Manual Payment Core.
