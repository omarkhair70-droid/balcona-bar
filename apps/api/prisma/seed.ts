import { PreparationStation, PrismaClient, StaffRole } from '@prisma/client';

const prisma = new PrismaClient();

const companySlug = 'balcona-bar';
const branchSlug = 'main-branch';

type MenuItemSeed = {
  categorySlug: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  basePriceMinor: number;
  station: PreparationStation;
  sortOrder: number;
  isFeatured?: boolean;
  modifierGroupSlugs?: readonly string[];
};

const staffSeed: Array<{ email: string; name: string; role: StaffRole }> = [
  { email: 'owner@balcona.local', name: 'Balcona Owner', role: 'owner' },
  { email: 'manager@balcona.local', name: 'Main Branch Manager', role: 'branch_manager' },
  { email: 'cashier@balcona.local', name: 'Main Branch Cashier', role: 'cashier' },
  { email: 'waiter@balcona.local', name: 'Main Branch Waiter', role: 'waiter' },
  { email: 'kitchen@balcona.local', name: 'Main Branch Kitchen', role: 'kitchen' },
  { email: 'barista@balcona.local', name: 'Main Branch Barista', role: 'barista' },
];

const categorySeed = [
  { name: 'Coffee', slug: 'coffee', sortOrder: 1 },
  { name: 'Cold Drinks', slug: 'cold-drinks', sortOrder: 2 },
  { name: 'Desserts', slug: 'desserts', sortOrder: 3 },
  { name: 'Bakery', slug: 'bakery', sortOrder: 4 },
];

const itemSeed: readonly MenuItemSeed[] = [
  { categorySlug: 'coffee', name: 'Espresso', slug: 'espresso', basePriceMinor: 6500, station: 'barista', sortOrder: 1, isFeatured: true },
  { categorySlug: 'coffee', name: 'Americano', slug: 'americano', basePriceMinor: 7500, station: 'barista', sortOrder: 2 },
  { categorySlug: 'coffee', name: 'Cappuccino', slug: 'cappuccino', basePriceMinor: 9000, station: 'barista', sortOrder: 3, isFeatured: true },
  { categorySlug: 'coffee', name: 'Latte', slug: 'latte', basePriceMinor: 9500, station: 'barista', sortOrder: 4 },
  { categorySlug: 'coffee', name: 'Spanish Latte', slug: 'spanish-latte', basePriceMinor: 11500, station: 'barista', sortOrder: 5, isFeatured: true },
  { categorySlug: 'cold-drinks', name: 'Iced Latte', slug: 'iced-latte', basePriceMinor: 10500, station: 'barista', sortOrder: 1 },
  { categorySlug: 'cold-drinks', name: 'Iced Spanish Latte', slug: 'iced-spanish-latte', basePriceMinor: 12500, station: 'barista', sortOrder: 2, isFeatured: true },
  { categorySlug: 'cold-drinks', name: 'Lemon Mint', slug: 'lemon-mint', basePriceMinor: 8500, station: 'barista', sortOrder: 3 },
  { categorySlug: 'cold-drinks', name: 'Peach Iced Tea', slug: 'peach-iced-tea', basePriceMinor: 9000, station: 'barista', sortOrder: 4 },
  { categorySlug: 'desserts', name: 'Chocolate Cake', slug: 'chocolate-cake', basePriceMinor: 12000, station: 'dessert', sortOrder: 1, isFeatured: true },
  { categorySlug: 'desserts', name: 'Cheesecake', slug: 'cheesecake', basePriceMinor: 13000, station: 'dessert', sortOrder: 2 },
  { categorySlug: 'desserts', name: 'Brownie', slug: 'brownie', basePriceMinor: 8000, station: 'dessert', sortOrder: 3 },
  { categorySlug: 'bakery', name: 'Croissant', slug: 'croissant', basePriceMinor: 7000, station: 'kitchen', sortOrder: 1 },
  { categorySlug: 'bakery', name: 'Cheese Croissant', slug: 'cheese-croissant', basePriceMinor: 8500, station: 'kitchen', sortOrder: 2 },
];

const modifierGroupSeed = [
  {
    name: 'Size',
    slug: 'size',
    selectionType: 'single',
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 1,
    options: [
      { name: 'Small', slug: 'small', priceDeltaMinor: 0, sortOrder: 1 },
      { name: 'Medium', slug: 'medium', priceDeltaMinor: 1000, sortOrder: 2 },
      { name: 'Large', slug: 'large', priceDeltaMinor: 2000, sortOrder: 3 },
    ],
  },
  {
    name: 'Temperature',
    slug: 'temperature',
    selectionType: 'single',
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 2,
    options: [
      { name: 'Hot', slug: 'hot', priceDeltaMinor: 0, sortOrder: 1 },
      { name: 'Iced', slug: 'iced', priceDeltaMinor: 0, sortOrder: 2 },
    ],
  },
  {
    name: 'Sugar Level',
    slug: 'sugar-level',
    selectionType: 'single',
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 3,
    options: [
      { name: 'No sugar', slug: 'no-sugar', priceDeltaMinor: 0, sortOrder: 1 },
      { name: 'Less sugar', slug: 'less-sugar', priceDeltaMinor: 0, sortOrder: 2 },
      { name: 'Normal sugar', slug: 'normal-sugar', priceDeltaMinor: 0, sortOrder: 3 },
      { name: 'Extra sugar', slug: 'extra-sugar', priceDeltaMinor: 0, sortOrder: 4 },
    ],
  },
  {
    name: 'Milk Type',
    slug: 'milk-type',
    selectionType: 'single',
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 4,
    options: [
      { name: 'Regular milk', slug: 'regular-milk', priceDeltaMinor: 0, sortOrder: 1 },
      { name: 'Oat milk', slug: 'oat-milk', priceDeltaMinor: 2500, sortOrder: 2 },
      { name: 'Almond milk', slug: 'almond-milk', priceDeltaMinor: 3000, sortOrder: 3 },
    ],
  },
  {
    name: 'Extras',
    slug: 'extras',
    selectionType: 'multiple',
    isRequired: false,
    minSelections: 0,
    maxSelections: 3,
    sortOrder: 5,
    options: [
      { name: 'Extra shot', slug: 'extra-shot', priceDeltaMinor: 2000, sortOrder: 1 },
      { name: 'Caramel', slug: 'caramel', priceDeltaMinor: 1500, sortOrder: 2 },
      { name: 'Vanilla', slug: 'vanilla', priceDeltaMinor: 1500, sortOrder: 3 },
      { name: 'Whipped cream', slug: 'whipped-cream', priceDeltaMinor: 1500, sortOrder: 4 },
    ],
  },
] as const;

const coffeeModifierSlugs = ['size', 'temperature', 'sugar-level', 'milk-type', 'extras'];
const coldDrinkModifierSlugsByItem: Record<string, string[]> = {
  'iced-latte': ['size', 'sugar-level', 'milk-type', 'extras'],
  'iced-spanish-latte': ['size', 'sugar-level', 'milk-type', 'extras'],
  'lemon-mint': ['size', 'sugar-level', 'extras'],
  'peach-iced-tea': ['size', 'sugar-level', 'extras'],
};

async function seedMenu(companyId: string, branchId: string) {
  const categoryBySlug = new Map<string, { id: string }>();

  for (const category of categorySeed) {
    const savedCategory = await prisma.menuCategory.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: category.slug,
        },
      },
      update: {
        name: category.name,
        sortOrder: category.sortOrder,
        status: 'active',
      },
      create: {
        companyId,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: 'active',
      },
      select: { id: true },
    });

    categoryBySlug.set(category.slug, savedCategory);
  }

  const itemBySlug = new Map<string, { id: string }>();

  for (const item of itemSeed) {
    const category = categoryBySlug.get(item.categorySlug);

    if (!category) {
      throw new Error(`Missing category for ${item.slug}`);
    }

    const savedItem = await prisma.menuItem.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: item.slug,
        },
      },
      update: {
        categoryId: category.id,
        name: item.name,
        basePriceMinor: item.basePriceMinor,
        currency: 'EGP',
        station: item.station,
        status: 'active',
        isFeatured: item.isFeatured ?? false,
        sortOrder: item.sortOrder,
      },
      create: {
        companyId,
        categoryId: category.id,
        name: item.name,
        slug: item.slug,
        basePriceMinor: item.basePriceMinor,
        currency: 'EGP',
        station: item.station,
        status: 'active',
        isFeatured: item.isFeatured ?? false,
        sortOrder: item.sortOrder,
      },
      select: { id: true },
    });

    itemBySlug.set(item.slug, savedItem);
  }

  const modifierGroupBySlug = new Map<string, { id: string }>();

  for (const group of modifierGroupSeed) {
    const savedGroup = await prisma.modifierGroup.upsert({
      where: {
        companyId_slug: {
          companyId,
          slug: group.slug,
        },
      },
      update: {
        name: group.name,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        status: 'active',
      },
      create: {
        companyId,
        name: group.name,
        slug: group.slug,
        selectionType: group.selectionType,
        isRequired: group.isRequired,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        status: 'active',
      },
      select: { id: true },
    });

    modifierGroupBySlug.set(group.slug, savedGroup);

    for (const option of group.options) {
      await prisma.modifierOption.upsert({
        where: {
          groupId_slug: {
            groupId: savedGroup.id,
            slug: option.slug,
          },
        },
        update: {
          name: option.name,
          priceDeltaMinor: option.priceDeltaMinor,
          sortOrder: option.sortOrder,
          status: 'active',
        },
        create: {
          groupId: savedGroup.id,
          name: option.name,
          slug: option.slug,
          priceDeltaMinor: option.priceDeltaMinor,
          sortOrder: option.sortOrder,
          status: 'active',
        },
      });
    }
  }

  for (const item of itemSeed) {
    const itemRecord = itemBySlug.get(item.slug);

    if (!itemRecord) {
      throw new Error(`Missing menu item ${item.slug}`);
    }

    const modifierSlugs =
      item.categorySlug === 'coffee'
        ? coffeeModifierSlugs
        : coldDrinkModifierSlugsByItem[item.slug] ?? [];

    for (const [index, modifierSlug] of modifierSlugs.entries()) {
      const modifierGroup = modifierGroupBySlug.get(modifierSlug);

      if (!modifierGroup) {
        throw new Error(`Missing modifier group ${modifierSlug}`);
      }

      await prisma.menuItemModifierGroup.upsert({
        where: {
          menuItemId_modifierGroupId: {
            menuItemId: itemRecord.id,
            modifierGroupId: modifierGroup.id,
          },
        },
        update: {
          sortOrder: index + 1,
        },
        create: {
          menuItemId: itemRecord.id,
          modifierGroupId: modifierGroup.id,
          sortOrder: index + 1,
        },
      });
    }

    await prisma.branchMenuItemOverride.upsert({
      where: {
        branchId_menuItemId: {
          branchId,
          menuItemId: itemRecord.id,
        },
      },
      update: {
        priceOverrideMinor: null,
        isAvailable: true,
        isVisible: true,
        sortOrder: item.sortOrder,
      },
      create: {
        branchId,
        menuItemId: itemRecord.id,
        priceOverrideMinor: null,
        isAvailable: true,
        isVisible: true,
        sortOrder: item.sortOrder,
      },
    });
  }
}

async function main() {
  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: {
      name: 'Balcona Bar',
      status: 'active',
    },
    create: {
      name: 'Balcona Bar',
      slug: companySlug,
      status: 'active',
    },
  });

  const branch = await prisma.branch.upsert({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: branchSlug,
      },
    },
    update: {
      name: 'Main Branch',
      address: 'Demo address for local development',
      status: 'active',
    },
    create: {
      companyId: company.id,
      name: 'Main Branch',
      slug: branchSlug,
      address: 'Demo address for local development',
      status: 'active',
    },
  });

  const floor = await prisma.floor.upsert({
    where: {
      id: `${branch.id}:ground-floor`,
    },
    update: {
      name: 'Ground Floor',
      sortOrder: 1,
    },
    create: {
      id: `${branch.id}:ground-floor`,
      branchId: branch.id,
      name: 'Ground Floor',
      sortOrder: 1,
    },
  });

  for (let index = 1; index <= 6; index += 1) {
    const code = `T${String(index).padStart(2, '0')}`;

    await prisma.cafeTable.upsert({
      where: {
        branchId_code: {
          branchId: branch.id,
          code,
        },
      },
      update: {
        displayName: `Table ${index}`,
        floorId: floor.id,
        capacity: 4,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: 'active',
      },
      create: {
        branchId: branch.id,
        floorId: floor.id,
        code,
        displayName: `Table ${index}`,
        capacity: 4,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: 'active',
      },
    });
  }

  for (const staff of staffSeed) {
    const staffUser = await prisma.staffUser.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        status: 'active',
      },
      create: {
        email: staff.email,
        name: staff.name,
        status: 'active',
      },
    });

    const membershipBranchId = staff.role === 'owner' ? null : branch.id;
    const existingMembership = await prisma.staffMembership.findFirst({
      where: {
        staffUserId: staffUser.id,
        companyId: company.id,
        branchId: membershipBranchId,
        role: staff.role,
      },
    });

    if (existingMembership) {
      await prisma.staffMembership.update({
        where: { id: existingMembership.id },
        data: { status: 'active' },
      });
    } else {
      await prisma.staffMembership.create({
        data: {
          staffUserId: staffUser.id,
          companyId: company.id,
          branchId: membershipBranchId,
          role: staff.role,
          status: 'active',
        },
      });
    }
  }

  await seedMenu(company.id, branch.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
