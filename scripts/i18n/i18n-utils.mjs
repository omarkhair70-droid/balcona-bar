import { createHash } from "node:crypto";
import { readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(__dirname, "../..");
export const englishCatalogPath = "apps/web/messages/en.json";
export const arabicCatalogPath = "apps/web/messages/ar.json";
export const messagePaths = {
  en: join(repoRoot, englishCatalogPath),
  ar: join(repoRoot, arabicCatalogPath),
  crowdin: join(repoRoot, "crowdin.yml")
};
export const crowdinSourcePath = "apps/web/messages/en.json";
export const crowdinTranslationPath = "apps/web/messages/%two_letters_code%.json";
export const defaultCrowdinBranch = "main";
export const unchangedCrowdinDownloadMessage =
  "Crowdin download completed but apps/web/messages/ar.json did not change. Check Crowdin branch/language/export path.";

const commonWrongCrowdinOutputFiles = [
  "apps/web/messages/ar-EG.json",
  "apps/web/messages/ar-eg.json",
  "apps/web/messages/Arabic.json",
  "apps/web/messages/en/ar.json"
];

const commonWrongCrowdinOutputDirectories = ["translations", "build"];
export const crowdinArabicExportCandidates = [
  "ar/apps/web/messages/ar.json",
  "ar-EG/apps/web/messages/ar.json"
];
export const crowdinArabicExportDirectories = ["ar", "ar-EG"];

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

export const forbiddenArabicMachineTranslationTerms = [
  "ناظر",
  "ناظر AI",
  "ناظر الذكاء",
  "مشروع القانون",
  "عربة التسوق",
  "قائمة التصفح",
  "فتح الجدول"
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

export async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
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

function validateNoForbiddenArabicMachineTranslations(errors, messages) {
  for (const [key, value] of flattenEntries(messages)) {
    for (const term of forbiddenArabicMachineTranslationTerms) {
      if (value.includes(term)) {
        errors.push(
          `ar.${key} contains blocked machine translation term "${term}"`
        );
      }
    }
  }
}

export function extractCrowdinLocalPaths(crowdinConfig) {
  const source = crowdinConfig.match(/^\s*-?\s*source:\s*(.+?)\s*$/m)?.[1]?.trim();
  const translation = crowdinConfig
    .match(/^\s*-?\s*translation:\s*(.+?)\s*$/m)?.[1]
    ?.trim();

  return {
    source: source?.replace(/^["']|["']$/g, ""),
    translation: translation?.replace(/^["']|["']$/g, "")
  };
}

function validateCrowdinConfig(errors, crowdinConfig) {
  const paths = extractCrowdinLocalPaths(crowdinConfig);

  if (paths.source !== crowdinSourcePath) {
    errors.push(`crowdin.yml must use ${crowdinSourcePath} as the source`);
  }

  if (paths.translation !== crowdinTranslationPath) {
    errors.push(
      `crowdin.yml must use ${crowdinTranslationPath} as the translation target`
    );
  }

  for (const [label, path] of Object.entries(paths)) {
    if (path?.startsWith("/")) {
      errors.push(
        `crowdin.yml ${label} path must be relative for Crowdin CLI compatibility`
      );
    }
  }

  if (!/preserve_hierarchy:\s*true/.test(crowdinConfig)) {
    errors.push("crowdin.yml must preserve hierarchy");
  }

  if (paths.source === "apps/web/messages/ar.json") {
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
  validateNoForbiddenArabicMachineTranslations(errors, ar);
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

export function runGitStatusShort() {
  const result = spawnSync("git", ["status", "--short"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`git status --short exited with status ${result.status}`);
  }

  return result.stdout.trimEnd();
}

function normalizeRepoPath(path) {
  return path.trim().replace(/^"|"$/g, "").replace(/\\/g, "/");
}

export function getNewMessageFilesFromGitStatus(statusShort) {
  return statusShort
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      const status = line.slice(0, 2);
      const rawPath = line.slice(3).split(" -> ").pop() ?? "";
      const path = normalizeRepoPath(rawPath);
      const isNew = status === "??" || status.includes("A");

      return isNew && path.startsWith("apps/web/messages/") ? [path] : [];
    });
}

async function listRepoFilesUnder(relativeDirectory, limit = 50) {
  const root = join(repoRoot, relativeDirectory);

  if (!existsSync(root)) {
    return [];
  }

  const found = [];
  const pending = [root];

  while (pending.length > 0 && found.length < limit) {
    const current = pending.shift();
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(current, entry.name);

      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }

      if (entry.isFile()) {
        found.push(normalizeRepoPath(relative(repoRoot, fullPath)));
      }

      if (found.length >= limit) {
        break;
      }
    }
  }

  return found;
}

export async function findCommonWrongCrowdinOutputPaths() {
  const existingFiles = commonWrongCrowdinOutputFiles.filter((path) =>
    existsSync(join(repoRoot, path))
  );
  const existingDirectoryFiles = (
    await Promise.all(
      commonWrongCrowdinOutputDirectories.map((path) => listRepoFilesUnder(path))
    )
  ).flat();

  return [...existingFiles, ...existingDirectoryFiles].sort();
}

export function getCrowdinDownloadFailureMessage(result) {
  return result.arJsonChanged || result.allowEmptyDownload
    ? undefined
    : unchangedCrowdinDownloadMessage;
}

export async function inspectCrowdinDownload({
  beforeHash,
  env = process.env,
  statusShort = runGitStatusShort()
} = {}) {
  const [afterHash, { en, ar }] = await Promise.all([
    sha256File(messagePaths.ar),
    loadCatalogs()
  ]);
  const coverage = calculateArabicCoverage(en, ar);
  const arJsonChanged = Boolean(beforeHash) && beforeHash !== afterHash;
  const allowEmptyDownload = env.ALLOW_EMPTY_CROWDIN_DOWNLOAD === "true";

  return {
    ok: arJsonChanged || allowEmptyDownload,
    arJsonChanged,
    beforeHash: beforeHash ?? null,
    afterHash,
    statusShort,
    obviousRemainingEnglishStrings: coverage.suspiciousUntranslatedCount,
    newlyCreatedMessageFiles: getNewMessageFilesFromGitStatus(statusShort),
    wrongOutputPaths: await findCommonWrongCrowdinOutputPaths(),
    allowEmptyDownload,
    errorMessage: arJsonChanged || allowEmptyDownload ? undefined : unchangedCrowdinDownloadMessage
  };
}

export function formatCrowdinDownloadDiagnostics(result) {
  const lines = [
    "Crowdin download diagnostics",
    "git status --short:",
    result.statusShort ? result.statusShort : "<clean>",
    `apps/web/messages/ar.json changed: ${result.arJsonChanged ? "yes" : "no"}`,
    `apps/web/messages/ar.json before sha256: ${result.beforeHash ?? "unavailable"}`,
    `apps/web/messages/ar.json after sha256: ${result.afterHash}`,
    `Obvious remaining English UI strings in ar.json: ${result.obviousRemainingEnglishStrings}`,
    `ALLOW_EMPTY_CROWDIN_DOWNLOAD: ${
      result.allowEmptyDownload ? "enabled" : "disabled"
    }`
  ];

  lines.push("Newly created files under apps/web/messages:");
  lines.push(
    result.newlyCreatedMessageFiles.length > 0
      ? result.newlyCreatedMessageFiles.map((path) => `- ${path}`).join("\n")
      : "<none>"
  );

  lines.push("Common wrong Crowdin output paths found:");
  lines.push(
    result.wrongOutputPaths.length > 0
      ? result.wrongOutputPaths.map((path) => `- ${path}`).join("\n")
      : "<none>"
  );

  if (result.errorMessage) {
    lines.push("", `Error: ${result.errorMessage}`);
  }

  return lines.join("\n");
}

export function validateArabicCatalogForApp(enMessages, arMessages) {
  const errors = [];

  validateCatalogParity(errors, enMessages, arMessages);
  validatePlaceholders(errors, enMessages, arMessages);
  validateNoEmptyValues(errors, "ar", flattenEntries(arMessages));
  validateNoForbiddenArabicMachineTranslations(errors, arMessages);

  return {
    ok: errors.length === 0,
    errors
  };
}

export function getCrowdinArabicExportCandidates(root = repoRoot) {
  return crowdinArabicExportCandidates.map((path) => ({
    relativePath: path,
    path: join(root, path),
    exists: existsSync(join(root, path))
  }));
}

export function selectCrowdinArabicExport(root = repoRoot) {
  const candidates = getCrowdinArabicExportCandidates(root);
  const selected = candidates.find((candidate) => candidate.exists);

  if (!selected) {
    throw new Error(
      `No Crowdin Arabic export found. Expected one of: ${crowdinArabicExportCandidates.join(
        ", "
      )}`
    );
  }

  return selected;
}

export async function normalizeCrowdinArabicCatalog({
  root = repoRoot,
  cleanupExportDirectories = true
} = {}) {
  const selected = selectCrowdinArabicExport(root);
  const englishCatalog = await readJson(join(root, englishCatalogPath));
  const arabicCatalog = await readJson(selected.path);
  const validation = validateArabicCatalogForApp(englishCatalog, arabicCatalog);

  if (!validation.ok) {
    throw new Error(
      [
        `Crowdin Arabic export ${selected.relativePath} failed validation`,
        ...validation.errors.map((error) => `- ${error}`)
      ].join("\n")
    );
  }

  const targetPath = join(root, arabicCatalogPath);

  await writeFile(targetPath, `${JSON.stringify(arabicCatalog, null, 2)}\n`, "utf8");

  const removedExportDirectories = [];

  if (cleanupExportDirectories) {
    for (const directory of crowdinArabicExportDirectories) {
      const directoryPath = join(root, directory);

      if (existsSync(directoryPath)) {
        await rm(directoryPath, { recursive: true, force: true });
        removedExportDirectories.push(directory);
      }
    }
  }

  return {
    selectedSourcePath: selected.relativePath,
    targetPath: arabicCatalogPath,
    keyCount: flattenEntries(arabicCatalog).length,
    removedExportDirectories,
    validation
  };
}

export function formatCrowdinArabicNormalizationResult(result) {
  const lines = [
    "Crowdin Arabic catalog normalized",
    `Selected source: ${result.selectedSourcePath}`,
    `Target catalog: ${result.targetPath}`,
    `Arabic key count: ${result.keyCount}`,
    `Validation: ${result.validation.ok ? "passed" : "failed"}`,
    `Removed export directories: ${
      result.removedExportDirectories.length > 0
        ? result.removedExportDirectories.join(", ")
        : "<none>"
    }`
  ];

  if (result.validation.errors?.length > 0) {
    lines.push("", "Validation errors:");
    lines.push(...result.validation.errors.map((error) => `- ${error}`));
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
    CROWDIN_PERSONAL_TOKEN: Boolean(env.CROWDIN_PERSONAL_TOKEN),
    CROWDIN_BRANCH: Boolean(env.CROWDIN_BRANCH?.trim())
  };

  if (requireCredentials) {
    for (const key of ["CROWDIN_PROJECT_ID", "CROWDIN_PERSONAL_TOKEN"]) {
      if (!envStatus[key]) {
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
  lines.push(
    `- CROWDIN_BRANCH: ${result.env.CROWDIN_BRANCH ? "present" : "defaulted"}`
  );

  if (result.errors.length > 0) {
    lines.push("", "Errors:");
    lines.push(...result.errors.map((error) => `- ${error}`));
  }

  return lines.join("\n");
}

export function getCrowdinBranch(env = process.env) {
  const branch = env.CROWDIN_BRANCH?.trim();

  return branch || defaultCrowdinBranch;
}

export function buildCrowdinCliArgs(command, args = [], env = process.env) {
  return [command, ...args, "--branch", getCrowdinBranch(env)];
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

export function getTempCrowdinConfigPath(now = Date.now()) {
  return join(repoRoot, `.crowdin.sync.${process.pid}.${now}.yml`);
}

export async function writeTempCrowdinConfig(now = Date.now()) {
  const configPath = getTempCrowdinConfigPath(now);
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
    cleanup: async () => {
      try {
        await unlink(configPath);
      } catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }
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
      [...buildCrowdinCliArgs(command, args), "--config", temp.configPath],
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
