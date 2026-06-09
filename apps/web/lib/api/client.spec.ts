import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ApiError } from "./client";

describe("ApiError", () => {
  it("preserves safe request diagnostics", () => {
    const error = new ApiError("failed", 503, { error: { code: "UPSTREAM" } }, {
      method: "POST",
      path: "/table-sessions/session-1/cart/submit",
      requestId: "req-1",
      flowId: "customer_order_cycle:session-1",
      clientTraceId: "client-1",
      code: "CART_SUBMIT_FAILED",
      durationMs: 2100,
      timeoutMs: 12000,
      flow: "customer_order_cycle",
      action: "cart_submit",
      attempt: 2
    });

    assert.equal(error.status, 503);
    assert.equal(error.requestId, "req-1");
    assert.equal(error.flowId, "customer_order_cycle:session-1");
    assert.equal(error.clientTraceId, "client-1");
    assert.equal(error.durationMs, 2100);
    assert.equal(error.timeoutMs, 12000);
    assert.equal(error.attempt, 2);
    assert.ok(error.buildSha);
    assert.ok(error.environment);
  });
});
