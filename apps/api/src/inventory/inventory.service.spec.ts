import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryStockStatus,
  InventoryUnit,
  MenuCategoryStatus,
  MenuItemStatus,
} from '@prisma/client';
import { InventoryService } from './inventory.service';

const company = {
  id: 'company-1',
  name: 'Balcona',
  slug: 'balcona',
  status: 'active',
};
const branch = {
  id: 'branch-1',
  companyId: company.id,
  name: 'Main',
  slug: 'main',
  address: null,
  status: 'active',
  company,
};
const inventoryItem = {
  id: 'inventory-1',
  companyId: company.id,
  name: 'Milk',
  sku: 'MILK',
  unit: InventoryUnit.milliliter,
  status: InventoryItemStatus.active,
  parLevelQuantity: null,
  lowStockThresholdQuantity: 400,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function level(quantityOnHand: number) {
  return {
    id: 'level-1',
    companyId: company.id,
    branchId: branch.id,
    inventoryItemId: inventoryItem.id,
    quantityOnHand,
    reservedQuantity: 0,
    lowStockThresholdQuantity: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    inventoryItem,
  };
}

function movement(quantityDelta: number, quantityAfter: number) {
  return {
    id: 'movement-1',
    companyId: company.id,
    branchId: branch.id,
    inventoryItemId: inventoryItem.id,
    staffUserId: 'staff-1',
    type: InventoryMovementType.opening_balance,
    quantityDelta,
    quantityAfter,
    unit: inventoryItem.unit,
    sourceType: 'manual_adjustment',
    sourceId: null,
    note: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    inventoryItem,
  };
}

function serviceWithTransaction(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: jest.fn((callback: (txArg: typeof tx) => unknown) =>
      callback(tx),
    ),
  };

  return {
    service: new InventoryService(prisma as never, createSaasService() as never),
    prisma,
  };
}

function createSaasService() {
  return {
    assertCompanyFeatureEnabled: jest.fn().mockResolvedValue(undefined),
    assertWithinLimit: jest.fn().mockResolvedValue(undefined),
  };
}

describe('InventoryService', () => {
  it('blocks inventory item creation when inventory is not enabled on the plan', async () => {
    const saasService = createSaasService();
    saasService.assertCompanyFeatureEnabled.mockRejectedValueOnce(
      new Error('Inventory is not enabled on this plan.'),
    );
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(company) },
      inventoryItem: { create: jest.fn() },
    };
    const service = new InventoryService(prisma as never, saasService as never);

    await expect(
      service.createInventoryItem(company.id, {
        name: 'Milk',
        sku: 'MILK',
        unit: InventoryUnit.milliliter,
      }),
    ).rejects.toThrow('Inventory is not enabled on this plan.');
    expect(prisma.inventoryItem.create).not.toHaveBeenCalled();
  });

  it('creates a branch level and movement for opening balance', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryItem: { findUnique: jest.fn().mockResolvedValue(inventoryItem) },
      branchInventoryLevel: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(level(5000)),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue(movement(5000, 5000)),
      },
    };
    const { service } = serviceWithTransaction(tx);

    const result = await service.adjustBranchInventoryLevel(
      branch.id,
      inventoryItem.id,
      {
        type: InventoryMovementType.opening_balance,
        quantity: 5000,
      },
      'staff-1',
    );

    expect(tx.branchInventoryLevel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityOnHand: 5000,
        }),
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          quantityDelta: 5000,
          quantityAfter: 5000,
          type: InventoryMovementType.opening_balance,
        }),
      }),
    );
    expect(result.level.quantityOnHand).toBe(5000);
  });

  it('rejects manual stock out that would make stock negative', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryItem: { findUnique: jest.fn().mockResolvedValue(inventoryItem) },
      branchInventoryLevel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'level-1',
          quantityOnHand: 3,
          lowStockThresholdQuantity: null,
        }),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
    };
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.adjustBranchInventoryLevel(
        branch.id,
        inventoryItem.id,
        {
          type: InventoryMovementType.stock_out,
          quantity: 4,
        },
        'staff-1',
      ),
    ).rejects.toThrow('Inventory adjustment cannot make stock negative');
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('replaces menu requirements deterministically and rejects another company item', async () => {
    const tx = {
      menuItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'menu-item-1',
          companyId: company.id,
          categoryId: 'category-1',
          name: 'Spanish Latte',
          slug: 'spanish-latte',
          status: MenuItemStatus.active,
          category: {
            id: 'category-1',
            name: 'Coffee',
            slug: 'coffee',
            status: MenuCategoryStatus.active,
          },
        }),
      },
      inventoryItem: {
        findMany: jest.fn().mockResolvedValue([
          { ...inventoryItem, id: 'other-company-item', companyId: 'company-2' },
        ]),
      },
      menuItemInventoryRequirement: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
    };
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.replaceMenuItemInventoryRequirements('menu-item-1', {
        requirements: [
          {
            inventoryItemId: 'other-company-item',
            quantityRequired: 100,
          },
        ],
      }),
    ).rejects.toThrow('Inventory item does not belong');
    expect(tx.menuItemInventoryRequirement.deleteMany).not.toHaveBeenCalled();
  });

  it('computes low stock and out of stock menu availability without mutating overrides', async () => {
    const service = new InventoryService(
      {
        branch: { findUnique: jest.fn().mockResolvedValue(branch) },
        menuItem: {
          findMany: jest.fn().mockResolvedValue([
          {
            id: 'latte',
            name: 'Spanish Latte',
            slug: 'spanish-latte',
            status: MenuItemStatus.active,
            category: {
              id: 'category-1',
              name: 'Coffee',
              slug: 'coffee',
              status: MenuCategoryStatus.active,
            },
            branchOverrides: [{ isAvailable: true, isVisible: true }],
            inventoryRequirements: [
              {
                id: 'req-1',
                menuItemId: 'latte',
                inventoryItemId: inventoryItem.id,
                quantityRequired: 200,
                unit: inventoryItem.unit,
                isRequired: true,
                inventoryItem: {
                  ...inventoryItem,
                  branchLevels: [level(500)],
                },
              },
            ],
          },
          {
            id: 'flat-white',
            name: 'Flat White',
            slug: 'flat-white',
            status: MenuItemStatus.active,
            category: {
              id: 'category-1',
              name: 'Coffee',
              slug: 'coffee',
              status: MenuCategoryStatus.active,
            },
            branchOverrides: [{ isAvailable: true, isVisible: true }],
            inventoryRequirements: [
              {
                id: 'req-2',
                menuItemId: 'flat-white',
                inventoryItemId: inventoryItem.id,
                quantityRequired: 100,
                unit: inventoryItem.unit,
                isRequired: true,
                inventoryItem: {
                  ...inventoryItem,
                  branchLevels: [level(10)],
                },
              },
            ],
          },
          ]),
        },
      } as never,
      createSaasService() as never,
    );

    const result = await service.getBranchMenuAvailability(branch.id);

    expect(result.items.find((item) => item.menuItemId === 'latte')).toMatchObject(
      {
        canOrder: true,
        stockStatus: InventoryStockStatus.low_stock,
      },
    );
    expect(
      result.items.find((item) => item.menuItemId === 'flat-white'),
    ).toMatchObject({
      canOrder: false,
      stockStatus: InventoryStockStatus.out_of_stock,
      reasons: expect.arrayContaining(['stock_blocked']),
    });
  });

  it('consumes accepted order stock and records sale movements once per inventory item', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          companyId: company.id,
          branchId: branch.id,
          items: [
            {
              id: 'order-item-1',
              menuItemId: 'latte',
              quantity: 2,
              itemNameSnapshot: 'Spanish Latte',
            },
          ],
        }),
      },
      menuItemInventoryRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            menuItemId: 'latte',
            inventoryItemId: inventoryItem.id,
            quantityRequired: 150,
            unit: inventoryItem.unit,
            inventoryItem,
          },
        ]),
      },
      branchInventoryLevel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'level-1',
          quantityOnHand: 500,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue(movement(-300, 200)),
      },
    };
    const service = new InventoryService(
      {} as never,
      createSaasService() as never,
    );

    const result = await service.consumeStockForAcceptedOrder(
      'order-1',
      'staff-1',
      tx as never,
    );

    expect(tx.branchInventoryLevel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantityOnHand: { decrement: 300 } },
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: InventoryMovementType.sale_consumption,
          quantityDelta: -300,
          quantityAfter: 200,
          sourceType: 'order',
          sourceId: 'order-1',
        }),
      }),
    );
    expect(result.consumed).toBe(true);
  });

  it('rejects stale stock consumption without creating a movement', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          companyId: company.id,
          branchId: branch.id,
          items: [
            {
              id: 'order-item-1',
              menuItemId: 'latte',
              quantity: 1,
              itemNameSnapshot: 'Spanish Latte',
            },
          ],
        }),
      },
      menuItemInventoryRequirement: {
        findMany: jest.fn().mockResolvedValue([
          {
            menuItemId: 'latte',
            inventoryItemId: inventoryItem.id,
            quantityRequired: 100,
            unit: inventoryItem.unit,
            inventoryItem,
          },
        ]),
      },
      branchInventoryLevel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'level-1',
          quantityOnHand: 500,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };
    const service = new InventoryService(
      {} as never,
      createSaasService() as never,
    );

    await expect(
      service.consumeStockForAcceptedOrder('order-1', 'staff-1', tx as never),
    ).rejects.toThrow('Item is out of stock');
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });
});
