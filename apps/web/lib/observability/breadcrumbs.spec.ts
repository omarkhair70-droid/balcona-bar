import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { sanitizeBreadcrumb } from "./breadcrumbs";

describe("debug breadcrumbs", () => {
  it("keeps only safe fields and redacts secret-looking text", () => {
    const breadcrumb = sanitizeBreadcrumb({
      timestamp: "2026-06-09T08:00:00.000Z",
      action: "api_error token=abc",
      route: "/customer/session/session-1/cart",
      flow: "customer_order_cycle",
      result: "failure",
      requestId: "req-1",
      durationMs: 120,
      status: 500
    });

    assert.deepEqual(breadcrumb, {
      timestamp: "2026-06-09T08:00:00.000Z",
      action: "api_error token=[redacted]",
      route: "/customer/session/session-1/cart",
      flow: "customer_order_cycle",
      result: "failure",
      requestId: "req-1",
      durationMs: 120,
      status: 500
    });
  });

  it("normalizes missing action", () => {
    assert.equal(sanitizeBreadcrumb({ action: "" }).action, "unknown_action");
  });
});
