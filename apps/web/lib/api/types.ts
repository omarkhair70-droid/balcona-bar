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
