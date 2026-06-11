#!/usr/bin/env node
import {
  formatCrowdinArabicNormalizationResult,
  normalizeCrowdinArabicCatalog
} from "./i18n-utils.mjs";

try {
  const result = await normalizeCrowdinArabicCatalog();

  console.log(formatCrowdinArabicNormalizationResult(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
