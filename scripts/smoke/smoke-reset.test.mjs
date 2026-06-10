import { strict as assert } from "node:assert";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import {
  callSmokeResetEndpoint,
  readSmokeResetConfig,
  renderResetSummary
} from "./smoke-reset.mjs";

describe("smoke reset", () => {
  it("requires reset or bootstrap token and API base URL", () => {
    assert.throws(
      () => readSmokeResetConfig({ SMOKE_ENVIRONMENT: "staging" }),
      /SMOKE_API_BASE_URL/
    );
    assert.throws(
      () =>
        readSmokeResetConfig({
          SMOKE_ENVIRONMENT: "staging",
          SMOKE_API_BASE_URL: "https://api.example.com/api/v1"
        }),
      /SMOKE_RESET_TOKEN or SMOKE_BOOTSTRAP_TOKEN/
    );
  });

  it("blocks production reset locally before any network call", () => {
    assert.throws(
      () =>
        readSmokeResetConfig({
          SMOKE_ENVIRONMENT: "production",
          SMOKE_API_BASE_URL: "https://api.example.com/api/v1",
          SMOKE_RESET_TOKEN: "secret"
        }),
      /disabled in production/
    );
  });

  it("redacts secrets from reset endpoint errors", async () => {
    let receivedToken = "";
    const server = createServer((request, response) => {
      receivedToken = request.headers["x-smoke-bootstrap-token"] ?? "";
      response.statusCode = 401;
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          error: {
            code: "SMOKE_RESET_TOKEN_INVALID",
            message: "token=super-secret failed"
          }
        })
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();

    try {
      let error;

      try {
        await callSmokeResetEndpoint({
          apiBaseUrl: `http://127.0.0.1:${address.port}/api/v1`,
          token: "super-secret",
          requestId: "reset-test"
        });
      } catch (caught) {
        error = caught;
      }

      assert.equal(receivedToken, "super-secret");
      assert.equal(error?.code, "SMOKE_RESET_TOKEN_INVALID");
      assert.doesNotMatch(JSON.stringify(error), /super-secret/);
      assert.match(error?.message ?? "", /\[redacted\]/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("reports reset counts without printing secrets", () => {
    const summary = renderResetSummary({
      company: { id: "company-1" },
      branch: { id: "branch-1" },
      resetAt: "2026-06-10T00:00:00.000Z",
      deleted: {
        orders: 2,
        tableSessions: 1
      },
      token: "super-secret"
    });

    assert.match(summary, /company-1/);
    assert.match(summary, /branch-1/);
    assert.match(summary, /orders: 2/);
    assert.doesNotMatch(summary, /super-secret/);
  });
});
