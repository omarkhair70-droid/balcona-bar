-- CreateEnum
CREATE TYPE "InventoryUnit" AS ENUM ('piece', 'gram', 'milliliter');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('opening_balance', 'stock_in', 'stock_out', 'correction', 'waste', 'sale_consumption', 'sale_reversal');

-- CreateEnum
CREATE TYPE "InventoryStockStatus" AS ENUM ('in_stock', 'low_stock', 'out_of_stock');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "unit" "InventoryUnit" NOT NULL,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'active',
    "parLevelQuantity" INTEGER,
    "lowStockThresholdQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchInventoryLevel" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStockThresholdQuantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchInventoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "staffUserId" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItemInventoryRequirement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "quantityRequired" INTEGER NOT NULL,
    "unit" "InventoryUnit" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItemInventoryRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_idx" ON "InventoryItem"("companyId");

-- CreateIndex
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

-- CreateIndex
CREATE INDEX "InventoryItem_companyId_status_idx" ON "InventoryItem"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_companyId_sku_key" ON "InventoryItem"("companyId", "sku");

-- CreateIndex
CREATE INDEX "BranchInventoryLevel_companyId_idx" ON "BranchInventoryLevel"("companyId");

-- CreateIndex
CREATE INDEX "BranchInventoryLevel_branchId_idx" ON "BranchInventoryLevel"("branchId");

-- CreateIndex
CREATE INDEX "BranchInventoryLevel_inventoryItemId_idx" ON "BranchInventoryLevel"("inventoryItemId");

-- CreateIndex
CREATE INDEX "BranchInventoryLevel_branchId_quantityOnHand_idx" ON "BranchInventoryLevel"("branchId", "quantityOnHand");

-- CreateIndex
CREATE UNIQUE INDEX "BranchInventoryLevel_branchId_inventoryItemId_key" ON "BranchInventoryLevel"("branchId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyId_idx" ON "InventoryMovement"("companyId");

-- CreateIndex
CREATE INDEX "InventoryMovement_branchId_idx" ON "InventoryMovement"("branchId");

-- CreateIndex
CREATE INDEX "InventoryMovement_inventoryItemId_idx" ON "InventoryMovement"("inventoryItemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_staffUserId_idx" ON "InventoryMovement"("staffUserId");

-- CreateIndex
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_branchId_createdAt_idx" ON "InventoryMovement"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryMovement_sourceType_sourceId_idx" ON "InventoryMovement"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "MenuItemInventoryRequirement_companyId_idx" ON "MenuItemInventoryRequirement"("companyId");

-- CreateIndex
CREATE INDEX "MenuItemInventoryRequirement_menuItemId_idx" ON "MenuItemInventoryRequirement"("menuItemId");

-- CreateIndex
CREATE INDEX "MenuItemInventoryRequirement_inventoryItemId_idx" ON "MenuItemInventoryRequirement"("inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "MenuItemInventoryRequirement_menuItemId_inventoryItemId_key" ON "MenuItemInventoryRequirement"("menuItemId", "inventoryItemId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchInventoryLevel" ADD CONSTRAINT "BranchInventoryLevel_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchInventoryLevel" ADD CONSTRAINT "BranchInventoryLevel_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchInventoryLevel" ADD CONSTRAINT "BranchInventoryLevel_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemInventoryRequirement" ADD CONSTRAINT "MenuItemInventoryRequirement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemInventoryRequirement" ADD CONSTRAINT "MenuItemInventoryRequirement_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItemInventoryRequirement" ADD CONSTRAINT "MenuItemInventoryRequirement_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
