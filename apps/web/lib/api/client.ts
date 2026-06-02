import { env } from "@/lib/config/env";
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
};

type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
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

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.length > 0) {
    return payload;
  }

  const apiPayload = payload as ApiErrorPayload;
  const message = apiPayload.message;

  if (Array.isArray(message)) {
    return message.join(", ");
  }

  return message ?? apiPayload.error ?? fallback;
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
    baseUrl
  } = options;
  const requestHeaders = new Headers(headers);

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    signal
  };

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  const response = await fetch(buildApiUrl(path, query, baseUrl), init);

  if (!response.ok) {
    const payload = await readErrorPayload(response);

    throw new ApiError(
      getErrorMessage(payload, `API request failed with ${response.status}`),
      response.status,
      payload
    );
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return response.json() as Promise<TResponse>;
}
