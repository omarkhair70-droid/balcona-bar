import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const require = createRequire("/tmp/balcona-live-smoke/package.json");
const { chromium } = require("playwright");

const BASE_URL = (process.env.BALCONA_LIVE_WEB_URL ?? "https://balcona.158.101.254.30.sslip.io").replace(/\/$/, "");
const OUT = path.resolve("artifacts/oracle-live-smoke");

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "en-US"
});
const page = await context.newPage();

const results = [];
const consoleErrors = [];

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function shot(name) {
  const file = path.join(OUT, name + ".png");
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function assertHealthyDocument(label) {
  const metrics = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: document.body.innerText.slice(0, 5000),
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));

  if (metrics.scrollWidth > metrics.clientWidth + 2) {
    throw new Error(label + ": horizontal overflow " + metrics.scrollWidth + " > " + metrics.clientWidth);
  }

  const fatal = [
    "Application error",
    "Internal Server Error",
    "This page could not be found",
    "Unhandled Runtime Error"
  ];
  if (fatal.some((needle) => metrics.text.includes(needle))) {
    throw new Error(label + ": fatal page text detected at " + metrics.url);
  }
  if (!metrics.text.trim()) throw new Error(label + ": empty document at " + metrics.url);
  return metrics;
}

async function visit(label, route, options = {}) {
  const response = await page.goto(BASE_URL + route, {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  if (!response || response.status() >= 500) {
    throw new Error(label + ": HTTP " + (response?.status() ?? "no-response"));
  }
  if (options.waitMs) await page.waitForTimeout(options.waitMs);
  const metrics = await assertHealthyDocument(label);
  const screenshot = await shot(label.replace(/[^a-z0-9]+/gi, "-").toLowerCase());
  results.push({ label, route, status: response.status(), finalUrl: page.url(), screenshot, metrics: { title: metrics.title } });
}

try {
  await visit("web-root", "/", { waitMs: 600 });
  await visit("staff-login", "/staff/login", { waitMs: 400 });
  const staffInputs = await page.locator('input').count();
  if (staffInputs < 2) throw new Error("staff-login: expected login inputs");

  await visit("platform-login", "/platform/login", { waitMs: 400 });
  const platformInputs = await page.locator('input').count();
  if (platformInputs < 2) throw new Error("platform-login: expected login inputs");

  const response = await page.goto(BASE_URL + "/customer/table/balcona-main-t01", {
    waitUntil: "domcontentloaded",
    timeout: 30000
  });
  if (!response || response.status() >= 500) {
    throw new Error("customer-table: HTTP " + (response?.status() ?? "no-response"));
  }

  await page.waitForURL(/\/customer\/session\/[^/]+(?:\/)?$/, { timeout: 20000 });
  await page.waitForTimeout(900);
  const sessionUrl = new URL(page.url());
  const match = sessionUrl.pathname.match(/^\/customer\/session\/([^/]+)\/?$/);
  if (!match) throw new Error("customer-table: did not resolve a real session");
  const sessionId = match[1];

  const sessionMetrics = await assertHealthyDocument("customer-session");
  const sessionScreenshot = await shot("customer-session");
  results.push({
    label: "customer-session",
    route: "/customer/table/balcona-main-t01",
    status: response.status(),
    finalUrl: page.url(),
    sessionId,
    screenshot: sessionScreenshot,
    metrics: { title: sessionMetrics.title }
  });

  await visit("customer-menu", "/customer/session/" + sessionId + "/menu", { waitMs: 1200 });
  const menuText = await page.locator("body").innerText();
  if (!/Spanish Latte|Signature Latte|Cold Drinks|Bakery/i.test(menuText)) {
    throw new Error("customer-menu: seeded real cafe menu evidence not visible");
  }

  for (const [label, route] of [
    ["customer-status", "/customer/session/" + sessionId + "/status"],
    ["customer-service", "/customer/session/" + sessionId + "/service"],
    ["customer-ai-waiter", "/customer/session/" + sessionId + "/ai-waiter"],
    ["staff-cashier-route", "/staff/cashier"],
    ["staff-kitchen-route", "/staff/kitchen"],
    ["staff-waiter-route", "/staff/waiter"],
    ["staff-office-route", "/staff/owner"],
    ["staff-setup-route", "/staff/setup"],
    ["platform-status-route", "/platform/status"]
  ]) {
    await visit(label, route, { waitMs: 350 });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    result: "PASS",
    results,
    consoleErrors: consoleErrors.slice(0, 30)
  };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    result: "FAIL",
    error: String(error),
    currentUrl: page.url(),
    results,
    consoleErrors: consoleErrors.slice(0, 30)
  };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2), "utf8");
  try { await shot("failure"); } catch {}
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
