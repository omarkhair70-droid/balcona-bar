import {
  CompanySubscriptionStatus,
  PlatformAdminRole,
  PlatformAdminStatus,
  PreparationStation,
  PrinterAdapterType,
  PrismaClient,
  SaasPlanStatus,
  StaffRole,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { seedRealCafeDemo } from "./seed-real-cafe-demo";

const prisma = new PrismaClient();
const PASSWORD_HASH_ROUNDS = 12;

const companySlug = "balcona-bar";
const branchSlug = "main-branch";

type MenuItemSeed = {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  basePriceMinor: number;
  station: PreparationStation;
  sortOrder: number;
  isFeatured?: boolean;
  modifierGroupSlugs?: readonly string[];
};

const staffSeed: Array<{ email: string; name: string; role: StaffRole }> = [
  { email: "owner@balcona.local", name: "Balcona Owner", role: "owner" },
  {
    email: "manager@balcona.local",
    name: "Main Branch Manager",
    role: "branch_manager",
  },
  {
    email: "cashier@balcona.local",
    name: "Main Branch Cashier",
    role: "cashier",
  },
  { email: "waiter@balcona.local", name: "Main Branch Waiter", role: "waiter" },
  {
    email: "kitchen@balcona.local",
    name: "Main Branch Kitchen",
    role: "kitchen",
  },
  {
    email: "barista@balcona.local",
    name: "Main Branch Barista",
    role: "barista",
  },
];

const saasPlanSeed = [
  {
    code: "pilot",
    name: "Pilot",
    description: "Generous local/demo pilot plan for onboarding cafes.",
    monthlyPriceMinor: null,
    maxBranches: 3,
    maxTables: 100,
    maxStaffUsers: 25,
    maxMenuItems: 300,
    maxInventoryItems: 300,
    maxAiMessagesPerMonth: 5000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: true,
    sortOrder: 1,
  },
  {
    code: "starter",
    name: "Starter",
    description: "Single-branch cafe operations with essential limits.",
    monthlyPriceMinor: 150000,
    maxBranches: 1,
    maxTables: 20,
    maxStaffUsers: 8,
    maxMenuItems: 80,
    maxInventoryItems: 75,
    maxAiMessagesPerMonth: 1000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: false,
    onlinePaymentsEnabled: false,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: false,
    advancedReportsEnabled: false,
    sortOrder: 2,
  },
  {
    code: "growth",
    name: "Growth",
    description:
      "Growing cafes with inventory, online payments, and AI capacity.",
    monthlyPriceMinor: 350000,
    maxBranches: 3,
    maxTables: 75,
    maxStaffUsers: 30,
    maxMenuItems: 250,
    maxInventoryItems: 250,
    maxAiMessagesPerMonth: 5000,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: false,
    sortOrder: 3,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    description: "Sales-led plan with unlimited operating limits.",
    monthlyPriceMinor: null,
    maxBranches: null,
    maxTables: null,
    maxStaffUsers: null,
    maxMenuItems: null,
    maxInventoryItems: null,
    maxAiMessagesPerMonth: null,
    setupEnabled: true,
    kdsEnabled: true,
    inventoryEnabled: true,
    onlinePaymentsEnabled: true,
    ownerAnalyticsEnabled: true,
    aiWaiterEnabled: true,
    multiBranchEnabled: true,
    advancedReportsEnabled: true,
    sortOrder: 4,
  },
] as const;

const categorySeed = [
  { name: "Balcona Signatures", slug: "signatures", sortOrder: 1 },
  { name: "Espresso Bar", slug: "coffee", sortOrder: 2 },
  { name: "Cold & Sparkling", slug: "cold-drinks", sortOrder: 3 },
  { name: "Breakfast & Bakery", slug: "bakery", sortOrder: 4 },
  { name: "Dessert Counter", slug: "desserts", sortOrder: 5 },
];

const itemSeed: readonly MenuItemSeed[] = [
  {
    categorySlug: "signatures",
    name: "Balcona Spanish Latte",
    slug: "balcona-spanish-latte",
    description:
      "Double espresso, silky milk and our toasted condensed-milk blend.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 14500,
    station: "barista",
    sortOrder: 1,
    isFeatured: true,
  },
  {
    categorySlug: "signatures",
    name: "Cardamom Flat White",
    slug: "cardamom-flat-white",
    description:
      "Velvety flat white with green cardamom and a quiet honey finish.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 13000,
    station: "barista",
    sortOrder: 2,
    isFeatured: true,
  },
  {
    categorySlug: "signatures",
    name: "Pistachio Latte",
    slug: "pistachio-latte",
    description: "House pistachio cream, espresso and textured milk.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 15500,
    station: "barista",
    sortOrder: 3,
    isFeatured: true,
  },
  {
    categorySlug: "signatures",
    name: "Orange Espresso Tonic",
    slug: "orange-espresso-tonic",
    description: "Bright espresso, tonic and fresh orange over crystal ice.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 15000,
    station: "barista",
    sortOrder: 4,
    isFeatured: true,
  },
  {
    categorySlug: "coffee",
    name: "Espresso",
    slug: "espresso",
    description: "Balanced house espresso with cocoa and roasted almond notes.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 7500,
    station: "barista",
    sortOrder: 1,
  },
  {
    categorySlug: "coffee",
    name: "Double Espresso",
    slug: "double-espresso",
    description: "A focused double shot of our seasonal house blend.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 9500,
    station: "barista",
    sortOrder: 2,
  },
  {
    categorySlug: "coffee",
    name: "Cortado",
    slug: "cortado",
    description: "Equal parts espresso and warm textured milk.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 10500,
    station: "barista",
    sortOrder: 3,
  },
  {
    categorySlug: "coffee",
    name: "Flat White",
    slug: "flat-white",
    description: "Double ristretto with a thin layer of silky microfoam.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 12000,
    station: "barista",
    sortOrder: 4,
  },
  {
    categorySlug: "coffee",
    name: "Cappuccino",
    slug: "cappuccino",
    description: "Espresso, steamed milk and a generous cap of microfoam.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 12500,
    station: "barista",
    sortOrder: 5,
  },
  {
    categorySlug: "coffee",
    name: "V60 Filter",
    slug: "v60-filter",
    description: "Hand-brewed seasonal coffee with a clean, expressive finish.",
    imageUrl: "/menu/signature-latte.webp",
    basePriceMinor: 14500,
    station: "barista",
    sortOrder: 6,
  },
  {
    categorySlug: "cold-drinks",
    name: "Iced Spanish Latte",
    slug: "iced-spanish-latte",
    description: "Our signature Spanish latte poured over ice.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 15000,
    station: "barista",
    sortOrder: 1,
  },
  {
    categorySlug: "cold-drinks",
    name: "Cold Brew",
    slug: "cold-brew",
    description:
      "Slow-steeped for 18 hours; chocolatey, smooth and refreshing.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 13500,
    station: "barista",
    sortOrder: 2,
  },
  {
    categorySlug: "cold-drinks",
    name: "Hibiscus Lemonade",
    slug: "hibiscus-lemonade",
    description: "Tart karkade, fresh lemon and a light sparkling lift.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 11000,
    station: "barista",
    sortOrder: 3,
    isFeatured: true,
  },
  {
    categorySlug: "cold-drinks",
    name: "Lemon Mint",
    slug: "lemon-mint",
    description: "Fresh lemon, garden mint and crushed ice.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 10500,
    station: "barista",
    sortOrder: 4,
  },
  {
    categorySlug: "cold-drinks",
    name: "Peach Iced Tea",
    slug: "peach-iced-tea",
    description: "Black tea, ripe peach and citrus served long over ice.",
    imageUrl: "/menu/cold-drinks.webp",
    basePriceMinor: 11500,
    station: "barista",
    sortOrder: 5,
  },
  {
    categorySlug: "bakery",
    name: "Butter Croissant",
    slug: "butter-croissant",
    description: "Flaky all-butter croissant, baked fresh every morning.",
    imageUrl: "/menu/bakery.webp",
    basePriceMinor: 8000,
    station: "kitchen",
    sortOrder: 1,
  },
  {
    categorySlug: "bakery",
    name: "Halloumi Croissant",
    slug: "halloumi-croissant",
    description: "Warm croissant, grilled halloumi, tomato and zaatar.",
    imageUrl: "/menu/bakery.webp",
    basePriceMinor: 14500,
    station: "kitchen",
    sortOrder: 2,
    isFeatured: true,
  },
  {
    categorySlug: "bakery",
    name: "Shakshuka Focaccia",
    slug: "shakshuka-focaccia",
    description: "Soft eggs, slow tomato and herbs on toasted focaccia.",
    imageUrl: "/menu/bakery.webp",
    basePriceMinor: 17500,
    station: "kitchen",
    sortOrder: 3,
  },
  {
    categorySlug: "bakery",
    name: "Turkey Brioche",
    slug: "turkey-brioche",
    description: "Smoked turkey, aged cheese and mustard in toasted brioche.",
    imageUrl: "/menu/bakery.webp",
    basePriceMinor: 18500,
    station: "kitchen",
    sortOrder: 4,
  },
  {
    categorySlug: "bakery",
    name: "Granola Bowl",
    slug: "granola-bowl",
    description: "Greek yoghurt, house granola, seasonal fruit and honey.",
    imageUrl: "/menu/bakery.webp",
    basePriceMinor: 16500,
    station: "kitchen",
    sortOrder: 5,
  },
  {
    categorySlug: "desserts",
    name: "Basque Cheesecake",
    slug: "basque-cheesecake",
    description: "Burnished top, creamy centre and a whisper of sea salt.",
    imageUrl: "/menu/pistachio-tiramisu.webp",
    basePriceMinor: 16500,
    station: "dessert",
    sortOrder: 1,
    isFeatured: true,
  },
  {
    categorySlug: "desserts",
    name: "Date Toffee Pudding",
    slug: "date-toffee-pudding",
    description: "Warm date sponge, toffee sauce and vanilla cream.",
    imageUrl: "/menu/pistachio-tiramisu.webp",
    basePriceMinor: 14500,
    station: "dessert",
    sortOrder: 2,
  },
  {
    categorySlug: "desserts",
    name: "Dark Chocolate Brownie",
    slug: "dark-chocolate-brownie",
    description: "Fudgy dark chocolate brownie with roasted hazelnut.",
    imageUrl: "/menu/pistachio-tiramisu.webp",
    basePriceMinor: 12000,
    station: "dessert",
    sortOrder: 3,
  },
  {
    categorySlug: "desserts",
    name: "Pistachio Tiramisu",
    slug: "pistachio-tiramisu",
    description: "Espresso-soaked layers with mascarpone and pistachio.",
    imageUrl: "/menu/pistachio-tiramisu.webp",
    basePriceMinor: 18000,
    station: "dessert",
    sortOrder: 4,
    isFeatured: true,
  },
];

const modifierGroupSeed = [
  {
    name: "Size",
    slug: "size",
    selectionType: "single",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 1,
    options: [
      { name: "Small", slug: "small", priceDeltaMinor: 0, sortOrder: 1 },
      { name: "Medium", slug: "medium", priceDeltaMinor: 1000, sortOrder: 2 },
      { name: "Large", slug: "large", priceDeltaMinor: 2000, sortOrder: 3 },
    ],
  },
  {
    name: "Temperature",
    slug: "temperature",
    selectionType: "single",
    isRequired: true,
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 2,
    options: [
      { name: "Hot", slug: "hot", priceDeltaMinor: 0, sortOrder: 1 },
      { name: "Iced", slug: "iced", priceDeltaMinor: 0, sortOrder: 2 },
    ],
  },
  {
    name: "Sugar Level",
    slug: "sugar-level",
    selectionType: "single",
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 3,
    options: [
      { name: "No sugar", slug: "no-sugar", priceDeltaMinor: 0, sortOrder: 1 },
      {
        name: "Less sugar",
        slug: "less-sugar",
        priceDeltaMinor: 0,
        sortOrder: 2,
      },
      {
        name: "Normal sugar",
        slug: "normal-sugar",
        priceDeltaMinor: 0,
        sortOrder: 3,
      },
      {
        name: "Extra sugar",
        slug: "extra-sugar",
        priceDeltaMinor: 0,
        sortOrder: 4,
      },
    ],
  },
  {
    name: "Milk Type",
    slug: "milk-type",
    selectionType: "single",
    isRequired: false,
    minSelections: 0,
    maxSelections: 1,
    sortOrder: 4,
    options: [
      {
        name: "Regular milk",
        slug: "regular-milk",
        priceDeltaMinor: 0,
        sortOrder: 1,
      },
      {
        name: "Oat milk",
        slug: "oat-milk",
        priceDeltaMinor: 2500,
        sortOrder: 2,
      },
      {
        name: "Almond milk",
        slug: "almond-milk",
        priceDeltaMinor: 3000,
        sortOrder: 3,
      },
    ],
  },
  {
    name: "Extras",
    slug: "extras",
    selectionType: "multiple",
    isRequired: false,
    minSelections: 0,
    maxSelections: 3,
    sortOrder: 5,
    options: [
      {
        name: "Extra shot",
        slug: "extra-shot",
        priceDeltaMinor: 2000,
        sortOrder: 1,
      },
      { name: "Caramel", slug: "caramel", priceDeltaMinor: 1500, sortOrder: 2 },
      { name: "Vanilla", slug: "vanilla", priceDeltaMinor: 1500, sortOrder: 3 },
      {
        name: "Whipped cream",
        slug: "whipped-cream",
        priceDeltaMinor: 1500,
        sortOrder: 4,
      },
    ],
  },
] as const;

const signatureModifierSlugs = [
  "size",
  "temperature",
  "sugar-level",
  "milk-type",
  "extras",
];
const coffeeModifierSlugsByItem: Record<string, string[]> = {
  cortado: ["milk-type", "extras"],
  "flat-white": ["milk-type", "extras"],
  cappuccino: ["size", "milk-type", "extras"],
};
const coldDrinkModifierSlugsByItem: Record<string, string[]> = {
  "iced-spanish-latte": ["size", "sugar-level", "milk-type", "extras"],
  "lemon-mint": ["size", "sugar-level", "extras"],
  "peach-iced-tea": ["size", "sugar-level", "extras"],
  "hibiscus-lemonade": ["size", "sugar-level", "extras"],
  "cold-brew": ["size", "extras"],
};

const printerStationSeed: Array<{
  name: string;
  slug: string;
  station: PreparationStation | null;
}> = [
  {
    name: "Main Barista Printer",
    slug: "main-barista-printer",
    station: PreparationStation.barista,
  },
  {
    name: "Main Kitchen Printer",
    slug: "main-kitchen-printer",
    station: PreparationStation.kitchen,
  },
  {
    name: "Dessert Printer",
    slug: "dessert-printer",
    station: PreparationStation.dessert,
  },
  {
    name: "Cashier Receipt Printer",
    slug: "cashier-receipt-printer",
    station: null,
  },
];

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
        status: "active",
      },
      create: {
        companyId,
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
        status: "active",
      },
      select: { id: true },
    });

    categoryBySlug.set(category.slug, savedCategory);
  }

  const itemBySlug = new Map<string, { id: string }>();

  await prisma.menuItem.updateMany({
    where: { companyId },
    data: { status: "inactive", isFeatured: false },
  });

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
        description: item.description,
        imageUrl: item.imageUrl,
        basePriceMinor: item.basePriceMinor,
        currency: "EGP",
        station: item.station,
        status: "active",
        isFeatured: item.isFeatured ?? false,
        sortOrder: item.sortOrder,
      },
      create: {
        companyId,
        categoryId: category.id,
        name: item.name,
        slug: item.slug,
        description: item.description,
        imageUrl: item.imageUrl,
        basePriceMinor: item.basePriceMinor,
        currency: "EGP",
        station: item.station,
        status: "active",
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
        status: "active",
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
        status: "active",
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
          status: "active",
        },
        create: {
          groupId: savedGroup.id,
          name: option.name,
          slug: option.slug,
          priceDeltaMinor: option.priceDeltaMinor,
          sortOrder: option.sortOrder,
          status: "active",
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
      item.categorySlug === "signatures"
        ? signatureModifierSlugs
        : item.categorySlug === "coffee"
          ? (coffeeModifierSlugsByItem[item.slug] ?? [])
          : (coldDrinkModifierSlugsByItem[item.slug] ?? []);

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

async function seedPrinterStations(companyId: string, branchId: string) {
  for (const printerStation of printerStationSeed) {
    await prisma.printerStation.upsert({
      where: {
        branchId_slug: {
          branchId,
          slug: printerStation.slug,
        },
      },
      update: {
        name: printerStation.name,
        station: printerStation.station,
        adapterType: PrinterAdapterType.mock,
        status: "active",
        isDefault: true,
        config: {
          adapter: "mock",
          demo: true,
        },
      },
      create: {
        companyId,
        branchId,
        name: printerStation.name,
        slug: printerStation.slug,
        station: printerStation.station,
        adapterType: PrinterAdapterType.mock,
        status: "active",
        isDefault: true,
        config: {
          adapter: "mock",
          demo: true,
        },
      },
    });
  }
}

async function seedSaasPlans() {
  for (const plan of saasPlanSeed) {
    await prisma.saasPlan.upsert({
      where: { code: plan.code },
      update: {
        ...plan,
        status: SaasPlanStatus.active,
        currency: "EGP",
      },
      create: {
        ...plan,
        status: SaasPlanStatus.active,
        currency: "EGP",
      },
    });
  }
}

async function assignPilotSubscription(companyId: string) {
  const plan = await prisma.saasPlan.findUnique({
    where: { code: "pilot" },
  });

  if (!plan) {
    throw new Error("Pilot SaaS plan was not seeded");
  }

  await prisma.companySubscription.upsert({
    where: { companyId },
    update: {
      planId: plan.id,
      status: CompanySubscriptionStatus.active,
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      trialEndsAt: null,
      suspendedAt: null,
      cancelledAt: null,
      cancellationReason: null,
    },
    create: {
      companyId,
      planId: plan.id,
      status: CompanySubscriptionStatus.active,
      currentPeriodStart: new Date(),
      metadata: {
        source: "seed",
        demo: true,
      },
    },
  });
}

async function seedPlatformAdminIfEnabled() {
  const enabled = process.env.PLATFORM_ADMIN_DEV_BOOTSTRAP_ENABLED === "true";

  if (!enabled) {
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Platform admin dev bootstrap is disabled in production");
  }

  const email = (process.env.PLATFORM_ADMIN_EMAIL ?? "platform@balcona.local")
    .trim()
    .toLowerCase();
  const password =
    process.env.PLATFORM_ADMIN_PASSWORD ?? "change-me-platform-123";
  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  await prisma.platformAdminUser.upsert({
    where: { email },
    update: {
      name: "Balcona Platform Admin",
      passwordHash,
      role: PlatformAdminRole.owner,
      status: PlatformAdminStatus.active,
    },
    create: {
      email,
      name: "Balcona Platform Admin",
      passwordHash,
      role: PlatformAdminRole.owner,
      status: PlatformAdminStatus.active,
    },
  });
}

async function main() {
  await seedSaasPlans();
  await seedPlatformAdminIfEnabled();

  const company = await prisma.company.upsert({
    where: { slug: companySlug },
    update: {
      name: "Balcona Bar",
      status: "active",
    },
    create: {
      name: "Balcona Bar",
      slug: companySlug,
      status: "active",
    },
  });

  await assignPilotSubscription(company.id);

  const branch = await prisma.branch.upsert({
    where: {
      companyId_slug: {
        companyId: company.id,
        slug: branchSlug,
      },
    },
    update: {
      name: "Zamalek Rooftop",
      address: "Zamalek, Cairo",
      status: "active",
    },
    create: {
      companyId: company.id,
      name: "Zamalek Rooftop",
      slug: branchSlug,
      address: "Zamalek, Cairo",
      status: "active",
    },
  });

  const floor = await prisma.floor.upsert({
    where: {
      id: `${branch.id}:ground-floor`,
    },
    update: {
      name: "Indoor Lounge",
      sortOrder: 1,
    },
    create: {
      id: `${branch.id}:ground-floor`,
      branchId: branch.id,
      name: "Indoor Lounge",
      sortOrder: 1,
    },
  });

  const rooftopFloor = await prisma.floor.upsert({
    where: {
      id: `${branch.id}:rooftop`,
    },
    update: {
      name: "Rooftop",
      sortOrder: 2,
    },
    create: {
      id: `${branch.id}:rooftop`,
      branchId: branch.id,
      name: "Rooftop",
      sortOrder: 2,
    },
  });

  for (let index = 1; index <= 18; index += 1) {
    const code = `T${String(index).padStart(2, "0")}`;
    const isRooftop = index > 6;
    const capacity = index % 5 === 0 ? 6 : index % 3 === 0 ? 2 : 4;

    await prisma.cafeTable.upsert({
      where: {
        branchId_code: {
          branchId: branch.id,
          code,
        },
      },
      update: {
        displayName: isRooftop ? `Rooftop ${index - 6}` : `Lounge ${index}`,
        floorId: isRooftop ? rooftopFloor.id : floor.id,
        capacity,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: "active",
      },
      create: {
        branchId: branch.id,
        floorId: isRooftop ? rooftopFloor.id : floor.id,
        code,
        displayName: isRooftop ? `Rooftop ${index - 6}` : `Lounge ${index}`,
        capacity,
        qrToken: `balcona-main-${code.toLowerCase()}`,
        status: "active",
      },
    });
  }

  for (const staff of staffSeed) {
    const staffUser = await prisma.staffUser.upsert({
      where: { email: staff.email },
      update: {
        name: staff.name,
        status: "active",
      },
      create: {
        email: staff.email,
        name: staff.name,
        status: "active",
      },
    });

    const membershipBranchId = staff.role === "owner" ? null : branch.id;
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
        data: { status: "active" },
      });
    } else {
      await prisma.staffMembership.create({
        data: {
          staffUserId: staffUser.id,
          companyId: company.id,
          branchId: membershipBranchId,
          role: staff.role,
          status: "active",
        },
      });
    }
  }

  await seedMenu(company.id, branch.id);
  await seedPrinterStations(company.id, branch.id);
  await seedRealCafeDemo(prisma, {
    companyId: company.id,
    branchId: branch.id,
  });
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
