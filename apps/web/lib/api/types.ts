export type ApiQueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number | boolean | null | undefined)[];

export type ApiQueryParams = Record<string, ApiQueryValue>;

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

export type MenuAdminCategory = MenuCategorySummary & {
  companyId: string;
  createdAt?: string;
  updatedAt?: string;
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
  totals?: CartTotals | Record<string, unknown>;
};

export type AiWaiterLanguage = "en" | "ar-EG";

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
  messages: Record<string, unknown>[];
  latestCartProposal?: Record<string, unknown> | null;
  cartSummary?: CartResponse;
  effectiveExperience?: BranchEffectiveExperience | Record<string, unknown>;
};

export type AiWaiterMessagesResult = {
  session: Record<string, unknown> | null;
  filters?: Record<string, unknown>;
  messages: Record<string, unknown>[];
};

export type SendAiWaiterMessageResult = Record<string, unknown> & {
  session?: Record<string, unknown>;
  customerMessage?: Record<string, unknown>;
  assistantMessage?: Record<string, unknown>;
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
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
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
  totals?: Record<string, unknown>;
};

export type CashierAcceptOrderPayload = {
  staffUserId?: string;
};

export type CashierRejectOrderPayload = {
  reason?: string | null;
  staffUserId?: string;
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

export type PreparationStation = "barista" | "kitchen" | "dessert" | "all" | string;

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
