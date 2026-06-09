# Staging Smoke Test

Use this after staging API and Web are deployed. The current permanent staging
target is Vercel Web pointing to the Railway API, with Railway connected to Neon
Postgres plus Upstash Redis.

Cloudflare Tunnel quick links are transitional only. If a laptop-hosted API is
used while waiting for a permanent host, update the Vercel staging web
environment variable that points to the API whenever the laptop, API process, or
tunnel restarts.

## First Cafe Workspace Flow

1. Point the API at the staging Neon Postgres URL and Upstash Redis URL.
2. Apply database migrations:

   ```bash
   pnpm --filter @balcona-bar/api prisma:migrate:deploy
   ```

3. Seed SaaS plans and demo data if the database is new or plans are missing:

   ```bash
   pnpm --filter @balcona-bar/api prisma:seed
   ```

4. Bootstrap the platform admin from the staging-safe environment variables:

   ```bash
   pnpm --filter @balcona-bar/api platform-admin:bootstrap
   ```

5. Start or restart the API on Railway, or expose it through the current
   Cloudflare Tunnel URL only when using a laptop-hosted fallback.
6. Confirm Vercel staging web has `NEXT_PUBLIC_API_BASE_URL` set to the Railway
   API `/api/v1` URL and `NEXT_PUBLIC_APP_ENV=staging`, then redeploy if
   changed. Do not use `localhost` or `*.trycloudflare.com` in the staging
   Vercel env.
7. Open `/platform/login` and log in as the platform admin.
8. Open `/platform/status` and confirm the Web API target is Railway, the API
   metadata loads, `APP_ENV=staging`, and `NODE_ENV=production`.
9. Open `/platform/companies`.
10. Open `/platform/companies/new` and create a cafe workspace:
   - plan: `pilot`
   - status: `active`
   - starter tables: enabled
   - count: `2` or more
11. Confirm the response page shows the company, branch, subscription, owner
   staff user handoff, starter tables, and customer QR examples.
12. Open the first returned QR example, `/customer/table/<qrToken>`, and start a
    customer table session.
13. Open the created company detail page, generate a staff invite for the owner
    or manager, and copy the returned `/staff/invite/<inviteToken>` link.
14. Open the invite link, set a staff password, then log in at `/staff/login`
    with the invited staff email.
15. Open `/staff/setup` and confirm the branch staff invite card explains that
    branch roles receive access to the selected branch. The owner/company-level
    warning should only appear for owner-role context.
16. Create a branch staff invite, then confirm the success state shows the
    invite link, Copy link, Open invite, email, role, and branch summary.
17. Open `/staff/menu` as an owner or `menu_admin` and confirm the Overview tab
    shows category, item, modifier, branch availability, and setup warning
    counts.
18. Create a menu category with a clear slug, active status, and sort order.
19. Create a menu item in that category with an EGP base price, station, status,
    sort order, and an external `imageUrl`. Confirm the image preview renders;
    if the URL is empty or broken, the UI should show the preview fallback.
20. Edit the item price/status and confirm the success state is readable.
21. Create a modifier group and option, then attach the modifier group to the
    item if the account has full menu permissions.
22. Open the Availability tab and save a branch override for visibility,
    availability, optional price override, and sort order.
23. Open a customer QR/session for the same branch and confirm menu
    visibility, availability, and displayed price match the branch override.
24. Open `/staff/inventory` as an owner, `menu_admin`, or branch manager and
    confirm Overview, Items, Stock levels, Alerts, Adjustments, Suppliers,
    Purchase orders, Receiving, Requirements, Menu availability, and Recent
    movements tabs load.
25. Create an inventory item with name, SKU, unit, low-stock threshold, and par
    level. Edit the supported fields: name, SKU, status, low-stock threshold,
    and par level. Unit should remain fixed after creation.
26. Record an opening balance, then record `stock_in`. Record `stock_out` or
    `waste` with a note and confirmation.
27. Create a supplier from the Suppliers tab, then edit contact/status fields
    and confirm readable success or failure feedback.
28. Create a draft purchase order for the selected branch, choose the supplier,
    set an expected date, add at least one inventory line with quantity and EGP
    unit cost, confirm the estimated value, then submit it.
29. In Receiving, receive only part of one PO line. Confirm branch stock
    increases, a `stock_in` movement appears with source
    `purchase_order_receipt`, and the PO status becomes `partially_received`.
30. Attempt to receive more than the remaining quantity and confirm the UI/API
    blocks over-receiving with readable error copy.
31. Receive the remaining quantity and confirm the PO status becomes
    `received`.
32. Create and submit a second PO, cancel it, then confirm cancelled POs cannot
    be received.
33. Confirm low-stock or out-of-stock alerts appear when stock falls below the
    configured threshold, and confirm restock suggestion uses par level minus
    quantity on hand.
34. Add a stock requirement to an existing menu item, confirm the expected stock
    impact text, then verify menu availability by stock updates.
35. Confirm the recent movement appears with movement type, quantity delta,
    quantity after, source, note, timestamp, and staff reference when available.
36. Open a customer QR/session for the same branch and confirm the menu still
    loads; inventory-linked items should be blocked when stock is insufficient
    if staging data is configured that way.
37. Log in as a lower-privilege branch role such as cashier, waiter, or kitchen
    and confirm category, item, modifier, and branch override edits are not
    available unless that role has the matching menu permissions. Also confirm
    inventory stock adjustments, PO receiving, and supplier edits are
    unavailable unless the required `inventory.manage` scope is granted.
38. Open `/staff/branches`, copy a customer QR URL, open it in a new tab, and
    confirm a visible scannable QR image appears for a table with a token.
39. Scan the QR with a phone camera and confirm it opens the customer
    `/customer/table/<qrToken>` route and starts or resumes a table session.
40. Regenerate one non-demo table QR token with confirmation. Confirm the token
    changes, the old `/customer/table/<oldToken>` no longer opens, and the new
    QR image scans/opens `/customer/table/<newToken>` correctly.
41. Log in as a lower-privilege branch staff role such as cashier or waiter and
    confirm QR regeneration is not available.
42. Open `/staff/billing` and confirm the staff routes load without
    `[object Object]` errors.

Menu media upload and storage are not part of this smoke. Menu Admin accepts an
`imageUrl`, previews it in the web UI, and lets the backend validate the URL.
Upload/media library support remains a follow-up.

## Automated Route Check

PowerShell:

```powershell
.\scripts\deploy\staging-smoke.ps1 `
  -WEB_BASE_URL https://staging.example.com `
  -API_BASE_URL https://api-staging.example.com/api/v1
```

Bash:

```bash
WEB_BASE_URL=https://staging.example.com \
API_BASE_URL=https://api-staging.example.com/api/v1 \
./scripts/deploy/staging-smoke.sh
```

This verifies:

- API health: `/health`
- API metadata: `/api/v1/system/info`
- Web root: `/`
- platform login: `/platform/login`
- platform companies: `/platform/companies`
- platform diagnostics: `/platform/status`
- cafe creation page: `/platform/companies/new`
- staff login: `/staff/login`
- setup page: `/staff/setup`
- menu admin: `/staff/menu`
- inventory: `/staff/inventory`
- branch/table QR management: `/staff/branches`
- billing page: `/staff/billing`
- customer QR route: `/customer/table/balcona-main-t01`
- no fetched page contains `[object Object]`
- API URL is not `localhost`, `127.0.0.1`, `.localhost`, or
  `*.trycloudflare.com`

## Manual Authenticated Smoke

1. Open `/platform/login`.
2. Log in with the staging platform admin created from env-provided credentials.
3. Open `/platform/status` and confirm the Web API target and API metadata.
4. Open `/platform/companies`.
5. Open `/platform/companies/new`.
6. Create a test cafe workspace with plan `pilot`, status `active`, starter
   tables enabled, and at least two tables.
7. Open the created company detail page and confirm plan, usage, and status
   render without raw object errors.
8. Open the company detail page, generate a staff invite for the owner or
   manager, and copy the `/staff/invite/<inviteToken>` link.
9. Open the invite link and set a password of at least 12 characters.
10. Log in at `/staff/login` with the invited staff email and new password.
11. Open `/staff/setup` and confirm branch/table/setup readiness cards load.
12. Create a branch staff invite from `/staff/setup`; confirm the success panel
    shows the invite link, Copy link, Open invite, email, role, and branch.
13. Confirm invite failure states, if triggered by a duplicate or invalid email,
    render readable text rather than `[object Object]`.
14. Open `/staff/menu` as an owner or `menu_admin`; confirm Overview shows
    catalog, branch availability, modifier, and setup warning counts.
15. Create an active category with slug and sort order.
16. Create an active item with EGP price, station, sort order, and `imageUrl`;
    confirm the image preview renders or falls back cleanly for an empty/broken
    URL.
17. Edit the item price/status and confirm the success or failure message is
    readable.
18. Create a modifier group and option, then attach the group to the item if
    the account has full menu permissions.
19. Save a branch override for the item, including visibility, availability,
    optional price override, and sort order.
20. Open a customer QR/session for the same branch and verify customer menu
    visibility, availability, and price reflect the saved override.
21. Open `/staff/inventory` as an owner, `menu_admin`, or branch manager and
    confirm the operational tabs load: Overview, Items, Stock levels, Alerts,
    Adjustments, Suppliers, Purchase orders, Receiving, Requirements, Menu
    availability, and Recent movements.
22. Create an inventory item with name, SKU, unit, low-stock threshold, and par
    level. Edit the supported fields: name, SKU, status, low-stock threshold,
    and par level. Unit should remain fixed after creation.
23. Record an opening balance, then record `stock_in`. Record `stock_out` or
    `waste` with a note and confirmation.
24. Create or edit a supplier, then create a draft PO using that supplier and
    add inventory lines with quantity and EGP unit cost.
25. Submit the PO, partially receive it, and confirm stock level and recent
    movement updates show `stock_in` with source `purchase_order_receipt`.
26. Confirm over-receiving is blocked, then receive the remaining quantities and
    confirm the PO becomes `received`.
27. Cancel a submitted PO and confirm cancelled POs cannot be received.
28. Confirm low-stock or out-of-stock alerts appear when expected, and confirm
    the restock suggestion uses par level minus quantity on hand.
29. Add a requirement to an existing menu item and confirm the expected stock
    impact text appears.
30. Confirm Menu availability by stock updates, including missing requirements
    and shortage quantities when stock is insufficient.
31. Confirm the recent movement appears with movement type, item name, quantity
    delta, quantity after, source, note, timestamp, and staff reference when
    available.
32. Log in as a cashier, waiter, or kitchen user and confirm menu edit controls
    are not available unless that user has matching menu permissions. Also
    confirm inventory stock adjustments, PO receiving, and supplier edits are
    unavailable unless the required `inventory.manage` scope is granted.
33. Open `/staff/branches`, select the active branch, and confirm tables show
    floor/area, code, display name, capacity, status, QR token, customer URL,
    and a printable QR card with a visible scannable QR image.
34. Copy a customer QR URL, open it, then scan the visible QR with a phone
    camera and confirm it opens the matching customer table/session URL.
35. Regenerate a non-demo table QR token only after the confirmation prompt.
    Confirm the old token no longer opens and the new QR image scans/opens the
    new customer table/session URL.
36. Log in as a lower-privilege branch role such as cashier or waiter and
    confirm QR regeneration is unavailable.
37. Open `/staff/billing` and confirm SaaS plan/status appears.
38. Open `/customer/table/:qrToken` for the first returned QR example and
    confirm a customer session can start.
39. If seeded menu data is intentionally available in that staging cafe, submit
    a basic customer order and confirm the cashier sees it.
40. Confirm no visible page renders `[object Object]`.

## Operational Action Reliability Smoke

Run this after the authenticated smoke when the staging cafe has at least one
available menu item and a logged-in cashier/manager:

1. Open a customer table session and submit the cart once. Confirm the cart
   button disables while pending and the customer status page shows the new
   submitted order without repeated-click workarounds.
2. Open `/staff/cashier`, select the submitted order, and click Accept once.
   Confirm all lifecycle buttons disable while Accept is pending, then the
   order status changes to accepted.
3. Confirm the order leaves or updates in the current cashier lane, the selected
   order changes to the next visible order or clears, and branch realtime/order
   data refreshes without a manual page reload.
4. Confirm any item with inventory requirements consumes stock when enough
   branch stock exists.
5. Try accepting the same order again from a stale tab or direct API call. The
   response should be a readable stale/lifecycle 400, not a hang or generic 500.
6. Try an out-of-stock inventory-linked item. Cashier Accept should fail once
   with readable copy such as `Item is out of stock`, including safe stock
   details when returned by the API.
7. Confirm the customer order/status view updates after staff actions.
8. If any action fails, confirm the UI shows backend error text, a request ID
   when present, and a Refresh now action. Railway logs should include
   `requestId`, method, path, status code, exception name/message/code, and a
   sanitized stack first line for unexpected exceptions.

## KDS Routing Smoke

Run this after a customer order can be submitted and a cashier can accept it:

1. Submit an Espresso or Spanish Latte from `/customer/table/balcona-main-t01`.
2. Open `/staff/cashier`, select the submitted order, and click Accept once.
3. Confirm the order becomes `cashier_accepted`.
4. Confirm the order detail shows a barista kitchen ticket instead of an empty
   Kitchen tickets area.
5. Open `/staff/kitchen` and confirm the Tasks tab shows a pending barista task
   and the Tickets tab shows a queued barista ticket.
6. Start the task and confirm the matching ticket becomes preparing or
   in-progress.
7. Mark the task ready and confirm the task/ticket become ready. Confirm cashier
   or order status updates when that workflow is supported.
8. If the order is accepted but no task/ticket appears for a barista, kitchen,
   or dessert item, treat it as a blocker. The cashier detail should warn that
   kitchen routing needs attention, and API logs should include
   `accept.preparation_tasks`, `kds.create_tasks_for_order`, or
   `kds.create_tickets_for_order` diagnostics with order, branch, station, task,
   and ticket counts.

The smoke does not require a real payment gateway. Mock online payment should
remain explicit and staging-only until a real provider is added.

PNG/PDF batch QR export remains a follow-up. The current staging surface should
at minimum provide copy link, open QR link, regeneration with confirmation, and a
printable scannable QR card for each QR token.
