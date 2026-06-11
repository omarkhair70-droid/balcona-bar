#!/usr/bin/env node
import { formatQaResult, runI18nQa } from "./i18n-utils.mjs";

const result = await runI18nQa();

console.log(formatQaResult(result));

if (!result.ok) {
  process.exitCode = 1;
}
