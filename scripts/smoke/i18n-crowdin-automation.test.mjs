import { strict as assert } from "node:assert";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, it } from "node:test";
import {
  calculateArabicCoverage,
  formatCrowdinPreflight,
  loadCatalogs,
  runCrowdinPreflight,
  runI18nQa
} from "../i18n/i18n-utils.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

async function readText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

describe("i18n Crowdin automation", () => {
  it("passes the reusable i18n QA checks", async () => {
    const result = await runI18nQa();

    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
  });

  it("keeps customer.ai.debug absent from Crowdin catalogs", async () => {
    const { en, ar } = await loadCatalogs();

    assert.equal(en.customer.ai.debug, undefined);
    assert.equal(ar.customer.ai.debug, undefined);
  });

  it("prints Arabic coverage counts without failing on English-identical values", async () => {
    const { en, ar } = await loadCatalogs();
    const coverage = calculateArabicCoverage(en, ar);

    assert.ok(coverage.totalStrings > 0);
    assert.ok(coverage.arabicStrings > 0);
    assert.ok(coverage.englishIdenticalStrings >= 0);
    assert.ok(Array.isArray(coverage.suspiciousUntranslated));
  });

  it("keeps Crowdin preflight output free of secret values", async () => {
    const result = await runCrowdinPreflight({
      requireCredentials: true,
      env: {
        CROWDIN_PROJECT_ID: "123456",
        CROWDIN_PERSONAL_TOKEN: "secret-value-that-must-not-print"
      }
    });
    const output = formatCrowdinPreflight(result);

    assert.equal(result.ok, true);
    assert.match(output, /CROWDIN_PROJECT_ID: present/);
    assert.match(output, /CROWDIN_PERSONAL_TOKEN: present/);
    assert.doesNotMatch(output, /123456/);
    assert.doesNotMatch(output, /secret-value-that-must-not-print/);
  });

  it("configures Crowdin source and Arabic target safely", async () => {
    const crowdinConfig = await readText("../../crowdin.yml");

    assert.match(crowdinConfig, /source:\s*\/apps\/web\/messages\/en\.json/);
    assert.match(
      crowdinConfig,
      /translation:\s*\/apps\/web\/messages\/%two_letters_code%\.json/
    );
    assert.match(crowdinConfig, /preserve_hierarchy:\s*true/);
    assert.doesNotMatch(crowdinConfig, /source:\s*\/apps\/web\/messages\/ar\.json/);
    assert.doesNotMatch(crowdinConfig, /^\s*(project_id|api_token|token)\s*:/im);
  });

  it("wires root package scripts for i18n QA and Crowdin sync", async () => {
    const packageJson = await readJson("../../package.json");
    const scripts = packageJson.scripts;

    for (const scriptName of [
      "i18n:qa",
      "i18n:qa:ar",
      "i18n:crowdin:preflight",
      "i18n:crowdin:upload",
      "i18n:crowdin:download",
      "i18n:crowdin:sync"
    ]) {
      assert.ok(scripts[scriptName], `missing package script ${scriptName}`);
    }
  });

  it("runs the i18n QA CLI successfully", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/i18n/i18n-qa.mjs"],
      { cwd: repoRoot }
    );

    assert.match(stdout, /I18N QA passed/);
  });

  it("runs the Crowdin preflight CLI without credentials", async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      ["scripts/i18n/crowdin-preflight.mjs"],
      { cwd: repoRoot }
    );

    assert.match(stdout, /Crowdin preflight passed/);
    assert.match(stdout, /CROWDIN_PERSONAL_TOKEN: (present|missing)/);
  });
});
