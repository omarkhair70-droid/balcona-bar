import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  SmokeHttpClient,
  SmokeRun,
  readSmokeConfig,
  safePublicConfig,
  sanitizeValue,
  validateSmokeConfig,
  writeSmokeArtifacts
} from "./smoke-core.mjs";
import {
  assertRecordMatchesCurrentFlow,
  extractSubmittedOrder,
  selectCurrentCashierOrder,
  summarizeOrderCandidates
} from "./staging-smoke.mjs";

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

  it("uses a valid waiter call acknowledge payload in the staging runner", async () => {
    const source = await readFile(
      new URL("./staging-smoke.mjs", import.meta.url),
      "utf8"
    );
    const waiterAcknowledgeBlock = source.match(
      /action: "waiter_call_acknowledge"[\s\S]{0,120}?body: \{\s*\}/
    );

    assert.ok(waiterAcknowledgeBlock);
    assert.doesNotMatch(waiterAcknowledgeBlock[0], /\bnote\b/);
  });

  it("uses valid preparation task action payloads in the staging runner", async () => {
    const source = await readFile(
      new URL("./staging-smoke.mjs", import.meta.url),
      "utf8"
    );
    const startBlock = source.match(
      /action: "preparation_task_start"[\s\S]{0,160}?body: \{\s*\}/
    );
    const readyBlock = source.match(
      /action: "preparation_task_ready"[\s\S]{0,160}?body: \{\s*\}/
    );

    assert.ok(startBlock);
    assert.ok(readyBlock);
    assert.doesNotMatch(startBlock[0], /\bnote\b/);
    assert.doesNotMatch(readyBlock[0], /\bnote\b/);
  });

  it("extracts the current submit cart order from the submit response", () => {
    const order = extractSubmittedOrder(
      {
        order: {
          id: "order-current",
          tableSessionId: "session-current",
          orderNumber: "S-001",
          status: "submitted",
          submittedAt: "2026-06-10T00:00:00.000Z"
        }
      },
      "session-current"
    );

    assert.equal(order.id, "order-current");
    assert.equal(order.tableSessionId, "session-current");
    assert.equal(order.status, "submitted");
  });

  it("captures the final successful orderId when submit passes after retry", async () => {
    const run = new SmokeRun({
      runId: "run-retry",
      retryTransient: true,
      timeoutMs: 5_000,
      clientTraceId: "client-retry"
    });
    let attempts = 0;

    const step = await run.step(
      {
        stepName: "customer submit cart",
        role: "customer",
        pageOrEndpoint: "/table-sessions/session-current/cart/submit",
        method: "POST",
        group: "customer",
        retryable: true
      },
      async () => {
        attempts += 1;

        if (attempts === 1) {
          throw new Error("transient timeout");
        }

        const body = {
          order: {
            id: "order-after-retry",
            tableSessionId: "session-current",
            status: "submitted"
          }
        };
        const order = extractSubmittedOrder(body, "session-current");

        return {
          http: {
            body,
            requestId: "req-success",
            durationMs: 100,
            flowId: "flow-submit",
            clientTraceId: "client-retry"
          },
          entityIds: {
            orderId: order.id,
            submittedOrderId: order.id,
            tableSessionId: order.tableSessionId,
            orderStatus: order.status
          }
        };
      }
    );

    assert.equal(step.status, "passed_with_retry");
    assert.equal(run.entityIds.orderId, "order-after-retry");
    assert.equal(run.entityIds.submittedOrderId, "order-after-retry");
  });

  it("selects the current cashier order instead of stale branch orders", () => {
    const selected = selectCurrentCashierOrder(
      {
        orders: [
          {
            id: "stale-order",
            tableSessionId: "old-session",
            status: "submitted"
          },
          {
            id: "current-order",
            tableSessionId: "current-session",
            status: "submitted"
          }
        ]
      },
      { orderId: "current-order", tableSessionId: "current-session" }
    );

    assert.equal(selected.id, "current-order");
  });

  it("refuses a non-submitted stale cashier order before accept", () => {
    const selected = selectCurrentCashierOrder(
      {
        orders: [
          {
            id: "current-order",
            tableSessionId: "current-session",
            status: "cashier_accepted"
          }
        ]
      },
      { orderId: "current-order", tableSessionId: "current-session" }
    );

    assert.equal(selected, null);
  });

  it("detects downstream order and session mismatches", () => {
    assert.throws(
      () =>
        assertRecordMatchesCurrentFlow(
          { id: "task-1", orderId: "other-order", tableSessionId: "session-1" },
          { kind: "preparation task", orderId: "order-1", tableSessionId: "session-1" }
        ),
      /different order/
    );
    assert.throws(
      () =>
        assertRecordMatchesCurrentFlow(
          { id: "ticket-1", orderId: "order-1", tableSessionId: "other-session" },
          { kind: "kitchen ticket", orderId: "order-1", tableSessionId: "session-1" }
        ),
      /different table session/
    );
  });

  it("includes safe candidate summaries when current order selection fails", () => {
    const summary = summarizeOrderCandidates({
      orders: [
        { id: "stale-order", tableSessionId: "old-session", status: "submitted" }
      ]
    });

    assert.match(summary, /stale-order/);
    assert.match(summary, /old-session/);
  });

  it("documents the clean full smoke command flow", async () => {
    const packageJson = JSON.parse(
      await readFile(new URL("../../package.json", import.meta.url), "utf8")
    );
    const docs = await readFile(
      new URL("../../docs/operations/staging-smoke-runner.md", import.meta.url),
      "utf8"
    );

    assert.match(packageJson.scripts["smoke:staging:clean-full"], /smoke:reset:staging/);
    assert.match(docs, /pnpm smoke:reset:staging/);
    assert.match(docs, /pnpm smoke:bootstrap:staging/);
    assert.match(docs, /pnpm smoke:staging:full/);
  });
});
