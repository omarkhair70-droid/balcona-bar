import { apiRequest } from "./client";
import type {
  AddCartItemPayload,
  AcceptStaffInvitePayload,
  AcceptStaffInviteResult,
  AiCartProposalActionResult,
  AiWaiterCloseResult,
  AiWaiterEscalateResult,
  AiWaiterMessagesResult,
  AiWaiterStateResult,
  AttentionQuery,
  BillRequestActionPayload,
  BillRequestDetailResult,
  BillResult,
  BillDetailResult,
  BillReceiptResult,
  BranchAttentionQueueResult,
  BranchEffectiveExperience,
  BranchLaunchChecklistResult,
  BranchBillsQuery,
  BranchBillsResult,
  BranchBillRequestsQuery,
  BranchBillRequestsResult,
  BranchOnboardingResult,
  BranchCashierShiftsQuery,
  BranchCashierShiftsResult,
  BranchInventoryAlertsResult,
  BranchInventoryLevelsResult,
  BranchInventoryMenuAvailabilityResult,
  BranchAdminOverviewResult,
  BranchKitchenTicketsQuery,
  BranchKitchenTicketsResult,
  BranchMenuResult,
  BranchOnlinePaymentsQuery,
  BranchOnlinePaymentsResult,
  BranchPrintJobsQuery,
  BranchPrintJobsResult,
  BranchPrinterStationsResult,
  BranchPreparationTasksQuery,
  BranchPreparationTasksResult,
  BranchRealtimeEventsQuery,
  BranchRealtimeEventsResult,
  BranchWaiterCallsResult,
  CancelBillRequestPayload,
  CancelBillPayload,
  CancelPreparationTaskPayload,
  CancelWaiterCallPayload,
  BulkCreateOnboardingTablesPayload,
  BulkCreateOnboardingTablesResult,
  CartResponse,
  CartValidationResult,
  CashierAcceptOrderPayload,
  CashierShiftDetailResult,
  CashierShiftReportResult,
  CashierOrdersQuery,
  CashierOrdersResult,
  CashierRejectOrderPayload,
  CancelOrderPayload,
  CloseCashierShiftPayload,
  CompanySummary,
  CompanyOnboardingResult,
  BranchMutationResult,
  CreateMenuCategoryPayload,
  CreateMenuCategoryResult,
  CreateMenuItemModifierGroupPayload,
  CreateMenuItemModifierGroupResult,
  CreateMenuItemPayload,
  CreateMenuItemResult,
  CreateOnlinePaymentIntentPayload,
  CreateModifierGroupPayload,
  CreateModifierGroupResult,
  CreateModifierOptionPayload,
  CreateBranchPayload,
  CreateCashAdjustmentPayload,
  CreateDemoRequestPayload,
  CreateDemoRequestResult,
  CreatePlatformStaffInvitePayload,
  CreatePlatformStaffInviteResult,
  CreateOnboardingFloorPayload,
  CreateOnboardingFloorResult,
  CreateBranchResult,
  CreateFloorPayload,
  CreateFloorResult,
  CreateInventoryItemPayload,
  CreatePurchaseOrderLinePayload,
  CreatePurchaseOrderPayload,
  CreateSupplierPayload,
  CreateTablePayload,
  CreateTableResult,
  CreateModifierOptionResult,
  CustomerStatusResult,
  CustomerPaymentCapabilities,
  CurrentCashierShiftResult,
  CustomerTimelineResult,
  DemoRequest,
  DemoRequestsResult,
  DeleteBranchMenuItemOverrideResult,
  DeleteMenuItemModifierGroupResult,
  EscalateAiWaiterPayload,
  ListAiWaiterMessagesQuery,
  MenuCategoryMutationResult,
  MenuAdminOverviewResult,
  MenuItemMutationResult,
  MerchantPaymentIntegration,
  MerchantPaymentIntegrationsResult,
  MenuItemDetailResult,
  ModifierGroupMutationResult,
  ModifierOptionMutationResult,
  MarkPrintJobFailedPayload,
  KitchenTicketDetailResult,
  MuteAttentionPayload,
  OrderDetailResult,
  OnlinePaymentIntentResult,
  OrderLifecycleActionPayload,
  OwnerAnalyticsAiWaiterResult,
  OwnerAnalyticsCashierShiftsResult,
  OwnerAnalyticsDailyReportResult,
  OwnerAnalyticsDashboardResult,
  OwnerAnalyticsItemsResult,
  OwnerAnalyticsOperationsResult,
  OwnerAnalyticsOrdersResult,
  OwnerAnalyticsQuery,
  OwnerAnalyticsSalesResult,
  OwnerAnalyticsSummaryResult,
  PlatformAuthContext,
  PlatformAuthResponse,
  PlatformCompaniesResult,
  PlatformCompanyDetail,
  PlatformLoginPayload,
  UpsertMerchantPaymentIntegrationPayload,
  OrderPreparationTasksResult,
  OpenCashierShiftPayload,
  BootstrapCompanyInput,
  BootstrapCompanyResult,
  PreparationTaskActionPayload,
  PreparationTaskDetailResult,
  PrintJobDetailResult,
  QrTokenMutationResult,
  RebuildBranchAttentionResult,
  RecalculateAttentionPayload,
  RecordManualPaymentPayload,
  RejectAiCartProposalPayload,
  ReprintKitchenTicketPayload,
  RequestBillPayload,
  FloorMutationResult,
  ResolveAttentionPayload,
  ResolveWaiterCallPayload,
  SaasPlansResult,
  SaasStatusResult,
  SendAiWaiterMessagePayload,
  SendAiWaiterMessageResult,
  StaffAuthContext,
  StaffInviteCheckResult,
  StaffLoginPayload,
  StaffLoginResult,
  SessionOrdersResult,
  StartAiWaiterPayload,
  StartTableSessionPayload,
  StartTableSessionResult,
  SystemInfoResult,
  SubmitCartPayload,
  SubmitCartResult,
  InviteOnboardingStaffPayload,
  InviteOnboardingStaffResult,
  InventoryItemMutationResult,
  InventoryItemsResult,
  InventoryReceiptsResult,
  UpdateBranchOnboardingProfilePayload,
  UpdateBranchOnboardingProfileResult,
  UpdateCompanyOnboardingProfilePayload,
  UpdateCompanyOnboardingProfileResult,
  UpdateMenuCategoryPayload,
  UpdateMenuItemPayload,
  UpdateModifierGroupPayload,
  UpdateModifierOptionPayload,
  UpdatePlatformSubscriptionPayload,
  UpdatePlatformSubscriptionResult,
  UpdateBranchPayload,
  UpdateFloorPayload,
  UpdateInventoryItemPayload,
  UpdateDemoRequestPayload,
  UpdatePurchaseOrderLinePayload,
  UpdatePurchaseOrderPayload,
  UpdateSupplierPayload,
  UpdateTablePayload,
  TableSessionAttentionResult,
  TableMutationResult,
  UpdateCartItemPayload,
  UpdateReadinessCheckPayload,
  UpdateReadinessCheckResult,
  UpsertBranchMenuItemOverrideResult,
  UpsertBranchMenuItemOverridePayload,
  AdjustInventoryLevelPayload,
  AdjustInventoryLevelResult,
  MenuItemInventoryRequirementsResult,
  PurchaseOrderMutationResult,
  PurchaseOrderResult,
  PurchaseOrdersResult,
  ReceivePurchaseOrderPayload,
  ReceivePurchaseOrderResult,
  ReplaceMenuItemInventoryRequirementsPayload,
  SupplierMutationResult,
  SuppliersResult,
  WaiterCallDetailResult,
  WaiterCallPayload,
  WaiterCallStaffActionPayload,
  WaiterCallsQuery,
  WaiterCallsResult,
} from "./types";

type TableSessionStartOptions = {
  signal?: AbortSignal;
  timeoutMs?: number;
};

type CustomerMutationOptions = {
  timeoutMs?: number;
  flowId?: string;
  attempt?: number;
};

export function getCompanies() {
  return apiRequest<CompanySummary[]>("/companies");
}

export function getSystemInfo() {
  return apiRequest<SystemInfoResult>("/system/info", {
    timeoutMs: 8_000,
  });
}

export function createDemoRequest(payload: CreateDemoRequestPayload) {
  return apiRequest<CreateDemoRequestResult, CreateDemoRequestPayload>(
    "/public/demo-requests",
    {
      method: "POST",
      body: payload,
      timeoutMs: 10_000,
    },
  );
}

export function platformLogin(payload: PlatformLoginPayload) {
  return apiRequest<PlatformAuthResponse, PlatformLoginPayload>(
    "/platform-auth/login",
    {
      method: "POST",
      body: payload,
    },
  );
}

export function getPlatformMe(token: string) {
  return apiRequest<PlatformAuthContext>("/platform-auth/me", {
    token,
  });
}

export function getPlatformPlans(token: string) {
  return apiRequest<SaasPlansResult>("/platform/plans", {
    token,
  });
}

export function getPlatformDemoRequests(
  token: string,
  query?: { status?: string; search?: string; limit?: number },
) {
  return apiRequest<DemoRequestsResult>("/platform/demo-requests", {
    token,
    query,
  });
}

export function updatePlatformDemoRequest(
  id: string,
  payload: UpdateDemoRequestPayload,
  token: string,
) {
  return apiRequest<DemoRequest, UpdateDemoRequestPayload>(
    `/platform/demo-requests/${id}`,
    { method: "PATCH", body: payload, token },
  );
}

export function getPlatformCompanies(token: string) {
  return apiRequest<PlatformCompaniesResult>("/platform/companies", {
    token,
  });
}

export function getPlatformCompany(companyId: string, token: string) {
  return apiRequest<PlatformCompanyDetail>(
    `/platform/companies/${companyId}`,
    { token },
  );
}

export function bootstrapPlatformCompany(
  payload: BootstrapCompanyInput,
  token: string,
) {
  return apiRequest<BootstrapCompanyResult, BootstrapCompanyInput>(
    "/platform/companies/bootstrap",
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updatePlatformCompanySubscription(
  companyId: string,
  payload: UpdatePlatformSubscriptionPayload,
  token: string,
) {
  return apiRequest<
    UpdatePlatformSubscriptionResult,
    UpdatePlatformSubscriptionPayload
  >(`/platform/companies/${companyId}/subscription`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function createPlatformStaffInvite(
  companyId: string,
  payload: CreatePlatformStaffInvitePayload,
  token: string,
) {
  return apiRequest<
    CreatePlatformStaffInviteResult,
    CreatePlatformStaffInvitePayload
  >(`/platform/companies/${companyId}/staff/invites`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function getStaffInvite(inviteToken: string) {
  return apiRequest<StaffInviteCheckResult>(
    `/staff-auth/invites/${encodeURIComponent(inviteToken)}`,
    {
      timeoutMs: 10_000,
    },
  );
}

export function acceptStaffInvite(
  inviteToken: string,
  payload: AcceptStaffInvitePayload,
) {
  return apiRequest<AcceptStaffInviteResult, AcceptStaffInvitePayload>(
    `/staff-auth/invites/${encodeURIComponent(inviteToken)}/accept`,
    {
      method: "POST",
      body: payload,
      timeoutMs: 10_000,
    },
  );
}

export function getBranchEffectiveExperience(branchId: string) {
  return apiRequest<BranchEffectiveExperience>(
    `/branches/${branchId}/experience/effective`,
  );
}

export function getCompanyOnboarding(companyId: string, token?: string) {
  return apiRequest<CompanyOnboardingResult>(
    `/companies/${companyId}/onboarding`,
    { token },
  );
}

export function updateCompanyOnboardingProfile(
  companyId: string,
  payload: UpdateCompanyOnboardingProfilePayload,
  token?: string,
) {
  return apiRequest<
    UpdateCompanyOnboardingProfileResult,
    UpdateCompanyOnboardingProfilePayload
  >(`/companies/${companyId}/onboarding/profile`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function getBranchOnboarding(branchId: string, token?: string) {
  return apiRequest<BranchOnboardingResult>(
    `/branches/${branchId}/onboarding`,
    { token },
  );
}

export function updateBranchOnboardingProfile(
  branchId: string,
  payload: UpdateBranchOnboardingProfilePayload,
  token?: string,
) {
  return apiRequest<
    UpdateBranchOnboardingProfileResult,
    UpdateBranchOnboardingProfilePayload
  >(`/branches/${branchId}/onboarding/profile`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function createOnboardingFloor(
  branchId: string,
  payload: CreateOnboardingFloorPayload,
  token?: string,
) {
  return apiRequest<CreateOnboardingFloorResult, CreateOnboardingFloorPayload>(
    `/branches/${branchId}/onboarding/floors`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function bulkCreateOnboardingTables(
  branchId: string,
  payload: BulkCreateOnboardingTablesPayload,
  token?: string,
) {
  return apiRequest<
    BulkCreateOnboardingTablesResult,
    BulkCreateOnboardingTablesPayload
  >(`/branches/${branchId}/onboarding/tables/bulk`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function inviteOnboardingStaff(
  branchId: string,
  payload: InviteOnboardingStaffPayload,
  token?: string,
) {
  return apiRequest<InviteOnboardingStaffResult, InviteOnboardingStaffPayload>(
    `/branches/${branchId}/onboarding/staff/invite`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateOnboardingReadinessCheck(
  branchId: string,
  payload: UpdateReadinessCheckPayload,
  token?: string,
) {
  return apiRequest<UpdateReadinessCheckResult, UpdateReadinessCheckPayload>(
    `/branches/${branchId}/onboarding/readiness-checks`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBranchLaunchChecklist(branchId: string, token?: string) {
  return apiRequest<BranchLaunchChecklistResult>(
    `/branches/${branchId}/onboarding/launch-checklist`,
    { token },
  );
}

export function getOwnerAnalyticsSummary(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsSummaryResult>(
    `/branches/${branchId}/owner-analytics/summary`,
    { query, token },
  );
}

export function getOwnerAnalyticsSales(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsSalesResult>(
    `/branches/${branchId}/owner-analytics/sales`,
    { query, token },
  );
}

export function getOwnerAnalyticsOrders(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsOrdersResult>(
    `/branches/${branchId}/owner-analytics/orders`,
    { query, token },
  );
}

export function getOwnerAnalyticsItems(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsItemsResult>(
    `/branches/${branchId}/owner-analytics/items`,
    { query, token },
  );
}

export function getOwnerAnalyticsOperations(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsOperationsResult>(
    `/branches/${branchId}/owner-analytics/operations`,
    { query, token },
  );
}

export function getOwnerAnalyticsCashierShifts(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsCashierShiftsResult>(
    `/branches/${branchId}/owner-analytics/cashier-shifts`,
    { query, token },
  );
}

export function getOwnerAnalyticsAiWaiter(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsAiWaiterResult>(
    `/branches/${branchId}/owner-analytics/ai-waiter`,
    { query, token },
  );
}

export function getOwnerAnalyticsDashboard(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsDashboardResult>(
    `/branches/${branchId}/owner-analytics/dashboard`,
    { query, token },
  );
}

export function getOwnerDailyReport(
  branchId: string,
  query: OwnerAnalyticsQuery = {},
  token?: string,
) {
  return apiRequest<OwnerAnalyticsDailyReportResult>(
    `/branches/${branchId}/owner-analytics/daily-report`,
    { query, token },
  );
}

export function getBranchMenu(branchId: string, token?: string) {
  return apiRequest<BranchMenuResult>(`/branches/${branchId}/menu`, { token });
}

export function getInventoryItems(companyId: string, token?: string) {
  return apiRequest<InventoryItemsResult>(
    `/companies/${companyId}/inventory/items`,
    { token },
  );
}

export function createInventoryItem(
  companyId: string,
  payload: CreateInventoryItemPayload,
  token?: string,
) {
  return apiRequest<InventoryItemMutationResult, CreateInventoryItemPayload>(
    `/companies/${companyId}/inventory/items`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateInventoryItem(
  inventoryItemId: string,
  payload: UpdateInventoryItemPayload,
  token?: string,
) {
  return apiRequest<InventoryItemMutationResult, UpdateInventoryItemPayload>(
    `/inventory/items/${inventoryItemId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function getBranchInventoryLevels(branchId: string, token?: string) {
  return apiRequest<BranchInventoryLevelsResult>(
    `/branches/${branchId}/inventory/levels`,
    { token },
  );
}

export function getBranchInventoryAlerts(branchId: string, token?: string) {
  return apiRequest<BranchInventoryAlertsResult>(
    `/branches/${branchId}/inventory/alerts`,
    { token },
  );
}

export function adjustBranchInventoryLevel(
  branchId: string,
  inventoryItemId: string,
  payload: AdjustInventoryLevelPayload,
  token?: string,
) {
  return apiRequest<AdjustInventoryLevelResult, AdjustInventoryLevelPayload>(
    `/branches/${branchId}/inventory/levels/${inventoryItemId}/adjust`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getMenuItemInventoryRequirements(
  menuItemId: string,
  token?: string,
) {
  return apiRequest<MenuItemInventoryRequirementsResult>(
    `/menu-items/${menuItemId}/inventory-requirements`,
    { token },
  );
}

export function updateMenuItemInventoryRequirements(
  menuItemId: string,
  payload: ReplaceMenuItemInventoryRequirementsPayload,
  token?: string,
) {
  return apiRequest<
    MenuItemInventoryRequirementsResult,
    ReplaceMenuItemInventoryRequirementsPayload
  >(`/menu-items/${menuItemId}/inventory-requirements`, {
    method: "PUT",
    body: payload,
    token,
  });
}

export function getBranchInventoryMenuAvailability(
  branchId: string,
  token?: string,
) {
  return apiRequest<BranchInventoryMenuAvailabilityResult>(
    `/branches/${branchId}/inventory/menu-availability`,
    { token },
  );
}

export function getSuppliers(companyId: string, token?: string) {
  return apiRequest<SuppliersResult>(`/companies/${companyId}/suppliers`, {
    token,
  });
}

export function getBranchSuppliers(branchId: string, token?: string) {
  return apiRequest<SuppliersResult>(`/branches/${branchId}/suppliers`, {
    token,
  });
}

export function createSupplier(
  companyId: string,
  payload: CreateSupplierPayload,
  token?: string,
) {
  return apiRequest<SupplierMutationResult, CreateSupplierPayload>(
    `/companies/${companyId}/suppliers`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateSupplier(
  supplierId: string,
  payload: UpdateSupplierPayload,
  token?: string,
) {
  return apiRequest<SupplierMutationResult, UpdateSupplierPayload>(
    `/suppliers/${supplierId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function getBranchPurchaseOrders(branchId: string, token?: string) {
  return apiRequest<PurchaseOrdersResult>(
    `/branches/${branchId}/purchase-orders`,
    { token },
  );
}

export function createPurchaseOrder(
  branchId: string,
  payload: CreatePurchaseOrderPayload,
  token?: string,
) {
  return apiRequest<PurchaseOrderResult, CreatePurchaseOrderPayload>(
    `/branches/${branchId}/purchase-orders`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getPurchaseOrder(purchaseOrderId: string, token?: string) {
  return apiRequest<PurchaseOrderResult>(
    `/purchase-orders/${purchaseOrderId}`,
    { token },
  );
}

export function updatePurchaseOrder(
  purchaseOrderId: string,
  payload: UpdatePurchaseOrderPayload,
  token?: string,
) {
  return apiRequest<PurchaseOrderMutationResult, UpdatePurchaseOrderPayload>(
    `/purchase-orders/${purchaseOrderId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function submitPurchaseOrder(purchaseOrderId: string, token?: string) {
  return apiRequest<PurchaseOrderMutationResult>(
    `/purchase-orders/${purchaseOrderId}/submit`,
    {
      method: "POST",
      token,
    },
  );
}

export function cancelPurchaseOrder(purchaseOrderId: string, token?: string) {
  return apiRequest<PurchaseOrderMutationResult>(
    `/purchase-orders/${purchaseOrderId}/cancel`,
    {
      method: "POST",
      token,
    },
  );
}

export function addPurchaseOrderLine(
  purchaseOrderId: string,
  payload: CreatePurchaseOrderLinePayload,
  token?: string,
) {
  return apiRequest<PurchaseOrderMutationResult, CreatePurchaseOrderLinePayload>(
    `/purchase-orders/${purchaseOrderId}/lines`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updatePurchaseOrderLine(
  purchaseOrderId: string,
  purchaseOrderLineId: string,
  payload: UpdatePurchaseOrderLinePayload,
  token?: string,
) {
  return apiRequest<PurchaseOrderMutationResult, UpdatePurchaseOrderLinePayload>(
    `/purchase-orders/${purchaseOrderId}/lines/${purchaseOrderLineId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function removePurchaseOrderLine(
  purchaseOrderId: string,
  purchaseOrderLineId: string,
  token?: string,
) {
  return apiRequest<PurchaseOrderMutationResult>(
    `/purchase-orders/${purchaseOrderId}/lines/${purchaseOrderLineId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function receivePurchaseOrder(
  purchaseOrderId: string,
  payload: ReceivePurchaseOrderPayload,
  token?: string,
) {
  return apiRequest<ReceivePurchaseOrderResult, ReceivePurchaseOrderPayload>(
    `/purchase-orders/${purchaseOrderId}/receipts`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBranchInventoryReceipts(branchId: string, token?: string) {
  return apiRequest<InventoryReceiptsResult>(
    `/branches/${branchId}/inventory/receipts`,
    { token },
  );
}

export function getMenuItemDetail(itemId: string, token?: string) {
  return apiRequest<MenuItemDetailResult>(`/menu/items/${itemId}`, { token });
}

export function getBranchMenuAdminOverview(branchId: string, token?: string) {
  return apiRequest<MenuAdminOverviewResult>(
    `/branches/${branchId}/menu-admin/overview`,
    { token },
  );
}

export function getBranchTableAdminOverview(
  companyId: string,
  branchId?: string,
  token?: string,
) {
  return apiRequest<BranchAdminOverviewResult>(
    `/companies/${companyId}/branch-admin/overview`,
    {
      query: { branchId },
      token,
    },
  );
}

export function createBranch(
  companyId: string,
  payload: CreateBranchPayload,
  token?: string,
) {
  return apiRequest<CreateBranchResult, CreateBranchPayload>(
    `/companies/${companyId}/branch-admin/branches`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateBranch(
  branchId: string,
  payload: UpdateBranchPayload,
  token?: string,
) {
  return apiRequest<BranchMutationResult, UpdateBranchPayload>(
    `/branch-admin/branches/${branchId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateBranch(branchId: string, token?: string) {
  return apiRequest<BranchMutationResult>(
    `/branch-admin/branches/${branchId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateBranch(branchId: string, token?: string) {
  return apiRequest<BranchMutationResult>(
    `/branch-admin/branches/${branchId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function createFloor(
  branchId: string,
  payload: CreateFloorPayload,
  token?: string,
) {
  return apiRequest<CreateFloorResult, CreateFloorPayload>(
    `/branches/${branchId}/table-admin/floors`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateFloor(
  branchId: string,
  floorId: string,
  payload: UpdateFloorPayload,
  token?: string,
) {
  return apiRequest<FloorMutationResult, UpdateFloorPayload>(
    `/branches/${branchId}/table-admin/floors/${floorId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function createTable(
  branchId: string,
  payload: CreateTablePayload,
  token?: string,
) {
  return apiRequest<CreateTableResult, CreateTablePayload>(
    `/branches/${branchId}/table-admin/tables`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateTable(
  branchId: string,
  tableId: string,
  payload: UpdateTablePayload,
  token?: string,
) {
  return apiRequest<TableMutationResult, UpdateTablePayload>(
    `/branches/${branchId}/table-admin/tables/${tableId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateTable(
  branchId: string,
  tableId: string,
  token?: string,
) {
  return apiRequest<TableMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateTable(
  branchId: string,
  tableId: string,
  token?: string,
) {
  return apiRequest<TableMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function generateTableQrToken(
  branchId: string,
  tableId: string,
  token?: string,
) {
  return apiRequest<QrTokenMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/qr-token/generate`,
    {
      method: "POST",
      token,
    },
  );
}

export function regenerateTableQrToken(
  branchId: string,
  tableId: string,
  token?: string,
) {
  return apiRequest<
    QrTokenMutationResult,
    { confirmPrintedQrInvalidation: boolean }
  >(`/branches/${branchId}/table-admin/tables/${tableId}/qr-token/regenerate`, {
    method: "POST",
    body: { confirmPrintedQrInvalidation: true },
    token,
  });
}

export function createMenuCategory(
  companyId: string,
  payload: CreateMenuCategoryPayload,
  token?: string,
) {
  return apiRequest<CreateMenuCategoryResult, CreateMenuCategoryPayload>(
    `/companies/${companyId}/menu-admin/categories`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateMenuCategory(
  categoryId: string,
  payload: UpdateMenuCategoryPayload,
  token?: string,
) {
  return apiRequest<MenuCategoryMutationResult, UpdateMenuCategoryPayload>(
    `/menu-admin/categories/${categoryId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateMenuCategory(categoryId: string, token?: string) {
  return apiRequest<MenuCategoryMutationResult>(
    `/menu-admin/categories/${categoryId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateMenuCategory(categoryId: string, token?: string) {
  return apiRequest<MenuCategoryMutationResult>(
    `/menu-admin/categories/${categoryId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function createMenuItem(
  companyId: string,
  payload: CreateMenuItemPayload,
  token?: string,
) {
  return apiRequest<CreateMenuItemResult, CreateMenuItemPayload>(
    `/companies/${companyId}/menu-admin/items`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateMenuItem(
  itemId: string,
  payload: UpdateMenuItemPayload,
  token?: string,
) {
  return apiRequest<MenuItemMutationResult, UpdateMenuItemPayload>(
    `/menu-admin/items/${itemId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function archiveMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/archive`,
    {
      method: "POST",
      token,
    },
  );
}

export function upsertBranchMenuItemOverride(
  branchId: string,
  itemId: string,
  payload: UpsertBranchMenuItemOverridePayload,
  token?: string,
) {
  return apiRequest<
    UpsertBranchMenuItemOverrideResult,
    UpsertBranchMenuItemOverridePayload
  >(`/branches/${branchId}/menu-admin/items/${itemId}/override`, {
    method: "PUT",
    body: payload,
    token,
  });
}

export function deleteBranchMenuItemOverride(
  branchId: string,
  itemId: string,
  token?: string,
) {
  return apiRequest<DeleteBranchMenuItemOverrideResult>(
    `/branches/${branchId}/menu-admin/items/${itemId}/override`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function createModifierGroup(
  companyId: string,
  payload: CreateModifierGroupPayload,
  token?: string,
) {
  return apiRequest<CreateModifierGroupResult, CreateModifierGroupPayload>(
    `/companies/${companyId}/menu-admin/modifier-groups`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateModifierGroup(
  groupId: string,
  payload: UpdateModifierGroupPayload,
  token?: string,
) {
  return apiRequest<ModifierGroupMutationResult, UpdateModifierGroupPayload>(
    `/menu-admin/modifier-groups/${groupId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateModifierGroup(groupId: string, token?: string) {
  return apiRequest<ModifierGroupMutationResult>(
    `/menu-admin/modifier-groups/${groupId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateModifierGroup(groupId: string, token?: string) {
  return apiRequest<ModifierGroupMutationResult>(
    `/menu-admin/modifier-groups/${groupId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function createModifierOption(
  groupId: string,
  payload: CreateModifierOptionPayload,
  token?: string,
) {
  return apiRequest<CreateModifierOptionResult, CreateModifierOptionPayload>(
    `/menu-admin/modifier-groups/${groupId}/options`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function updateModifierOption(
  optionId: string,
  payload: UpdateModifierOptionPayload,
  token?: string,
) {
  return apiRequest<ModifierOptionMutationResult, UpdateModifierOptionPayload>(
    `/menu-admin/modifier-options/${optionId}`,
    {
      method: "PATCH",
      body: payload,
      token,
    },
  );
}

export function activateModifierOption(optionId: string, token?: string) {
  return apiRequest<ModifierOptionMutationResult>(
    `/menu-admin/modifier-options/${optionId}/activate`,
    {
      method: "POST",
      token,
    },
  );
}

export function deactivateModifierOption(optionId: string, token?: string) {
  return apiRequest<ModifierOptionMutationResult>(
    `/menu-admin/modifier-options/${optionId}/deactivate`,
    {
      method: "POST",
      token,
    },
  );
}

export function createMenuItemModifierGroup(
  itemId: string,
  payload: CreateMenuItemModifierGroupPayload,
  token?: string,
) {
  return apiRequest<
    CreateMenuItemModifierGroupResult,
    CreateMenuItemModifierGroupPayload
  >(`/menu-admin/items/${itemId}/modifier-groups`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function deleteMenuItemModifierGroup(
  itemId: string,
  linkId: string,
  token?: string,
) {
  return apiRequest<DeleteMenuItemModifierGroupResult>(
    `/menu-admin/items/${itemId}/modifier-groups/${linkId}`,
    {
      method: "DELETE",
      token,
    },
  );
}

export function startTableSession(
  payload: StartTableSessionPayload,
  options: TableSessionStartOptions = {},
) {
  return apiRequest<StartTableSessionResult, StartTableSessionPayload>(
    "/table-sessions/start",
    {
      method: "POST",
      body: payload,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
      flow: "customer_table_start",
      action: "table_session_start",
    },
  );
}

export function getCart(sessionId: string, token?: string) {
  return apiRequest<CartResponse>(`/table-sessions/${sessionId}/cart`, {
    token,
    flow: "customer_order_cycle",
    action: "cart_get",
    sessionId,
  });
}

export function addCartItem(
  sessionId: string,
  payload: AddCartItemPayload,
  token?: string,
  options: CustomerMutationOptions & { idempotencyKey?: string } = {},
) {
  return apiRequest<CartResponse, AddCartItemPayload>(
    `/table-sessions/${sessionId}/cart/items`,
    {
      method: "POST",
      body: payload,
      headers: options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : undefined,
      token,
      timeoutMs: options.timeoutMs,
      flow: "customer_order_cycle",
      action: "cart_add_item",
      sessionId,
      flowId: options.flowId,
      attempt: options.attempt,
      idempotencyKeyPresent: Boolean(options.idempotencyKey),
    },
  );
}

export function updateCartItem(
  cartItemId: string,
  payload: UpdateCartItemPayload,
  token?: string,
) {
  return apiRequest<CartResponse, UpdateCartItemPayload>(
    `/cart/items/${cartItemId}`,
    {
      method: "PATCH",
      body: payload,
      token,
      flow: "customer_order_cycle",
      action: "cart_update_item",
    },
  );
}

export function removeCartItem(cartItemId: string, token?: string) {
  return apiRequest<CartResponse>(`/cart/items/${cartItemId}`, {
    method: "DELETE",
    token,
    flow: "customer_order_cycle",
    action: "cart_remove_item",
  });
}

export function clearCart(sessionId: string, token?: string) {
  return apiRequest<CartResponse>(`/table-sessions/${sessionId}/cart/clear`, {
    method: "POST",
    token,
    flow: "customer_order_cycle",
    action: "cart_clear",
    sessionId,
  });
}

export function validateCart(sessionId: string, token?: string) {
  return apiRequest<CartValidationResult>(
    `/table-sessions/${sessionId}/cart/validate`,
    {
      method: "POST",
      token,
      flow: "customer_order_cycle",
      action: "cart_validate",
      sessionId,
    },
  );
}

export function submitCart(
  sessionId: string,
  payload: SubmitCartPayload,
  idempotencyKey: string,
  token?: string,
  options: CustomerMutationOptions = {},
) {
  return apiRequest<SubmitCartResult, SubmitCartPayload>(
    `/table-sessions/${sessionId}/cart/submit`,
    {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey },
      token,
      timeoutMs: options.timeoutMs,
      flow: "customer_order_cycle",
      action: "cart_submit",
      sessionId,
      flowId: options.flowId,
      attempt: options.attempt,
      idempotencyKeyPresent: true,
    },
  );
}

export function getTableSessionOrders(sessionId: string, token?: string) {
  return apiRequest<SessionOrdersResult>(
    `/table-sessions/${sessionId}/orders`,
    {
      token,
      flow: "customer_order_cycle",
      action: "order_status",
      sessionId,
    },
  );
}

export function getCustomerStatus(sessionId: string, token?: string) {
  return apiRequest<CustomerStatusResult>(
    `/table-sessions/${sessionId}/customer-status`,
    {
      token,
      flow: "customer_order_cycle",
      action: "order_status",
      sessionId,
    },
  );
}

export function getCustomerTimeline(sessionId: string, token?: string) {
  return apiRequest<CustomerTimelineResult>(
    `/table-sessions/${sessionId}/customer-timeline`,
    {
      token,
      flow: "customer_order_cycle",
      action: "customer_timeline",
      sessionId,
    },
  );
}

export function createWaiterCall(
  sessionId: string,
  payload: WaiterCallPayload,
  token?: string,
) {
  return apiRequest<Record<string, unknown>, WaiterCallPayload>(
    `/table-sessions/${sessionId}/waiter-calls`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "customer_service",
      action: "waiter_call_create",
      sessionId,
    },
  );
}

export function getWaiterCalls(sessionId: string, token?: string) {
  return apiRequest<WaiterCallsResult>(
    `/table-sessions/${sessionId}/waiter-calls`,
    { token },
  );
}

export function getBranchWaiterCalls(
  branchId: string,
  query: WaiterCallsQuery = {},
  token?: string,
) {
  return apiRequest<BranchWaiterCallsResult>(
    `/branches/${branchId}/waiter-calls`,
    { query, token },
  );
}

export function getWaiterCallDetail(waiterCallId: string, token?: string) {
  return apiRequest<WaiterCallDetailResult>(`/waiter-calls/${waiterCallId}`, {
    token,
  });
}

export function acknowledgeWaiterCall(
  waiterCallId: string,
  payload: WaiterCallStaffActionPayload = {},
  token?: string,
) {
  return apiRequest<WaiterCallDetailResult, WaiterCallStaffActionPayload>(
    `/waiter-calls/${waiterCallId}/acknowledge`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function resolveWaiterCall(
  waiterCallId: string,
  payload: ResolveWaiterCallPayload = {},
  token?: string,
) {
  return apiRequest<WaiterCallDetailResult, ResolveWaiterCallPayload>(
    `/waiter-calls/${waiterCallId}/resolve`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function cancelWaiterCall(
  waiterCallId: string,
  payload: CancelWaiterCallPayload = {},
  token?: string,
) {
  return apiRequest<WaiterCallDetailResult, CancelWaiterCallPayload>(
    `/waiter-calls/${waiterCallId}/cancel`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function requestBill(
  sessionId: string,
  payload: RequestBillPayload = {},
  token?: string,
) {
  return apiRequest<Record<string, unknown>, RequestBillPayload>(
    `/table-sessions/${sessionId}/bill/request`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "customer_billing",
      action: "bill_request_create",
      sessionId,
    },
  );
}

export function getBill(sessionId: string, token?: string) {
  return apiRequest<BillResult>(`/table-sessions/${sessionId}/bill`, {
    token,
    flow: "customer_billing",
    action: "bill_get",
    sessionId,
  });
}

export function createOnlinePaymentIntent(
  sessionId: string,
  billId: string,
  payload: CreateOnlinePaymentIntentPayload = {},
  token?: string,
) {
  return apiRequest<
    OnlinePaymentIntentResult,
    CreateOnlinePaymentIntentPayload
  >(`/customer/sessions/${sessionId}/bills/${billId}/online-payment-intents`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function getCustomerPaymentCapabilities(
  sessionId: string,
  billId: string,
  token?: string,
) {
  return apiRequest<CustomerPaymentCapabilities>(
    `/customer/sessions/${sessionId}/bills/${billId}/payment-capabilities`,
    { token },
  );
}

export function getCustomerOnlinePaymentIntent(
  sessionId: string,
  intentId: string,
  token?: string,
) {
  return apiRequest<OnlinePaymentIntentResult>(
    `/customer/sessions/${sessionId}/online-payment-intents/${intentId}`,
    { token },
  );
}

export function startAiWaiter(
  sessionId: string,
  payload: StartAiWaiterPayload = {},
  token?: string,
) {
  return apiRequest<AiWaiterStateResult, StartAiWaiterPayload>(
    `/table-sessions/${sessionId}/ai-waiter/start`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "customer_ai_waiter",
      action: "ai_waiter_start",
      sessionId,
    },
  );
}

export function getCurrentAiWaiterSession(sessionId: string, token?: string) {
  return apiRequest<AiWaiterStateResult>(
    `/table-sessions/${sessionId}/ai-waiter`,
    {
      token,
      flow: "customer_ai_waiter",
      action: "ai_waiter_state",
      sessionId,
    },
  );
}

export function listAiWaiterMessages(
  sessionId: string,
  query: ListAiWaiterMessagesQuery = {},
  token?: string,
) {
  return apiRequest<AiWaiterMessagesResult>(
    `/table-sessions/${sessionId}/ai-waiter/messages`,
    {
      query,
      token,
      flow: "customer_ai_waiter",
      action: "ai_waiter_messages",
      sessionId,
    },
  );
}

export function sendAiWaiterMessage(
  sessionId: string,
  payload: SendAiWaiterMessagePayload,
  token?: string,
) {
  return apiRequest<SendAiWaiterMessageResult, SendAiWaiterMessagePayload>(
    `/table-sessions/${sessionId}/ai-waiter/messages`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "customer_ai_waiter",
      action: "ai_waiter_send_message",
      sessionId,
    },
  );
}

export function applyAiCartProposal(
  proposalId: string,
  token?: string,
  options: CustomerMutationOptions = {},
) {
  return apiRequest<AiCartProposalActionResult>(
    `/ai-waiter/cart-proposals/${proposalId}/apply`,
    {
      method: "POST",
      token,
      timeoutMs: options.timeoutMs,
      flow: "customer_ai_waiter",
      action: "ai_proposal_apply",
      flowId: options.flowId,
      attempt: options.attempt,
    },
  );
}

export function rejectAiCartProposal(
  proposalId: string,
  payload: RejectAiCartProposalPayload = {},
  token?: string,
) {
  return apiRequest<AiCartProposalActionResult, RejectAiCartProposalPayload>(
    `/ai-waiter/cart-proposals/${proposalId}/reject`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function escalateAiWaiter(
  sessionId: string,
  payload: EscalateAiWaiterPayload,
  token?: string,
) {
  return apiRequest<AiWaiterEscalateResult, EscalateAiWaiterPayload>(
    `/table-sessions/${sessionId}/ai-waiter/escalate`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function closeAiWaiter(sessionId: string, token?: string) {
  return apiRequest<AiWaiterCloseResult>(
    `/table-sessions/${sessionId}/ai-waiter/close`,
    {
      method: "POST",
      token,
    },
  );
}

export function staffLogin(payload: StaffLoginPayload) {
  return apiRequest<StaffLoginResult, StaffLoginPayload>("/staff-auth/login", {
    method: "POST",
    body: payload,
  });
}

export function staffMe(token: string) {
  return apiRequest<StaffAuthContext>("/staff-auth/me", {
    token,
  });
}

export function staffLogout(token: string) {
  return apiRequest<Record<string, unknown>>("/staff-auth/logout", {
    method: "POST",
    token,
  });
}

export function getCashierOrders(
  branchId: string,
  query: CashierOrdersQuery = {},
  token?: string,
) {
  return apiRequest<CashierOrdersResult>(
    `/branches/${branchId}/cashier/orders`,
    {
      query,
      token,
      flow: "staff_cashier",
      action: "cashier_orders_list",
      sessionId: undefined,
    },
  );
}

export function getReadyToServeOrders(branchId: string, token?: string) {
  return apiRequest<CashierOrdersResult>(
    `/branches/${branchId}/orders/ready-to-serve`,
    { token },
  );
}

export function getOrderDetail(orderId: string, token?: string) {
  return apiRequest<OrderDetailResult>(`/orders/${orderId}`, { token });
}

export function acceptOrder(
  orderId: string,
  payload: CashierAcceptOrderPayload = {},
  token?: string,
) {
  return apiRequest<OrderDetailResult, CashierAcceptOrderPayload>(
    `/orders/${orderId}/cashier/accept`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_cashier",
      action: "cashier_accept",
      orderId,
    },
  );
}

export function rejectOrder(
  orderId: string,
  payload: CashierRejectOrderPayload = {},
  token?: string,
) {
  return apiRequest<OrderDetailResult, CashierRejectOrderPayload>(
    `/orders/${orderId}/cashier/reject`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_cashier",
      action: "cashier_reject",
      orderId,
    },
  );
}

export function serveOrder(
  orderId: string,
  payload: OrderLifecycleActionPayload = {},
  token?: string,
) {
  return apiRequest<OrderDetailResult, OrderLifecycleActionPayload>(
    `/orders/${orderId}/serve`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_waiter",
      action: "order_serve",
      orderId,
    },
  );
}

export function completeOrder(
  orderId: string,
  payload: OrderLifecycleActionPayload = {},
  token?: string,
) {
  return apiRequest<OrderDetailResult, OrderLifecycleActionPayload>(
    `/orders/${orderId}/complete`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_waiter",
      action: "order_complete",
      orderId,
    },
  );
}

export function cancelOrder(
  orderId: string,
  payload: CancelOrderPayload,
  token?: string,
) {
  return apiRequest<OrderDetailResult, CancelOrderPayload>(
    `/orders/${orderId}/cancel`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_cashier",
      action: "order_cancel",
      orderId,
    },
  );
}

export function getBranchBillRequests(
  branchId: string,
  query: BranchBillRequestsQuery = {},
  token?: string,
) {
  return apiRequest<BranchBillRequestsResult>(
    `/branches/${branchId}/bill-requests`,
    { query, token },
  );
}

export function getBillRequestDetail(billRequestId: string, token?: string) {
  return apiRequest<BillRequestDetailResult>(
    `/bill-requests/${billRequestId}`,
    { token },
  );
}

export function acknowledgeBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string,
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/acknowledge`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function presentBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string,
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/present`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function closeBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string,
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/close`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function cancelBillRequest(
  billRequestId: string,
  payload: CancelBillRequestPayload = {},
  token?: string,
) {
  return apiRequest<BillRequestDetailResult, CancelBillRequestPayload>(
    `/bill-requests/${billRequestId}/cancel`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBranchBills(
  branchId: string,
  query: BranchBillsQuery = {},
  token?: string,
) {
  return apiRequest<BranchBillsResult>(`/branches/${branchId}/bills`, {
    query,
    token,
  });
}

export function getCurrentCashierShift(branchId: string, token?: string) {
  return apiRequest<CurrentCashierShiftResult>(
    `/branches/${branchId}/cashier-shifts/current`,
    { token },
  );
}

export function openCashierShift(
  branchId: string,
  payload: OpenCashierShiftPayload,
  token?: string,
) {
  return apiRequest<CurrentCashierShiftResult, OpenCashierShiftPayload>(
    `/branches/${branchId}/cashier-shifts/open`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBranchCashierShifts(
  branchId: string,
  query: BranchCashierShiftsQuery = {},
  token?: string,
) {
  return apiRequest<BranchCashierShiftsResult>(
    `/branches/${branchId}/cashier-shifts`,
    {
      query,
      token,
    },
  );
}

export function getCashierShiftDetail(shiftId: string, token?: string) {
  return apiRequest<CashierShiftDetailResult>(`/cashier-shifts/${shiftId}`, {
    token,
  });
}

export function createCashAdjustment(
  shiftId: string,
  payload: CreateCashAdjustmentPayload,
  token?: string,
) {
  return apiRequest<CashierShiftDetailResult, CreateCashAdjustmentPayload>(
    `/cashier-shifts/${shiftId}/cash-adjustments`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getCashierShiftXReport(shiftId: string, token?: string) {
  return apiRequest<CashierShiftReportResult>(
    `/cashier-shifts/${shiftId}/x-report`,
    { token },
  );
}

export function closeCashierShift(
  shiftId: string,
  payload: CloseCashierShiftPayload,
  token?: string,
) {
  return apiRequest<CashierShiftDetailResult, CloseCashierShiftPayload>(
    `/cashier-shifts/${shiftId}/close`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBillDetail(billId: string, token?: string) {
  return apiRequest<BillDetailResult>(`/bills/${billId}`, { token });
}

export function getBranchOnlinePayments(
  branchId: string,
  query: BranchOnlinePaymentsQuery = {},
  token?: string,
) {
  return apiRequest<BranchOnlinePaymentsResult>(
    `/branches/${branchId}/online-payments`,
    {
      query,
      token,
    },
  );
}

export function getMerchantPaymentIntegrations(
  branchId: string,
  token?: string,
) {
  return apiRequest<MerchantPaymentIntegrationsResult>(
    `/branches/${branchId}/merchant-payment-integrations`,
    { token },
  );
}

export function upsertMerchantPaymentIntegration(
  branchId: string,
  payload: UpsertMerchantPaymentIntegrationPayload,
  token?: string,
) {
  return apiRequest<
    MerchantPaymentIntegration,
    UpsertMerchantPaymentIntegrationPayload
  >(`/branches/${branchId}/merchant-payment-integrations`, {
    method: "POST",
    body: payload,
    token,
  });
}

export function getSaasPlans(token?: string) {
  return apiRequest<SaasPlansResult>("/saas/plans", { token });
}

export function getCompanySaasStatus(companyId: string, token?: string) {
  return apiRequest<SaasStatusResult>(
    `/companies/${companyId}/saas/status`,
    { token },
  );
}

export function getBranchSaasStatus(branchId: string, token?: string) {
  return apiRequest<SaasStatusResult>(`/branches/${branchId}/saas/status`, {
    token,
  });
}

export function getOnlinePaymentIntent(intentId: string, token?: string) {
  return apiRequest<OnlinePaymentIntentResult>(
    `/online-payment-intents/${intentId}`,
    { token },
  );
}

export function mockSucceedOnlinePayment(intentId: string, token?: string) {
  return apiRequest<OnlinePaymentIntentResult>(
    `/online-payments/mock/${intentId}/succeed`,
    {
      method: "POST",
      token,
    },
  );
}

export function mockFailOnlinePayment(intentId: string, token?: string) {
  return apiRequest<OnlinePaymentIntentResult>(
    `/online-payments/mock/${intentId}/fail`,
    {
      method: "POST",
      token,
    },
  );
}

export function createBillForBillRequest(
  billRequestId: string,
  token?: string,
) {
  return apiRequest<BillDetailResult>(`/bill-requests/${billRequestId}/bill`, {
    method: "POST",
    token,
  });
}

export function presentBill(
  billId: string,
  payload: BillRequestActionPayload = {},
  token?: string,
) {
  return apiRequest<BillDetailResult, BillRequestActionPayload>(
    `/bills/${billId}/present`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function recordManualPayment(
  billId: string,
  payload: RecordManualPaymentPayload,
  token?: string,
) {
  return apiRequest<BillDetailResult, RecordManualPaymentPayload>(
    `/bills/${billId}/manual-payments`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function cancelBill(
  billId: string,
  payload: CancelBillPayload = {},
  token?: string,
) {
  return apiRequest<BillDetailResult, CancelBillPayload>(
    `/bills/${billId}/cancel`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function generateBillReceipt(billId: string, token?: string) {
  return apiRequest<BillDetailResult>(`/bills/${billId}/receipt`, {
    method: "POST",
    token,
  });
}

export function getBillReceipt(billId: string, token?: string) {
  return apiRequest<BillReceiptResult>(`/bills/${billId}/receipt`, { token });
}

export function getBranchRealtimeEvents(
  branchId: string,
  query: BranchRealtimeEventsQuery = {},
  token?: string,
) {
  return apiRequest<BranchRealtimeEventsResult>(
    `/realtime/branches/${branchId}/events`,
    { query, token },
  );
}

export function getBranchPreparationTasks(
  branchId: string,
  query: BranchPreparationTasksQuery = {},
  token?: string,
) {
  return apiRequest<BranchPreparationTasksResult>(
    `/branches/${branchId}/preparation-tasks`,
    { query, token },
  );
}

export function getOrderPreparationTasks(orderId: string, token?: string) {
  return apiRequest<OrderPreparationTasksResult>(
    `/orders/${orderId}/preparation-tasks`,
    { token },
  );
}

export function getBranchKitchenTickets(
  branchId: string,
  query: BranchKitchenTicketsQuery = {},
  token?: string,
) {
  return apiRequest<BranchKitchenTicketsResult>(
    `/branches/${branchId}/kitchen-tickets`,
    {
      query,
      token,
      flow: "staff_kds",
      action: "kitchen_ticket_list",
    },
  );
}

export function getKitchenTicketDetail(ticketId: string, token?: string) {
  return apiRequest<KitchenTicketDetailResult>(`/kitchen-tickets/${ticketId}`, {
    token,
    flow: "staff_kds",
    action: "kitchen_ticket_detail",
    ticketId,
  });
}

export function reprintKitchenTicket(
  ticketId: string,
  payload: ReprintKitchenTicketPayload = {},
  token?: string,
) {
  return apiRequest<PrintJobDetailResult, ReprintKitchenTicketPayload>(
    `/kitchen-tickets/${ticketId}/reprint`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_kds",
      action: "kitchen_ticket_reprint",
      ticketId,
    },
  );
}

export function getBranchPrintJobs(
  branchId: string,
  query: BranchPrintJobsQuery = {},
  token?: string,
) {
  return apiRequest<BranchPrintJobsResult>(`/branches/${branchId}/print-jobs`, {
    query,
    token,
  });
}

export function markPrintJobPrinting(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/print-jobs/${printJobId}/mark-printing`,
    {
      method: "POST",
      token,
    },
  );
}

export function markPrintJobPrinted(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/print-jobs/${printJobId}/mark-printed`,
    {
      method: "POST",
      token,
    },
  );
}

export function markPrintJobFailed(
  printJobId: string,
  payload: MarkPrintJobFailedPayload = {},
  token?: string,
) {
  return apiRequest<PrintJobDetailResult, MarkPrintJobFailedPayload>(
    `/print-jobs/${printJobId}/mark-failed`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_kds",
      action: "print_job_failed",
    },
  );
}

export function retryPrintJob(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(`/print-jobs/${printJobId}/retry`, {
    method: "POST",
    token,
  });
}

export function getBranchPrinterStations(branchId: string, token?: string) {
  return apiRequest<BranchPrinterStationsResult>(
    `/branches/${branchId}/printer-stations`,
    { token },
  );
}

export function testPrinterStation(printerStationId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/printer-stations/${printerStationId}/test-print`,
    {
      method: "POST",
      token,
    },
  );
}

export function getPreparationTaskDetail(taskId: string, token?: string) {
  return apiRequest<PreparationTaskDetailResult>(
    `/preparation-tasks/${taskId}`,
    { token },
  );
}

export function startPreparationTask(
  taskId: string,
  payload: PreparationTaskActionPayload = {},
  token?: string,
) {
  return apiRequest<PreparationTaskDetailResult, PreparationTaskActionPayload>(
    `/preparation-tasks/${taskId}/start`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_kds",
      action: "preparation_task_ready",
      taskId,
    },
  );
}

export function markPreparationTaskReady(
  taskId: string,
  payload: PreparationTaskActionPayload = {},
  token?: string,
) {
  return apiRequest<PreparationTaskDetailResult, PreparationTaskActionPayload>(
    `/preparation-tasks/${taskId}/ready`,
    {
      method: "POST",
      body: payload,
      token,
      flow: "staff_kds",
      action: "preparation_task_cancel",
      taskId,
    },
  );
}

export function cancelPreparationTask(
  taskId: string,
  payload: CancelPreparationTaskPayload = {},
  token?: string,
) {
  return apiRequest<PreparationTaskDetailResult, CancelPreparationTaskPayload>(
    `/preparation-tasks/${taskId}/cancel`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function getBranchAttentionQueue(
  branchId: string,
  query: AttentionQuery = {},
  token?: string,
) {
  return apiRequest<BranchAttentionQueueResult>(
    `/branches/${branchId}/autopilot/attention`,
    { query, token },
  );
}

export function rebuildBranchAttention(branchId: string, token?: string) {
  return apiRequest<RebuildBranchAttentionResult>(
    `/branches/${branchId}/autopilot/attention/rebuild`,
    {
      method: "POST",
      token,
    },
  );
}

export function getTableSessionAttention(sessionId: string, token?: string) {
  return apiRequest<TableSessionAttentionResult>(
    `/table-sessions/${sessionId}/autopilot/attention`,
    { token },
  );
}

export function recalculateTableSessionAttention(
  sessionId: string,
  payload: RecalculateAttentionPayload = {},
  token?: string,
) {
  return apiRequest<TableSessionAttentionResult, RecalculateAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/recalculate`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function resolveTableSessionAttention(
  sessionId: string,
  payload: ResolveAttentionPayload = {},
  token?: string,
) {
  return apiRequest<TableSessionAttentionResult, ResolveAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/resolve`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}

export function muteTableSessionAttention(
  sessionId: string,
  payload: MuteAttentionPayload = {},
  token?: string,
) {
  return apiRequest<TableSessionAttentionResult, MuteAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/mute`,
    {
      method: "POST",
      body: payload,
      token,
    },
  );
}
