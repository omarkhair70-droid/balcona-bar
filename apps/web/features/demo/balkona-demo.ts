export const balkonaDemoQrToken = "balcona-main-t01";

export const balkonaDemoStaff = {
  email: "manager@balcona.local",
  password: "change-me-local-123"
} as const;

export const balkonaDemoRoutes = [
  {
    label: "Customer QR demo",
    href: `/customer/table/${balkonaDemoQrToken}`,
    description: "Start or resume the seeded Balkona table session."
  },
  {
    label: "Customer entry",
    href: "/customer",
    description: "Enter a QR token or open the default demo table."
  },
  {
    label: "Staff login",
    href: "/staff/login",
    description: "Authenticate into staff operations for the local demo."
  },
  {
    label: "Cashier",
    href: "/staff/cashier",
    description: "Accept submitted customer orders and manage bill requests."
  },
  {
    label: "Menu Admin",
    href: "/staff/menu",
    description: "Review branch menu setup, availability, and modifiers."
  },
  {
    label: "Branch & Tables",
    href: "/staff/branches",
    description: "Review branch tables, QR tokens, and customer preview links."
  },
  {
    label: "Kitchen / Barista",
    href: "/staff/kitchen",
    description: "Start and mark preparation tasks ready."
  },
  {
    label: "Waiter / Floor",
    href: "/staff/waiter",
    description: "Resolve service calls and table attention."
  },
  {
    label: "Owner / Manager",
    href: "/staff/owner",
    description: "Review branch pulse, risk, and realtime activity."
  }
] as const;

export const balkonaDemoChecklist = [
  "Open customer QR route",
  "Add items to cart",
  "Optional: use AI Waiter and apply proposal if available",
  "Submit order",
  "Login as staff",
  "Open menu admin and review branch availability",
  "Open branch and tables admin and review QR readiness",
  "Open cashier and accept order",
  "Open kitchen and start or mark ready a prep task",
  "Open waiter and resolve service call or attention",
  "Open owner and review branch pulse"
] as const;

export const balkonaDemoProofPoints = [
  "Table QR session",
  "Menu and order flow",
  "AI waiter proposal flow",
  "Staff login and session",
  "Menu admin readiness",
  "Branch tables and QR readiness",
  "Cashier acceptance",
  "Preparation tasks",
  "Waiter calls and attention queue",
  "Owner pulse",
  "Realtime refresh foundation"
] as const;

export const balkonaDemoCommands = [
  "docker compose up -d",
  "pnpm --filter @balcona-bar/api start:dev",
  '$env:NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api/v1"',
  "pnpm web:dev"
] as const;
