import {
  BranchStatus,
  CompanyStatus,
  MenuCategoryStatus,
  MenuItemStatus,
  ModifierGroupStatus,
  ModifierOptionStatus,
  ModifierSelectionType,
  PreparationStation,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MenuAdminService } from './menu-admin.service';

const now = new Date('2026-01-01T00:00:00.000Z');

const branch = {
  id: 'branch-1',
  companyId: 'company-1',
  name: 'Main Branch',
  slug: 'main',
  address: null,
  status: BranchStatus.active,
  createdAt: now,
  updatedAt: now,
};

const company = {
  id: 'company-1',
  name: 'Demo Cafe',
  slug: 'demo-cafe',
  status: CompanyStatus.active,
  createdAt: now,
  updatedAt: now,
};

const category = {
  id: 'category-1',
  companyId: company.id,
  name: 'Coffee',
  slug: 'coffee',
  description: null,
  sortOrder: 0,
  status: MenuCategoryStatus.active,
  createdAt: now,
  updatedAt: now,
};

const activeOption = {
  id: 'option-1',
  groupId: 'group-1',
  name: 'Oat Milk',
  slug: 'oat-milk',
  priceDeltaMinor: 100,
  status: ModifierOptionStatus.active as ModifierOptionStatus,
  sortOrder: 0,
  createdAt: now,
  updatedAt: now,
};

const inactiveOption = {
  ...activeOption,
  id: 'option-2',
  name: 'Unavailable Milk',
  slug: 'unavailable-milk',
  status: ModifierOptionStatus.inactive,
};

function buildModifierGroup(
  options = [activeOption],
  overrides: Partial<{
    id: string;
    name: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
  }> = {},
) {
  return {
    id: overrides.id ?? 'group-1',
    companyId: company.id,
    name: overrides.name ?? 'Milk',
    slug: 'milk',
    description: null,
    selectionType: ModifierSelectionType.single,
    isRequired: overrides.isRequired ?? false,
    minSelections: overrides.minSelections ?? 0,
    maxSelections: overrides.maxSelections ?? 1,
    sortOrder: 0,
    status: ModifierGroupStatus.active,
    createdAt: now,
    updatedAt: now,
    options,
  };
}

function buildItem(
  overrides: Partial<{
    branchOverrides: Array<{
      id: string;
      branchId: string;
      menuItemId: string;
      priceOverrideMinor: number | null;
      isAvailable: boolean;
      isVisible: boolean;
      sortOrder: number | null;
      createdAt: Date;
      updatedAt: Date;
      branch: typeof branch;
    }>;
    modifierGroups: Array<{
      id: string;
      menuItemId: string;
      modifierGroupId: string;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      modifierGroup: ReturnType<typeof buildModifierGroup>;
    }>;
  }> = {},
) {
  return {
    id: 'item-1',
    companyId: company.id,
    categoryId: category.id,
    name: 'Flat White',
    slug: 'flat-white',
    description: null,
    imageUrl: null,
    basePriceMinor: 500,
    currency: 'USD',
    station: PreparationStation.barista,
    status: MenuItemStatus.active,
    isFeatured: false,
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
    category,
    modifierGroups: overrides.modifierGroups ?? [],
    branchOverrides:
      overrides.branchOverrides === undefined
        ? [
            {
              id: 'override-1',
              branchId: branch.id,
              menuItemId: 'item-1',
              priceOverrideMinor: 650,
              isAvailable: true,
              isVisible: true,
              sortOrder: 3,
              createdAt: now,
              updatedAt: now,
              branch,
            },
          ]
        : overrides.branchOverrides,
  };
}

function createService({
  items,
  modifierGroups = [],
}: {
  items: ReturnType<typeof buildItem>[];
  modifierGroups?: Array<ReturnType<typeof buildModifierGroup> & {
    _count: { menuItems: number };
  }>;
}) {
  const prisma = {
    branch: {
      findUnique: jest.fn().mockResolvedValue(branch),
    },
    company: {
      findUnique: jest.fn().mockResolvedValue(company),
    },
    menuCategory: {
      findMany: jest.fn().mockResolvedValue([
        {
          ...category,
          items,
        },
      ]),
    },
    modifierGroup: {
      findMany: jest.fn().mockResolvedValue(modifierGroups),
    },
  } as unknown as PrismaService;

  return new MenuAdminService(prisma);
}

describe('MenuAdminService', () => {
  describe('getBranchOverview', () => {
    it('returns branch-effective availability and pricing', async () => {
      const service = createService({ items: [buildItem()] });

      const result = await service.getBranchOverview(branch.id);
      const item = result.categories[0].items[0];

      expect(result.branch.id).toBe(branch.id);
      expect(result.stats.visibleItems).toBe(1);
      expect(result.stats.hiddenItems).toBe(0);
      expect(item.effectivePriceMinor).toBe(650);
      expect(item.sortOrder).toBe(3);
      expect(item.customerVisible).toBe(true);
      expect(result.setupIssues).toHaveLength(0);
    });

    it('reports required active modifier groups without active options', async () => {
      const modifierGroup = buildModifierGroup([inactiveOption], {
        isRequired: true,
        minSelections: 1,
      });
      const service = createService({
        items: [
          buildItem({
            modifierGroups: [
              {
                id: 'link-1',
                menuItemId: 'item-1',
                modifierGroupId: modifierGroup.id,
                sortOrder: 0,
                createdAt: now,
                updatedAt: now,
                modifierGroup,
              },
            ],
          }),
        ],
        modifierGroups: [{ ...modifierGroup, _count: { menuItems: 1 } }],
      });

      const result = await service.getBranchOverview(branch.id);

      expect(result.setupIssues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'required_modifier_group_has_no_active_options',
            severity: 'error',
            modifierGroupId: modifierGroup.id,
          }),
        ]),
      );
    });

    it('reports items missing a branch override and no visible branch menu', async () => {
      const service = createService({
        items: [buildItem({ branchOverrides: [] })],
      });

      const result = await service.getBranchOverview(branch.id);

      expect(result.stats.visibleItems).toBe(0);
      expect(result.setupIssues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'item_missing_branch_override',
            itemId: 'item-1',
          }),
          expect.objectContaining({
            code: 'branch_has_no_visible_items',
            severity: 'error',
          }),
        ]),
      );
    });
  });
});
