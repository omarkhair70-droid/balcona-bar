import {
  BillPaymentMethod,
  BranchFeatureFlagKey,
  CashDrawerTransactionSourceType,
  CashDrawerTransactionType,
  CashierShiftReportType,
  CashierShiftStatus,
  ContentBlockStatus,
  ExperienceProfileScope,
  ExperienceProfileStatus,
  InventoryMovementType,
  InventoryUnit,
  KitchenTicketStatus,
  KitchenTicketType,
  ManualPaymentStatus,
  OrderItem,
  OrderEventActorType,
  OrderEventType,
  OrderSource,
  OrderStatus,
  PreparationStation,
  PreparationTaskEventType,
  PreparationTaskStatus,
  Prisma,
  PrismaClient,
  TableAttentionPriority,
  TableAttentionReason,
  TableAttentionStatus,
  TableSessionSource,
  TableSessionStatus,
  WaiterCallActorType,
  WaiterCallEventType,
  WaiterCallStatus,
  WaiterCallType,
} from "@prisma/client";
import { createHash } from "node:crypto";
import {
  BALKONA_PACK_KEY,
  BALKONA_PACK_LANGUAGE,
  balkonaAiWaiterTone,
  balkonaBrandVoice,
  balkonaContentBlocks,
  balkonaDesignTokens,
  balkonaLayoutConfig,
  balkonaMotionTokens,
  balkonaNotificationTemplates,
  balkonaTheme,
  balkonaVenueZones,
} from "../src/experience/balkona-pack";

type DemoScope = {
  companyId: string;
  branchId: string;
};

type DemoItem = {
  slug: string;
  quantity: number;
  notes?: string;
};

type DemoOrder = {
  key: string;
  number: string;
  tableCode: string;
  status: OrderStatus;
  happenedAt: Date;
  items: readonly DemoItem[];
  paymentMethod?: BillPaymentMethod;
  shiftId?: string;
  customerNote?: string;
};

const DEMO_PREFIX = "balcona-demo-";

function demoId(key: string) {
  const hex = createHash("sha256")
    .update(`${DEMO_PREFIX}${key}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}

const inventorySeed = [
  {
    sku: "BEAN-HOUSE-1KG",
    name: "House espresso beans",
    unit: InventoryUnit.gram,
    par: 12000,
    low: 2500,
    quantity: 8600,
  },
  {
    sku: "MILK-FULL-1L",
    name: "Full-fat milk",
    unit: InventoryUnit.milliliter,
    par: 30000,
    low: 7000,
    quantity: 22400,
  },
  {
    sku: "MILK-OAT-1L",
    name: "Oat milk",
    unit: InventoryUnit.milliliter,
    par: 9000,
    low: 2500,
    quantity: 6400,
  },
  {
    sku: "PISTACHIO-1KG",
    name: "Pistachio cream",
    unit: InventoryUnit.gram,
    par: 5000,
    low: 1200,
    quantity: 3300,
  },
  {
    sku: "CROISSANT-BUTTER",
    name: "Butter croissant",
    unit: InventoryUnit.piece,
    par: 72,
    low: 18,
    quantity: 46,
  },
  {
    sku: "BRIOCHE-LOAF",
    name: "Brioche portions",
    unit: InventoryUnit.piece,
    par: 40,
    low: 10,
    quantity: 24,
  },
  {
    sku: "CHEESECAKE-SLICE",
    name: "Basque cheesecake slices",
    unit: InventoryUnit.piece,
    par: 24,
    low: 8,
    quantity: 7,
  },
  {
    sku: "LEMON-FRESH",
    name: "Fresh lemons",
    unit: InventoryUnit.piece,
    par: 90,
    low: 20,
    quantity: 58,
  },
  {
    sku: "MINT-FRESH",
    name: "Fresh mint",
    unit: InventoryUnit.gram,
    par: 1600,
    low: 350,
    quantity: 980,
  },
  {
    sku: "DATE-PASTE-1KG",
    name: "Egyptian date paste",
    unit: InventoryUnit.gram,
    par: 4000,
    low: 900,
    quantity: 2400,
  },
] as const;

const inventoryRequirements: Record<
  string,
  readonly { sku: string; quantity: number }[]
> = {
  "balcona-spanish-latte": [
    { sku: "BEAN-HOUSE-1KG", quantity: 20 },
    { sku: "MILK-FULL-1L", quantity: 180 },
  ],
  "cardamom-flat-white": [
    { sku: "BEAN-HOUSE-1KG", quantity: 20 },
    { sku: "MILK-FULL-1L", quantity: 150 },
  ],
  "pistachio-latte": [
    { sku: "BEAN-HOUSE-1KG", quantity: 20 },
    { sku: "MILK-FULL-1L", quantity: 180 },
    { sku: "PISTACHIO-1KG", quantity: 28 },
  ],
  cappuccino: [
    { sku: "BEAN-HOUSE-1KG", quantity: 18 },
    { sku: "MILK-FULL-1L", quantity: 150 },
  ],
  "iced-spanish-latte": [
    { sku: "BEAN-HOUSE-1KG", quantity: 20 },
    { sku: "MILK-FULL-1L", quantity: 170 },
  ],
  "lemon-mint": [
    { sku: "LEMON-FRESH", quantity: 2 },
    { sku: "MINT-FRESH", quantity: 18 },
  ],
  "butter-croissant": [{ sku: "CROISSANT-BUTTER", quantity: 1 }],
  "halloumi-croissant": [{ sku: "CROISSANT-BUTTER", quantity: 1 }],
  "turkey-brioche": [{ sku: "BRIOCHE-LOAF", quantity: 1 }],
  "basque-cheesecake": [{ sku: "CHEESECAKE-SLICE", quantity: 1 }],
  "date-toffee-pudding": [{ sku: "DATE-PASTE-1KG", quantity: 90 }],
};

function atLocalTime(daysAgo: number, hour: number, minute: number) {
  const value = new Date();
  value.setDate(value.getDate() - daysAgo);
  value.setHours(hour, minute, 0, 0);
  return value;
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function orderIs(status: OrderStatus, ...allowed: OrderStatus[]) {
  return allowed.includes(status);
}

function ticketIs(
  status: KitchenTicketStatus,
  ...allowed: KitchenTicketStatus[]
) {
  return allowed.includes(status);
}

async function seedExperience(
  prisma: PrismaClient,
  { companyId, branchId }: DemoScope,
) {
  const profilePayload = {
    companyId,
    branchId,
    scope: ExperienceProfileScope.branch,
    key: BALKONA_PACK_KEY,
    name: "Balcona Quiet Light",
    status: ExperienceProfileStatus.active,
    isDefault: true,
    language: BALKONA_PACK_LANGUAGE,
    theme: json(balkonaTheme),
    designTokens: json(balkonaDesignTokens),
    motionTokens: json(balkonaMotionTokens),
    layoutConfig: json(balkonaLayoutConfig),
    brandVoice: json(balkonaBrandVoice),
    aiWaiterTone: json(balkonaAiWaiterTone),
    metadata: json({ source: "real_cafe_demo_seed", version: 2 }),
  };
  const existingProfile = await prisma.experienceProfile.findFirst({
    where: { companyId, branchId, key: BALKONA_PACK_KEY },
    select: { id: true },
  });
  const profile = existingProfile
    ? await prisma.experienceProfile.update({
        where: { id: existingProfile.id },
        data: profilePayload,
      })
    : await prisma.experienceProfile.create({ data: profilePayload });

  await prisma.experienceProfile.updateMany({
    where: { companyId, branchId, id: { not: profile.id }, isDefault: true },
    data: { isDefault: false },
  });

  for (const block of balkonaContentBlocks) {
    const existing = await prisma.contentBlock.findFirst({
      where: {
        companyId,
        branchId,
        key: block.key,
        language: BALKONA_PACK_LANGUAGE,
      },
      select: { id: true },
    });
    const data = {
      companyId,
      branchId,
      experienceProfileId: profile.id,
      placement: block.placement,
      key: block.key,
      language: BALKONA_PACK_LANGUAGE,
      status: ContentBlockStatus.active,
      title: block.title,
      body: block.body,
      sortOrder: block.sortOrder,
      metadata: json({ source: "real_cafe_demo_seed" }),
    };

    if (existing) {
      await prisma.contentBlock.update({ where: { id: existing.id }, data });
    } else {
      await prisma.contentBlock.create({ data });
    }
  }

  for (const template of balkonaNotificationTemplates) {
    await prisma.notificationTemplate.upsert({
      where: {
        companyId_branchId_key_channel_language: {
          companyId,
          branchId,
          key: template.key,
          channel: template.channel,
          language: BALKONA_PACK_LANGUAGE,
        },
      },
      update: {
        kind: template.kind,
        title: template.title,
        body: template.body,
        isActive: true,
        metadata: json({ source: "real_cafe_demo_seed" }),
      },
      create: {
        companyId,
        branchId,
        key: template.key,
        kind: template.kind,
        channel: template.channel,
        language: BALKONA_PACK_LANGUAGE,
        title: template.title,
        body: template.body,
        isActive: true,
        metadata: json({ source: "real_cafe_demo_seed" }),
      },
    });
  }

  for (const zone of balkonaVenueZones) {
    await prisma.venueZone.upsert({
      where: { branchId_slug: { branchId, slug: zone.slug } },
      update: {
        name: zone.name,
        type: zone.type,
        status: "active",
        description: zone.description,
        metadata: json(zone.metadata),
      },
      create: {
        companyId,
        branchId,
        name: zone.name,
        slug: zone.slug,
        type: zone.type,
        status: "active",
        description: zone.description,
        metadata: json(zone.metadata),
      },
    });
  }
}

async function seedBranchConfiguration(
  prisma: PrismaClient,
  { companyId, branchId }: DemoScope,
) {
  await prisma.branchOperatingSettings.upsert({
    where: { branchId },
    update: {
      operatingMode: "assisted",
      serviceMode: "dine_in",
      aiWaiterEnabled: true,
      waiterCallsEnabled: true,
      smartCashierEnabled: true,
      realtimeEnabled: true,
      mediaExperienceEnabled: true,
      billFlowEnabled: true,
      tableAttentionEnabled: true,
      analyticsEnabled: true,
      notificationsEnabled: true,
      presenceTriggersEnabled: true,
      openingHours: json({
        timezone: "Africa/Cairo",
        daily: { opens: "08:00", closes: "01:00" },
      }),
      serviceConfig: json({ tableTurnMinutes: 90, lastOrderMinutes: 30 }),
      metadata: json({ source: "real_cafe_demo_seed" }),
    },
    create: {
      companyId,
      branchId,
      operatingMode: "assisted",
      serviceMode: "dine_in",
      openingHours: json({
        timezone: "Africa/Cairo",
        daily: { opens: "08:00", closes: "01:00" },
      }),
      serviceConfig: json({ tableTurnMinutes: 90, lastOrderMinutes: 30 }),
      metadata: json({ source: "real_cafe_demo_seed" }),
    },
  });

  const featureKeys = Object.values(BranchFeatureFlagKey);
  for (const key of featureKeys) {
    await prisma.branchFeatureFlag.upsert({
      where: { branchId_key: { branchId, key } },
      update: { enabled: true, config: json({ demoReady: true }) },
      create: {
        companyId,
        branchId,
        key,
        enabled: true,
        config: json({ demoReady: true }),
      },
    });
  }

  await prisma.branchSmartCashierSettings.upsert({
    where: { branchId },
    update: {
      enabled: true,
      mode: "assisted",
      maxAutoAcceptSubtotalMinor: 40000,
      requirePaymentBeforeAutoAccept: false,
      reviewCustomerNotes: true,
    },
    create: {
      companyId,
      branchId,
      enabled: true,
      mode: "assisted",
      maxAutoAcceptSubtotalMinor: 40000,
      requirePaymentBeforeAutoAccept: false,
      reviewCustomerNotes: true,
    },
  });
}

async function seedInventory(
  prisma: PrismaClient,
  { companyId, branchId }: DemoScope,
  managerId: string,
) {
  await prisma.inventoryMovement.deleteMany({
    where: {
      OR: [
        { sourceType: "real_cafe_demo_seed" },
        { id: { startsWith: `${DEMO_PREFIX}inventory-` } },
      ],
    },
  });
  await prisma.inventoryItem.updateMany({
    where: { companyId },
    data: { status: "inactive" },
  });

  const inventoryBySku = new Map<string, { id: string; unit: InventoryUnit }>();
  for (const item of inventorySeed) {
    const inventoryItem = await prisma.inventoryItem.upsert({
      where: { companyId_sku: { companyId, sku: item.sku } },
      update: {
        name: item.name,
        unit: item.unit,
        status: "active",
        parLevelQuantity: item.par,
        lowStockThresholdQuantity: item.low,
      },
      create: {
        companyId,
        name: item.name,
        sku: item.sku,
        unit: item.unit,
        status: "active",
        parLevelQuantity: item.par,
        lowStockThresholdQuantity: item.low,
      },
    });
    inventoryBySku.set(item.sku, inventoryItem);

    await prisma.branchInventoryLevel.upsert({
      where: {
        branchId_inventoryItemId: {
          branchId,
          inventoryItemId: inventoryItem.id,
        },
      },
      update: {
        quantityOnHand: item.quantity,
        reservedQuantity: 0,
        lowStockThresholdQuantity: item.low,
      },
      create: {
        companyId,
        branchId,
        inventoryItemId: inventoryItem.id,
        quantityOnHand: item.quantity,
        reservedQuantity: 0,
        lowStockThresholdQuantity: item.low,
      },
    });

    await prisma.inventoryMovement.create({
      data: {
        id: demoId(`inventory-${item.sku.toLowerCase()}`),
        companyId,
        branchId,
        inventoryItemId: inventoryItem.id,
        staffUserId: managerId,
        type: InventoryMovementType.opening_balance,
        quantityDelta: item.quantity,
        quantityAfter: item.quantity,
        unit: item.unit,
        sourceType: "real_cafe_demo_seed",
        sourceId: branchId,
        note: "Portfolio demo operating balance",
        createdAt: atLocalTime(1, 7, 30),
      },
    });
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { companyId, slug: { in: Object.keys(inventoryRequirements) } },
    select: { id: true, slug: true },
  });
  for (const menuItem of menuItems) {
    for (const requirement of inventoryRequirements[menuItem.slug] ?? []) {
      const inventoryItem = inventoryBySku.get(requirement.sku);
      if (!inventoryItem) continue;

      await prisma.menuItemInventoryRequirement.upsert({
        where: {
          menuItemId_inventoryItemId: {
            menuItemId: menuItem.id,
            inventoryItemId: inventoryItem.id,
          },
        },
        update: {
          quantityRequired: requirement.quantity,
          unit: inventoryItem.unit,
          isRequired: true,
        },
        create: {
          companyId,
          menuItemId: menuItem.id,
          inventoryItemId: inventoryItem.id,
          quantityRequired: requirement.quantity,
          unit: inventoryItem.unit,
          isRequired: true,
        },
      });
    }
  }

  const supplierId = demoId("supplier-cairo-roastery");
  const purchaseOrderId = demoId("purchase-order-0829");
  await prisma.purchaseOrder.deleteMany({
    where: {
      orderNumber: "PO-ZAM-2026-0829",
      id: { not: purchaseOrderId },
    },
  });
  await prisma.supplier.deleteMany({
    where: { id: `${DEMO_PREFIX}supplier-cairo-roastery` },
  });

  const supplier = await prisma.supplier.upsert({
    where: { id: supplierId },
    update: {
      name: "Cairo Roastery & Provisions",
      contact: "Mariam Saleh",
      phone: "+20 100 555 0184",
      email: "orders@cairo-roastery.example",
      address: "New Cairo, Cairo",
      status: "active",
    },
    create: {
      id: supplierId,
      companyId,
      name: "Cairo Roastery & Provisions",
      contact: "Mariam Saleh",
      phone: "+20 100 555 0184",
      email: "orders@cairo-roastery.example",
      address: "New Cairo, Cairo",
      status: "active",
    },
  });

  const purchaseOrder = await prisma.purchaseOrder.upsert({
    where: { id: purchaseOrderId },
    update: {
      supplierId: supplier.id,
      status: "submitted",
      expectedAt: atLocalTime(-1, 9, 0),
      notes: "Weekly coffee, alternative milk and pastry restock",
      createdByStaffUserId: managerId,
    },
    create: {
      id: purchaseOrderId,
      companyId,
      branchId,
      supplierId: supplier.id,
      orderNumber: "PO-ZAM-2026-0829",
      status: "submitted",
      expectedAt: atLocalTime(-1, 9, 0),
      notes: "Weekly coffee, alternative milk and pastry restock",
      currency: "EGP",
      createdByStaffUserId: managerId,
    },
  });

  const replenishment = [
    { sku: "BEAN-HOUSE-1KG", quantity: 12000, unitCostMinor: 92000 },
    { sku: "MILK-OAT-1L", quantity: 12000, unitCostMinor: 8500 },
    { sku: "CROISSANT-BUTTER", quantity: 72, unitCostMinor: 3600 },
  ];
  for (const [index, line] of replenishment.entries()) {
    const inventoryItem = inventoryBySku.get(line.sku);
    if (!inventoryItem) continue;
    await prisma.purchaseOrderLine.upsert({
      where: { id: demoId(`purchase-order-0829-line-${index + 1}`) },
      update: {
        inventoryItemId: inventoryItem.id,
        quantityOrdered: line.quantity,
        unitCostMinor: line.unitCostMinor,
      },
      create: {
        id: demoId(`purchase-order-0829-line-${index + 1}`),
        purchaseOrderId: purchaseOrder.id,
        inventoryItemId: inventoryItem.id,
        quantityOrdered: line.quantity,
        unitCostMinor: line.unitCostMinor,
      },
    });
  }
}

function kitchenTicketType(station: PreparationStation) {
  if (station === PreparationStation.kitchen)
    return KitchenTicketType.kitchen_order;
  if (station === PreparationStation.dessert)
    return KitchenTicketType.dessert_order;
  return KitchenTicketType.barista_order;
}

async function seedOperations(
  prisma: PrismaClient,
  { companyId, branchId }: DemoScope,
  staff: { managerId: string; cashierId: string; waiterId: string },
) {
  await prisma.tableSession.deleteMany({
    where: {
      branchId,
      OR: [
        { source: TableSessionSource.dev },
        { id: { startsWith: `${DEMO_PREFIX}session-` } },
      ],
    },
  });
  await prisma.tableSession.updateMany({
    where: {
      branchId,
      status: { in: [TableSessionStatus.active, TableSessionStatus.idle] },
    },
    data: {
      status: TableSessionStatus.closed,
      closedAt: new Date(),
      closeReason: "Archived by the local real-cafe demo seed",
    },
  });
  await prisma.cashierShift.deleteMany({
    where: {
      branchId,
      OR: [
        { openingNote: "Balcona Zamalek service shift" },
        { id: { startsWith: `${DEMO_PREFIX}shift-` } },
      ],
    },
  });
  await prisma.cashierShift.updateMany({
    where: {
      branchId,
      status: CashierShiftStatus.open,
    },
    data: {
      status: CashierShiftStatus.closed,
      closedAt: new Date(),
      closedByStaffUserId: staff.managerId,
      closingNote: "Archived by the local real-cafe demo seed",
    },
  });

  const tables = await prisma.cafeTable.findMany({
    where: { branchId },
    include: { floor: { select: { name: true } } },
  });
  const tableByCode = new Map(tables.map((table) => [table.code, table]));
  const menuItems = await prisma.menuItem.findMany({
    where: { companyId, status: "active" },
    select: {
      id: true,
      name: true,
      slug: true,
      basePriceMinor: true,
      currency: true,
      station: true,
    },
  });
  const menuBySlug = new Map(menuItems.map((item) => [item.slug, item]));

  const shifts = [
    {
      id: demoId("shift-current"),
      status: CashierShiftStatus.open,
      openedAt: atLocalTime(0, 8, 15),
      openingFloatMinor: 250000,
      expectedCashMinor: 272500,
      cashSalesMinor: 22500,
      cardSalesMinor: 73500,
      walletSalesMinor: 27500,
      paymentCount: 4,
      billCount: 4,
    },
    {
      id: demoId("shift-yesterday"),
      status: CashierShiftStatus.closed,
      openedAt: atLocalTime(1, 8, 5),
      closedAt: atLocalTime(1, 23, 40),
      openingFloatMinor: 200000,
      expectedCashMinor: 229000,
      countedCashMinor: 229000,
      cashOverShortMinor: 0,
      cashSalesMinor: 29000,
      cardSalesMinor: 46500,
      walletSalesMinor: 0,
      paymentCount: 2,
      billCount: 2,
    },
    {
      id: demoId("shift-two-days"),
      status: CashierShiftStatus.closed,
      openedAt: atLocalTime(2, 8, 10),
      closedAt: atLocalTime(2, 23, 20),
      openingFloatMinor: 200000,
      expectedCashMinor: 200000,
      countedCashMinor: 200000,
      cashOverShortMinor: 0,
      cashSalesMinor: 0,
      cardSalesMinor: 26500,
      walletSalesMinor: 0,
      paymentCount: 1,
      billCount: 1,
    },
    {
      id: demoId("shift-three-days"),
      status: CashierShiftStatus.closed,
      openedAt: atLocalTime(3, 8, 0),
      closedAt: atLocalTime(3, 23, 10),
      openingFloatMinor: 200000,
      expectedCashMinor: 200000,
      countedCashMinor: 200000,
      cashOverShortMinor: 0,
      cashSalesMinor: 0,
      cardSalesMinor: 0,
      walletSalesMinor: 33000,
      paymentCount: 1,
      billCount: 1,
    },
  ] as const;

  for (const shift of shifts) {
    await prisma.cashierShift.create({
      data: {
        ...shift,
        companyId,
        branchId,
        openedByStaffUserId: staff.cashierId,
        closedByStaffUserId:
          shift.status === CashierShiftStatus.closed ? staff.managerId : null,
        currency: "EGP",
        openingNote: "Balcona Zamalek service shift",
        closingNote:
          shift.status === CashierShiftStatus.closed
            ? "Till counted and handover complete"
            : null,
        zReportNumber:
          shift.status === CashierShiftStatus.closed
            ? `Z-${shift.id.slice(-8).toUpperCase()}`
            : null,
        zReportSnapshot:
          shift.status === CashierShiftStatus.closed
            ? json({ source: "real_cafe_demo_seed", balanced: true })
            : Prisma.JsonNull,
      },
    });

    if (shift.status === CashierShiftStatus.closed) {
      await prisma.cashierShiftReport.create({
        data: {
          id: demoId(`shift-report-${shift.id}`),
          companyId,
          branchId,
          cashierShiftId: shift.id,
          generatedByStaffUserId: staff.managerId,
          type: CashierShiftReportType.z_report,
          reportNumber: `ZR-${shift.id.slice(-8).toUpperCase()}`,
          snapshot: json({
            paymentCount: shift.paymentCount,
            billCount: shift.billCount,
            cashSalesMinor: shift.cashSalesMinor,
            cardSalesMinor: shift.cardSalesMinor,
            walletSalesMinor: shift.walletSalesMinor,
            balanced: true,
          }),
          generatedAt: shift.closedAt,
          createdAt: shift.closedAt,
        },
      });
    }
  }

  const historicalOrders: DemoOrder[] = [
    {
      key: "paid-01",
      number: "BLC-260829-101",
      tableCode: "T07",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(0, 10, 15),
      items: [
        { slug: "balcona-spanish-latte", quantity: 1 },
        { slug: "butter-croissant", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.cash,
      shiftId: demoId("shift-current"),
    },
    {
      key: "paid-02",
      number: "BLC-260829-102",
      tableCode: "T09",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(0, 11, 5),
      items: [
        { slug: "cappuccino", quantity: 2 },
        { slug: "basque-cheesecake", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.card_pos,
      shiftId: demoId("shift-current"),
    },
    {
      key: "paid-03",
      number: "BLC-260829-103",
      tableCode: "T10",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(0, 12, 40),
      items: [
        { slug: "cold-brew", quantity: 1 },
        { slug: "turkey-brioche", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.card_pos,
      shiftId: demoId("shift-current"),
    },
    {
      key: "paid-04",
      number: "BLC-260829-104",
      tableCode: "T12",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(0, 13, 25),
      items: [
        { slug: "pistachio-latte", quantity: 1 },
        { slug: "dark-chocolate-brownie", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.wallet_manual,
      shiftId: demoId("shift-current"),
    },
    {
      key: "paid-05",
      number: "BLC-260828-087",
      tableCode: "T14",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(1, 17, 10),
      items: [
        { slug: "v60-filter", quantity: 1 },
        { slug: "date-toffee-pudding", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.cash,
      shiftId: demoId("shift-yesterday"),
    },
    {
      key: "paid-06",
      number: "BLC-260828-093",
      tableCode: "T11",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(1, 19, 30),
      items: [
        { slug: "iced-spanish-latte", quantity: 2 },
        { slug: "basque-cheesecake", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.card_pos,
      shiftId: demoId("shift-yesterday"),
    },
    {
      key: "paid-07",
      number: "BLC-260827-071",
      tableCode: "T16",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(2, 16, 45),
      items: [
        { slug: "flat-white", quantity: 1 },
        { slug: "halloumi-croissant", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.card_pos,
      shiftId: demoId("shift-two-days"),
    },
    {
      key: "paid-08",
      number: "BLC-260826-064",
      tableCode: "T08",
      status: OrderStatus.completed,
      happenedAt: atLocalTime(3, 20, 10),
      items: [
        { slug: "orange-espresso-tonic", quantity: 1 },
        { slug: "pistachio-tiramisu", quantity: 1 },
      ],
      paymentMethod: BillPaymentMethod.wallet_manual,
      shiftId: demoId("shift-three-days"),
    },
  ];
  const activeOrders: DemoOrder[] = [
    {
      key: "submitted",
      number: "BLC-LIVE-118",
      tableCode: "T03",
      status: OrderStatus.submitted,
      happenedAt: new Date(Date.now() - 4 * 60 * 1000),
      items: [
        { slug: "balcona-spanish-latte", quantity: 1 },
        { slug: "turkey-brioche", quantity: 1 },
      ],
      customerNote: "Latte less sweet, please.",
    },
    {
      key: "preparing",
      number: "BLC-LIVE-117",
      tableCode: "T04",
      status: OrderStatus.preparing,
      happenedAt: new Date(Date.now() - 12 * 60 * 1000),
      items: [
        { slug: "cappuccino", quantity: 1 },
        { slug: "halloumi-croissant", quantity: 1 },
        { slug: "dark-chocolate-brownie", quantity: 1 },
      ],
    },
    {
      key: "ready",
      number: "BLC-LIVE-116",
      tableCode: "T05",
      status: OrderStatus.ready,
      happenedAt: new Date(Date.now() - 18 * 60 * 1000),
      items: [
        { slug: "iced-spanish-latte", quantity: 1 },
        { slug: "basque-cheesecake", quantity: 1 },
      ],
    },
    {
      key: "bill",
      number: "BLC-LIVE-115",
      tableCode: "T06",
      status: OrderStatus.served,
      happenedAt: new Date(Date.now() - 34 * 60 * 1000),
      items: [
        { slug: "cardamom-flat-white", quantity: 1 },
        { slug: "turkey-brioche", quantity: 1 },
        { slug: "date-toffee-pudding", quantity: 1 },
      ],
    },
  ];

  for (const demoOrder of [...historicalOrders, ...activeOrders]) {
    const table = tableByCode.get(demoOrder.tableCode);
    if (!table) throw new Error(`Missing demo table ${demoOrder.tableCode}`);
    const isClosed = demoOrder.status === OrderStatus.completed;
    const sessionId = demoId(`session-${demoOrder.key}`);
    const orderId = demoId(`order-${demoOrder.key}`);
    const session = await prisma.tableSession.create({
      data: {
        id: sessionId,
        companyId,
        branchId,
        tableId: table.id,
        status: isClosed
          ? TableSessionStatus.closed
          : TableSessionStatus.active,
        source: TableSessionSource.dev,
        guestLabel: `Demo · ${demoOrder.tableCode}`,
        partySize:
          demoOrder.items.reduce((sum, item) => sum + item.quantity, 0) > 3
            ? 4
            : 2,
        startedAt: demoOrder.happenedAt,
        lastSeenAt: demoOrder.happenedAt,
        closedAt: isClosed
          ? new Date(demoOrder.happenedAt.getTime() + 55 * 60 * 1000)
          : null,
        closeReason: isClosed ? "visit_completed" : null,
        createdAt: demoOrder.happenedAt,
      },
    });

    const resolvedItems = demoOrder.items.map((item) => {
      const menuItem = menuBySlug.get(item.slug);
      if (!menuItem) throw new Error(`Missing demo menu item ${item.slug}`);
      return { ...item, menuItem };
    });
    const subtotalMinor = resolvedItems.reduce(
      (sum, item) => sum + item.menuItem.basePriceMinor * item.quantity,
      0,
    );
    const acceptedAt = new Date(demoOrder.happenedAt.getTime() + 2 * 60 * 1000);
    const preparingAt = new Date(
      demoOrder.happenedAt.getTime() + 4 * 60 * 1000,
    );
    const readyAt = new Date(demoOrder.happenedAt.getTime() + 13 * 60 * 1000);
    const servedAt = new Date(demoOrder.happenedAt.getTime() + 17 * 60 * 1000);
    const completedAt = new Date(
      demoOrder.happenedAt.getTime() + 47 * 60 * 1000,
    );
    const order = await prisma.order.create({
      data: {
        id: orderId,
        companyId,
        branchId,
        tableSessionId: session.id,
        orderNumber: demoOrder.number,
        status: demoOrder.status,
        source: OrderSource.customer_qr,
        currency: "EGP",
        subtotalMinor,
        totalQuantity: resolvedItems.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        itemCount: resolvedItems.length,
        customerNote: demoOrder.customerNote,
        idempotencyKey: `${DEMO_PREFIX}${demoOrder.key}`,
        submittedAt: demoOrder.happenedAt,
        cashierAcceptedAt:
          demoOrder.status === OrderStatus.submitted ? null : acceptedAt,
        preparingAt: orderIs(
          demoOrder.status,
          OrderStatus.preparing,
          OrderStatus.ready,
          OrderStatus.served,
          OrderStatus.completed,
        )
          ? preparingAt
          : null,
        readyAt: orderIs(
          demoOrder.status,
          OrderStatus.ready,
          OrderStatus.served,
          OrderStatus.completed,
        )
          ? readyAt
          : null,
        servedAt: orderIs(
          demoOrder.status,
          OrderStatus.served,
          OrderStatus.completed,
        )
          ? servedAt
          : null,
        completedAt: isClosed ? completedAt : null,
        servedByStaffUserId: orderIs(
          demoOrder.status,
          OrderStatus.served,
          OrderStatus.completed,
        )
          ? staff.waiterId
          : null,
        completedByStaffUserId: isClosed ? staff.managerId : null,
        completionNote: isClosed ? "Visit settled and table released" : null,
        smartCashierModeSnapshot: "assisted",
        autoAcceptEvaluatedAt: acceptedAt,
        createdAt: demoOrder.happenedAt,
      },
    });

    const orderItems: OrderItem[] = [];
    for (const [index, item] of resolvedItems.entries()) {
      orderItems.push(
        await prisma.orderItem.create({
          data: {
            id: demoId(`order-${demoOrder.key}-item-${index + 1}`),
            orderId: order.id,
            menuItemId: item.menuItem.id,
            quantity: item.quantity,
            notes: item.notes,
            itemNameSnapshot: item.menuItem.name,
            itemSlugSnapshot: item.menuItem.slug,
            basePriceMinorSnapshot: item.menuItem.basePriceMinor,
            effectiveBasePriceMinorSnapshot: item.menuItem.basePriceMinor,
            modifiersTotalMinorSnapshot: 0,
            unitPriceMinorSnapshot: item.menuItem.basePriceMinor,
            lineTotalMinorSnapshot:
              item.menuItem.basePriceMinor * item.quantity,
            currency: "EGP",
            createdAt: demoOrder.happenedAt,
          },
        }),
      );
    }

    await prisma.orderEvent.createMany({
      data: [
        {
          id: demoId(`order-${demoOrder.key}-event-submitted`),
          orderId: order.id,
          type: OrderEventType.submitted,
          actorType: OrderEventActorType.customer,
          createdAt: demoOrder.happenedAt,
        },
        ...(demoOrder.status === OrderStatus.submitted
          ? []
          : [
              {
                id: demoId(`order-${demoOrder.key}-event-accepted`),
                orderId: order.id,
                type: OrderEventType.cashier_accepted,
                actorType: OrderEventActorType.staff,
                actorStaffUserId: staff.cashierId,
                createdAt: acceptedAt,
              },
            ]),
        ...(isClosed
          ? [
              {
                id: demoId(`order-${demoOrder.key}-event-completed`),
                orderId: order.id,
                type: OrderEventType.completed,
                actorType: OrderEventActorType.staff,
                actorStaffUserId: staff.managerId,
                createdAt: completedAt,
              },
            ]
          : []),
      ],
    });

    if (
      orderIs(
        demoOrder.status,
        OrderStatus.preparing,
        OrderStatus.ready,
        OrderStatus.served,
      )
    ) {
      for (const [index, item] of orderItems.entries()) {
        const source = resolvedItems[index].menuItem;
        const taskStatus =
          demoOrder.status === OrderStatus.preparing
            ? index === 0
              ? PreparationTaskStatus.preparing
              : PreparationTaskStatus.pending
            : PreparationTaskStatus.ready;
        const ticketStatus =
          demoOrder.status === OrderStatus.preparing
            ? index === 0
              ? KitchenTicketStatus.in_progress
              : KitchenTicketStatus.queued
            : demoOrder.status === OrderStatus.served
              ? KitchenTicketStatus.served
              : KitchenTicketStatus.ready;
        const task = await prisma.preparationTask.create({
          data: {
            id: demoId(`order-${demoOrder.key}-task-${index + 1}`),
            companyId,
            branchId,
            orderId: order.id,
            orderItemId: item.id,
            station: source.station,
            status: taskStatus,
            quantity: item.quantity,
            itemNameSnapshot: source.name,
            itemSlugSnapshot: source.slug,
            notes: item.notes,
            startedAt:
              taskStatus === PreparationTaskStatus.pending ? null : preparingAt,
            readyAt:
              taskStatus === PreparationTaskStatus.ready ? readyAt : null,
            createdAt: acceptedAt,
          },
        });
        await prisma.preparationTaskEvent.create({
          data: {
            id: demoId(`order-${demoOrder.key}-task-${index + 1}-event`),
            preparationTaskId: task.id,
            type:
              taskStatus === PreparationTaskStatus.ready
                ? PreparationTaskEventType.marked_ready
                : taskStatus === PreparationTaskStatus.preparing
                  ? PreparationTaskEventType.started
                  : PreparationTaskEventType.created,
            actorStaffUserId: staff.managerId,
            createdAt:
              taskStatus === PreparationTaskStatus.ready ? readyAt : acceptedAt,
          },
        });

        const ticket = await prisma.kitchenTicket.create({
          data: {
            id: demoId(`order-${demoOrder.key}-ticket-${index + 1}`),
            companyId,
            branchId,
            orderId: order.id,
            tableSessionId: session.id,
            station: source.station,
            type: kitchenTicketType(source.station),
            status: ticketStatus,
            displayCode: `K${demoOrder.number.slice(-3)}-${index + 1}`,
            sequence:
              9000 +
              Number(demoOrder.number.replace(/\D/g, "").slice(-3) || 0) +
              index,
            orderNumberSnapshot: demoOrder.number,
            tableCodeSnapshot: table.code,
            floorNameSnapshot: table.floor?.name ?? null,
            customerNoteSnapshot: demoOrder.customerNote,
            printedAt: acceptedAt,
            readyAt: ticketIs(
              ticketStatus,
              KitchenTicketStatus.ready,
              KitchenTicketStatus.served,
            )
              ? readyAt
              : null,
            servedAt:
              ticketStatus === KitchenTicketStatus.served ? servedAt : null,
            createdAt: acceptedAt,
          },
        });
        await prisma.kitchenTicketItem.create({
          data: {
            id: demoId(`order-${demoOrder.key}-ticket-${index + 1}-item`),
            ticketId: ticket.id,
            orderItemId: item.id,
            preparationTaskId: task.id,
            menuItemId: source.id,
            itemNameSnapshot: source.name,
            itemSlugSnapshot: source.slug,
            quantity: item.quantity,
            notes: item.notes,
            station: source.station,
            status: ticketStatus,
            createdAt: acceptedAt,
          },
        });
      }
    }

    if (isClosed || demoOrder.key === "bill") {
      const requestedAt = isClosed
        ? new Date(demoOrder.happenedAt.getTime() + 35 * 60 * 1000)
        : new Date(Date.now() - 5 * 60 * 1000);
      const billRequest = await prisma.billRequest.create({
        data: {
          id: demoId(`order-${demoOrder.key}-bill-request`),
          companyId,
          branchId,
          tableSessionId: session.id,
          status: isClosed ? "closed" : "open",
          currency: "EGP",
          subtotalMinor,
          orderCount: 1,
          requestedAt,
          closedAt: isClosed ? completedAt : null,
          requestedByActorType: "customer",
          closedByStaffUserId: isClosed ? staff.cashierId : null,
          note: isClosed ? "Settled at cashier" : "Guest requested the bill",
          createdAt: requestedAt,
        },
      });
      const bill = await prisma.bill.create({
        data: {
          id: demoId(`order-${demoOrder.key}-bill`),
          companyId,
          branchId,
          tableSessionId: session.id,
          billRequestId: billRequest.id,
          status: isClosed ? "closed" : "requested",
          billNumber: demoOrder.number.replace("BLC", "BILL"),
          currency: "EGP",
          subtotalMinor,
          totalMinor: subtotalMinor,
          paidMinor: isClosed ? subtotalMinor : 0,
          balanceDueMinor: isClosed ? 0 : subtotalMinor,
          orderCount: 1,
          lineCount: orderItems.length,
          requestedAt,
          paidAt: isClosed ? completedAt : null,
          closedAt: isClosed ? completedAt : null,
          createdByActorType: "system",
          paidByStaffUserId: isClosed ? staff.cashierId : null,
          closedByStaffUserId: isClosed ? staff.cashierId : null,
          metadata: json({ source: "real_cafe_demo_seed" }),
          createdAt: requestedAt,
        },
      });

      for (const item of orderItems) {
        await prisma.billLine.create({
          data: {
            id: demoId(`order-${demoOrder.key}-bill-line-${item.id}`),
            billId: bill.id,
            orderId: order.id,
            orderItemId: item.id,
            menuItemId: item.menuItemId,
            itemNameSnapshot: item.itemNameSnapshot,
            quantity: item.quantity,
            unitPriceMinor: item.unitPriceMinorSnapshot,
            modifiersTotalMinor: item.modifiersTotalMinorSnapshot,
            lineTotalMinor: item.lineTotalMinorSnapshot,
            currency: "EGP",
            createdAt: requestedAt,
          },
        });
      }

      if (isClosed && demoOrder.paymentMethod && demoOrder.shiftId) {
        const payment = await prisma.manualPayment.create({
          data: {
            id: demoId(`order-${demoOrder.key}-payment`),
            companyId,
            branchId,
            billId: bill.id,
            cashierShiftId: demoOrder.shiftId,
            method: demoOrder.paymentMethod,
            status: ManualPaymentStatus.recorded,
            amountMinor: subtotalMinor,
            currency: "EGP",
            reference: `${demoOrder.paymentMethod.toUpperCase()}-${demoOrder.number}`,
            note: "Recorded against the settled table bill",
            recordedByStaffUserId: staff.cashierId,
            recordedAt: completedAt,
            createdAt: completedAt,
          },
        });
        if (demoOrder.paymentMethod === BillPaymentMethod.cash) {
          await prisma.cashDrawerTransaction.create({
            data: {
              id: demoId(`order-${demoOrder.key}-drawer`),
              companyId,
              branchId,
              cashierShiftId: demoOrder.shiftId,
              staffUserId: staff.cashierId,
              type: CashDrawerTransactionType.cash_payment,
              signedAmountMinor: subtotalMinor,
              currency: "EGP",
              sourceType: CashDrawerTransactionSourceType.manual_payment,
              sourceId: payment.id,
              note: `Cash settlement ${demoOrder.number}`,
              createdAt: completedAt,
            },
          });
        }
        await prisma.billReceipt.create({
          data: {
            id: demoId(`order-${demoOrder.key}-receipt`),
            companyId,
            branchId,
            billId: bill.id,
            receiptNumber: demoOrder.number.replace("BLC", "RCP"),
            payload: json({
              orderNumber: demoOrder.number,
              table: table.displayName,
              totalMinor: subtotalMinor,
              method: demoOrder.paymentMethod,
              source: "real_cafe_demo_seed",
            }),
            printableText: `Balcona Bar\n${demoOrder.number}\nTotal EGP ${(subtotalMinor / 100).toFixed(2)}`,
            generatedAt: completedAt,
            createdAt: completedAt,
          },
        });
      }
    }

    if (demoOrder.status === OrderStatus.submitted) {
      await prisma.tableAttentionSnapshot.create({
        data: {
          id: demoId(`session-${demoOrder.key}-attention`),
          companyId,
          branchId,
          tableSessionId: session.id,
          status: TableAttentionStatus.needs_attention,
          priority: TableAttentionPriority.high,
          score: 74,
          reasons: json([TableAttentionReason.order_waiting_for_acceptance]),
          recommendedActions: json(["Review and accept order"]),
          source: "real_cafe_demo_seed",
          lastEvaluatedAt: new Date(),
        },
      });
    }
    if (demoOrder.status === OrderStatus.ready) {
      await prisma.tableAttentionSnapshot.create({
        data: {
          id: demoId(`session-${demoOrder.key}-attention`),
          companyId,
          branchId,
          tableSessionId: session.id,
          status: TableAttentionStatus.urgent,
          priority: TableAttentionPriority.urgent,
          score: 92,
          reasons: json([TableAttentionReason.order_ready_not_served]),
          recommendedActions: json(["Run order to table now"]),
          source: "real_cafe_demo_seed",
          lastEvaluatedAt: new Date(),
        },
      });
    }
  }

  const waiterTable = tableByCode.get("T08");
  if (!waiterTable) throw new Error("Missing demo table T08");
  const waiterSession = await prisma.tableSession.create({
    data: {
      id: demoId("session-waiter-call"),
      companyId,
      branchId,
      tableId: waiterTable.id,
      status: TableSessionStatus.active,
      source: TableSessionSource.dev,
      guestLabel: "Demo · service call",
      partySize: 3,
      startedAt: new Date(Date.now() - 48 * 60 * 1000),
      lastSeenAt: new Date(Date.now() - 2 * 60 * 1000),
    },
  });
  const waiterCall = await prisma.waiterCall.create({
    data: {
      id: demoId("waiter-call-water"),
      companyId,
      branchId,
      tableSessionId: waiterSession.id,
      tableId: waiterTable.id,
      type: WaiterCallType.need_water,
      status: WaiterCallStatus.open,
      message: "Still water for three, please.",
      priority: 2,
      createdAt: new Date(Date.now() - 3 * 60 * 1000),
    },
  });
  await prisma.waiterCallEvent.create({
    data: {
      id: demoId("waiter-call-water-event-created"),
      waiterCallId: waiterCall.id,
      type: WaiterCallEventType.created,
      actorType: WaiterCallActorType.customer,
      createdAt: waiterCall.createdAt,
    },
  });
  await prisma.tableAttentionSnapshot.create({
    data: {
      id: demoId("session-waiter-call-attention"),
      companyId,
      branchId,
      tableSessionId: waiterSession.id,
      status: TableAttentionStatus.needs_attention,
      priority: TableAttentionPriority.high,
      score: 81,
      reasons: json([TableAttentionReason.waiter_call_open]),
      recommendedActions: json(["Acknowledge water request"]),
      source: "real_cafe_demo_seed",
      lastEvaluatedAt: new Date(),
    },
  });
}

export async function seedRealCafeDemo(prisma: PrismaClient, scope: DemoScope) {
  const staffUsers = await prisma.staffUser.findMany({
    where: {
      email: {
        in: [
          "manager@balcona.local",
          "cashier@balcona.local",
          "waiter@balcona.local",
        ],
      },
    },
    select: { id: true, email: true },
  });
  const staffByEmail = new Map(staffUsers.map((user) => [user.email, user.id]));
  const managerId = staffByEmail.get("manager@balcona.local");
  const cashierId = staffByEmail.get("cashier@balcona.local");
  const waiterId = staffByEmail.get("waiter@balcona.local");
  if (!managerId || !cashierId || !waiterId) {
    throw new Error(
      "Real cafe demo requires manager, cashier, and waiter staff",
    );
  }

  await seedBranchConfiguration(prisma, scope);
  await seedExperience(prisma, scope);
  await seedInventory(prisma, scope, managerId);
  await seedOperations(prisma, scope, { managerId, cashierId, waiterId });
}
