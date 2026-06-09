export const SMOKE_BOOTSTRAP_IDENTIFIERS = {
  companyName: "Balcona Smoke Company",
  companySlug: "balcona-smoke",
  branchName: "Balcona Smoke Branch",
  branchSlug: "balcona-smoke",
  floorIdSuffix: "smoke-ground-floor",
  floorName: "Smoke Ground Floor",
  tableOneCode: "SMOKE-T01",
  tableTwoCode: "SMOKE-T02",
  tableOneQrToken: "balcona-smoke-t01",
  tableTwoQrToken: "balcona-smoke-t02",
  categorySlug: "smoke-coffee",
  menuItemName: "Spanish Latte",
  menuItemSlug: "smoke-spanish-latte",
  sizeGroupSlug: "smoke-size",
  temperatureGroupSlug: "smoke-temperature",
  saasPlanCode: "smoke-pilot",
} as const;

export const SMOKE_BOOTSTRAP_EMAILS = {
  owner: "smoke-owner@balcona.test",
  cashier: "smoke-cashier@balcona.test",
  kitchen: "smoke-kitchen@balcona.test",
  barista: "smoke-barista@balcona.test",
  waiter: "smoke-waiter@balcona.test",
  platform: "smoke-platform@balcona.test",
} as const;

export type SmokeStaffRoleKey =
  | "owner"
  | "cashier"
  | "kitchen"
  | "barista"
  | "waiter";
