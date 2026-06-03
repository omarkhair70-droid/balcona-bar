import { apiRequest } from "./client";
import type {
  AddCartItemPayload,
  AiCartProposalActionResult,
  AiWaiterCloseResult,
  AiWaiterEscalateResult,
  AiWaiterMessagesResult,
  AiWaiterStateResult,
  BillRequestActionPayload,
  BillRequestDetailResult,
  BillResult,
  BranchEffectiveExperience,
  BranchBillRequestsQuery,
  BranchBillRequestsResult,
  BranchMenuResult,
  BranchPreparationTasksQuery,
  BranchPreparationTasksResult,
  BranchRealtimeEventsQuery,
  BranchRealtimeEventsResult,
  CancelBillRequestPayload,
  CancelPreparationTaskPayload,
  CartResponse,
  CartValidationResult,
  CashierAcceptOrderPayload,
  CashierOrdersQuery,
  CashierOrdersResult,
  CashierRejectOrderPayload,
  CompanySummary,
  CustomerStatusResult,
  CustomerTimelineResult,
  EscalateAiWaiterPayload,
  ListAiWaiterMessagesQuery,
  MenuItemDetailResult,
  OrderDetailResult,
  OrderPreparationTasksResult,
  PreparationTaskActionPayload,
  PreparationTaskDetailResult,
  RejectAiCartProposalPayload,
  RequestBillPayload,
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
  UpdateCartItemPayload,
  WaiterCallPayload,
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
