import { randomUUID } from "crypto";
import { HttpStatus } from "@nestjs/common";
import { Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";
export const FLOW_ID_HEADER = "x-flow-id";
export const CLIENT_TRACE_ID_HEADER = "x-client-trace-id";

export type CorrelationContext = {
  requestId: string;
  flowId: string;
  clientTraceId: string;
};

export type SafeExceptionSummary = {
  name?: string;
  message: string;
  code?: string;
  prismaCode?: string;
};

const SAFE_ID_KEYS = [
  "sessionId",
  "tableSessionId",
  "orderId",
  "taskId",
  "preparationTaskId",
  "ticketId",
  "kitchenTicketId",
  "branchId",
  "companyId",
] as const;

type SafeIdKey = (typeof SAFE_ID_KEYS)[number];

export function normalizeHeaderId(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string") {
    return undefined;
  }

  const normalized = raw.trim();

  if (!normalized || normalized.length > 160) {
    return undefined;
  }

  return redactSensitiveText(normalized);
}

export function createCorrelationContext(request: Request) {
  return {
    requestId:
      normalizeHeaderId(request.header(REQUEST_ID_HEADER)) ?? randomUUID(),
    flowId: normalizeHeaderId(request.header(FLOW_ID_HEADER)) ?? randomUUID(),
    clientTraceId:
      normalizeHeaderId(request.header(CLIENT_TRACE_ID_HEADER)) ?? randomUUID(),
  };
}

export function attachCorrelationHeaders(
  response: Response,
  context: CorrelationContext,
) {
  response.setHeader(REQUEST_ID_HEADER, context.requestId);
  response.setHeader(FLOW_ID_HEADER, context.flowId);
  response.setHeader(CLIENT_TRACE_ID_HEADER, context.clientTraceId);
}

export function getCorrelationContext(
  request: Request,
  response?: Response,
): CorrelationContext {
  const locals = response?.locals as
    | { correlation?: Partial<CorrelationContext> }
    | undefined;
  const requestWithCorrelation = request as Request & {
    correlation?: Partial<CorrelationContext>;
  };

  return {
    requestId:
      normalizeHeaderId(locals?.correlation?.requestId) ??
      normalizeHeaderId(requestWithCorrelation.correlation?.requestId) ??
      normalizeHeaderId(request.header(REQUEST_ID_HEADER)) ??
      normalizeHeaderId(response?.getHeader(REQUEST_ID_HEADER)) ??
      randomUUID(),
    flowId:
      normalizeHeaderId(locals?.correlation?.flowId) ??
      normalizeHeaderId(requestWithCorrelation.correlation?.flowId) ??
      normalizeHeaderId(request.header(FLOW_ID_HEADER)) ??
      normalizeHeaderId(response?.getHeader(FLOW_ID_HEADER)) ??
      randomUUID(),
    clientTraceId:
      normalizeHeaderId(locals?.correlation?.clientTraceId) ??
      normalizeHeaderId(requestWithCorrelation.correlation?.clientTraceId) ??
      normalizeHeaderId(request.header(CLIENT_TRACE_ID_HEADER)) ??
      normalizeHeaderId(response?.getHeader(CLIENT_TRACE_ID_HEADER)) ??
      randomUUID(),
  };
}

export function setRequestCorrelation(
  request: Request,
  response: Response,
  context: CorrelationContext,
) {
  const requestWithCorrelation = request as Request & {
    correlation?: CorrelationContext;
  };

  requestWithCorrelation.correlation = context;
  response.locals.correlation = context;
  attachCorrelationHeaders(response, context);
}

export function safeRequestPath(request: Request) {
  return request.path || request.url.split("?")[0] || request.url;
}

export function extractSafeIds(request: Request) {
  const ids: Partial<Record<SafeIdKey, string>> = {};
  const sources = [request.params, request.body] as unknown[];

  for (const source of sources) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
      continue;
    }

    const record = source as Record<string, unknown>;

    for (const key of SAFE_ID_KEYS) {
      const value = record[key];

      if (typeof value === "string" && value.trim()) {
        ids[key] = redactSensitiveText(value.trim()).slice(0, 160);
      }
    }
  }

  return ids;
}

export function inferActionFromRequest(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();

  if (normalizedMethod === "POST" && path.endsWith("/table-sessions/start")) {
    return "table_session_start";
  }

  if (path.includes("/cart/submit")) {
    return "cart_submit";
  }

  if (path.includes("/cart/items")) {
    return normalizedMethod === "GET" ? "cart_get" : "cart_add_item";
  }

  if (path.endsWith("/cart")) {
    return "cart_get";
  }

  if (path.includes("/ai-waiter/cart-proposals/") && path.endsWith("/apply")) {
    return "ai_proposal_apply";
  }

  if (path.includes("/waiter-calls")) {
    return normalizedMethod === "GET"
      ? "waiter_call_list"
      : "waiter_call_create";
  }

  if (path.includes("/bill/request")) {
    return "bill_request_create";
  }

  if (path.includes("/cashier/accept")) {
    return "cashier_accept";
  }

  if (path.includes("/cashier/reject")) {
    return "cashier_reject";
  }

  if (path.includes("/kitchen-tickets")) {
    return normalizedMethod === "GET"
      ? "kitchen_ticket_list"
      : "kitchen_ticket_action";
  }

  if (path.includes("/preparation-tasks/") && path.endsWith("/start")) {
    return "preparation_task_start";
  }

  if (path.includes("/preparation-tasks/") && path.endsWith("/ready")) {
    return "preparation_task_ready";
  }

  if (path.includes("/preparation-tasks/") && path.endsWith("/cancel")) {
    return "preparation_task_cancel";
  }

  if (path.endsWith("/serve")) {
    return "order_serve";
  }

  if (path.endsWith("/complete")) {
    return "order_complete";
  }

  if (path.endsWith("/cancel")) {
    return "order_cancel";
  }

  return undefined;
}

export function resultFromStatus(statusCode: number) {
  if (statusCode >= 500) {
    return "failure";
  }

  if (statusCode >= 400) {
    return "failure";
  }

  if (statusCode === 304) {
    return "skipped";
  }

  return "success";
}

export function operationalCodeFromException(
  exception: unknown,
  fallbackStatus = HttpStatus.INTERNAL_SERVER_ERROR,
) {
  const prismaCode = prismaCodeFromException(exception);

  if (prismaCode === "P2028") {
    return "DB_TRANSACTION_TIMEOUT";
  }

  if (prismaCode === "P2021" || prismaCode === "P2022") {
    return "MIGRATION_NOT_APPLIED";
  }

  if (prismaCode === "P1014") {
    return "DATABASE_SCHEMA_MISMATCH";
  }

  const message = messageFromValue(exception).toLowerCase();

  if (
    message.includes("does not exist") ||
    message.includes("no such table") ||
    message.includes("column") ||
    message.includes("relation")
  ) {
    return "DATABASE_SCHEMA_MISMATCH";
  }

  if (fallbackStatus >= 500) {
    return "UNKNOWN_OPERATIONAL_ERROR";
  }

  return undefined;
}

export function prismaCodeFromException(exception: unknown) {
  if (!exception || typeof exception !== "object") {
    return undefined;
  }

  const record = exception as Record<string, unknown>;
  const code = record.code;

  return typeof code === "string" && /^P\d{4}$/.test(code) ? code : undefined;
}

export function safeExceptionSummary(exception: unknown): SafeExceptionSummary {
  if (exception instanceof Error) {
    const message =
      exception.message.trim() || exception.name || "Unexpected exception";

    return {
      name: exception.name,
      message: redactSensitiveText(message),
      code: stringProperty(exception, "code"),
      prismaCode: prismaCodeFromException(exception),
    };
  }

  if (typeof exception === "string") {
    return {
      message: redactSensitiveText(exception.trim() || "Non-error exception"),
    };
  }

  if (exception && typeof exception === "object") {
    const message =
      messageFromValue(exception) ??
      stringProperty(exception, "name") ??
      "Non-error exception";

    return {
      name: exception.constructor?.name ?? "object",
      message: redactSensitiveText(message),
      code: stringProperty(exception, "code"),
      prismaCode: prismaCodeFromException(exception),
    };
  }

  return {
    name: typeof exception,
    message: "Non-error exception",
  };
}

export function sanitizeJson(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return undefined;
  }

  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    return normalized ? redactSensitiveText(normalized) : undefined;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => sanitizeJson(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, entryValue] of Object.entries(value).slice(0, 30)) {
    if (isSensitiveKey(key)) {
      continue;
    }

    const sanitizedValue = sanitizeJson(entryValue, depth + 1);

    if (sanitizedValue !== undefined) {
      sanitized[key] = sanitizedValue;
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

export function messageFromValue(value: unknown, depth = 0): string {
  if (depth > 4) {
    return "";
  }

  if (typeof value === "string") {
    const normalized = value.trim();

    return normalized && normalized !== "[object Object]" ? normalized : "";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => messageFromValue(item, depth + 1))
      .filter(Boolean)
      .join(", ");
  }

  if (!value || typeof value !== "object") {
    return "";
  }

  const record = value as Record<string, unknown>;

  return (
    messageFromValue(record.message, depth + 1) ||
    messageFromValue(record.details, depth + 1) ||
    messageFromValue(record.error, depth + 1) ||
    messageFromValue(record.response, depth + 1)
  );
}

export function isSensitiveKey(key: string) {
  return /password|passwd|pwd|secret|token|api[_-]?key|authorization|cookie|env|connection|string|url|body|payload|note|messageContent|raw/i.test(
    key,
  );
}

export function redactSensitiveText(value: string) {
  const redacted = value
    .replace(/(authorization\s*[:=]\s*bearer\s+)([^,\s}]+)/gi, "$1[redacted]")
    .replace(
      /(password|passwd|pwd|secret|token|api[_-]?key|cookie)(\s*[:=]\s*)([^,\s}]+)/gi,
      "$1$2[redacted]",
    )
    .replace(/(bearer\s+)([a-z0-9._-]+)/gi, "$1[redacted]")
    .replace(/(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi, "$1[redacted]$3");

  return redacted.length > 1_000 ? `${redacted.slice(0, 1_000)}...` : redacted;
}

export function stringProperty(value: object, key: string) {
  const property = (value as Record<string, unknown>)[key];

  return typeof property === "string"
    ? redactSensitiveText(property)
    : undefined;
}
