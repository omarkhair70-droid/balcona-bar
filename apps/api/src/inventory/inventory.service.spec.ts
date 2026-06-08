import {
  InventoryItemStatus,
  InventoryMovementType,
  InventoryStockStatus,
  InventoryUnit,
  MenuCategoryStatus,
  MenuItemStatus,
  PurchaseOrderStatus,
  SupplierStatus,
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
const supplier = {
  id: 'supplier-1',
  companyId: company.id,
  name: 'Cairo Dairy',
  contact: 'Nour',
  phone: '01000000000',
  email: 'orders@example.test',
  taxId: null,
  address: null,
  notes: null,
  status: SupplierStatus.active,
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

function purchaseOrder(overrides: Record<string, unknown> = {}) {
  const line = {
    id: 'po-line-1',
    purchaseOrderId: 'po-1',
    inventoryItemId: inventoryItem.id,
    quantityOrdered: 10,
    quantityReceived: 0,
    unitCostMinor: 1250,
    notes: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    inventoryItem,
  };

  return {
    id: 'po-1',
    companyId: company.id,
    branchId: branch.id,
    supplierId: supplier.id,
    orderNumber: 'PO-0001',
    status: PurchaseOrderStatus.submitted,
    expectedAt: null,
    notes: null,
    currency: 'EGP',
    createdByStaffUserId: 'staff-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    supplier,
    lines: [line],
    ...overrides,
  };
}

function inventoryReceipt(quantityReceived: number) {
  return {
    id: 'receipt-1',
    companyId: company.id,
    branchId: branch.id,
    supplierId: supplier.id,
    purchaseOrderId: 'po-1',
    receiptNumber: 'GR-0001',
    receivedAt: new Date('2026-01-02T00:00:00.000Z'),
    notes: 'First delivery',
    createdByStaffUserId: 'staff-1',
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    supplier,
    lines: [
      {
        id: 'receipt-line-1',
        receiptId: 'receipt-1',
        purchaseOrderLineId: 'po-line-1',
        inventoryItemId: inventoryItem.id,
        quantityReceived,
        unitCostMinor: 1250,
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        inventoryItem,
      },
    ],
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

  it('blocks supplier creation when inventory is not enabled on the plan', async () => {
    const saasService = createSaasService();
    saasService.assertCompanyFeatureEnabled.mockRejectedValueOnce(
      new Error('Inventory is not enabled on this plan.'),
    );
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(company) },
      supplier: { create: jest.fn() },
    };
    const service = new InventoryService(prisma as never, saasService as never);

    await expect(
      service.createSupplier(company.id, {
        name: 'Cairo Dairy',
        phone: '01000000000',
      }),
    ).rejects.toThrow('Inventory is not enabled on this plan.');
    expect(prisma.supplier.create).not.toHaveBeenCalled();
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

  it('receives a submitted purchase order transactionally and records stock-in movement', async () => {
    const submittedPurchaseOrder = purchaseOrder();
    const updatedPurchaseOrder = purchaseOrder({
      status: PurchaseOrderStatus.partially_received,
      lines: [
        {
          ...submittedPurchaseOrder.lines[0],
          quantityReceived: 4,
        },
      ],
    });
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      purchaseOrder: {
        findUnique: jest.fn().mockResolvedValue(submittedPurchaseOrder),
        update: jest.fn().mockResolvedValue(updatedPurchaseOrder),
      },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryReceipt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
        findUnique: jest.fn().mockResolvedValue(inventoryReceipt(4)),
      },
      branchInventoryLevel: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'level-1',
          quantityOnHand: 6,
          lowStockThresholdQuantity: null,
        }),
        update: jest.fn().mockResolvedValue(level(10)),
      },
      purchaseOrderLine: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([
          {
            quantityOrdered: 10,
            quantityReceived: 4,
          },
        ]),
      },
      inventoryReceiptLine: {
        create: jest.fn().mockResolvedValue(inventoryReceipt(4).lines[0]),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({
          ...movement(4, 10),
          type: InventoryMovementType.stock_in,
          sourceType: 'purchase_order_receipt',
          sourceId: 'receipt-1',
        }),
      },
    };
    const { service } = serviceWithTransaction(tx);

    const result = await service.receivePurchaseOrder(
      'po-1',
      {
        notes: 'First delivery',
        lines: [
          {
            purchaseOrderLineId: 'po-line-1',
            quantityReceived: 4,
          },
        ],
      },
      'staff-1',
    );

    expect(tx.inventoryReceipt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          receiptNumber: 'GR-0001',
          supplierId: supplier.id,
          purchaseOrderId: 'po-1',
        }),
      }),
    );
    expect(tx.purchaseOrderLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'po-line-1',
          quantityReceived: { lte: 6 },
        },
        data: { quantityReceived: { increment: 4 } },
      }),
    );
    expect(tx.purchaseOrderLine.findMany).toHaveBeenCalledWith({
      where: { purchaseOrderId: 'po-1' },
      select: {
        quantityOrdered: true,
        quantityReceived: true,
      },
    });
    expect(tx.branchInventoryLevel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantityOnHand: 10 },
      }),
    );
    expect(tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: InventoryMovementType.stock_in,
          quantityDelta: 4,
          quantityAfter: 10,
          sourceType: 'purchase_order_receipt',
          sourceId: 'receipt-1',
          note: 'Receipt GR-0001 for PO PO-0001: First delivery',
        }),
      }),
    );
    expect(result.purchaseOrder.status).toBe(
      PurchaseOrderStatus.partially_received,
    );
    expect(result.receipt?.receiptNumber).toBe('GR-0001');
  });

  it('blocks stale purchase order receiving when the guarded line update fails', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      purchaseOrder: {
        findUnique: jest.fn().mockResolvedValue(purchaseOrder()),
        update: jest.fn(),
      },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryReceipt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'receipt-1' }),
        findUnique: jest.fn(),
      },
      purchaseOrderLine: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
      },
      branchInventoryLevel: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      inventoryReceiptLine: {
        create: jest.fn(),
      },
      inventoryMovement: {
        create: jest.fn(),
      },
    };
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.receivePurchaseOrder(
        'po-1',
        {
          lines: [
            {
              purchaseOrderLineId: 'po-line-1',
              quantityReceived: 4,
            },
          ],
        },
        'staff-1',
      ),
    ).rejects.toThrow('Milk was already received or cannot be over-received');
    expect(tx.purchaseOrderLine.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'po-line-1',
          quantityReceived: { lte: 6 },
        },
        data: { quantityReceived: { increment: 4 } },
      }),
    );
    expect(tx.branchInventoryLevel.findUnique).not.toHaveBeenCalled();
    expect(tx.inventoryReceiptLine.create).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
    expect(tx.purchaseOrder.update).not.toHaveBeenCalled();
  });

  it('blocks over-receiving a purchase order line before changing stock', async () => {
    const tx = {
      purchaseOrder: { findUnique: jest.fn().mockResolvedValue(purchaseOrder()) },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryReceipt: { create: jest.fn() },
      inventoryMovement: { create: jest.fn() },
    };
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.receivePurchaseOrder(
        'po-1',
        {
          lines: [
            {
              purchaseOrderLineId: 'po-line-1',
              quantityReceived: 11,
            },
          ],
        },
        'staff-1',
      ),
    ).rejects.toThrow('Milk cannot be over-received');
    expect(tx.inventoryReceipt.create).not.toHaveBeenCalled();
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('blocks receiving cancelled purchase orders before changing stock', async () => {
    const tx = {
      purchaseOrder: {
        findUnique: jest.fn().mockResolvedValue(
          purchaseOrder({ status: PurchaseOrderStatus.cancelled }),
        ),
      },
      branch: { findUnique: jest.fn().mockResolvedValue(branch) },
      inventoryReceipt: { create: jest.fn() },
      inventoryMovement: { create: jest.fn() },
    };
    const { service } = serviceWithTransaction(tx);

    await expect(
      service.receivePurchaseOrder(
        'po-1',
        {
          lines: [
            {
              purchaseOrderLineId: 'po-line-1',
              quantityReceived: 1,
            },
          ],
        },
        'staff-1',
      ),
    ).rejects.toThrow('Cancelled purchase orders cannot be received');
    expect(tx.inventoryReceipt.create).not.toHaveBeenCalled();
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
