import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-service-visual-qa/package.json");
const { chromium } = require("playwright");

const BASE_URL =
  process.env.BALCONA_VISUAL_BASE_URL ?? "http://localhost:3001";
const OUTPUT_DIR = path.resolve("artifacts/service-visual-qa");

const COMPANY_ID = "company-service-visual";
const BRANCH_ID = "branch-service-visual";
const SESSION_ID = "session-service-visual";
const ORDER_ID = "order-service-visual";
const WAITER_CALL_ID = "waiter-call-service-visual";

const branch = {
  id: BRANCH_ID,
  companyId: COMPANY_ID,
  name: "Balcona Main",
  slug: "main-branch",
  status: "active"
};

const company = {
  id: COMPANY_ID,
  name: "Balcona Bar",
  slug: "balcona-bar",
  status: "active"
};

const allPermissions = [
  "tables.read",
  "sessions.read",
  "orders.read",
  "orders.cashier_review",
  "orders.accept",
  "orders.reject",
  "orders.serve",
  "orders.complete",
  "bills.read",
  "bills.acknowledge",
  "bills.present",
  "bills.pay",
  "online_payments.read",
  "waiter_calls.read",
  "waiter_calls.acknowledge",
  "waiter_calls.resolve",
  "waiter_calls.cancel",
  "autopilot.read",
  "autopilot.manage"
];

const access = {
  companies: [
    {
      company,
      branchScope: "all_branches",
      roles: ["branch_manager"],
      permissions: allPermissions
    }
  ],
  branches: [
    {
      company,
      branch,
      source: "branch_membership",
      roles: ["branch_manager"],
      permissions: allPermissions
    }
  ],
  roles: ["branch_manager"],
  permissions: allPermissions
};

const staffUser = {
  id: "staff-service-visual",
  email: "manager@balcona.local",
  name: "Main Branch Manager",
  status: "active"
};

const staffSession = {
  id: "staff-session-service-visual",
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

const orderEnvelope = {
  order: {
    id: ORDER_ID,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    tableSessionId: SESSION_ID,
    orderNumber: "ORD-10428",
    status: "submitted",
    source: "qr",
    currency: "EGP",
    subtotalMinor: 38500,
    totalQuantity: 3,
    itemCount: 2,
    customerNote: "One drink without sugar",
    submittedAt: "2026-08-29T06:20:00.000Z"
  },
  company,
  branch,
  tableSession: {
    id: SESSION_ID,
    status: "active",
    partySize: 3,
    startedAt: "2026-08-29T06:05:00.000Z"
  },
  floor: { id: "floor-main", name: "Main Floor", sortOrder: 1 },
  table: {
    id: "table-12",
    code: "T12",
    displayName: "Table 12",
    status: "active"
  },
  items: [
    {
      id: "item-line-1",
      quantity: 2,
      itemNameSnapshot: "Spanish Latte",
      lineTotalMinorSnapshot: 26000,
      currency: "EGP",
      station: "barista"
    },
    {
      id: "item-line-2",
      quantity: 1,
      itemNameSnapshot: "Cheesecake",
      lineTotalMinorSnapshot: 12500,
      currency: "EGP",
      station: "dessert"
    }
  ],
  events: [
    {
      id: "order-event-1",
      type: "submitted",
      createdAt: "2026-08-29T06:20:00.000Z",
      actorType: "customer"
    }
  ],
  preparationTasks: [],
  kitchenTickets: [],
  totals: {
    subtotalMinor: 38500,
    totalQuantity: 3,
    itemCount: 2,
    currency: "EGP"
  },
  lifecycle: {
    status: "submitted",
    isTerminal: false,
    allowedActions: ["accept", "reject", "cancel"],
    blockedReasons: {},
    nextExpectedRole: "cashier",
    progressStep: "review",
    customerLabel: "Order received"
  }
};

const secondOrderEnvelope = {
  ...orderEnvelope,
  order: {
    ...orderEnvelope.order,
    id: "order-ready-visual",
    orderNumber: "ORD-10422",
    status: "ready",
    subtotalMinor: 46000,
    totalQuantity: 5,
    itemCount: 3,
    customerNote: null,
    submittedAt: "2026-08-29T06:12:00.000Z"
  },
  table: {
    id: "table-16",
    code: "T16",
    displayName: "Table 16",
    status: "active"
  },
  totals: {
    subtotalMinor: 46000,
    totalQuantity: 5,
    itemCount: 3,
    currency: "EGP"
  },
  lifecycle: {
    status: "ready",
    isTerminal: false,
    allowedActions: ["serve", "complete", "cancel"],
    blockedReasons: {},
    nextExpectedRole: "waiter",
    progressStep: "ready",
    customerLabel: "Ready to serve"
  }
};

const billEnvelope = {
  billRequest: {
    id: "bill-request-visual",
    status: "open",
    createdAt: "2026-08-29T06:25:00.000Z",
    requestedAt: "2026-08-29T06:25:00.000Z",
    orderCount: 1
  },
  bill: {
    id: "bill-visual",
    billNumber: "B-8821",
    status: "payment_pending",
    currency: "EGP"
  },
  company,
  branch,
  tableSession: {
    id: SESSION_ID,
    status: "active",
    table: {
      id: "table-12",
      code: "T12",
      displayName: "Table 12"
    },
    floor: { id: "floor-main", name: "Main Floor" }
  },
  table: {
    id: "table-12",
    code: "T12",
    displayName: "Table 12"
  },
  floor: { id: "floor-main", name: "Main Floor" },
  lines: [
    {
      id: "bill-line-1",
      quantity: 2,
      itemNameSnapshot: "Spanish Latte",
      lineTotalMinor: 26000,
      currency: "EGP"
    },
    {
      id: "bill-line-2",
      quantity: 1,
      itemNameSnapshot: "Cheesecake",
      lineTotalMinor: 12500,
      currency: "EGP"
    }
  ],
  manualPayments: [],
  onlinePaymentIntents: [
    {
      id: "intent-paymob-visual",
      provider: "paymob",
      status: "pending",
      amountMinor: 38500,
      currency: "EGP"
    }
  ],
  totals: {
    subtotalMinor: 38500,
    totalMinor: 38500,
    paidMinor: 0,
    balanceDueMinor: 38500,
    orderCount: 1,
    currency: "EGP"
  }
};

const shift = {
  id: "shift-visual",
  branchId: BRANCH_ID,
  staffUserId: staffUser.id,
  status: "open",
  currency: "EGP",
  openingFloatMinor: 100000,
  expectedCashMinor: 238500,
  openedAt: "2026-08-29T05:00:00.000Z"
};

const shiftSummary = {
  cashDrawer: {
    expectedCashMinor: 238500
  },
  tenderTotals: {
    totalCollectedMinor: 385000,
    cashMinor: 138500,
    cardPosMinor: 180000,
    walletManualMinor: 66500,
    otherMinor: 0
  },
  counts: {
    paymentCount: 8,
    billCount: 6
  }
};

const attentionEnvelope = {
  attention: {
    id: "attention-visual",
    tableSessionId: SESSION_ID,
    status: "urgent",
    priority: "urgent",
    score: 92,
    reasons: [
      {
        reason: "waiter_call_open",
        message: "Guest requested a waiter",
        scoreDelta: 40
      },
      {
        reason: "ready_order_waiting",
        message: "Order is ready to serve",
        scoreDelta: 25
      }
    ],
    recommendedActions: ["acknowledge_waiter_call", "serve_ready_order"],
    lastEvaluatedAt: "2026-08-29T06:27:00.000Z",
    mutedUntil: null,
    resolvedAt: null
  },
  tableSession: {
    id: SESSION_ID,
    status: "active",
    partySize: 3,
    table: {
      id: "table-12",
      code: "T12",
      displayName: "Table 12"
    },
    floor: {
      id: "floor-main",
      name: "Main Floor"
    }
  }
};

const attentionSecond = {
  attention: {
    id: "attention-visual-2",
    tableSessionId: "session-table-07",
    status: "needs_attention",
    priority: "high",
    score: 67,
    reasons: [
      {
        reason: "bill_request_waiting",
        message: "Bill request has been waiting",
        scoreDelta: 30
      }
    ],
    recommendedActions: ["review_bill_request"],
    lastEvaluatedAt: "2026-08-29T06:24:00.000Z",
    mutedUntil: null,
    resolvedAt: null
  },
  tableSession: {
    id: "session-table-07",
    status: "active",
    partySize: 2,
    table: {
      id: "table-07",
      code: "T07",
      displayName: "Table 07"
    },
    floor: {
      id: "floor-main",
      name: "Main Floor"
    }
  }
};

const waiterCallEnvelope = {
  waiterCall: {
    id: WAITER_CALL_ID,
    status: "open",
    type: "need_waiter",
    priority: 4,
    message: "Could someone help us with the bill?",
    createdAt: "2026-08-29T06:26:00.000Z"
  },
  tableSession: {
    id: SESSION_ID,
    status: "active",
    table: {
      id: "table-12",
      code: "T12",
      displayName: "Table 12"
    },
    floor: {
      id: "floor-main",
      name: "Main Floor"
    }
  },
  table: {
    id: "table-12",
    code: "T12",
    displayName: "Table 12"
  },
  floor: {
    id: "floor-main",
    name: "Main Floor"
  },
  order: {
    id: ORDER_ID,
    orderNumber: "ORD-10428",
    status: "ready"
  },
  events: [
    {
      id: "call-event-1",
      type: "created",
      actorType: "customer",
      createdAt: "2026-08-29T06:26:00.000Z"
    }
  ]
};

const floorOverview = {
  company,
  branches: [
    {
      ...branch,
      floorsCount: 2,
      tablesCount: 7
    }
  ],
  selectedBranch: {
    ...branch,
    floorsCount: 2,
    tablesCount: 7
  },
  floors: [
    {
      id: "floor-main",
      branchId: BRANCH_ID,
      name: "Main Floor",
      sortOrder: 1
    },
    {
      id: "floor-terrace",
      branchId: BRANCH_ID,
      name: "Terrace",
      sortOrder: 2
    }
  ],
  tablesByFloor: [
    {
      id: "floor-main",
      branchId: BRANCH_ID,
      name: "Main Floor",
      sortOrder: 1,
      tableCount: 4,
      tables: [
        {
          id: "table-01",
          branchId: BRANCH_ID,
          floorId: "floor-main",
          code: "T01",
          displayName: "Table 01",
          capacity: 4,
          qrToken: "visual-t01",
          status: "active",
          activeSession: null
        },
        {
          id: "table-07",
          branchId: BRANCH_ID,
          floorId: "floor-main",
          code: "T07",
          displayName: "Table 07",
          capacity: 2,
          qrToken: "visual-t07",
          status: "active",
          activeSession: {
            id: "session-table-07",
            companyId: COMPANY_ID,
            branchId: BRANCH_ID,
            tableId: "table-07",
            status: "active",
            source: "qr",
            partySize: 2,
            startedAt: "2026-08-29T06:10:00.000Z",
            lastSeenAt: "2026-08-29T06:27:00.000Z",
            tableAttentionSnapshot: attentionSecond.attention
          }
        },
        {
          id: "table-12",
          branchId: BRANCH_ID,
          floorId: "floor-main",
          code: "T12",
          displayName: "Table 12",
          capacity: 4,
          qrToken: "visual-t12",
          status: "active",
          activeSession: {
            id: SESSION_ID,
            companyId: COMPANY_ID,
            branchId: BRANCH_ID,
            tableId: "table-12",
            status: "active",
            source: "qr",
            partySize: 3,
            startedAt: "2026-08-29T06:05:00.000Z",
            lastSeenAt: "2026-08-29T06:28:00.000Z",
            tableAttentionSnapshot: attentionEnvelope.attention
          }
        },
        {
          id: "table-16",
          branchId: BRANCH_ID,
          floorId: "floor-main",
          code: "T16",
          displayName: "Table 16",
          capacity: 4,
          qrToken: "visual-t16",
          status: "maintenance",
          activeSession: null
        }
      ]
    },
    {
      id: "floor-terrace",
      branchId: BRANCH_ID,
      name: "Terrace",
      sortOrder: 2,
      tableCount: 3,
      tables: [
        {
          id: "table-20",
          branchId: BRANCH_ID,
          floorId: "floor-terrace",
          code: "T20",
          displayName: "Table 20",
          capacity: 4,
          qrToken: "visual-t20",
          status: "active",
          activeSession: null
        },
        {
          id: "table-21",
          branchId: BRANCH_ID,
          floorId: "floor-terrace",
          code: "T21",
          displayName: "Table 21",
          capacity: 4,
          qrToken: "visual-t21",
          status: "active",
          activeSession: null
        },
        {
          id: "table-22",
          branchId: BRANCH_ID,
          floorId: "floor-terrace",
          code: "T22",
          displayName: "Table 22",
          capacity: 4,
          qrToken: "visual-t22",
          status: "inactive",
          activeSession: null
        }
      ]
    }
  ],
  ungroupedTables: [],
  activeSessions: [],
  stats: {
    totalTables: 7,
    activeTables: 5,
    inactiveTables: 1,
    maintenanceTables: 1,
    occupiedTables: 2,
    activeSessions: 2,
    needsAttention: 2,
    tablesWithQrToken: 7,
    tablesMissingQrToken: 0,
    setupWarnings: 0
  },
  setupIssues: []
};

function persistedStaffSession() {
  return JSON.stringify({
    state: {
      accessToken: "service-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: access,
      defaultBranch: branch,
      selectedBranchId: BRANCH_ID,
      lastLoadedAt: "2026-08-29T06:00:00.000Z"
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

async function installApiMocks(page) {
  await page.route("*