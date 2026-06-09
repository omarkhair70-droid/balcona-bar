import { Logger } from "@nestjs/common";
import {
  requestIdMiddleware,
  requestObservabilityMiddleware,
} from "./request-id.middleware";

function createRequest(headers: Record<string, string | undefined> = {}) {
  return {
    method: "POST",
    path: "/api/v1/table-sessions/session-1/cart/submit",
    url: "/api/v1/table-sessions/session-1/cart/submit?token=secret",
    params: { sessionId: "session-1" },
    body: { orderId: "order-1", customerNote: "do not log" },
    header: jest.fn((name: string) => headers[name.toLowerCase()]),
  };
}

function createResponse() {
  const listeners = new Map<string, (value?: unknown) => void>();
  const headers: Record<string, string> = {};

  return {
    statusCode: 200,
    locals: {},
    setHeader: jest.fn((name: string, value: string) => {
      headers[name.toLowerCase()] = value;
    }),
    getHeader: jest.fn((name: string) => headers[name.toLowerCase()]),
    once: jest.fn((event: string, listener: (value?: unknown) => void) => {
      listeners.set(event, listener);
    }),
    emitFinish: () => listeners.get("finish")?.(),
  };
}

describe("request observability middleware", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("accepts incoming correlation IDs and returns them as response headers", () => {
    const request = createRequest({
      "x-request-id": "req-1",
      "x-flow-id": "flow-1",
      "x-client-trace-id": "client-1",
    });
    const response = createResponse();
    const next = jest.fn();

    requestIdMiddleware(request as never, response as never, next);

    expect(next).toHaveBeenCalled();
    expect(response.getHeader("x-request-id")).toBe("req-1");
    expect(response.getHeader("x-flow-id")).toBe("flow-1");
    expect(response.getHeader("x-client-trace-id")).toBe("client-1");
  });

  it("logs safe request completion fields without query secrets or raw notes", () => {
    const logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
    const request = createRequest({
      "x-request-id": "req-2",
      "x-flow-id": "flow-2",
      "x-client-trace-id": "client-2",
    });
    const response = createResponse();

    requestIdMiddleware(request as never, response as never, jest.fn());
    requestObservabilityMiddleware({ environment: "staging" })(
      request as never,
      response as never,
      jest.fn(),
    );
    response.emitFinish();

    const serialized = JSON.stringify(logSpy.mock.calls);

    expect(serialized).toContain("request_started");
    expect(serialized).toContain("request_completed");
    expect(serialized).toContain("cart_submit");
    expect(serialized).toContain("req-2");
    expect(serialized).toContain("session-1");
    expect(serialized).toContain("order-1");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("do not log");
  });
});
