import { getDebugBreadcrumbs, type DebugBreadcrumb } from "./breadcrumbs";
import { getClientLocaleSnapshot } from "@/lib/i18n/config";
import { getWebDebugMetadata, type WebDebugMetadata } from "./metadata";

const SENSITIVE_KEY_PATTERN =
  /password|passwd|pwd|secret|token|authorization|cookie|api[_-]?key|payload|body|note|messageContent|raw/i;

export type DebugReportInput = {
  route?: string;
  flow?: string;
  action?: string;
  error?: unknown;
  requestId?: string;
  flowId?: string;
  clientTraceId?: string;
  sessionId?: string;
  branchId?: string;
  tableId?: string;
  orderId?: string;
  taskId?: string;
  ticketId?: string;
  locale?: string;
  retryAttempt?: number;
  retryHappened?: boolean;
  breadcrumbs?: DebugBreadcrumb[];
};

export type DebugReport = {
  timestamp: string;
  route?: string;
  environment: string;
  build: WebDebugMetadata;
  locale?: string;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
    devicePixelRatio?: number;
  };
  flow?: string;
  action?: string;
  requestId?: string;
  flowId?: string;
  clientTraceId?: string;
  api?: {
    method?: string;
    path?: string;
    status?: number;
    code?: string;
    message?: string;
    durationMs?: number;
    timeoutMs?: number;
  };
  ids?: {
    sessionId?: string;
    branchId?: string;
    tableId?: string;
    orderId?: string;
    taskId?: string;
    ticketId?: string;
  };
  retry?: {
    happened?: boolean;
    attempts?: number;
  };
  breadcrumbs: DebugBreadcrumb[];
  frontendErrorMessage?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeText(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized || normalized === "[object Object]") {
    return undefined;
  }

  return normalized
    .replace(
      /(authorization\s*[:=]\s*bearer\s+)([^,\s}]+)/gi,
      "$1[redacted]"
    )
    .replace(
      /(password|passwd|pwd|secret|token|api[_-]?key|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
      "$1$2[redacted]"
    )
    .replace(/(bearer\s+)([a-z0-9._-]+)/gi, "$1[redacted]")
    .slice(0, 500);
}

function safeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function nestedRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key])
    ? (value[key] as Record<string, unknown>)
    : undefined;
}

function requestIdFromValue(value: unknown): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const direct = safeText(value.requestId);

  return (
    direct ??
    requestIdFromValue(value.error) ??
    requestIdFromValue(value.details) ??
    requestIdFromValue(value.response)
  );
}

function apiErrorDetails(error: unknown) {
  if (!isRecord(error)) {
    return {};
  }

  const details = isRecord(error.details)
    ? error.details
    : nestedRecord(error, "response");
  const bodyError = nestedRecord(details, "error");
  const code = safeText(error.code) ?? safeText(bodyError?.code);
  const message =
    safeText(error.message) ??
    safeText(bodyError?.message) ??
    "No frontend error message captured";

  return {
    method: safeText(error.method),
    path: safeText(error.path),
    status: safeNumber(error.status),
    code,
    message,
    durationMs: safeNumber(error.durationMs),
    timeoutMs: safeNumber(error.timeoutMs),
    requestId:
      safeText(error.requestId) ??
      requestIdFromValue(details) ??
      requestIdFromValue(bodyError),
    flowId: safeText(error.flowId),
    clientTraceId: safeText(error.clientTraceId),
    retryAttempt: safeNumber(error.attempt)
  };
}

export function sanitizeDebugReport(report: DebugReport): DebugReport {
  const sanitized = JSON.parse(
    JSON.stringify(report, (key, value) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        return undefined;
      }

      if (typeof value === "string") {
        return safeText(value);
      }

      return value;
    })
  ) as DebugReport;

  sanitized.breadcrumbs = (sanitized.breadcrumbs ?? []).slice(-30);

  return sanitized;
}

export function buildDebugReport(input: DebugReportInput = {}): DebugReport {
  const api = apiErrorDetails(input.error);
  const route =
    input.route ??
    (typeof window !== "undefined" ? window.location.pathname : undefined);
  const report: DebugReport = {
    timestamp: new Date().toISOString(),
    route,
    environment: getWebDebugMetadata().environment,
    build: getWebDebugMetadata(),
    locale: input.locale ?? getClientLocaleSnapshot(),
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    viewport:
      typeof window !== "undefined"
        ? {
            width: window.innerWidth,
            height: window.innerHeight,
            devicePixelRatio: window.devicePixelRatio
          }
        : undefined,
    flow: input.flow,
    action: input.action,
    requestId: input.requestId ?? api.requestId,
    flowId: input.flowId ?? api.flowId,
    clientTraceId: input.clientTraceId ?? api.clientTraceId,
    api: {
      method: api.method,
      path: api.path,
      status: api.status,
      code: api.code,
      message: api.message,
      durationMs: api.durationMs,
      timeoutMs: api.timeoutMs
    },
    ids: {
      sessionId: input.sessionId,
      branchId: input.branchId,
      tableId: input.tableId,
      orderId: input.orderId,
      taskId: input.taskId,
      ticketId: input.ticketId
    },
    retry: {
      happened: input.retryHappened ?? Boolean(api.retryAttempt && api.retryAttempt > 1),
      attempts: input.retryAttempt ?? api.retryAttempt
    },
    breadcrumbs: input.breadcrumbs ?? getDebugBreadcrumbs(),
    frontendErrorMessage: api.message
  };

  return sanitizeDebugReport(report);
}

export function stringifyDebugReport(report: DebugReport) {
  return JSON.stringify(sanitizeDebugReport(report), null, 2);
}
