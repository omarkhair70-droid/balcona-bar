import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryStockStatus,
  InventoryUnit,
  MenuCategoryStatus,
  MenuItemStatus,
  Prisma,
  PurchaseOrderStatus,
  SaasFeatureKey,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SaasService } from '../saas/saas.service';
import {
  AdjustInventoryLevelDto,
  CreateInventoryItemDto,
  CreatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
  CreateSupplierDto,
  ReceivePurchaseOrderDto,
  ReplaceMenuItemInventoryRequirementsDto,
  UpdateInventoryItemDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseOrderLineDto,
  UpdateSupplierDto,
} from './dto/inventory.dto';

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

type StockCheckItem = {
  menuItemId: string;
  quantity: number;
  cartItemId?: string;
  orderItemId?: string;
  itemNameSnapshot?: string;
};

type StockIssue = {
  code: string;
  message: string;
  menuItemId: string;
  cartItemId?: string;
  orderItemId?: string;
  itemNameSnapshot?: string;
  details?: Record<string, unknown>;
};

const companySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
} satisfies Prisma.CompanySelect;

const branchSelect = {
  id: true,
  companyId: true,
  name: true,
  slug: true,
  address: true,
  status: true,
  company: {
    select: companySelect,
  },
} satisfies Prisma.BranchSelect;

const inventoryItemSelect = {
  id: true,
  companyId: true,
  name: true,
  sku: true,
  unit: true,
  status: true,
  parLevelQuantity: true,
  lowStockThresholdQuantity: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

const inventoryLevelSelect = {
  id: true,
  companyId: true,
  branchId: true,
  inventoryItemId: true,
  quantityOnHand: true,
  reservedQuantity: true,
  lowStockThresholdQuantity: true,
  createdAt: true,
  updatedAt: true,
  inventoryItem: {
    select: inventoryItemSelect,
  },
} satisfies Prisma.BranchInventoryLevelSelect;

const movementSelect = {
  id: true,
  companyId: true,
  branchId: true,
  inventoryItemId: true,
  staffUserId: true,
  type: true,
  quantityDelta: true,
  quantityAfter: true,
  unit: true,
  sourceType: true,
  sourceId: true,
  note: true,
  createdAt: true,
  inventoryItem: {
    select: inventoryItemSelect,
  },
} satisfies Prisma.InventoryMovementSelect;

const supplierSelect = {
  id: true,
  companyId: true,
  name: true,
  contact: true,
  phone: true,
  email: true,
  taxId: true,
  address: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupplierSelect;

const purchaseOrderLineSelect = {
  id: true,
  purchaseOrderId: true,
  inventoryItemId: true,
  quantityOrdered: true,
  quantityReceived: true,
  unitCostMinor: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  inventoryItem: {
    select: inventoryItemSelect,
  },
} satisfies Prisma.PurchaseOrderLineSelect;

const inventoryReceiptLineSelect = {
  id: true,
  receiptId: true,
  purchaseOrderLineId: true,
  inventoryItemId: true,
  quantityReceived: true,
  unitCostMinor: true,
  createdAt: true,
  inventoryItem: {
    select: inventoryItemSelect,
  },
} satisfies Prisma.InventoryReceiptLineSelect;

const purchaseOrderSelect = {
  id: true,
  companyId: true,
  branchId: true,
  supplierId: true,
  orderNumber: true,
  status: true,
  expectedAt: true,
  notes: true,
  currency: true,
  createdByStaffUserId: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: supplierSelect,
  },
  lines: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: purchaseOrderLineSelect,
  },
} satisfies Prisma.PurchaseOrderSelect;

const inventoryReceiptSelect = {
  id: true,
  companyId: true,
  branchId: true,
  supplierId: true,
  purchaseOrderId: true,
  receiptNumber: true,
  receivedAt: true,
  notes: true,
  createdByStaffUserId: true,
  createdAt: true,
  updatedAt: true,
  supplier: {
    select: supplierSelect,
  },
  lines: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    select: inventoryReceiptLineSelect,
  },
} satisfies Prisma.InventoryReceiptSelect;

type InventoryMovementRecord = Prisma.InventoryMovementGetPayload<{
  select: typeof movementSelect;
}>;

type MissingInventoryRequirement = {
  inventoryItemId: string;
  name: string;
  unit: InventoryUnit;
  quantityRequired: number;
  quantityOnHand: number;
  shortageQuantity: number;
  reason: string;
};

type LowStockInventoryRequirement = {
  inventoryItemId: string;
  name: string;
  unit: InventoryUnit;
  quantityRequired: number;
  quantityOnHand: number;
  quantityAfter: number;
  threshold: number;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly saasService: SaasService,
  ) {}

  async listInventoryItems(companyId: string) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const items = await this.prisma.inventoryItem.findMany({
      where: { companyId, status: { not: InventoryItemStatus.archived } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: inventoryItemSelect,
    });

    return { company, items };
  }

  async createInventoryItem(
    companyId: string,
    body: CreateInventoryItemDto,
  ) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    await this.saasService.assertCompanyFeatureEnabled(
      company.id,
      SaasFeatureKey.inventory,
    );
    await this.saasService.assertWithinLimit(
      company.id,
      'maxInventoryItems',
      1,
    );

    try {
      const item = await this.prisma.inventoryItem.create({
        data: {
          companyId: company.id,
          name: body.name.trim(),
          sku: this.normalizeSku(body.sku),
          unit: body.unit,
          lowStockThresholdQuantity: this.nullableQuantity(
            body.lowStockThresholdQuantity,
          ),
          parLevelQuantity: this.nullableQuantity(body.parLevelQuantity),
        },
        select: inventoryItemSelect,
      });

      return { company, item };
    } catch (error) {
      this.handleKnownWriteError(error, 'Inventory SKU must be unique');
    }
  }

  async updateInventoryItem(
    inventoryItemId: string,
    body: UpdateInventoryItemDto,
  ) {
    const existing = await this.findInventoryItemOrThrow(
      inventoryItemId,
      this.prisma,
    );
    await this.saasService.assertCompanyFeatureEnabled(
      existing.companyId,
      SaasFeatureKey.inventory,
    );
    const data: Prisma.InventoryItemUpdateInput = {};

    if (body.name !== undefined) {
      data.name = body.name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, 'sku')) {
      data.sku = this.normalizeSku(body.sku);
    }

    if (body.status !== undefined) {
      data.status = body.status;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        body,
        'lowStockThresholdQuantity',
      )
    ) {
      data.lowStockThresholdQuantity = this.nullableQuantity(
        body.lowStockThresholdQuantity,
      );
    }

    if (Object.prototype.hasOwnProperty.call(body, 'parLevelQuantity')) {
      data.parLevelQuantity = this.nullableQuantity(body.parLevelQuantity);
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one inventory item field');
    }

    try {
      const item = await this.prisma.inventoryItem.update({
        where: { id: existing.id },
        data,
        select: inventoryItemSelect,
      });

      return {
        company: await this.findCompanyOrThrow(item.companyId, this.prisma),
        item,
      };
    } catch (error) {
      this.handleKnownWriteError(error, 'Inventory SKU must be unique');
    }
  }

  async getBranchInventoryLevels(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const [items, levels, recentMovement] = await Promise.all([
      this.prisma.inventoryItem.findMany({
        where: {
          companyId: branch.companyId,
          status: { not: InventoryItemStatus.archived },
        },
        orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: inventoryItemSelect,
      }),
      this.prisma.branchInventoryLevel.findMany({
        where: { branchId },
        select: inventoryLevelSelect,
      }),
      this.prisma.inventoryMovement.findFirst({
        where: { branchId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      }),
    ]);
    const levelByItemId = new Map(
      levels.map((level) => [level.inventoryItemId, level]),
    );
    const rows = items.map((item) => {
      const level = levelByItemId.get(item.id);

      return this.toLevelRow(branchId, item, level);
    });

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      levels: rows,
      summary: this.summarizeLevelRows(rows),
      lastMovementAt: recentMovement?.createdAt ?? null,
    };
  }

  async getBranchInventoryAlerts(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const levels = await this.getBranchInventoryLevels(branchId);
    const menuAvailability = await this.getBranchMenuAvailability(branchId);
    const recentMovements = await this.prisma.inventoryMovement.findMany({
      where: { branchId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 10,
      select: movementSelect,
    });
    const lowStockLevels = levels.levels.filter(
      (level) => level.stockStatus === InventoryStockStatus.low_stock,
    );
    const outOfStockLevels = levels.levels.filter(
      (level) => level.stockStatus === InventoryStockStatus.out_of_stock,
    );
    const stockBlockedMenuItems = menuAvailability.items.filter(
      (item) =>
        item.stockStatus === InventoryStockStatus.out_of_stock ||
        item.reasons.includes('stock_blocked'),
    );

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      lowStockLevels,
      outOfStockLevels,
      stockBlockedMenuItems,
      recentMovements,
      summary: {
        lowStockCount: lowStockLevels.length,
        outOfStockCount: outOfStockLevels.length,
        stockBlockedMenuItemCount: stockBlockedMenuItems.length,
      },
    };
  }

  async adjustBranchInventoryLevel(
    branchId: string,
    inventoryItemId: string,
    body: AdjustInventoryLevelDto,
    staffUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const item = await this.findInventoryItemOrThrow(inventoryItemId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        branch.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertInventoryItemUsableForBranch(item, branch);
      await this.lockInventoryLevel(branch.id, item.id, tx);

      const existingLevel = await tx.branchInventoryLevel.findUnique({
        where: {
          branchId_inventoryItemId: {
            branchId: branch.id,
            inventoryItemId: item.id,
          },
        },
        select: {
          id: true,
          quantityOnHand: true,
          lowStockThresholdQuantity: true,
        },
      });
      const currentQuantity = existingLevel?.quantityOnHand ?? 0;
      const { quantityDelta, quantityAfter } = this.resolveManualMovement(
        body,
        currentQuantity,
      );

      if (quantityAfter < 0) {
        throw new BadRequestException('Inventory adjustment cannot make stock negative');
      }

      const level = existingLevel
        ? await tx.branchInventoryLevel.update({
            where: { id: existingLevel.id },
            data: { quantityOnHand: quantityAfter },
            select: inventoryLevelSelect,
          })
        : await tx.branchInventoryLevel.create({
            data: {
              companyId: branch.companyId,
              branchId: branch.id,
              inventoryItemId: item.id,
              quantityOnHand: quantityAfter,
            },
            select: inventoryLevelSelect,
          });
      const movement = await tx.inventoryMovement.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          inventoryItemId: item.id,
          staffUserId,
          type: body.type,
          quantityDelta,
          quantityAfter,
          unit: item.unit,
          sourceType: 'manual_adjustment',
          note: this.normalizeOptionalText(body.note),
        },
        select: movementSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        level: this.toLevelRow(branch.id, item, level),
        movement,
      };
    });
  }

  async getMenuItemInventoryRequirements(menuItemId: string) {
    const menuItem = await this.findMenuItemOrThrow(menuItemId, this.prisma);
    const requirements = await this.prisma.menuItemInventoryRequirement.findMany({
      where: { menuItemId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: this.requirementSelect(),
    });

    return {
      item: this.toMenuItemSummary(menuItem),
      requirements,
    };
  }

  async replaceMenuItemInventoryRequirements(
    menuItemId: string,
    body: ReplaceMenuItemInventoryRequirementsDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const menuItem = await this.findMenuItemOrThrow(menuItemId, tx);
      await this.saasService.assertCompanyFeatureEnabled(
        menuItem.companyId,
        SaasFeatureKey.inventory,
      );
      const uniqueInventoryIds = [...new Set(body.requirements.map((entry) => entry.inventoryItemId))];

      if (uniqueInventoryIds.length !== body.requirements.length) {
        throw new BadRequestException('Duplicate inventory requirements are not allowed');
      }

      const inventoryItems = uniqueInventoryIds.length
        ? await tx.inventoryItem.findMany({
            where: { id: { in: uniqueInventoryIds } },
            select: inventoryItemSelect,
          })
        : [];
      const inventoryById = new Map(
        inventoryItems.map((item) => [item.id, item]),
      );
      const createManyData = body.requirements
        .map((entry) => {
          const inventoryItem = inventoryById.get(entry.inventoryItemId);

          if (!inventoryItem) {
            throw new NotFoundException('Inventory item not found');
          }

          if (inventoryItem.companyId !== menuItem.companyId) {
            throw new BadRequestException(
              'Inventory item does not belong to this menu item company',
            );
          }

          if (inventoryItem.status === InventoryItemStatus.archived) {
            throw new BadRequestException(
              'Archived inventory items cannot be linked to menu items',
            );
          }

          return {
            companyId: menuItem.companyId,
            menuItemId: menuItem.id,
            inventoryItemId: inventoryItem.id,
            quantityRequired: entry.quantityRequired,
            unit: inventoryItem.unit,
            isRequired: entry.isRequired ?? true,
          };
        })
        .sort((a, b) => a.inventoryItemId.localeCompare(b.inventoryItemId));

      await tx.menuItemInventoryRequirement.deleteMany({
        where: { menuItemId: menuItem.id },
      });

      if (createManyData.length > 0) {
        await tx.menuItemInventoryRequirement.createMany({
          data: createManyData,
        });
      }

      return this.getMenuItemInventoryRequirementsWithTx(menuItem.id, tx);
    });
  }

  async getBranchMenuAvailability(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const items = await this.prisma.menuItem.findMany({
      where: {
        companyId: branch.companyId,
        status: { not: MenuItemStatus.archived },
      },
      orderBy: [
        { category: { sortOrder: 'asc' } },
        { sortOrder: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
      select: this.menuItemStockSelect(branch.id),
    });
    const availability = items.map((item) =>
      this.toMenuItemAvailability(item, 1),
    );

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      items: availability,
      summary: {
        itemCount: availability.length,
        canOrderCount: availability.filter((item) => item.canOrder).length,
        lowStockCount: availability.filter(
          (item) => item.stockStatus === InventoryStockStatus.low_stock,
        ).length,
        outOfStockCount: availability.filter(
          (item) => item.stockStatus === InventoryStockStatus.out_of_stock,
        ).length,
        stockBlockedCount: availability.filter((item) =>
          item.reasons.includes('stock_blocked'),
        ).length,
      },
    };
  }

  async listSuppliers(companyId: string) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    const suppliers = await this.prisma.supplier.findMany({
      where: { companyId, status: { not: SupplierStatus.archived } },
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: supplierSelect,
    });

    return { company, suppliers };
  }

  async listBranchSuppliers(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        companyId: branch.companyId,
        status: { not: SupplierStatus.archived },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: supplierSelect,
    });

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      suppliers,
    };
  }

  async createSupplier(companyId: string, body: CreateSupplierDto) {
    const company = await this.findCompanyOrThrow(companyId, this.prisma);
    await this.saasService.assertCompanyFeatureEnabled(
      company.id,
      SaasFeatureKey.inventory,
    );

    const supplier = await this.prisma.supplier.create({
      data: {
        companyId: company.id,
        name: body.name.trim(),
        contact: this.normalizeOptionalText(body.contact),
        phone: this.normalizeOptionalText(body.phone),
        email: this.normalizeOptionalText(body.email),
        taxId: this.normalizeOptionalText(body.taxId),
        address: this.normalizeOptionalText(body.address),
        notes: this.normalizeOptionalText(body.notes),
        status: body.status ?? SupplierStatus.active,
      },
      select: supplierSelect,
    });

    return { company, supplier };
  }

  async updateSupplier(supplierId: string, body: UpdateSupplierDto) {
    const existing = await this.findSupplierOrThrow(supplierId, this.prisma);
    await this.saasService.assertCompanyFeatureEnabled(
      existing.companyId,
      SaasFeatureKey.inventory,
    );
    const data: Prisma.SupplierUpdateInput = {};

    if (body.name !== undefined) {
      data.name = body.name.trim();
    }

    for (const field of [
      'contact',
      'phone',
      'email',
      'taxId',
      'address',
      'notes',
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        data[field] = this.normalizeOptionalText(body[field]);
      }
    }

    if (body.status !== undefined) {
      data.status = body.status;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Provide at least one supplier field');
    }

    const supplier = await this.prisma.supplier.update({
      where: { id: existing.id },
      data,
      select: supplierSelect,
    });

    return {
      company: await this.findCompanyOrThrow(supplier.companyId, this.prisma),
      supplier,
    };
  }

  async listPurchaseOrders(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const purchaseOrders = await this.prisma.purchaseOrder.findMany({
      where: { branchId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: purchaseOrderSelect,
    });

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      purchaseOrders,
    };
  }

  async createPurchaseOrder(
    branchId: string,
    body: CreatePurchaseOrderDto,
    staffUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const branch = await this.findBranchOrThrow(branchId, tx);
      const supplier = await this.findSupplierOrThrow(body.supplierId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        branch.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertSupplierUsableForCompany(supplier, branch.companyId);

      const purchaseOrderCount = await tx.purchaseOrder.count({
        where: { branchId: branch.id },
      });
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          supplierId: supplier.id,
          orderNumber: this.buildSequenceNumber('PO', purchaseOrderCount + 1),
          expectedAt: this.optionalDate(body.expectedAt),
          notes: this.normalizeOptionalText(body.notes),
          currency: this.normalizeCurrency(body.currency),
          createdByStaffUserId: staffUserId,
        },
        select: purchaseOrderSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder,
      };
    });
  }

  async getPurchaseOrder(purchaseOrderId: string) {
    const purchaseOrder = await this.findPurchaseOrderOrThrow(
      purchaseOrderId,
      this.prisma,
    );
    const branch = await this.findBranchOrThrow(purchaseOrder.branchId, this.prisma);

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      purchaseOrder,
    };
  }

  async updatePurchaseOrder(
    purchaseOrderId: string,
    body: UpdatePurchaseOrderDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertDraftPurchaseOrder(purchaseOrder);

      const data: Prisma.PurchaseOrderUpdateInput = {};

      if (body.supplierId !== undefined) {
        const supplier = await this.findSupplierOrThrow(body.supplierId, tx);
        this.assertSupplierUsableForCompany(supplier, purchaseOrder.companyId);
        data.supplier = { connect: { id: supplier.id } };
      }

      if (Object.prototype.hasOwnProperty.call(body, 'expectedAt')) {
        data.expectedAt = this.optionalDate(body.expectedAt);
      }

      if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
        data.notes = this.normalizeOptionalText(body.notes);
      }

      if (body.currency !== undefined) {
        data.currency = this.normalizeCurrency(body.currency);
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestException('Provide at least one purchase order field');
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data,
        select: purchaseOrderSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
      };
    });
  }

  async submitPurchaseOrder(purchaseOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertDraftPurchaseOrder(purchaseOrder);

      if (purchaseOrder.lines.length === 0) {
        throw new BadRequestException(
          'Purchase order must have at least one line before submit',
        );
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: PurchaseOrderStatus.submitted },
        select: purchaseOrderSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
      };
    });
  }

  async cancelPurchaseOrder(purchaseOrderId: string) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );

      if (purchaseOrder.status === PurchaseOrderStatus.received) {
        throw new BadRequestException('Received purchase orders cannot be cancelled');
      }

      if (purchaseOrder.status === PurchaseOrderStatus.cancelled) {
        throw new BadRequestException('Purchase order is already cancelled');
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: PurchaseOrderStatus.cancelled },
        select: purchaseOrderSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
      };
    });
  }

  async addPurchaseOrderLine(
    purchaseOrderId: string,
    body: CreatePurchaseOrderLineDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const item = await this.findInventoryItemOrThrow(body.inventoryItemId, tx);
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertDraftPurchaseOrder(purchaseOrder);
      this.assertInventoryItemUsableForBranch(item, branch);

      if (
        purchaseOrder.lines.some(
          (line) => line.inventoryItemId === body.inventoryItemId,
        )
      ) {
        throw new BadRequestException(
          'Purchase order already has a line for this inventory item',
        );
      }

      await tx.purchaseOrderLine.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          inventoryItemId: item.id,
          quantityOrdered: body.quantityOrdered,
          unitCostMinor: body.unitCostMinor,
          notes: this.normalizeOptionalText(body.notes),
        },
      });

      const updated = await this.findPurchaseOrderOrThrow(purchaseOrder.id, tx);

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
      };
    });
  }

  async updatePurchaseOrderLine(
    purchaseOrderId: string,
    purchaseOrderLineId: string,
    body: UpdatePurchaseOrderLineDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);
      const line = purchaseOrder.lines.find(
        (entry) => entry.id === purchaseOrderLineId,
      );

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertDraftPurchaseOrder(purchaseOrder);

      if (!line) {
        throw new NotFoundException('Purchase order line not found');
      }

      const data: Prisma.PurchaseOrderLineUpdateInput = {};

      if (body.quantityOrdered !== undefined) {
        if (body.quantityOrdered < line.quantityReceived) {
          throw new BadRequestException(
            'Ordered quantity cannot be below received quantity',
          );
        }

        data.quantityOrdered = body.quantityOrdered;
      }

      if (body.unitCostMinor !== undefined) {
        data.unitCostMinor = body.unitCostMinor;
      }

      if (Object.prototype.hasOwnProperty.call(body, 'notes')) {
        data.notes = this.normalizeOptionalText(body.notes);
      }

      if (Object.keys(data).length === 0) {
        throw new BadRequestException('Provide at least one purchase order line field');
      }

      await tx.purchaseOrderLine.update({
        where: { id: line.id },
        data,
      });

      const updated = await this.findPurchaseOrderOrThrow(purchaseOrder.id, tx);

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
      };
    });
  }

  async removePurchaseOrderLine(
    purchaseOrderId: string,
    purchaseOrderLineId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);
      const line = purchaseOrder.lines.find(
        (entry) => entry.id === purchaseOrderLineId,
      );

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertDraftPurchaseOrder(purchaseOrder);

      if (!line) {
        throw new NotFoundException('Purchase order line not found');
      }

      await tx.purchaseOrderLine.delete({ where: { id: line.id } });

      const updated = await this.findPurchaseOrderOrThrow(purchaseOrder.id, tx);

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updated,
        deleted: true,
      };
    });
  }

  async receivePurchaseOrder(
    purchaseOrderId: string,
    body: ReceivePurchaseOrderDto,
    staffUserId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.findPurchaseOrderOrThrow(
        purchaseOrderId,
        tx,
      );
      const branch = await this.findBranchOrThrow(purchaseOrder.branchId, tx);

      await this.saasService.assertCompanyFeatureEnabled(
        purchaseOrder.companyId,
        SaasFeatureKey.inventory,
      );
      this.assertReceivablePurchaseOrder(purchaseOrder);

      const receiptLines = this.resolveReceiptLines(purchaseOrder, body);
      const receiptCount = await tx.inventoryReceipt.count({
        where: { branchId: purchaseOrder.branchId },
      });
      const receiptNumber = this.buildSequenceNumber('GR', receiptCount + 1);
      const receipt = await tx.inventoryReceipt.create({
        data: {
          companyId: purchaseOrder.companyId,
          branchId: purchaseOrder.branchId,
          supplierId: purchaseOrder.supplierId,
          purchaseOrderId: purchaseOrder.id,
          receiptNumber,
          receivedAt: this.optionalDate(body.receivedAt) ?? undefined,
          notes: this.normalizeOptionalText(body.notes),
          createdByStaffUserId: staffUserId,
        },
        select: { id: true },
      });
      const movements: InventoryMovementRecord[] = [];

      for (const entry of receiptLines) {
        const line = entry.line;
        const quantityReceived = entry.quantityReceived;
        const unitCostMinor = entry.unitCostMinor ?? line.unitCostMinor;
        const guardedLineUpdate = await tx.purchaseOrderLine.updateMany({
          where: {
            id: line.id,
            quantityReceived: {
              lte: line.quantityOrdered - quantityReceived,
            },
          },
          data: { quantityReceived: { increment: quantityReceived } },
        });

        if (guardedLineUpdate.count === 0) {
          throw new BadRequestException(
            `${line.inventoryItem.name} was already received or cannot be over-received`,
          );
        }

        await this.lockInventoryLevel(branch.id, line.inventoryItemId, tx);

        const existingLevel = await tx.branchInventoryLevel.findUnique({
          where: {
            branchId_inventoryItemId: {
              branchId: branch.id,
              inventoryItemId: line.inventoryItemId,
            },
          },
          select: {
            id: true,
            quantityOnHand: true,
            lowStockThresholdQuantity: true,
          },
        });
        const quantityAfter =
          (existingLevel?.quantityOnHand ?? 0) + quantityReceived;

        if (existingLevel) {
          await tx.branchInventoryLevel.update({
            where: { id: existingLevel.id },
            data: { quantityOnHand: quantityAfter },
            select: inventoryLevelSelect,
          });
        } else {
          await tx.branchInventoryLevel.create({
            data: {
              companyId: branch.companyId,
              branchId: branch.id,
              inventoryItemId: line.inventoryItemId,
              quantityOnHand: quantityAfter,
            },
            select: inventoryLevelSelect,
          });
        }

        await tx.inventoryReceiptLine.create({
          data: {
            receiptId: receipt.id,
            purchaseOrderLineId: line.id,
            inventoryItemId: line.inventoryItemId,
            quantityReceived,
            unitCostMinor,
          },
        });

        movements.push(
          await tx.inventoryMovement.create({
            data: {
              companyId: branch.companyId,
              branchId: branch.id,
              inventoryItemId: line.inventoryItemId,
              staffUserId,
              type: InventoryMovementType.stock_in,
              quantityDelta: quantityReceived,
              quantityAfter,
              unit: line.inventoryItem.unit,
              sourceType: 'purchase_order_receipt',
              sourceId: receipt.id,
              note: this.receiptMovementNote(
                purchaseOrder.orderNumber,
                receiptNumber,
                body.notes,
              ),
            },
            select: movementSelect,
          }),
        );
      }

      const freshLines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: purchaseOrder.id },
        select: {
          quantityOrdered: true,
          quantityReceived: true,
        },
      });
      const nextStatus = freshLines.every(
        (line) => line.quantityReceived >= line.quantityOrdered,
      )
        ? PurchaseOrderStatus.received
        : PurchaseOrderStatus.partially_received;
      const updatedPurchaseOrder = await tx.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: nextStatus },
        select: purchaseOrderSelect,
      });
      const fullReceipt = await tx.inventoryReceipt.findUnique({
        where: { id: receipt.id },
        select: inventoryReceiptSelect,
      });

      return {
        branch: this.toBranchSummary(branch),
        company: branch.company,
        purchaseOrder: updatedPurchaseOrder,
        receipt: fullReceipt,
        movements,
      };
    });
  }

  async listInventoryReceipts(branchId: string) {
    const branch = await this.findBranchOrThrow(branchId, this.prisma);
    const receipts = await this.prisma.inventoryReceipt.findMany({
      where: { branchId },
      orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: inventoryReceiptSelect,
    });

    return {
      branch: this.toBranchSummary(branch),
      company: branch.company,
      receipts,
    };
  }

  async assertMenuItemsCanOrder(
    companyId: string,
    branchId: string,
    items: StockCheckItem[],
    tx: PrismaExecutor,
  ) {
    const issues = await this.getStockIssuesForItems(
      companyId,
      branchId,
      items,
      tx,
    );

    if (issues.length > 0) {
      throw new BadRequestException({
        message: 'Item is out of stock',
        issues,
      });
    }
  }

  async getStockIssuesForItems(
    companyId: string,
    branchId: string,
    items: StockCheckItem[],
    tx: PrismaExecutor = this.prisma,
  ): Promise<StockIssue[]> {
    const quantities = this.aggregateStockCheckItems(items);

    if (quantities.length === 0) {
      return [];
    }

    const menuItems = await tx.menuItem.findMany({
      where: {
        companyId,
        id: { in: quantities.map((item) => item.menuItemId) },
      },
      select: this.menuItemStockSelect(branchId),
    });
    const menuItemById = new Map(menuItems.map((item) => [item.id, item]));
    const issues: StockIssue[] = [];

    for (const item of quantities) {
      const menuItem = menuItemById.get(item.menuItemId);

      if (!menuItem) {
        issues.push({
          code: 'item_missing',
          message: 'Menu item no longer exists',
          menuItemId: item.menuItemId,
          cartItemId: item.cartItemId,
          orderItemId: item.orderItemId,
          itemNameSnapshot: item.itemNameSnapshot,
        });
        continue;
      }

      const availability = this.toMenuItemAvailability(menuItem, item.quantity);

      if (!availability.canOrder) {
        issues.push({
          code: availability.reasons.includes('stock_blocked')
            ? 'item_out_of_stock'
            : 'item_unavailable',
          message: availability.reasons.includes('stock_blocked')
            ? 'Item is out of stock'
            : 'Menu item is not available',
          menuItemId: item.menuItemId,
          cartItemId: item.cartItemId,
          orderItemId: item.orderItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          details: {
            stockStatus: availability.stockStatus,
            reasons: availability.reasons,
            missingRequirements: availability.missingRequirements,
          },
        });
      }
    }

    return issues;
  }

  async consumeStockForAcceptedOrder(
    orderId: string,
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        items: {
          select: {
            id: true,
            menuItemId: true,
            quantity: true,
            itemNameSnapshot: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.consumeStockForOrderItems(order, staffUserId, tx);
  }

  private async consumeStockForOrderItems(
    order: {
      id: string;
      companyId: string;
      branchId: string;
      items: Array<{
        id: string;
        menuItemId: string;
        quantity: number;
        itemNameSnapshot?: string | null;
      }>;
    },
    staffUserId: string | undefined,
    tx: Prisma.TransactionClient,
  ) {
    const quantities = this.aggregateStockCheckItems(
      order.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        orderItemId: item.id,
        itemNameSnapshot: item.itemNameSnapshot ?? undefined,
      })),
    );
    const menuItemIds = quantities.map((item) => item.menuItemId);

    if (menuItemIds.length === 0) {
      return { consumed: false, movements: [] };
    }

    const requirements = await tx.menuItemInventoryRequirement.findMany({
      where: {
        menuItemId: { in: menuItemIds },
        isRequired: true,
      },
      select: {
        menuItemId: true,
        inventoryItemId: true,
        quantityRequired: true,
        unit: true,
        inventoryItem: {
          select: inventoryItemSelect,
        },
      },
    });

    if (requirements.length === 0) {
      return { consumed: false, movements: [] };
    }

    const quantityByMenuItemId = new Map(
      quantities.map((item) => [item.menuItemId, item.quantity]),
    );
    const requirementByInventoryItemId = new Map<
      string,
      {
        inventoryItemId: string;
        totalQuantity: number;
        unit: (typeof requirements)[number]['unit'];
        inventoryItem: (typeof requirements)[number]['inventoryItem'];
      }
    >();

    for (const requirement of requirements) {
      const orderQuantity = quantityByMenuItemId.get(requirement.menuItemId) ?? 0;
      const totalQuantity = requirement.quantityRequired * orderQuantity;
      const existing = requirementByInventoryItemId.get(
        requirement.inventoryItemId,
      );

      requirementByInventoryItemId.set(requirement.inventoryItemId, {
        inventoryItemId: requirement.inventoryItemId,
        totalQuantity: (existing?.totalQuantity ?? 0) + totalQuantity,
        unit: requirement.unit,
        inventoryItem: requirement.inventoryItem,
      });
    }

    const movements: InventoryMovementRecord[] = [];

    for (const requirement of requirementByInventoryItemId.values()) {
      if (requirement.totalQuantity <= 0) {
        continue;
      }

      if (requirement.inventoryItem.status !== InventoryItemStatus.active) {
        throw new BadRequestException('Item is out of stock');
      }

      await this.lockInventoryLevel(
        order.branchId,
        requirement.inventoryItemId,
        tx,
      );
      const level = await tx.branchInventoryLevel.findUnique({
        where: {
          branchId_inventoryItemId: {
            branchId: order.branchId,
            inventoryItemId: requirement.inventoryItemId,
          },
        },
        select: { id: true, quantityOnHand: true },
      });

      if (!level || level.quantityOnHand < requirement.totalQuantity) {
        throw new BadRequestException('Item is out of stock');
      }

      const quantityAfter = level.quantityOnHand - requirement.totalQuantity;
      const updatedLevel = await tx.branchInventoryLevel.updateMany({
        where: {
          id: level.id,
          quantityOnHand: { gte: requirement.totalQuantity },
        },
        data: { quantityOnHand: { decrement: requirement.totalQuantity } },
      });

      if (updatedLevel.count === 0) {
        throw new BadRequestException('Item is out of stock');
      }

      movements.push(
        await tx.inventoryMovement.create({
          data: {
            companyId: order.companyId,
            branchId: order.branchId,
            inventoryItemId: requirement.inventoryItemId,
            staffUserId,
            type: InventoryMovementType.sale_consumption,
            quantityDelta: -requirement.totalQuantity,
            quantityAfter,
            unit: requirement.unit,
            sourceType: 'order',
            sourceId: order.id,
          },
          select: movementSelect,
        }),
      );
    }

    return { consumed: movements.length > 0, movements };
  }

  private async getMenuItemInventoryRequirementsWithTx(
    menuItemId: string,
    tx: PrismaExecutor,
  ) {
    const menuItem = await this.findMenuItemOrThrow(menuItemId, tx);
    const requirements = await tx.menuItemInventoryRequirement.findMany({
      where: { menuItemId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: this.requirementSelect(),
    });

    return {
      item: this.toMenuItemSummary(menuItem),
      requirements,
    };
  }

  private aggregateStockCheckItems(items: StockCheckItem[]) {
    const byMenuItemId = new Map<string, StockCheckItem>();

    for (const item of items) {
      if (!item.menuItemId || item.quantity <= 0) {
        continue;
      }

      const existing = byMenuItemId.get(item.menuItemId);

      byMenuItemId.set(item.menuItemId, {
        ...item,
        quantity: (existing?.quantity ?? 0) + item.quantity,
        cartItemId: existing?.cartItemId ?? item.cartItemId,
        orderItemId: existing?.orderItemId ?? item.orderItemId,
        itemNameSnapshot: existing?.itemNameSnapshot ?? item.itemNameSnapshot,
      });
    }

    return [...byMenuItemId.values()];
  }

  private toMenuItemAvailability(item: any, requestedQuantity: number) {
    const override = item.branchOverrides[0];
    const branchVisible = Boolean(override?.isVisible);
    const branchAvailable = Boolean(override?.isAvailable);
    const reasons: string[] = [];

    if (item.status !== MenuItemStatus.active) {
      reasons.push('item_inactive');
    }

    if (item.category.status !== MenuCategoryStatus.active) {
      reasons.push('category_inactive');
    }

    if (!override) {
      reasons.push('branch_override_missing');
    } else {
      if (!override.isVisible) {
        reasons.push('manual_hidden');
      }

      if (!override.isAvailable) {
        reasons.push('manual_unavailable');
      }
    }

    const requiredRequirements = item.inventoryRequirements.filter(
      (requirement) => requirement.isRequired,
    );
    const missingRequirements: MissingInventoryRequirement[] = [];
    const lowStockRequirements: LowStockInventoryRequirement[] = [];

    for (const requirement of requiredRequirements) {
      const inventoryItem = requirement.inventoryItem;
      const level = inventoryItem.branchLevels[0];
      const requiredQuantity = requirement.quantityRequired * requestedQuantity;

      if (inventoryItem.status !== InventoryItemStatus.active) {
        missingRequirements.push({
          inventoryItemId: inventoryItem.id,
          name: inventoryItem.name,
          unit: requirement.unit,
          quantityRequired: requiredQuantity,
          quantityOnHand: 0,
          shortageQuantity: requiredQuantity,
          reason: 'inventory_item_inactive',
        });
        continue;
      }

      if (!level || level.quantityOnHand < requiredQuantity) {
        missingRequirements.push({
          inventoryItemId: inventoryItem.id,
          name: inventoryItem.name,
          unit: requirement.unit,
          quantityRequired: requiredQuantity,
          quantityOnHand: level?.quantityOnHand ?? 0,
          shortageQuantity: Math.max(
            requiredQuantity - (level?.quantityOnHand ?? 0),
            0,
          ),
          reason: 'insufficient_stock',
        });
        continue;
      }

      const threshold =
        level.lowStockThresholdQuantity ??
        inventoryItem.lowStockThresholdQuantity;
      const quantityAfter = level.quantityOnHand - requiredQuantity;

      if (threshold !== null && threshold !== undefined && quantityAfter < threshold) {
        lowStockRequirements.push({
          inventoryItemId: inventoryItem.id,
          name: inventoryItem.name,
          unit: requirement.unit,
          quantityRequired: requiredQuantity,
          quantityOnHand: level.quantityOnHand,
          quantityAfter,
          threshold,
        });
      }
    }

    if (missingRequirements.length > 0) {
      reasons.push('stock_blocked');
    }

    const stockStatus =
      missingRequirements.length > 0
        ? InventoryStockStatus.out_of_stock
        : lowStockRequirements.length > 0
          ? InventoryStockStatus.low_stock
          : InventoryStockStatus.in_stock;
    const canOrder =
      item.status === MenuItemStatus.active &&
      item.category.status === MenuCategoryStatus.active &&
      branchVisible &&
      branchAvailable &&
      stockStatus !== InventoryStockStatus.out_of_stock;

    return {
      menuItemId: item.id,
      name: item.name,
      slug: item.slug,
      category: item.category,
      branchVisible,
      branchAvailable,
      stockStatus,
      missingRequirements,
      lowStockRequirements,
      canOrder,
      reasons,
    };
  }

  private toLevelRow(branchId: string, item: any, level?: any) {
    const threshold =
      level?.lowStockThresholdQuantity ?? item.lowStockThresholdQuantity;
    const quantityOnHand = level?.quantityOnHand ?? 0;
    const stockStatus =
      quantityOnHand <= 0
        ? InventoryStockStatus.out_of_stock
        : threshold !== null && threshold !== undefined && quantityOnHand <= threshold
          ? InventoryStockStatus.low_stock
          : InventoryStockStatus.in_stock;

    return {
      id: level?.id ?? null,
      branchId,
      inventoryItemId: item.id,
      item,
      quantityOnHand,
      reservedQuantity: level?.reservedQuantity ?? 0,
      lowStockThresholdQuantity: threshold ?? null,
      stockStatus,
      createdAt: level?.createdAt ?? null,
      updatedAt: level?.updatedAt ?? null,
    };
  }

  private summarizeLevelRows(rows: ReturnType<InventoryService['toLevelRow']>[]) {
    return {
      totalInventoryItemCount: rows.length,
      trackedLevelCount: rows.filter((row) => row.id).length,
      lowStockCount: rows.filter(
        (row) => row.stockStatus === InventoryStockStatus.low_stock,
      ).length,
      outOfStockCount: rows.filter(
        (row) => row.stockStatus === InventoryStockStatus.out_of_stock,
      ).length,
    };
  }

  private resolveManualMovement(
    body: AdjustInventoryLevelDto,
    currentQuantity: number,
  ) {
    if (body.type === InventoryMovementType.correction) {
      if (body.finalQuantity === undefined) {
        throw new BadRequestException('Correction requires finalQuantity');
      }

      return {
        quantityDelta: body.finalQuantity - currentQuantity,
        quantityAfter: body.finalQuantity,
      };
    }

    if (body.finalQuantity !== undefined) {
      throw new BadRequestException('finalQuantity is only allowed for correction');
    }

    if (body.quantity === undefined) {
      throw new BadRequestException('Inventory adjustment requires quantity');
    }

    const sign =
      body.type === InventoryMovementType.stock_out ||
      body.type === InventoryMovementType.waste
        ? -1
        : 1;
    const quantityDelta = body.quantity * sign;

    return {
      quantityDelta,
      quantityAfter: currentQuantity + quantityDelta,
    };
  }

  private resolveReceiptLines(
    purchaseOrder: Prisma.PurchaseOrderGetPayload<{
      select: typeof purchaseOrderSelect;
    }>,
    body: ReceivePurchaseOrderDto,
  ) {
    const seen = new Set<string>();
    const lineById = new Map(
      purchaseOrder.lines.map((line) => [line.id, line]),
    );

    return body.lines.map((entry) => {
      if (seen.has(entry.purchaseOrderLineId)) {
        throw new BadRequestException('Duplicate receipt lines are not allowed');
      }

      seen.add(entry.purchaseOrderLineId);
      const line = lineById.get(entry.purchaseOrderLineId);

      if (!line) {
        throw new NotFoundException('Purchase order line not found');
      }

      if (line.inventoryItem.status === InventoryItemStatus.archived) {
        throw new BadRequestException('Archived inventory item cannot be received');
      }

      const remaining = line.quantityOrdered - line.quantityReceived;

      if (remaining <= 0) {
        throw new BadRequestException(
          `${line.inventoryItem.name} has already been fully received`,
        );
      }

      if (entry.quantityReceived > remaining) {
        throw new BadRequestException(
          `${line.inventoryItem.name} cannot be over-received`,
        );
      }

      return {
        line,
        quantityReceived: entry.quantityReceived,
        unitCostMinor: entry.unitCostMinor,
      };
    });
  }

  private assertDraftPurchaseOrder(
    purchaseOrder: Pick<
      Prisma.PurchaseOrderGetPayload<{ select: typeof purchaseOrderSelect }>,
      'status'
    >,
  ) {
    if (purchaseOrder.status !== PurchaseOrderStatus.draft) {
      throw new BadRequestException('Only draft purchase orders can be edited');
    }
  }

  private assertReceivablePurchaseOrder(
    purchaseOrder: Pick<
      Prisma.PurchaseOrderGetPayload<{ select: typeof purchaseOrderSelect }>,
      'status'
    >,
  ) {
    if (purchaseOrder.status === PurchaseOrderStatus.draft) {
      throw new BadRequestException('Submit the purchase order before receiving');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.cancelled) {
      throw new BadRequestException('Cancelled purchase orders cannot be received');
    }

    if (purchaseOrder.status === PurchaseOrderStatus.received) {
      throw new BadRequestException('Purchase order is already fully received');
    }
  }

  private assertSupplierUsableForCompany(
    supplier: Prisma.SupplierGetPayload<{ select: typeof supplierSelect }>,
    companyId: string,
  ) {
    if (supplier.companyId !== companyId) {
      throw new BadRequestException(
        'Supplier does not belong to this branch company',
      );
    }

    if (supplier.status !== SupplierStatus.active) {
      throw new BadRequestException('Only active suppliers can be used for purchase orders');
    }
  }

  private buildSequenceNumber(prefix: string, value: number) {
    return `${prefix}-${String(value).padStart(4, '0')}`;
  }

  private optionalDate(value?: string | null) {
    if (value === undefined) {
      return undefined;
    }

    if (value === null || value.trim().length === 0) {
      return null;
    }

    return new Date(value);
  }

  private normalizeCurrency(value?: string | null) {
    const normalized = value?.trim().toUpperCase();

    return normalized && normalized.length > 0 ? normalized : 'EGP';
  }

  private receiptMovementNote(
    orderNumber: string,
    receiptNumber: string,
    note?: string | null,
  ) {
    const normalizedNote = this.normalizeOptionalText(note);
    const base = `Receipt ${receiptNumber} for PO ${orderNumber}`;

    return normalizedNote ? `${base}: ${normalizedNote}` : base;
  }

  private async findCompanyOrThrow(companyId: string, tx: PrismaExecutor) {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: companySelect,
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async findBranchOrThrow(branchId: string, tx: PrismaExecutor) {
    const branch = await tx.branch.findUnique({
      where: { id: branchId },
      select: branchSelect,
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return branch;
  }

  private async findInventoryItemOrThrow(
    inventoryItemId: string,
    tx: PrismaExecutor,
  ) {
    const item = await tx.inventoryItem.findUnique({
      where: { id: inventoryItemId },
      select: inventoryItemSelect,
    });

    if (!item) {
      throw new NotFoundException('Inventory item not found');
    }

    return item;
  }

  private async findSupplierOrThrow(supplierId: string, tx: PrismaExecutor) {
    const supplier = await tx.supplier.findUnique({
      where: { id: supplierId },
      select: supplierSelect,
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  private async findPurchaseOrderOrThrow(
    purchaseOrderId: string,
    tx: PrismaExecutor,
  ) {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      select: purchaseOrderSelect,
    });

    if (!purchaseOrder) {
      throw new NotFoundException('Purchase order not found');
    }

    return purchaseOrder;
  }

  private async findMenuItemOrThrow(menuItemId: string, tx: PrismaExecutor) {
    const item = await tx.menuItem.findUnique({
      where: { id: menuItemId },
      select: {
        id: true,
        companyId: true,
        categoryId: true,
        name: true,
        slug: true,
        status: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return item;
  }

  private assertInventoryItemUsableForBranch(item: any, branch: any) {
    if (item.companyId !== branch.companyId) {
      throw new BadRequestException(
        'Inventory item does not belong to this branch company',
      );
    }

    if (item.status === InventoryItemStatus.archived) {
      throw new BadRequestException('Archived inventory item cannot be adjusted');
    }
  }

  private async lockInventoryLevel(
    branchId: string,
    inventoryItemId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`inventory:${branchId}:${inventoryItemId}`})::bigint)`;
  }

  private menuItemStockSelect(branchId: string) {
    return {
      id: true,
      name: true,
      slug: true,
      status: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
        },
      },
      branchOverrides: {
        where: { branchId },
        select: {
          id: true,
          branchId: true,
          isAvailable: true,
          isVisible: true,
          priceOverrideMinor: true,
          sortOrder: true,
        },
      },
      inventoryRequirements: {
        orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
        select: {
          id: true,
          menuItemId: true,
          inventoryItemId: true,
          quantityRequired: true,
          unit: true,
          isRequired: true,
          inventoryItem: {
            select: {
              ...inventoryItemSelect,
              branchLevels: {
                where: { branchId },
                select: {
                  id: true,
                  quantityOnHand: true,
                  reservedQuantity: true,
                  lowStockThresholdQuantity: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private requirementSelect() {
    return {
      id: true,
      companyId: true,
      menuItemId: true,
      inventoryItemId: true,
      quantityRequired: true,
      unit: true,
      isRequired: true,
      createdAt: true,
      updatedAt: true,
      inventoryItem: {
        select: inventoryItemSelect,
      },
    } satisfies Prisma.MenuItemInventoryRequirementSelect;
  }

  private toBranchSummary(branch: any) {
    const { company: _company, ...branchFields } = branch;

    return branchFields;
  }

  private toMenuItemSummary(item: any) {
    return {
      id: item.id,
      companyId: item.companyId,
      categoryId: item.categoryId,
      name: item.name,
      slug: item.slug,
      status: item.status,
      category: item.category,
    };
  }

  private nullableQuantity(value?: number | null) {
    return value === undefined ? undefined : value;
  }

  private normalizeSku(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private normalizeOptionalText(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();

    return normalized.length > 0 ? normalized : null;
  }

  private handleKnownWriteError(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new BadRequestException(message);
    }

    throw error;
  }
}
