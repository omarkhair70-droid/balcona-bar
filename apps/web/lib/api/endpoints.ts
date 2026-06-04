import { apiRequest } from "./client";
import type {
  AddCartItemPayload,
  AiCartProposalActionResult,
  AiWaiterCloseResult,
  AiWaiterEscalateResult,
  AiWaiterMessagesResult,
  AiWaiterStateResult,
  AttentionQuery,
  BillRequestActionPayload,
  BillRequestDetailResult,
  BillResult,
  BranchAttentionQueueResult,
  BranchEffectiveExperience,
  BranchBillRequestsQuery,
  BranchBillRequestsResult,
  BranchAdminOverviewResult,
  BranchKitchenTicketsQuery,
  BranchKitchenTicketsResult,
  BranchMenuResult,
  BranchPrintJobsQuery,
  BranchPrintJobsResult,
  BranchPrinterStationsResult,
  BranchPreparationTasksQuery,
  BranchPreparationTasksResult,
  BranchRealtimeEventsQuery,
  BranchRealtimeEventsResult,
  BranchWaiterCallsResult,
  CancelBillRequestPayload,
  CancelPreparationTaskPayload,
  CancelWaiterCallPayload,
  CartResponse,
  CartValidationResult,
  CashierAcceptOrderPayload,
  CashierOrdersQuery,
  CashierOrdersResult,
  CashierRejectOrderPayload,
  CancelOrderPayload,
  CompanySummary,
  BranchMutationResult,
  CreateMenuCategoryPayload,
  CreateMenuCategoryResult,
  CreateMenuItemModifierGroupPayload,
  CreateMenuItemModifierGroupResult,
  CreateMenuItemPayload,
  CreateMenuItemResult,
  CreateModifierGroupPayload,
  CreateModifierGroupResult,
  CreateModifierOptionPayload,
  CreateBranchPayload,
  CreateBranchResult,
  CreateFloorPayload,
  CreateFloorResult,
  CreateTablePayload,
  CreateTableResult,
  CreateModifierOptionResult,
  CustomerStatusResult,
  CustomerTimelineResult,
  DeleteBranchMenuItemOverrideResult,
  DeleteMenuItemModifierGroupResult,
  EscalateAiWaiterPayload,
  ListAiWaiterMessagesQuery,
  MenuCategoryMutationResult,
  MenuAdminOverviewResult,
  MenuItemMutationResult,
  MenuItemDetailResult,
  ModifierGroupMutationResult,
  ModifierOptionMutationResult,
  MarkPrintJobFailedPayload,
  KitchenTicketDetailResult,
  MuteAttentionPayload,
  OrderDetailResult,
  OrderLifecycleActionPayload,
  OrderPreparationTasksResult,
  PreparationTaskActionPayload,
  PreparationTaskDetailResult,
  PrintJobDetailResult,
  QrTokenMutationResult,
  RebuildBranchAttentionResult,
  RecalculateAttentionPayload,
  RejectAiCartProposalPayload,
  ReprintKitchenTicketPayload,
  RequestBillPayload,
  FloorMutationResult,
  ResolveAttentionPayload,
  ResolveWaiterCallPayload,
  SendAiWaiterMessagePayload,
  SendAiWaiterMessageResult,
  StaffAuthContext,
  StaffLoginPayload,
  StaffLoginResult,
  SessionOrdersResult,
  StartAiWaiterPayload,
  StartTableSessionPayload,
  StartTableSessionResult,
  SubmitCartPayload,
  SubmitCartResult,
  UpdateMenuCategoryPayload,
  UpdateMenuItemPayload,
  UpdateModifierGroupPayload,
  UpdateModifierOptionPayload,
  UpdateBranchPayload,
  UpdateFloorPayload,
  UpdateTablePayload,
  TableSessionAttentionResult,
  TableMutationResult,
  UpdateCartItemPayload,
  UpsertBranchMenuItemOverrideResult,
  UpsertBranchMenuItemOverridePayload,
  WaiterCallDetailResult,
  WaiterCallPayload,
  WaiterCallStaffActionPayload,
  WaiterCallsQuery,
  WaiterCallsResult
} from "./types";

export function getCompanies() {
  return apiRequest<CompanySummary[]>("/companies");
}

export function getBranchEffectiveExperience(branchId: string) {
  return apiRequest<BranchEffectiveExperience>(
    `/branches/${branchId}/experience/effective`
  );
}

export function getBranchMenu(branchId: string, token?: string) {
  return apiRequest<BranchMenuResult>(`/branches/${branchId}/menu`, { token });
}

export function getMenuItemDetail(itemId: string, token?: string) {
  return apiRequest<MenuItemDetailResult>(`/menu/items/${itemId}`, { token });
}

export function getBranchMenuAdminOverview(branchId: string, token?: string) {
  return apiRequest<MenuAdminOverviewResult>(
    `/branches/${branchId}/menu-admin/overview`,
    { token }
  );
}

export function getBranchTableAdminOverview(
  companyId: string,
  branchId?: string,
  token?: string
) {
  return apiRequest<BranchAdminOverviewResult>(
    `/companies/${companyId}/branch-admin/overview`,
    {
      query: { branchId },
      token
    }
  );
}

export function createBranch(
  companyId: string,
  payload: CreateBranchPayload,
  token?: string
) {
  return apiRequest<CreateBranchResult, CreateBranchPayload>(
    `/companies/${companyId}/branch-admin/branches`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateBranch(
  branchId: string,
  payload: UpdateBranchPayload,
  token?: string
) {
  return apiRequest<BranchMutationResult, UpdateBranchPayload>(
    `/branch-admin/branches/${branchId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateBranch(branchId: string, token?: string) {
  return apiRequest<BranchMutationResult>(
    `/branch-admin/branches/${branchId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateBranch(branchId: string, token?: string) {
  return apiRequest<BranchMutationResult>(
    `/branch-admin/branches/${branchId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function createFloor(
  branchId: string,
  payload: CreateFloorPayload,
  token?: string
) {
  return apiRequest<CreateFloorResult, CreateFloorPayload>(
    `/branches/${branchId}/table-admin/floors`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateFloor(
  branchId: string,
  floorId: string,
  payload: UpdateFloorPayload,
  token?: string
) {
  return apiRequest<FloorMutationResult, UpdateFloorPayload>(
    `/branches/${branchId}/table-admin/floors/${floorId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function createTable(
  branchId: string,
  payload: CreateTablePayload,
  token?: string
) {
  return apiRequest<CreateTableResult, CreateTablePayload>(
    `/branches/${branchId}/table-admin/tables`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateTable(
  branchId: string,
  tableId: string,
  payload: UpdateTablePayload,
  token?: string
) {
  return apiRequest<TableMutationResult, UpdateTablePayload>(
    `/branches/${branchId}/table-admin/tables/${tableId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateTable(branchId: string, tableId: string, token?: string) {
  return apiRequest<TableMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateTable(
  branchId: string,
  tableId: string,
  token?: string
) {
  return apiRequest<TableMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function generateTableQrToken(
  branchId: string,
  tableId: string,
  token?: string
) {
  return apiRequest<QrTokenMutationResult>(
    `/branches/${branchId}/table-admin/tables/${tableId}/qr-token/generate`,
    {
      method: "POST",
      token
    }
  );
}

export function regenerateTableQrToken(
  branchId: string,
  tableId: string,
  token?: string
) {
  return apiRequest<
    QrTokenMutationResult,
    { confirmPrintedQrInvalidation: boolean }
  >(`/branches/${branchId}/table-admin/tables/${tableId}/qr-token/regenerate`, {
    method: "POST",
    body: { confirmPrintedQrInvalidation: true },
    token
  });
}

export function createMenuCategory(
  companyId: string,
  payload: CreateMenuCategoryPayload,
  token?: string
) {
  return apiRequest<CreateMenuCategoryResult, CreateMenuCategoryPayload>(
    `/companies/${companyId}/menu-admin/categories`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateMenuCategory(
  categoryId: string,
  payload: UpdateMenuCategoryPayload,
  token?: string
) {
  return apiRequest<MenuCategoryMutationResult, UpdateMenuCategoryPayload>(
    `/menu-admin/categories/${categoryId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateMenuCategory(categoryId: string, token?: string) {
  return apiRequest<MenuCategoryMutationResult>(
    `/menu-admin/categories/${categoryId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateMenuCategory(categoryId: string, token?: string) {
  return apiRequest<MenuCategoryMutationResult>(
    `/menu-admin/categories/${categoryId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function createMenuItem(
  companyId: string,
  payload: CreateMenuItemPayload,
  token?: string
) {
  return apiRequest<CreateMenuItemResult, CreateMenuItemPayload>(
    `/companies/${companyId}/menu-admin/items`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateMenuItem(
  itemId: string,
  payload: UpdateMenuItemPayload,
  token?: string
) {
  return apiRequest<MenuItemMutationResult, UpdateMenuItemPayload>(
    `/menu-admin/items/${itemId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function archiveMenuItem(itemId: string, token?: string) {
  return apiRequest<MenuItemMutationResult>(
    `/menu-admin/items/${itemId}/archive`,
    {
      method: "POST",
      token
    }
  );
}

export function upsertBranchMenuItemOverride(
  branchId: string,
  itemId: string,
  payload: UpsertBranchMenuItemOverridePayload,
  token?: string
) {
  return apiRequest<
    UpsertBranchMenuItemOverrideResult,
    UpsertBranchMenuItemOverridePayload
  >(`/branches/${branchId}/menu-admin/items/${itemId}/override`, {
    method: "PUT",
    body: payload,
    token
  });
}

export function deleteBranchMenuItemOverride(
  branchId: string,
  itemId: string,
  token?: string
) {
  return apiRequest<DeleteBranchMenuItemOverrideResult>(
    `/branches/${branchId}/menu-admin/items/${itemId}/override`,
    {
      method: "DELETE",
      token
    }
  );
}

export function createModifierGroup(
  companyId: string,
  payload: CreateModifierGroupPayload,
  token?: string
) {
  return apiRequest<CreateModifierGroupResult, CreateModifierGroupPayload>(
    `/companies/${companyId}/menu-admin/modifier-groups`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateModifierGroup(
  groupId: string,
  payload: UpdateModifierGroupPayload,
  token?: string
) {
  return apiRequest<ModifierGroupMutationResult, UpdateModifierGroupPayload>(
    `/menu-admin/modifier-groups/${groupId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateModifierGroup(groupId: string, token?: string) {
  return apiRequest<ModifierGroupMutationResult>(
    `/menu-admin/modifier-groups/${groupId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateModifierGroup(groupId: string, token?: string) {
  return apiRequest<ModifierGroupMutationResult>(
    `/menu-admin/modifier-groups/${groupId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function createModifierOption(
  groupId: string,
  payload: CreateModifierOptionPayload,
  token?: string
) {
  return apiRequest<CreateModifierOptionResult, CreateModifierOptionPayload>(
    `/menu-admin/modifier-groups/${groupId}/options`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateModifierOption(
  optionId: string,
  payload: UpdateModifierOptionPayload,
  token?: string
) {
  return apiRequest<ModifierOptionMutationResult, UpdateModifierOptionPayload>(
    `/menu-admin/modifier-options/${optionId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function activateModifierOption(optionId: string, token?: string) {
  return apiRequest<ModifierOptionMutationResult>(
    `/menu-admin/modifier-options/${optionId}/activate`,
    {
      method: "POST",
      token
    }
  );
}

export function deactivateModifierOption(optionId: string, token?: string) {
  return apiRequest<ModifierOptionMutationResult>(
    `/menu-admin/modifier-options/${optionId}/deactivate`,
    {
      method: "POST",
      token
    }
  );
}

export function createMenuItemModifierGroup(
  itemId: string,
  payload: CreateMenuItemModifierGroupPayload,
  token?: string
) {
  return apiRequest<
    CreateMenuItemModifierGroupResult,
    CreateMenuItemModifierGroupPayload
  >(`/menu-admin/items/${itemId}/modifier-groups`, {
    method: "POST",
    body: payload,
    token
  });
}

export function deleteMenuItemModifierGroup(
  itemId: string,
  linkId: string,
  token?: string
) {
  return apiRequest<DeleteMenuItemModifierGroupResult>(
    `/menu-admin/items/${itemId}/modifier-groups/${linkId}`,
    {
      method: "DELETE",
      token
    }
  );
}

export function startTableSession(payload: StartTableSessionPayload) {
  return apiRequest<StartTableSessionResult, StartTableSessionPayload>(
    "/table-sessions/start",
    {
      method: "POST",
      body: payload
    }
  );
}

export function getCart(sessionId: string, token?: string) {
  return apiRequest<CartResponse>(`/table-sessions/${sessionId}/cart`, {
    token
  });
}

export function addCartItem(
  sessionId: string,
  payload: AddCartItemPayload,
  token?: string
) {
  return apiRequest<CartResponse, AddCartItemPayload>(
    `/table-sessions/${sessionId}/cart/items`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function updateCartItem(
  cartItemId: string,
  payload: UpdateCartItemPayload,
  token?: string
) {
  return apiRequest<CartResponse, UpdateCartItemPayload>(
    `/cart/items/${cartItemId}`,
    {
      method: "PATCH",
      body: payload,
      token
    }
  );
}

export function removeCartItem(cartItemId: string, token?: string) {
  return apiRequest<CartResponse>(`/cart/items/${cartItemId}`, {
    method: "DELETE",
    token
  });
}

export function clearCart(sessionId: string, token?: string) {
  return apiRequest<CartResponse>(`/table-sessions/${sessionId}/cart/clear`, {
    method: "POST",
    token
  });
}

export function validateCart(sessionId: string, token?: string) {
  return apiRequest<CartValidationResult>(
    `/table-sessions/${sessionId}/cart/validate`,
    {
      method: "POST",
      token
    }
  );
}

export function submitCart(
  sessionId: string,
  payload: SubmitCartPayload,
  idempotencyKey: string,
  token?: string
) {
  return apiRequest<SubmitCartResult, SubmitCartPayload>(
    `/table-sessions/${sessionId}/cart/submit`,
    {
      method: "POST",
      body: payload,
      headers: { "Idempotency-Key": idempotencyKey },
      token
    }
  );
}

export function getTableSessionOrders(sessionId: string, token?: string) {
  return apiRequest<SessionOrdersResult>(
    `/table-sessions/${sessionId}/orders`,
    { token }
  );
}

export function getCustomerStatus(sessionId: string, token?: string) {
  return apiRequest<CustomerStatusResult>(
    `/table-sessions/${sessionId}/customer-status`,
    { token }
  );
}

export function getCustomerTimeline(sessionId: string, token?: string) {
  return apiRequest<CustomerTimelineResult>(
    `/table-sessions/${sessionId}/customer-timeline`,
    { token }
  );
}

export function createWaiterCall(
  sessionId: string,
  payload: WaiterCallPayload,
  token?: string
) {
  return apiRequest<Record<string, unknown>, WaiterCallPayload>(
    `/table-sessions/${sessionId}/waiter-calls`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getWaiterCalls(sessionId: string, token?: string) {
  return apiRequest<WaiterCallsResult>(
    `/table-sessions/${sessionId}/waiter-calls`,
    { token }
  );
}

export function getBranchWaiterCalls(
  branchId: string,
  query: WaiterCallsQuery = {},
  token?: string
) {
  return apiRequest<BranchWaiterCallsResult>(
    `/branches/${branchId}/waiter-calls`,
    { query, token }
  );
}

export function getWaiterCallDetail(waiterCallId: string, token?: string) {
  return apiRequest<WaiterCallDetailResult>(`/waiter-calls/${waiterCallId}`, {
    token
  });
}

export function acknowledgeWaiterCall(
  waiterCallId: string,
  payload: WaiterCallStaffActionPayload = {},
  token?: string
) {
  return apiRequest<WaiterCallDetailResult, WaiterCallStaffActionPayload>(
    `/waiter-calls/${waiterCallId}/acknowledge`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function resolveWaiterCall(
  waiterCallId: string,
  payload: ResolveWaiterCallPayload = {},
  token?: string
) {
  return apiRequest<WaiterCallDetailResult, ResolveWaiterCallPayload>(
    `/waiter-calls/${waiterCallId}/resolve`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function cancelWaiterCall(
  waiterCallId: string,
  payload: CancelWaiterCallPayload = {},
  token?: string
) {
  return apiRequest<WaiterCallDetailResult, CancelWaiterCallPayload>(
    `/waiter-calls/${waiterCallId}/cancel`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function requestBill(
  sessionId: string,
  payload: RequestBillPayload = {},
  token?: string
) {
  return apiRequest<Record<string, unknown>, RequestBillPayload>(
    `/table-sessions/${sessionId}/bill/request`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getBill(sessionId: string, token?: string) {
  return apiRequest<BillResult>(`/table-sessions/${sessionId}/bill`, {
    token
  });
}

export function startAiWaiter(
  sessionId: string,
  payload: StartAiWaiterPayload = {},
  token?: string
) {
  return apiRequest<AiWaiterStateResult, StartAiWaiterPayload>(
    `/table-sessions/${sessionId}/ai-waiter/start`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getCurrentAiWaiterSession(sessionId: string, token?: string) {
  return apiRequest<AiWaiterStateResult>(
    `/table-sessions/${sessionId}/ai-waiter`,
    { token }
  );
}

export function listAiWaiterMessages(
  sessionId: string,
  query: ListAiWaiterMessagesQuery = {},
  token?: string
) {
  return apiRequest<AiWaiterMessagesResult>(
    `/table-sessions/${sessionId}/ai-waiter/messages`,
    { query, token }
  );
}

export function sendAiWaiterMessage(
  sessionId: string,
  payload: SendAiWaiterMessagePayload,
  token?: string
) {
  return apiRequest<SendAiWaiterMessageResult, SendAiWaiterMessagePayload>(
    `/table-sessions/${sessionId}/ai-waiter/messages`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function applyAiCartProposal(proposalId: string, token?: string) {
  return apiRequest<AiCartProposalActionResult>(
    `/ai-waiter/cart-proposals/${proposalId}/apply`,
    {
      method: "POST",
      token
    }
  );
}

export function rejectAiCartProposal(
  proposalId: string,
  payload: RejectAiCartProposalPayload = {},
  token?: string
) {
  return apiRequest<AiCartProposalActionResult, RejectAiCartProposalPayload>(
    `/ai-waiter/cart-proposals/${proposalId}/reject`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function escalateAiWaiter(
  sessionId: string,
  payload: EscalateAiWaiterPayload,
  token?: string
) {
  return apiRequest<AiWaiterEscalateResult, EscalateAiWaiterPayload>(
    `/table-sessions/${sessionId}/ai-waiter/escalate`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function closeAiWaiter(sessionId: string, token?: string) {
  return apiRequest<AiWaiterCloseResult>(
    `/table-sessions/${sessionId}/ai-waiter/close`,
    {
      method: "POST",
      token
    }
  );
}

export function staffLogin(payload: StaffLoginPayload) {
  return apiRequest<StaffLoginResult, StaffLoginPayload>("/staff-auth/login", {
    method: "POST",
    body: payload
  });
}

export function staffMe(token: string) {
  return apiRequest<StaffAuthContext>("/staff-auth/me", {
    token
  });
}

export function staffLogout(token: string) {
  return apiRequest<Record<string, unknown>>("/staff-auth/logout", {
    method: "POST",
    token
  });
}

export function getCashierOrders(
  branchId: string,
  query: CashierOrdersQuery = {},
  token?: string
) {
  return apiRequest<CashierOrdersResult>(
    `/branches/${branchId}/cashier/orders`,
    { query, token }
  );
}

export function getReadyToServeOrders(branchId: string, token?: string) {
  return apiRequest<CashierOrdersResult>(
    `/branches/${branchId}/orders/ready-to-serve`,
    { token }
  );
}

export function getOrderDetail(orderId: string, token?: string) {
  return apiRequest<OrderDetailResult>(`/orders/${orderId}`, { token });
}

export function acceptOrder(
  orderId: string,
  payload: CashierAcceptOrderPayload = {},
  token?: string
) {
  return apiRequest<OrderDetailResult, CashierAcceptOrderPayload>(
    `/orders/${orderId}/cashier/accept`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function rejectOrder(
  orderId: string,
  payload: CashierRejectOrderPayload = {},
  token?: string
) {
  return apiRequest<OrderDetailResult, CashierRejectOrderPayload>(
    `/orders/${orderId}/cashier/reject`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function serveOrder(
  orderId: string,
  payload: OrderLifecycleActionPayload = {},
  token?: string
) {
  return apiRequest<OrderDetailResult, OrderLifecycleActionPayload>(
    `/orders/${orderId}/serve`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function completeOrder(
  orderId: string,
  payload: OrderLifecycleActionPayload = {},
  token?: string
) {
  return apiRequest<OrderDetailResult, OrderLifecycleActionPayload>(
    `/orders/${orderId}/complete`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function cancelOrder(
  orderId: string,
  payload: CancelOrderPayload,
  token?: string
) {
  return apiRequest<OrderDetailResult, CancelOrderPayload>(
    `/orders/${orderId}/cancel`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getBranchBillRequests(
  branchId: string,
  query: BranchBillRequestsQuery = {},
  token?: string
) {
  return apiRequest<BranchBillRequestsResult>(
    `/branches/${branchId}/bill-requests`,
    { query, token }
  );
}

export function getBillRequestDetail(billRequestId: string, token?: string) {
  return apiRequest<BillRequestDetailResult>(
    `/bill-requests/${billRequestId}`,
    { token }
  );
}

export function acknowledgeBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/acknowledge`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function presentBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/present`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function closeBillRequest(
  billRequestId: string,
  payload: BillRequestActionPayload = {},
  token?: string
) {
  return apiRequest<BillRequestDetailResult, BillRequestActionPayload>(
    `/bill-requests/${billRequestId}/close`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function cancelBillRequest(
  billRequestId: string,
  payload: CancelBillRequestPayload = {},
  token?: string
) {
  return apiRequest<BillRequestDetailResult, CancelBillRequestPayload>(
    `/bill-requests/${billRequestId}/cancel`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getBranchRealtimeEvents(
  branchId: string,
  query: BranchRealtimeEventsQuery = {},
  token?: string
) {
  return apiRequest<BranchRealtimeEventsResult>(
    `/realtime/branches/${branchId}/events`,
    { query, token }
  );
}

export function getBranchPreparationTasks(
  branchId: string,
  query: BranchPreparationTasksQuery = {},
  token?: string
) {
  return apiRequest<BranchPreparationTasksResult>(
    `/branches/${branchId}/preparation-tasks`,
    { query, token }
  );
}

export function getOrderPreparationTasks(orderId: string, token?: string) {
  return apiRequest<OrderPreparationTasksResult>(
    `/orders/${orderId}/preparation-tasks`,
    { token }
  );
}

export function getBranchKitchenTickets(
  branchId: string,
  query: BranchKitchenTicketsQuery = {},
  token?: string
) {
  return apiRequest<BranchKitchenTicketsResult>(
    `/branches/${branchId}/kitchen-tickets`,
    {
      query,
      token
    }
  );
}

export function getKitchenTicketDetail(ticketId: string, token?: string) {
  return apiRequest<KitchenTicketDetailResult>(`/kitchen-tickets/${ticketId}`, {
    token
  });
}

export function reprintKitchenTicket(
  ticketId: string,
  payload: ReprintKitchenTicketPayload = {},
  token?: string
) {
  return apiRequest<PrintJobDetailResult, ReprintKitchenTicketPayload>(
    `/kitchen-tickets/${ticketId}/reprint`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getBranchPrintJobs(
  branchId: string,
  query: BranchPrintJobsQuery = {},
  token?: string
) {
  return apiRequest<BranchPrintJobsResult>(`/branches/${branchId}/print-jobs`, {
    query,
    token
  });
}

export function markPrintJobPrinting(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/print-jobs/${printJobId}/mark-printing`,
    {
      method: "POST",
      token
    }
  );
}

export function markPrintJobPrinted(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/print-jobs/${printJobId}/mark-printed`,
    {
      method: "POST",
      token
    }
  );
}

export function markPrintJobFailed(
  printJobId: string,
  payload: MarkPrintJobFailedPayload = {},
  token?: string
) {
  return apiRequest<PrintJobDetailResult, MarkPrintJobFailedPayload>(
    `/print-jobs/${printJobId}/mark-failed`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function retryPrintJob(printJobId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(`/print-jobs/${printJobId}/retry`, {
    method: "POST",
    token
  });
}

export function getBranchPrinterStations(branchId: string, token?: string) {
  return apiRequest<BranchPrinterStationsResult>(
    `/branches/${branchId}/printer-stations`,
    { token }
  );
}

export function testPrinterStation(printerStationId: string, token?: string) {
  return apiRequest<PrintJobDetailResult>(
    `/printer-stations/${printerStationId}/test-print`,
    {
      method: "POST",
      token
    }
  );
}

export function getPreparationTaskDetail(taskId: string, token?: string) {
  return apiRequest<PreparationTaskDetailResult>(
    `/preparation-tasks/${taskId}`,
    { token }
  );
}

export function startPreparationTask(
  taskId: string,
  payload: PreparationTaskActionPayload = {},
  token?: string
) {
  return apiRequest<PreparationTaskDetailResult, PreparationTaskActionPayload>(
    `/preparation-tasks/${taskId}/start`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function markPreparationTaskReady(
  taskId: string,
  payload: PreparationTaskActionPayload = {},
  token?: string
) {
  return apiRequest<PreparationTaskDetailResult, PreparationTaskActionPayload>(
    `/preparation-tasks/${taskId}/ready`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function cancelPreparationTask(
  taskId: string,
  payload: CancelPreparationTaskPayload = {},
  token?: string
) {
  return apiRequest<PreparationTaskDetailResult, CancelPreparationTaskPayload>(
    `/preparation-tasks/${taskId}/cancel`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function getBranchAttentionQueue(
  branchId: string,
  query: AttentionQuery = {},
  token?: string
) {
  return apiRequest<BranchAttentionQueueResult>(
    `/branches/${branchId}/autopilot/attention`,
    { query, token }
  );
}

export function rebuildBranchAttention(branchId: string, token?: string) {
  return apiRequest<RebuildBranchAttentionResult>(
    `/branches/${branchId}/autopilot/attention/rebuild`,
    {
      method: "POST",
      token
    }
  );
}

export function getTableSessionAttention(sessionId: string, token?: string) {
  return apiRequest<TableSessionAttentionResult>(
    `/table-sessions/${sessionId}/autopilot/attention`,
    { token }
  );
}

export function recalculateTableSessionAttention(
  sessionId: string,
  payload: RecalculateAttentionPayload = {},
  token?: string
) {
  return apiRequest<TableSessionAttentionResult, RecalculateAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/recalculate`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function resolveTableSessionAttention(
  sessionId: string,
  payload: ResolveAttentionPayload = {},
  token?: string
) {
  return apiRequest<TableSessionAttentionResult, ResolveAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/resolve`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}

export function muteTableSessionAttention(
  sessionId: string,
  payload: MuteAttentionPayload = {},
  token?: string
) {
  return apiRequest<TableSessionAttentionResult, MuteAttentionPayload>(
    `/table-sessions/${sessionId}/autopilot/attention/mute`,
    {
      method: "POST",
      body: payload,
      token
    }
  );
}
