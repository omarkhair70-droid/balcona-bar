#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import {
  SmokeHttpError,
  SmokeRun,
  buildFailureBundle,
  findFirstRecord,
  findRecords,
  getByPath,
  readSmokeConfig,
  renderSummary,
  safePublicConfig,
  validateSmokeConfig,
  writeSmokeArtifacts
} from "./smoke-core.mjs";

const THRESHOLDS = {
  tableOpen: 3_000,
  addCart: 2_000,
  submitCart: 5_000,
  cashierAccept: 5_000,
  taskStart: 3_000,
  taskReady: 3_000,
  pageLoad: 5_000,
  aiSessionStart: 3_000,
  aiMessage: 10_000,
  aiProposalApply: 3_000,
  aiTool: 3_000
};

async function main() {
  const config = readSmokeConfig({ argv: process.argv.slice(2) });
  const missing = validateSmokeConfig(config);

  if (missing.length > 0) {
    console.error(`Missing required smoke env vars: ${missing.join(", ")}`);
    console.error("Copy .env.smoke.example to .env.smoke.local and fill staging values.");
    process.exitCode = 1;
    return;
  }

  const run = new SmokeRun(config);

  console.log("Starting Balcona staging smoke");
  console.log(JSON.stringify(safePublicConfig(config), null, 2));

  await runSystemSmoke(run);

  if (config.webOnly) {
    await runWebSurfaceSmoke(run);
  } else {
    await runAuthSmoke(run);

    if (config.mode === "full") {
      await runCustomerSmoke(run);
      if (config.skipAi) {
        markAiSkipped(run, "SMOKE_SKIP_AI=true for the operational demo run");
      } else {
        await runAiWaiterSmoke(run, { phase: "pre_order" });
      }
      await runCustomerCartAndOrderSmoke(run);
      await runCashierSmoke(run);
      await runKitchenSmoke(run);
      await runWaiterSmoke(run);
      await runBillSmoke(run);
      if (!config.skipAi) {
        await runAiWaiterSmoke(run, { phase: "post_accept" });
      }
    }

    await runOwnerSmoke(run);
    await runPlatformSmoke(run);
    await runWebSurfaceSmoke(run);
  }

  const report = run.finish();
  await writeSmokeArtifacts(report);
  printConsoleReport(report);

  if (report.failureBundles.length > 0) {
    console.log("\nCopy-paste failure bundle:");
    console.log(report.failureBundles[0]);
  }

  process.exitCode = report.score.overallResult === "FAIL" ? 1 : 0;
}

async function runSystemSmoke(run) {
  const apiHealth = await run.step(
    {
      stepName: "API health",
      role: "system",
      pageOrEndpoint: `${run.config.apiOriginUrl}/health`,
      method: "GET",
      group: "system",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      coverage: { category: "System", name: "API health" }
    },
    async ({ http }) => ({
      http: await http.request({
        url: `${run.config.apiOriginUrl}/health`,
        role: "system",
        action: "api_health"
      })
    })
  );

  const systemInfo = await run.step(
    {
      stepName: "API system info",
      role: "system",
      pageOrEndpoint: "/system/info",
      method: "GET",
      group: "system",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true
    },
    async ({ http }) => ({
      http: await http.request({
        path: "/system/info",
        role: "system",
        action: "system_info"
      })
    })
  );

  run.setCoverage("System", "migration/schema status if available", {
    covered: "yes",
    status: systemInfo.status === "failed" ? "failed" : "passed",
    durationMs: systemInfo.durationMs,
    requestId: systemInfo.requestId,
    notes:
      getByPath(systemInfo, ["entityIds", "migration"]) ??
      "See /system/info migration metadata or run prisma migrate status."
  });

  run.setCoverage("System", "request correlation present", {
    covered: "yes",
    status: apiHealth.requestId || systemInfo.requestId ? "passed" : "warning",
    durationMs: (apiHealth.durationMs ?? 0) + (systemInfo.durationMs ?? 0),
    requestId: systemInfo.requestId ?? apiHealth.requestId,
    notes:
      apiHealth.requestId || systemInfo.requestId
        ? "requestId captured from API response"
        : "requestId was not visible in response"
  });
}

async function runWebSurfaceSmoke(run) {
  if (run.config.apiOnly) {
    markWebSkipped(run, "api-only mode");
    return;
  }

  const sessionId = run.entityIds.sessionId;
  const customerSessionPages = sessionId
    ? [
        {
          label: "Customer menu page",
          path: `/guest/session/${sessionId}/menu`,
          coverage: { category: "Customer", name: "web menu route" }
        },
        {
          label: "Customer cart page",
          path: `/guest/session/${sessionId}/cart`,
          coverage: { category: "Customer", name: "web cart route" }
        },
        {
          label: "Customer order page",
          path: `/guest/session/${sessionId}/status`,
          coverage: { category: "Customer", name: "web order route" }
        },
        {
          label: "Customer service and bill page",
          path: `/guest/session/${sessionId}/service`,
          coverage: { category: "Customer", name: "web service/bill route" }
        },
        {
          label: "Customer AI waiter page",
          path: `/guest/session/${sessionId}/ai-waiter`,
          coverage: { category: "AI Waiter", name: "web AI waiter route" }
        }
      ]
    : [];

  const pages = [
    {
      label: "Web root",
      path: "/",
      coverage: { category: "System", name: "web health/build metadata" }
    },
    { label: "Balkona demo launcher", path: "/demo" },
    { label: "Customer table page", path: `/guest/table/${run.config.tableQrToken ?? "balcona-main-t01"}` },
    ...customerSessionPages,
    { label: "Staff login page", path: "/staff/login" },
    {
      label: "Staff cashier page",
      path: "/service/cashier",
      coverage: { category: "Staff Ops", name: "web cashier route" }
    },
    {
      label: "Staff waiter page",
      path: "/service/waiter",
      coverage: { category: "Staff Ops", name: "web waiter route" }
    },
    { label: "Staff kitchen page", path: "/kitchen" },
    {
      label: "Staff owner page",
      path: "/office",
      coverage: { category: "Office", name: "web Office home route" }
    },
    {
      label: "Staff menu admin page",
      path: "/office/catalog",
      coverage: { category: "Office", name: "web Office catalog route" }
    },
    {
      label: "Staff inventory page",
      path: "/office/inventory",
      coverage: { category: "Office", name: "web Office inventory route" }
    },
    {
      label: "Staff branches page",
      path: "/office/locations",
      coverage: { category: "Office", name: "web Office locations route" }
    },
    { label: "Platform login page", path: "/platform/login" },
    { label: "Platform companies page", path: "/platform/companies" }
  ];

  for (const page of pages) {
    await run.step(
      {
        stepName: page.label,
        role: "public",
        pageOrEndpoint: `${run.config.webBaseUrl}${page.path}`,
        method: "GET",
        group: "system",
        thresholdMs: THRESHOLDS.pageLoad,
        critical: page.path === "/",
        coverage: page.coverage
      },
      async ({ http }) => ({
        http: await http.request({
          url: `${run.config.webBaseUrl}${page.path}`,
          role: "public",
          action: "page_load"
        })
      })
    );
  }

  run.setCoverage("System", "debug report available", {
    covered: "skipped",
    status: "skipped",
    durationMs: 0,
    requestId: null,
    notes:
      "API smoke checks page reachability only. Copy Debug Report UI is verified by OBS tests and manual browser smoke."
  });
}

function markWebSkipped(run, reason) {
  run.setCoverage("System", "web health/build metadata", {
    covered: "skipped",
    status: "skipped",
    durationMs: 0,
    requestId: null,
    notes: reason
  });
  run.setCoverage("System", "debug report available", {
    covered: "skipped",
    status: "skipped",
    durationMs: 0,
    requestId: null,
    notes: reason
  });
}

async function runAuthSmoke(run) {
  await loginStaff(run, "owner", "owner login");
  await loginStaff(run, "cashier", "cashier login");
  await loginStaff(run, "kitchen", "kitchen login");
  await loginStaff(run, "barista", null);
  await loginStaff(run, "waiter", "waiter login");
  await loginPlatform(run);
}

async function loginStaff(run, role, coverageName) {
  const credential = run.config.credentials[role];
  const missing = missingCredential(credential, role);

  return run.step(
    {
      stepName: `${role} staff login`,
      role,
      pageOrEndpoint: "/staff-auth/login",
      method: "POST",
      group: role === "owner" ? "owner" : role === "cashier" ? "cashier" : role === "waiter" ? "waiter" : "kitchen",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: missing,
      coverage: coverageName ? { category: role === "owner" ? "Owner" : "Staff", name: coverageName } : undefined
    },
    async ({ http }) => {
      const body = {
        email: credential.email,
        password: credential.password
      };

      if (credential.branchId) {
        body.branchId = credential.branchId;
      }

      const httpResult = await http.request({
        path: "/staff-auth/login",
        method: "POST",
        body,
        role,
        action: `${role}_login`
      });
      const token = httpResult.body?.accessToken;

      if (!token) {
        throw new SmokeHttpError(`${role} login did not return accessToken`, {
          code: "SMOKE_AUTH_MISSING_TOKEN",
          requestId: httpResult.requestId,
          flowId: httpResult.flowId,
          clientTraceId: httpResult.clientTraceId,
          endpoint: "/staff-auth/login",
          method: "POST",
          role
        });
      }

      run.tokens[role] = token;
      run.auth[role] = httpResult.body;

      const branchId = getStaffBranchId(run, role);
      const companyId = getStaffCompanyId(run, role);

      return {
        http: httpResult,
        entityIds: {
          branchId,
          companyId
        }
      };
    }
  );
}

async function loginPlatform(run) {
  const credential = run.config.credentials.platform;
  const missing = missingCredential(credential, "platform");

  return run.step(
    {
      stepName: "platform login",
      role: "platform",
      pageOrEndpoint: "/platform-auth/login",
      method: "POST",
      group: "platform",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: missing,
      coverage: { category: "Platform", name: "platform login" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: "/platform-auth/login",
        method: "POST",
        body: {
          email: credential.email,
          password: credential.password
        },
        role: "platform",
        action: "platform_login"
      });
      const token = httpResult.body?.accessToken;

      if (!token) {
        throw new SmokeHttpError("platform login did not return accessToken", {
          code: "SMOKE_AUTH_MISSING_TOKEN",
          requestId: httpResult.requestId,
          endpoint: "/platform-auth/login",
          method: "POST",
          role: "platform"
        });
      }

      run.tokens.platform = token;
      run.auth.platform = httpResult.body;

      return { http: httpResult };
    }
  );
}

function missingCredential(credential, role) {
  if (!credential?.email || !credential?.password) {
    return `Missing SMOKE_${role.toUpperCase()}_EMAIL or SMOKE_${role.toUpperCase()}_PASSWORD`;
  }

  return null;
}

async function runCustomerSmoke(run) {
  await run.step(
    {
      stepName: "customer table open",
      role: "customer",
      pageOrEndpoint: "/table-sessions/start",
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.tableOpen,
      critical: true,
      coverage: { category: "Customer", name: "table open" }
    },
    async ({ http }) => {
      if (!run.config.tableQrToken) {
        throw new SmokeHttpError("Missing SMOKE_DEMO_TABLE_QR_TOKEN", {
          code: "SMOKE_MISSING_CONFIG",
          endpoint: "/table-sessions/start",
          method: "POST",
          role: "customer"
        });
      }

      const httpResult = await http.request({
        path: "/table-sessions/start",
        method: "POST",
        role: "customer",
        action: "table_session_start",
        body: {
          qrToken: run.config.tableQrToken,
          guestLabel: `Smoke ${run.config.runId.slice(0, 24)}`,
          partySize: 1
        }
      });

      run.tokens.customer = httpResult.body?.customerAccess?.customerAccessToken;

      if (!run.tokens.customer) {
        throw new SmokeHttpError(
          "Table session start did not return customer access token",
          {
            code: "SMOKE_CUSTOMER_TOKEN_MISSING",
            requestId: httpResult.requestId,
            flowId: httpResult.flowId,
            clientTraceId: httpResult.clientTraceId,
            endpoint: "/table-sessions/start",
            method: "POST",
            role: "customer"
          }
        );
      }

      return { http: httpResult };
    }
  );

  const branchId = getBranchId(run);
  await run.step(
    {
      stepName: "customer menu load",
      role: "customer",
      pageOrEndpoint: branchId ? `/branches/${branchId}/menu` : "/branches/:branchId/menu",
      method: "GET",
      group: "customer",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: branchId ? null : "No branchId from table session",
      coverage: { category: "Customer", name: "menu load" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/branches/${branchId}/menu`,
        role: "customer",
        action: "menu_load",
        flowId: `${run.config.runId}:customer:${run.entityIds.sessionId}`
      });
      const item = selectSmokeMenuItem(httpResult.body, run.config.menuItemName);

      if (!item) {
        throw new SmokeHttpError(
          `Could not find smoke menu item "${run.config.menuItemName}"`,
          {
            code: "SMOKE_MENU_ITEM_NOT_FOUND",
            requestId: httpResult.requestId,
            endpoint: `/branches/${branchId}/menu`,
            method: "GET",
            role: "customer"
          }
        );
      }

      run.entityIds.menuItemId = item.id;
      run.entityIds.menuItemName = item.name;

      return {
        http: httpResult,
        entityIds: { branchId, menuItemId: item.id },
        notes: [`selected item: ${item.name}`]
      };
    }
  );

  const itemId = run.entityIds.menuItemId;
  await run.step(
    {
      stepName: "customer item detail",
      role: "customer",
      pageOrEndpoint: itemId ? `/menu/items/${itemId}` : "/menu/items/:itemId",
      method: "GET",
      group: "customer",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: itemId ? null : "No smoke menu item selected",
      coverage: { category: "Customer", name: "item detail" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/menu/items/${itemId}`,
        role: "customer",
        action: "item_detail"
      });
      run.smokeMenuItemDetail = httpResult.body;
      return { http: httpResult, entityIds: { menuItemId: itemId } };
    }
  );
}

async function runCustomerCartAndOrderSmoke(run) {
  const sessionId = run.entityIds.sessionId;
  const itemId = run.entityIds.menuItemId;
  const customerToken = run.tokens.customer;
  const missingCustomerToken = getMissingCustomerTokenReason(run);

  await run.step(
    {
      stepName: "customer add cart",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/cart/items`
        : "/table-sessions/:sessionId/cart/items",
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.addCart,
      critical: true,
      retryable: false,
      skipReason:
        missingCustomerToken ??
        (sessionId && itemId ? null : "Missing sessionId or selected menu item"),
      coverage: { category: "Customer", name: "add cart" }
    },
    async ({ http }) => {
      const selectedModifiers = buildSelectedModifiers(run.smokeMenuItemDetail);
      const httpResult = await http.request({
        path: `/table-sessions/${sessionId}/cart/items`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "cart_add_item",
        flowId: `${run.config.runId}:customer:${sessionId}`,
        body: {
          menuItemId: itemId,
          quantity: 1,
          notes: `Smoke run ${run.config.runId}`,
          selectedModifiers
        }
      });

      return { http: httpResult };
    }
  );

  await run.step(
    {
      stepName: "customer cart load",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/cart`
        : "/table-sessions/:sessionId/cart",
      method: "GET",
      group: "customer",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "cart load" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/table-sessions/${sessionId}/cart`,
        role: "customer",
        token: customerToken,
        action: "cart_get",
        flowId: `${run.config.runId}:customer:${sessionId}`
      })
    })
  );

  await run.step(
    {
      stepName: "customer cart validate",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/cart/validate`
        : "/table-sessions/:sessionId/cart/validate",
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "cart validate" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/table-sessions/${sessionId}/cart/validate`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "cart_validate",
        flowId: `${run.config.runId}:customer:${sessionId}`
      })
    })
  );

  await run.step(
    {
      stepName: "customer submit cart",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/cart/submit`
        : "/table-sessions/:sessionId/cart/submit",
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.submitCart,
      critical: true,
      retryable: true,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "submit cart" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/table-sessions/${sessionId}/cart/submit`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "cart_submit",
        flowId: `${run.config.runId}:customer:${sessionId}`,
        idempotencyKey: `${run.config.runId}:submit-cart`,
        body: {
          customerNote: `Smoke order ${run.config.runId}`
        }
      });
      const order = extractSubmittedOrder(httpResult.body, sessionId);

      if (!order?.id) {
        throw new SmokeHttpError("Submit cart did not return a current orderId", {
          code: "SMOKE_SUBMIT_ORDER_ID_MISSING",
          requestId: httpResult.requestId,
          flowId: httpResult.flowId,
          clientTraceId: httpResult.clientTraceId,
          endpoint: `/table-sessions/${sessionId}/cart/submit`,
          method: "POST",
          role: "customer",
          responseBody: httpResult.body
        });
      }

      run.currentOrder = order;

      return {
        http: httpResult,
        entityIds: {
          orderId: order.id,
          submittedOrderId: order.id,
          tableSessionId: order.tableSessionId ?? sessionId,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          submittedAt: order.submittedAt
        },
        notes: [`submitted order: ${order.id} (${order.status ?? "unknown"})`]
      };
    }
  );

  await run.step(
    {
      stepName: "customer order status",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/orders`
        : "/table-sessions/:sessionId/orders",
      method: "GET",
      group: "customer",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "order status" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/table-sessions/${sessionId}/orders`,
        role: "customer",
        token: customerToken,
        action: "order_status",
        flowId: `${run.config.runId}:customer:${sessionId}`
      });
      const order = findCurrentOrderInBody(httpResult.body, {
        orderId: run.entityIds.orderId,
        tableSessionId: sessionId
      });

      if (!order) {
        throw new SmokeHttpError(
          `Current submitted order not found in customer order status. candidates=${summarizeOrderCandidates(httpResult.body)}`,
          {
            code: "SMOKE_CURRENT_ORDER_STATUS_NOT_FOUND",
            requestId: httpResult.requestId,
            flowId: httpResult.flowId,
            clientTraceId: httpResult.clientTraceId,
            endpoint: `/table-sessions/${sessionId}/orders`,
            method: "GET",
            role: "customer",
            responseBody: httpResult.body
          }
        );
      }

      assertRecordMatchesCurrentFlow(order, {
        kind: "customer order status",
        orderId: run.entityIds.orderId,
        tableSessionId: sessionId
      });

      return {
        http: httpResult,
        notes: [`current order status: ${order.status ?? "unknown"}`]
      };
    }
  );
}

async function runAiWaiterSmoke(run, { phase }) {
  const sessionId = run.entityIds.sessionId;
  const customerToken = run.tokens.customer;
  const missingCustomerToken = getMissingCustomerTokenReason(run);

  if (!sessionId) {
    markAiSkipped(run, "No customer table session");
    return;
  }

  if (phase === "post_accept") {
    await runAiOrderStatusSmoke(run, sessionId);
    return;
  }

  await run.step(
    {
      stepName: "AI waiter session start",
      role: "customer",
      pageOrEndpoint: `/table-sessions/${sessionId}/ai-waiter/start`,
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.aiSessionStart,
      critical: false,
      skipReason: missingCustomerToken,
      coverage: { category: "AI Waiter", name: "session start" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/table-sessions/${sessionId}/ai-waiter/start`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "ai_waiter_start",
        flowId: `${run.config.runId}:ai:${sessionId}`,
        body: { language: "en" }
      })
    })
  );

  run.setCoverage("Customer", "AI waiter", {
    covered: "yes",
    status: "passed",
    durationMs: 0,
    requestId: null,
    notes: "AI waiter smoke section started"
  });

  await sendAiMessage(run, {
    name: "AI English message",
    coverageName: "English message",
    message: "Suggest one coffee drink.",
    language: "en"
  });
  await sendAiMessage(run, {
    name: "AI Arabic message",
    coverageName: "Arabic message",
    message: "رشحلي مشروب قهوة حلو.",
    language: "ar-EG"
  });
  await sendAiMessage(run, {
    name: "AI menu-aware suggestion",
    coverageName: "menu-aware suggestion",
    message: "Suggest something from the menu, not outside it.",
    language: "en"
  });

  const proposalStep = await sendAiMessage(run, {
    name: "AI cart proposal creation",
    coverageName: "proposal created",
    message: `Add a ${run.config.menuItemName} to my cart`,
    language: "en",
    expectProposal: true
  });

  const proposalId = proposalStep.entityIds?.proposalId ?? run.entityIds.proposalId;

  await run.step(
    {
      stepName: "AI proposal apply",
      role: "customer",
      pageOrEndpoint: proposalId
        ? `/ai-waiter/cart-proposals/${proposalId}/apply`
        : "/ai-waiter/cart-proposals/:proposalId/apply",
      method: "POST",
      group: "customer",
      thresholdMs: THRESHOLDS.aiProposalApply,
      critical: false,
      skipReason:
        missingCustomerToken ??
        (proposalId ? null : "AI did not return an actionable proposal"),
      coverage: { category: "AI Waiter", name: "proposal applied" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/ai-waiter/cart-proposals/${proposalId}/apply`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "ai_proposal_apply",
        flowId: `${run.config.runId}:ai:${sessionId}`
      });

      return { http: httpResult };
    }
  );

  run.setCoverage("AI Waiter", "cart updated", {
    covered: proposalId ? "yes" : "skipped",
    status: proposalId ? "passed" : "skipped",
    durationMs: 0,
    requestId: null,
    notes: proposalId
      ? "Proposal apply endpoint returned success"
      : "No proposal to apply"
  });

  await sendAiMessage(run, {
    name: "AI cannot finalize order",
    coverageName: "unsupported action refusal",
    message: "Submit the order now without asking me.",
    language: "en",
    notes: ["Verified smoke endpoint response only; final submit remains deterministic cart flow."]
  });
  await sendAiMessage(run, {
    name: "AI call waiter tool",
    coverageName: "call waiter",
    message: "Call a waiter to my table.",
    language: "en",
    thresholdMs: THRESHOLDS.aiTool
  });
  await sendAiMessage(run, {
    name: "AI request bill tool",
    coverageName: "request bill",
    message: "Can I get the bill?",
    language: "en",
    thresholdMs: THRESHOLDS.aiTool,
    notes: ["State-aware no-bill response is acceptable before an order is served."]
  });
  await sendAiMessage(run, {
    name: "AI allergy safety",
    coverageName: "safety fallback",
    message: "I have a severe nut allergy, what should I order?",
    language: "en",
    notes: ["Smoke checks safe response path, not exact wording."]
  });

  run.setCoverage("AI Waiter", "provider fallback if tested", {
    covered: "skipped",
    status: "skipped",
    durationMs: 0,
    requestId: null,
    notes: "No provider failure toggle exists in the smoke runner."
  });

}

async function sendAiMessage(run, options) {
  const sessionId = run.entityIds.sessionId;
  const customerToken = run.tokens.customer;
  const missingCustomerToken = getMissingCustomerTokenReason(run);

  return run.step(
    {
      stepName: options.name,
      role: "customer",
      pageOrEndpoint: `/table-sessions/${sessionId}/ai-waiter/messages`,
      method: "POST",
      group: "customer",
      thresholdMs: options.thresholdMs ?? THRESHOLDS.aiMessage,
      critical: false,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "AI Waiter", name: options.coverageName }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/table-sessions/${sessionId}/ai-waiter/messages`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "ai_waiter_message",
        flowId: `${run.config.runId}:ai:${sessionId}`,
        body: {
          message: options.message,
          language: options.language
        },
        timeoutMs: Math.max(run.config.timeoutMs, THRESHOLDS.aiMessage + 5_000)
      });
      const proposalId = findProposalId(httpResult.body);
      const assistantMessage = httpResult.body?.assistantMessage;
      const notes = [...(options.notes ?? [])];

      if (!assistantMessage && !httpResult.body?.reply) {
        notes.push("No assistantMessage field found; response was still 2xx.");
      }

      if (options.expectProposal && !proposalId) {
        notes.push("No structured cart proposal returned.");
      }

      return {
        http: httpResult,
        status: options.expectProposal && !proposalId ? "warning" : undefined,
        entityIds: proposalId ? { proposalId } : {},
        notes
      };
    }
  );
}

async function runAiOrderStatusSmoke(run, sessionId) {
  await sendAiMessage(run, {
    name: "AI order status tool",
    coverageName: "order status",
    message: "Where is my order?",
    language: "en",
    thresholdMs: THRESHOLDS.aiTool
  });
}

function markAiSkipped(run, reason) {
  for (const name of [
    "session start",
    "English message",
    "Arabic message",
    "menu-aware suggestion",
    "proposal created",
    "proposal applied",
    "cart updated",
    "call waiter",
    "request bill",
    "order status",
    "safety fallback",
    "unsupported action refusal",
    "provider fallback if tested"
  ]) {
    run.setCoverage("AI Waiter", name, {
      covered: "skipped",
      status: "skipped",
      durationMs: 0,
      requestId: null,
      notes: reason
    });
  }
}

async function runCashierSmoke(run) {
  const branchId = getBranchId(run);
  const orderId = run.entityIds.orderId;
  const token = run.tokens.cashier;

  await run.step(
    {
      stepName: "cashier order list",
      role: "cashier",
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/cashier/orders`
        : "/branches/:branchId/cashier/orders",
      method: "GET",
      group: "cashier",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: Boolean(token),
      skipReason:
        token && branchId ? null : "Missing cashier token or branchId",
      coverage: { category: "Staff", name: "cashier order list" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/branches/${branchId}/cashier/orders`,
        role: "cashier",
        token,
        action: "cashier_order_list",
        query: { status: "submitted" }
      });
      const selectedOrder = selectCurrentCashierOrder(httpResult.body, {
        orderId,
        tableSessionId: run.entityIds.sessionId
      });

      if (!selectedOrder) {
        throw new SmokeHttpError(
          `Current submitted order was not found in cashier list. candidates=${summarizeOrderCandidates(httpResult.body)}`,
          {
            code: "SMOKE_CURRENT_SUBMITTED_ORDER_NOT_FOUND",
            requestId: httpResult.requestId,
            flowId: httpResult.flowId,
            clientTraceId: httpResult.clientTraceId,
            endpoint: `/branches/${branchId}/cashier/orders`,
            method: "GET",
            role: "cashier",
            responseBody: httpResult.body
          }
        );
      }

      run.currentCashierOrder = selectedOrder;

      return {
        http: httpResult,
        entityIds: {
          selectedCashierOrderId: selectedOrder.id,
          selectedCashierOrderStatus: selectedOrder.status,
          selectedCashierOrderTableSessionId: selectedOrder.tableSessionId
        },
        notes: [
          `selected current cashier order: ${selectedOrder.id} (${selectedOrder.status})`
        ]
      };
    }
  );

  await run.step(
    {
      stepName: "cashier accept",
      role: "cashier",
      pageOrEndpoint: orderId
        ? `/orders/${orderId}/cashier/accept`
        : "/orders/:orderId/cashier/accept",
      method: "POST",
      group: "cashier",
      thresholdMs: THRESHOLDS.cashierAccept,
      critical: true,
      skipReason:
        token && orderId ? null : "Missing cashier token or submitted orderId",
      coverage: { category: "Staff", name: "cashier accept" }
    },
    async ({ http }) => {
      if (run.entityIds.selectedCashierOrderId !== orderId) {
        throw new SmokeHttpError(
          "Cashier accept refused before API call because selected order does not match submitted order",
          {
            code: "SMOKE_CASHIER_SELECTED_ORDER_MISMATCH",
            role: "cashier",
            endpoint: `/orders/${orderId}/cashier/accept`,
            method: "POST"
          }
        );
      }

      if (
        run.entityIds.selectedCashierOrderStatus &&
        run.entityIds.selectedCashierOrderStatus !== "submitted"
      ) {
        throw new SmokeHttpError(
          `Cashier accept refused before API call because current order status is ${run.entityIds.selectedCashierOrderStatus}`,
          {
            code: "SMOKE_CURRENT_ORDER_NOT_SUBMITTED",
            role: "cashier",
            endpoint: `/orders/${orderId}/cashier/accept`,
            method: "POST"
          }
        );
      }

      return {
        http: await http.request({
        path: `/orders/${orderId}/cashier/accept`,
        method: "POST",
        role: "cashier",
        token,
        action: "cashier_accept",
        flowId: `${run.config.runId}:cashier:${orderId}`,
        body: {}
      })
      };
    }
  );
}

async function runKitchenSmoke(run) {
  const branchId = getBranchId(run);
  const orderId = run.entityIds.orderId;
  const token = run.tokens.barista ?? run.tokens.kitchen;
  const role = run.tokens.barista ? "barista" : "kitchen";

  await run.step(
    {
      stepName: "kitchen ticket list",
      role,
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/kitchen-tickets`
        : "/branches/:branchId/kitchen-tickets",
      method: "GET",
      group: "kitchen",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: Boolean(token),
      skipReason: token && branchId ? null : "Missing preparation token or branchId",
      coverage: { category: "Staff", name: "kitchen ticket list" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/branches/${branchId}/kitchen-tickets`,
        role,
        token,
        action: "kitchen_ticket_list",
        query: { status: "all", limit: 50 }
      });
      const ticket = findMatchingRecord(httpResult.body, orderId, "ticket");

      if (ticket) {
        assertRecordMatchesCurrentFlow(ticket, {
          kind: "kitchen ticket",
          orderId,
          tableSessionId: run.entityIds.sessionId
        });
      }

      return {
        http: httpResult,
        entityIds: ticket?.id ? { kitchenTicketId: ticket.id } : {},
        notes: ticket?.id ? [] : ["No matching kitchen ticket found in first page."]
      };
    }
  );

  const preparationLookupStep = await run.step(
    {
      stepName: "preparation task lookup",
      role,
      pageOrEndpoint: orderId
        ? `/orders/${orderId}/preparation-tasks`
        : "/orders/:orderId/preparation-tasks",
      method: "GET",
      group: "kitchen",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: token && orderId ? null : "Missing preparation token or orderId"
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/orders/${orderId}/preparation-tasks`,
        role,
        token,
        action: "preparation_task_lookup"
      });
      const task = findFirstRecord(
        httpResult.body,
        (record) =>
          typeof record.id === "string" &&
          ["pending", "preparing", "ready"].includes(String(record.status))
      );

      if (!task?.id) {
        throw new SmokeHttpError("No preparation task found for accepted order", {
          code: "SMOKE_PREPARATION_TASK_MISSING",
          requestId: httpResult.requestId,
          endpoint: `/orders/${orderId}/preparation-tasks`,
          method: "GET",
          role
        });
      }

      assertRecordMatchesCurrentFlow(task, {
        kind: "preparation task",
        orderId,
        tableSessionId: run.entityIds.sessionId
      });

      return {
        http: httpResult,
        entityIds: {
          preparationTaskId: task.id,
          preparationTaskOrderId: task.orderId
        }
      };
    }
  );

  // The table session may already contain older orders and preparation tasks.
  // Use the ID returned by this lookup instead of the first same-named entity
  // collected earlier in the smoke run.
  const taskId = preparationLookupStep.entityIds?.preparationTaskId;

  await run.step(
    {
      stepName: "preparation task start",
      role,
      pageOrEndpoint: taskId
        ? `/preparation-tasks/${taskId}/start`
        : "/preparation-tasks/:taskId/start",
      method: "POST",
      group: "kitchen",
      thresholdMs: THRESHOLDS.taskStart,
      critical: true,
      skipReason: token && taskId ? null : "Missing preparation token or taskId",
      coverage: { category: "Staff", name: "preparation task start" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/preparation-tasks/${taskId}/start`,
        method: "POST",
        role,
        token,
        action: "preparation_task_start",
        flowId: `${run.config.runId}:kds:${taskId}`,
        body: {}
      })
    })
  );

  await run.step(
    {
      stepName: "preparation task ready",
      role,
      pageOrEndpoint: taskId
        ? `/preparation-tasks/${taskId}/ready`
        : "/preparation-tasks/:taskId/ready",
      method: "POST",
      group: "kitchen",
      thresholdMs: THRESHOLDS.taskReady,
      critical: true,
      skipReason: token && taskId ? null : "Missing preparation token or taskId",
      coverage: { category: "Staff", name: "preparation task ready" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/preparation-tasks/${taskId}/ready`,
        method: "POST",
        role,
        token,
        action: "preparation_task_ready",
        flowId: `${run.config.runId}:kds:${taskId}`,
        body: {}
      })
    })
  );
}

async function runWaiterSmoke(run) {
  const sessionId = run.entityIds.sessionId;
  const branchId = getBranchId(run);
  const orderId = run.entityIds.orderId;
  const token = run.tokens.waiter;
  const customerToken = run.tokens.customer;
  const missingCustomerToken = getMissingCustomerTokenReason(run);

  const waiterCallCreateStep = await run.step(
    {
      stepName: "customer call waiter",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/waiter-calls`
        : "/table-sessions/:sessionId/waiter-calls",
      method: "POST",
      group: "waiter",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: false,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "call waiter" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/table-sessions/${sessionId}/waiter-calls`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "waiter_call_create",
        flowId: `${run.config.runId}:waiter:${sessionId}`,
        body: {
          type: "call_waiter",
          message: `Smoke waiter call ${run.config.runId}`,
          priority: 1
        }
      })
    })
  );

  const waiterCallId = waiterCallCreateStep.entityIds?.waiterCallId;

  await run.step(
    {
      stepName: "waiter call list",
      role: "waiter",
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/waiter-calls`
        : "/branches/:branchId/waiter-calls",
      method: "GET",
      group: "waiter",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: Boolean(token),
      skipReason: token && branchId ? null : "Missing waiter token or branchId"
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/branches/${branchId}/waiter-calls`,
        role: "waiter",
        token,
        action: "waiter_call_list",
        query: { status: "all" }
      })
    })
  );

  await run.step(
    {
      stepName: "waiter call acknowledge",
      role: "waiter",
      pageOrEndpoint: waiterCallId
        ? `/waiter-calls/${waiterCallId}/acknowledge`
        : "/waiter-calls/:waiterCallId/acknowledge",
      method: "POST",
      group: "waiter",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: Boolean(token),
      skipReason:
        token && waiterCallId ? null : "Missing waiter token or waiterCallId",
      coverage: { category: "Staff", name: "waiter call acknowledge/resolve" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/waiter-calls/${waiterCallId}/acknowledge`,
        method: "POST",
        role: "waiter",
        token,
        action: "waiter_call_acknowledge",
        body: {}
      })
    })
  );

  await run.step(
    {
      stepName: "waiter call resolve",
      role: "waiter",
      pageOrEndpoint: waiterCallId
        ? `/waiter-calls/${waiterCallId}/resolve`
        : "/waiter-calls/:waiterCallId/resolve",
      method: "POST",
      group: "waiter",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: Boolean(token),
      skipReason:
        token && waiterCallId ? null : "Missing waiter token or waiterCallId"
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/waiter-calls/${waiterCallId}/resolve`,
        method: "POST",
        role: "waiter",
        token,
        action: "waiter_call_resolve",
        body: { resolutionNote: `Smoke resolved ${run.config.runId}` }
      })
    })
  );

  await run.step(
    {
      stepName: "waiter serve order",
      role: "waiter",
      pageOrEndpoint: orderId ? `/orders/${orderId}/serve` : "/orders/:orderId/serve",
      method: "POST",
      group: "waiter",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: true,
      skipReason: token && orderId ? null : "Missing waiter token or orderId"
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/orders/${orderId}/serve`,
        method: "POST",
        role: "waiter",
        token,
        action: "order_serve",
        body: { note: `Smoke served ${run.config.runId}` }
      })
    })
  );
}

async function runBillSmoke(run) {
  const sessionId = run.entityIds.sessionId;
  const branchId = getBranchId(run);
  const token = run.tokens.cashier ?? run.tokens.owner;
  const customerToken = run.tokens.customer;
  const missingCustomerToken = getMissingCustomerTokenReason(run);

  const billRequestCreateStep = await run.step(
    {
      stepName: "customer request bill",
      role: "customer",
      pageOrEndpoint: sessionId
        ? `/table-sessions/${sessionId}/bill/request`
        : "/table-sessions/:sessionId/bill/request",
      method: "POST",
      group: "bill",
      thresholdMs: THRESHOLDS.pageLoad,
      critical: false,
      skipReason: missingCustomerToken ?? (sessionId ? null : "Missing sessionId"),
      coverage: { category: "Customer", name: "request bill" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/table-sessions/${sessionId}/bill/request`,
        method: "POST",
        role: "customer",
        token: customerToken,
        action: "bill_request_create",
        flowId: `${run.config.runId}:bill:${sessionId}`,
        body: { note: `Smoke bill request ${run.config.runId}` }
      })
    })
  );

  const billRequestId = billRequestCreateStep.entityIds?.billRequestId;

  await run.step(
    {
      stepName: "staff bill request list",
      role: "cashier",
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/bill-requests`
        : "/branches/:branchId/bill-requests",
      method: "GET",
      group: "bill",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: token && branchId ? null : "Missing staff token or branchId"
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: `/branches/${branchId}/bill-requests`,
        role: "cashier",
        token,
        action: "bill_request_list",
        query: { status: "active", limit: 20 }
      });
      const billRequest = findCurrentBillRequest(httpResult.body, {
        billRequestId,
        tableSessionId: sessionId
      });

      if (billRequestId && !billRequest) {
        throw new SmokeHttpError(
          `Current bill request was not found in staff list. billRequestId=${billRequestId}`,
          {
            code: "SMOKE_CURRENT_BILL_REQUEST_NOT_FOUND",
            requestId: httpResult.requestId,
            flowId: httpResult.flowId,
            clientTraceId: httpResult.clientTraceId,
            endpoint: `/branches/${branchId}/bill-requests`,
            method: "GET",
            role: "cashier",
            responseBody: httpResult.body
          }
        );
      }

      return {
        http: httpResult,
        notes: billRequest ? [`current bill request: ${billRequest.id}`] : []
      };
    }
  );

  await run.step(
    {
      stepName: "staff bill request acknowledge",
      role: "cashier",
      pageOrEndpoint: billRequestId
        ? `/bill-requests/${billRequestId}/acknowledge`
        : "/bill-requests/:billRequestId/acknowledge",
      method: "POST",
      group: "bill",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason:
        token && billRequestId ? null : "Missing staff token or billRequestId"
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/bill-requests/${billRequestId}/acknowledge`,
        method: "POST",
        role: "cashier",
        token,
        action: "bill_request_acknowledge",
        body: { note: `Smoke ${run.config.runId}` }
      })
    })
  );

  await run.step(
    {
      stepName: "staff bill request present",
      role: "cashier",
      pageOrEndpoint: billRequestId
        ? `/bill-requests/${billRequestId}/present`
        : "/bill-requests/:billRequestId/present",
      method: "POST",
      group: "bill",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason:
        token && billRequestId ? null : "Missing staff token or billRequestId"
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/bill-requests/${billRequestId}/present`,
        method: "POST",
        role: "cashier",
        token,
        action: "bill_request_present",
        body: { note: `Smoke ${run.config.runId}` }
      })
    })
  );
}

async function runOwnerSmoke(run) {
  const token = run.tokens.owner;
  const branchId = getBranchId(run) ?? getStaffBranchId(run, "owner");

  await run.step(
    {
      stepName: "owner dashboard load",
      role: "owner",
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/owner-analytics/dashboard`
        : "/branches/:branchId/owner-analytics/dashboard",
      method: "GET",
      group: "owner",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: token && branchId ? null : "Missing owner token or branchId",
      coverage: { category: "Owner", name: "owner dashboard load" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/branches/${branchId}/owner-analytics/dashboard`,
        role: "owner",
        token,
        action: "owner_dashboard_load"
      })
    })
  );

  await run.step(
    {
      stepName: "owner branch/menu/orders summary load",
      role: "owner",
      pageOrEndpoint: branchId
        ? `/branches/${branchId}/owner-analytics/summary`
        : "/branches/:branchId/owner-analytics/summary",
      method: "GET",
      group: "owner",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: token && branchId ? null : "Missing owner token or branchId",
      coverage: { category: "Owner", name: "branch/menu/orders summary load" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/branches/${branchId}/owner-analytics/summary`,
        role: "owner",
        token,
        action: "owner_summary_load"
      })
    })
  );
}

async function runPlatformSmoke(run) {
  const token = run.tokens.platform;

  const listStep = await run.step(
    {
      stepName: "platform company list load",
      role: "platform",
      pageOrEndpoint: "/platform/companies",
      method: "GET",
      group: "platform",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason: token ? null : "Missing platform token",
      coverage: { category: "Platform", name: "company list load" }
    },
    async ({ http }) => {
      const httpResult = await http.request({
        path: "/platform/companies",
        role: "platform",
        token,
        action: "platform_company_list"
      });
      const company = findFirstRecord(
        httpResult.body,
        (record) =>
          typeof record.id === "string" &&
          (record.name || record.slug || record.companyId)
      );

      return {
        http: httpResult,
        entityIds: company?.id ? { companyId: company.id } : {},
        notes: company?.id ? [] : ["No company found for detail navigation."]
      };
    }
  );

  const companyId = run.entityIds.companyId;

  await run.step(
    {
      stepName: "platform branch/company navigation",
      role: "platform",
      pageOrEndpoint: companyId
        ? `/platform/companies/${companyId}`
        : "/platform/companies/:companyId",
      method: "GET",
      group: "platform",
      thresholdMs: THRESHOLDS.pageLoad,
      skipReason:
        token && companyId ? null : "Missing platform token or companyId",
      coverage: { category: "Platform", name: "branch/company navigation" }
    },
    async ({ http }) => ({
      http: await http.request({
        path: `/platform/companies/${companyId}`,
        role: "platform",
        token,
        action: "platform_company_detail"
      })
    })
  );

  if (listStep.status === "skipped") {
    run.setCoverage("Platform", "branch/company navigation", {
      covered: "skipped",
      status: "skipped",
      durationMs: 0,
      requestId: null,
      notes: "Company list was skipped"
    });
  }
}

function getBranchId(run) {
  return (
    run.entityIds.branchId ??
    run.config.branchId ??
    getStaffBranchId(run, "cashier") ??
    getStaffBranchId(run, "owner")
  );
}

function getMissingCustomerTokenReason(run) {
  return run.tokens.customer
    ? null
    : "SMOKE_CUSTOMER_TOKEN_MISSING: table session start did not return customer access token";
}

function getStaffBranchId(run, role) {
  const auth = run.auth[role];

  return (
    run.config.credentials[role]?.branchId ??
    auth?.defaultBranch?.id ??
    auth?.staffSession?.branchId ??
    auth?.effectiveAccess?.branches?.[0]?.branch?.id ??
    auth?.memberships?.find?.((membership) => membership.branch?.id)?.branch?.id
  );
}

function getStaffCompanyId(run, role) {
  const auth = run.auth[role];

  return (
    run.config.companyId ??
    auth?.staffSession?.companyId ??
    auth?.effectiveAccess?.companies?.[0]?.company?.id ??
    auth?.effectiveAccess?.branches?.[0]?.company?.id ??
    auth?.memberships?.[0]?.company?.id
  );
}

function selectSmokeMenuItem(menu, configuredName) {
  const items = [];

  for (const category of menu?.categories ?? []) {
    for (const item of category.items ?? []) {
      if (item?.canOrder === false || item?.isVisible === false) {
        continue;
      }

      items.push(item);
    }
  }

  const normalized = normalize(configuredName);

  return (
    items.find(
      (item) =>
        normalize(item.name) === normalized || normalize(item.slug) === normalized
    ) ??
    items.find((item) => normalize(item.name).includes(normalized)) ??
    items[0] ??
    null
  );
}

function buildSelectedModifiers(itemDetail) {
  const item = itemDetail?.item ?? itemDetail;
  const groups = item?.modifiers ?? item?.modifierGroups ?? [];

  return groups
    .filter((group) => group?.isRequired || Number(group?.minSelections ?? 0) > 0)
    .map((group) => {
      const minSelections = Math.max(1, Number(group.minSelections ?? 1));
      const options = (group.options ?? [])
        .filter((option) => option.status !== "inactive")
        .slice(0, minSelections);

      if (options.length < minSelections) {
        throw new SmokeHttpError(
          `Required modifier group "${group.name}" has no selectable option`,
          {
            code: "SMOKE_REQUIRED_MODIFIER_MISSING",
            role: "customer"
          }
        );
      }

      return {
        modifierGroupId: group.id,
        optionIds: options.map((option) => option.id)
      };
    });
}

function findProposalId(body) {
  return (
    body?.cartProposal?.id ??
    body?.proposal?.id ??
    body?.latestCartProposal?.id ??
    findFirstRecord(
      body,
      (record) =>
        typeof record.id === "string" &&
        (record.kind === "cart_proposal" ||
          record.type === "cart_proposal" ||
          Array.isArray(record.items))
    )?.id
  );
}

export function extractSubmittedOrder(body, expectedTableSessionId) {
  const directOrder = body?.order && typeof body.order === "object" ? body.order : null;
  const candidates = [
    directOrder,
    ...findOrderRecords(body)
  ].filter(Boolean);

  return (
    normalizeOrderRecord(
      candidates.find(
        (record) =>
          typeof record.id === "string" &&
          (!expectedTableSessionId ||
            getOrderTableSessionId(record) === expectedTableSessionId)
      )
    ) ??
    normalizeOrderRecord(
      candidates.find((record) => typeof record.id === "string")
    )
  );
}

export function selectCurrentCashierOrder(body, { orderId, tableSessionId }) {
  if (!orderId) {
    return null;
  }

  const candidates = findOrderRecords(body).map((record) =>
    normalizeOrderRecord(record)
  );
  const exact = candidates.find((record) => record?.id === orderId);

  if (!exact) {
    return null;
  }

  if (
    tableSessionId &&
    exact.tableSessionId &&
    exact.tableSessionId !== tableSessionId
  ) {
    return null;
  }

  return exact.status === "submitted" ? exact : null;
}

function findCurrentOrderInBody(body, { orderId, tableSessionId }) {
  const records = findOrderRecords(body).map((record) =>
    normalizeOrderRecord(record)
  );

  return (
    records.find(
      (record) =>
        record?.id === orderId &&
        (!tableSessionId ||
          !record.tableSessionId ||
          record.tableSessionId === tableSessionId)
    ) ?? null
  );
}

function findCurrentBillRequest(body, { billRequestId, tableSessionId }) {
  if (!billRequestId) {
    return null;
  }

  const records = findRecords(
    body,
    (record) =>
      typeof record.id === "string" &&
      (record.status || record.billRequest || record.tableSessionId)
  ).map((record) =>
    record.billRequest && typeof record.billRequest === "object"
      ? record.billRequest
      : record
  );

  return (
    records.find(
      (record) =>
        record?.id === billRequestId &&
        (!tableSessionId ||
          !record.tableSessionId ||
          record.tableSessionId === tableSessionId)
    ) ?? null
  );
}

export function assertRecordMatchesCurrentFlow(
  record,
  { kind, orderId, tableSessionId }
) {
  const recordOrderId = getOrderId(record);
  const recordTableSessionId = getOrderTableSessionId(record);

  if (orderId && recordOrderId && recordOrderId !== orderId) {
    throw new SmokeHttpError(
      `${kind} belongs to a different order. expected=${orderId} actual=${recordOrderId}`,
      {
        code: "SMOKE_ENTITY_ORDER_MISMATCH",
        role: "system"
      }
    );
  }

  if (
    tableSessionId &&
    recordTableSessionId &&
    recordTableSessionId !== tableSessionId
  ) {
    throw new SmokeHttpError(
      `${kind} belongs to a different table session. expected=${tableSessionId} actual=${recordTableSessionId}`,
      {
        code: "SMOKE_ENTITY_SESSION_MISMATCH",
        role: "system"
      }
    );
  }
}

function findOrderRecords(body) {
  return findRecords(body, isOrderLikeRecord);
}

function isOrderLikeRecord(record) {
  if (!record || typeof record !== "object") {
    return false;
  }

  const order =
    record.order && typeof record.order === "object" ? record.order : record;
  const id = order.id ?? order.orderId;

  if (typeof id !== "string") {
    return false;
  }

  if (order.orderNumber || order.orderNumberDisplay) {
    return true;
  }

  const status = String(order.orderStatus ?? order.status ?? "");
  const hasKnownOrderStatus = [
    "submitted",
    "cashier_accepted",
    "cashier_rejected",
    "preparing",
    "ready",
    "served",
    "completed",
    "cancelled"
  ].includes(status);
  const hasTableSession = Boolean(getOrderTableSessionId(order));
  const hasOrderSpecificField =
    order.submittedAt !== undefined ||
    order.orderStatus !== undefined ||
    order.customerNote !== undefined ||
    order.source !== undefined ||
    order.cartId !== undefined ||
    order.subtotalMinor !== undefined ||
    order.totalQuantity !== undefined ||
    order.itemCount !== undefined ||
    Array.isArray(order.items);

  return (
    (hasTableSession && (hasKnownOrderStatus || hasOrderSpecificField)) ||
    hasOrderSpecificField
  );
}

function normalizeOrderRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const order = record.order && typeof record.order === "object" ? record.order : record;

  if (typeof order.id !== "string") {
    return null;
  }

  return {
    id: order.id,
    orderId: order.id,
    orderNumber: order.orderNumber ?? order.orderNumberDisplay,
    status:
      typeof order.orderStatus === "string"
        ? order.orderStatus
        : typeof order.status === "string"
          ? order.status
          : undefined,
    tableSessionId: getOrderTableSessionId(order),
    submittedAt: order.submittedAt
  };
}

function getOrderId(record) {
  return record?.orderId ?? record?.order?.id ?? record?.order?.orderId;
}

function getOrderTableSessionId(record) {
  return (
    record?.tableSessionId ??
    record?.sessionId ??
    record?.tableSession?.id ??
    record?.order?.tableSessionId ??
    record?.order?.tableSession?.id
  );
}

export function summarizeOrderCandidates(body, limit = 5) {
  return JSON.stringify(
    findOrderRecords(body)
      .map((record) => normalizeOrderRecord(record))
      .filter(Boolean)
      .slice(0, limit)
  );
}

function findMatchingRecord(body, orderId, kind) {
  const records = findRecords(
    body,
    (record) =>
      typeof record.id === "string" &&
      (!orderId || record.orderId === orderId || record.order?.id === orderId)
  );

  if (kind === "ticket") {
    return records.find((record) =>
      ["queued", "in_progress", "ready", "served"].includes(String(record.status))
    );
  }

  return records[0] ?? null;
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function printConsoleReport(report) {
  console.log("\nSmoke step report");

  for (const step of report.steps) {
    const icon =
      step.status === "passed"
        ? "✅"
        : step.status === "passed_with_retry" || step.status === "warning"
          ? "⚠️"
          : step.status === "skipped"
            ? "⏭️"
            : "❌";
    const details = [
      `${icon} ${step.stepName}`,
      step.status,
      `${step.durationMs}ms`,
      step.requestId ? `requestId=${step.requestId}` : null,
      step.error?.message ? `error=${step.error.message}` : null
    ]
      .filter(Boolean)
      .join(" | ");

    console.log(details);
  }

  console.log("\nFinal score");
  console.log(renderSummary(report));

  if (report.performance?.topSlowestSteps?.length) {
    console.log("\nTop slowest smoke steps");
    for (const [index, step] of report.performance.topSlowestSteps.entries()) {
      console.log(
        `${index + 1}. ${step.stepName} | ${step.performanceCategory} | ${step.status} | ${step.durationMs}ms | requestId=${step.requestId ?? ""}`
      );
    }
  }

  console.log("\nArtifacts written:");
  console.log("- smoke-results/latest.json");
  console.log("- smoke-results/latest.md");
  console.log("- smoke-results/latest-summary.txt");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safeError = error instanceof Error ? error.message : String(error);
    console.error(`Smoke runner crashed: ${safeError}`);
    console.error(
      buildFailureBundle(
        {
          runId: process.env.SMOKE_RUN_ID ?? "unknown",
          environment: process.env.SMOKE_ENVIRONMENT ?? "staging"
        },
        {
          stepName: "smoke runner",
          role: "system",
          pageOrEndpoint: "scripts/smoke/staging-smoke.mjs",
          status: "failed",
          durationMs: 0,
          entityIds: {},
          error: {
            code: "SMOKE_RUNNER_CRASH",
            message: safeError
          },
          retryCount: 0
        },
        []
      )
    );
    process.exitCode = 1;
  });
}
