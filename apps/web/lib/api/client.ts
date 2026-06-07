import { env } from "@/lib/config/env";
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
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
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

export function buildApiUrl(
  path: string,
  query?: ApiQueryParams,
  baseUrl = env.NEXT_PUBLIC_API_BASE_URL
) {
  const url = new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);

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
    timeoutMs
  } = options;
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const requestSignal = createRequestSignal(signal, timeoutMs);
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

  try {
    response = await fetch(buildApiUrl(path, query, baseUrl), init);
  } catch (error) {
    if (requestSignal.didTimeout() && timeoutMs) {
      throw new ApiError(
        `The API did not respond within ${timeoutLabel(timeoutMs)}.`,
        0,
        { code: "client_timeout", timeoutMs }
      );
    }

    if (signal?.aborted) {
      throw error;
    }

    throw new ApiError(
      "The API could not be reached. Check the staging API URL and try again.",
      0,
      { code: "network_error" }
    );
  } finally {
    requestSignal.cleanup();
  }

  if (!response.ok) {
    const payload = await readErrorPayload(response);

    throw new ApiError(
      formatErrorMessage(payload, `API request failed with ${response.status}`),
      response.status,
      payload
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
