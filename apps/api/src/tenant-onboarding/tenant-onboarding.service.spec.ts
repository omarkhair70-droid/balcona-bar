import { StaffRole } from '@prisma/client';
import { TenantOnboardingService } from './tenant-onboarding.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const company = {
  id: 'company-1',
  name: 'Test Cafe',
  slug: 'test-cafe',
  status: 'active',
  createdAt: now,
  updatedAt: now,
};

const branch = {
  id: 'branch-1',
  companyId: company.id,
  name: 'Main',
  slug: 'main',
  address: '1 Test Street',
  status: 'active',
  createdAt: now,
  updatedAt: now,
  company,
};

const floor = {
  id: 'floor-1',
  branchId: branch.id,
  name: 'Ground Floor',
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};

const tableT01 = {
  id: 'table-1',
  branchId: branch.id,
  floorId: floor.id,
  code: 'T01',
  displayName: 'T01',
  capacity: 4,
  qrToken: 'main-t01',
  status: 'active',
  createdAt: now,
  updatedAt: now,
  floor,
};

function membership(role: StaffRole, branchId: string | null = branch.id) {
  return {
    id: `membership-${role}`,
    staffUserId: `staff-${role}`,
    companyId: company.id,
    branchId,
    role,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    staffUser: {
      id: `staff-${role}`,
      email: `${role}@test.local`,
      name: role,
      status: 'active',
      passwordSetAt: now,
      createdAt: now,
      updatedAt: now,
    },
  };
}

function menuItem(id: string, overrides = true) {
  return {
    id,
    name: `Item ${id}`,
    slug: `item-${id}`,
    status: 'active',
    basePriceMinor: 1000,
    currency: 'EGP',
    modifierGroups: [{ id: `link-${id}` }],
    branchOverrides: overrides
      ? [
          {
            id: `override-${id}`,
            isAvailable: true,
            isVisible: true,
            priceOverrideMinor: null,
          },
        ]
      : [],
  };
}

function createPrisma(overrides: Record<string, unknown> = {}) {
  const tx = {
    branch: {
      findUnique: jest.fn().mockResolvedValue(branch),
    },
    floor: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(floor),
      create: jest.fn().mockResolvedValue(floor),
    },
    cafeTable: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: `table-${data.code}`,
          branchId: data.branchId,
          floorId: data.floorId,
          code: data.code,
          displayName: data.displayName,
          capacity: data.capacity,
          qrToken: data.qrToken,
          status: data.status,
          createdAt: now,
          updatedAt: now,
          floor,
        }),
      ),
    },
    staffMembership: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: 'membership-new',
          ...data,
          status: data.status ?? 'active',
          createdAt: now,
          updatedAt: now,
          staffUser: {
            id: data.staffUserId,
            email: 'new@test.local',
            name: 'New Staff',
            status: 'active',
            passwordSetAt: null,
            createdAt: now,
            updatedAt: now,
          },
        }),
      ),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(({ data }) =>
        Promise.resolve({
          id: 'staff-new',
          email: data.email,
          name: data.name,
          status: data.status,
          passwordSetAt: null,
          createdAt: now,
          updatedAt: now,
        }),
      ),
      update: jest.fn(),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue(company),
      update: jest.fn(),
    },
    menuCategory: {
      count: jest.fn().mockResolvedValue(0),
    },
    menuItem: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    inventoryItem: {
      count: jest.fn().mockResolvedValue(0),
    },
    branchInventoryLevel: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    modifierGroup: {
      count: jest.fn().mockResolvedValue(0),
    },
    menuItemModifierGroup: {
      count: jest.fn().mockResolvedValue(0),
    },
    printerStation: {
      count: jest.fn().mockResolvedValue(0),
    },
    branchOperatingSettings: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    branchFeatureFlag: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    branchSmartCashierSettings: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    cashierShift: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback) => callback(tx)),
    ...overrides,
  };

  return { prisma, tx };
}

function buildService(overrides: Record<string, unknown> = {}) {
  const { prisma, tx } = createPrisma(overrides);
  const saasService = {
    getCompanySaasStatus: jest.fn().mockResolvedValue({
      subscription: { status: 'active' },
      plan: { name: 'Pilot' },
      entitlements: { setup: true },
      usage: {},
      warnings: [],
      blockers: [],
    }),
    assertCompanyFeatureEnabled: jest.fn().mockResolvedValue(undefined),
    assertWithinLimit: jest.fn().mockResolvedValue(undefined),
  };
  const service = new TenantOnboardingService(
    prisma as never,
    { get: jest.fn().mockReturnValue(false) } as never,
    { assertCan: jest.fn().mockResolvedValue({ allowed: true }) } as never,
    saasService as never,
  );

  return { service, prisma, tx, saasService };
}

describe('TenantOnboardingService', () => {
  it('returns zero-safe onboarding status for an empty branch', async () => {
    const { service } = buildService();

    const result = await service.getBranchOnboarding(branch.id);

    expect(result.tables.tableCount).toBe(0);
    expect(result.staff.total).toBe(0);
    expect(result.menu.activeItemCount).toBe(0);
    expect(result.saas?.plan?.name).toBe('Pilot');
    expect(result.launchSummary.status).toBe('blocked');
    expect(
      result.launchChecklist.find((item) => item.key === 'tables_created'),
    ).toMatchObject({ status: 'missing' });
  });

  it('marks a branch ready when tables, staff, menu, printer, and modifiers exist', async () => {
    const { service, prisma } = buildService();
    prisma.floor.findMany.mockResolvedValue([floor]);
    prisma.cafeTable.findMany.mockResolvedValue([tableT01]);
    prisma.staffMembership.findMany.mockResolvedValue([
      membership(StaffRole.owner, null),
      membership(StaffRole.cashier),
      membership(StaffRole.kitchen),
      membership(StaffRole.waiter),
    ]);
    prisma.menuCategory.count.mockResolvedValue(2);
    prisma.menuItem.findMany.mockResolvedValue([
      menuItem('one'),
      menuItem('two'),
      menuItem('three'),
    ]);
    prisma.modifierGroup.count.mockResolvedValue(1);
    prisma.menuItemModifierGroup.count.mockResolvedValue(3);
    prisma.printerStation.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1);

    const result = await service.getBranchOnboarding(branch.id);

    expect(result.launchSummary.status).toBe('ready_for_pilot');
    expect(result.tables.qrReadyTableCount).toBe(1);
    expect(result.menu.aiWaiterMenuGroundingReady).toBe(true);
    expect(result.staff.roleCounts.cashier).toBe(1);
  });

  it('bulk creates deterministic table labels and skips duplicates', async () => {
    const { service, tx } = buildService();
    tx.cafeTable.findFirst
      .mockResolvedValueOnce(tableT01)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await service.bulkCreateTables(branch.id, {
      floorLabel: 'Ground Floor',
      tablePrefix: 'T',
      startNumber: 1,
      count: 3,
      seats: 4,
    });

    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ code: 'T01' });
    expect(result.created.map((table) => table.code)).toEqual(['T02', 'T03']);
    expect(result.created.map((table) => table.qrToken)).toEqual([
      'main-t02',
      'main-t03',
    ]);
  });

  it('checks SaaS table limits before bulk table creation', async () => {
    const { service, saasService, tx } = buildService();
    saasService.assertWithinLimit.mockRejectedValueOnce(
      new Error('Table limit reached for this company plan.'),
    );

    await expect(
      service.bulkCreateTables(branch.id, {
        floorLabel: 'Ground Floor',
        tablePrefix: 'T',
        startNumber: 1,
        count: 3,
        seats: 4,
      }),
    ).rejects.toThrow('Table limit reached for this company plan.');
    expect(saasService.assertWithinLimit).toHaveBeenCalledWith(
      company.id,
      'maxTables',
      3,
    );
    expect(tx.cafeTable.create).not.toHaveBeenCalled();
  });

  it('creates a branch-scoped staff membership during staff setup', async () => {
    const { service, tx } = buildService();

    const result = await service.inviteStaff(
      branch.id,
      {
        email: 'New@Test.Local',
        name: 'New Cashier',
        role: StaffRole.cashier,
      },
      'actor-1',
    );

    expect(tx.staffUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@test.local',
          name: 'New Cashier',
        }),
      }),
    );
    expect(tx.staffMembership.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          branchId: branch.id,
          role: StaffRole.cashier,
        }),
      }),
    );
    expect(result.passwordSetup.required).toBe(true);
  });
});
