#!/usr/bin/env node
import {
  formatCrowdinPreflight,
  formatQaResult,
  runCrowdinCliCommand,
  runCrowdinPreflight,
  runI18nQa
} from "./i18n-utils.mjs";

const command = process.argv[2] ?? "preflight";
const allowedCommands = new Set(["preflight", "upload", "download", "sync"]);

function printUsage() {
  console.log(`Usage:
node scripts/i18n/crowdin-sync-helper.mjs preflight
node scripts/i18n/crowdin-sync-helper.mjs upload
node scripts/i18n/crowdin-sync-helper.mjs download
node scripts/i18n/crowdin-sync-helper.mjs sync

Crowdin upload/download/sync require:
- CROWDIN_PROJECT_ID
- CROWDIN_PERSONAL_TOKEN

Optional:
- CROWDIN_BRANCH defaults to main

Secret values are never printed.`);
}

async function preflight({ requireCredentials = false } = {}) {
  const result = await runCrowdinPreflight({ requireCredentials });

  console.log(formatCrowdinPreflight(result));

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result.ok;
}

async function validateAfterDownload() {
  const qa = await runI18nQa();

  console.log("");
  console.log(formatQaResult(qa));

  if (!qa.ok) {
    process.exitCode = 1;
    return false;
  }

  console.log("");
  console.log("Review any downloaded Arabic changes, then run:");
  console.log("- pnpm i18n:qa");
  console.log("- pnpm web:build");

  return true;
}

if (!allowedCommands.has(command)) {
  printUsage();
  process.exitCode = 1;
} else if (command === "preflight") {
  await preflight();
} else {
  const ok = await preflight({ requireCredentials: true });

  if (ok) {
    try {
      if (command === "upload") {
        await runCrowdinCliCommand("upload", ["sources"]);
      }

      if (command === "download") {
        await runCrowdinCliCommand("download");
        await validateAfterDownload();
      }

      if (command === "sync") {
        await runCrowdinCliCommand("upload", ["sources"]);
        await runCrowdinCliCommand("download");
        await validateAfterDownload();
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
