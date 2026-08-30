export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[];

export type ApiQueryParams = Record<string, ApiQueryValue>;

export type SystemInfoResult = {
  name?: string;
  version?: string;
  environment?: string;
  appEnvironment?: string;
  nodeEnvironment?: string;
  apiPrefix?: string;
  gitSha?: string;
  buildTime?: string;
  migration?: {
    status?: string;
    check?: string;
    expected?: number;
    applied?: number;
    pending?: number;
    failed?: number;
    checkedAt?: string;
  };
  timestamp?: string;
};

export type DemoRequestStatus = "new" | "contacted" | "qualified" | "closed";

export type DemoRequest = {
  id: string;
  fullName: string;
  businessName: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  locationCount: number;
  message?: string | null;
  consent: boolean;
  source?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  status: DemoRequestStatus;
  internalNotes?: string | null;
  lastContactedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateDemoRequestPayload = Pick<
  DemoRequest,
  "fullName" | "businessName" | "email" | "locationCount" | "consent"
> &
  Partial<
    Pick<
      DemoRequest,
      | "phone"
      | "city"
      | "message"
      | "source"
      | "utmSource"
      | "utmMedium"
      | "utmCampaign"
    >
  > & { website?: string };

export type CreateDemoRequestResult = Pick<
  DemoRequest,
  "id" | "status" | "createdAt"
>;

export type DemoRequestsResult = {
  requests: DemoRequest[];
  total: number;
};

export type UpdateDemoRequestPayload = Partial<
  Pick<DemoRequest, "status" | "internalNotes" | "lastContactedAt">
>;

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  status?: string;
};

export type BranchSummary = {
  id: string;
  companyId?: string;
  name: string;
  slug: string;
  address?: string | null;
  status?: string;
};

export type TenantOnboardingReadinessStatus =
  | "ready"
  | "missing"
  | "needs_attention"
  | "blocked";

export type TenantOnboardingLaunchStatus =
  | "ready_for_demo"
  | "ready_for_pilot"
  | "blocked";

export type TenantOnboardingCheckStatus =
  | "pending"
  | "complete"
  | "blocked"
  | "skipped";

export type TenantOnboardingCompanyStatus = "active" | "inactive";
export type TenantOnboardingBranchStatus = "active" | "inactive";

export type TenantOnboardingStaffRole =
  | "owner"
  | "branch_manager"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "barista"
  | "menu_admin";

export type StaffInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export type TenantOnboardingCompany = CompanySummary & {
  status: TenantOnboardingCompanyStatus | string;
  createdAt?: string;
  updatedAt?: string;
};

export type TenantOnboardingBranch = BranchSummary & {
  companyId: string;
  status: TenantOnboardingBranchStatus | string;
  createdAt?: string;
  updatedAt?: string;
  floorsCount?: number;
  tablesCount?: number;
};

export type TenantOnboardingFloor = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type TenantOnboardingTable = {
  id: string;
  branchId: string;
  floorId?: string | null;
  code: string;
  displayName: string;
  capacity: number;
  qrToken?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  floor?: TenantOnboardingFloor | null;
  customerPreviewPath?: string | null;
};

export type TenantOnboardingChecklistItem = {
  key: string;
  label: string;
  status: TenantOnboardingReadinessStatus;
  reason: string;
  actionHref?: string;
  metadata?: Record<string, unknown>;
};

export type TenantOnboardingSection = {
  key: string;
  label: string;
  status: TenantOnboardingReadinessStatus;
  readyCount: number;
  totalCount: number;
  percentage: number;
  items: TenantOnboardingChecklistItem[];
};

export type TenantOnboardingLaunchSummary = {
  status: TenantOnboardingLaunchStatus;
  readyForDemo: boolean;
  readyForPilot: boolean;
  blockedReasons: Array<{
    key: string;
    label: string;
    reason: string;
  }>;
  missingCriticalCount: number;
  totalCriticalCount: number;
};

export type TenantOnboardingRoleCounts = Partial<
  Record<TenantOnboardingStaffRole | string, number>
>;

export type CompanyOnboardingResult = {
  company: TenantOnboardingCompany;
  branches: TenantOnboardingBranch[];
  staff: {
    total: number;
    roleCounts: TenantOnboardingRoleCounts;
    companyScopedCount: number;
    branchScopedCount: number;
  };
  menu: {
    activeCategoryCount: number;
    activeItemCount: number;
  };
  sections: TenantOnboardingSection[];
  launchSummary: TenantOnboardingLaunchSummary;
};

export type BranchOnboardingStaffAssignment = {
  membership: {
    id: string;
    companyId: string;
    branchId?: string | null;
    role: TenantOnboardingStaffRole | string;
    status: string;
  };
  staffUser: StaffUserSummary & {
    passwordSetAt?: string | null;
  };
};

export type BranchOnboardingResult = {
  company: TenantOnboardingCompany;
  branch: TenantOnboardingBranch;
  generatedAt: string;
  saas?: SaasStatusResult;
  sections: TenantOnboardingSection[];
  tables: {
    floorCount: number;
    tableCount: number;
    activeTableCount: number;
    qrReadyTableCount: number;
    missingQrTableCount: number;
    floors: TenantOnboardingFloor[];
    recentTables: TenantOnboardingTable[];
  };
  staff: {
    total: number;
    roleCounts: TenantOnboardingRoleCounts;
    staff: BranchOnboardingStaffAssignment[];
  };
  menu: {
    activeCategoryCount: number;
    totalItemCount: number;
    activeItemCount: number;
    availableItemCount: number;
    branchOverrideCount: number;
    activeModifierGroupCount: number;
    itemModifierLinkCount: number;
    itemsWithModifiersCount: number;
    missingPriceItemCount: number;
    aiWaiterMenuGroundingReady: boolean;
    inventoryItemCount?: number;
    trackedInventoryLevelCount?: number;
    lowStockCount?: number;
    outOfStockCount?: number;
  };
  operations: {
    operatingSettings: Record<string, unknown> | null;
    smartCashierSettings: Record<string, unknown> | null;
    featureFlags: Record<string, boolean>;
    printerStationCount: number;
    activePrinterStationCount: number;
    currentOpenShift: Record<string, unknown> | null;
    cashierShiftCanOpen: boolean;
  };
  launchChecklist: TenantOnboardingChecklistItem[];
  launchSummary: TenantOnboardingLaunchSummary;
};

export type UpdateCompanyOnboardingProfilePayload = {
  name?: string;
  slug?: string;
  status?: TenantOnboardingCompanyStatus;
};

export type UpdateBranchOnboardingProfilePayload = {
  name?: string;
  slug?: string;
  address?: string | null;
  status?: TenantOnboardingBranchStatus;
};

export type CreateOnboardingFloorPayload = {
  name: string;
  sortOrder?: number;
};

export type BulkCreateOnboardingTablesPayload = {
  floorLabel: string;
  tablePrefix: string;
  startNumber: number;
  count: number;
  seats: number;
};

export type InviteOnboardingStaffPayload = {
  email: string;
  name: string;
  role: TenantOnboardingStaffRole;
};

export type UpdateReadinessCheckPayload = {
  key: string;
  status: TenantOnboardingCheckStatus;
  note?: string | null;
};

export type UpdateCompanyOnboardingProfileResult = {
  company: TenantOnboardingCompany;
  onboarding: CompanyOnboardingResult;
};

export type UpdateBranchOnboardingProfileResult = {
  branch: TenantOnboardingBranch;
  onboarding: BranchOnboardingResult;
};

export type CreateOnboardingFloorResult = {
  branch: TenantOnboardingBranch;
  floor: TenantOnboardingFloor;
  created: boolean;
  onboarding: BranchOnboardingResult;
};

export type BulkCreateOnboardingTablesResult = {
  branch: TenantOnboardingBranch;
  floor: TenantOnboardingFloor;
  created: TenantOnboardingTable[];
  skipped: Array<{
    code: string;
    displayName: string;
    reason: string;
    table?: TenantOnboardingTable;
  }>;
  requestedCount: number;
  createdCount: number;
  skippedCount: number;
  onboarding: BranchOnboardingResult;
};

export type InviteOnboardingStaffResult = {
  staffUser: StaffUserSummary & {
    passwordSetAt?: string | null;
  };
  membership: Record<string, unknown> & {
    id: string;
    staffUserId: string;
    companyId: string;
    branchId?: string | null;
    role: TenantOnboardingStaffRole | string;
    status: string;
  };
  createdStaffUser: boolean;
  createdMembership: boolean;
  invite: StaffInviteSummary;
  inviteToken: string;
  invitePath: string;
  passwordSetup: {
    required: boolean;
    devBootstrapAvailable?: boolean;
    nextStep: string;
  };
  onboarding: BranchOnboardingResult;
};

export type UpdateReadinessCheckResult = {
  acknowledged: {
    key: string;
    status: TenantOnboardingCheckStatus;
    note?: string | null;
    actorStaffUserId: string;
    persisted: boolean;
  };
  message: string;
  onboarding: BranchOnboardingResult;
};

export type BranchLaunchChecklistResult = {
  company: TenantOnboardingCompany;
  branch: TenantOnboardingBranch;
  launchChecklist: TenantOnboardingChecklistItem[];
  launchSummary: TenantOnboardingLaunchSummary;
  generatedAt: string;
};

export type OwnerAnalyticsPreset = "today" | "last_7_days" | "last_30_days";

export type OwnerAnalyticsQuery = {
  from?: string;
  to?: string;
  preset?: OwnerAnalyticsPreset;
};

export type OwnerAnalyticsRange = {
  from: string;
  to: string;
  preset: OwnerAnalyticsPreset | "custom";
};

export type OwnerAnalyticsCountRow = {
  key: string;
  count: number;
};

export type OwnerAnalyticsMoneyRow = OwnerAnalyticsCountRow & {
  amountMinor: number;
};

export type OwnerAnalyticsTenderRow = {
  method: "cash" | "card_pos" | "wallet_manual" | "other" | string;
  count: number;
  amountMinor: number;
};

export type OwnerAnalyticsShiftSummary = Record<string, unknown> & {
  id: string;
  status: string;
  currency: string;
  openingFloatMinor: number;
  expectedCashMinor: number;
  countedCashMinor?: number | null;
  cashOverShortMinor?: number | null;
  cashSalesMinor: number;
  cardSalesMinor: number;
  walletSalesMinor: number;
  otherSalesMinor: number;
  paymentCount: number;
  billCount: number;
  openedAt: string;
  closedAt?: string | null;
  zReportNumber?: string | null;
  zReportSnapshot?: Record<string, unknown> | null;
};

export type OwnerAnalyticsZReportSummary = Record<string, unknown> & {
  id: string;
  cashierShiftId: string;
  type: string;
  reportNumber: string;
  generatedAt: string;
  snapshot?: Record<string, unknown> | null;
};

export type OwnerAnalyticsBaseResult = {
  range: OwnerAnalyticsRange;
  branch: BranchSummary;
  company: CompanySummary;
};

export type OwnerAnalyticsSummaryResult = OwnerAnalyticsBaseResult & {
  paidRevenueMinor: number;
  collectedMinor: number;
  cashCollectedMinor: number;
  cardCollectedMinor: number;
  walletCollectedMinor: number;
  otherCollectedMinor: number;
  paidBillCount: number;
  averageTicketMinor: number;
  submittedOrderCount: number;
  acceptedOrderCount: number;
  servedOrderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  rejectedOrderCount: number;
  activeBillRequestCount: number;
  openWaiterCallCount: number;
  activeCashierShift: OwnerAnalyticsShiftSummary | null;
  latestClosedShift: OwnerAnalyticsShiftSummary | null;
  latestZReport: OwnerAnalyticsZReportSummary | null;
  lowStockCount?: number;
  outOfStockCount?: number;
  stockBlockedMenuItemCount?: number;
  recentInventoryMovements?: InventoryMovement[];
  revenueSource: string;
};

export type OwnerAnalyticsSalesResult = OwnerAnalyticsBaseResult & {
  tenderBreakdown: OwnerAnalyticsTenderRow[];
  revenueByDay: OwnerAnalyticsMoneyRow[];
  revenueByHour: OwnerAnalyticsMoneyRow[];
  billCountByStatus: OwnerAnalyticsCountRow[];
  paymentCountByMethod: OwnerAnalyticsMoneyRow[];
  topPaidBills: Record<string, unknown>[];
  recentPayments: Record<string, unknown>[];
  cashDrawerOverview: Array<OwnerAnalyticsShiftSummary | null>;
  revenueSource: string;
};

export type OwnerAnalyticsOrdersResult = OwnerAnalyticsBaseResult & {
  orderCountByStatus: OwnerAnalyticsCountRow[];
  orderCountByHour: OwnerAnalyticsCountRow[];
  totalQuantity: number;
  itemCount: number;
  submittedOrderCount: number;
  grossSubmittedOrderValueMinor: number;
  averageSubmittedOrderValueMinor: number;
  averageOrderValueMinor: number;
  lifecycleAverages: {
    submittedToAcceptedSeconds: number | null;
    acceptedToPreparingSeconds: number | null;
    preparingToReadySeconds: number | null;
    readyToServedSeconds: number | null;
    submittedToServedSeconds: number | null;
  };
};

export type OwnerAnalyticsItemRow = {
  menuItemId?: string | null;
  name: string;
  slug?: string | null;
  quantity: number;
  revenueMinor: number;
  lineCount?: number;
  currency?: string;
};

export type OwnerAnalyticsModifierRow = {
  modifierGroupId: string;
  modifierOptionId: string;
  groupName: string;
  optionName: string;
  quantity: number;
  revenueMinor: number;
};

export type OwnerAnalyticsCategoryRow = {
  categoryId?: string | null;
  name: string;
  quantity: number;
  revenueMinor: number;
};

export type OwnerAnalyticsItemsResult = OwnerAnalyticsBaseResult & {
  itemCount: number;
  quantity: number;
  revenueMinor: number;
  modifierRevenueMinor: number;
  topItemsByQuantity: OwnerAnalyticsItemRow[];
  topItemsByRevenue: OwnerAnalyticsItemRow[];
  topModifiers: OwnerAnalyticsModifierRow[];
  categoryBreakdown: OwnerAnalyticsCategoryRow[];
  revenueSource: string;
};

export type OwnerAnalyticsOperationsResult = OwnerAnalyticsBaseResult & {
  preparationTaskCountsByStatus: OwnerAnalyticsCountRow[];
  preparationTaskCountsByStation: OwnerAnalyticsCountRow[];
  kitchenTicketCountsByStatus: OwnerAnalyticsCountRow[];
  kitchenTicketCountsByStation: OwnerAnalyticsCountRow[];
  printJobCountsByStatus: OwnerAnalyticsCountRow[];
  printJobCountsByKind: OwnerAnalyticsCountRow[];
  failedPrintJobCount: number;
  waiterCallCountsByStatus: OwnerAnalyticsCountRow[];
  waiterCallCountsByType: OwnerAnalyticsCountRow[];
  averageWaiterCallResolutionSeconds: number | null;
  activeAttentionCount: number;
  urgentAttentionCount: number;
};

export type OwnerAnalyticsCashierShiftsResult = OwnerAnalyticsBaseResult & {
  currentOpenShift: OwnerAnalyticsShiftSummary | null;
  recentClosedShifts: Array<OwnerAnalyticsShiftSummary | null>;
  totalOverShortMinor: number;
  shiftCount: number;
  zReports: Array<OwnerAnalyticsZReportSummary | null>;
  cashDrawerTransactions: {
    cashInMinor: number;
    cashOutMinor: number;
    correctionMinor: number;
    openingFloatMinor: number;
    cashPaymentMinor: number;
  };
  latestZReport: OwnerAnalyticsZReportSummary | null;
};

export type OwnerAnalyticsAiWaiterResult = OwnerAnalyticsBaseResult & {
  aiSessionCount: number;
  aiMessageCount: number;
  escalatedCount: number;
  proposalCount: number;
  appliedProposalCount: number;
  estimatedCostMicros: number;
  inputTokens: number;
  outputTokens: number;
  topEscalationReasons: OwnerAnalyticsCountRow[];
};

export type OwnerAnalyticsDashboardResult = OwnerAnalyticsBaseResult & {
  summary: OwnerAnalyticsSummaryResult;
  sales: OwnerAnalyticsSalesResult;
  orders: OwnerAnalyticsOrdersResult;
  items: OwnerAnalyticsItemsResult;
  operations: OwnerAnalyticsOperationsResult;
  cashierShifts: OwnerAnalyticsCashierShiftsResult;
  aiWaiter: OwnerAnalyticsAiWaiterResult;
  generatedAt: string;
};

export type OwnerAnalyticsDailyReportResult = OwnerAnalyticsDashboardResult & {
  reportType: "owner_daily_report";
};

export type BranchAdminBranchStatus = "active" | "inactive";
export type BranchAdminTableStatus = "active" | "inactive" | "maintenance";

export type BranchAdminBranch = BranchSummary & {
  companyId: string;
  createdAt?: string;
  updatedAt?: string;
  floorsCount?: number;
  tablesCount?: number;
  status: BranchAdminBranchStatus;
};

export type BranchAdminFloor = {
  id: string;
  branchId: string;
  name: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BranchAdminAttentionSnapshot = {
  id: string;
  status: string;
  priority: string;
  score: number;
  lastEvaluatedAt: string;
  resolvedAt?: string | null;
  mutedUntil?: string | null;
};

export type BranchAdminSession = {
  id: string;
  companyId: string;
  branchId: string;
  tableId: string;
  status: string;
  source: string;
  guestLabel?: string | null;
  partySize?: number | null;
  startedAt: string;
  lastSeenAt: string;
  expiresAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  tableAttentionSnapshot?: BranchAdminAttentionSnapshot | null;
  table?: {
    id: string;
    code: string;
    displayName: string;
    qrToken: string;
    status: BranchAdminTableStatus;
    floor?: BranchAdminFloor | null;
  };
};

export type BranchAdminTable = {
  id: string;
  branchId: string;
  floorId?: string | null;
  code: string;
  displayName: string;
  capacity?: number | null;
  qrToken: string;
  status: BranchAdminTableStatus;
  createdAt?: string;
  updatedAt?: string;
  floor?: BranchAdminFloor | null;
  customerPreviewPath?: string | null;
  activeSession?: BranchAdminSession | null;
};

export type BranchAdminFloorWithTables = BranchAdminFloor & {
  tables: BranchAdminTable[];
  tableCount: number;
};

export type BranchAdminSetupIssue = {
  code: string;
  severity: "warning" | "error";
  scope: "company" | "branch" | "floor" | "table" | "qr";
  message: string;
  branchId?: string;
  floorId?: string | null;
  tableId?: string;
};

export type BranchAdminStats = {
  totalTables: number;
  activeTables: number;
  inactiveTables: number;
  maintenanceTables: number;
  occupiedTables: number;
  activeSessions: number;
  needsAttention: number;
  tablesWithQrToken: number;
  tablesMissingQrToken: number;
  setupWarnings: number;
};

export type BranchAdminOverviewResult = {
  company: CompanySummary;
  branches: BranchAdminBranch[];
  selectedBranch: BranchAdminBranch | null;
  floors: BranchAdminFloor[];
  tablesByFloor: BranchAdminFloorWithTables[];
  ungroupedTables: BranchAdminTable[];
  activeSessions: BranchAdminSession[];
  stats: BranchAdminStats;
  setupIssues: BranchAdminSetupIssue[];
};

export type CreateBranchPayload = {
  name: string;
  slug: string;
  address?: string | null;
  status?: BranchAdminBranchStatus;
};

export type UpdateBranchPayload = Partial<CreateBranchPayload>;

export type BranchMutationResult = {
  branch: BranchAdminBranch;
};

export type CreateBranchResult = {
  company: CompanySummary;
  branch: BranchAdminBranch;
};

export type CreateFloorPayload = {
  name: string;
  sortOrder?: number;
};

export type UpdateFloorPayload = Partial<CreateFloorPayload>;

export type FloorMutationResult = {
  floor: BranchAdminFloor;
};

export type CreateFloorResult = {
  branch: BranchAdminBranch;
  floor: BranchAdminFloor;
};

export type CreateTablePayload = {
  code: string;
  displayName: string;
  capacity?: number | null;
  floorId?: string | null;
  qrToken?: string;
  status?: BranchAdminTableStatus;
};

export type UpdateTablePayload = Partial<CreateTablePayload>;

export type TableMutationResult = {
  table: BranchAdminTable;
};

export type CreateTableResult = {
  branch: BranchAdminBranch;
  table: BranchAdminTable;
  generatedQrToken: string;
};

export type QrTokenMutationResult = {
  table: BranchAdminTable;
  qrToken: string;
  generated: boolean;
};

export type BranchEffectiveExperience = {
  company: CompanySummary;
  branch: BranchSummary;
  profile: Record<string, unknown> | null;
  source: "branch" | "company";
  theme?: Record<string, unknown> | null;
  designTokens?: Record<string, unknown> | null;
  motionTokens?: Record<string, unknown> | null;
  layoutConfig?: Record<string, unknown> | null;
  brandVoice?: Record<string, unknown> | null;
  aiWaiterTone?: Record<string, unknown> | null;
  contentBlocks: Record<string, unknown>[];
  venueZones: Record<string, unknown>[];
  mediaUsages: Record<string, unknown>[];
};

export type MenuModifierOption = {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  priceDeltaMinor: number;
  status: string;
  sortOrder: number;
};

export type MenuModifierGroup = {
  id: string;
  menuItemModifierGroupId?: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  selectionType: "single" | "multiple" | string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  status: string;
  options: MenuModifierOption[];
};

export type MenuCategorySummary = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sortOrder: number;
  status: string;
};

export type MenuItemSummary = {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  basePriceMinor: number;
  effectivePriceMinor?: number;
  currency: string;
  station?: string | null;
  status: string;
  isFeatured?: boolean;
  isAvailable?: boolean;
  isVisible?: boolean;
  canOrder?: boolean;
  stockStatus?: InventoryStockStatus;
  stockReasons?: string[];
  missingRequirements?: InventoryMissingRequirement[];
  lowStockRequirements?: InventoryLowStockRequirement[];
  sortOrder?: number;
  category?: MenuCategorySummary;
  modifiers?: MenuModifierGroup[];
};

export type BranchMenuCategory = MenuCategorySummary & {
  items: MenuItemSummary[];
};

export type BranchMenuResult = {
  branch: BranchSummary & {
    company?: CompanySummary;
  };
  categories: BranchMenuCategory[];
};

export type MenuItemDetailResult = {
  item: MenuItemSummary;
  category: MenuCategorySummary;
  branchOverrides: Record<string, unknown>[];
};

export type InventoryUnit = "piece" | "gram" | "milliliter";
export type InventoryItemStatus = "active" | "inactive" | "archived";
export type InventoryMovementType =
  | "opening_balance"
  | "stock_in"
  | "stock_out"
  | "correction"
  | "waste"
  | "sale_consumption"
  | "sale_reversal";
export type InventoryStockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type InventoryItem = {
  id: string;
  companyId: string;
  name: string;
  sku?: string | null;
  unit: InventoryUnit;
  status: InventoryItemStatus;
  parLevelQuantity?: number | null;
  lowStockThresholdQuantity?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

export type InventoryLevel = {
  id: string | null;
  branchId: string;
  inventoryItemId: string;
  item: InventoryItem;
  quantityOnHand: number;
  reservedQuantity: number;
  lowStockThresholdQuantity?: number | null;
  stockStatus: InventoryStockStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type InventoryMovement = {
  id: string;
  companyId: string;
  branchId: string;
  inventoryItemId: string;
  staffUserId?: string | null;
  type: InventoryMovementType;
  quantityDelta: number;
  quantityAfter: number;
  unit: InventoryUnit;
  sourceType?: string | null;
  sourceId?: string | null;
  note?: string | null;
  createdAt: string;
  inventoryItem?: InventoryItem;
};

export type InventoryMissingRequirement = {
  inventoryItemId: string;
  name: string;
  unit: InventoryUnit;
  quantityRequired: number;
  quantityOnHand: number;
  shortageQuantity: number;
  reason: string;
};

export type InventoryLowStockRequirement = {
  inventoryItemId: string;
  name: string;
  unit: InventoryUnit;
  quantityRequired: number;
  quantityOnHand: number;
  quantityAfter: number;
  threshold: number;
};

export type MenuItemInventoryRequirement = {
  id: string;
  companyId: string;
  menuItemId: string;
  inventoryItemId: string;
  quantityRequired: number;
  unit: InventoryUnit;
  isRequired: boolean;
  createdAt?: string;
  updatedAt?: string;
  inventoryItem: InventoryItem;
};

export type InventoryMenuAvailabilityItem = {
  menuItemId: string;
  name: string;
  slug: string;
  category: MenuCategorySummary;
  branchVisible: boolean;
  branchAvailable: boolean;
  stockStatus: InventoryStockStatus;
  missingRequirements: InventoryMissingRequirement[];
  lowStockRequirements: InventoryLowStockRequirement[];
  canOrder: boolean;
  reasons: string[];
};

export type InventoryItemsResult = {
  company: CompanySummary;
  items: InventoryItem[];
};

export type CreateInventoryItemPayload = {
  name: string;
  sku?: string | null;
  unit: InventoryUnit;
  lowStockThresholdQuantity?: number | null;
  parLevelQuantity?: number | null;
};

export type UpdateInventoryItemPayload = Partial<
  Omit<CreateInventoryItemPayload, "unit">
> & {
  status?: InventoryItemStatus;
};

export type InventoryItemMutationResult = {
  company: CompanySummary;
  item: InventoryItem;
};

export type BranchInventoryLevelsResult = {
  company: CompanySummary;
  branch: BranchSummary;
  levels: InventoryLevel[];
  summary: {
    totalInventoryItemCount: number;
    trackedLevelCount: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lastMovementAt?: string | null;
};

export type BranchInventoryAlertsResult = {
  company: CompanySummary;
  branch: BranchSummary;
  lowStockLevels: InventoryLevel[];
  outOfStockLevels: InventoryLevel[];
  stockBlockedMenuItems: InventoryMenuAvailabilityItem[];
  recentMovements: InventoryMovement[];
  summary: {
    lowStockCount: number;
    outOfStockCount: number;
    stockBlockedMenuItemCount: number;
  };
};

export type AdjustInventoryLevelPayload = {
  type: Extract<
    InventoryMovementType,
    "opening_balance" | "stock_in" | "stock_out" | "correction" | "waste"
  >;
  quantity?: number;
  finalQuantity?: number;
  note?: string | null;
};

export type AdjustInventoryLevelResult = {
  company: CompanySummary;
  branch: BranchSummary;
  level: InventoryLevel;
  movement: InventoryMovement;
};

export type MenuItemInventoryRequirementsResult = {
  item: MenuItemSummary;
  requirements: MenuItemInventoryRequirement[];
};

export type ReplaceMenuItemInventoryRequirementsPayload = {
  requirements: Array<{
    inventoryItemId: string;
    quantityRequired: number;
    isRequired?: boolean;
  }>;
};

export type BranchInventoryMenuAvailabilityResult = {
  company: CompanySummary;
  branch: BranchSummary;
  items: InventoryMenuAvailabilityItem[];
  summary: {
    itemCount: number;
    canOrderCount: number;
    lowStockCount: number;
    outOfStockCount: number;
    stockBlockedCount: number;
  };
};

export type SupplierStatus = "active" | "inactive" | "archived";
export type PurchaseOrderStatus =
  | "draft"
  | "submitted"
  | "partially_received"
  | "received"
  | "cancelled";

export type Supplier = {
  id: string;
  companyId: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
  status: SupplierStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type PurchaseOrderLine = {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCostMinor: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  inventoryItem: InventoryItem;
};

export type PurchaseOrder = {
  id: string;
  companyId: string;
  branchId: string;
  supplierId: string;
  orderNumber: string;
  status: PurchaseOrderStatus;
  expectedAt?: string | null;
  notes?: string | null;
  currency: string;
  createdByStaffUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  supplier: Supplier;
  lines: PurchaseOrderLine[];
};

export type InventoryReceiptLine = {
  id: string;
  receiptId: string;
  purchaseOrderLineId?: string | null;
  inventoryItemId: string;
  quantityReceived: number;
  unitCostMinor?: number | null;
  createdAt?: string;
  inventoryItem: InventoryItem;
};

export type InventoryReceipt = {
  id: string;
  companyId: string;
  branchId: string;
  supplierId?: string | null;
  purchaseOrderId?: string | null;
  receiptNumber: string;
  receivedAt: string;
  notes?: string | null;
  createdByStaffUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  supplier?: Supplier | null;
  lines: InventoryReceiptLine[];
};

export type SuppliersResult = {
  company: CompanySummary;
  branch?: BranchSummary;
  suppliers: Supplier[];
};

export type SupplierMutationResult = {
  company: CompanySummary;
  supplier: Supplier;
};

export type CreateSupplierPayload = {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  taxId?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: SupplierStatus;
};

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>;

export type PurchaseOrdersResult = {
  company: CompanySummary;
  branch: BranchSummary;
  purchaseOrders: PurchaseOrder[];
};

export type PurchaseOrderResult = {
  company: CompanySummary;
  branch: BranchSummary;
  purchaseOrder: PurchaseOrder;
};

export type PurchaseOrderMutationResult = PurchaseOrderResult & {
  deleted?: boolean;
};

export type CreatePurchaseOrderPayload = {
  supplierId: string;
  expectedAt?: string | null;
  notes?: string | null;
  currency?: string;
};

export type UpdatePurchaseOrderPayload =
  Partial<CreatePurchaseOrderPayload>;

export type CreatePurchaseOrderLinePayload = {
  inventoryItemId: string;
  quantityOrdered: number;
  unitCostMinor: number;
  notes?: string | null;
};

export type UpdatePurchaseOrderLinePayload =
  Partial<Omit<CreatePurchaseOrderLinePayload, "inventoryItemId">>;

export type ReceivePurchaseOrderPayload = {
  receivedAt?: string | null;
  notes?: string | null;
  lines: Array<{
    purchaseOrderLineId: string;
    quantityReceived: number;
    unitCostMinor?: number | null;
  }>;
};

export type ReceivePurchaseOrderResult = PurchaseOrderResult & {
  receipt: InventoryReceipt | null;
  movements: InventoryMovement[];
};

export type InventoryReceiptsResult = {
  company: CompanySummary;
  branch: BranchSummary;
  receipts: InventoryReceipt[];
};

export type MenuAdminCategoryStatus = "active" | "inactive";
export type MenuAdminItemStatus = "active" | "inactive" | "archived";
export type MenuAdminModifierStatus = "active" | "inactive";
export type MenuAdminSelectionType = "single" | "multiple";
export type MenuAdminPreparationStation =
  | "barista"
  | "kitchen"
  | "dessert"
  | "cashier";

export type MenuAdminModifierOption = {
  id: string;
  groupId: string;
  name: string;
  slug: string;
  priceDeltaMinor: number;
  status: MenuAdminModifierStatus;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type MenuAdminModifierGroup = {
  id: string;
  companyId: string;
  name: string;
  slug: string;
  description?: string | null;
  selectionType: MenuAdminSelectionType;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  status: MenuAdminModifierStatus;
  createdAt?: string;
  updatedAt?: string;
  options: MenuAdminModifierOption[];
  itemCount?: number;
};

export type MenuAdminItemModifierGroup = {
  id: string;
  menuItemId: string;
  modifierGroupId: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  modifierGroup: MenuAdminModifierGroup;
};

export type MenuAdminBranchOverride = {
  id: string;
  branchId: string;
  menuItemId: string;
  priceOverrideMinor: number | null;
  effectivePriceMinor: number;
  isAvailable: boolean;
  isVisible: boolean;
  sortOrder: number | null;
  createdAt?: string;
  updatedAt?: string;
  branch?: BranchSummary;
  menuItem?: MenuItemSummary;
};

export type MenuAdminItemDetail = {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  basePriceMinor: number;
  effectivePriceMinor: number;
  currency: string;
  station: MenuAdminPreparationStation;
  status: MenuAdminItemStatus;
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  category: MenuCategorySummary;
  modifierGroups: MenuAdminItemModifierGroup[];
  branchOverrides: MenuAdminBranchOverride[];
};

export type MenuAdminItem = {
  id: string;
  companyId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  basePriceMinor: number;
  effectivePriceMinor: number;
  currency: string;
  station: MenuAdminPreparationStation;
  status: MenuAdminItemStatus;
  isFeatured: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  category: MenuCategorySummary;
  modifierGroups: MenuAdminItemModifierGroup[];
  branchOverride: MenuAdminBranchOverride | null;
  hasBranchOverride: boolean;
  isAvailable: boolean;
  isVisible: boolean;
  customerVisible: boolean;
};

export type MenuAdminCategoryRecord = MenuCategorySummary & {
  companyId: string;
  createdAt?: string;
  updatedAt?: string;
};

export type MenuAdminCategory = MenuAdminCategoryRecord & {
  itemCount: number;
  visibleItemCount: number;
  items: MenuAdminItem[];
};

export type MenuAdminSetupIssue = {
  code: string;
  severity: "warning" | "error";
  scope: "branch" | "category" | "item" | "modifier_group" | "modifier_option";
  message: string;
  categoryId?: string;
  itemId?: string;
  modifierGroupId?: string;
  modifierOptionId?: string;
};

export type MenuAdminOverviewStats = {
  categories: number;
  items: number;
  visibleItems: number;
  unavailableItems: number;
  hiddenItems: number;
  modifierGroups: number;
  setupWarnings: number;
};

export type MenuAdminOverviewResult = {
  company: CompanySummary;
  branch: BranchSummary;
  stats: MenuAdminOverviewStats;
  categories: MenuAdminCategory[];
  modifierGroups: MenuAdminModifierGroup[];
  setupIssues: MenuAdminSetupIssue[];
};

export type CreateMenuCategoryResult = {
  company: CompanySummary;
  category: MenuAdminCategoryRecord;
};

export type MenuCategoryMutationResult = {
  category: MenuAdminCategoryRecord;
};

export type CreateMenuItemResult = {
  company: CompanySummary;
  category: MenuAdminCategoryRecord;
  item: MenuAdminItemDetail;
};

export type MenuItemMutationResult = {
  item: MenuAdminItemDetail;
};

export type CreateModifierGroupResult = {
  company: CompanySummary;
  modifierGroup: MenuAdminModifierGroup;
};

export type ModifierGroupMutationResult = {
  modifierGroup: MenuAdminModifierGroup;
};

export type CreateModifierOptionResult = {
  modifierGroup: MenuAdminModifierGroup;
  option: MenuAdminModifierOption;
};

export type ModifierOptionMutationResult = {
  option: MenuAdminModifierOption;
};

export type UpsertBranchMenuItemOverrideResult = {
  branch: BranchSummary;
  item: MenuAdminItemDetail;
  override: MenuAdminBranchOverride;
};

export type DeleteBranchMenuItemOverrideResult = {
  deleted: boolean;
  branch: BranchSummary;
  item: MenuAdminItemDetail;
  override: MenuAdminBranchOverride;
};

export type CreateMenuItemModifierGroupResult = {
  item: MenuAdminItemDetail;
  link: MenuAdminItemModifierGroup;
};

export type DeleteMenuItemModifierGroupResult = {
  deleted: boolean;
  link: MenuAdminItemModifierGroup;
};

export type CreateMenuCategoryPayload = {
  name: string;
  slug: string;
  description?: string | null;
  sortOrder?: number;
  status?: MenuAdminCategoryStatus;
};

export type UpdateMenuCategoryPayload = Partial<CreateMenuCategoryPayload>;

export type CreateMenuItemPayload = {
  categoryId: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
  basePriceMinor: number;
  currency?: string;
  station: MenuAdminPreparationStation;
  status?: MenuAdminItemStatus;
  isFeatured?: boolean;
  sortOrder?: number;
};

export type UpdateMenuItemPayload = Partial<CreateMenuItemPayload>;

export type UpsertBranchMenuItemOverridePayload = {
  priceOverrideMinor?: number | null;
  isAvailable?: boolean;
  isVisible?: boolean;
  sortOrder?: number | null;
};

export type CreateModifierGroupPayload = {
  name: string;
  slug: string;
  description?: string | null;
  selectionType: MenuAdminSelectionType;
  isRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
  status?: MenuAdminModifierStatus;
};

export type UpdateModifierGroupPayload = Partial<CreateModifierGroupPayload>;

export type CreateModifierOptionPayload = {
  name: string;
  slug: string;
  priceDeltaMinor?: number;
  status?: MenuAdminModifierStatus;
  sortOrder?: number;
};

export type UpdateModifierOptionPayload = Partial<CreateModifierOptionPayload>;

export type CreateMenuItemModifierGroupPayload = {
  modifierGroupId: string;
  sortOrder?: number;
};

export type StartTableSessionPayload = {
  qrToken: string;
  guestLabel?: string;
  partySize?: number;
};

export type TableSessionSummary = {
  id: string;
  companyId: string;
  branchId: string;
  tableId: string;
  status: string;
  source?: string;
  guestLabel?: string | null;
  partySize?: number | null;
  startedAt?: string;
  lastSeenAt?: string;
  expiresAt?: string | null;
  closedAt?: string | null;
  closeReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type TableSessionFloorSummary = {
  id: string;
  name: string;
  sortOrder: number;
};

export type TableSessionTableSummary = {
  id: string;
  code: string;
  displayName?: string | null;
  capacity?: number | null;
  qrToken: string;
  status: string;
};

export type CustomerAccessSummary = {
  customerAccessToken: string;
  customerAccessTokenExpiresAt: string | null;
  customerSessionIdentityId: string;
};

export type StartTableSessionResult = {
  session: TableSessionSummary;
  company: CompanySummary;
  branch: BranchSummary;
  floor: TableSessionFloorSummary | null;
  table: TableSessionTableSummary;
  wasResumed: boolean;
  customerAccess: CustomerAccessSummary;
};

export type SelectedModifierPayload = {
  modifierGroupId: string;
  optionIds: string[];
};

export type AddCartItemPayload = {
  menuItemId: string;
  quantity: number;
  notes?: string;
  selectedModifiers?: SelectedModifierPayload[];
};

export type UpdateCartItemPayload = {
  quantity?: number;
  notes?: string | null;
};

export type CartTotals = {
  subtotalMinor: number;
  totalQuantity: number;
  itemCount: number;
  currency: string;
};

export type CartItemModifierOption = {
  id?: string;
  modifierGroupId: string;
  modifierOptionId: string;
  modifierGroupNameSnapshot: string;
  modifierOptionNameSnapshot: string;
  priceDeltaMinorSnapshot: number;
};

export type CartItemSummary = {
  id: string;
  menuItemId: string;
  quantity: number;
  notes?: string | null;
  itemNameSnapshot: string;
  itemSlugSnapshot?: string;
  effectiveBasePriceMinorSnapshot: number;
  modifiersTotalMinorSnapshot: number;
  unitPriceMinorSnapshot: number;
  lineTotalMinorSnapshot: number;
  currency: string;
  modifierOptions: CartItemModifierOption[];
};

export type CartResponse = {
  cart: {
    id: string | null;
    tableSessionId: string;
    status: string;
    currency: string;
  };
  items: CartItemSummary[];
  totals: CartTotals;
};

export type CartValidationResult = {
  isValid: boolean;
  issues: Record<string, unknown>[];
  recalculatedTotals: CartTotals;
  cart: CartResponse;
};

export type SubmitCartPayload = {
  customerNote?: string | null;
};

export type SubmitCartResult = Record<string, unknown> & {
  order?: Record<string, unknown>;
  idempotency?: {
    replayed: boolean;
    key: string | null;
  };
};

export type WaiterCallPayload = {
  type:
    | "call_waiter"
    | "need_bill"
    | "need_water"
    | "need_help"
    | "order_problem"
    | "clean_table"
    | "other";
  message?: string;
  orderId?: string;
  priority?: number;
};

export type RequestBillPayload = {
  note?: string;
};

export type SessionOrdersResult = {
  tableSession?: Record<string, unknown>;
  orders: Record<string, unknown>[];
};

export type CustomerStatusResult = Record<string, unknown> & {
  customerStatus?: string;
  orders?: Record<string, unknown>[];
};

export type CustomerTimelineResult = {
  tableSession?: Record<string, unknown>;
  branch?: BranchSummary;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  timeline: Array<{
    type: string;
    label: string;
    occurredAt: string;
    [key: string]: unknown;
  }>;
};

export type WaiterCallsResult = {
  tableSession?: Record<string, unknown>;
  waiterCalls?: Record<string, unknown>[];
  calls?: Record<string, unknown>[];
  [key: string]: unknown;
};

export type BillResult = Record<string, unknown> & {
  billRequest?: Record<string, unknown> | null;
  activeBillRequest?: Record<string, unknown> | null;
  bill?: Record<string, unknown> | null;
  activeBill?: Record<string, unknown> | null;
  latestBills?: Record<string, unknown>[];
  lines?: Record<string, unknown>[];
  manualPayments?: Record<string, unknown>[];
  receipt?: Record<string, unknown> | null;
  totals?: CartTotals | Record<string, unknown>;
};

export type AiWaiterLanguage = "en" | "ar-EG";

export type AiWaiterProviderMetadata = Record<string, unknown> & {
  provider?: "stub" | "groq" | string;
  model?: string;
  intent?: string;
  confidence?: number;
  safetyFlags?: string[];
  fallbackUsed?: boolean;
  latencyMs?: number;
  pendingModifier?: {
    menuItemId?: string;
    modifierGroupId?: string;
    allowedOptions?: Array<{
      id?: string;
      name?: string;
      slug?: string;
    }>;
    selectedModifierOptionIds?: string[];
    question?: string;
  };
};

export type AiWaiterMessageRecord = Record<string, unknown> & {
  id?: string;
  role?: "customer" | "assistant" | "system" | "tool" | string;
  kind?: string;
  content?: string;
  metadata?: AiWaiterProviderMetadata;
  structuredPayload?: Record<string, unknown>;
};

export type StartAiWaiterPayload = {
  language?: string;
};

export type SendAiWaiterMessagePayload = {
  message: string;
  language?: string;
};

export type ListAiWaiterMessagesQuery = {
  limit?: number;
};

export type RejectAiCartProposalPayload = {
  reason?: string;
};

export type EscalateAiWaiterPayload = {
  reason:
    | "customer_requested_human"
    | "unclear_request"
    | "unavailable_item"
    | "missing_required_options"
    | "safety_or_policy"
    | "system_error"
    | "other";
  message?: string;
};

export type AiWaiterStateResult = Record<string, unknown> & {
  tableSession?: Record<string, unknown>;
  session: Record<string, unknown> | null;
  messages: AiWaiterMessageRecord[];
  latestCartProposal?: Record<string, unknown> | null;
  cartSummary?: CartResponse;
  effectiveExperience?: BranchEffectiveExperience | Record<string, unknown>;
};

export type AiWaiterMessagesResult = {
  session: Record<string, unknown> | null;
  filters?: Record<string, unknown>;
  messages: AiWaiterMessageRecord[];
};

export type SendAiWaiterMessageResult = Record<string, unknown> & {
  session?: Record<string, unknown>;
  customerMessage?: AiWaiterMessageRecord;
  assistantMessage?: AiWaiterMessageRecord;
  suggestedActions?: string[];
  cartProposal?: Record<string, unknown> | null;
};

export type AiCartProposalActionResult = Record<string, unknown> & {
  proposal?: Record<string, unknown>;
  cart?: CartResponse | Record<string, unknown>;
};

export type AiWaiterEscalateResult = Record<string, unknown> & {
  session?: Record<string, unknown>;
  waiterCall?: Record<string, unknown>;
};

export type AiWaiterCloseResult = Record<string, unknown> & {
  session?: Record<string, unknown>;
};

export type StaffLoginPayload = {
  email: string;
  password: string;
  branchId?: string;
};

export type StaffLoginResult = {
  accessToken: string;
  expiresAt: string;
  staffUser: StaffUserSummary;
  staffSession: StaffSessionSummary;
  memberships: StaffMembershipSummary[];
  effectivePermissions: string[];
  effectiveAccess: StaffEffectiveAccess;
  defaultBranch: BranchSummary | null;
};

export type StaffAuthContext = {
  staffUser: StaffUserSummary;
  staffSession: StaffSessionSummary;
  staffAccess: StaffEffectiveAccess;
};

export type StaffUserSummary = {
  id: string;
  email: string;
  name: string;
  status: string;
  passwordSetAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffInviteSummary = {
  id: string;
  companyId: string;
  branchId?: string | null;
  staffUserId?: string | null;
  email: string;
  name?: string | null;
  role: TenantOnboardingStaffRole | string;
  status: StaffInviteStatus | string;
  expiresAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  company?: CompanySummary & {
    status?: string;
  };
  branch?: BranchSummary | null;
  staffUser?: StaffUserSummary | null;
};

export type StaffInviteCheckResult = {
  invite: StaffInviteSummary;
  canAccept: boolean;
  staffLoginPath: string;
};

export type AcceptStaffInvitePayload = {
  password: string;
};

export type AcceptStaffInviteResult = {
  invite: StaffInviteSummary;
  staffUser: StaffUserSummary;
  staffLoginPath: string;
};

export type StaffSessionSummary = {
  id: string;
  companyId: string;
  branchId?: string | null;
  staffUserId: string;
  status: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffMembershipSummary = {
  id: string;
  role: string;
  status: string;
  scope: "branch" | "company";
  company: CompanySummary;
  branch: BranchSummary | null;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffEffectiveCompanyAccess = {
  company: CompanySummary;
  branchScope: "all_branches" | "selected_branches";
  roles: string[];
  permissions: string[];
};

export type StaffEffectiveBranchAccess = {
  company: CompanySummary;
  branch: BranchSummary;
  source: "company_membership" | "branch_membership" | "mixed";
  roles: string[];
  permissions: string[];
};

export type StaffEffectiveAccess = {
  companies: StaffEffectiveCompanyAccess[];
  branches: StaffEffectiveBranchAccess[];
  roles: string[];
  permissions: string[];
};

export type CashierOrderStatus =
  | "submitted"
  | "cashier_accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cashier_rejected"
  | "cancelled"
  | "all";

export type CashierOrdersQuery = {
  status?: CashierOrderStatus;
};

export type CashierOrdersResult = {
  branch: BranchSummary;
  status: CashierOrderStatus;
  orders: Record<string, unknown>[];
};

export type OrderLifecycleAction =
  | "accept"
  | "reject"
  | "serve"
  | "complete"
  | "cancel"
  | string;

export type OrderLifecycleSummary = {
  status: string;
  isTerminal: boolean;
  allowedActions: OrderLifecycleAction[];
  blockedReasons: Record<string, string>;
  nextExpectedRole: string;
  progressStep: string;
  customerLabel?: string;
};

export type OrderDetailResult = Record<string, unknown> & {
  order?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  preparationTasks?: Record<string, unknown>[];
  kitchenTickets?: Record<string, unknown>[];
  totals?: Record<string, unknown>;
  lifecycle?: OrderLifecycleSummary;
};

export type CashierAcceptOrderPayload = {
  staffUserId?: string;
};

export type CashierRejectOrderPayload = {
  reason?: string | null;
  staffUserId?: string;
};

export type OrderLifecycleActionPayload = {
  staffUserId?: string;
  note?: string | null;
};

export type CancelOrderPayload = {
  staffUserId?: string;
  reason?: string | null;
};

export type BranchBillRequestStatusFilter =
  | "open"
  | "acknowledged"
  | "presented"
  | "closed"
  | "cancelled"
  | "active"
  | "all";

export type BranchBillRequestsQuery = {
  status?: BranchBillRequestStatusFilter;
  limit?: number;
};

export type BranchBillRequestsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  billRequests: Record<string, unknown>[];
};

export type BillRequestDetailResult = Record<string, unknown> & {
  billRequest?: Record<string, unknown>;
  bill?: Record<string, unknown> | null;
  company?: CompanySummary;
  branch?: BranchSummary;
  tableSession?: Record<string, unknown>;
  events?: Record<string, unknown>[];
  billableOrders?: Record<string, unknown>[];
  totals?: Record<string, unknown>;
};

export type BillRequestActionPayload = {
  staffUserId?: string;
  note?: string;
};

export type CancelBillRequestPayload = {
  staffUserId?: string;
  reason?: string;
};

export type BranchBillStatusFilter =
  | "draft"
  | "requested"
  | "presented"
  | "payment_pending"
  | "paid"
  | "cancelled"
  | "closed"
  | "active"
  | "all";

export type BranchBillsQuery = {
  status?: BranchBillStatusFilter;
  limit?: number;
};

export type BranchBillsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  bills: Record<string, unknown>[];
};

export type BillDetailResult = Record<string, unknown> & {
  bill?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  billRequest?: Record<string, unknown> | null;
  lines?: Record<string, unknown>[];
  manualPayments?: Record<string, unknown>[];
  onlinePaymentIntents?: Record<string, unknown>[];
  onlinePaymentEvents?: Record<string, unknown>[];
  receipt?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
  totals?: Record<string, unknown>;
};

export type BillReceiptResult = Record<string, unknown> & {
  bill?: Record<string, unknown>;
  receipt?: Record<string, unknown>;
  printableText?: string | null;
};

export type RecordManualPaymentPayload = {
  method: "cash" | "card_pos" | "wallet_manual" | "other";
  amountMinor: number;
  reference?: string | null;
  note?: string | null;
};

export type OnlinePaymentProvider =
  | "mock"
  | "paymob"
  | "fawry"
  | "maestr"
  | "external";

export type OnlinePaymentIntentStatus =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

export type CreateOnlinePaymentIntentPayload = {
  idempotencyKey?: string;
  customerReturnUrl?: string;
  billingData?: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  fawryPaymentMethod?: "CARD" | "MWALLET" | "PayAtFawry" | "VALU";
};

export type PaymentProviderCapabilities = {
  hostedCheckout: boolean;
  embeddedCheckout: boolean;
  card: boolean;
  wallet: boolean;
  referenceCode: boolean;
  qr: boolean;
  deepLink: boolean;
  inquiry: boolean;
  refund: boolean;
  partialRefund: boolean;
  void: boolean;
  capture: boolean;
  settlementImport: boolean;
  providerReconciliation: boolean;
  directTerminal: boolean;
  recurringBilling: boolean;
};

export type CustomerPaymentCapabilities = {
  provider: OnlinePaymentProvider;
  environment: "sandbox" | "test" | "live";
  status: "ready";
  enabledChannels: string[];
  requiresBillingData: boolean;
  capabilities: PaymentProviderCapabilities;
  hostedMethods: string[];
  liveVerified: boolean;
};

export type MerchantPaymentIntegration = {
  id: string;
  companyId: string;
  branchId?: string | null;
  provider: OnlinePaymentProvider;
  environment: "sandbox" | "test" | "live";
  status: "draft" | "needs_setup" | "ready" | "blocked" | "disabled";
  priority: number;
  merchantAccountReference?: string | null;
  enabledChannels: string[];
  configurationMetadata?: Record<string, unknown>;
  secretReferenceKeys: string[];
  readinessMessage?: string | null;
  webhookConfigured: boolean;
  webhookVerifiedAt?: string | null;
  recoveryReady: boolean;
  settlementConfigured: boolean;
  liveVerifiedAt?: string | null;
  lastValidatedAt?: string | null;
  capabilities: PaymentProviderCapabilities;
};

export type MerchantPaymentIntegrationsResult = {
  branch: BranchSummary;
  integrations: MerchantPaymentIntegration[];
  effective?: Record<string, unknown> | null;
};

export type UpsertMerchantPaymentIntegrationPayload = {
  scope: "company" | "branch";
  provider: "paymob" | "fawry" | "maestr" | "external";
  environment: "sandbox" | "test" | "live";
  status: "draft" | "needs_setup" | "ready" | "blocked" | "disabled";
  priority?: number;
  merchantAccountReference?: string;
  enabledChannels: string[];
  configurationMetadata?: Record<string, unknown>;
  secretReferences?: Record<string, string>;
  readinessMessage?: string;
  webhookConfigured: boolean;
  recoveryReady: boolean;
  settlementConfigured: boolean;
};

export type OnlinePaymentIntentResult = Record<string, unknown> & {
  outcome?: string;
  onlinePaymentIntent?: Record<string, unknown>;
  checkout?: {
    provider?: OnlinePaymentProvider;
    url?: string | null;
    expiresAt?: string | null;
    requiresHostedCheckout?: boolean;
  } | null;
  settlement?: {
    settled?: boolean;
    reason?: string;
    message?: string;
  };
  bill?: Record<string, unknown> | null;
};

export type BranchOnlinePaymentStatusFilter =
  | OnlinePaymentIntentStatus
  | "active"
  | "all";

export type BranchOnlinePaymentsQuery = {
  status?: BranchOnlinePaymentStatusFilter;
  provider?: OnlinePaymentProvider | "all";
  limit?: number;
};

export type BranchOnlinePaymentsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  onlinePaymentIntents: Record<string, unknown>[];
};

export type SaasPlanStatus = "active" | "inactive" | "archived";

export type CompanySubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

export type SaasPlan = {
  id: string;
  code: string;
  name: string;
  status: SaasPlanStatus | string;
  description?: string | null;
  monthlyPriceMinor?: number | null;
  currency: string;
  maxBranches?: number | null;
  maxTables?: number | null;
  maxStaffUsers?: number | null;
  maxMenuItems?: number | null;
  maxInventoryItems?: number | null;
  maxAiMessagesPerMonth?: number | null;
  setupEnabled: boolean;
  kdsEnabled: boolean;
  inventoryEnabled: boolean;
  onlinePaymentsEnabled: boolean;
  ownerAnalyticsEnabled: boolean;
  aiWaiterEnabled: boolean;
  multiBranchEnabled: boolean;
  advancedReportsEnabled: boolean;
  sortOrder: number;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type CompanySubscription = {
  id: string;
  companyId: string;
  planId: string;
  status: CompanySubscriptionStatus | string;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  trialEndsAt?: string | null;
  suspendedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

export type SaasUsageStatus = "ok" | "warning" | "exceeded" | "unlimited";

export type SaasUsageMetric = {
  key: string;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  status: SaasUsageStatus | string;
};

export type SaasEntitlements = {
  setup: boolean;
  kds: boolean;
  inventory: boolean;
  onlinePayments: boolean;
  ownerAnalytics: boolean;
  aiWaiter: boolean;
  multiBranch: boolean;
  advancedReports: boolean;
};

export type SaasStatusNotice = {
  code: string;
  message: string;
  severity: "warning" | "blocker" | string;
  metricKey?: string;
};

export type SaasStatusResult = {
  company: CompanySummary;
  branch?: BranchSummary | null;
  subscription: CompanySubscription | null;
  plan: SaasPlan | null;
  entitlements: SaasEntitlements;
  usage: Record<string, SaasUsageMetric>;
  limits: Record<string, number | null>;
  warnings: SaasStatusNotice[];
  blockers: SaasStatusNotice[];
};

export type PlatformAdminRole = "owner" | "admin" | "support";
export type PlatformAdminStatus = "active" | "disabled";

export type PlatformAdminUser = {
  id: string;
  email: string;
  name: string;
  role: PlatformAdminRole | string;
  status: PlatformAdminStatus | string;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformAdminSession = {
  id: string;
  platformAdminUserId: string;
  status: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PlatformAuthContext = {
  platformAdminUser: PlatformAdminUser;
  platformAdminSession: PlatformAdminSession;
};

export type PlatformAuthResponse = PlatformAuthContext & {
  accessToken: string;
  expiresAt: string;
};

export type PlatformLoginPayload = {
  email: string;
  password: string;
};

export type PlatformCompanySummary = CompanySummary & {
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  subscription: (CompanySubscription & { plan?: SaasPlan }) | null;
  branchCount: number;
  staffMembershipCount: number;
};

export type PlatformCompaniesResult = {
  companies: PlatformCompanySummary[];
  summary: {
    totalCompanies: number;
    activeSubscriptions: number;
    trialingSubscriptions: number;
    suspendedSubscriptions: number;
  };
};

export type PlatformOwnerAssignment = {
  id: string;
  staffUserId: string;
  companyId: string;
  branchId?: string | null;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  staffUser: StaffUserSummary & {
    passwordSetAt?: string | null;
  };
  recentInvite?: StaffInviteSummary | null;
};

export type PlatformAuditEventSummary = {
  id: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  platformAdminUser?: Pick<PlatformAdminUser, "id" | "email" | "name" | "role"> | null;
};

export type PlatformCompanyDetail = {
  company: CompanySummary & {
    status?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  subscription: CompanySubscription | null;
  plan: SaasPlan | null;
  branches: Array<
    BranchSummary & {
      status?: string;
      createdAt?: string;
      updatedAt?: string;
      floorsCount: number;
      tablesCount: number;
    }
  >;
  owners: PlatformOwnerAssignment[];
  saas: SaasStatusResult;
  auditEvents: PlatformAuditEventSummary[];
};

export type CreatePlatformStaffInvitePayload = {
  email: string;
  name: string;
  role: TenantOnboardingStaffRole;
  branchId?: string | null;
};

export type CreatePlatformStaffInviteResult = {
  company: CompanySummary;
  branch?: BranchSummary | null;
  staffUser: StaffUserSummary;
  membership: PlatformOwnerAssignment;
  createdStaffUser: boolean;
  createdMembership: boolean;
  invite: StaffInviteSummary;
  inviteToken: string;
  invitePath: string;
  passwordSetup: {
    required: boolean;
    nextStep: string;
  };
};

export type BootstrapCompanyInput = {
  company: {
    name: string;
    slug: string;
  };
  owner: {
    name: string;
    email: string;
  };
  branch: {
    name: string;
    slug: string;
    address?: string | null;
  };
  subscription: {
    planCode: "pilot" | "starter" | "growth" | "enterprise";
    status?: "trialing" | "active";
  };
  starterTables?: {
    enabled: boolean;
    floorLabel: string;
    tablePrefix: string;
    startNumber: number;
    count: number;
    seats: number;
  };
};

export type BootstrapCompanyResult = {
  company: PlatformCompanyDetail["company"];
  branch: BranchSummary;
  subscription: CompanySubscription & {
    plan?: SaasPlan;
  };
  plan: SaasPlan;
  ownerStaffUser: StaffUserSummary & {
    passwordSetAt?: string | null;
  };
  ownerMembership: PlatformOwnerAssignment;
  starterTables: {
    floor: TenantOnboardingFloor;
    created: TenantOnboardingTable[];
    skipped: Array<{
      code: string;
      displayName: string;
      reason: string;
      table?: TenantOnboardingTable;
    }>;
    requestedCount: number;
    createdCount: number;
    skippedCount: number;
  } | null;
  companyId: string;
  branchId: string;
  ownerStaffUserId: string;
  setupUrl: string;
  billingUrl: string;
  staffLoginUrl: string;
  customerQrExamples: Array<{
    tableId: string;
    code: string;
    qrToken: string;
    customerUrl: string;
  }>;
  passwordSetup: {
    ownerEmail: string;
    passwordAlreadySet: boolean;
    nextStep: string;
  };
};

export type UpdatePlatformSubscriptionPayload = {
  planCode?: "pilot" | "starter" | "growth" | "enterprise";
  status?: "trialing" | "active" | "past_due" | "suspended" | "cancelled";
  cancellationReason?: string | null;
};

export type UpdatePlatformSubscriptionResult = {
  company: CompanySummary;
  subscription: CompanySubscription & {
    plan?: SaasPlan;
  };
  plan: SaasPlan;
  saas: SaasStatusResult;
};

export type SaasPlansResult = {
  plans: SaasPlan[];
};

export type CashierShiftStatusFilter = "open" | "closed" | "all";

export type CashierShiftRecord = Record<string, unknown> & {
  id: string;
  companyId: string;
  branchId: string;
  openedByStaffUserId: string;
  closedByStaffUserId?: string | null;
  status: "open" | "closed" | string;
  currency: string;
  openingFloatMinor: number;
  expectedCashMinor: number;
  countedCashMinor?: number | null;
  cashOverShortMinor?: number | null;
  cashSalesMinor: number;
  cardSalesMinor: number;
  walletSalesMinor: number;
  otherSalesMinor: number;
  paymentCount: number;
  billCount: number;
  openedAt: string;
  closedAt?: string | null;
  openingNote?: string | null;
  closingNote?: string | null;
  zReportNumber?: string | null;
};

export type CashDrawerTransactionRecord = Record<string, unknown> & {
  id: string;
  companyId: string;
  branchId: string;
  cashierShiftId: string;
  staffUserId?: string | null;
  type:
    | "opening_float"
    | "cash_payment"
    | "cash_in"
    | "cash_out"
    | "correction";
  signedAmountMinor: number;
  currency: string;
  sourceType?: "manual_payment" | "adjustment" | "opening_float" | null;
  sourceId?: string | null;
  note?: string | null;
  createdAt: string;
};

export type CashierShiftReportSnapshot = Record<string, unknown> & {
  reportType?: "x_report" | "z_report" | string;
  reportNumber?: string | null;
  generatedAt?: string;
  shift?: Record<string, unknown>;
  cashDrawer?: Record<string, unknown>;
  tenderTotals?: Record<string, unknown>;
  counts?: Record<string, unknown>;
  operational?: Record<string, unknown>;
};

export type CashierShiftReportRecord = Record<string, unknown> & {
  id: string;
  companyId: string;
  branchId: string;
  cashierShiftId: string;
  generatedByStaffUserId?: string | null;
  type: "x_report" | "z_report" | string;
  reportNumber: string;
  snapshot: CashierShiftReportSnapshot;
  generatedAt: string;
  createdAt: string;
};

export type CurrentCashierShiftResult = {
  branch: BranchSummary;
  shift: CashierShiftRecord | null;
  summary: CashierShiftReportSnapshot | null;
};

export type BranchCashierShiftsQuery = {
  status?: CashierShiftStatusFilter;
  limit?: number;
};

export type BranchCashierShiftsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  shifts: CashierShiftRecord[];
};

export type CashierShiftDetailResult = {
  shift: CashierShiftRecord;
  company: CompanySummary;
  branch: BranchSummary;
  drawerTransactions: CashDrawerTransactionRecord[];
  reports: CashierShiftReportRecord[];
  summary: CashierShiftReportSnapshot;
};

export type OpenCashierShiftPayload = {
  openingFloatMinor: number;
  note?: string | null;
};

export type CreateCashAdjustmentPayload = {
  type: "cash_in" | "cash_out" | "correction";
  amountMinor: number;
  note: string;
};

export type CloseCashierShiftPayload = {
  countedCashMinor: number;
  note?: string | null;
};

export type CashierShiftReportResult = {
  shift: CashierShiftRecord;
  report: CashierShiftReportRecord;
  snapshot: CashierShiftReportSnapshot;
};

export type CancelBillPayload = {
  staffUserId?: string;
  reason?: string;
};

export type BranchRealtimeChannel =
  | "all"
  | "orders"
  | "preparation"
  | "waiter_calls"
  | "notifications";

export type BranchRealtimeEventsQuery = {
  channel?: BranchRealtimeChannel;
  type?: string;
  limit?: number;
};

export type BranchRealtimeEventsResult = {
  branch?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  events: Record<string, unknown>[];
};

export type PreparationStation =
  | "barista"
  | "kitchen"
  | "dessert"
  | "all"
  | string;

export type PreparationTaskStatus =
  | "pending"
  | "preparing"
  | "ready"
  | "cancelled"
  | "all"
  | string;

export type BranchPreparationTasksQuery = {
  station?: PreparationStation;
  status?: PreparationTaskStatus;
};

export type BranchPreparationTasksResult = {
  branch: BranchSummary;
  station: PreparationStation;
  status: PreparationTaskStatus;
  tasks: Record<string, unknown>[];
};

export type OrderPreparationTasksResult = Record<string, unknown> & {
  order?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  tasks: Record<string, unknown>[];
};

export type PreparationTaskDetailResult = Record<string, unknown> & {
  task?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  order?: Record<string, unknown>;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  orderItem?: Record<string, unknown>;
  modifierOptions?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
};

export type PreparationTaskActionPayload = {
  staffUserId?: string;
  note?: string;
};

export type KitchenTicketStatus =
  | "queued"
  | "in_progress"
  | "ready"
  | "served"
  | "cancelled"
  | "voided"
  | "all"
  | string;

export type KitchenTicketType =
  | "kitchen_order"
  | "barista_order"
  | "dessert_order"
  | "receipt"
  | "void"
  | "reprint"
  | "all"
  | string;

export type BranchKitchenTicketsQuery = {
  station?: PreparationStation;
  status?: KitchenTicketStatus;
  type?: KitchenTicketType;
  limit?: number;
};

export type BranchKitchenTicketsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  tickets: Record<string, unknown>[];
};

export type KitchenTicketDetailResult = Record<string, unknown> & {
  ticket?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  order?: Record<string, unknown>;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  items?: Record<string, unknown>[];
  printJobs?: Record<string, unknown>[];
  lifecycle?: Record<string, unknown>;
};

export type ReprintKitchenTicketPayload = {
  reason?: string | null;
};

export type PrintJobStatus =
  | "pending"
  | "printing"
  | "printed"
  | "failed"
  | "cancelled"
  | "reprint_requested"
  | "all"
  | string;

export type PrintJobKind =
  | "kitchen_ticket"
  | "barista_ticket"
  | "dessert_ticket"
  | "receipt"
  | "void_ticket"
  | "all"
  | string;

export type BranchPrintJobsQuery = {
  station?: PreparationStation;
  status?: PrintJobStatus;
  kind?: PrintJobKind;
  limit?: number;
};

export type BranchPrintJobsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  printJobs: Record<string, unknown>[];
};

export type PrintJobDetailResult = Record<string, unknown> & {
  printJob?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  printerStation?: Record<string, unknown> | null;
  kitchenTicket?: Record<string, unknown> | null;
  order?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
};

export type MarkPrintJobFailedPayload = {
  errorMessage?: string | null;
};

export type PrinterStationResult = {
  printerStation: Record<string, unknown>;
};

export type BranchPrinterStationsResult = {
  branch: BranchSummary;
  printerStations: Record<string, unknown>[];
};

export type CancelPreparationTaskPayload = {
  staffUserId?: string;
  reason?: string | null;
};

export type WaiterCallStatus =
  | "open"
  | "acknowledged"
  | "resolved"
  | "cancelled"
  | "all"
  | string;

export type WaiterCallType =
  | "call_waiter"
  | "need_bill"
  | "need_water"
  | "need_help"
  | "order_problem"
  | "clean_table"
  | "other"
  | "all"
  | string;

export type WaiterCallsQuery = {
  status?: WaiterCallStatus;
  type?: WaiterCallType;
};

export type BranchWaiterCallsResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  waiterCalls: Record<string, unknown>[];
};

export type WaiterCallDetailResult = Record<string, unknown> & {
  waiterCall?: Record<string, unknown>;
  company?: CompanySummary;
  branch?: BranchSummary;
  tableSession?: Record<string, unknown>;
  floor?: Record<string, unknown> | null;
  table?: Record<string, unknown>;
  order?: Record<string, unknown> | null;
  events?: Record<string, unknown>[];
};

export type WaiterCallStaffActionPayload = {
  staffUserId?: string;
};

export type ResolveWaiterCallPayload = {
  staffUserId?: string;
  resolutionNote?: string | null;
};

export type CancelWaiterCallPayload = {
  reason?: string | null;
};

export type TableAttentionStatus =
  | "normal"
  | "needs_attention"
  | "urgent"
  | "resolved"
  | "muted"
  | "all"
  | string;

export type TableAttentionPriority =
  | "low"
  | "medium"
  | "high"
  | "urgent"
  | "all"
  | string;

export type AttentionQuery = {
  status?: TableAttentionStatus;
  priority?: TableAttentionPriority;
  limit?: number;
};

export type BranchAttentionQueueResult = {
  branch: BranchSummary;
  filters?: Record<string, unknown>;
  attentionQueue: Record<string, unknown>[];
};

export type TableSessionAttentionResult = Record<string, unknown> & {
  tableSession?: Record<string, unknown>;
  attention?: Record<string, unknown>;
};

export type RebuildBranchAttentionResult = {
  branch: BranchSummary;
  activeSessionCount: number;
  attentionQueue: Record<string, unknown>[];
};

export type ResolveAttentionPayload = {
  staffUserId?: string;
  note?: string | null;
};

export type MuteAttentionPayload = {
  staffUserId?: string;
  minutes?: number;
  note?: string | null;
};

export type RecalculateAttentionPayload = {
  source?: string;
  metadata?: Record<string, unknown>;
};
