import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  extractSafeError,
  loadSmokeEnvFile,
  normalizeApiBaseUrl,
  redactSensitiveText,
  sanitizeValue
} from "./smoke-core.mjs";

export const SMOKE_BOOTSTRAP_EMAILS = {
  owner: "smoke-owner@balcona.test",
  cashier: "smoke-cashier@balcona.test",
  kitchen: "smoke-kitchen@balcona.test",
  barista: "smoke-barista@balcona.test",
  waiter: "smoke-waiter@balcona.test",
  platform: "smoke-platform@balcona.test"
};

const ROLE_KEYS = Object.keys(SMOKE_BOOTSTRAP_EMAILS);
const DEFAULT_ENV_FILE = ".env.smoke.local";

export async function main({ env = process.env, envFile = DEFAULT_ENV_FILE } = {}) {
  const fileEnv = loadSmokeEnvFile(envFile);
  const mergedEnv = { ...fileEnv, ...env };
  const config = readSmokeBootstrapConfig(mergedEnv);
  assertSafeBootstrapEnvironment(mergedEnv);
  const credentialPlan = buildSmokeCredentials(mergedEnv, {
    overwrite: config.overwrite
  });
  const response = await callSmokeBootstrapEndpoint({
    apiBaseUrl: config.apiBaseUrl,
    token: config.token,
    credentials: credentialPlan.credentials
  });
  const updates = buildSmokeEnvUpdates(response.body, credentialPlan.credentials);
  const writeResult = await updateSmokeEnvFile({
    envFile,
    updates,
    overwrite: config.overwrite
  });
  const summary = renderBootstrapSummary({
    response: response.body,
    credentialPlan,
    writeResult
  });

  console.log(summary);
}

export function readSmokeBootstrapConfig(env) {
  const apiBaseUrl = normalizeApiBaseUrl(env.SMOKE_API_BASE_URL);
  const webBaseUrl = String(env.SMOKE_WEB_BASE_URL ?? "").trim();
  const token = String(env.SMOKE_BOOTSTRAP_TOKEN ?? env.SMOKE_RESET_TOKEN ?? "")
    .trim();
  const missing = [];

  if (!webBaseUrl) {
    missing.push("SMOKE_WEB_BASE_URL");
  }

  if (!apiBaseUrl) {
    missing.push("SMOKE_API_BASE_URL");
  }

  if (!token) {
    missing.push("SMOKE_BOOTSTRAP_TOKEN or SMOKE_RESET_TOKEN");
  }

  if (missing.length > 0) {
    const error = new Error(`Missing required smoke bootstrap env vars: ${missing.join(", ")}`);

    error.code = "SMOKE_BOOTSTRAP_CONFIG_MISSING";
    error.missing = missing;
    throw error;
  }

  return {
    apiBaseUrl,
    webBaseUrl,
    token,
    overwrite: String(env.SMOKE_BOOTSTRAP_OVERWRITE ?? "false") === "true"
  };
}

export function assertSafeBootstrapEnvironment(env) {
  const smokeEnvironment = String(env.SMOKE_ENVIRONMENT ?? "staging").toLowerCase();
  const appEnvironment = String(env.APP_ENV ?? "").toLowerCase();

  if (smokeEnvironment === "production" || smokeEnvironment === "prod" || appEnvironment === "production") {
    const error = new Error("Smoke bootstrap is disabled in production");

    error.code = "SMOKE_BOOTSTRAP_DISABLED_IN_PRODUCTION";
    throw error;
  }
}

export function buildSmokeCredentials(
  env,
  { overwrite = false, passwordFactory = generateSmokePassword } = {}
) {
  const credentials = {};
  const credentialStatus = {};

  for (const role of ROLE_KEYS) {
    const upperRole = role.toUpperCase();
    const emailKey = `SMOKE_${upperRole}_EMAIL`;
    const passwordKey = `SMOKE_${upperRole}_PASSWORD`;
    const configuredEmail = String(env[emailKey] ?? "").trim().toLowerCase();
    const expectedEmail = SMOKE_BOOTSTRAP_EMAILS[role];

    if (configuredEmail && configuredEmail !== expectedEmail && !overwrite) {
      const error = new Error(
        `${emailKey} is not the deterministic smoke email. Set SMOKE_BOOTSTRAP_OVERWRITE=true to replace it.`
      );

      error.code = "SMOKE_BOOTSTRAP_NON_SMOKE_ENV_VALUE";
      error.key = emailKey;
      throw error;
    }

    const email = overwrite || !configuredEmail ? expectedEmail : configuredEmail;
    const configuredPassword = String(env[passwordKey] ?? "");
    const password =
      overwrite || !configuredPassword ? passwordFactory(role) : configuredPassword;

    if (password.length < 16) {
      const error = new Error(
        `${passwordKey} must be at least 16 characters for smoke bootstrap`
      );

      error.code = "SMOKE_BOOTSTRAP_PASSWORD_TOO_SHORT";
      error.key = passwordKey;
      throw error;
    }

    credentials[role] = { email, password };
    credentialStatus[role] = {
      email,
      passwordGenerated: password !== configuredPassword,
      passwordWritten: false
    };
  }

  return { credentials, credentialStatus };
}

export async function callSmokeBootstrapEndpoint({
  apiBaseUrl,
  token,
  credentials
}) {
  const endpoint = `${normalizeApiBaseUrl(apiBaseUrl)}/smoke/bootstrap`;
  const requestId = `smoke-bootstrap-${randomUUID()}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "balcona-smoke-bootstrap",
      "X-Request-Id": requestId,
      "X-Smoke-Bootstrap-Token": token
    },
    body: JSON.stringify({
      credentials,
      metadata: {
        source: "smoke_bootstrap_script",
        requestId
      }
    })
  });
  const responseText = await response.text();
  const body = parseJson(responseText) ?? responseText;

  if (!response.ok) {
    const safeError = extractSafeError(body);
    const error = new Error(safeError.message);

    error.code = safeError.code;
    error.statusCode = response.status;
    error.requestId = response.headers.get("x-request-id") ?? requestId;
    throw error;
  }

  return {
    statusCode: response.status,
    requestId: response.headers.get("x-request-id") ?? requestId,
    body
  };
}

export function buildSmokeEnvUpdates(response, credentials) {
  return {
    ...(response?.env ?? {}),
    SMOKE_OWNER_PASSWORD: credentials.owner.password,
    SMOKE_CASHIER_PASSWORD: credentials.cashier.password,
    SMOKE_KITCHEN_PASSWORD: credentials.kitchen.password,
    SMOKE_BARISTA_PASSWORD: credentials.barista.password,
    SMOKE_WAITER_PASSWORD: credentials.waiter.password,
    SMOKE_PLATFORM_PASSWORD: credentials.platform.password
  };
}

export async function updateSmokeEnvFile({
  envFile = DEFAULT_ENV_FILE,
  updates,
  overwrite = false
}) {
  const existingContent = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
  const result = updateEnvContent(existingContent, updates, { overwrite });

  await writeFile(envFile, result.content, "utf8");

  return result;
}

export function updateEnvContent(content, updates, { overwrite = false } = {}) {
  const lines = content ? content.split(/\r?\n/) : [];
  const seen = new Set();
  const writtenKeys = [];
  const preservedKeys = [];
  const nextLines = lines.map((line) => {
    const parsed = parseEnvLine(line);

    if (!parsed || !(parsed.key in updates)) {
      return line;
    }

    seen.add(parsed.key);

    if (overwrite || parsed.value === "") {
      writtenKeys.push(parsed.key);
      return `${parsed.key}=${formatEnvValue(updates[parsed.key])}`;
    }

    if (parsed.value !== String(updates[parsed.key] ?? "")) {
      preservedKeys.push(parsed.key);
    }

    return line;
  });
  const missingEntries = Object.entries(updates).filter(([key]) => !seen.has(key));

  if (missingEntries.length > 0) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }

    nextLines.push("# Generated by pnpm smoke:bootstrap:staging");

    for (const [key, value] of missingEntries) {
      writtenKeys.push(key);
      nextLines.push(`${key}=${formatEnvValue(value)}`);
    }
  }

  return {
    content: `${nextLines.join("\n").replace(/\n*$/, "")}\n`,
    writtenKeys,
    preservedKeys
  };
}

export function renderBootstrapSummary({
  response,
  credentialPlan,
  writeResult
}) {
  const lines = [
    "Smoke staging bootstrap completed",
    `companyId=${response?.company?.id ?? ""}`,
    `branchId=${response?.branch?.id ?? ""}`,
    `table1QrTokenWritten=${writeResult.writtenKeys.includes("SMOKE_DEMO_TABLE_QR_TOKEN")}`,
    `table2QrTokenWritten=${writeResult.writtenKeys.includes("SMOKE_DEMO_TABLE_2_QR_TOKEN")}`,
    "accounts:"
  ];

  for (const role of ROLE_KEYS) {
    const email = credentialPlan.credentials[role].email;
    const passwordKey = `SMOKE_${role.toUpperCase()}_PASSWORD`;

    lines.push(
      `- ${role}: email=${email} passwordWritten=${writeResult.writtenKeys.includes(passwordKey)}`
    );
  }

  if (writeResult.preservedKeys.length > 0) {
    lines.push(`preservedKeys=${writeResult.preservedKeys.join(",")}`);
  }

  lines.push("passwordValuesPrinted=false");

  return redactSensitiveText(lines.join("\n"));
}

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = line.indexOf("=");

  if (equalsIndex === -1) {
    return null;
  }

  const key = line.slice(0, equalsIndex).trim();
  let value = line.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function formatEnvValue(value) {
  const normalized = String(value ?? "");

  if (!normalized || /^[A-Za-z0-9@._:/?&=+-]+$/.test(normalized)) {
    return normalized;
  }

  return JSON.stringify(normalized);
}

function generateSmokePassword() {
  return `Smoke-${randomBytes(24).toString("base64url")}`;
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
      code: error?.code ?? "SMOKE_BOOTSTRAP_FAILED",
      message: error?.message ?? "Smoke bootstrap failed",
      requestId: error?.requestId,
      statusCode: error?.statusCode
    });

    console.error(`Smoke bootstrap failed: ${JSON.stringify(safe)}`);
    process.exitCode = 1;
  });
}
