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

const permissions = [
  "companies.read",
  "branches.read",
  "staff.read",
  "staff.manage",
  "owner_analytics.read",
  "menu.read",
  "inventory.read",
  "bills.read",
  "online_payments.read",
  "online_payments.manage",
  "media.read",
  "media.manage",
  "experience.read",
  "experience.manage",
  "content.read",
  "content.manage",
  "venue_zones.read",
  "venue_zones.manage",
  "presence.read",
  "notifications.read",
  "settings.read",
  "settings.manage",
  "feature_flags.read",
  "feature_flags.manage",
  "tenant_onboarding.read",
  "tenant_onboarding.manage",
  "audit.read",
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
    }
  ],
  roles: ["owner"],
  permissions
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

function persistedStaffSession() {
  return JSON.stringify({
    state: {
      accessToken: "office-visual-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      staffUser,
      staffSession,
      effectiveAccess: access,
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

async function installApiMocks(page) {
  const apiRoutePattern = ["**", "api", "v1", "**"].join("/");

  await page.route(apiRoutePattern, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === "/api/v1/staff-auth/me") {
      return route.fulfill(json(staffContext));
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

    if (pathname === "/api/v1/staff") {
      return route.fulfill(
        json([
          {
            id: staffUser.id,
            email: staffUser.email,
            name: staffUser.name,
            status: "active",
            memberships: [
              {
                id: "membership-owner-office-visual",
                role: "owner",
                status: "active",
                company,
                branch,
                createdAt: "2026-08-01T08:10:00.000Z"
              }
            ]
          },
          {
            id: "staff-manager-office-visual",
            email: "manager@balcona.local",
            name: "Mariam Manager",
            status: "active",
            memberships: [
              {
                id: "membership-manager-office-visual",
                role: "branch_manager",
                status: "active",
                company,
                branch,
                createdAt: "2026-08-02T08:10:00.000Z"
              }
            ]
          }
        ])
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/bills`) {
      return route.fulfill(
        json({
          branch,
          bills: [
            {
              id: "bill-office-visual",
              status: "paid",
              totalMinor: 38500,
              currency: "EGP",
              createdAt: "2026-08-29T13:40:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/online-payments`) {
      return route.fulfill(
        json({
          branch,
          onlinePaymentIntents: [
            {
              id: "intent-office-visual",
              provider: "paymob",
              status: "succeeded",
              amountMinor: 38500,
              currency: "EGP",
              createdAt: "2026-08-29T13:41:00.000Z",
              metadata: {
                expectedLive: false,
                isLive: false
              }
            }
          ]
        })
      );
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/online-payment-reconciliation/runs`
    ) {
      return route.fulfill(
        json([
          {
            id: "reconciliation-office-visual",
            source: "settlement_statement",
            status: "completed",
            matchedCount: 8,
            pendingCount: 0,
            mismatchCount: 1,
            createdAt: "2026-08-29T14:00:00.000Z",
            settlementBatch: {
              id: "settlement-office-visual",
              externalReference: "PAYMOB-2026-08-29",
              payoutReference: "PAYOUT-7781",
              settledAt: "2026-08-29T13:58:00.000Z"
            }
          }
        ])
      );
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/online-payment-reconciliation/issues`
    ) {
      return route.fulfill(
        json([
          {
            id: "issue-office-visual",
            type: "amount_mismatch",
            status: "open",
            message: "Provider and local movement differ by EGP 5.00",
            detectedAt: "2026-08-29T14:01:00.000Z"
          }
        ])
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/experience/profiles`) {
      return route.fulfill(
        json({
          branch,
          profiles: [
            {
              id: "profile-branch-office-visual",
              key: "warm-main",
              name: "Warm Main",
              status: "active",
              isDefault: true,
              language: "ar-EG",
              brandVoice: { tone: "warm" },
              aiWaiterTone: { tone: "friendly" }
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/companies/${COMPANY_ID}/experience/profiles`) {
      return route.fulfill(
        json({
          company,
          profiles: [
            {
              id: "profile-company-office-visual",
              key: "company-default",
              name: "Company Default",
              status: "active",
              isDefault: true,
              language: "ar-EG",
              brandVoice: { tone: "calm" },
              aiWaiterTone: { tone: "helpful" }
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/content-blocks`) {
      return route.fulfill(
        json({
          branch,
          contentBlocks: [
            {
              id: "content-office-visual",
              key: "welcome",
              title: "Welcome",
              placement: "home",
              language: "ar-EG",
              status: "active"
            }
          ]
        })
      );
    }

    if (
      pathname ===
      `/api/v1/branches/${BRANCH_ID}/notification-templates`
    ) {
      return route.fulfill(
        json({
          branch,
          notificationTemplates: [
            {
              id: "template-office-visual",
              title: "Order ready",
              kind: "order_ready",
              channel: "in_app",
              language: "ar-EG",
              isActive: true
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/companies/${COMPANY_ID}/media-assets`) {
      return route.fulfill(
        json({
          company,
          mediaAssets: [
            {
              id: "media-office-visual",
              branchId: BRANCH_ID,
              title: "Hero image",
              type: "image",
              status: "active",
              provider: "external_url",
              publicUrl: "https://example.com/hero.jpg"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/venue-zones`) {
      return route.fulfill(
        json({
          branch,
          venueZones: [
            {
              id: "zone-office-visual",
              name: "Terrace",
              type: "dining",
              status: "active"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/presence/events`) {
      return route.fulfill(
        json({
          branch,
          events: [
            {
              id: "presence-office-visual",
              triggerType: "entered_zone",
              occurredAt: "2026-08-29T14:02:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/notifications`) {
      return route.fulfill(
        json({
          branch,
          notifications: [
            {
              id: "notification-office-visual",
              title: "Order ready",
              status: "sent",
              createdAt: "2026-08-29T14:03:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/operating-settings`) {
      return route.fulfill(
        json({
          branch,
          settings: {
            id: "operating-office-visual",
            operatingMode: "assisted",
            serviceMode: "mixed",
            aiWaiterEnabled: true,
            realtimeEnabled: true,
            notificationsEnabled: true,
            openingHours: { sat: ["09:00", "23:00"] },
            serviceConfig: { tableService: true },
            attentionConfig: { escalationMinutes: 4 },
            updatedAt: "2026-08-29T14:04:00.000Z"
          }
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/feature-flags`) {
      return route.fulfill(
        json({
          branch,
          featureFlags: [
            { id: null, key: "ai_waiter", enabled: true },
            { id: "flag-realtime", key: "realtime", enabled: true },
            { id: "flag-notifications", key: "notifications", enabled: true }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/audit-logs`) {
      return route.fulfill(
        json({
          branch,
          auditLogs: [
            {
              id: "audit-office-visual",
              action: "branch_operating_settings_updated",
              targetType: "branch_operating_settings",
              actorType: "staff",
              message: "Operating settings updated",
              createdAt: "2026-08-29T14:04:00.000Z"
            }
          ]
        })
      );
    }

    if (pathname === `/api/v1/branches/${BRANCH_ID}/saas/status`) {
      return route.fulfill(
        json({
          company,
          branch,
          plan: null,
          subscription: null,
          entitlements: {
            setup: true,
            kds: true,
            inventory: true,
            onlinePayments: true,
            ownerAnalytics: true,
            aiWaiter: true,
            multiBranch: false,
            advancedReports: false
          },
          usage: {},
          warnings: [],
          blockers: []
        })
      );
    }

    if (pathname === "/api/v1/saas/plans") {
      return route.fulfill(json({ plans: [] }));
    }

    return route.fulfill(json({}));
  });
}

async function newContext(browser, locale, viewport) {
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
      staffValue: persistedStaffSession()
    }
  );

  return context;
}

async function capture(browser, {
  label,
  pathname = "/staff/owner",
  hash = "",
  target,
  activeLabel,
  locale = "en",
  viewport = { width: 1440, height: 1000 }
}) {
  const context = await newContext(browser, locale, viewport);
  const page = await context.newPage();
  const consoleErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await installApiMocks(page);
  await page.goto(`${BASE_URL}${pathname}${hash}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });

  const shellText = locale === "ar" ? "إدارة بلكونة" : "Balcona Office";
  await page.getByText(shellText, { exact: true }).first().waitFor({
    state: "visible",
    timeout: 15000
  });

  if (target) {
    const locator = page.locator(target);
    await locator.waitFor({ state: "visible", timeout: 15000 });
    await locator.scrollIntoViewIfNeeded();
  }

  await page.waitForTimeout(700);

  if (activeLabel) {
    const current = page.locator('a[aria-current="page"]');
    await current.waitFor({ state: "visible", timeout: 5000 });
    const currentText = (await current.innerText()).trim();

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
    pathname,
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

await mkdir(OUTPUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  results.push(
    await capture(browser, {
      label: "01-office-home-desktop",
      activeLabel: "Home"
    })
  );
  results.push(
    await capture(browser, {
      label: "02-office-money-desktop",
      hash: "#money",
      target: "#money",
      activeLabel: "Money"
    })
  );
  results.push(
    await capture(browser, {
      label: "03-office-operations-desktop",
      hash: "#operations",
      target: "#operations",
      activeLabel: "Operations"
    })
  );
  results.push(
    await capture(browser, {
      label: "04-office-insights-desktop",
      hash: "#insights",
      target: "#insights",
      activeLabel: "Insights"
    })
  );
  results.push(
    await capture(browser, {
      label: "05-office-team-desktop",
      hash: "#team",
      target: "#team",
      activeLabel: "Team"
    })
  );
  results.push(
    await capture(browser, {
      label: "06-office-experience-desktop",
      hash: "#experience",
      target: "#experience",
      activeLabel: "Experience"
    })
  );
  results.push(
    await capture(browser, {
      label: "07-office-settings-desktop",
      hash: "#settings",
      target: "#settings",
      activeLabel: "Settings"
    })
  );
  results.push(
    await capture(browser, {
      label: "08-office-home-mobile-390",
      activeLabel: "Home",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "09-office-money-mobile-390",
      hash: "#money",
      target: "#money",
      activeLabel: "Money",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "10-office-team-ar-rtl-390",
      hash: "#team",
      target: "#team",
      activeLabel: "الفريق",
      locale: "ar",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "11-office-settings-ar-rtl-390",
      hash: "#settings",
      target: "#settings",
      activeLabel: "الإعدادات",
      locale: "ar",
      viewport: { width: 390, height: 844 }
    })
  );
  results.push(
    await capture(browser, {
      label: "12-office-s6-team-desktop",
      pathname: "/staff/team",
      activeLabel: "Team"
    })
  );
  results.push(
    await capture(browser, {
      label: "13-office-s6-money-desktop",
      pathname: "/staff/money",
      activeLabel: "Money"
    })
  );
  results.push(
    await capture(browser, {
      label: "14-office-s6-experience-desktop",
      pathname: "/staff/experience",
      activeLabel: "Experience"
    })
  );
  results.push(
    await capture(browser, {
      label: "15-office-s6-settings-desktop",
      pathname: "/staff/settings",
      activeLabel: "Settings"
    })
  );
  results.push(
    await capture(browser, {
      label: "16-office-s6-account-desktop",
      pathname: "/staff/account",
      activeLabel: "Account"
    })
  );
  results.push(
    await capture(browser, {
      label: "17-office-s6-money-tablet-1024",
      pathname: "/staff/money",
      activeLabel: "Money",
      viewport: { width: 1024, height: 900 }
    })
  );
  results.push(
    await capture(browser, {
      label: "18-office-s6-team-ar-rtl-tablet-820",
      pathname: "/staff/team",
      activeLabel: "الفريق",
      locale: "ar",
      viewport: { width: 820, height: 900 }
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
