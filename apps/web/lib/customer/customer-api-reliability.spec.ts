import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ApiError } from "@/lib/api/client";
import {
  isBusinessCustomerApiError,
  isTransientCustomerApiError,
  withCustomerTransientRetry
} from "./customer-api-reliability";

describe("customer API reliability", () => {
  it("classifies only network/timeouts and gateway failures as transient", () => {
    assert.equal(
      isTransientCustomerApiError(
        new ApiError("network failed", 0, { code: "network_error" })
      ),
      true
    );
    assert.equal(
      isTransientCustomerApiError(new ApiError("bad gateway", 502, {})),
      true
    );
    assert.equal(
      isTransientCustomerApiError(new ApiError("validation failed", 400, {})),
      false
    );
    assert.equal(
      isTransientCustomerApiError(new ApiError("unauthorized", 401, {})),
      false
    );
  });

  it("treats validation and auth statuses as business errors", () => {
    assert.equal(
      isBusinessCustomerApiError(new ApiError("validation failed", 400, {})),
      true
    );
    assert.equal(
      isBusinessCustomerApiError(new ApiError("not found", 404, {})),
      true
    );
  });

  it("retries a transient failure and then returns success", async () => {
    let calls = 0;

    const result = await withCustomerTransientRetry(
      async () => {
        calls += 1;

        if (calls === 1) {
          throw new ApiError("gateway timeout", 504, {});
        }

        return "ok";
      },
      {
        flow: "submit_cart",
        maxAttempts: 2,
        initialDelayMs: 0
      }
    );

    assert.equal(result, "ok");
    assert.equal(calls, 2);
  });

  it("does not retry business errors", async () => {
    let calls = 0;

    await assert.rejects(
      () =>
        withCustomerTransientRetry(
          async () => {
            calls += 1;
            throw new ApiError("missing modifier", 400, {});
          },
          {
            flow: "add_cart_item",
            maxAttempts: 3,
            initialDelayMs: 0
          }
        ),
      ApiError
    );
    assert.equal(calls, 1);
  });
});
