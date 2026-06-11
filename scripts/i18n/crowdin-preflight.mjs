#!/usr/bin/env node
import {
  formatCrowdinPreflight,
  runCrowdinPreflight
} from "./i18n-utils.mjs";

const requireCredentials = process.argv.includes("--require-credentials");
const result = await runCrowdinPreflight({ requireCredentials });

console.log(formatCrowdinPreflight(result));

if (!result.ok) {
  process.exitCode = 1;
}
