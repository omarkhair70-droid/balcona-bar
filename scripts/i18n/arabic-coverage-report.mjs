#!/usr/bin/env node
import {
  calculateArabicCoverage,
  formatArabicCoverageReport,
  loadCatalogs
} from "./i18n-utils.mjs";

const { en, ar } = await loadCatalogs();
const coverage = calculateArabicCoverage(en, ar);

console.log(formatArabicCoverageReport(coverage));
