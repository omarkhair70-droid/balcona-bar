export const customerQueryKeys = {
  experience: (branchId?: string) => ["customer", "experience", branchId],
  menu: (branchId?: string) => ["customer", "menu", branchId],
  menuItem: (itemId?: string) => ["customer", "menu-item", itemId],
  cart: (sessionId?: string) => ["customer", "cart", sessionId],
  cartValidation: (sessionId?: string) => [
    "customer",
    "cart-validation",
    sessionId
  ],
  orders: (sessionId?: string) => ["customer", "orders", sessionId],
  status: (sessionId?: string) => ["customer", "status", sessionId],
  timeline: (sessionId?: string) => ["customer", "timeline", sessionId],
  waiterCalls: (sessionId?: string) => ["customer", "waiter-calls", sessionId],
  bill: (sessionId?: string) => ["customer", "bill", sessionId],
  aiWaiter: (sessionId?: string) => ["customer", "ai-waiter", sessionId],
  aiWaiterMessages: (sessionId?: string) => [
    "customer",
    "ai-waiter-messages",
    sessionId
  ],
  aiWaiterProposals: (sessionId?: string) => [
    "customer",
    "ai-waiter-proposals",
    sessionId
  ]
} as const;

export const staffQueryKeys = {
  me: () => ["staff", "me"],
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
    billRequestId
  ],
  preparationTasks: (branchId?: string, station?: string, status?: string) =>
    station === undefined && status === undefined
      ? ["staff", "preparation-tasks", branchId]
      : ["staff", "preparation-tasks", branchId, station, status],
  preparationTask: (taskId?: string) => [
    "staff",
    "preparation-task",
    taskId
  ],
  kitchenTickets: (
    branchId?: string,
    station?: string,
    status?: string,
    type?: string
  ) =>
    station === undefined && status === undefined && type === undefined
      ? ["staff", "kitchen-tickets", branchId]
      : ["staff", "kitchen-tickets", branchId, station, status, type],
  kitchenTicket: (ticketId?: string) => [
    "staff",
    "kitchen-ticket",
    ticketId
  ],
  printJobs: (
    branchId?: string,
    station?: string,
    status?: string,
    kind?: string
  ) =>
    station === undefined && status === undefined && kind === undefined
      ? ["staff", "print-jobs", branchId]
      : ["staff", "print-jobs", branchId, station, status, kind],
  printerStations: (branchId?: string) => [
    "staff",
    "printer-stations",
    branchId
  ],
  orderPreparationTasks: (orderId?: string) => [
    "staff",
    "order-preparation-tasks",
    orderId
  ],
  staffWaiterCalls: (branchId?: string, status?: string, type?: string) =>
    status === undefined && type === undefined
      ? ["staff", "waiter-calls", branchId]
      : ["staff", "waiter-calls", branchId, status, type],
  staffWaiterCall: (waiterCallId?: string) => [
    "staff",
    "waiter-call",
    waiterCallId
  ],
  staffAttentionQueue: (branchId?: string, status?: string, priority?: string) =>
    status === undefined && priority === undefined
      ? ["staff", "attention-queue", branchId]
      : ["staff", "attention-queue", branchId, status, priority],
  staffTableSessionAttention: (sessionId?: string) => [
    "staff",
    "table-session-attention",
    sessionId
  ],
  staffOwnerOrders: (branchId?: string) => [
    "staff",
    "owner",
    "orders",
    branchId
  ],
  staffOwnerBillRequests: (branchId?: string) => [
    "staff",
    "owner",
    "bill-requests",
    branchId
  ],
  staffOwnerPreparationTasks: (branchId?: string) => [
    "staff",
    "owner",
    "preparation-tasks",
    branchId
  ],
  staffOwnerWaiterCalls: (branchId?: string) => [
    "staff",
    "owner",
    "waiter-calls",
    branchId
  ],
  staffOwnerAttentionQueue: (branchId?: string) => [
    "staff",
    "owner",
    "attention-queue",
    branchId
  ],
  staffOwnerExperience: (branchId?: string) => [
    "staff",
    "owner",
    "experience",
    branchId
  ],
  staffOwnerMenu: (branchId?: string) => [
    "staff",
    "owner",
    "menu",
    branchId
  ],
  staffMenuAdminOverview: (branchId?: string) => [
    "staff",
    "menu-admin",
    "overview",
    branchId
  ],
  branchTableAdminOverview: (companyId?: string, branchId?: string) => [
    "staff",
    "branch-table-admin",
    "overview",
    companyId,
    branchId
  ],
  branchRealtime: (branchId?: string) => ["staff", "branch-realtime", branchId]
} as const;
