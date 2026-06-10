#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  extractSafeError,
  loadSmokeEnvFile,
  normalizeApiBaseUrl,
  sanitizeValue
} from "./smoke-core.mjs";

const DEFAULT_ENV_FILE = ".env.smoke.local";

export async function main({ env = process.env, envFile = DEFAULT_ENV_FILE } = {}) {
  const fileEnv = loadSmokeEnvFile(envFile);
  const mergedEnv = { ...fileEnv, ...env };
  const config = readSmokeResetConfig(mergedEnv);
  const response = await callSmokeResetEndpoint(config);
  const summary = renderResetSummary(response.body);

  console.log(summary);

  return { response, summary };
}

export function readSmokeResetConfig(env) {
  const apiBaseUrl = normalizeApiBaseUrl(env.SMOKE_API_BASE_URL);
  const token = env.SMOKE_RESET_TOKEN || env.SMOKE_BOOTSTRAP_TOKEN;
  const smokeEnvironment = String(env.SMOKE_ENVIRONMENT ?? "staging").toLowerCase();
  const appEnvironment = String(env.APP_ENV ?? "").toLowerCase();
  const missing = [];

  if (!apiBaseUrl) {
    missing.push("SMOKE_API_BASE_URL");
  }

  if (!token) {
    missing.push("SMOKE_RESET_TOKEN or SMOKE_BOOTSTRAP_TOKEN");
  }

  if (missing.length > 0) {
    const error = new Error(`Missing required smoke reset env vars: ${missing.join(", ")}`);
    error.code = "SMOKE_RESET_CONFIG_MISSING";
    throw error;
  }

  if (
    smokeEnvironment === "production" ||
    smokeEnvironment === "prod" ||
    appEnvironment === "production"
  ) {
    const error = new Error("Smoke reset is disabled in production");
    error.code = "SMOKE_RESET_DISABLED_IN_PRODUCTION";
    throw error;
  }

  return {
    apiBaseUrl,
    token,
    requestId: `smoke-reset-${randomUUID()}`
  };
}

export async function callSmokeResetEndpoint({ apiBaseUrl, token, requestId }) {
  const endpoint = `${normalizeApiBaseUrl(apiBaseUrl)}/smoke/reset`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "User-Agent": "balcona-smoke-reset",
      "X-Request-Id": requestId ?? `smoke-reset-${randomUUID()}`,
      "X-Smoke-Bootstrap-Token": token
    }
  });
  const responseText = await response.text();
  const body = parseJson(responseText) ?? responseText;

  if (!response.ok) {
    const safeError = extractSafeError(body);
    const error = new Error(safeError.message);
    error.code = safeError.code ?? "SMOKE_RESET_FAILED";
    error.statusCode = response.status;
    error.requestId = response.headers.get("x-request-id") ?? requestId;
    throw error;
  }

  return {
    statusCode: response.status,
    requestId: response.headers.get("x-request-id") ?? requestId,
    body: sanitizeValue(body)
  };
}

export function renderResetSummary(response) {
  const body = sanitizeValue(response ?? {});
  const deleted = body.deleted ?? {};
  const lines = [
    "Smoke staging reset completed",
    `companyId: ${body.company?.id ?? ""}`,
    `branchId: ${body.branch?.id ?? ""}`,
    `resetAt: ${body.resetAt ?? ""}`,
    "deleted:"
  ];

  for (const [key, value] of Object.entries(deleted).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    lines.push(`- ${key}: ${value}`);
  }

  return lines.join("\n");
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    const safe = sanitizeValue({
      code: error?.code ?? "SMOKE_RESET_FAILED",
      message: error?.message ?? "Smoke reset failed",
      requestId: error?.requestId,
      statusCode: error?.statusCode
    });

    console.error(`Smoke reset failed: ${JSON.stringify(safe)}`);
    process.exitCode = 1;
  });
}
