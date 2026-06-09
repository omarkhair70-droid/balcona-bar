import { ApiError } from "@/lib/api/client";
import { formatErrorMessage } from "@/lib/api/error-message";
import { addDebugBreadcrumb } from "@/lib/observability/breadcrumbs";

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_INITIAL_DELAY_MS = 350;
const MAX_DELAY_MS = 1_200;
const TRANSIENT_STATUSES = new Set([0, 502, 503, 504]);

type CustomerRetryOptions = {
  flow: string;
  maxAttempts?: number;
  initialDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
  onAttempt?: (input: {
    flow: string;
    attempt: number;
    maxAttempts: number;
  }) => void;
  onRetry?: (input: {
    flow: string;
    attempt: number;
    maxAttempts: number;
    error: unknown;
    delayMs: number;
  }) => void;
};

function sleep(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

function getRetryDelay(attempt: number, initialDelayMs: number) {
  return Math.min(initialDelayMs * 2 ** Math.max(0, attempt - 1), MAX_DELAY_MS);
}

function logCustomerFlow(
  level: "info" | "warn",
  event: string,
  metadata: Record<string, unknown>
) {
  const logger = globalThis.console?.[level];

  if (!logger) {
    return;
  }

  logger(`[customer-flow] ${event}`, metadata);
}

export function isTransientCustomerApiError(error: unknown) {
  return error instanceof ApiError && TRANSIENT_STATUSES.has(error.status);
}

export function isBusinessCustomerApiError(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500;
}

export async function withCustomerTransientRetry<T>(
  operation: () => Promise<T>,
  options: CustomerRetryOptions
) {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_INITIAL_DELAY_MS;
  const shouldRetry = options.shouldRetry ?? isTransientCustomerApiError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    options.onAttempt?.({ flow: options.flow, attempt, maxAttempts });
    logCustomerFlow("info", "attempt", {
      flow: options.flow,
      attempt,
      maxAttempts
    });
    addDebugBreadcrumb({
      action: "customer_retry_attempt",
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
      flow: options.flow,
      result: "started"
    });

    try {
      const result = await operation();

      logCustomerFlow("info", "success", {
        flow: options.flow,
        attempt,
        maxAttempts
      });
      addDebugBreadcrumb({
        action: "customer_retry_success",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        flow: options.flow,
        result: attempt > 1 ? "replayed" : "success"
      });

      return result;
    } catch (error) {
      const canRetry = attempt < maxAttempts && shouldRetry(error);

      if (!canRetry) {
        logCustomerFlow("warn", "failed", {
          flow: options.flow,
          attempt,
          maxAttempts,
          retryable: false,
          message: formatErrorMessage(error)
        });
        addDebugBreadcrumb({
          action: "customer_retry_failed",
          route:
            typeof window !== "undefined" ? window.location.pathname : undefined,
          flow: options.flow,
          result: "failure",
          status: error instanceof ApiError ? error.status : undefined,
          requestId: error instanceof ApiError ? error.requestId : undefined,
          durationMs: error instanceof ApiError ? error.durationMs : undefined
        });
        throw error;
      }

      const delayMs = getRetryDelay(attempt, initialDelayMs);

      options.onRetry?.({
        flow: options.flow,
        attempt,
        maxAttempts,
        error,
        delayMs
      });
      logCustomerFlow("warn", "retry", {
        flow: options.flow,
        attempt,
        maxAttempts,
        delayMs,
        message: formatErrorMessage(error)
      });
      addDebugBreadcrumb({
        action: "customer_retry_scheduled",
        route: typeof window !== "undefined" ? window.location.pathname : undefined,
        flow: options.flow,
        result: "failure",
        status: error instanceof ApiError ? error.status : undefined,
        requestId: error instanceof ApiError ? error.requestId : undefined,
        durationMs: error instanceof ApiError ? error.durationMs : undefined
      });
      await sleep(delayMs);
    }
  }

  throw new Error("Retry loop exited unexpectedly.");
}
