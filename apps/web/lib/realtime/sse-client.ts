import {
  fetchEventSource,
  type EventSourceMessage
} from "@microsoft/fetch-event-source";

export type SseClientOptions = {
  url: string;
  token?: string;
  headers?: HeadersInit;
  signal?: AbortSignal;
  onMessage: (message: EventSourceMessage) => void;
  onError?: (error: Error) => void;
};

export function connectSse({
  url,
  token,
  headers,
  signal,
  onMessage,
  onError
}: SseClientOptions) {
  const requestHeaders = new Headers(headers);
  const headerRecord: Record<string, string> = {};

  if (token) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  requestHeaders.forEach((value, key) => {
    headerRecord[key] = value;
  });

  const controller = signal ? null : new AbortController();
  const activeSignal = signal ?? controller?.signal;

  void fetchEventSource(url, {
    method: "GET",
    headers: headerRecord,
    signal: activeSignal,
    onmessage: onMessage,
    onerror(error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));

      onError?.(normalizedError);
    }
  }).catch((error: unknown) => {
    if (activeSignal?.aborted) {
      return;
    }

    onError?.(error instanceof Error ? error : new Error(String(error)));
  });

  return {
    abort() {
      controller?.abort();
    }
  };
}
