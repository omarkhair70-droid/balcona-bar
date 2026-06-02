import { apiRequest } from "./client";
import type {
  AddCartItemPayload,
  BillResult,
  BranchEffectiveExperience,
  BranchMenuResult,
  CartResponse,
  CartValidationResult,
  CompanySummary,
  CustomerStatusResult,
  CustomerTimelineResult,
  MenuItemDetailResult,
  RequestBillPayload,
  StaffAuthContext,
  StaffLoginPayload,
  StaffLoginResult,
  SessionOrdersResult,
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
