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
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdjustInventoryLevelDto,
  CreateInventoryItemDto,
  ReplaceMenuItemInventoryRequirementsDto,
  UpdateInventoryItemDto,
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
  constructor(private readonly prisma: PrismaService) {}

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
