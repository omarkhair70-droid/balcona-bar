import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const requiredNamespaces = [
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
const sensitivePattern = /(api[_-]?token|secret|password|authorization|cookie)/i;

async function readText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), "utf8");
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

function flattenKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;

    return nested && typeof nested === "object" && !Array.isArray(nested)
      ? flattenKeys(nested, nextPrefix)
      : [nextPrefix];
  });
}

describe("i18n Crowdin foundation", () => {
  it("keeps English and Arabic message namespaces aligned", async () => {
    const enMessages = await readJson("../../apps/web/messages/en.json");
    const arMessages = await readJson("../../apps/web/messages/ar.json");

    for (const namespace of requiredNamespaces) {
      assert.ok(enMessages[namespace], `missing en namespace ${namespace}`);
      assert.ok(arMessages[namespace], `missing ar namespace ${namespace}`);
    }

    assert.deepEqual(flattenKeys(arMessages).sort(), flattenKeys(enMessages).sort());
  });

  it("keeps Crowdin configured for English source and Arabic output without secrets", async () => {
    const crowdinConfig = await readText("../../crowdin.yml");

    assert.match(crowdinConfig, /source:\s*\/apps\/web\/messages\/en\.json/);
    assert.match(
      crowdinConfig,
      /translation:\s*\/apps\/web\/messages\/%two_letters_code%\.json/
    );
    assert.match(crowdinConfig, /preserve_hierarchy:\s*true/);
    assert.doesNotMatch(crowdinConfig, sensitivePattern);
  });

  it("documents the Crowdin workflow and placeholder rules", async () => {
    const docs = await readText("../../docs/operations/i18n-crowdin.md");

    assert.match(docs, /apps\/web\/messages\/en\.json/);
    assert.match(docs, /crowdin upload sources/);
    assert.match(docs, /placeholders/i);
    assert.match(docs, /\{token\}/);
  });

  it("wires lang, dir, language switching, and debug locale support in shared code", async () => {
    const layoutSource = await readText("../../apps/web/app/layout.tsx");
    const switcherSource = await readText(
      "../../apps/web/components/i18n/language-switcher.tsx"
    );
    const debugReportSource = await readText(
      "../../apps/web/lib/observability/debug-report.ts"
    );

    assert.match(layoutSource, /<html lang=\{locale\} dir=\{getLocaleDirection\(locale\)\}/);
    assert.match(switcherSource, /LANGUAGE_OPTIONS\.map/);
    assert.match(switcherSource, /setLocale\(option\.locale\)/);
    assert.match(debugReportSource, /locale:\s*input\.locale \?\?/);
  });
});
