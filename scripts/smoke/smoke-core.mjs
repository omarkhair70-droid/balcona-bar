import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export const STEP_STATUSES = [
  "passed",
  "passed_with_retry",
  "warning",
  "skipped",
  "failed"
];

const DEFAULT_TIMEOUT_MS = 30_000;
const SLOW_API_THRESHOLD_MS = 2_000;
const SENSITIVE_KEY_PATTERN =
  /(password|secret|token|cookie|authorization|api[_-]?key|access[_-]?key|private|credential|database_url|redis_url|customerAccessToken)/i;
const SENSITIVE_TEXT_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /(password|secret|token|cookie|authorization|api[_-]?key)=([^&\s]+)/gi
];

export class SmokeHttpError extends Error {
  constructor(message, metadata = {}) {
    super(message);
    this.name = "SmokeHttpError";
    Object.assign(this, metadata);
  }
}

export function trimTrailingSlash(value) {
  return String(value ?? "").replace(/\/+$/, "");
}

export function normalizeApiBaseUrl(value) {
  const base = trimTrailingSlash(value);

  if (!base) {
    return "";
  }

  return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
}

export function getApiOriginUrl(apiBaseUrl) {
  const base = normalizeApiBaseUrl(apiBaseUrl);
  return base.endsWith("/api/v1") ? base.slice(0, -"/api/v1".length) : base;
}

export function parseArgs(argv = []) {
  const args = {
    mode: "full",
    apiOnly: false,
    webOnly: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--mode") {
      args.mode = argv[index + 1] ?? args.mode;
      index += 1;
    } else if (arg.startsWith("--mode=")) {
      args.mode = arg.slice("--mode=".length);
    } else if (arg === "--api-only") {
      args.apiOnly = true;
    } else if (arg === "--web-only") {
      args.webOnly = true;
    }
  }

  if (!["safe", "full"].includes(args.mode)) {
    throw new Error(`Unsupported smoke mode "${args.mode}". Use safe or full.`);
  }

  return args;
}

export function loadSmokeEnvFile(filePath = ".env.smoke.local") {
  const resolved = resolve(filePath);

  if (!existsSync(resolved)) {
    return {};
  }

  const content = readFileSync(resolved, "utf8");
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

export function readSmokeConfig({
  env = process.env,
  argv = [],
  envFile = ".env.smoke.local"
} = {}) {
  const fileEnv = loadSmokeEnvFile(envFile);
  const merged = { ...fileEnv, ...env };
  const args = parseArgs(argv);
  const configuredRunId = String(merged.SMOKE_RUN_ID ?? "").trim();
  const runId =
    configuredRunId ||
    `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const timeoutMs = Number.parseInt(
    merged.SMOKE_TIMEOUT_MS ?? String(DEFAULT_TIMEOUT_MS),
    10
  );

  return {
    runId,
    mode: args.mode,
    apiOnly: args.apiOnly,
    webOnly: args.webOnly,
    environment: merged.SMOKE_ENVIRONMENT ?? "staging",
    webBaseUrl: trimTrailingSlash(merged.SMOKE_WEB_BASE_URL),
    apiBaseUrl: normalizeApiBaseUrl(merged.SMOKE_API_BASE_URL),
    apiOriginUrl: getApiOriginUrl(merged.SMOKE_API_BASE_URL),
    branchSlug: merged.SMOKE_DEMO_BRANCH_SLUG ?? "balkona",
    tableQrToken: merged.SMOKE_DEMO_TABLE_QR_TOKEN,
    table2QrToken: merged.SMOKE_DEMO_TABLE_2_QR_TOKEN,
    branchId: merged.SMOKE_BRANCH_ID,
    companyId: merged.SMOKE_COMPANY_ID,
    menuItemName: merged.SMOKE_MENU_ITEM_NAME ?? "Spanish Latte",
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    retryTransient: String(merged.SMOKE_RETRY_TRANSIENT ?? "true") === "true",
    gitSha:
      merged.GIT_SHA ??
      merged.VERCEL_GIT_COMMIT_SHA ??
      merged.RAILWAY_GIT_COMMIT_SHA ??
      "local",
    startedFromCi: String(merged.CI ?? "false") === "true",
    clientTraceId: `${runId}:client:${randomId(8)}`,
    credentials: {
      platform: readRoleCredential(merged, "PLATFORM"),
      owner: readRoleCredential(merged, "OWNER"),
      cashier: readRoleCredential(merged, "CASHIER"),
      kitchen: readRoleCredential(merged, "KITCHEN"),
      barista: readRoleCredential(merged, "BARISTA"),
      waiter: readRoleCredential(merged, "WAITER")
    }
  };
}

function readRoleCredential(env, role) {
  return {
    email: env[`SMOKE_${role}_EMAIL`],
    password: env[`SMOKE_${role}_PASSWORD`],
    branchId: env[`SMOKE_${role}_BRANCH_ID`] ?? env.SMOKE_BRANCH_ID
  };
}

export function validateSmokeConfig(config) {
  const missing = [];

  if (!config.webBaseUrl) {
    missing.push("SMOKE_WEB_BASE_URL");
  }

  if (!config.apiBaseUrl) {
    missing.push("SMOKE_API_BASE_URL");
  }

  return missing;
}

export function redactSensitiveText(value) {
  let next = String(value ?? "");

  for (const pattern of SENSITIVE_TEXT_PATTERNS) {
    next = next.replace(pattern, (match, key) =>
      key ? `${key}=[redacted]` : "[redacted]"
    );
  }

  return next;
}

export function sanitizeValue(value, depth = 0) {
  if (depth > 6) {
    return "[max_depth]";
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const output = {};

    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = sanitizeValue(child, depth + 1);
      }
    }

    return output;
  }

  return String(value);
}

export function safePublicConfig(config) {
  return sanitizeValue({
    runId: config.runId,
    mode: config.mode,
    environment: config.environment,
    webBaseUrl: config.webBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    branchSlug: config.branchSlug,
    tableQrTokenPresent: Boolean(config.tableQrToken),
    table2QrTokenPresent: Boolean(config.table2QrToken),
    roles: Object.fromEntries(
      Object.entries(config.credentials).map(([role, credential]) => [
        role,
        {
          emailPresent: Boolean(credential.email),
          passwordPresent: Boolean(credential.password),
          branchIdPresent: Boolean(credential.branchId)
        }
      ])
    )
  });
}

export function randomId(length = 12) {
  const source =
    globalThis.crypto?.randomUUID?.().replace(/-/g, "") ??
    Math.random().toString(16).slice(2);

  return source.slice(0, length);
}

export function toIso(value = Date.now()) {
  return new Date(value).toISOString();
}

export function durationMs(startedAtMs, finishedAtMs = Date.now()) {
  return Math.max(0, Math.round(finishedAtMs - startedAtMs));
}

export function buildQuery(query) {
  if (!query || Object.keys(query).length === 0) {
    return "";
  }

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

export class SmokeHttpClient {
  constructor(config) {
    this.config = config;
  }

  async request({
    method = "GET",
    path,
    url,
    role = "system",
    token,
    body,
    query,
    action,
    flowId,
    idempotencyKey,
    timeoutMs = this.config.timeoutMs
  }) {
    const endpoint = url ?? `${this.config.apiBaseUrl}/${path.replace(/^\//, "")}`;
    const requestUrl = `${endpoint}${buildQuery(query)}`;
    const requestId = `smoke-${randomId(18)}`;
    const effectiveFlowId =
      flowId ?? `${this.config.runId}:${action ?? role}:${randomId(6)}`;
    const headers = {
      Accept: "application/json",
      "User-Agent": `balcona-smoke-runner/${this.config.runId}`,
      "X-Request-Id": requestId,
      "X-Flow-Id": effectiveFlowId,
      "X-Client-Trace-Id": this.config.clientTraceId
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }

    const init = {
      method,
      headers
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const startedAtMs = Date.now();

    init.signal = controller.signal;

    try {
      const response = await fetch(requestUrl, init);
      const finishedAtMs = Date.now();
      const responseText = await response.text();
      const json = parseJson(responseText);
      const responseRequestId =
        response.headers.get("x-request-id") ??
        getNestedString(json, ["requestId"]) ??
        getNestedString(json, ["error", "requestId"]) ??
        requestId;
      const metadata = {
        method,
        endpoint,
        pageOrEndpoint: endpoint,
        role,
        statusCode: response.status,
        requestId: responseRequestId,
        flowId: response.headers.get("x-flow-id") ?? effectiveFlowId,
        clientTraceId:
          response.headers.get("x-client-trace-id") ?? this.config.clientTraceId,
        durationMs: durationMs(startedAtMs, finishedAtMs),
        body: json ?? responseText
      };

      if (!response.ok) {
        const safeError = extractSafeError(json ?? responseText);

        throw new SmokeHttpError(safeError.message, {
          ...metadata,
          code: safeError.code,
          errorMessage: safeError.message,
          responseBody: sanitizeValue(json ?? responseText)
        });
      }

      return metadata;
    } catch (error) {
      const finishedAtMs = Date.now();

      if (error instanceof SmokeHttpError) {
        throw error;
      }

      const isTimeout = error?.name === "AbortError";
      throw new SmokeHttpError(
        isTimeout
          ? `Request timed out after ${timeoutMs}ms`
          : redactSensitiveText(error?.message ?? "Request failed"),
        {
          method,
          endpoint,
          pageOrEndpoint: endpoint,
          role,
          statusCode: isTimeout ? 0 : undefined,
          requestId,
          flowId: effectiveFlowId,
          clientTraceId: this.config.clientTraceId,
          durationMs: durationMs(startedAtMs, finishedAtMs),
          code: isTimeout ? "SMOKE_TIMEOUT" : "SMOKE_REQUEST_FAILED",
          errorMessage: isTimeout
            ? `Request timed out after ${timeoutMs}ms`
            : redactSensitiveText(error?.message ?? "Request failed")
        }
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJson(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function extractSafeError(value) {
  if (!value || typeof value !== "object") {
    return {
      code: "HTTP_ERROR",
      message: redactSensitiveText(String(value || "HTTP request failed"))
    };
  }

  const record = value;
  const error = record.error && typeof record.error === "object" ? record.error : record;
  const code =
    stringOrUndefined(error.code) ??
    stringOrUndefined(record.code) ??
    "HTTP_ERROR";
  const messageValue =
    error.message ?? record.message ?? error.error ?? "HTTP request failed";
  const message = Array.isArray(messageValue)
    ? messageValue.join("; ")
    : String(messageValue);

  return {
    code,
    message: redactSensitiveText(message)
  };
}

function stringOrUndefined(value) {
  return typeof value === "string" && value ? value : undefined;
}

export function getNestedString(value, path) {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[key];
  }

  return typeof current === "string" ? current : undefined;
}

export function getByPath(value, path) {
  let current = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = current[key];
  }

  return current;
}

export function findFirstRecord(value, predicate, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return null;
  }

  seen.add(value);

  if (!Array.isArray(value) && predicate(value)) {
    return value;
  }

  const children = Array.isArray(value) ? value : Object.values(value);

  for (const child of children) {
    const match = findFirstRecord(child, predicate, seen);

    if (match) {
      return match;
    }
  }

  return null;
}

export function findRecords(value, predicate, seen = new Set(), matches = []) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return matches;
  }

  seen.add(value);

  if (!Array.isArray(value) && predicate(value)) {
    matches.push(value);
  }

  const children = Array.isArray(value) ? value : Object.values(value);

  for (const child of children) {
    findRecords(child, predicate, seen, matches);
  }

  return matches;
}

export function extractEntityIds(value) {
  const output = {};
  const mappings = {
    sessionId: ["sessionId", "tableSessionId"],
    cartId: ["cartId"],
    orderId: ["orderId"],
    orderNumber: ["orderNumber"],
    preparationTaskId: ["preparationTaskId", "taskId"],
    kitchenTicketId: ["kitchenTicketId", "ticketId"],
    waiterCallId: ["waiterCallId"],
    billRequestId: ["billRequestId"],
    aiSessionId: ["aiSessionId", "aiWaiterSessionId"],
    proposalId: ["proposalId", "cartProposalId"],
    branchId: ["branchId"],
    companyId: ["companyId"],
    tableId: ["tableId"]
  };

  for (const [entityKey, possibleKeys] of Object.entries(mappings)) {
    const found = findFirstRecord(value, (record) =>
      possibleKeys.some((key) => typeof record[key] === "string")
    );
    const matchedKey = possibleKeys.find((key) => typeof found?.[key] === "string");

    if (matchedKey) {
      output[entityKey] = found[matchedKey];
    }
  }

  const directId = typeof value?.id === "string" ? value.id : undefined;

  if (!output.sessionId && value?.session && typeof value.session.id === "string") {
    output.sessionId = value.session.id;
  }

  if (!output.cartId && value?.cart?.cart && typeof value.cart.cart.id === "string") {
    output.cartId = value.cart.cart.id;
  }

  if (!output.orderId && value?.order && typeof value.order.id === "string") {
    output.orderId = value.order.id;
  }

  if (!output.preparationTaskId && value?.task && typeof value.task.id === "string") {
    output.preparationTaskId = value.task.id;
  }

  if (!output.kitchenTicketId && value?.ticket && typeof value.ticket.id === "string") {
    output.kitchenTicketId = value.ticket.id;
  }

  if (!output.waiterCallId && value?.waiterCall && typeof value.waiterCall.id === "string") {
    output.waiterCallId = value.waiterCall.id;
  }

  if (!output.billRequestId && value?.billRequest && typeof value.billRequest.id === "string") {
    output.billRequestId = value.billRequest.id;
  }

  if (!output.aiSessionId && value?.session && typeof value.session.id === "string") {
    output.aiSessionId = value.session.id;
  }

  if (!output.proposalId && value?.cartProposal && typeof value.cartProposal.id === "string") {
    output.proposalId = value.cartProposal.id;
  }

  if (!output.branchId && value?.branch && typeof value.branch.id === "string") {
    output.branchId = value.branch.id;
  }

  if (!output.companyId && value?.company && typeof value.company.id === "string") {
    output.companyId = value.company.id;
  }

  if (!output.tableId && value?.table && typeof value.table.id === "string") {
    output.tableId = value.table.id;
  }

  if (directId && Object.keys(output).length === 0) {
    output.id = directId;
  }

  return sanitizeValue(output);
}

export function createCoverageMatrix() {
  const categories = {
    Customer: [
      "table open",
      "menu load",
      "item detail",
      "add cart",
      "cart load",
      "cart validate",
      "submit cart",
      "order status",
      "AI waiter",
      "AI proposal apply",
      "call waiter",
      "request bill"
    ],
    Staff: [
      "cashier login",
      "cashier order list",
      "cashier accept",
      "kitchen login",
      "kitchen ticket list",
      "preparation task start",
      "preparation task ready",
      "waiter login",
      "waiter call acknowledge/resolve"
    ],
    Owner: [
      "owner login",
      "owner dashboard load",
      "branch/menu/orders summary load"
    ],
    Platform: [
      "platform login",
      "company list load",
      "branch/company navigation"
    ],
    System: [
      "API health",
      "web health/build metadata",
      "migration/schema status if available",
      "request correlation present",
      "debug report available"
    ],
    "AI Waiter": [
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
    ]
  };

  return Object.fromEntries(
    Object.entries(categories).map(([category, rows]) => [
      category,
      rows.map((name) => ({
        name,
        covered: "no",
        status: "skipped",
        durationMs: null,
        requestId: null,
        notes: "not run"
      }))
    ])
  );
}

export class SmokeRun {
  constructor(config) {
    this.config = config;
    this.http = new SmokeHttpClient(config);
    this.startedAt = toIso();
    this.startedAtMs = Date.now();
    this.steps = [];
    this.coverage = createCoverageMatrix();
    this.entityIds = {};
    this.breadcrumbs = [];
    this.tokens = {};
    this.auth = {};
    this.flowDurations = {
      customerFlowDurationMs: 0,
      cashierFlowDurationMs: 0,
      kitchenFlowDurationMs: 0,
      waiterServiceFlowDurationMs: 0,
      billFlowDurationMs: 0,
      ownerFlowDurationMs: 0,
      platformFlowDurationMs: 0
    };
  }

  addBreadcrumb(entry) {
    this.breadcrumbs.push(
      sanitizeValue({
        timestamp: toIso(),
        action: entry.action,
        route: entry.route,
        flow: entry.flow,
        status: entry.status,
        requestId: entry.requestId,
        durationMs: entry.durationMs
      })
    );
    this.breadcrumbs = this.breadcrumbs.slice(-30);
  }

  setCoverage(category, name, patch) {
    const rows = this.coverage[category];

    if (!rows) {
      return;
    }

    const row = rows.find((candidate) => candidate.name === name);

    if (!row) {
      return;
    }

    Object.assign(row, sanitizeValue(patch));
  }

  async step(definition, fn) {
    const retryAttempts = [];
    const maxAttempts =
      this.config.retryTransient && definition.retryable ? 2 : 1;
    const stepStartedAtMs = Date.now();
    const stepStartedAt = toIso(stepStartedAtMs);
    let firstFailureReason = null;
    let result;

    if (definition.skipReason) {
      const step = this.buildSkippedStep(definition, definition.skipReason);
      this.steps.push(step);
      this.updateCoverageFromStep(definition, step);
      this.addBreadcrumb({
        action: definition.stepName,
        route: definition.pageOrEndpoint,
        flow: definition.group,
        status: "skipped",
        durationMs: 0
      });
      return step;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptStartedAtMs = Date.now();
      const attemptStartedAt = toIso(attemptStartedAtMs);

      try {
        result = await fn({
          attempt,
          http: this.http,
          run: this
        });
        const attemptFinishedAtMs = Date.now();
        retryAttempts.push({
          attempt,
          startedAt: attemptStartedAt,
          finishedAt: toIso(attemptFinishedAtMs),
          durationMs: durationMs(attemptStartedAtMs, attemptFinishedAtMs),
          status: "passed",
          requestId: result?.requestId ?? result?.http?.requestId
        });
        break;
      } catch (error) {
        const attemptFinishedAtMs = Date.now();
        const safeError = errorToStepError(error);
        firstFailureReason ??= safeError.message;
        retryAttempts.push({
          attempt,
          startedAt: attemptStartedAt,
          finishedAt: toIso(attemptFinishedAtMs),
          durationMs: durationMs(attemptStartedAtMs, attemptFinishedAtMs),
          status: "failed",
          requestId: safeError.requestId,
          errorCode: safeError.code,
          errorMessage: safeError.message
        });

        if (attempt === maxAttempts) {
          const step = this.buildFailedStep({
            definition,
            error,
            stepStartedAt,
            stepStartedAtMs,
            retryAttempts,
            firstFailureReason
          });
          this.steps.push(step);
          this.addFlowDuration(definition.group, step.durationMs);
          this.updateCoverageFromStep(definition, step);
          this.addBreadcrumb({
            action: definition.stepName,
            route: definition.pageOrEndpoint,
            flow: definition.group,
            status: "failed",
            requestId: step.requestId,
            durationMs: step.durationMs
          });
          return step;
        }
      }
    }

    const stepFinishedAtMs = Date.now();
    const httpResult = result?.http ?? result;
    const totalDurationMs = durationMs(stepStartedAtMs, stepFinishedAtMs);
    const thresholdMs = definition.thresholdMs;
    const resultWarning = result?.status === "warning";
    const isSlowApi =
      httpResult?.durationMs !== undefined &&
      httpResult.durationMs > SLOW_API_THRESHOLD_MS;
    const isSlowStep = thresholdMs !== undefined && totalDurationMs > thresholdMs;
    const retryCount = Math.max(0, retryAttempts.length - 1);
    const status =
      retryCount > 0
        ? "passed_with_retry"
        : resultWarning || isSlowApi || isSlowStep
          ? "warning"
          : "passed";
    const notes = [
      ...(Array.isArray(result?.notes) ? result.notes : []),
      isSlowApi ? `slow_request: API request > ${SLOW_API_THRESHOLD_MS}ms` : null,
      isSlowStep && thresholdMs
        ? `slow_step: exceeded ${thresholdMs}ms threshold`
        : null,
      retryCount > 0 ? `first failure: ${firstFailureReason}` : null
    ].filter(Boolean);
    const entityIds = {
      ...extractEntityIds(httpResult?.body),
      ...sanitizeValue(result?.entityIds ?? {})
    };
    const step = sanitizeValue({
      stepName: definition.stepName,
      role: definition.role ?? "system",
      pageOrEndpoint: definition.pageOrEndpoint ?? httpResult?.pageOrEndpoint,
      method: definition.method ?? httpResult?.method ?? "GET",
      startedAt: stepStartedAt,
      finishedAt: toIso(stepFinishedAtMs),
      durationMs: totalDurationMs,
      status,
      critical: Boolean(definition.critical),
      retryCount,
      retryAttempts,
      firstFailureReason: retryCount > 0 ? firstFailureReason : undefined,
      requestId: httpResult?.requestId,
      flowId: httpResult?.flowId,
      clientTraceId: httpResult?.clientTraceId,
      entityIds,
      notes
    });

    this.mergeEntityIds(entityIds);
    this.steps.push(step);
    this.addFlowDuration(definition.group, totalDurationMs);
    this.updateCoverageFromStep(definition, step);
    this.addBreadcrumb({
      action: definition.stepName,
      route: step.pageOrEndpoint,
      flow: definition.group,
      status,
      requestId: step.requestId,
      durationMs: step.durationMs
    });

    return step;
  }

  buildSkippedStep(definition, reason) {
    return sanitizeValue({
      stepName: definition.stepName,
      role: definition.role ?? "system",
      pageOrEndpoint: definition.pageOrEndpoint,
      method: definition.method ?? "GET",
      startedAt: toIso(),
      finishedAt: toIso(),
      durationMs: 0,
      status: "skipped",
      critical: Boolean(definition.critical),
      retryCount: 0,
      retryAttempts: [],
      entityIds: {},
      notes: [reason]
    });
  }

  buildFailedStep({
    definition,
    error,
    stepStartedAt,
    stepStartedAtMs,
    retryAttempts,
    firstFailureReason
  }) {
    const finishedAtMs = Date.now();
    const safeError = errorToStepError(error);
    const entityIds = extractEntityIds(error?.responseBody ?? {});

    this.mergeEntityIds(entityIds);
    return sanitizeValue({
      stepName: definition.stepName,
      role: definition.role ?? safeError.role ?? "system",
      pageOrEndpoint:
        definition.pageOrEndpoint ?? safeError.pageOrEndpoint ?? safeError.endpoint,
      method: definition.method ?? safeError.method ?? "GET",
      startedAt: stepStartedAt,
      finishedAt: toIso(finishedAtMs),
      durationMs: durationMs(stepStartedAtMs, finishedAtMs),
      status: "failed",
      critical: Boolean(definition.critical),
      retryCount: Math.max(0, retryAttempts.length - 1),
      retryAttempts,
      firstFailureReason,
      requestId: safeError.requestId,
      flowId: safeError.flowId,
      clientTraceId: safeError.clientTraceId,
      entityIds,
      error: {
        code: safeError.code,
        message: safeError.message,
        statusCode: safeError.statusCode
      },
      notes: [safeError.message]
    });
  }

  updateCoverageFromStep(definition, step) {
    if (!definition.coverage) {
      return;
    }

    const covered = step.status === "skipped" ? "skipped" : "yes";

    this.setCoverage(definition.coverage.category, definition.coverage.name, {
      covered,
      status: step.status,
      durationMs: step.durationMs,
      requestId: step.requestId,
      notes: step.notes?.join("; ") || step.error?.message || ""
    });
  }

  mergeEntityIds(entityIds = {}) {
    for (const [key, value] of Object.entries(entityIds)) {
      if (value && !this.entityIds[key]) {
        this.entityIds[key] = value;
      }
    }
  }

  addFlowDuration(group, value) {
    const mapping = {
      customer: "customerFlowDurationMs",
      cashier: "cashierFlowDurationMs",
      kitchen: "kitchenFlowDurationMs",
      waiter: "waiterServiceFlowDurationMs",
      bill: "billFlowDurationMs",
      owner: "ownerFlowDurationMs",
      platform: "platformFlowDurationMs"
    };
    const key = mapping[group];

    if (key) {
      this.flowDurations[key] += value;
    }
  }

  finish() {
    const finishedAtMs = Date.now();
    const counts = Object.fromEntries(
      STEP_STATUSES.map((status) => [
        status,
        this.steps.filter((step) => step.status === status).length
      ])
    );
    const criticalFailures = this.steps.filter(
      (step) => step.status === "failed" && step.critical
    );
    const slowRequestsCount = this.steps.filter((step) =>
      step.notes?.some((note) => String(note).includes("slow_request"))
    ).length;
    const warnings =
      counts.warning + counts.passed_with_retry + slowRequestsCount;
    const hasOptionalSkips = this.steps.some(
      (step) => step.status === "skipped" && !step.critical
    );
    const overallResult =
      criticalFailures.length > 0
        ? "FAIL"
        : warnings > 0 || counts.skipped > 0 || hasOptionalSkips
          ? "PASS_WITH_WARNINGS"
          : "PASS";

    return sanitizeValue({
      runId: this.config.runId,
      environment: this.config.environment,
      mode: this.config.mode,
      startedAt: this.startedAt,
      finishedAt: toIso(finishedAtMs),
      baseUrls: {
        webBaseUrl: this.config.webBaseUrl,
        apiBaseUrl: this.config.apiBaseUrl
      },
      gitSha: this.config.gitSha,
      timings: {
        totalRunDurationMs: durationMs(this.startedAtMs, finishedAtMs),
        ...this.flowDurations
      },
      score: {
        totalSteps: this.steps.length,
        passed: counts.passed,
        passedWithRetry: counts.passed_with_retry,
        warnings: counts.warning,
        skipped: counts.skipped,
        failed: counts.failed,
        slowRequestsCount,
        totalDurationMs: durationMs(this.startedAtMs, finishedAtMs),
        overallResult
      },
      entityIds: this.entityIds,
      steps: this.steps,
      coverage: this.coverage,
      breadcrumbs: this.breadcrumbs,
      failureBundles: this.steps
        .filter((step) => step.status === "failed")
        .map((step) => buildFailureBundle(this.config, step, this.breadcrumbs))
    });
  }
}

function errorToStepError(error) {
  return sanitizeValue({
    code: error?.code ?? "SMOKE_STEP_FAILED",
    message: error?.errorMessage ?? error?.message ?? "Smoke step failed",
    requestId: error?.requestId,
    flowId: error?.flowId,
    clientTraceId: error?.clientTraceId,
    statusCode: error?.statusCode,
    endpoint: error?.endpoint,
    pageOrEndpoint: error?.pageOrEndpoint,
    method: error?.method,
    role: error?.role
  });
}

export function buildFailureBundle(config, step, breadcrumbs = []) {
  const entityIds = JSON.stringify(step.entityIds ?? {});
  const lastBreadcrumbs = JSON.stringify(breadcrumbs.slice(-5), null, 2);
  const searchParts = [
    step.requestId ? `requestId="${step.requestId}"` : null,
    step.flowId ? `flowId="${step.flowId}"` : null,
    step.clientTraceId ? `clientTraceId="${step.clientTraceId}"` : null
  ].filter(Boolean);

  return [
    "SMOKE FAILURE",
    `Run ID: ${config.runId}`,
    `Environment: ${config.environment}`,
    `Step: ${step.stepName}`,
    `Role: ${step.role}`,
    `Page/Endpoint: ${step.pageOrEndpoint}`,
    `Status: ${step.status}`,
    `Duration: ${step.durationMs}ms`,
    `Request ID: ${step.requestId ?? ""}`,
    `Flow ID: ${step.flowId ?? ""}`,
    `Client Trace ID: ${step.clientTraceId ?? ""}`,
    `Entity IDs: ${entityIds}`,
    `Error Code: ${step.error?.code ?? ""}`,
    `Error Message: ${step.error?.message ?? ""}`,
    `Retry Count: ${step.retryCount ?? 0}`,
    `Last 5 Breadcrumbs: ${lastBreadcrumbs}`,
    `Suggested Log Search: ${searchParts.join(" OR ")}`
  ].join("\n");
}

export async function writeSmokeArtifacts(report, outputDir = "smoke-results") {
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    `${outputDir}/latest.json`,
    `${JSON.stringify(sanitizeValue(report), null, 2)}\n`,
    "utf8"
  );
  await writeFile(`${outputDir}/latest.md`, renderMarkdownReport(report), "utf8");
  await writeFile(
    `${outputDir}/latest-summary.txt`,
    renderSummary(report),
    "utf8"
  );
}

export function renderSummary(report) {
  return [
    `Smoke run ${report.runId}`,
    `Environment: ${report.environment}`,
    `Overall result: ${report.score.overallResult}`,
    `Total steps: ${report.score.totalSteps}`,
    `Passed: ${report.score.passed}`,
    `Passed with retry: ${report.score.passedWithRetry}`,
    `Warnings: ${report.score.warnings}`,
    `Skipped: ${report.score.skipped}`,
    `Failed: ${report.score.failed}`,
    `Slow requests: ${report.score.slowRequestsCount}`,
    `Total duration: ${report.score.totalDurationMs}ms`
  ].join("\n");
}

export function renderMarkdownReport(report) {
  const lines = [
    `# Staging Smoke Report`,
    "",
    `- Run ID: \`${report.runId}\``,
    `- Environment: \`${report.environment}\``,
    `- Mode: \`${report.mode}\``,
    `- Overall result: **${report.score.overallResult}**`,
    `- Total duration: ${report.score.totalDurationMs}ms`,
    "",
    "## Final Score",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Total steps | ${report.score.totalSteps} |`,
    `| Passed | ${report.score.passed} |`,
    `| Passed with retry | ${report.score.passedWithRetry} |`,
    `| Warnings | ${report.score.warnings} |`,
    `| Skipped | ${report.score.skipped} |`,
    `| Failed | ${report.score.failed} |`,
    `| Slow requests | ${report.score.slowRequestsCount} |`,
    "",
    "## Flow Timings",
    "",
    "| Flow | Duration |",
    "| --- | ---: |",
    ...Object.entries(report.timings).map(
      ([key, value]) => `| ${key} | ${value}ms |`
    ),
    "",
    "## Steps",
    "",
    "| Step | Role | Method | Page/Endpoint | Status | Duration | Request ID | Notes |",
    "| --- | --- | --- | --- | --- | ---: | --- | --- |",
    ...report.steps.map(
      (step) =>
        `| ${escapePipe(step.stepName)} | ${escapePipe(step.role)} | ${escapePipe(step.method)} | ${escapePipe(step.pageOrEndpoint ?? "")} | ${step.status} | ${step.durationMs}ms | ${escapePipe(step.requestId ?? "")} | ${escapePipe((step.notes ?? []).join("; "))} |`
    ),
    "",
    "## Coverage Matrix",
    ""
  ];

  for (const [category, rows] of Object.entries(report.coverage)) {
    lines.push(`### ${category}`, "");
    lines.push("| Row | Covered | Status | Duration | Request ID | Notes |");
    lines.push("| --- | --- | --- | ---: | --- | --- |");

    for (const row of rows) {
      lines.push(
        `| ${escapePipe(row.name)} | ${row.covered} | ${row.status} | ${row.durationMs ?? ""} | ${escapePipe(row.requestId ?? "")} | ${escapePipe(row.notes ?? "")} |`
      );
    }

    lines.push("");
  }

  if (report.failureBundles.length > 0) {
    lines.push("## Failure Bundles", "");

    for (const bundle of report.failureBundles) {
      lines.push("```text", bundle, "```", "");
    }
  }

  return `${lines.join("\n")}\n`;
}

function escapePipe(value) {
  return String(value ?? "").replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}
