# Product Phase 6INV.1 Suppliers, Purchase Orders, And Receiving

Product Phase 6INV.1 extends the inventory foundation with a real supplier
purchasing and goods receiving workflow. Manual stock adjustments remain
available, but operational `stock_in` can now come from submitted purchase
orders and confirmed receipts.

## Data Model

The Prisma schema adds:

- `Supplier` - company-scoped supplier directory with contact details, notes,
  and active/inactive/archived status.
- `PurchaseOrder` - branch-scoped purchasing document linked to one company
  supplier, with draft/submitted/partially received/received/cancelled status.
- `PurchaseOrderLine` - ordered inventory item quantity, received quantity, unit
  cost in minor units, and line notes.
- `InventoryReceipt` - branch receipt linked to a PO and supplier when present.
- `InventoryReceiptLine` - received inventory item quantity and optional unit
  cost snapshot.

Historical links preserve auditability: purchase order lines restrict inventory
item deletion, PO supplier links are restricted, and receipt supplier/staff/PO
links can be nulled where history should survive.

## API Surface

Supplier routes:

- `GET /api/v1/companies/:companyId/suppliers`
- `GET /api/v1/branches/:branchId/suppliers`
- `POST /api/v1/companies/:companyId/suppliers`
- `PATCH /api/v1/suppliers/:supplierId`

Purchase order routes:

- `GET /api/v1/branches/:branchId/purchase-orders`
- `POST /api/v1/branches/:branchId/purchase-orders`
- `GET /api/v1/purchase-orders/:purchaseOrderId`
- `PATCH /api/v1/purchase-orders/:purchaseOrderId`
- `POST /api/v1/purchase-orders/:purchaseOrderId/submit`
- `POST /api/v1/purchase-orders/:purchaseOrderId/cancel`
- `POST /api/v1/purchase-orders/:purchaseOrderId/lines`
- `PATCH /api/v1/purchase-orders/:purchaseOrderId/lines/:lineId`
- `DELETE /api/v1/purchase-orders/:purchaseOrderId/lines/:lineId`
- `POST /api/v1/purchase-orders/:purchaseOrderId/receipts`
- `GET /api/v1/branches/:branchId/inventory/receipts`

## Receiving Behavior

Draft and submitted purchase orders do not affect stock. Stock changes only when
a receipt is confirmed.

Receiving runs in one transaction:

- validates PO, supplier, branch, and inventory item company scope;
- rejects draft, cancelled, and already received POs;
- rejects duplicate receipt lines and over-receiving;
- creates an `InventoryReceipt`;
- creates receipt lines;
- increments purchase order line received quantities;
- updates PO status to `partially_received` or `received`;
- locks and increments branch inventory levels;
- creates `InventoryMovement` rows with type `stock_in`, source type
  `purchase_order_receipt`, and source id set to the receipt id.

## Permissions

The workflow uses existing inventory permissions:

- `inventory.read` can view suppliers, purchase orders, receipts, stock, and
  movements.
- `inventory.manage` can create/edit suppliers, create/edit/cancel/submit POs,
  and receive stock.
- Supplier mutation remains company-scoped.
- Purchase order and receiving mutations are branch-scoped.
- The branch supplier list is read-only so branch managers can draft POs without
  receiving company-level supplier management access.

## Staff UI

`/staff/inventory` adds three operational tabs:

- Suppliers - supplier list and company-scoped create/edit/status controls.
- Purchase orders - draft creation, line add/edit/remove, submit, cancel, status
  and estimated value review.
- Receiving - submitted/partial PO selection, remaining quantity inputs, receipt
  note/date, receipt confirmation, and recent receipt history.

Receiving invalidates stock levels, alerts, menu availability, recent movements,
staff menu/admin views, owner menu data, and customer menu data.

## Smoke Path

1. Open `/staff/inventory` as an owner, `menu_admin`, or branch manager.
2. Create or edit a supplier.
3. Create a draft PO, add one or more inventory lines, and submit it.
4. Partially receive a line and confirm stock and movement history update.
5. Attempt to receive more than the remaining quantity and confirm the readable
   error.
6. Receive the remaining quantity and confirm the PO becomes `received`.
7. Cancel another submitted PO and confirm it cannot be received.
8. Log in as a lower-privilege staff role and confirm receive controls are not
   available without `inventory.manage`.

## Non-Goals

This phase does not add COGS, weighted average cost, stock valuation, supplier
payments, invoice accounting, tax/eReceipt/eInvoice, barcode scanning, branch
transfers, refunds, real payments, AI waiter changes, billing changes, i18n, or
media upload.
