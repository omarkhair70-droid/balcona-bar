import {
  configuredApiUpstreamBaseUrl,
  env
} from "@/lib/config/env";
import { addDebugBreadcrumb } from "@/lib/observability/breadcrumbs";
import { getWebDebugMetadata } from "@/lib/observability/metadata";
import { formatErrorMessage } from "./error-message";
import type { ApiQueryParams, ApiQueryValue } from "./types";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type ApiRequestOptions<TBody = unknown> = {
  method?: HttpMethod;
  body?: TBody;
  token?: string;
  headers?: HeadersInit;
  query?: ApiQueryParams;
  signal?: AbortSignal;
  baseUrl?: string;
  timeoutMs?: number;
  flow?: string;
  action?: string;
  flowId?: string;
  sessionId?: string;
  orderId?: string;
  taskId?: string;
  ticketId?: string;
  attempt?: number;
  idempotencyKeyPresent?: boolean;
};

export class ApiError extends Error {
  status: number;
  details: unknown;
  method?: string;
  path?: string;
  requestId?: string;
  flowId?: string;
  clientTraceId?: string;
  code?: string;
  durationMs?: number;
  timeoutMs?: number;
  flow?: string;
  action?: string;
  attempt?: number;
  buildSha?: string;
  environment?: string;

  constructor(
    message: string,
    status: number,
    details: unknown,
    metadata: {
      method?: string;
      path?: string;
      requestId?: string;
      flowId?: string;
      clientTraceId?: string;
      code?: string;
      durationMs?: number;
      timeoutMs?: number;
      flow?: string;
      action?: string;
      attempt?: number;
    } = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
    this.method = metadata.method;
    this.path = metadata.path;
    this.requestId = metadata.requestId;
    this.flowId = metadata.flowId;
    this.clientTraceId = metadata.clientTraceId;
    this.code = metadata.code;
    this.durationMs = metadata.durationMs;
    this.timeoutMs = metadata.timeoutMs;
    this.flow = metadata.flow;
    this.action = metadata.action;
    this.attempt = metadata.attempt;
    this.buildSha = getWebDebugMetadata().buildSha;
    this.environment = getWebDebugMetadata().environment;
  }
}

function timeoutLabel(timeoutMs: number) {
  const seconds = Math.round(timeoutMs / 1000);

  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}

function createRequestSignal(signal?: AbortSignal, timeoutMs?: number) {
  if (!timeoutMs) {
    return {
      signal,
      didTimeout: () => false,
      cleanup: () => undefined
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();

  if (signal?.aborted) {
    controller.abort();
  } else {
    signal?.addEventListener("abort", onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onAbort);
    }
  };
}

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `trace-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function browserStorage(kind: "localStorage" | "sessionStorage") {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window[kind];
  } catch {
    return undefined;
  }
}

function getClientTraceId() {
  const key = "balcona.debug.clientTraceId";
  const storage = browserStorage("sessionStorage");
  const existing = storage?.getItem(key);

  if (existing) {
    return existing;
  }

  const next = randomId();

  try {
    storage?.setItem(key, next);
  } catch {
    return next;
  }

  return next;
}

function getFlowId(options: ApiRequestOptions<unknown>) {
  if (options.flowId) {
    return options.flowId;
  }

  const flow = options.flow ?? "api";
  const id = options.sessionId ?? options.orderId ?? options.taskId ?? options.ticketId;

  if (id) {
    return `${flow}:${id}`;
  }

  const key = `balcona.debug.flow.${flow}`;
  const storage = browserStorage("sessionStorage");
  const existing = storage?.getItem(key);

  if (existing) {
    return existing;
  }

  const next = `${flow}:${randomId()}`;

  try {
    storage?.setItem(key, next);
  } catch {
    return next;
  }

  return next;
}

function responseCode(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const nestedError = record.error;

  if (
    nestedError &&
    typeof nestedError === "object" &&
    !Array.isArray(nestedError)
  ) {
    const code = (nestedError as Record<string, unknown>).code;

    return typeof code === "string" ? code : undefined;
  }

  return typeof record.code === "string" ? record.code : undefined;
}

function requestIdFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  const record = payload as Record<string, unknown>;
  const direct = record.requestId;

  if (typeof direct === "string") {
    return direct;
  }

  return requestIdFromPayload(record.error) ?? requestIdFromPayload(record.details);
}

function appendQueryValue(
  searchParams: URLSearchParams,
  key: string,
  value: ApiQueryValue
) {
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(searchParams, key, item));
    return;
  }

  if (value !== null && value !== undefined) {
    searchParams.append(key, String(value));
  }
}

function resolveApiBaseUrl(baseUrl: string) {
  if (!baseUrl.startsWith("/")) {
    return baseUrl;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${baseUrl}`;
  }

  return configuredApiUpstreamBaseUrl;
}

export function buildApiUrl(
  path: string,
  query?: ApiQueryParams,
  baseUrl = env.NEXT_PUBLIC_API_BASE_URL
) {
  const resolvedBaseUrl = resolveApiBaseUrl(baseUrl);
  const url = new URL(
    path.replace(/^\//, ""),
    `${resolvedBaseUrl.replace(/\/$/, "")}/`
  );

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      appendQueryValue(url.searchParams, key, value);
    });
  }

  return url.toString();
}

async function readErrorPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {}
): Promise<TResponse> {
  const {
    method = options.body === undefined ? "GET" : "POST",
    body,
    token,
    headers,
    query,
    signal,
    baseUrl,
    timeoutMs,
    flow,
    action,
    attempt
  } = options;
  const requestHeaders = new Headers(headers);
  const requestId = randomId();
  const flowId = getFlowId(options);
  const clientTraceId = getClientTraceId();
  const startedAt = performance.now();

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  requestHeaders.set("X-Request-Id", requestId);
  requestHeaders.set("X-Flow-Id", flowId);
  requestHeaders.set("X-Client-Trace-Id", clientTraceId);

  const requestSignal = createRequestSignal(signal, timeoutMs);
  const requestUrl = buildApiUrl(path, query, baseUrl);
  const init: RequestInit = {
    method,
    headers: requestHeaders,
    signal: requestSignal.signal
  };

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  let response: Response;
  addDebugBreadcrumb({
    action: action ?? `api_${method.toLowerCase()}`,
    route: typeof window !== "undefined" ? window.location.pathname : path,
    flow,
    result: "started",
    requestId,
    flowId,
    clientTraceId
  });

  try {
    response = await fetch(requestUrl, init);
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    if (requestSignal.didTimeout() && timeoutMs) {
      addDebugBreadcrumb({
        action: action ?? `api_${method.toLowerCase()}`,
        route: typeof window !== "undefined" ? window.location.pathname : path,
        flow,
        result: "failure",
        requestId,
        flowId,
        clientTraceId,
        durationMs,
        status: 0
      });
      throw new ApiError(
        `The API did not respond within ${timeoutLabel(timeoutMs)}.`,
        0,
        { code: "client_timeout", timeoutMs },
        {
          method,
          path,
          requestId,
          flowId,
          clientTraceId,
          code: "client_timeout",
          durationMs,
          timeoutMs,
          flow,
          action,
          attempt
        }
      );
    }

    if (signal?.aborted) {
      throw error;
    }

    addDebugBreadcrumb({
      action: action ?? `api_${method.toLowerCase()}`,
      route: typeof window !== "undefined" ? window.location.pathname : path,
      flow,
      result: "failure",
      requestId,
      flowId,
      clientTraceId,
      durationMs,
      status: 0
    });
    throw new ApiError(
      "The API could not be reached. Check the staging API URL and try again.",
      0,
      { code: "network_error" },
      {
        method,
        path,
        requestId,
        flowId,
        clientTraceId,
        code: "network_error",
        durationMs,
        flow,
        action,
        attempt
      }
    );
  } finally {
    requestSignal.cleanup();
  }

  const durationMs = Math.round(performance.now() - startedAt);
  const responseRequestId =
    response.headers.get("x-request-id") ??
    response.headers.get("X-Request-Id") ??
    requestId;

  if (!response.ok) {
    const payload = await readErrorPayload(response);
    const code = responseCode(payload);
    const safeMessage = formatErrorMessage(
      payload,
      `API request failed with ${response.status}`
    );

    addDebugBreadcrumb({
      action: action ?? `api_${method.toLowerCase()}`,
      route: typeof window !== "undefined" ? window.location.pathname : path,
      flow,
      result: "failure",
      requestId: responseRequestId,
      flowId,
      clientTraceId,
      durationMs,
      status: response.status
    });

    throw new ApiError(
      safeMessage,
      response.status,
      payload,
      {
        method,
        path,
        requestId: requestIdFromPayload(payload) ?? responseRequestId,
        flowId,
        clientTraceId,
        code,
        durationMs,
        timeoutMs,
        flow,
        action,
        attempt
      }
    );
  }

  addDebugBreadcrumb({
    action: action ?? `api_${method.toLowerCase()}`,
    route: typeof window !== "undefined" ? window.location.pathname : path,
    flow,
    result: "success",
    requestId: responseRequestId,
    flowId,
    clientTraceId,
    durationMs,
    status: response.status
  });

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
