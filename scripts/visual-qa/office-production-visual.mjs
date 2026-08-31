import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-office-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL =
  process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/office-visual-qa");

const COMPANY_ID = "company-office-visual";
const BRANCH_ID = "branch-office-visual";
const BRANCH_2_ID = "branch-office-visual-2";

const company = {
  id: COMPANY_ID,
  name: "Balcona Bar",
  slug: "balcona-bar",
  status: "active"
};

const branch = {
  id: BRANCH_ID,
  companyId: COMPANY_ID,
  name: "Balcona Main",
  slug: "main-branch",
  address: "Main Street",
  status: "active"
};

const branchSecondary = {
  id: BRANCH_2_ID,
  companyId: COMPANY_ID,
  name: "Balcona Riverside",
  slug: "riverside",
  address: "Riverside Avenue",
  status: "active"
};

const permissions = [
  "owner_analytics.read",
  "menu.read",
  "menu.manage_categories",
  "menu.manage_items",
  "menu.manage_modifiers",
  "menu.manage_branch_overrides",
  "inventory.read",
  "inventory.manage",
  "settings.manage",
  "saas.read"
];

const restrictedPermissions = [
  "owner_analytics.read",
  "menu.read",
  "inventory.read",
  "settings.manage",
  "saas.read"
];

const access = {
  companies: [
    {
      company,
      branchScope: "all_branches",
      roles: ["owner"],
      permissions
    }
  ],
  branches: [
    {
      company,
      branch,
      source: "company_membership",
      roles: ["owner"],
      permissions
    },
    {
      company,
      branch: branchSecondary,
      source: "company_membership",
      roles: ["owner"],
      permissions
    }
  ],
  roles: ["owner"],
  permissions
};

const restrictedAccess = {
  ...access,
  companies: access.companies.map((entry) => ({
    ...entry,
    permissions: restrictedPermissions
  })),
  branches: access.branches.map((entry) => ({
    ...entry,
    permissions: restrictedPermissions
  })),
  permissions: restrictedPermissions
};

const staffUser = {
  id: "staff-office-visual",
  email: "owner@balcona.local",
  name: "Omar Owner",
  status: "active"
};

const staffSession = {
  id: "staff-session-office-visual",
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  staffUserId: staffUser.id,
  status: "active",
  expiresAt: "2099-01-01T00:00:00.000Z"
};

const staffContext = {
  staffUser,
  staffSession,
  staffAccess: access
};

const range = {
  from: "2026-08-29T00:00:00.000Z",
  to: "2026-08-29T23:59:59.999Z",
  preset: "today"
};

const base = { range, branch, company };

const openShift = {
  id: "shift-open",
  status: "open",
  currency: "EGP",
  openingFloatMinor: 100000,
  expectedCashMinor: 186500,
  countedCashMinor: null,
  cashOverShortMinor: null,
  cashSalesMinor: 86500,
  cardSalesMinor: 125000,
  walletSalesMinor: 22000,
  otherSalesMinor: 0,
  paymentCount: 19,
  billCount: 14,
  openedAt: "2026-08-29T08:00:00.000Z",
  closedAt: null,
  zReportNumber: null,
  zReportSnapshot: null
};

const closedShift = {
  id: "shift-closed",
  status: "closed",
  currency: "EGP",
  openingFloatMinor: 100000,
  expectedCashMinor: 176000,
  countedCashMinor: 175500,
  cashOverShortMinor: -500,
  cashSalesMinor: 76000,
  cardSalesMinor: 109000,
  walletSalesMinor: 18000,
  otherSalesMinor: 0,
  paymentCount: 17,
  billCount: 13,
  openedAt: "2026-08-28T08:00:00.000Z",
  closedAt: "2026-08-28T23:00:00.000Z",
  zReportNumber: "Z-00218",
  zReportSnapshot: {}
};

const latestZ = {
  id: "z-report-218",
  cashierShiftId: "shift-closed",
  type: "z_report",
  reportNumber: "Z-00218",
  generatedAt: "2026-08-28T23:01:00.000Z",
  snapshot: {}
};

const summary = {
  ...base,
  paidRevenueMinor: 248500,
  collectedMinor: 233500,
  cashCollectedMinor: 86500,
  cardCollectedMinor: 125000,
  walletCollectedMinor: 22000,
  otherCollectedMinor: 0,
  paidBillCount: 14,
  averageTicketMinor: 16679,
  submittedOrderCount: 21,
  acceptedOrderCount: 20,
  servedOrderCount: 18,
  completedOrderCount: 17,
  cancelledOrderCount: 1,
  rejectedOrderCount: 0,
  activeBillRequestCount: 2,
  openWaiterCallCount: 3,
  activeCashierShift: openShift,
  latestClosedShift: closedShift,
  latestZReport: latestZ,
  lowStockCount: 2,
  outOfStockCount: 1,
  stockBlockedMenuItemCount: 1,
  recentInventoryMovements: [],
  revenueSource: "paid_bills"
};

const sales = {
  ...base,
  tenderBreakdown: [
    { method: "cash", count: 6, amountMinor: 86500 },
    { method: "card_pos", count: 6, amountMinor: 125000 },
    { method: "wallet_manual", count: 2, amountMinor: 22000 }
  ],
  revenueByDay: [
    { key: "2026-08-29", count: 14, amountMinor: 233500 }
  ],
  revenueByHour: [
    { key: "10", count: 3, amountMinor: 42000 },
    { key: "12", count: 5, amountMinor: 81500 },
    { key: "14", count: 6, amountMinor: 110000 }
  ],
  billCountByStatus: [
    { key: "paid", count: 14 },
    { key: "payment_pending", count: 2 }
  ],
  paymentCountByMethod: [
    { key: "cash", count: 6, amountMinor: 86500 },
    { key: "card_pos", count: 6, amountMinor: 125000 },
    { key: "wallet_manual", count: 2, amountMinor: 22000 }
  ],
  topPaidBills: [
    {
      id: "bill-1024",
      billNumber: "B-1024",
      status: "paid",
      totalMinor: 38500,
      currency: "EGP"
    }
  ],
  recentPayments: [],
  cashDrawerOverview: [openShift, closedShift],
  revenueSource: "paid_bills"
};

const orders = {
  ...base,
  orderCountByStatus: [
    { key: "submitted", count: 2 },
    { key: "cashier_accepted", count: 1 },
    { key: "preparing", count: 3 },
    { key: "ready", count: 2 },
    { key: "served", count: 5 },
    { key: "completed", count: 8 }
  ],
  orderCountByHour: [
    { key: "10", count: 4 },
    { key: "12", count: 7 },
    { key: "14", count: 10 }
  ],
  totalQuantity: 54,
  itemCount: 39,
  submittedOrderCount: 21,
  grossSubmittedOrderValueMinor: 268000,
  averageSubmittedOrderValueMinor: 12762,
  averageOrderValueMinor: 16679,
  lifecycleAverages: {
    submittedToAcceptedSeconds: 96,
    acceptedToPreparingSeconds: 118,
    preparingToReadySeconds: 612,
    readyToServedSeconds: 154,
    submittedToServedSeconds: 980
  }
};

const items = {
  ...base,
  itemCount: 39,
  quantity: 54,
  revenueMinor: 248500,
  modifierRevenueMinor: 18500,
  topItemsByQuantity: [
    {
      menuItemId: "item-spanish-latte",
      name: "Spanish Latte",
      slug: "spanish-latte",
      quantity: 14,
      revenueMinor: 70000,
      lineCount: 12,
      currency: "EGP"
    },
    {
      menuItemId: "item-burger",
      name: "Beef Burger",
      slug: "beef-burger",
      quantity: 10,
      revenueMinor: 98000,
      lineCount: 8,
      currency: "EGP"
    },
    {
      menuItemId: "item-cheesecake",
      name: "Basque Cheesecake",
      slug: "basque-cheesecake",
      quantity: 8,
      revenueMinor: 48000,
      lineCount: 6,
      currency: "EGP"
    }
  ],
  topItemsByRevenue: [
    {
      menuItemId: "item-burger",
      name: "Beef Burger",
      quantity: 10,
      revenueMinor: 98000,
      currency: "EGP"
    },
    {
      menuItemId: "item-spanish-latte",
      name: "Spanish Latte",
      quantity: 14,
      revenueMinor: 70000,
      currency: "EGP"
    }
  ],
  topModifiers: [],
  categoryBreakdown: [],
  revenueSource: "paid_bill_lines"
};

const operations = {
  ...base,
  preparationTaskCountsByStatus: [
    { key: "pending", count: 3 },
    { key: "preparing", count: 4 },
    { key: "ready", count: 2 }
  ],
  preparationTaskCountsByStation: [
    { key: "kitchen", count: 4 },
    { key: "barista", count: 3 },
    { key: "dessert", count: 2 }
  ],
  kitchenTicketCountsByStatus: [
    { key: "queued", count: 2 },
    { key: "in_progress", count: 3 },
    { key: "ready", count: 2 }
  ],
  kitchenTicketCountsByStation: [
    { key: "kitchen", count: 4 },
    { key: "barista", count: 2 },
    { key: "dessert", count: 1 }
  ],
  printJobCountsByStatus: [
    { key: "printed", count: 11 },
    { key: "pending", count: 2 },
    { key: "failed", count: 1 }
  ],
  printJobCountsByKind: [
    { key: "kitchen_ticket", count: 7 },
    { key: "barista_ticket", count: 4 },
    { key: "dessert_ticket", count: 3 }
  ],
  failedPrintJobCount: 1,
  waiterCallCountsByStatus: [
    { key: "open", count: 3 },
    { key: "resolved", count: 9 }
  ],
  waiterCallCountsByType: [
    { key: "need_waiter", count: 6 },
    { key: "bill", count: 4 }
  ],
  averageWaiterCallResolutionSeconds: 180,
  activeAttentionCount: 4,
  urgentAttentionCount: 1
};

const cashierShifts = {
  ...base,
  currentOpenShift: openShift,
  recentClosedShifts: [closedShift],
  totalOverShortMinor: -500,
  shiftCount: 1,
  zReports: [latestZ],
  cashDrawerTransactions: {
    cashInMinor: 5000,
    cashOutMinor: -2000,
    correctionMinor: 0,
    openingFloatMinor: 100000,
    cashPaymentMinor: 86500
  },
  latestZReport: latestZ
};

const aiWaiter = {
  ...base,
  aiSessionCount: 12,
  aiMessageCount: 68,
  escalatedCount: 3,
  proposalCount: 9,
  appliedProposalCount: 7,
  estimatedCostMicros: 420,
  inputTokens: 16400,
  outputTokens: 6200,
  topEscalationReasons: [
    { key: "customer_requested_human", count: 2 },
    { key: "low_confidence", count: 1 }
  ]
};

const dashboard = {
  ...base,
  summary,
  sales,
  orders,
  items,
  operations,
  cashierShifts,
  aiWaiter,
  generatedAt: "2026-08-29T14:15:00.000Z"
};

const dashboardSecondary = {
  ...dashboard,
  branch: branchSecondary,
  summary: {
    ...summary,
    branch: branchSecondary,
    paidRevenueMinor: 176800,
    collectedMinor: 169500,
    paidBillCount: 11,
    submittedOrderCount: 16,
    openWaiterCallCount: 1,
    activeBillRequestCount: 1,
    lowStockCount: 1,
    outOfStockCount: 0,
    stockBlockedMenuItemCount: 0
  },
  orders: {
    ...orders,
    branch: branchSecondary,
    submittedOrderCount: 16
  },
  operations: {
    ...operations,
    branch: branchSecondary,
    activeAttentionCount: 2,
    urgentAttentionCount: 0,
    failedPrintJobCount: 0
  },
  cashierShifts: {
    ...cashierShifts,
    branch: branchSecondary,
    totalOverShortMinor: 0,
    shiftCount: 1
  },
  aiWaiter: {
    ...aiWaiter,
    branch: branchSecondary,
    aiSessionCount: 7,
    aiMessageCount: 31,
    escalatedCount: 1
  },
  generatedAt: "2026-08-29T14:15:00.000Z"
};

const dailyReport = {
  ...dashboard,
  reportType: "owner_daily_report",
  generatedAt: "2026-08-29T14:15:00.000Z"
};

const onboarding = {
  company: {
    ...company,
    createdAt: "2026-08-01T08:00:00.000Z"
  },
  branch: {
    ...branch,
    createdAt: "2026-08-01T08:05:00.000Z",
    floorsCount: 2,
    tablesCount: 18
  },
  generatedAt: "2026-08-29T14:15:00.000Z",
  sections: [],
  tables: {
    floorCount: 2,
    tableCount: 18,
    activeTableCount: 17,
    qrReadyTableCount: 18,
    missingQrTableCount: 0,
    floors: [],
    recentTables: []
  },
  staff: {
    total: 5,
    roleCounts: {
      owner: 1,
      branch_manager: 1,
      cashier: 1,
      waiter: 1,
      kitchen: 1
    },
    staff: [
      {
        membership: {
          id: "membership-owner",
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          role: "owner",
          status: "active"
        },
        staffUser: {
          id: "staff-owner",
          email: "owner@balcona.local",
          name: "Omar Owner",
          status: "active",
          passwordSetAt: "2026-08-01T08:10:00.000Z"
        }
      },
      {
        membership: {
          id: "membership-manager",
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          role: "branch_manager",
          status: "active"
        },
        staffUser: {
          id: "staff-manager",
          email: "manager@balcona.local",
          name: "Mariam Manager",
          status: "active",
          passwordSetAt: "2026-08-01T08:10:00.000Z"
        }
      },
      {
        membership: {
          id: "membership-cashier",
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          role: "cashier",
          status: "active"
        },
        staffUser: {
          id: "staff-cashier",
          email: "cashier@balcona.local",
          name: "Youssef Cashier",
          status: "active",
          passwordSetAt: "2026-08-01T08:10:00.000Z"
        }
      },
      {
        membership: {
          id: "membership-waiter",
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          role: "waiter",
          status: "active"
        },
        staffUser: {
          id: "staff-waiter",
          email: "waiter@balcona.local",
          name: "Salma Waiter",
          status: "active",
          passwordSetAt: "2026-08-01T08:10:00.000Z"
        }
      },
      {
        membership: {
          id: "membership-kitchen",
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          role: "kitchen",
          status: "active"
        },
        staffUser: {
          id: "staff-kitchen",
          email: "kitchen@balcona.local",
          name: "Hassan Kitchen",
          status: "active",
          passwordSetAt: "2026-08-01T08:10:00.000Z"
        }
      }
    ]
  },
  menu: {
    activeCategoryCount: 6,
    totalItemCount: 42,
    activeItemCount: 39,
    availableItemCount: 37,
    branchOverrideCount: 4,
    activeModifierGroupCount: 9,
    itemModifierLinkCount: 18,
    itemsWithModifiersCount: 16,
    missingPriceItemCount: 0,
    aiWaiterMenuGroundingReady: true,
    inventoryItemCount: 28,
    trackedInventoryLevelCount: 28,
    lowStockCount: 2,
    outOfStockCount: 1
  },
  operations: {
    operatingSettings: {
      serviceMode: "table_service",
      autoAcceptOrders: false
    },
    smartCashierSettings: {
      enabled: true
    },
    featureFlags: {
      ai_waiter: true,
      inventory: true,
      online_payments: true,
      smart_cashier: true
    },
    printerStationCount: 3,
    activePrinterStationCount: 3,
    currentOpenShift: openShift,
    cashierShiftCanOpen: false
  },
  launchChecklist: [],
  launchSummary: {
    status: "ready_for_pilot",
    readyForDemo: true,
    readyForPilot: true,
    blockedReasons: [],
    missingCriticalCount: 0,
    totalCriticalCount: 8
  }
};

const menuCategorySummary = {
  id: "category-office-visual",
  name: "Coffee",
  slug: "coffee",
  description: "Coffee menu",
  sortOrder: 1,
  status: "active"
};

const modifierOption = {
  id: "modifier-option-office-visual",
  groupId: "modifier-group-office-visual",
  name: "Oat milk",
  slug: "oat-milk",
  priceDeltaMinor: 1500,
  status: "active",
  sortOrder: 1
};

const modifierGroup = {
  id: "modifier-group-office-visual",
  companyId: COMPANY_ID,
  name: "Milk",
  slug: "milk",
  description: "Milk choice",
  selectionType: "single",
  isRequired: false,
  minSelections: 0,
  maxSelections: 1,
  sortOrder: 1,
  status: "active",
  options: [modifierOption],
  itemCount: 1
};

const branchOverride = {
  id: "branch-override-office-visual",
  branchId: BRANCH_ID,
  menuItemId: "menu-item-office-visual",
  priceOverrideMinor: null,
  effectivePriceMinor: 9500,
  isAvailable: true,
  isVisible: true,
  sortOrder: 1
};

const catalogItem = {
  id: "menu-item-office-visual",
  companyId: COMPANY_ID,
  categoryId: menuCategorySummary.id,
  name: "Spanish Latte",
  slug: "spanish-latte",
  description: "Espresso with milk",
  imageUrl: null,
  basePriceMinor: 9500,
  effectivePriceMinor: 9500,
  currency: "EGP",
  station: "barista",
  status: "active",
  isFeatured: true,
  sortOrder: 1,
  category: menuCategorySummary,
  modifierGroups: [
    {
      id: "item-modifier-link-office-visual",
      menuItemId: "menu-item-office-visual",
      modifierGroupId: modifierGroup.id,
      sortOrder: 1,
      modifierGroup
    }
  ],
  branchOverride,
  hasBranchOverride: true,
  isAvailable: true,
  isVisible: true,
  customerVisible: true
};

const menuAdminOverview = {
  company,
  branch,
  stats: {
    categories: 1,
    items: 1,
    visibleItems: 1,
    unavailableItems: 0,
    hiddenItems: 0,
    modifierGroups: 1,
    setupWarnings: 0
  },
  categories: [
    {
      ...menuCategorySummary,
      companyId: COMPANY_ID,
      itemCount: 1,
      visibleItemCount: 1,
      items: [catalogItem]
    }
  ],
  modifierGroups: [modifierGroup],
  setupIssues: []
};

const inventoryItem = {
  id: "inventory-item-office-visual",
  companyId: COMPANY_ID,
  name: "Coffee beans",
  sku: "BEANS-001",
  unit: "gram",
  status: "active",
  parLevelQuantity: 20,
  lowStockThresholdQuantity: 10
};

const inventoryLevel = {
  id: "inventory-level-office-visual",
  branchId: BRANCH_ID,
  inventoryItemId: inventoryItem.id,
  item: inventoryItem,
  quantityOnHand: 8,
  reservedQuantity: 0,
  lowStockThresholdQuantity: 10,
  stockStatus: "low_stock"
};

const supplier = {
  id: "supplier-office-visual",
  companyId: COMPANY_ID,
  name: "Roastery Supply",
  contact: "Supply desk",
  phone: "+201000000000",
  email: "supply@example.com",
  status: "active"
};

const purchaseOrderLine = {
  id: "po-line-office-visual",
  purchaseOrderId: "po-office-visual",
  inventoryItemId: inventoryItem.id,
  quantityOrdered: 10,
  quantityReceived: 4,
  unitCostMinor: 1200,
  notes: null,
  inventoryItem
};

const purchaseOrder = {
  id: "po-office-visual",
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  supplierId: supplier.id,
  orderNumber: "PO-0001",
  status: "partially_received",
  expectedAt: "2026-08-31T00:00:00.000Z",
  notes: "Visual QA purchase order",
  currency: "EGP",
  supplier,
  lines: [purchaseOrderLine]
};

const inventoryReceipt = {
  id: "receipt-office-visual",
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  supplierId: supplier.id,
  purchaseOrderId: purchaseOrder.id,
  receiptNumber: "RCPT-0001",
  receivedAt: "2026-08-31T09:00:00.000Z",
  notes: "Partial delivery",
  supplier,
  lines: [
    {
      id: "receipt-line-office-visual",
      receiptId: "receipt-office-visual",
      purchaseOrderLineId: purchaseOrderLine.id,
      inventoryItemId: inventoryItem.id,
      quantityReceived: 4,
      unitCostMinor: 1200,
      inventoryItem
    }
  ]
};

const inventoryItems = { company, items: [inventoryItem] };
const inventoryLevels = {
  company,
  branch,
  levels: [inventoryLevel],
  summary: {
    totalInventoryItemCount: 1,
    trackedLevelCount: 1,
    lowStockCount: 1,
    outOfStockCount: 0
  },
  lastMovementAt: "2026-08-31T09:00:00.000Z"
};
const inventoryAlerts = {
  company,
  branch,
  lowStockLevels: [inventoryLevel],
  outOfStockLevels: [],
  stockBlockedMenuItems: [],
  recentMovements: [
    {
      id: "movement-office-visual",
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      inventoryItemId: inventoryItem.id,
      staffUserId: "staff-office-visual",
      type: "stock_in",
      quantityDelta: 4,
      quantityAfter: 8,
      unit: "gram",
      sourceType: "receipt",
      sourceId: inventoryReceipt.id,
      note: "Partial delivery",
      createdAt: "2026-08-31T09:00:00.000Z",
      inventoryItem
    }
  ],
  summary: {
    lowStockCount: 1,
    outOfStockCount: 0,
    stockBlockedMenuItemCount: 0
  }
};
const inventoryMenuAvailability = {
  company,
  branch,
  items: [
    {
      menuItemId: catalogItem.id,
      name: catalogItem.name,
      slug: catalogItem.slug,
      category: menuCategorySummary,
      branchVisible: true,
      branchAvailable: true,
      stockStatus: "low_stock",
      missingRequirements: [],
      lowStockRequirements: [
        {
          inventoryItemId: inventoryItem.id,
          name: inventoryItem.name,
          unit: inventoryItem.unit,
          quantityRequired: 2,
          quantityOnHand: 8,
          quantityAfter: 6,
          threshold: 10
        }
      ],
      canOrder: true,
      reasons: []
    }
  ],
  summary: {
    itemCount: 1,
    canOrderCount: 1,
    lowStockCount: 1,
    outOfStockCount: 0,
    stockBlockedCount: 0
  }
};
const suppliers = { company, branch, suppliers: [supplier] };
const purchaseOrders = { company, branch, purchaseOrders: [purchaseOrder] };
const inventoryReceipts = { company, branch, receipts: [inventoryReceipt] };
const inventoryRequirements = {
  item: catalogItem,
  requirements: [
    {
      id: "requirement-office-visual",
      companyId: COMPANY_ID,
      menuItemId: catalogItem.id,
      inventoryItemId: inventoryItem.id,
      quantityRequired: 2,
      unit: inventoryItem.unit,
      isRequired: true,
      inventoryItem
    }
  ]
};

const branchAdminBranch = {
  ...branch,
  floorsCount: 0,
  tablesCount: 0
};
const branchAdminOverview = {
  company,
  branches: [branchAdminBranch],
  selectedBranch: branchAdminBranch,
  floors: [],
  tablesByFloor: [],
  ungroupedTables: [],
  activeSessions: [],
  stats: {
    totalTables: 0,
    activeTables: 0,
    inactiveTables: 0,
    maintenanceTables: 0,
    occupiedTables: 0,
    activeSessions: 0,
    needsAttention: 0,
    tablesWithQrToken: 0,
    tablesMissingQrToken: 0,
    setupWarnings: 0
  },
  setupIssues: []
};
const printerStations = {
  branch,
  printerStations: [
    {
      id: "printer-kitchen",
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      name: "Kitchen Pass",
      slug: "kitchen-pass",
      station: "kitchen",
      adapterType: "escpos_lan",
      status: "active",
      isDefault: true
    },
    {
      id: "printer-barista",
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      name: "Barista Rail",
      slug: "barista-rail",
      station: "barista",
      adapterType: "browser_print",
      status: "active",
      isDefault: true
    }
  ]
};

const experience = {
  company,
  branch,
  profile: {
    id: "experience-profile-office",
    name: "Balcona Warm Minimal"
  },
  source: "branch",
  theme: {
    mode: "warm"
  },
  designTokens: {
    surface: "#F5F5F2",
    accent: "#B37744"
  },
  motionTokens: {
    reducedMotionSafe: true
  },
  layoutConfig: {
    density: "comfortable"
  },
  brandVoice: {
    tone: "warm"
  },
  aiWaiterTone: {
    tone: "friendly"
  },
  contentBlocks: [
    { id: "hero", type: "hero" },
    { id: "welcome", type: "text" },
    { id: "upsell", type: "recommendation" }
  ],
  venueZones: [
    { id: "main-floor", name: "Main Floor" },
    { id: "terrace", name: "Terrace" }
  ],
  mediaUsages: [
    { id: "logo", type: "logo" },
    { id: "hero-media", type: "hero" }
  ]
};

function persistedStaffSession(accessValue = access) {
  return JSON.stringify({
    state: {
      accessToken: "office-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: accessValue,
      defaultBranch: branch,
      selectedBranchId: BRANCH_ID,
      lastLoadedAt: "2026-08-29T14:00:00.000Z"
    },
    version: 0
  });
}

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}

async function installApiMocks(page, accessValue = access) {
  const apiRoutePattern = ["**", "api", "v1", "**"].join("/");

  await page.route(apiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/v1/staff-auth/me") {
      return route.fulfill(
        json({
          ...staffContext,
          staffAccess: accessValue
        })
      );
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/owner-analytics/dashboard`
    ) {
      return route.fulfill(json(dashboard));
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/owner-analytics/daily-report`
    ) {
      return route.fulfill(json(dailyReport));
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_2_ID}/owner-analytics/dashboard`
    ) {
      return route.fulfill(json(dashboardSecondary));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/menu-admin/overview`) {
      return route.fulfill(json(menuAdminOverview));
    }

    if (pathname === `/api/v1/companies/${COMPANY_ID}/inventory/items`) {
      return route.fulfill(json(inventoryItems));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/inventory/levels`) {
      return route.fulfill(json(inventoryLevels));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/inventory/alerts`) {
      return route.fulfill(json(inventoryAlerts));
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/inventory/menu-availability`
    ) {
      return route.fulfill(json(inventoryMenuAvailability));
    }

    if (
      pathname ===
      `/api/v1/menu-items/${catalogItem.id}/inventory-requirements`
    ) {
      return route.fulfill(json(inventoryRequirements));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/suppliers`) {
      return route.fulfill(json(suppliers));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/purchase-orders`) {
      return route.fulfill(json(purchaseOrders));
    }

    if (
      pathname === `/api/v1/branches/${BRANCH_ID}/inventory/receipts`
    ) {
      return route.fulfill(json(inventoryReceipts));
    }

    if (
      pathname ===
      `/api/v1/companies/${COMPANY_ID}/branch-admin/overview`
    ) {
      return route.fulfill(json(branchAdminOverview));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/printer-stations`) {
      return route.fulfill(json(printerStations));
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/onboarding`) {
      return route.fulfill(json(onboarding));
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/experience/effective`
    ) {
      return route.fulfill(json(experience));
    }

    if (pathname === `/api/v1/realtime/branches/${BRANCH_ID}/events`) {
      return route.fulfill(
        json({
          branch,
          events: [
            {
              id: "office-event-1",
              type: "order_completed",
              channel: "orders",
              orderId: "order-10428",
              createdAt: "2026-08-29T14:12:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/realtime/branches/${BRANCH_ID}/stream`) {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { "cache-control": "no-cache" },
        body: "event: ready\ndata: {}\n\n"
      });
    }

    return route.fulfill(json({}));
  });
}

async function newContext(browser, locale, viewport, accessValue = access) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    locale: locale === "ar" ? "ar-EG" : "en-US"
  });

  await context.addCookies([
    {
      name: "balcona_locale",
      value: locale,
      url: BASE_URL
    }
  ]);

  await context.addInitScript(
    ({ localeValue, staffValue }) => {
      window.localStorage.setItem("balcona.locale", localeValue);
      window.localStorage.setItem("balcona_staff_session", staffValue);
    },
    {
      localeValue: locale,
      staffValue: persistedStaffSession(accessValue)
    }
  );

  return context;
}

async function capture(browser, {
  label,
  routePath = "/office",
  hash = "",
  target,
  activeLabel,
  scopeLabel,
  accessValue = access,
  locale = "en",
  viewport = { width: 1440, height: 1000 }
}) {
  const context = await newContext(
    browser,
    locale,
    viewport,
    accessValue
  );
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await installApiMocks(page, accessValue);
  await page.goto(`${BASE_URL}${routePath}${hash}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const shellText = locale === "ar" ? "إدارة بلكونة" : "Balcona Office";
  await page.getByText(shellText, { exact: true }).first().waitFor({
    state: "visible",
    timeout: 15000
  });

  if (scopeLabel) {
    await page.getByRole("button", { name: scopeLabel, exact: true }).click();
    await page.waitForTimeout(700);
  }

  if (target) {
    const locator = page.locator(target);
    await locator.waitFor({ state: "visible", timeout: 15000 });
    await locator.scrollIntoViewIfNeeded();
  }

  await page.waitForTimeout(700);

  const blockingLoader = await page.locator("body").evaluate((body) => {
    const labels = [
      "Loading branch menu admin…",
      "Loading money operations…",
      "Loading inventory…",
      "Loading branch and table admin…",
      "Loading branch settings…",
      "Loading people and access scopes…",
      "Loading experience configuration…"
    ];
    return labels.find((entry) => body.innerText.includes(entry)) ?? null;
  });

  if (blockingLoader) {
    throw new Error(
      `${label}: visual capture stopped on blocking loader "${blockingLoader}"`
    );
  }

  if (activeLabel) {
    const expectedCurrent = page
      .locator('a[aria-current="page"]')
      .filter({ hasText: activeLabel })
      .first();
    await expectedCurrent.waitFor({ state: "visible", timeout: 15000 });
    const currentText = (await expectedCurrent.innerText()).trim();

    if (!currentText.includes(activeLabel)) {
      throw new Error(
        `${label}: expected active Office nav "${activeLabel}", got "${currentText}"`
      );
    }
  }

  const metrics = await page.evaluate(() => {
    const innerWidth = window.innerWidth;
    const offenders = Array.from(document.querySelectorAll("*"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || "",
          className:
            typeof element.className === "string"
              ? element.className.slice(0, 180)
              : "",
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth
        };
      })
      .filter(
        (entry) =>
          entry.width > 0 &&
          (entry.right > innerWidth + 1 || entry.left < -1)
      )
      .sort(
        (a, b) =>
          Math.max(b.right - innerWidth, -b.left) -
          Math.max(a.right - innerWidth, -a.left)
      )
      .slice(0, 12);

    return {
      innerWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      dir: document.documentElement.dir,
      lang: document.documentElement.lang,
      offenders
    };
  });

  if (metrics.scrollWidth > metrics.clientWidth + 1) {
    throw new Error(
      `${label}: document overflow ${metrics.scrollWidth}px > ${metrics.clientWidth}px; offenders=${JSON.stringify(metrics.offenders)}`
    );
  }

  if (locale === "ar" && metrics.dir !== "rtl") {
    throw new Error(`${label}: expected rtl, got ${metrics.dir || "empty"}`);
  }

  if (consoleErrors.length > 0) {
    throw new Error(
      `${label}: browser console errors: ${consoleErrors.join(" | ")}`
    );
  }

  const screenshot = path.join(OUTPUT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  const result = {
    label,
    routePath,
    hash,
    locale,
    viewport,
    target,
    activeLabel,
    screenshot,
    metrics,
    consoleErrors
  };

  await context.close();
  return result;
}

async function assertOfficeInternalTabs(browser) {
  const surfaces = [
    {
      label: "catalog",
      routePath: "/office/catalog",
      tabs: [
        "Menus",
        "Categories",
        "Items",
        "Modifiers",
        "Availability",
        "Branch overrides",
        "Preview"
      ]
    },
    {
      label: "inventory",
      routePath: "/office/inventory",
      tabs: [
        "Overview",
        "Stock",
        "Alerts",
        "Movements",
        "Requirements / Recipes",
        "Suppliers",
        "Purchase orders",
        "Receiving"
      ]
    }
  ];
  const visited = [];

  for (const surface of surfaces) {
    const context = await newContext(
      browser,
      "en",
      { width: 1440, height: 1000 },
      access
    );
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    await installApiMocks(page, access);
    await page.goto(`${BASE_URL}${surface.routePath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000
    });
    await page.getByText("Balcona Office", { exact: true }).first().waitFor({
      state: "visible",
      timeout: 15000
    });
    await page.waitForTimeout(700);

    for (const tab of surface.tabs) {
      const button = page.getByRole("button", { name: tab, exact: true }).first();
      await button.waitFor({ state: "visible", timeout: 15000 });
      await button.click();
      await page.waitForTimeout(250);

      const bodyText = (await page.locator("body").innerText()).toLowerCase();
      if (
        bodyText.includes("this page couldn’t load") ||
        bodyText.includes("this page couldn't load") ||
        bodyText.includes("something went wrong")
      ) {
        throw new Error(
          `office-internal-tabs: ${surface.label}/${tab} rendered an error boundary`
        );
      }

      if (pageErrors.length > 0) {
        throw new Error(
          `office-internal-tabs: ${surface.label}/${tab} page errors: ${pageErrors.join(" | ")}`
        );
      }

      visited.push({ surface: surface.label, tab });
    }

    if (consoleErrors.length > 0) {
      throw new Error(
        `office-internal-tabs: ${surface.label} console errors: ${consoleErrors.join(" | ")}`
      );
    }

    await context.close();
  }

  return {
    label: "20-office-internal-tabs-non-empty-smoke",
    visited
  };
}

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(await assertOfficeInternalTabs(browser));
  results.push(
    await capture(browser, {
      label: "01-office-home-1440",
      activeLabel: "Home"
    })
  );
  results.push(
    await capture(browser, {
      label: "02-office-home-company-1440",
      activeLabel: "Home",
      scopeLabel: "Company"
    })
  );
  results.push(
    await capture(browser, {
      label: "03-office-operations-1280",
      hash: "#operations",
      activeLabel: "Operations",
      viewport: { width: 1280, height: 900 }
    })
  );
  results.push(
    await capture(browser, {
      label: "04-office-insights-tablet",
      hash: "#insights",
      activeLabel: "Insights",
      viewport: { width: 1024, height: 900 }
    })
  );
  results.push(
    await capture(browser, {
      label: "05-office-home-mobile-390",
      activeLabel: "Home",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "06-office-insights-ar-rtl-390",
      hash: "#insights",
      activeLabel: "التحليلات",
      locale: "ar",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "07-office-catalog-1440",
      routePath: "/office/catalog",
      activeLabel: "Catalog"
    })
  );
  results.push(
    await capture(browser, {
      label: "08-office-inventory-1280",
      routePath: "/office/inventory",
      activeLabel: "Inventory",
      viewport: { width: 1280, height: 900 }
    })
  );
  results.push(
    await capture(browser, {
      label: "09-office-locations-tablet",
      routePath: "/office/locations",
      activeLabel: "Locations",
      viewport: { width: 1024, height: 900 }
    })
  );
  results.push(
    await capture(browser, {
      label: "10-office-control-money-isolation",
      routePath: "/office/money",
      activeLabel: "Money"
    })
  );
  results.push(
    await capture(browser, {
      label: "11-office-control-team-rtl-isolation",
      routePath: "/office/team",
      activeLabel: "الفريق",
      locale: "ar",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "12-office-catalog-permission-limited",
      routePath: "/office/catalog",
      activeLabel: "Catalog",
      accessValue: restrictedAccess,
      viewport: { width: 1280, height: 900 }
    })
  );
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  results
};

await writeFile(
  path.join(OUTPUT_DIR, "office-visual-qa-report.json"),
  JSON.stringify(report, null, 2),
  "utf8"
);

console.log(JSON.stringify(report, null, 2));
