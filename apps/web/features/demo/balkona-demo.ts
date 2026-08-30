export const balkonaDemoQrToken = "balcona-main-t01";

export const balkonaDemoStaff = {
  email: "manager@balcona.local",
  password: "change-me-local-123"
} as const;

export const balkonaDemoRoutes = [
  {
    key: "customerQrDemo",
    href: `/guest/table/${balkonaDemoQrToken}`,
  },
  {
    key: "customerEntry",
    href: "/guest",
  },
  {
    key: "staffLogin",
    href: "/staff/login",
  },
  {
    key: "cashier",
    href: "/service/cashier",
  },
  {
    key: "menuAdmin",
    href: "/office/catalog",
  },
  {
    key: "branchTables",
    href: "/office/locations",
  },
  {
    key: "kitchenBarista",
    href: "/kitchen",
  },
  {
    key: "waiterFloor",
    href: "/service/waiter",
  },
  {
    key: "ownerManager",
    href: "/office",
  }
] as const;

export const balkonaDemoChecklist = [
  "openCustomerQr",
  "addItems",
  "useAiWaiter",
  "submitOrder",
  "loginStaff",
  "reviewMenuAdmin",
  "reviewBranchTables",
  "acceptOrder",
  "prepareTask",
  "resolveWaiter",
  "reviewOwner"
] as const;

export const balkonaDemoProofPoints = [
  "tableQrSession",
  "menuOrderFlow",
  "aiProposalFlow",
  "staffSession",
  "menuAdminReadiness",
  "branchQrReadiness",
  "cashierAcceptance",
  "preparationTasks",
  "waiterAttention",
  "ownerPulse",
  "realtimeRefresh"
] as const;

export const balkonaDemoCommands = [
  "docker compose up -d",
  "pnpm --filter @balcona-bar/api start:dev",
  '$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"',
  "pnpm web:dev"
] as const;
