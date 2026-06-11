#!/usr/bin/env node
import {
  buildCrowdinDownloadTranslationsArgs,
  buildCrowdinUploadSourcesArgs,
  formatCrowdinDownloadDiagnostics,
  formatCrowdinPreflight,
  formatQaResult,
  getCrowdinDownloadFailureMessage,
  inspectCrowdinDownload,
  messagePaths,
  runCrowdinCliArgs,
  runCrowdinPreflight,
  runI18nQa,
  sha256File
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
- CROWDIN_LANGUAGE defaults to ar
- ALLOW_EMPTY_CROWDIN_DOWNLOAD=true allows diagnostics-only empty downloads

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

async function downloadWithDiagnostics() {
  const beforeHash = await sha256File(messagePaths.ar);
  const dryRunArgs = buildCrowdinDownloadTranslationsArgs({ dryRun: true });
  const downloadArgs = buildCrowdinDownloadTranslationsArgs();

  console.log("");
  console.log(`Crowdin dry run: crowdin ${dryRunArgs.join(" ")}`);

  try {
    await runCrowdinCliArgs(dryRunArgs);
  } catch (error) {
    throw new Error(
      `Crowdin download translations dry run failed. ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  await runCrowdinCliArgs(downloadArgs);

  const diagnostics = await inspectCrowdinDownload({ beforeHash });

  console.log("");
  console.log(formatCrowdinDownloadDiagnostics(diagnostics));

  const failureMessage = getCrowdinDownloadFailureMessage(diagnostics);
  if (failureMessage) {
    throw new Error(failureMessage);
  }

  return diagnostics;
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
        await runCrowdinCliArgs(buildCrowdinUploadSourcesArgs());
      }

      if (command === "download") {
        await downloadWithDiagnostics();
        await validateAfterDownload();
      }

      if (command === "sync") {
        await runCrowdinCliArgs(buildCrowdinUploadSourcesArgs());
        await downloadWithDiagnostics();
        await validateAfterDownload();
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
