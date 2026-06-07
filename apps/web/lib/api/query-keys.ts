export const customerQueryKeys = {
  experience: (branchId?: string) => ["customer", "experience", branchId],
  menu: (branchId?: string) => ["customer", "menu", branchId],
  menuItem: (itemId?: string) => ["customer", "menu-item", itemId],
  cart: (sessionId?: string) => ["customer", "cart", sessionId],
  cartValidation: (sessionId?: string) => [
    "customer",
    "cart-validation",
    sessionId,
  ],
  orders: (sessionId?: string) => ["customer", "orders", sessionId],
  status: (sessionId?: string) => ["customer", "status", sessionId],
  timeline: (sessionId?: string) => ["customer", "timeline", sessionId],
  waiterCalls: (sessionId?: string) => ["customer", "waiter-calls", sessionId],
  bill: (sessionId?: string) => ["customer", "bill", sessionId],
  onlinePaymentIntent: (sessionId?: string, intentId?: string) => [
    "customer",
    "online-payment-intent",
    sessionId,
    intentId,
  ],
  aiWaiter: (sessionId?: string) => ["customer", "ai-waiter", sessionId],
  aiWaiterMessages: (sessionId?: string) => [
    "customer",
    "ai-waiter-messages",
    sessionId,
  ],
  aiWaiterProposals: (sessionId?: string) => [
    "customer",
    "ai-waiter-proposals",
    sessionId,
  ],
} as const;

type OwnerAnalyticsKeyQuery = {
  from?: string;
  to?: string;
  preset?: string;
};

function ownerAnalyticsRangeKey(query?: OwnerAnalyticsKeyQuery) {
  return [query?.preset ?? "today", query?.from ?? null, query?.to ?? null];
}

export const staffQueryKeys = {
  me: () => ["staff", "me"],
  companyOnboarding: (companyId?: string) => [
    "staff",
    "tenant-onboarding",
    "company",
    companyId,
  ],
  branchOnboarding: (branchId?: string) => [
    "staff",
    "tenant-onboarding",
    "branch",
    branchId,
  ],
  branchLaunchChecklist: (branchId?: string) => [
    "staff",
    "tenant-onboarding",
    "launch-checklist",
    branchId,
  ],
  branchOrders: (branchId?: string, status?: string) =>
    status === undefined
      ? ["staff", "branch-orders", branchId]
      : ["staff", "branch-orders", branchId, status],
  order: (orderId?: string) => ["staff", "order", orderId],
  branchBillRequests: (branchId?: string, status?: string) =>
    status === undefined
      ? ["staff", "branch-bill-requests", branchId]
      : ["staff", "branch-bill-requests", branchId, status],
  billRequest: (billRequestId?: string) => [
    "staff",
    "bill-request",
    billRequestId,
  ],
  branchBills: (branchId?: string, status?: string) =>
    status === undefined
      ? ["staff", "branch-bills", branchId]
      : ["staff", "branch-bills", branchId, status],
  bill: (billId?: string) => ["staff", "bill", billId],
  billReceipt: (billId?: string) => ["staff", "bill-receipt", billId],
  branchOnlinePayments: (
    branchId?: string,
    status?: string,
    provider?: string,
  ) =>
    status === undefined && provider === undefined
      ? ["staff", "branch-online-payments", branchId]
      : ["staff", "branch-online-payments", branchId, status, provider],
  onlinePaymentIntent: (intentId?: string) => [
    "staff",
    "online-payment-intent",
    intentId,
  ],
  saasPlans: () => ["staff", "saas", "plans"],
  companySaasStatus: (companyId?: string) => [
    "staff",
    "saas",
    "company",
    companyId,
  ],
  branchSaasStatus: (branchId?: string) => [
    "staff",
    "saas",
    "branch",
    branchId,
  ],
  currentCashierShift: (branchId?: string) => [
    "staff",
    "current-cashier-shift",
    branchId,
  ],
  branchCashierShifts: (branchId?: string, status?: string) =>
    status === undefined
      ? ["staff", "branch-cashier-shifts", branchId]
      : ["staff", "branch-cashier-shifts", branchId, status],
  cashierShift: (shiftId?: string) => ["staff", "cashier-shift", shiftId],
  cashierShiftXReport: (shiftId?: string) => [
    "staff",
    "cashier-shift-x-report",
    shiftId,
  ],
  preparationTasks: (branchId?: string, station?: string, status?: string) =>
    station === undefined && status === undefined
      ? ["staff", "preparation-tasks", branchId]
      : ["staff", "preparation-tasks", branchId, station, status],
  preparationTask: (taskId?: string) => ["staff", "preparation-task", taskId],
  kitchenTickets: (
    branchId?: string,
    station?: string,
    status?: string,
    type?: string,
  ) =>
    station === undefined && status === undefined && type === undefined
      ? ["staff", "kitchen-tickets", branchId]
      : ["staff", "kitchen-tickets", branchId, station, status, type],
  kitchenTicket: (ticketId?: string) => ["staff", "kitchen-ticket", ticketId],
  printJobs: (
    branchId?: string,
    station?: string,
    status?: string,
    kind?: string,
  ) =>
    station === undefined && status === undefined && kind === undefined
      ? ["staff", "print-jobs", branchId]
      : ["staff", "print-jobs", branchId, station, status, kind],
  printerStations: (branchId?: string) => [
    "staff",
    "printer-stations",
    branchId,
  ],
  orderPreparationTasks: (orderId?: string) => [
    "staff",
    "order-preparation-tasks",
    orderId,
  ],
  staffWaiterCalls: (branchId?: string, status?: string, type?: string) =>
    status === undefined && type === undefined
      ? ["staff", "waiter-calls", branchId]
      : ["staff", "waiter-calls", branchId, status, type],
  staffWaiterCall: (waiterCallId?: string) => [
    "staff",
    "waiter-call",
    waiterCallId,
  ],
  staffAttentionQueue: (
    branchId?: string,
    status?: string,
    priority?: string,
  ) =>
    status === undefined && priority === undefined
      ? ["staff", "attention-queue", branchId]
      : ["staff", "attention-queue", branchId, status, priority],
  staffTableSessionAttention: (sessionId?: string) => [
    "staff",
    "table-session-attention",
    sessionId,
  ],
  staffOwnerOrders: (branchId?: string) => [
    "staff",
    "owner",
    "orders",
    branchId,
  ],
  staffOwnerBillRequests: (branchId?: string) => [
    "staff",
    "owner",
    "bill-requests",
    branchId,
  ],
  staffOwnerPreparationTasks: (branchId?: string) => [
    "staff",
    "owner",
    "preparation-tasks",
    branchId,
  ],
  staffOwnerWaiterCalls: (branchId?: string) => [
    "staff",
    "owner",
    "waiter-calls",
    branchId,
  ],
  staffOwnerAttentionQueue: (branchId?: string) => [
    "staff",
    "owner",
    "attention-queue",
    branchId,
  ],
  staffOwnerExperience: (branchId?: string) => [
    "staff",
    "owner",
    "experience",
    branchId,
  ],
  staffOwnerMenu: (branchId?: string) => ["staff", "owner", "menu", branchId],
  ownerAnalyticsSummary: (
    branchId?: string,
    query?: OwnerAnalyticsKeyQuery,
  ) => [
    "staff",
    "owner-analytics",
    "summary",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsSales: (branchId?: string, query?: OwnerAnalyticsKeyQuery) => [
    "staff",
    "owner-analytics",
    "sales",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsOrders: (branchId?: string, query?: OwnerAnalyticsKeyQuery) => [
    "staff",
    "owner-analytics",
    "orders",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsItems: (branchId?: string, query?: OwnerAnalyticsKeyQuery) => [
    "staff",
    "owner-analytics",
    "items",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsOperations: (
    branchId?: string,
    query?: OwnerAnalyticsKeyQuery,
  ) => [
    "staff",
    "owner-analytics",
    "operations",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsCashierShifts: (
    branchId?: string,
    query?: OwnerAnalyticsKeyQuery,
  ) => [
    "staff",
    "owner-analytics",
    "cashier-shifts",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsAiWaiter: (
    branchId?: string,
    query?: OwnerAnalyticsKeyQuery,
  ) => [
    "staff",
    "owner-analytics",
    "ai-waiter",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerAnalyticsDashboard: (
    branchId?: string,
    query?: OwnerAnalyticsKeyQuery,
  ) => [
    "staff",
    "owner-analytics",
    "dashboard",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  ownerDailyReport: (branchId?: string, query?: OwnerAnalyticsKeyQuery) => [
    "staff",
    "owner-analytics",
    "daily-report",
    branchId,
    ownerAnalyticsRangeKey(query),
  ],
  inventoryItems: (companyId?: string) => [
    "staff",
    "inventory",
    "items",
    companyId,
  ],
  branchInventoryLevels: (branchId?: string) => [
    "staff",
    "inventory",
    "levels",
    branchId,
  ],
  branchInventoryAlerts: (branchId?: string) => [
    "staff",
    "inventory",
    "alerts",
    branchId,
  ],
  menuItemInventoryRequirements: (menuItemId?: string) => [
    "staff",
    "inventory",
    "menu-item-requirements",
    menuItemId,
  ],
  branchInventoryMenuAvailability: (branchId?: string) => [
    "staff",
    "inventory",
    "menu-availability",
    branchId,
  ],
  staffMenuAdminOverview: (branchId?: string) => [
    "staff",
    "menu-admin",
    "overview",
    branchId,
  ],
  branchTableAdminOverview: (companyId?: string, branchId?: string) => [
    "staff",
    "branch-table-admin",
    "overview",
    companyId,
    branchId,
  ],
  branchRealtime: (branchId?: string) => ["staff", "branch-realtime", branchId],
} as const;

export const platformQueryKeys = {
  me: () => ["platform", "me"],
  systemInfo: () => ["platform", "system-info"],
  plans: () => ["platform", "plans"],
  companies: () => ["platform", "companies"],
  company: (companyId?: string) => ["platform", "company", companyId],
} as const;
