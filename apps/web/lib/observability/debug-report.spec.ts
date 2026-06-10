import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { ApiError } from "@/lib/api/client";
import {
  buildDebugReport,
  sanitizeDebugReport,
  stringifyDebugReport
} from "./debug-report";

describe("debug report helpers", () => {
  it("removes tokens, cookies, secrets, and raw payload fields", () => {
    const report = sanitizeDebugReport({
      timestamp: "2026-06-09T08:00:00.000Z",
      route: "/customer/session/session-1/cart",
      environment: "staging",
      build: {
        environment: "staging",
        buildSha: "sha",
        buildTime: "time",
        appVersion: "0.1.0"
      },
      api: {
        method: "POST",
        path: "/cart/submit",
        status: 500,
        code: "CART_SUBMIT_FAILED",
        message: "token=abc cookie=session raw body hidden"
      },
      breadcrumbs: [
        {
          timestamp: "2026-06-09T08:00:00.000Z",
          action: "submit_cart_clicked",
          route: "/cart",
          requestId: "req-1"
        }
      ],
      ids: { sessionId: "session-1" },
      frontendErrorMessage: "secret=abc",
      token: "customer-token",
      cookie: "session-cookie",
      rawPayload: { customerAccessToken: "nope" }
    } as never);
    const serialized = JSON.stringify(report);

    assert.match(serialized, /req-1/);
    assert.match(serialized, /session-1/);
    assert.match(serialized, /\[redacted\]/);
    assert.doesNotMatch(serialized, /customer-token/);
    assert.doesNotMatch(serialized, /session-cookie/);
    assert.doesNotMatch(serialized, /customerAccessToken/);
  });

  it("includes requestId, route, flow, and build metadata", () => {
    const error = new ApiError("failed", 500, { error: { code: "boom" } }, {
      method: "POST",
      path: "/table-sessions/session-1/cart/submit",
      requestId: "req-123",
      flowId: "customer_order_cycle:session-1",
      clientTraceId: "client-1",
      durationMs: 2200,
      flow: "customer_order_cycle",
      action: "cart_submit"
    });

    const report = buildDebugReport({
      route: "/customer/session/session-1/cart",
      flow: "customer_order_cycle",
      action: "cart_submit",
      sessionId: "session-1",
      locale: "ar",
      error,
      breadcrumbs: []
    });

    assert.equal(report.route, "/customer/session/session-1/cart");
    assert.equal(report.flow, "customer_order_cycle");
    assert.equal(report.requestId, "req-123");
    assert.equal(report.clientTraceId, "client-1");
    assert.equal(report.locale, "ar");
    assert.equal(report.api?.durationMs, 2200);
    assert.ok(report.build.buildSha);
    assert.match(stringifyDebugReport(report), /cart_submit/);
    assert.match(stringifyDebugReport(report), /"locale": "ar"/);
  });
});
