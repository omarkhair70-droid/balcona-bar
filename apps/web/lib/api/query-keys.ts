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
  orderPreparationTasks: (orderId?: string) => [
    "staff",
    "order-preparation-tasks",
    orderId
  ],
  branchRealtime: (branchId?: string) => ["staff", "branch-realtime", branchId]
} as const;
