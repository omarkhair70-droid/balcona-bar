import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCustomerSessionReady,
  getCustomerSessionReadiness
} from "./customer-session-readiness";

describe("customer session readiness", () => {
  it("waits for persisted customer state hydration", () => {
    const readiness = getCustomerSessionReadiness({
      hasHydrated: false,
      sessionId: "session-1",
      branchId: "branch-1",
      customerAccessToken: "token-1",
      customerAccessTokenExpiresAt: null
    });

    assert.equal(readiness.isReady, false);
    assert.equal(readiness.reason, "hydrating");
  });

  it("requires session id, branch id, and customer access token", () => {
    const missingBranch = getCustomerSessionReadiness({
        hasHydrated: true,
        sessionId: "session-1",
        branchId: undefined,
        customerAccessToken: "token-1",
        customerAccessTokenExpiresAt: null
      });
    const missingToken = getCustomerSessionReadiness({
        hasHydrated: true,
        sessionId: "session-1",
        branchId: "branch-1",
        customerAccessToken: undefined,
        customerAccessTokenExpiresAt: null
      });

    assert.equal(missingBranch.isReady, false);
    assert.equal(missingBranch.reason, "missing_branch");
    assert.equal(missingToken.isReady, false);
    assert.equal(missingToken.reason, "missing_token");
  });

  it("returns the safe values used by customer API calls", () => {
    const ready = assertCustomerSessionReady(
      {
        hasHydrated: true,
        sessionId: "session-1",
        branchId: "branch-1",
        customerAccessToken: "token-1",
        customerAccessTokenExpiresAt: null
      },
      "session-1"
    );

    assert.deepEqual(ready, {
      isReady: true,
      sessionId: "session-1",
      branchId: "branch-1",
      customerAccessToken: "token-1"
    });
  });
});
