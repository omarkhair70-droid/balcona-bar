import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, "../..");
export const messagePaths = {
  en: join(repoRoot, "apps/web/messages/en.json"),
  ar: join(repoRoot, "apps/web/messages/ar.json"),
  crowdin: join(repoRoot, "crowdin.yml")
};

export const requiredTopLevelNamespaces = [
  "common",
  "navigation",
  "customer",
  "cart",
  "status",
  "service",
  "staff",
  "cashier",
  "kitchen",
  "owner",
  "platform",
  "errors",
  "debug"
];

export const requiredCustomerAiNamespaces = [
  "actions",
  "composer",
  "empty",
  "errors",
  "escalation",
  "language",
  "messages",
  "page",
  "prompts",
  "proposal",
  "status",
  "tools"
];

export const forbiddenCatalogCodes = [
  "ai_waiter_close",
  "ai_proposal_apply",
  "ai_proposal_reject",
  "ai_waiter_send_message",
  "ai_waiter_start",
  "ai_waiter_state",
  "customer_ai_waiter"
];

const secretValuePatterns = [
  /\bBearer\s+[A-Za-z0-9._-]{12,}\b/i,
  /\b(?:sk|pk|rk|gho|ghp|github_pat)_[A-Za-z0-9_]{12,}\b/i,
  /\b(?:api[_ -]?key|authorization|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9._/-]{8,}/i,
  /\bCROWDIN_PERSONAL_TOKEN\s*[:=]\s*\S+/i,
  /\bCROWDIN_PROJECT_ID\s*[:=]\s*\d+/i
];

const crowdinSecretPatterns = [
  /^\s*(project_id|api_token|token|personal_token)\s*:/im,
  /CROWDIN_PERSONAL_TOKEN\s*[:=]\s*\S+/i,
  /Bearer\s+[A-Za-z0-9._-]+/i
];

export async function readText(path) {
  return readFile(path, "utf8");
}

export async function readJson(path) {
  return JSON.parse(await readText(path));
}

export async function loadCatalogs() {
  const [en, ar, crowdin] = await Promise.all([
    readJson(messagePaths.en),
    readJson(messagePaths.ar),
    readText(messagePaths.crowdin)
  ]);

  return { en, ar, crowdin };
}

export function flattenEntries(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    return nested && typeof nested === "object" && !Array.isArray(nested)
      ? flattenEntries(nested, nextPrefix)
      : [[nextPrefix, String(nested)]];
  });
}

export function flattenKeys(value) {
  return flattenEntries(value).map(([key]) => key);
}

export function getPath(value, keyPath) {
  return keyPath.split(".").reduce((current, segment) => {
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }

    return current[segment];
  }, value);
}

export function placeholders(value) {
  return Array.from(value.matchAll(/\{([a-zA-Z0-9_]+)\}/g))
    .map((match) => match[1])
    .sort();
}

export function isPlaceholderOnly(value) {
  const trimmed = value.trim();

  return (
    trimmed.length > 0 &&
    /^(?:\{[a-zA-Z0-9_]+\}|[\s.,:;!?()[\]/\\|+\-*"'`~،؛؟·–—])+$/u.test(trimmed)
  );
}

export function hasArabic(value) {
  return /[\u0600-\u06FF]/u.test(value);
}

export function hasLatinLetters(value) {
  return /[A-Za-z]/.test(value);
}

export function calculateArabicCoverage(enMessages, arMessages) {
  const enEntries = flattenEntries(enMessages);
  const arEntries = new Map(flattenEntries(arMessages));
  const suspiciousUntranslated = [];
  let arabicStrings = 0;
  let englishIdenticalStrings = 0;
  let placeholderOnlyStrings = 0;
  let missingArabicValues = 0;

  for (const [key, enValue] of enEntries) {
    const arValue = arEntries.get(key);

    if (typeof arValue !== "string") {
      missingArabicValues += 1;
      continue;
    }

    if (hasArabic(arValue)) {
      arabicStrings += 1;
    }

    if (arValue === enValue) {
      englishIdenticalStrings += 1;
      if (hasLatinLetters(arValue) && !isPlaceholderOnly(arValue)) {
        suspiciousUntranslated.push({ key, value: arValue });
      }
    }

    if (isPlaceholderOnly(arValue)) {
      placeholderOnlyStrings += 1;
    }
  }

  return {
    totalStrings: enEntries.length,
    arabicStrings,
    englishIdenticalStrings,
    placeholderOnlyStrings,
    missingArabicValues,
    suspiciousUntranslatedCount: suspiciousUntranslated.length,
    suspiciousUntranslated: suspiciousUntranslated.slice(0, 25)
  };
}

function pushSecretFindings(errors, label, entries) {
  for (const [key, value] of entries) {
    for (const pattern of secretValuePatterns) {
      if (pattern.test(value)) {
        errors.push(`${label}.${key} looks like it contains a secret or credential value`);
      }
    }
  }
}

function validateCatalogParity(errors, enMessages, arMessages) {
  const enKeys = flattenKeys(enMessages).sort();
  const arKeys = flattenKeys(arMessages).sort();

  if (JSON.stringify(enKeys) !== JSON.stringify(arKeys)) {
    const enOnly = enKeys.filter((key) => !arKeys.includes(key));
    const arOnly = arKeys.filter((key) => !enKeys.includes(key));

    errors.push(
      [
        "English and Arabic message keys do not match",
        enOnly.length ? `en-only: ${enOnly.slice(0, 20).join(", ")}` : "",
        arOnly.length ? `ar-only: ${arOnly.slice(0, 20).join(", ")}` : ""
      ]
        .filter(Boolean)
        .join("; ")
    );
  }
}

function validatePlaceholders(errors, enMessages, arMessages) {
  const arEntries = new Map(flattenEntries(arMessages));

  for (const [key, enValue] of flattenEntries(enMessages)) {
    const enPlaceholders = placeholders(enValue);
    const arPlaceholders = placeholders(arEntries.get(key) ?? "");

    if (JSON.stringify(enPlaceholders) !== JSON.stringify(arPlaceholders)) {
      errors.push(
        `Placeholder mismatch at ${key}: en={${enPlaceholders.join(",")}} ar={${arPlaceholders.join(",")}}`
      );
    }
  }
}

function validateRequiredNamespaces(errors, enMessages, arMessages) {
  for (const namespace of requiredTopLevelNamespaces) {
    if (!enMessages[namespace]) {
      errors.push(`Missing English top-level namespace: ${namespace}`);
    }

    if (!arMessages[namespace]) {
      errors.push(`Missing Arabic top-level namespace: ${namespace}`);
    }
  }

  for (const namespace of requiredCustomerAiNamespaces) {
    if (!getPath(enMessages, `customer.ai.${namespace}`)) {
      errors.push(`Missing English customer.ai namespace: ${namespace}`);
    }

    if (!getPath(arMessages, `customer.ai.${namespace}`)) {
      errors.push(`Missing Arabic customer.ai namespace: ${namespace}`);
    }
  }
}

function validateNoEmptyValues(errors, label, entries) {
  for (const [key, value] of entries) {
    if (value.trim() === "") {
      errors.push(`${label}.${key} is empty`);
    }
  }
}

function validateNoInternalCodes(errors, label, messages) {
  const entries = flattenEntries(messages);
  const customerAiDebug = getPath(messages, "customer.ai.debug");

  if (customerAiDebug !== undefined) {
    errors.push(`${label}.customer.ai.debug must not be cataloged for Crowdin`);
  }

  for (const [key, value] of entries) {
    for (const code of forbiddenCatalogCodes) {
      if (value.includes(code)) {
        errors.push(`${label}.${key} contains internal action/debug code ${code}`);
      }
    }
  }
}

function validateCrowdinConfig(errors, crowdinConfig) {
  if (!/source:\s*\/apps\/web\/messages\/en\.json/.test(crowdinConfig)) {
    errors.push("crowdin.yml must use /apps/web/messages/en.json as the source");
  }

  if (
    !/translation:\s*\/apps\/web\/messages\/%two_letters_code%\.json/.test(
      crowdinConfig
    )
  ) {
    errors.push(
      "crowdin.yml must use /apps/web/messages/%two_letters_code%.json as the translation target"
    );
  }

  if (!/preserve_hierarchy:\s*true/.test(crowdinConfig)) {
    errors.push("crowdin.yml must preserve hierarchy");
  }

  if (/source:\s*\/apps\/web\/messages\/ar\.json/.test(crowdinConfig)) {
    errors.push("crowdin.yml must not treat ar.json as a source file");
  }

  for (const pattern of crowdinSecretPatterns) {
    if (pattern.test(crowdinConfig)) {
      errors.push("crowdin.yml must not contain project IDs, tokens, or credentials");
    }
  }
}

export async function runI18nQa() {
  const errors = [];
  const warnings = [];
  const { en, ar, crowdin } = await loadCatalogs();
  const enEntries = flattenEntries(en);
  const arEntries = flattenEntries(ar);

  validateCatalogParity(errors, en, ar);
  validatePlaceholders(errors, en, ar);
  validateRequiredNamespaces(errors, en, ar);
  validateNoEmptyValues(errors, "en", enEntries);
  validateNoEmptyValues(errors, "ar", arEntries);
  validateNoInternalCodes(errors, "en", en);
  validateNoInternalCodes(errors, "ar", ar);
  pushSecretFindings(errors, "en", enEntries);
  pushSecretFindings(errors, "ar", arEntries);
  validateCrowdinConfig(errors, crowdin);

  const coverage = calculateArabicCoverage(en, ar);

  if (coverage.suspiciousUntranslatedCount > 0) {
    warnings.push(
      `${coverage.suspiciousUntranslatedCount} Arabic values are still identical to English; Crowdin review will translate these later`
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    coverage,
    counts: {
      englishStrings: enEntries.length,
      arabicStrings: arEntries.length,
      topLevelNamespaces: requiredTopLevelNamespaces.length
    }
  };
}

export function formatQaResult(result) {
  const lines = [
    result.ok ? "I18N QA passed" : "I18N QA failed",
    `English strings: ${result.counts.englishStrings}`,
    `Arabic strings: ${result.counts.arabicStrings}`,
    `Arabic coverage strings with Arabic script: ${result.coverage.arabicStrings}`,
    `Arabic values identical to English: ${result.coverage.englishIdenticalStrings}`,
    `Placeholder-only strings: ${result.coverage.placeholderOnlyStrings}`
  ];

  if (result.warnings.length > 0) {
    lines.push("", "Warnings:");
    lines.push(...result.warnings.map((warning) => `- ${warning}`));
  }

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}

export function formatArabicCoverageReport(coverage) {
  const lines = [
    "Arabic translation coverage",
    `Total strings: ${coverage.totalStrings}`,
    `Arabic strings: ${coverage.arabicStrings}`,
    `English-identical strings: ${coverage.englishIdenticalStrings}`,
    `Placeholder-only strings: ${coverage.placeholderOnlyStrings}`,
    `Missing Arabic values: ${coverage.missingArabicValues}`,
    `Suspicious untranslated strings: ${coverage.suspiciousUntranslatedCount}`
  ];

  if (coverage.suspiciousUntranslated.length > 0) {
    lines.push("", "Sample suspicious untranslated strings:");
    for (const item of coverage.suspiciousUntranslated) {
      lines.push(`- ${item.key}: ${item.value}`);
    }
  }

  return lines.join("\n");
}

export async function runCrowdinPreflight({
  env = process.env,
  requireCredentials = false
} = {}) {
  const errors = [];
  const files = [
    ["crowdin.yml", messagePaths.crowdin],
    ["English source", messagePaths.en],
    ["Arabic target", messagePaths.ar]
  ];
  const fileStatus = files.map(([label, path]) => ({
    label,
    path,
    exists: existsSync(path)
  }));

  for (const file of fileStatus) {
    if (!file.exists) {
      errors.push(`${file.label} is missing at ${file.path}`);
    }
  }

  let configOk = false;
  if (existsSync(messagePaths.crowdin)) {
    const crowdinConfig = await readText(messagePaths.crowdin);
    const configErrors = [];
    validateCrowdinConfig(configErrors, crowdinConfig);
    errors.push(...configErrors);
    configOk = configErrors.length === 0;
  }

  const envStatus = {
    CROWDIN_PROJECT_ID: Boolean(env.CROWDIN_PROJECT_ID),
    CROWDIN_PERSONAL_TOKEN: Boolean(env.CROWDIN_PERSONAL_TOKEN)
  };

  if (requireCredentials) {
    for (const [key, present] of Object.entries(envStatus)) {
      if (!present) {
        errors.push(`${key} is required for Crowdin upload/download/sync`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    files: fileStatus,
    configOk,
    env: envStatus
  };
}

export function formatCrowdinPreflight(result) {
  const lines = [result.ok ? "Crowdin preflight passed" : "Crowdin preflight failed"];

  for (const file of result.files) {
    lines.push(`- ${file.label}: ${file.exists ? "found" : "missing"}`);
  }

  lines.push(`- crowdin.yml config: ${result.configOk ? "valid" : "invalid"}`);
  lines.push(
    `- CROWDIN_PROJECT_ID: ${result.env.CROWDIN_PROJECT_ID ? "present" : "missing"}`
  );
  lines.push(
    `- CROWDIN_PERSONAL_TOKEN: ${
      result.env.CROWDIN_PERSONAL_TOKEN ? "present" : "missing"
    }`
  );

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}

export function ensureCrowdinCli() {
  const result = spawnSync("crowdin", ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.error || result.status !== 0) {
    throw new Error(
      "Crowdin CLI is not installed or not on PATH. Install it externally, then rerun this command."
    );
  }
}

async function writeTempCrowdinConfig() {
  const dir = await mkdtemp(join(tmpdir(), "balcona-crowdin-"));
  const configPath = join(dir, "crowdin.yml");
  const baseConfig = await readText(messagePaths.crowdin);
  const tempConfig = [
    "project_id_env: CROWDIN_PROJECT_ID",
    "api_token_env: CROWDIN_PERSONAL_TOKEN",
    baseConfig.trimEnd(),
    ""
  ].join("\n");

  await writeFile(configPath, tempConfig, "utf8");

  return {
    configPath,
    cleanup: () => rm(dir, { recursive: true, force: true })
  };
}

export async function runCrowdinCliCommand(command, args = []) {
  const preflight = await runCrowdinPreflight({ requireCredentials: true });
  if (!preflight.ok) {
    throw new Error(formatCrowdinPreflight(preflight));
  }

  ensureCrowdinCli();

  const temp = await writeTempCrowdinConfig();
  try {
    const result = spawnSync(
      "crowdin",
      [command, ...args, "--config", temp.configPath],
      {
        cwd: repoRoot,
        env: process.env,
        stdio: "inherit",
        shell: process.platform === "win32"
      }
    );

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`Crowdin CLI exited with status ${result.status}`);
    }
  } finally {
    await temp.cleanup();
  }
}
