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
