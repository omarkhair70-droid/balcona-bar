CREATE TYPE "KitchenTicketStatus" AS ENUM ('queued', 'in_progress', 'ready', 'served', 'cancelled', 'voided');

CREATE TYPE "KitchenTicketType" AS ENUM ('kitchen_order', 'barista_order', 'dessert_order', 'receipt', 'void', 'reprint');

CREATE TYPE "PrintJobStatus" AS ENUM ('pending', 'printing', 'printed', 'failed', 'cancelled', 'reprint_requested');

CREATE TYPE "PrintJobKind" AS ENUM ('kitchen_ticket', 'barista_ticket', 'dessert_ticket', 'receipt', 'void_ticket');

CREATE TYPE "PrinterStationStatus" AS ENUM ('active', 'inactive', 'maintenance');

CREATE TYPE "PrinterAdapterType" AS ENUM ('mock', 'browser_print', 'escpos_lan', 'escpos_usb', 'external');

ALTER TYPE "RealtimeEventType" ADD VALUE 'kitchen_ticket_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'kitchen_ticket_updated';
ALTER TYPE "RealtimeEventType" ADD VALUE 'kitchen_ticket_ready';
ALTER TYPE "RealtimeEventType" ADD VALUE 'kitchen_ticket_cancelled';
ALTER TYPE "RealtimeEventType" ADD VALUE 'print_job_created';
ALTER TYPE "RealtimeEventType" ADD VALUE 'print_job_printed';
ALTER TYPE "RealtimeEventType" ADD VALUE 'print_job_failed';
ALTER TYPE "RealtimeEventType" ADD VALUE 'print_job_reprint_requested';
ALTER TYPE "RealtimeEventType" ADD VALUE 'printer_station_updated';

CREATE TABLE "PrinterStation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "station" "PreparationStation",
    "adapterType" "PrinterAdapterType" NOT NULL DEFAULT 'mock',
    "status" "PrinterStationStatus" NOT NULL DEFAULT 'active',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrinterStation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenTicket" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tableSessionId" TEXT NOT NULL,
    "station" "PreparationStation" NOT NULL,
    "type" "KitchenTicketType" NOT NULL,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'queued',
    "displayCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "orderNumberSnapshot" TEXT NOT NULL,
    "tableCodeSnapshot" TEXT,
    "floorNameSnapshot" TEXT,
    "customerNoteSnapshot" TEXT,
    "printedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KitchenTicketItem" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "preparationTaskId" TEXT,
    "menuItemId" TEXT NOT NULL,
    "itemNameSnapshot" TEXT NOT NULL,
    "itemSlugSnapshot" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "modifiersSnapshot" JSONB,
    "station" "PreparationStation" NOT NULL,
    "status" "KitchenTicketStatus" NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenTicketItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintJob" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "printerStationId" TEXT,
    "kitchenTicketId" TEXT,
    "orderId" TEXT,
    "kind" "PrintJobKind" NOT NULL,
    "status" "PrintJobStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "printableText" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "requestedByStaffUserId" TEXT,
    "printedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PrintJobEvent" (
    "id" TEXT NOT NULL,
    "printJobId" TEXT NOT NULL,
    "status" "PrintJobStatus" NOT NULL,
    "actorStaffUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrintJobEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PrinterStation_branchId_slug_key" ON "PrinterStation"("branchId", "slug");
CREATE INDEX "PrinterStation_companyId_idx" ON "PrinterStation"("companyId");
CREATE INDEX "PrinterStation_branchId_idx" ON "PrinterStation"("branchId");
CREATE INDEX "PrinterStation_branchId_status_idx" ON "PrinterStation"("branchId", "status");
CREATE INDEX "PrinterStation_branchId_station_status_idx" ON "PrinterStation"("branchId", "station", "status");
CREATE INDEX "PrinterStation_adapterType_idx" ON "PrinterStation"("adapterType");

CREATE UNIQUE INDEX "KitchenTicket_orderId_station_type_key" ON "KitchenTicket"("orderId", "station", "type");
CREATE UNIQUE INDEX "KitchenTicket_branchId_displayCode_key" ON "KitchenTicket"("branchId", "displayCode");
CREATE INDEX "KitchenTicket_companyId_idx" ON "KitchenTicket"("companyId");
CREATE INDEX "KitchenTicket_branchId_idx" ON "KitchenTicket"("branchId");
CREATE INDEX "KitchenTicket_branchId_status_station_createdAt_idx" ON "KitchenTicket"("branchId", "status", "station", "createdAt");
CREATE INDEX "KitchenTicket_branchId_type_createdAt_idx" ON "KitchenTicket"("branchId", "type", "createdAt");
CREATE INDEX "KitchenTicket_orderId_idx" ON "KitchenTicket"("orderId");
CREATE INDEX "KitchenTicket_tableSessionId_idx" ON "KitchenTicket"("tableSessionId");
CREATE INDEX "KitchenTicket_station_idx" ON "KitchenTicket"("station");
CREATE INDEX "KitchenTicket_status_idx" ON "KitchenTicket"("status");
CREATE INDEX "KitchenTicket_createdAt_idx" ON "KitchenTicket"("createdAt");

CREATE UNIQUE INDEX "KitchenTicketItem_ticketId_orderItemId_key" ON "KitchenTicketItem"("ticketId", "orderItemId");
CREATE INDEX "KitchenTicketItem_ticketId_idx" ON "KitchenTicketItem"("ticketId");
CREATE INDEX "KitchenTicketItem_orderItemId_idx" ON "KitchenTicketItem"("orderItemId");
CREATE INDEX "KitchenTicketItem_preparationTaskId_idx" ON "KitchenTicketItem"("preparationTaskId");
CREATE INDEX "KitchenTicketItem_menuItemId_idx" ON "KitchenTicketItem"("menuItemId");
CREATE INDEX "KitchenTicketItem_station_idx" ON "KitchenTicketItem"("station");
CREATE INDEX "KitchenTicketItem_status_idx" ON "KitchenTicketItem"("status");

CREATE INDEX "PrintJob_companyId_idx" ON "PrintJob"("companyId");
CREATE INDEX "PrintJob_branchId_idx" ON "PrintJob"("branchId");
CREATE INDEX "PrintJob_branchId_status_createdAt_idx" ON "PrintJob"("branchId", "status", "createdAt");
CREATE INDEX "PrintJob_branchId_kind_createdAt_idx" ON "PrintJob"("branchId", "kind", "createdAt");
CREATE INDEX "PrintJob_printerStationId_idx" ON "PrintJob"("printerStationId");
CREATE INDEX "PrintJob_kitchenTicketId_status_idx" ON "PrintJob"("kitchenTicketId", "status");
CREATE INDEX "PrintJob_orderId_idx" ON "PrintJob"("orderId");
CREATE INDEX "PrintJob_requestedByStaffUserId_idx" ON "PrintJob"("requestedByStaffUserId");
CREATE INDEX "PrintJob_status_idx" ON "PrintJob"("status");
CREATE INDEX "PrintJob_createdAt_idx" ON "PrintJob"("createdAt");

CREATE INDEX "PrintJobEvent_printJobId_idx" ON "PrintJobEvent"("printJobId");
CREATE INDEX "PrintJobEvent_status_idx" ON "PrintJobEvent"("status");
CREATE INDEX "PrintJobEvent_createdAt_idx" ON "PrintJobEvent"("createdAt");

ALTER TABLE "PrinterStation" ADD CONSTRAINT "PrinterStation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrinterStation" ADD CONSTRAINT "PrinterStation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTicket" ADD CONSTRAINT "KitchenTicket_tableSessionId_fkey" FOREIGN KEY ("tableSessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "KitchenTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_preparationTaskId_fkey" FOREIGN KEY ("preparationTaskId") REFERENCES "PreparationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "KitchenTicketItem" ADD CONSTRAINT "KitchenTicketItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_printerStationId_fkey" FOREIGN KEY ("printerStationId") REFERENCES "PrinterStation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_kitchenTicketId_fkey" FOREIGN KEY ("kitchenTicketId") REFERENCES "KitchenTicket"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PrintJob" ADD CONSTRAINT "PrintJob_requestedByStaffUserId_fkey" FOREIGN KEY ("requestedByStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintJobEvent" ADD CONSTRAINT "PrintJobEvent_printJobId_fkey" FOREIGN KEY ("printJobId") REFERENCES "PrintJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PrintJobEvent" ADD CONSTRAINT "PrintJobEvent_actorStaffUserId_fkey" FOREIGN KEY ("actorStaffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
