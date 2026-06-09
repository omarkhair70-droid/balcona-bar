import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  SmokeHttpClient,
  readSmokeConfig,
  safePublicConfig,
  sanitizeValue,
  validateSmokeConfig,
  writeSmokeArtifacts
} from "./smoke-core.mjs";

describe("smoke core", () => {
  it("reports missing base env vars clearly", () => {
    const config = readSmokeConfig({
      env: {},
      argv: ["--mode", "safe"],
      envFile: "missing-smoke-env-file"
    });

    assert.deepEqual(validateSmokeConfig(config), [
      "SMOKE_WEB_BASE_URL",
      "SMOKE_API_BASE_URL"
    ]);
  });

  it("redacts secrets from printable config", () => {
    const config = readSmokeConfig({
      env: {
        SMOKE_WEB_BASE_URL: "https://web.example.com",
        SMOKE_API_BASE_URL: "https://api.example.com/api/v1",
        SMOKE_CASHIER_EMAIL: "cashier@example.com",
        SMOKE_CASHIER_PASSWORD: "super-secret"
      },
      argv: [],
      envFile: "missing-smoke-env-file"
    });
    const serialized = JSON.stringify(safePublicConfig(config));

    assert.match(serialized, /cashier/);
    assert.match(serialized, /passwordPresent/);
    assert.doesNotMatch(serialized, /super-secret/);
  });

  it("sanitizes tokens, cookies, passwords, and bearer credentials", () => {
    const sanitized = sanitizeValue({
      password: "pw",
      cookie: "session=abc",
      nested: {
        message: "Authorization Bearer abc.def.ghi token=raw"
      }
    });
    const serialized = JSON.stringify(sanitized);

    assert.doesNotMatch(serialized, /pw/);
    assert.doesNotMatch(serialized, /session=abc/);
    assert.doesNotMatch(serialized, /abc\.def\.ghi/);
    assert.doesNotMatch(serialized, /token=raw/);
    assert.match(serialized, /\[redacted\]/);
  });

  it("writes JSON, markdown, and summary artifacts", async () => {
    const dir = await mkdtemp(join(tmpdir(), "balcona-smoke-"));

    try {
      await writeSmokeArtifacts(
        {
          runId: "run-1",
          environment: "staging",
          mode: "safe",
          score: {
            overallResult: "PASS",
            totalSteps: 1,
            passed: 1,
            passedWithRetry: 0,
            warnings: 0,
            skipped: 0,
            failed: 0,
            slowRequestsCount: 0,
            totalDurationMs: 10
          },
          timings: { totalRunDurationMs: 10 },
          steps: [],
          coverage: {},
          failureBundles: []
        },
        dir
      );

      assert.match(await readFile(join(dir, "latest.json"), "utf8"), /run-1/);
      assert.match(await readFile(join(dir, "latest.md"), "utf8"), /Final Score/);
      assert.match(
        await readFile(join(dir, "latest-summary.txt"), "utf8"),
        /Overall result: PASS/
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("captures requestId and duration safely in the HTTP helper", async () => {
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.setHeader("X-Request-Id", "req-test");
      response.end(JSON.stringify({ ok: true, path: request.url }));
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();

    try {
      const client = new SmokeHttpClient({
        apiBaseUrl: `http://127.0.0.1:${address.port}/api/v1`,
        timeoutMs: 5_000,
        runId: "run-test",
        clientTraceId: "client-test"
      });
      const result = await client.request({
        path: "/system/info",
        role: "system",
        action: "system_info"
      });

      assert.equal(result.requestId, "req-test");
      assert.equal(result.clientTraceId, "client-test");
      assert.equal(result.statusCode, 200);
      assert.ok(result.durationMs >= 0);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("sends bearer tokens without exposing them in request errors", async () => {
    let authorizationHeader = "";
    const server = createServer((request, response) => {
      authorizationHeader = request.headers.authorization ?? "";
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json");
      response.setHeader("X-Request-Id", "req-error");
      response.end(
        JSON.stringify({
          error: {
            code: "TEST_FAILURE",
            message: "failed safely"
          }
        })
      );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const token = "customer-secret-token";

    try {
      const client = new SmokeHttpClient({
        apiBaseUrl: `http://127.0.0.1:${address.port}/api/v1`,
        timeoutMs: 5_000,
        runId: "run-test",
        clientTraceId: "client-test"
      });
      let error;

      try {
        await client.request({
          path: "/table-sessions/session-1/cart",
          role: "customer",
          action: "cart_get",
          token
        });
      } catch (caught) {
        error = caught;
      }

      assert.equal(authorizationHeader, `Bearer ${token}`);
      assert.equal(error?.requestId, "req-error");
      assert.doesNotMatch(JSON.stringify(error), /customer-secret-token/);
      assert.doesNotMatch(JSON.stringify(error), /Bearer/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("uses a valid waiter call status filter in the staging runner", async () => {
    const source = await readFile(
      new URL("./staging-smoke.mjs", import.meta.url),
      "utf8"
    );
    const waiterCallListBlock = source.match(
      /action: "waiter_call_list"[\s\S]{0,160}?query: \{ status: "([^"]+)" \}/
    );

    assert.equal(waiterCallListBlock?.[1], "all");
    assert.doesNotMatch(
      waiterCallListBlock?.[0] ?? "",
      /status: "active"/
    );
  });
});
