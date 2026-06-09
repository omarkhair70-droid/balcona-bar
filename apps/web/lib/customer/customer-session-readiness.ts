import {
  isCustomerSessionExpired,
  type CustomerSessionState
} from "./customer-session-store";

export type CustomerSessionReady = {
  isReady: true;
  sessionId: string;
  branchId: string;
  customerAccessToken: string;
};

export type CustomerSessionNotReady = {
  isReady: false;
  reason:
    | "hydrating"
    | "missing_session"
    | "session_mismatch"
    | "missing_branch"
    | "missing_token"
    | "expired";
  message: string;
};

export type CustomerSessionReadiness =
  | CustomerSessionReady
  | CustomerSessionNotReady;

export class CustomerSessionNotReadyError extends Error {
  readonly reason: CustomerSessionNotReady["reason"];

  constructor(readiness: CustomerSessionNotReady) {
    super(readiness.message);
    this.name = "CustomerSessionNotReadyError";
    this.reason = readiness.reason;
  }
}

export type CustomerSessionSnapshot = Pick<
  CustomerSessionState,
  | "hasHydrated"
  | "sessionId"
  | "branchId"
  | "customerAccessToken"
  | "customerAccessTokenExpiresAt"
>;

export function getCustomerSessionReadiness(
  state: CustomerSessionSnapshot,
  expectedSessionId?: string
): CustomerSessionReadiness {
  if (!state.hasHydrated) {
    return {
      isReady: false,
      reason: "hydrating",
      message: "Restoring your table access..."
    };
  }

  if (!state.sessionId) {
    return {
      isReady: false,
      reason: "missing_session",
      message: "Open the table QR link again to restore your session."
    };
  }

  if (expectedSessionId && state.sessionId !== expectedSessionId) {
    return {
      isReady: false,
      reason: "session_mismatch",
      message: "This device is connected to another table session."
    };
  }

  if (!state.branchId) {
    return {
      isReady: false,
      reason: "missing_branch",
      message: "The table branch is still loading. Please try again."
    };
  }

  if (!state.customerAccessToken) {
    return {
      isReady: false,
      reason: "missing_token",
      message: "Secure table access is still loading. Please try again."
    };
  }

  if (isCustomerSessionExpired(state.customerAccessTokenExpiresAt)) {
    return {
      isReady: false,
      reason: "expired",
      message: "Your table access expired. Open the table QR link again."
    };
  }

  return {
    isReady: true,
    sessionId: state.sessionId,
    branchId: state.branchId,
    customerAccessToken: state.customerAccessToken
  };
}

export function assertCustomerSessionReady(
  state: CustomerSessionSnapshot,
  expectedSessionId?: string
): CustomerSessionReady {
  const readiness = getCustomerSessionReadiness(state, expectedSessionId);

  if (!readiness.isReady) {
    throw new CustomerSessionNotReadyError(readiness);
  }

  return readiness;
}
